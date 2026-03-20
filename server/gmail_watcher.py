"""Gmail API Reply Detection Service

Monitors Gmail inbox for replies from contacts in the database.
Auto-updates contacts.got_response and adds entries to interaction_log.

Setup:
1. Enable Gmail API in Google Cloud Console
2. Download credentials.json to server/gmail_credentials.json
3. Run once to authenticate: python gmail_watcher.py --auth
4. Deploy as cron job or systemd service

Usage:
    python gmail_watcher.py --check  # Check for new replies (run every 5-15 min)
"""

import json
import os
import sys
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import psycopg2

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
except ImportError:
    print("Error: Google API client not installed. Run: pip install google-auth-oauthlib google-api-python-client", file=sys.stderr)
    sys.exit(1)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Paths
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), 'gmail_credentials.json')
TOKEN_PATH = os.path.join(os.path.dirname(__file__), 'gmail_token.json')


def get_gmail_service():
    """Authenticate and return Gmail API service."""
    creds = None

    # Load existing token
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    # Refresh or re-authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_PATH):
                raise FileNotFoundError(
                    f"Gmail credentials not found at {CREDENTIALS_PATH}. "
                    "Download from Google Cloud Console."
                )
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        # Save credentials
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)


def get_contacts_awaiting_response(db_url: str) -> List[Dict]:
    """Get all contacts in 'contacted' state with email addresses."""
    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, email, company_name, last_contacted_at
                FROM contacts
                WHERE state = 'contacted'
                  AND got_response IS NULL
                  AND email IS NOT NULL
                  AND email != ''
                ORDER BY last_contacted_at DESC NULLS LAST
            """)

            contacts = []
            for row in cur.fetchall():
                contacts.append({
                    'id': row[0],
                    'name': row[1],
                    'email': row[2].lower(),  # Normalize
                    'company_name': row[3],
                    'last_contacted_at': row[4],
                })

    return contacts


def check_for_replies(service, contacts: List[Dict], lookback_days: int = 14) -> List[Dict]:
    """Check Gmail for replies from contacts.

    Returns list of {contact_id, email, subject, snippet, timestamp}
    """
    replies = []

    # Build query: emails from any of the contact addresses
    contact_emails = [c['email'] for c in contacts]
    if not contact_emails:
        return []

    # Gmail query: from:(email1 OR email2 OR ...) newer_than:14d
    after_date = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y/%m/%d')
    email_query = ' OR '.join(contact_emails)
    query = f'from:({email_query}) after:{after_date}'

    try:
        results = service.users().messages().list(
            userId='me',
            q=query,
            maxResults=500  # Adjust if needed
        ).execute()

        messages = results.get('messages', [])

        for msg in messages:
            # Get message details
            msg_data = service.users().messages().get(
                userId='me',
                id=msg['id'],
                format='metadata',
                metadataHeaders=['From', 'Subject', 'Date']
            ).execute()

            headers = {h['name']: h['value'] for h in msg_data.get('payload', {}).get('headers', [])}
            from_email = extract_email(headers.get('From', ''))

            # Match to contact
            matching_contact = next((c for c in contacts if c['email'] == from_email.lower()), None)

            if matching_contact:
                replies.append({
                    'contact_id': matching_contact['id'],
                    'contact_name': matching_contact['name'],
                    'email': from_email,
                    'subject': headers.get('Subject', '(no subject)'),
                    'snippet': msg_data.get('snippet', ''),
                    'timestamp': headers.get('Date', ''),
                    'message_id': msg['id'],
                })

    except Exception as e:
        print(f"Error querying Gmail: {e}", file=sys.stderr)

    return replies


def extract_email(from_field: str) -> str:
    """Extract email from 'Name <email@example.com>' format."""
    if '<' in from_field and '>' in from_field:
        return from_field.split('<')[1].split('>')[0].strip()
    return from_field.strip()


def update_contact_response(db_url: str, contact_id: int, reply: Dict):
    """Mark contact as got_response=true and log interaction."""
    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            interaction = {
                'timestamp': datetime.now().isoformat(),
                'event': 'Email reply received',
                'notes': f"Subject: {reply['subject']} — {reply['snippet'][:100]}...",
            }

            cur.execute("""
                UPDATE contacts
                SET got_response = true,
                    state = 'replied',
                    interaction_log = interaction_log || %s::jsonb
                WHERE id = %s
            """, (json.dumps(interaction), contact_id))

            conn.commit()

    print(f"✓ Marked contact #{contact_id} ({reply['contact_name']}) as replied")


def main():
    parser = argparse.ArgumentParser(description='Gmail Reply Detection Service')
    parser.add_argument('--auth', action='store_true', help='Run OAuth flow to authenticate')
    parser.add_argument('--check', action='store_true', help='Check for new replies')
    parser.add_argument('--db-url', help='PostgreSQL connection string (or set DATABASE_URL env var)')
    parser.add_argument('--lookback-days', type=int, default=14, help='How many days back to check (default: 14)')

    args = parser.parse_args()

    # Get database URL
    db_url = args.db_url or os.getenv('DATABASE_URL')
    if not db_url and args.check:
        print("Error: --db-url required or set DATABASE_URL environment variable", file=sys.stderr)
        sys.exit(1)

    # Authenticate
    if args.auth:
        print("Starting OAuth flow...")
        service = get_gmail_service()
        print("✓ Authentication successful! Token saved to", TOKEN_PATH)
        return

    # Check for replies
    if args.check:
        print(f"Checking Gmail for replies (past {args.lookback_days} days)...")

        service = get_gmail_service()
        contacts = get_contacts_awaiting_response(db_url)

        if not contacts:
            print("No contacts awaiting response.")
            return

        print(f"Found {len(contacts)} contacts awaiting response")

        replies = check_for_replies(service, contacts, args.lookback_days)

        if not replies:
            print("No new replies found.")
            return

        print(f"\nFound {len(replies)} replies:")
        for reply in replies:
            update_contact_response(db_url, reply['contact_id'], reply)

        print(f"\n✓ Updated {len(replies)} contacts")
        return

    # No args provided
    parser.print_help()


if __name__ == '__main__':
    main()
