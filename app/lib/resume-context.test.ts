import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractResumeContext } from './resume-context';
import type { Job } from './types';

// Mock dependencies
vi.mock('./db', () => ({
    getUserConfig: vi.fn(),
    db: {
        query: vi.fn(),
    },
}));

import { getUserConfig } from './db';

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

    const mockJob: Job = {
        id: 1,
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
        source: 'greenhouse',
        state: 'discovered',
        discovered_at: new Date().toISOString(),
        company_role_location_hash: 'hash123',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getUserConfig).mockResolvedValue({
            master_resume_id: 1,
        });
    });

    it('extracts job-tailored context when keywords match', async () => {
        const { db } = await import('./db');
        vi.mocked(db.query).mockResolvedValue({
            rows: [{ latex_source: mockResumeLatex }],
        });

        const context = await extractResumeContext(mockJob);

        expect(context).toBeDefined();
        expect(context).toContain('Python');
        expect(context?.toLowerCase()).toMatch(/microservices|api/);
    });

    it('extracts general highlights when no job provided', async () => {
        const { db } = await import('./db');
        vi.mocked(db.query).mockResolvedValue({
            rows: [{ latex_source: mockResumeLatex }],
        });

        const context = await extractResumeContext();

        expect(context).toBeDefined();
        expect(context).toContain('5 years');
    });

    it('returns undefined when no resume configured', async () => {
        vi.mocked(getUserConfig).mockResolvedValue({
            master_resume_id: undefined,
        });

        const context = await extractResumeContext(mockJob);

        expect(context).toBeUndefined();
    });

    it('returns undefined when resume fetch fails', async () => {
        const { db } = await import('./db');
        vi.mocked(db.query).mockResolvedValue({
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

        const { db } = await import('./db');
        vi.mocked(db.query).mockResolvedValue({
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
