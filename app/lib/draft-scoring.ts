/** Draft message quality scoring to catch generic AI slop */

import { logger } from './logger';
import { getUserConfig } from './db';
import { buildLLMHeaders, buildLLMRequest, extractMessage } from './llm';

export interface DraftScore {
    overall: number; // 0-100
    specificity: number; // 0-100 (references real details)
    length: number; // 0-100 (appropriate length)
    hasAsk: boolean; // Clear call-to-action
    feedback: string[]; // Actionable improvement suggestions
    passesThreshold: boolean; // Overall score >= 70
}

export interface ScoringRequest {
    draft: string;
    contactName: string;
    companyName: string;
    contactRole?: string;
}

/**
 * Score a draft message for quality before sending
 *
 * Uses configured LLM (Gemini/OpenAI/Anthropic) to evaluate:
 * - Specificity: Does it reference real company/person details?
 * - Length: Is it 80-150 words?
 * - Clear ask: Does it request a specific action?
 */
export async function scoreDraft(request: ScoringRequest): Promise<DraftScore> {
    const { draft, contactName, companyName, contactRole } = request;

    // Check length first (no LLM needed)
    const wordCount = draft.split(/\s+/).filter(Boolean).length;
    const lengthScore = calculateLengthScore(wordCount);

    try {
        // Get LLM config (same as draft generation)
        const config = await getUserConfig();

        if (!config.llm_endpoint || !config.llm_api_key) {
            throw new Error('LLM endpoint not configured');
        }

        // Build scoring prompt
        const userPrompt = buildScoringPrompt(draft, contactName, companyName, contactRole);

        const requestBody = buildLLMRequest(
            {
                systemPrompt: 'You are a professional outreach quality evaluator. Analyze messages for specificity and effectiveness.',
                userPrompt,
                maxTokens: 300,
                temperature: 0.3,
            },
            config
        );

        const response = await fetch(config.llm_endpoint, {
            method: 'POST',
            headers: buildLLMHeaders(config.llm_api_key),
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`Scoring request failed: ${response.statusText}`);
        }

        const data = await response.json();
        const evaluation = extractMessage(data);

        return parseEvaluation(evaluation, lengthScore, wordCount);
    } catch (error) {
        logger.error('Draft scoring failed, using heuristics', 'draft-scoring', error);
        return heuristicScoring(draft, contactName, companyName, lengthScore, wordCount);
    }
}

// ─── Prompt Construction ────────────────────────────────────────────────────

function buildScoringPrompt(
    draft: string,
    contactName: string,
    companyName: string,
    contactRole?: string
): string {
    return `Evaluate this outreach message for quality on a scale of 0-100.

**Message:**
${draft}

**Context:**
- Recipient: ${contactName}${contactRole ? `, ${contactRole}` : ''}
- Company: ${companyName}

**Scoring Criteria:**

1. **Specificity (0-100):** Does the message reference something real and specific about ${companyName} or ${contactName}? Generic phrases like "your innovative work" or "leading company" score low. Mentions of specific products, blog posts, recent news, or personal work score high.

2. **Call-to-Action:** Does it clearly ask for something specific (brief call, coffee chat, 15-min conversation)? Yes/No.

3. **Feedback:** List 1-3 specific improvements to make this message more personal and effective.

**Output Format (JSON):**
{
  "specificity": <0-100>,
  "hasAsk": <true/false>,
  "feedback": ["suggestion 1", "suggestion 2"]
}`;
}

// ─── Response Parsing ───────────────────────────────────────────────────────

function parseEvaluation(evaluation: string, lengthScore: number, wordCount: number): DraftScore {
    try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = evaluation.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]);

        const specificity = Math.max(0, Math.min(100, parsed.specificity || 0));
        const hasAsk = parsed.hasAsk === true;

        // Overall score: weighted average
        const overall = Math.round(specificity * 0.5 + lengthScore * 0.3 + (hasAsk ? 20 : 0));

        return {
            overall,
            specificity,
            length: lengthScore,
            hasAsk,
            feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
            passesThreshold: overall >= 70,
        };
    } catch (error) {
        logger.error('Failed to parse LLM evaluation, using heuristics', 'draft-scoring', error);
        return heuristicScoring(evaluation, '', '', lengthScore, wordCount);
    }
}

// ─── Heuristic Fallback ─────────────────────────────────────────────────────

function heuristicScoring(
    draft: string,
    contactName: string,
    companyName: string,
    lengthScore: number,
    wordCount: number
): DraftScore {
    const lowerDraft = draft.toLowerCase();

    // Check for generic AI phrases (red flags)
    const genericPhrases = [
        'innovative work',
        'cutting-edge',
        'thought leader',
        'excited to connect',
        'leading company',
        'passionate about',
        'would love to learn',
        'impressed by your',
    ];

    const genericCount = genericPhrases.filter(phrase => lowerDraft.includes(phrase)).length;

    // Check for specific indicators
    const hasSpecificMention =
        /\b(product|blog|article|post|tweet|paper|project|launch|funding|series [a-d])\b/i.test(draft);
    const hasNumbersOrDates = /\b\d{4}\b|\b\d+%|\$\d+[kmb]?/i.test(draft);

    const specificityScore = Math.max(
        0,
        Math.min(
            100,
            50 + (hasSpecificMention ? 30 : 0) + (hasNumbersOrDates ? 20 : 0) - genericCount * 15
        )
    );

    // Check for ask
    const askPatterns = [
        /\b(call|chat|conversation|meeting|coffee|connect|discuss|talk)\b/i,
        /\b(15|20|30)[\s-]?(min|minute)/i,
        /\bavailable\b/i,
    ];
    const hasAsk = askPatterns.some(pattern => pattern.test(draft));

    const overall = Math.round(specificityScore * 0.5 + lengthScore * 0.3 + (hasAsk ? 20 : 0));

    const feedback: string[] = [];
    if (genericCount > 0) {
        feedback.push(`Remove generic phrases: ${genericPhrases.filter(p => lowerDraft.includes(p)).join(', ')}`);
    }
    if (!hasSpecificMention) {
        feedback.push('Add a specific reference to their work, product, or recent company news');
    }
    if (!hasAsk) {
        feedback.push('Include a clear ask (e.g., "Are you available for a brief 15-min call next week?")');
    }
    if (wordCount < 80) {
        feedback.push("Message is too short — add context about why you're reaching out");
    }
    if (wordCount > 150) {
        feedback.push('Message is too long — trim to under 150 words for higher response rate');
    }

    return {
        overall,
        specificity: specificityScore,
        length: lengthScore,
        hasAsk,
        feedback,
        passesThreshold: overall >= 70,
    };
}

function calculateLengthScore(wordCount: number): number {
    // Optimal: 80-150 words
    if (wordCount >= 80 && wordCount <= 150) return 100;
    if (wordCount >= 60 && wordCount < 80) return 80;
    if (wordCount > 150 && wordCount <= 180) return 80;
    if (wordCount >= 40 && wordCount < 60) return 60;
    if (wordCount > 180 && wordCount <= 220) return 60;
    if (wordCount < 40) return Math.max(20, wordCount * 1.5);
    // Very long messages score low
    return Math.max(20, 100 - (wordCount - 150) * 0.5);
}
