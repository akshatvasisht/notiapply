import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateDraftMessage,
    generateBatchMessages,
    buildProviderHeaders,
    buildProviderRequest,
    extractMessage,
} from './llm';
import type { Contact, UserConfig, LLMProvider } from './types';

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

import { getUserConfig } from './db';

describe('LLM Integration', () => {
    const mockConfig: UserConfig = {
        llm_endpoint: 'https://api.test.com/v1/chat',
        llm_api_key: 'test-api-key',
        llm_provider: 'openai',
        llm_model: 'gpt-4',
        crm_message_tone: 'professional',
    };

    const mockContact: Contact = {
        id: 1,
        name: 'Jane Doe',
        company_name: 'TechCorp',
        role: 'Engineering Manager',
        email: 'jane@techcorp.com',
        state: 'identified',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        company_industry: 'Software',
        linkedin_posts_summary: 'Recently posted about AI and ML trends',
        created_at: new Date().toISOString(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getUserConfig).mockResolvedValue(mockConfig);
    });

    describe('buildProviderHeaders', () => {
        it('builds OpenAI headers correctly', () => {
            const headers = buildProviderHeaders('openai', 'sk-test-key');

            expect(headers).toEqual({
                'Content-Type': 'application/json',
                Authorization: 'Bearer sk-test-key',
            });
        });

        it('builds Gemini headers correctly', () => {
            const headers = buildProviderHeaders('gemini', 'gemini-key');

            expect(headers).toEqual({
                'Content-Type': 'application/json',
                Authorization: 'Bearer gemini-key',
            });
        });

        it('builds Anthropic headers correctly', () => {
            const headers = buildProviderHeaders('anthropic', 'anthropic-key');

            expect(headers).toEqual({
                'Content-Type': 'application/json',
                'x-api-key': 'anthropic-key',
                'anthropic-version': '2023-06-01',
            });
        });
    });

    describe('buildProviderRequest', () => {
        const llmRequest = {
            systemPrompt: 'You are a helpful assistant',
            userPrompt: 'Write a message',
            maxTokens: 300,
            temperature: 0.7,
        };

        it('builds OpenAI-compatible request', () => {
            const request = buildProviderRequest('openai', llmRequest, mockConfig);

            expect(request).toEqual({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Write a message' },
                ],
                max_tokens: 300,
                temperature: 0.7,
            });
        });

        it('builds Gemini request (OpenAI-compatible)', () => {
            const geminiConfig = { ...mockConfig, llm_provider: 'gemini', llm_model: 'gemini-1.5-flash' };
            const request = buildProviderRequest('gemini', llmRequest, geminiConfig);

            expect(request).toEqual({
                model: 'gemini-1.5-flash',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Write a message' },
                ],
                max_tokens: 300,
                temperature: 0.7,
            });
        });

        it('builds Anthropic request', () => {
            const request = buildProviderRequest('anthropic', llmRequest, mockConfig);

            expect(request).toEqual({
                model: 'gpt-4',
                system: 'You are a helpful assistant',
                messages: [{ role: 'user', content: 'Write a message' }],
                max_tokens: 300,
                temperature: 0.7,
            });
        });

        it('throws error for unsupported provider', () => {
            expect(() => {
                buildProviderRequest('invalid' as LLMProvider, llmRequest, mockConfig);
            }).toThrow('Unsupported LLM provider: invalid');
        });
    });

    describe('extractMessage', () => {
        it('extracts message from OpenAI response', () => {
            const response = {
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'Hello from OpenAI',
                        },
                    },
                ],
            };

            const message = extractMessage(response, 'openai');
            expect(message).toBe('Hello from OpenAI');
        });

        it('extracts message from Gemini native response', () => {
            const response = {
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: 'Hello from Gemini',
                                },
                            ],
                        },
                    },
                ],
            };

            const message = extractMessage(response, 'gemini');
            expect(message).toBe('Hello from Gemini');
        });

        it('extracts message from Anthropic response', () => {
            const response = {
                content: [
                    {
                        type: 'text',
                        text: 'Hello from Claude',
                    },
                ],
            };

            const message = extractMessage(response, 'anthropic');
            expect(message).toBe('Hello from Claude');
        });

        it('throws error for invalid response format', () => {
            expect(() => {
                extractMessage({ invalid: 'data' }, 'openai');
            }).toThrow('Unexpected openai response format');
        });

        it('throws error for non-object response', () => {
            expect(() => {
                extractMessage('not an object', 'openai');
            }).toThrow('Invalid openai response: not an object');
        });
    });

    describe('generateDraftMessage', () => {
        beforeEach(() => {
            global.fetch = vi.fn();
        });

        it('generates draft message successfully', async () => {
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content:
                                "Hi Jane, I noticed your recent posts about AI trends at TechCorp. I'm reaching out about the Engineering Manager role and would love to discuss how my experience aligns. Are you available for a brief 15-min call next week?",
                        },
                    },
                ],
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const message = await generateDraftMessage({
                contact: mockContact,
                jobTitle: 'Senior Software Engineer',
                companyName: 'TechCorp',
            });

            expect(message).toContain('Jane');
            expect(message).toContain('TechCorp');
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.test.com/v1/chat',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-api-key',
                    }),
                })
            );
        });

        it('throws error when LLM endpoint not configured', async () => {
            vi.mocked(getUserConfig).mockResolvedValue({
                ...mockConfig,
                llm_endpoint: undefined,
                llm_api_key: undefined,
            });

            await expect(
                generateDraftMessage({
                    contact: mockContact,
                })
            ).rejects.toThrow('LLM endpoint not configured');
        });

        it('throws error when API request fails', async () => {
            vi.mocked(global.fetch).mockResolvedValue({
                ok: false,
                statusText: 'Unauthorized',
            } as Response);

            await expect(
                generateDraftMessage({
                    contact: mockContact,
                })
            ).rejects.toThrow('Failed to generate message');
        });

        it('uses default tone when not specified', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Test message' } }],
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            await generateDraftMessage({
                contact: mockContact,
            });

            const callBody = JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string);
            expect(callBody.messages[1].content).toContain('professional');
        });
    });

    describe('generateBatchMessages', () => {
        beforeEach(() => {
            global.fetch = vi.fn();
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('generates messages for multiple contacts with rate limiting', async () => {
            const contacts = [
                { ...mockContact, id: 1, name: 'Alice' },
                { ...mockContact, id: 2, name: 'Bob' },
            ];

            const mockResponse = {
                choices: [{ message: { content: 'Test message' } }],
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const progressCallback = vi.fn();
            const promise = generateBatchMessages(contacts, progressCallback);

            // Fast-forward through delays
            await vi.runAllTimersAsync();
            const results = await promise;

            expect(results.size).toBe(2);
            expect(results.get(1)).toBe('Test message');
            expect(results.get(2)).toBe('Test message');
            expect(progressCallback).toHaveBeenCalledWith(1, 2);
            expect(progressCallback).toHaveBeenCalledWith(2, 2);
        });

        it('continues on individual failures', async () => {
            const contacts = [
                { ...mockContact, id: 1, name: 'Alice' },
                { ...mockContact, id: 2, name: 'Bob' },
            ];

            vi.mocked(global.fetch)
                .mockResolvedValueOnce({
                    ok: false,
                    statusText: 'Error',
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Success' } }] }),
                } as Response);

            const promise = generateBatchMessages(contacts);
            await vi.runAllTimersAsync();
            const results = await promise;

            expect(results.size).toBe(1);
            expect(results.get(2)).toBe('Success');
            expect(results.has(1)).toBe(false);
        });
    });
});
