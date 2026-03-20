import { describe, it, expect } from 'vitest';
import {
    ContactSchema,
    JobSchema,
    ApplicationSchema,
    UserConfigSchema,
    validateContact,
    validateJob,
    safeParseContact,
    safeParseJob,
    validateContacts,
    JobStateSchema,
    ContactStateSchema,
    LLMProviderSchema,
} from './validation';

describe('Zod Validation Schemas', () => {
    describe('ContactSchema', () => {
        it('validates correct contact data', () => {
            const validContact = {
                id: 1,
                name: 'Jane Doe',
                role: 'Engineering Manager',
                company_name: 'TechCorp',
                linkedin_url: 'https://linkedin.com/in/janedoe',
                email: 'jane@techcorp.com',
                drafted_message: 'Hi Jane...',
                notes: 'Met at conference',
                state: 'drafted',
                job_id: 1,
                scraped_company_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                follow_up_date: null,
                intro_source: null,
                last_contacted_at: null,
                interaction_log: [],
                got_response: null,
                company_funding_stage: null,
                company_headcount_range: null,
                company_industry: null,
                company_notes: null,
                linkedin_posts_summary: null,
            };

            const result = ContactSchema.parse(validContact);
            expect(result.id).toBe(1);
            expect(result.name).toBe('Jane Doe');
        });

        it('rejects invalid email format', () => {
            const invalidContact = {
                id: 1,
                name: 'Jane',
                role: null,
                company_name: 'TechCorp',
                linkedin_url: null,
                email: 'not-an-email',
                drafted_message: null,
                notes: null,
                state: 'identified',
                job_id: null,
                scraped_company_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                follow_up_date: null,
                intro_source: null,
                last_contacted_at: null,
                interaction_log: [],
                got_response: null,
                company_funding_stage: null,
                company_headcount_range: null,
                company_industry: null,
                company_notes: null,
                linkedin_posts_summary: null,
            };

            expect(() => ContactSchema.parse(invalidContact)).toThrow();
        });

        it('rejects invalid contact state', () => {
            const invalidContact = {
                id: 1,
                name: 'Jane',
                company_name: 'TechCorp',
                state: 'invalid-state',
            };

            expect(() => ContactSchema.parse(invalidContact)).toThrow();
        });

        it('requires name and company_name', () => {
            const missingName = {
                id: 1,
                company_name: 'TechCorp',
                state: 'identified',
            };

            expect(() => ContactSchema.parse(missingName)).toThrow();
        });
    });

    describe('JobSchema', () => {
        it('validates correct job data', () => {
            const validJob = {
                id: 1,
                source: 'manual',
                title: 'Software Engineer',
                company: 'TechCorp',
                location: 'Remote',
                url: 'https://example.com/job',
                description_raw: 'Job description here',
                salary_min: 120000,
                salary_max: 150000,
                equity_min: null,
                equity_max: null,
                company_role_location_hash: 'abc123',
                discovered_at: new Date().toISOString(),
                docs_fail_reason: null,
                state: 'submitted',
                company_logo_url: null,
                updated_at: new Date().toISOString(),
                got_callback: null,
                callback_notes: null,
            };

            const result = JobSchema.parse(validJob);
            expect(result.title).toBe('Software Engineer');
            expect(result.salary_min).toBe(120000);
        });

        it('rejects invalid URL', () => {
            const invalidJob = {
                id: 1,
                source: 'manual',
                title: 'Engineer',
                company: 'TechCorp',
                location: 'Remote',
                url: 'not-a-url',
                description_raw: 'Description',
                salary_min: null,
                salary_max: null,
                equity_min: null,
                equity_max: null,
                company_role_location_hash: 'abc',
                discovered_at: new Date().toISOString(),
                docs_fail_reason: null,
                state: 'discovered',
                company_logo_url: null,
                updated_at: new Date().toISOString(),
                got_callback: null,
                callback_notes: null,
            };

            expect(() => JobSchema.parse(invalidJob)).toThrow();
        });

        it('validates salary constraints', () => {
            const validSalary = {
                id: 1,
                source: 'manual',
                title: 'Engineer',
                company: 'TechCorp',
                location: 'Remote',
                url: 'https://example.com',
                description_raw: 'Description',
                salary_min: 100000,
                salary_max: 200000,
                equity_min: 0.5,
                equity_max: 1.0,
                company_role_location_hash: 'abc',
                discovered_at: new Date().toISOString(),
                docs_fail_reason: null,
                state: 'discovered',
                company_logo_url: null,
                updated_at: new Date().toISOString(),
                got_callback: null,
                callback_notes: null,
            };

            const result = JobSchema.parse(validSalary);
            expect(result.salary_min).toBe(100000);
            expect(result.equity_min).toBe(0.5);
        });

        it('rejects negative salary', () => {
            const invalidSalary = {
                id: 1,
                source: 'manual',
                title: 'Engineer',
                company: 'TechCorp',
                location: 'Remote',
                url: 'https://example.com',
                description_raw: 'Description',
                salary_min: -50000,
                salary_max: null,
                equity_min: null,
                equity_max: null,
                company_role_location_hash: 'abc',
                discovered_at: new Date().toISOString(),
                docs_fail_reason: null,
                state: 'discovered',
                company_logo_url: null,
                updated_at: new Date().toISOString(),
                got_callback: null,
                callback_notes: null,
            };

            expect(() => JobSchema.parse(invalidSalary)).toThrow();
        });
    });

    describe('Enum Schemas', () => {
        it('validates JobState enum', () => {
            expect(JobStateSchema.parse('discovered')).toBe('discovered');
            expect(JobStateSchema.parse('submitted')).toBe('submitted');
            expect(() => JobStateSchema.parse('invalid')).toThrow();
        });

        it('validates ContactState enum', () => {
            expect(ContactStateSchema.parse('identified')).toBe('identified');
            expect(ContactStateSchema.parse('contacted')).toBe('contacted');
            expect(() => ContactStateSchema.parse('invalid')).toThrow();
        });

        it('validates LLMProvider enum', () => {
            expect(LLMProviderSchema.parse('openai')).toBe('openai');
            expect(LLMProviderSchema.parse('anthropic')).toBe('anthropic');
            expect(LLMProviderSchema.parse('gemini')).toBe('gemini');
            expect(() => LLMProviderSchema.parse('invalid')).toThrow();
        });
    });

    describe('UserConfigSchema', () => {
        it('validates complete config', () => {
            const validConfig = {
                llm_endpoint: 'https://api.openai.com/v1/chat',
                llm_api_key: 'sk-test-key',
                llm_provider: 'openai',
                llm_model: 'gpt-4',
                crm_message_tone: 'professional',
            };

            const result = UserConfigSchema.parse(validConfig);
            expect(result.llm_provider).toBe('openai');
        });

        it('validates partial config', () => {
            const partialConfig = {
                llm_endpoint: 'https://api.openai.com/v1/chat',
            };

            const result = UserConfigSchema.parse(partialConfig);
            expect(result.llm_endpoint).toBe('https://api.openai.com/v1/chat');
        });

        it('rejects invalid URL in endpoint', () => {
            const invalidConfig = {
                llm_endpoint: 'not-a-url',
            };

            expect(() => UserConfigSchema.parse(invalidConfig)).toThrow();
        });
    });

    describe('Helper Functions', () => {
        it('validateContact throws on invalid data', () => {
            const invalidData = { id: 'not-a-number' };

            expect(() => validateContact(invalidData)).toThrow();
        });

        it('validateJob throws on invalid data', () => {
            const invalidData = { id: 1, title: '' };

            expect(() => validateJob(invalidData)).toThrow();
        });

        it('safeParseContact returns success for valid data', () => {
            const validContact = {
                id: 1,
                name: 'John',
                role: null,
                company_name: 'Corp',
                linkedin_url: null,
                email: null,
                drafted_message: null,
                notes: null,
                state: 'identified',
                job_id: null,
                scraped_company_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                follow_up_date: null,
                intro_source: null,
                last_contacted_at: null,
                interaction_log: [],
                got_response: null,
                company_funding_stage: null,
                company_headcount_range: null,
                company_industry: null,
                company_notes: null,
                linkedin_posts_summary: null,
            };

            const result = safeParseContact(validContact);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('John');
            }
        });

        it('safeParseContact returns error for invalid data', () => {
            const invalidContact = { id: 'bad' };

            const result = safeParseContact(invalidContact);
            expect(result.success).toBe(false);
        });

        it('validateContacts validates array of contacts', () => {
            const contacts = [
                {
                    id: 1,
                    name: 'Alice',
                    role: null,
                    company_name: 'Corp A',
                    linkedin_url: null,
                    email: null,
                    drafted_message: null,
                    notes: null,
                    state: 'identified',
                    job_id: null,
                    scraped_company_id: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    follow_up_date: null,
                    intro_source: null,
                    last_contacted_at: null,
                    interaction_log: [],
                    got_response: null,
                    company_funding_stage: null,
                    company_headcount_range: null,
                    company_industry: null,
                    company_notes: null,
                    linkedin_posts_summary: null,
                },
                {
                    id: 2,
                    name: 'Bob',
                    role: null,
                    company_name: 'Corp B',
                    linkedin_url: null,
                    email: null,
                    drafted_message: null,
                    notes: null,
                    state: 'contacted',
                    job_id: null,
                    scraped_company_id: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    follow_up_date: null,
                    intro_source: null,
                    last_contacted_at: null,
                    interaction_log: [],
                    got_response: null,
                    company_funding_stage: null,
                    company_headcount_range: null,
                    company_industry: null,
                    company_notes: null,
                    linkedin_posts_summary: null,
                },
            ];

            const result = validateContacts(contacts);
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Alice');
            expect(result[1].name).toBe('Bob');
        });
    });
});
