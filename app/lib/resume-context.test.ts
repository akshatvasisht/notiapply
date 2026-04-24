import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractResumeContext } from './resume-context';
import { makeJob } from './test-fixtures';

// Mock dependencies
const mockQuery = vi.fn();
vi.mock('./db', () => ({
    getPool: vi.fn(() => ({ query: mockQuery })),
}));

describe('Resume Context Extraction', () => {
    const mockResumeLatex = `
\\section{Summary}
Senior Software Engineer with 5 years of experience building scalable APIs using Python and Django.

\\section{Experience}
\\textbf{Meta} - Senior Engineer
Built microservices handling 100M+ requests/day using Python, PostgreSQL, and Redis.
Implemented GraphQL API reducing client queries by 40\\%.

\\section{Education}
BS Computer Science
    `.trim();

    const mockJob = makeJob({
        title: 'Senior Backend Engineer',
        company: 'Stripe',
        description_raw: `
We're looking for a Senior Backend Engineer to build payment APIs.
Must have experience with:
- Python and Django
- PostgreSQL databases
- Redis caching
- High-scale systems (100M+ requests)
        `,
        location: 'San Francisco',
        url: 'https://stripe.com/jobs/123',
        source: 'ats-greenhouse',
        state: 'discovered',
        company_role_location_hash: 'hash123',
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('extracts job-tailored context when keywords match', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ latex_source: mockResumeLatex }],
        });

        const context = await extractResumeContext(mockJob);

        expect(context).toBeDefined();
        expect(context).toContain('Python');
        expect(context?.toLowerCase()).toMatch(/microservices|api/);
    });

    it('extracts general highlights when no job provided', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ latex_source: mockResumeLatex }],
        });

        const context = await extractResumeContext();

        expect(context).toBeDefined();
        expect(context).toContain('5 years');
    });

    it('returns undefined when no active resume exists', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const context = await extractResumeContext(mockJob);

        expect(context).toBeUndefined();
    });

    it('returns undefined when resume fetch fails', async () => {
        mockQuery.mockResolvedValue({
            rows: [],
        });

        const context = await extractResumeContext(mockJob);

        expect(context).toBeUndefined();
    });

    it('handles LaTeX cleanup correctly', async () => {
        const latexWithFormatting = `
\\section{Experience}
\\textbf{Company} - \\textit{Role}
Built systems using \\LaTeX{} and \\emph{Python}
        `.trim();

        mockQuery.mockResolvedValue({
            rows: [{ latex_source: latexWithFormatting }],
        });

        const context = await extractResumeContext();

        expect(context).toBeDefined();
        // Should not contain LaTeX commands
        expect(context).not.toContain('\\textbf');
        expect(context).not.toContain('\\textit');
        expect(context).not.toContain('\\LaTeX');
    });
});
