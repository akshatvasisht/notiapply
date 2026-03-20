import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreDraft, type ScoringRequest } from './draft-scoring';
import type { UserConfig } from './types';

// Mock dependencies
vi.mock('./db', () => ({
    getUserConfig: vi.fn(),
}));

vi.mock('./logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('./llm', () => ({
    buildProviderHeaders: vi.fn(() => ({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-key',
    })),
    buildProviderRequest: vi.fn(() => ({
        model: 'gpt-4',
        messages: [],
    })),
    extractMessage: vi.fn(),
}));

import { getUserConfig } from './db';
import { extractMessage } from './llm';

describe('Draft Scoring', () => {
    const mockConfig: UserConfig = {
        llm_endpoint: 'https://api.test.com/v1/chat',
        llm_api_key: 'test-api-key',
        llm_provider: 'openai',
        llm_model: 'gpt-4',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getUserConfig).mockResolvedValue(mockConfig);
        global.fetch = vi.fn();
    });

    describe('scoreDraft - LLM evaluation', () => {
        it('scores high-quality draft correctly', async () => {
            const request: ScoringRequest = {
                draft:
                    "Hi Jane, I read your recent blog post about TechCorp's new ML pipeline and was impressed by the 40% performance improvement. I'm applying for the Senior Engineer role and would love to discuss how my experience with distributed systems could contribute. Are you available for a brief 15-min call next week?",
                contactName: 'Jane Doe',
                companyName: 'TechCorp',
                contactRole: 'Engineering Manager',
            };

            const mockEvaluation = JSON.stringify({
                specificity: 85,
                hasAsk: true,
                feedback: ['Great mention of specific blog post', 'Clear time commitment (15 min)'],
            });

            vi.mocked(extractMessage).mockReturnValue(mockEvaluation);
            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => ({}),
            } as Response);

            const result = await scoreDraft(request);

            expect(result.specificity).toBe(85);
            expect(result.hasAsk).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(60); // Message has good length (60+ words)
            expect(result.overall).toBeGreaterThan(70);
            expect(result.passesThreshold).toBe(true);
            expect(result.feedback).toHaveLength(2);
        });

        it('scores generic draft poorly', async () => {
            const request: ScoringRequest = {
                draft: "Hi, I'm interested in working at your innovative company. Let me know if you want to chat!",
                contactName: 'Jane Doe',
                companyName: 'TechCorp',
            };

            const mockEvaluation = JSON.stringify({
                specificity: 20,
                hasAsk: false,
                feedback: [
                    'Too generic - no specific company details',
                    'Vague ask - specify time commitment',
                    'Message too short',
                ],
            });

            vi.mocked(extractMessage).mockReturnValue(mockEvaluation);
            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => ({}),
            } as Response);

            const result = await scoreDraft(request);

            expect(result.specificity).toBe(20);
            expect(result.hasAsk).toBe(false);
            expect(result.passesThreshold).toBe(false);
            expect(result.feedback.length).toBeGreaterThan(0);
        });

        it('handles JSON in markdown code blocks', async () => {
            const request: ScoringRequest = {
                draft: 'Test message with good length and specificity about TechCorp recent Series B funding',
                contactName: 'Jane',
                companyName: 'TechCorp',
            };

            const mockEvaluation = `Here's the evaluation:

\`\`\`json
{
  "specificity": 75,
  "hasAsk": true,
  "feedback": ["Good mention of funding"]
}
\`\`\``;

            vi.mocked(extractMessage).mockReturnValue(mockEvaluation);
            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => ({}),
            } as Response);

            const result = await scoreDraft(request);

            expect(result.specificity).toBe(75);
            expect(result.hasAsk).toBe(true);
        });

        it('caps scores at 0-100 range', async () => {
            const request: ScoringRequest = {
                draft: 'Test message',
                contactName: 'Jane',
                companyName: 'TechCorp',
            };

            const mockEvaluation = JSON.stringify({
                specificity: 150, // Invalid - over 100
                hasAsk: true,
                feedback: [],
            });

            vi.mocked(extractMessage).mockReturnValue(mockEvaluation);
            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => ({}),
            } as Response);

            const result = await scoreDraft(request);

            expect(result.specificity).toBe(100); // Capped
            expect(result.specificity).toBeLessThanOrEqual(100);
        });

        it('throws error when LLM not configured', async () => {
            vi.mocked(getUserConfig).mockResolvedValue({
                ...mockConfig,
                llm_endpoint: undefined,
                llm_api_key: undefined,
            });

            const request: ScoringRequest = {
                draft: 'Test message',
                contactName: 'Jane',
                companyName: 'TechCorp',
            };

            // Should fall back to heuristics instead of throwing
            const result = await scoreDraft(request);
            expect(result).toHaveProperty('overall');
            expect(result).toHaveProperty('specificity');
        });
    });

    describe('scoreDraft - Heuristic fallback', () => {
        beforeEach(() => {
            // Force LLM to fail so heuristics are used
            vi.mocked(global.fetch).mockRejectedValue(new Error('API error'));
        });

        it('detects generic phrases', async () => {
            const request: ScoringRequest = {
                draft:
                    "I'm excited to connect and learn about your innovative work at your leading company. You seem like a thought leader in cutting-edge technology.",
                contactName: 'Jane',
                companyName: 'TechCorp',
            };

            const result = await scoreDraft(request);

            expect(result.specificity).toBeLessThan(50); // Penalized for generic phrases
            expect(result.feedback.some(f => f.includes('generic'))).toBe(true);
        });

        it('rewards specific mentions', async () => {
            const request: ScoringRequest = {
                draft:
                    'I read your blog post about the new ML product launch in 2024. Your Series B funding announcement was impressive. Could we schedule a 15-minute call to discuss the Engineering role?',
                contactName: 'Jane',
                companyName: 'TechCorp',
            };

            const result = await scoreDraft(request);

            expect(result.specificity).toBeGreaterThan(70); // Boosted for specifics
            expect(result.hasAsk).toBe(true); // "15-minute call" detected
        });

        it('detects clear call-to-action', async () => {
            const draftsWithAsk = [
                'Would you be available for a 15-min call next week?',
                "Let's chat about this opportunity over coffee.",
                'Can we schedule a brief conversation to discuss this?',
                'Are you open to a 30-minute meeting?',
            ];

            for (const draft of draftsWithAsk) {
                const result = await scoreDraft({
                    draft,
                    contactName: 'Jane',
                    companyName: 'TechCorp',
                });

                expect(result.hasAsk).toBe(true);
            }
        });

        it('scores length appropriately', async () => {
            // Too short (under 40 words)
            const shortDraft = 'Hi, interested in the role. Let me know.';
            const shortResult = await scoreDraft({
                draft: shortDraft,
                contactName: 'Jane',
                companyName: 'TechCorp',
            });
            expect(shortResult.length).toBeLessThan(100);
            expect(shortResult.feedback.some(f => f.includes('too short'))).toBe(true);

            // Optimal length (80-150 words)
            const optimalDraft = `Hi Jane, I came across TechCorp's recent product launch and was particularly impressed by the innovative approach to solving distributed systems challenges. With 5 years of experience in backend engineering and cloud infrastructure, I believe I could contribute meaningfully to your team's goals. I noticed you're hiring for a Senior Engineer role, and I'd love to learn more about the team's current priorities and technical roadmap. Would you be available for a brief 15-minute call next week to discuss how my background aligns with what you're building? Looking forward to connecting.`.slice(
                0,
                600
            );
            const optimalResult = await scoreDraft({
                draft: optimalDraft,
                contactName: 'Jane',
                companyName: 'TechCorp',
            });
            expect(optimalResult.length).toBe(100);

            // Too long (over 200 words)
            const longDraft =
                'Hi Jane, ' +
                'I wanted to reach out because '.repeat(50) +
                'I think we should connect to discuss this opportunity.';
            const longResult = await scoreDraft({
                draft: longDraft,
                contactName: 'Jane',
                companyName: 'TechCorp',
            });
            expect(longResult.length).toBeLessThan(100);
            expect(longResult.feedback.some(f => f.includes('too long'))).toBe(true);
        });

        it('provides actionable feedback', async () => {
            const request: ScoringRequest = {
                draft:
                    "I'm excited to connect with you about your innovative work at your leading company. I'm passionate about technology and would love to learn more.",
                contactName: 'Jane',
                companyName: 'TechCorp',
            };

            const result = await scoreDraft(request);

            expect(result.feedback.length).toBeGreaterThan(0);
            // Should suggest adding specific reference since it's all generic
            const hasSpecificityFeedback = result.feedback.some(
                f => f.includes('specific') || f.includes('Add a specific reference')
            );
            expect(hasSpecificityFeedback).toBe(true);
        });

        it('calculates overall score correctly', async () => {
            const request: ScoringRequest = {
                draft:
                    'I noticed your recent blog post about TechCorp launching a new ML pipeline with 40% improvement. With my 5 years in distributed systems, I believe I could contribute to your Engineering team. I saw you are hiring for a Senior Engineer role and would love to discuss how my background aligns. Are you available for a brief 15-min call next week to explore this further?',
                contactName: 'Jane',
                companyName: 'TechCorp',
            };

            const result = await scoreDraft(request);

            // High specificity (specific mentions), good length, has ask
            expect(result.overall).toBeGreaterThan(70);
            expect(result.specificity * 0.5 + result.length * 0.3 + (result.hasAsk ? 20 : 0)).toBeCloseTo(
                result.overall,
                0
            );
        });

        it('handles edge case: empty draft', async () => {
            const result = await scoreDraft({
                draft: '',
                contactName: 'Jane',
                companyName: 'TechCorp',
            });

            expect(result.overall).toBeLessThan(50);
            expect(result.length).toBeLessThan(50);
            expect(result.passesThreshold).toBe(false);
        });
    });
});
