import { describe, it, expect } from 'vitest';
import {
    ContactSchema,
    JobSchema,
    ApplicationSchema,
    UserConfigSchema,
    validateContact,
    validateJob,
    validateApplication,
    validateUserConfig,
    safeParseContact,
    safeParseJob,
    safeParseApplication,
    validateContacts,
    JobStateSchema,
    ContactStateSchema,
} from './validation';
import { makeContact, makeJob, makeApplication, makeUserConfig } from './test-fixtures';

describe('Zod Validation Schemas', () => {
    describe('ContactSchema', () => {
        it('validates correct contact data', () => {
            const validContact = makeContact({
                name: 'Jane Doe',
                role: 'Engineering Manager',
                company_name: 'TechCorp',
                linkedin_url: 'https://linkedin.com/in/janedoe',
                email: 'jane@techcorp.com',
                drafted_message: 'Hi Jane...',
                notes: 'Met at conference',
                state: 'drafted',
                job_id: 1,
            });

            const result = ContactSchema.parse(validContact);
            expect(result.id).toBe(1);
            expect(result.name).toBe('Jane Doe');
        });

        it('rejects invalid email format', () => {
            const invalidContact = makeContact({
                name: 'Jane',
                company_name: 'TechCorp',
                email: 'not-an-email',
                state: 'identified',
            });

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
            const validJob = makeJob({
                source: 'manual',
                title: 'Software Engineer',
                company: 'TechCorp',
                url: 'https://example.com/job',
                description_raw: 'Job description here',
                salary_min: 120000,
                salary_max: 150000,
                state: 'submitted',
            });

            const result = JobSchema.parse(validJob);
            expect(result.title).toBe('Software Engineer');
            expect(result.salary_min).toBe(120000);
        });

        it('rejects invalid URL', () => {
            const invalidJob = makeJob({
                source: 'manual',
                title: 'Engineer',
                url: 'not-a-url',
                state: 'discovered',
            });

            expect(() => JobSchema.parse(invalidJob)).toThrow();
        });

        it('validates salary constraints', () => {
            const validSalary = makeJob({
                source: 'manual',
                title: 'Engineer',
                url: 'https://example.com',
                salary_min: 100000,
                salary_max: 200000,
                equity_min: 0.5,
                equity_max: 1.0,
                state: 'discovered',
            });

            const result = JobSchema.parse(validSalary);
            expect(result.salary_min).toBe(100000);
            expect(result.equity_min).toBe(0.5);
        });

        it('rejects negative salary', () => {
            const invalidSalary = makeJob({
                source: 'manual',
                url: 'https://example.com',
                salary_min: -50000,
                state: 'discovered',
            });

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

    });

    describe('UserConfigSchema', () => {
        it('validates complete config', () => {
            const validConfig = {
                llm_endpoint: 'https://api.openai.com/v1/chat',
                llm_api_key: 'sk-test-key',
                llm_model: 'gpt-4',
                crm_message_tone: 'professional',
            };

            const result = UserConfigSchema.parse(validConfig);
            expect(result.llm_endpoint).toBe('https://api.openai.com/v1/chat');
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
            const validContact = makeContact({
                name: 'John',
                company_name: 'Corp',
                state: 'identified',
            });

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
                makeContact({ id: 1, name: 'Alice', company_name: 'Corp A', state: 'identified' }),
                makeContact({ id: 2, name: 'Bob', company_name: 'Corp B', state: 'contacted' }),
            ];

            const result = validateContacts(contacts);
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Alice');
            expect(result[1].name).toBe('Bob');
        });
    });
});

describe('Validation Helper Functions (runtime boundaries)', () => {
    it('validateApplication passes valid application data', () => {
        const validApp = makeApplication();
        const result = validateApplication(validApp);
        expect(result.id).toBe(1);
        expect(result.job_id).toBe(1);
        expect(result.master_resume_id).toBe(1);
        expect(result.draft_answers).toBeNull();
    });

    it('validateApplication throws on invalid application data', () => {
        // Missing required fields: id, job_id, master_resume_id
        const invalid = { id: 'not-a-number' };
        expect(() => validateApplication(invalid)).toThrow();
    });

    it('validateApplication passes with draft_answers array', () => {
        const appWithAnswers = makeApplication({
            draft_answers: [
                { question: 'Why do you want this role?', answer: 'I am passionate.' },
            ],
        });
        const result = validateApplication(appWithAnswers);
        expect(result.draft_answers).toHaveLength(1);
        expect(result.draft_answers![0].question).toBe('Why do you want this role?');
    });

    it('validateUserConfig passes valid config', () => {
        const config = makeUserConfig();
        const result = validateUserConfig(config);
        expect(result.llm_model).toBe('gpt-4');
    });

    it('validateUserConfig throws on invalid endpoint URL', () => {
        const badConfig = makeUserConfig({ llm_endpoint: 'not-a-url' });
        expect(() => validateUserConfig(badConfig)).toThrow();
    });

    it('safeParseJob returns success for valid job', () => {
        const job = makeJob();
        const result = safeParseJob(job);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.title).toBe('Software Engineer');
            expect(result.data.is_live).toBe(true);
        }
    });

    it('safeParseApplication returns error for invalid data', () => {
        const invalid = { id: 'bad', job_id: null };
        const result = safeParseApplication(invalid);
        expect(result.success).toBe(false);
    });
});
