/** LLM integration for draft message generation with multi-provider support */

import { logger } from './logger';
import type { Contact, UserConfig, LLMProvider } from './types';
import { getUserConfig } from './db';

export interface DraftMessageRequest {
    contact: Contact;
    jobTitle?: string;
    companyName?: string;
    tone?: string;
    resumeContext?: string;  // User's key skills/experience for value prop
}

interface LLMRequest {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    temperature: number;
}

/**
 * Generate a personalized outreach message using LLM
 *
 * Supports multiple LLM providers: OpenAI, Anthropic, Gemini
 */
export async function generateDraftMessage(request: DraftMessageRequest): Promise<string> {
    const config = await getUserConfig();

    if (!config.llm_endpoint || !config.llm_api_key) {
        throw new Error('LLM endpoint not configured. Please update settings.');
    }

    const { contact, jobTitle, companyName, tone = config.crm_message_tone ?? 'professional', resumeContext } = request;

    const prompt = buildPrompt(contact, jobTitle, companyName, tone, resumeContext);

    const llmRequest: LLMRequest = {
        systemPrompt: 'You are an expert at crafting ultra-concise, high-conversion cold outreach messages for LinkedIn and email. Your messages follow the proven 3-sentence formula: Hook → Value → CTA. Keep it under 60 words, direct, and genuine. No fluff or formalities.',
        userPrompt: prompt,
        maxTokens: 200,  // Reduced from 300 to enforce brevity
        temperature: 0.7,
    };

    try {
        const provider = config.llm_provider ?? 'gemini';
        const requestBody = buildProviderRequest(provider, llmRequest, config);

        const response = await fetch(config.llm_endpoint, {
            method: 'POST',
            headers: buildProviderHeaders(provider, config.llm_api_key),
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`LLM request failed: ${response.statusText}`);
        }

        const data = await response.json();
        const message = extractMessage(data, provider);

        return message.trim();
    } catch (error) {
        logger.error('Draft message generation failed', 'llm', error);
        throw new Error('Failed to generate message. Check LLM configuration.');
    }
}

// ─── Provider-Specific Request Builders ────────────────────────────────────

export function buildProviderHeaders(provider: LLMProvider, apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    switch (provider) {
        case 'openai':
        case 'gemini':
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'anthropic':
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            break;
    }

    return headers;
}

export function buildProviderRequest(
    provider: LLMProvider,
    request: LLMRequest,
    config: UserConfig
): Record<string, unknown> {
    const { systemPrompt, userPrompt, maxTokens, temperature } = request;

    switch (provider) {
        case 'openai':
        case 'gemini':
            // OpenAI-compatible format (Gemini uses OpenAI-compatible API)
            return {
                model: config.llm_model ?? 'gemini-1.5-flash',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: maxTokens,
                temperature,
            };

        case 'anthropic':
            return {
                model: config.llm_model ?? 'claude-3-5-sonnet-20241022',
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: maxTokens,
                temperature,
            };

        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
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
            logger.error(`Failed to generate message for contact ${contact.id}`, 'llm', error);
            // Continue with other contacts even if one fails
        }
    }

    return results;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Sanitize user input to prevent prompt injection attacks
 * Removes newlines and limiting instruction-like patterns
 */
function sanitizeForPrompt(text: string): string {
    return text
        .replace(/\n/g, ' ')  // Remove newlines
        .replace(/\r/g, '')   // Remove carriage returns
        .replace(/IGNORE|DISREGARD|OVERRIDE|SYSTEM:|ASSISTANT:/gi, '') // Remove command-like words
        .substring(0, 200)    // Limit length
        .trim();
}

function buildPrompt(
    contact: Contact,
    jobTitle?: string,
    companyName?: string,
    tone: string = 'professional',
    resumeContext?: string
): string {
    const parts: string[] = [];

    // Sanitize all user-controlled inputs to prevent prompt injection
    const safeName = sanitizeForPrompt(contact.name);
    const safeRole = contact.role ? sanitizeForPrompt(contact.role) : null;
    const safeCompany = sanitizeForPrompt(contact.company_name);
    const safeJobTitle = jobTitle ? sanitizeForPrompt(jobTitle) : null;
    const safeResumeContext = resumeContext ? sanitizeForPrompt(resumeContext) : null;

    // Build context for LLM
    parts.push(`Write a concise LinkedIn/cold outreach message to ${safeName}`);

    if (safeRole) {
        parts.push(`who is a ${safeRole}`);
    }

    parts.push(`at ${safeCompany}.`);

    if (safeJobTitle) {
        parts.push(`\n\nContext: Reaching out about the ${safeJobTitle} role at ${companyName ? sanitizeForPrompt(companyName) : safeCompany}.`);
    }

    if (safeResumeContext) {
        parts.push(`\n\nMy background: ${safeResumeContext}`);
    }

    if (contact.company_industry) {
        const safeIndustry = sanitizeForPrompt(contact.company_industry);
        parts.push(`\nCompany: ${safeCompany} (${safeIndustry} industry).`);
    }

    if (contact.linkedin_posts_summary) {
        const safeSummary = sanitizeForPrompt(contact.linkedin_posts_summary);
        parts.push(`\nRecent activity: ${safeSummary}`);
    }

    // Provide template structure based on best practices
    parts.push(`\n\nFormat (3 sentences max):
1. Opening: "Hi [Name], I saw your hiring for [ROLE] at [COMPANY]."
2. Value prop: "My experience in [SPECIFIC SKILL/AREA] would be a great fit."
3. CTA: "Would love to connect and discuss!"

Requirements:
- MAXIMUM 3 sentences (50-60 words total)
- Use contact's actual name (${safeName})
- Reference the specific role${safeJobTitle ? ` (${safeJobTitle})` : ''}
- Mention 1-2 specific relevant skills/experiences
- End with simple CTA: "Would love to connect and discuss!"
- ${sanitizeForPrompt(tone)} tone
- NO placeholders like [Your Name] - leave unsigned
- NO formality or fluff - keep it direct and genuine`);

    return parts.join(' ');
}

export function extractMessage(data: unknown, provider: LLMProvider): string {
    if (!data || typeof data !== 'object') {
        throw new Error(`Invalid ${provider} response: not an object`);
    }

    const res = data as Record<string, unknown>;

    switch (provider) {
        case 'openai':
        case 'gemini':
            // OpenAI format (also used by Gemini's OpenAI-compatible API)
            if (Array.isArray(res.choices) && res.choices.length > 0) {
                const choice = res.choices[0] as Record<string, unknown>;
                const message = choice.message as Record<string, unknown>;
                if (typeof message?.content === 'string') {
                    return message.content;
                }
            }
            // Fallback to Gemini native format
            if (Array.isArray(res.candidates) && res.candidates.length > 0) {
                const candidate = res.candidates[0] as Record<string, unknown>;
                const content = candidate.content as Record<string, unknown>;
                if (Array.isArray(content?.parts) && content.parts.length > 0) {
                    const part = content.parts[0] as Record<string, unknown>;
                    if (typeof part?.text === 'string') {
                        return part.text;
                    }
                }
            }
            break;

        case 'anthropic':
            if (Array.isArray(res.content) && res.content.length > 0) {
                const block = res.content[0] as Record<string, unknown>;
                if (typeof block?.text === 'string') {
                    return block.text;
                }
            }
            break;
    }

    throw new Error(`Unexpected ${provider} response format: ${JSON.stringify(data)}`);
}
