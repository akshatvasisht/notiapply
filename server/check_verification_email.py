#!/usr/bin/env python3
"""
Check Gmail for ATS verification emails

Searches for recent emails from ATS platforms containing verification/confirmation links.
Returns the first verification link found as JSON.

Usage:
    python check_verification_email.py --email user@gmail.com --from-domain greenhouse.io --since 1710884400000

Output (JSON):
    {"verification_link": "https://..."}  # If found
    {}                                     # If not found
"""

import argparse
import json
import re
import sys
from typing import Optional

try:
    from gmail_auth import get_gmail_service
except ImportError:
    print(json.dumps({"error": "Gmail API not installed"}), file=sys.stderr)
    sys.exit(1)


def extract_verification_link(email_body: str, from_domain: str) -> Optional[str]:
    """
    Extract verification link from email body.

    Common patterns:
    - https://domain.com/verify?token=...
    - https://domain.com/confirm-email/...
    - https://domain.com/activate/...
    """
    # Common verification URL patterns
    patterns = [
        r'https?://[^\s<>"]+/(?:verify|confirm|activate|email-confirmation)[^\s<>"]*',
        r'https?://[^\s<>"]+\?(?:[^"\s]*&)?(?:token|verification|confirm)[^\s<>"]*',
        r'https?://[^\s<>"]+/[a-zA-Z0-9_-]{20,}',  # Long random tokens
    ]

    for pattern in patterns:
        matches = re.findall(pattern, email_body, re.IGNORECASE)
        for match in matches:
            # Ensure link is from expected domain
            if from_domain in match:
                return match

    return None


def check_verification_email(user_email: str, from_domain: str, since_timestamp_ms: int) -> Optional[str]:
    """
    Check Gmail for verification email from specific domain.

    Args:
        user_email: User's Gmail address
        from_domain: Domain to filter emails from (e.g., 'greenhouse.io')
        since_timestamp_ms: Only check emails after this timestamp (milliseconds)

    Returns:
        Verification link if found, None otherwise
    """
    try:
        service = get_gmail_service()

        # Convert timestamp to Gmail query format (seconds)
        since_timestamp_sec = since_timestamp_ms // 1000
        query = f'from:{from_domain} after:{since_timestamp_sec} (verify OR confirm OR activate OR "confirm your email" OR "verify your account")'

        # Search for messages
        results = service.users().messages().list(
            userId='me',
            q=query,
            maxResults=5  # Check recent 5 emails
        ).execute()

        messages = results.get('messages', [])

        for msg in messages:
            # Get full message
            message = service.users().messages().get(
                userId='me',
                id=msg['id'],
                format='full'
            ).execute()

            # Extract email body
            payload = message.get('payload', {})
            body = ''

            if 'parts' in payload:
                for part in payload['parts']:
                    if part.get('mimeType') == 'text/plain':
                        body_data = part.get('body', {}).get('data', '')
                        if body_data:
                            import base64
                            body = base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                            break
            elif 'body' in payload:
                body_data = payload['body'].get('data', '')
                if body_data:
                    import base64
                    body = base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')

            # Extract verification link
            verification_link = extract_verification_link(body, from_domain)
            if verification_link:
                return verification_link

        return None

    except FileNotFoundError:
        # Gmail not configured - return empty result
        return None
    except Exception as e:
        print(f"Error checking email: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description='Check Gmail for ATS verification email')
    parser.add_argument('--email', required=True, help='User email address')
    parser.add_argument('--from-domain', required=True, help='Domain to filter from (e.g., greenhouse.io)')
    parser.add_argument('--since', required=True, type=int, help='Timestamp (ms) to start checking from')

    args = parser.parse_args()

    verification_link = check_verification_email(args.email, args.from_domain, args.since)

    result = {}
    if verification_link:
        result['verification_link'] = verification_link

    print(json.dumps(result))


if __name__ == '__main__':
    main()
