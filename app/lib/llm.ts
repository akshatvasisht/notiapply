/** LLM integration for draft message generation.
 *
 * Requires an OpenAI-compatible endpoint. Works natively with OpenAI, Gemini
 * (via `/v1beta/openai`), OpenRouter, Ollama, LM Studio, vLLM, DeepSeek, Groq,
 * Together, Fireworks, etc. For Anthropic Claude direct, route through
 * OpenRouter or LiteLLM; the native Anthropic /v1/messages format is no
 * longer supported directly.
 */

import { logger } from './logger';
import type { Contact, UserConfig } from './types';
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
        systemPrompt: 'You are an expert at crafting ultra-concise, high-conversion cold outreach messages for LinkedIn and email. Your messages follow a 3-sentence formula adapted to the recipient type: for recruiters use Hook → Role Fit → Resume CTA; for hiring managers use Interest Hook → Achievement → Challenge Question; for peer engineers/designers use Shared Interest → Problem → Soft Connection (NO job ask for peers). Keep it under 60 words, direct, and genuine. No fluff or formalities.',
        userPrompt: prompt,
        maxTokens: 200,  // Reduced from 300 to enforce brevity
        temperature: 0.7,
    };

    try {
        const requestBody = buildLLMRequest(llmRequest, config);

        const response = await fetch(config.llm_endpoint, {
            method: 'POST',
            headers: buildLLMHeaders(config.llm_api_key),
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`LLM request failed: ${response.statusText}`);
        }

        const data = await response.json();
        const message = extractMessage(data);

        return message.trim();
    } catch (error) {
        logger.error('Draft message generation failed', 'llm', error);
        throw new Error('Failed to generate message. Check LLM configuration.');
    }
}

// ─── Request / Response Shape (OpenAI chat-completions) ────────────────────

export function buildLLMHeaders(apiKey: string): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
}

export function buildLLMRequest(
    request: LLMRequest,
    config: UserConfig
): Record<string, unknown> {
    const { systemPrompt, userPrompt, maxTokens, temperature } = request;
    return {
        model: config.llm_model ?? 'gemini-1.5-flash',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
    };
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

type OutreachStrategy = 'recruiter' | 'hiring_manager' | 'peer' | 'generic';

export function classifyContactRole(role: string | null): OutreachStrategy {
    if (!role) return 'generic';
    const lower = role.toLowerCase();
    if (/recruit|talent|sourcer/.test(lower)) return 'recruiter';
    if (/hiring.manager|director|vp|head.of|chief|cto|ceo|founder/.test(lower)) return 'hiring_manager';
    if (/engineer|developer|designer|product manager|analyst|scientist/.test(lower)) return 'peer';
    return 'generic';
}

export function buildPrompt(
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

    const strategy = classifyContactRole(contact.role);

    const strategyTemplates: Record<OutreachStrategy, string> = {
        recruiter: `\n\nFormat (3 sentences max — recruiter strategy):
1. Opening: "Hi ${safeName}, I saw ${safeCompany} is hiring${safeJobTitle ? ` for ${safeJobTitle}` : ''}."
2. Fit: "My [X] experience in [SKILL] maps directly to what you're looking for."
3. CTA: "Happy to share my resume if it's a fit!"

Requirements:
- MAXIMUM 3 sentences (50-60 words total)
- Use contact's actual name (${safeName})
- Lead with the specific role${safeJobTitle ? ` (${safeJobTitle})` : ''}
- Highlight 1-2 directly relevant skills
- End with resume CTA
- ${sanitizeForPrompt(tone)} tone
- NO placeholders like [Your Name] - leave unsigned
- NO formality or fluff`,

        hiring_manager: `\n\nFormat (3 sentences max — hiring manager strategy):
1. Hook: "Hi ${safeName}, ${safeCompany}'s work on [AREA] caught my attention."
2. Value: "I've been [RELEVANT ACHIEVEMENT] — directly relevant to what your team is building."
3. Question: "Would love to hear how your team approaches [RELATED CHALLENGE]?"

Requirements:
- MAXIMUM 3 sentences (50-60 words total)
- Use contact's actual name (${safeName})
- Lead with genuine interest in company work, not job opening
- Include one concrete achievement
- End with a thoughtful question, not a resume ask
- ${sanitizeForPrompt(tone)} tone
- NO placeholders like [Your Name] - leave unsigned`,

        peer: `\n\nFormat (3 sentences max — peer strategy — NO JOB PITCH):
1. Hook: "Hi ${safeName}, I came across your [WORK/POST/PROJECT]."
2. Shared interest: "I've been exploring similar problems around [AREA]."
3. Soft CTA: "Would love to exchange notes sometime!"

CRITICAL RULES for peer strategy:
- MAXIMUM 3 sentences (50-60 words total)
- Use contact's actual name (${safeName})
- NEVER mention the job opening or that you're job searching
- Frame entirely as professional connection and shared interests
- End with soft "exchange notes" CTA, NOT "discuss the role"
- ${sanitizeForPrompt(tone)} tone
- NO placeholders like [Your Name] - leave unsigned`,

        generic: `\n\nFormat (3 sentences max):
1. Opening: "Hi ${safeName}, I saw ${safeCompany} is hiring${safeJobTitle ? ` for ${safeJobTitle}` : ''}."
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
- NO formality or fluff - keep it direct and genuine`,
    };

    parts.push(strategyTemplates[strategy]);

    return parts.join(' ');
}

export function extractMessage(data: unknown): string {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid LLM response: not an object');
    }

    const res = data as Record<string, unknown>;

    // OpenAI chat-completions shape — the common path.
    if (Array.isArray(res.choices) && res.choices.length > 0) {
        const choice = res.choices[0] as Record<string, unknown>;
        const message = choice.message as Record<string, unknown>;
        if (typeof message?.content === 'string') {
            return message.content;
        }
    }

    // Gemini native-endpoint fallback — kept so users hitting
    // `generativelanguage.googleapis.com/v1beta/models/...:generateContent`
    // (the non-openai path) still work without config changes.
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

    throw new Error(`Unexpected LLM response format: ${JSON.stringify(data)}`);
}
