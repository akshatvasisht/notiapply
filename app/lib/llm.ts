/** LLM integration for draft message generation */

import type { Contact, UserConfig } from './types';
import { getUserConfig } from './db';

export interface DraftMessageRequest {
    contact: Contact;
    jobTitle?: string;
    companyName?: string;
    tone?: string;
}

/**
 * Generate a personalized outreach message using LLM
 *
 * Uses the configured LLM endpoint (Gemini, OpenAI, etc.) to generate
 * context-aware messages based on contact info and job details.
 */
export async function generateDraftMessage(request: DraftMessageRequest): Promise<string> {
    const config = await getUserConfig();

    if (!config.llm_endpoint || !config.llm_api_key) {
        throw new Error('LLM endpoint not configured. Please update settings.');
    }

    const { contact, jobTitle, companyName, tone = config.crm_message_tone ?? 'professional' } = request;

    const prompt = buildPrompt(contact, jobTitle, companyName, tone);

    try {
        const response = await fetch(config.llm_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.llm_api_key}`,
            },
            body: JSON.stringify({
                model: config.llm_model ?? 'gemini-1.5-flash',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional career advisor helping craft concise, personalized outreach messages for job seekers. Keep messages under 150 words, warm but professional.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: 300,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            throw new Error(`LLM request failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle different LLM response formats
        const message = extractMessage(data);

        return message.trim();
    } catch (error) {
        console.error('Draft message generation failed:', error);
        throw new Error('Failed to generate message. Check LLM configuration.');
    }
}

/**
 * Generate messages for multiple contacts in batch
 */
export async function generateBatchMessages(
    contacts: Contact[],
    onProgress?: (index: number, total: number) => void
): Promise<Map<number, string>> {
    const results = new Map<number, string>();

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        try {
            const message = await generateDraftMessage({
                contact,
                jobTitle: contact.role ?? undefined,
                companyName: contact.company_name,
            });

            results.set(contact.id, message);

            if (onProgress) {
                onProgress(i + 1, contacts.length);
            }

            // Rate limiting: 500ms delay between requests
            if (i < contacts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error(`Failed to generate message for contact ${contact.id}:`, error);
            // Continue with other contacts even if one fails
        }
    }

    return results;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function buildPrompt(
    contact: Contact,
    jobTitle?: string,
    companyName?: string,
    tone: string = 'professional'
): string {
    const parts: string[] = [];

    parts.push(`Write a ${tone} outreach message to ${contact.name}`);

    if (contact.role) {
        parts.push(`who is a ${contact.role}`);
    }

    parts.push(`at ${contact.company_name}.`);

    if (jobTitle) {
        parts.push(`\n\nContext: I'm interested in the ${jobTitle} role at ${companyName ?? contact.company_name}.`);
    }

    if (contact.company_industry) {
        parts.push(`\n\nCompany background: ${contact.company_name} is in the ${contact.company_industry} industry.`);
    }

    if (contact.linkedin_posts_summary) {
        parts.push(`\n\nRecent activity: ${contact.linkedin_posts_summary}`);
    }

    parts.push(`\n\nRequirements:
- Under 150 words
- Personalized and specific
- Express genuine interest
- Request a brief conversation
- Professional but warm tone
- DO NOT use placeholders like [Your Name] - leave signature blank`);

    return parts.join(' ');
}

function extractMessage(data: any): string {
    // OpenAI format
    if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
    }

    // Gemini format
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    }

    // Anthropic format
    if (data.content?.[0]?.text) {
        return data.content[0].text;
    }

    throw new Error('Unexpected LLM response format');
}
