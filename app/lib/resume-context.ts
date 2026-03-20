/**
 * Dynamic Resume Context Extraction
 *
 * Intelligently extracts relevant skills/experience from user's master resume
 * based on job description keywords. No hardcoded summaries.
 */

import { getUserConfig } from './db';
import type { Job } from './types';

/**
 * Extract relevant resume context tailored to a specific job.
 *
 * Strategy:
 * 1. Parse job description for key technologies/skills
 * 2. Search resume LaTeX for matching experiences
 * 3. Return 1-2 most relevant highlights (20-30 words max)
 *
 * @param job - Job posting to tailor to (optional, uses general summary if not provided)
 * @returns Concise resume context for outreach message value prop
 */
export async function extractResumeContext(job?: Job): Promise<string | undefined> {
    try {
        const config = await getUserConfig();

        if (!config.master_resume_id) {
            return undefined; // No resume configured
        }

        // Fetch master resume LaTeX source
        const { db } = await import('./db');
        const result = await db.query(
            'SELECT latex_source FROM master_resume WHERE id = $1',
            [config.master_resume_id]
        );

        if (!result.rows.length) {
            return undefined;
        }

        const resumeLatex: string = result.rows[0].latex_source;

        // If no job provided, extract general highlights
        if (!job) {
            return extractGeneralHighlights(resumeLatex);
        }

        // Extract job-specific context
        return extractJobTailoredContext(resumeLatex, job);
    } catch (error) {
        console.error('Resume context extraction failed:', error);
        return undefined; // Gracefully degrade - outreach still works without it
    }
}

/**
 * Extract general career highlights from resume (fallback when no job context)
 */
function extractGeneralHighlights(resumeLatex: string): string {
    // Strategy: Extract from summary/objective or most recent experience

    // Limit input to prevent ReDoS on malicious LaTeX (resumes typically < 10KB)
    const safeLatex = resumeLatex.substring(0, 10000);

    // Try to find summary/objective section
    const summaryMatch = safeLatex.match(/\\section\{(?:Summary|Objective|Profile)\}(.*?)\\section/is);
    if (summaryMatch) {
        const summary = cleanLatexText(summaryMatch[1]);
        // Return first 2-3 key points
        const sentences = summary.split(/[.!]\s+/).filter(s => s.trim().length > 20);
        if (sentences.length > 0) {
            return sentences.slice(0, 2).join('. ').substring(0, 100) + '.';
        }
    }

    // Fallback: Extract from most recent experience
    const experienceMatch = safeLatex.match(/\\section\{(?:Experience|Work Experience)\}(.*?)\\section/is);
    if (experienceMatch) {
        const experience = cleanLatexText(experienceMatch[1]);
        // Extract company and key achievement
        const lines = experience.split('\n').filter(l => l.trim().length > 20);
        if (lines.length >= 2) {
            return `${lines[0]}. ${lines[1]}`.substring(0, 100);
        }
    }

    return 'Experienced professional with proven track record';
}

/**
 * Extract resume highlights tailored to specific job posting
 */
function extractJobTailoredContext(resumeLatex: string, job: Job): string {
    // Parse job description for key technologies/skills
    const jobKeywords = extractJobKeywords(job.description_raw || job.title);

    // Search resume for matching experiences
    const resumeText = cleanLatexText(resumeLatex);
    const matchingExperiences = findMatchingExperiences(resumeText, jobKeywords);

    if (matchingExperiences.length > 0) {
        // Return top 1-2 most relevant experiences (max 30 words)
        return matchingExperiences.slice(0, 2).join('. ').substring(0, 120) + '.';
    }

    // Fallback to general highlights if no specific match
    return extractGeneralHighlights(resumeLatex);
}

/**
 * Extract key technical skills/technologies from job description
 */
function extractJobKeywords(jobText: string): Set<string> {
    const keywords = new Set<string>();
    const text = jobText.toLowerCase();

    // Common technology patterns
    const techPatterns = [
        // Languages
        /\b(python|javascript|typescript|java|c\+\+|golang|rust|ruby|php|swift|kotlin)\b/gi,
        // Frameworks
        /\b(react|angular|vue|django|flask|spring|rails|express|nextjs|node\.?js)\b/gi,
        // Databases
        /\b(postgres|postgresql|mysql|mongodb|redis|dynamodb|sql|nosql)\b/gi,
        // Cloud/Infra
        /\b(aws|azure|gcp|kubernetes|docker|terraform|jenkins|ci\/cd)\b/gi,
        // Methodologies
        /\b(agile|scrum|tdd|microservices|rest|graphql|api)\b/gi,
        // Data/ML
        /\b(machine learning|ml|ai|data science|pytorch|tensorflow|pandas|spark)\b/gi,
    ];

    for (const pattern of techPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            keywords.add(match[1].toLowerCase());
        }
    }

    // Extract experience level if mentioned
    const yearMatch = text.match(/(\d+)\+?\s*years?/i);
    if (yearMatch) {
        keywords.add(`${yearMatch[1]} years`);
    }

    return keywords;
}

/**
 * Find resume experiences that match job keywords
 */
function findMatchingExperiences(resumeText: string, jobKeywords: Set<string>): string[] {
    const experiences: Array<{ text: string; score: number }> = [];

    // Split resume into bullet points/achievements
    const bullets = resumeText
        .split(/\n|•|·|-\s+/)
        .map(b => b.trim())
        .filter(b => b.length > 30 && b.length < 200); // Reasonable bullet point length

    for (const bullet of bullets) {
        let score = 0;
        const bulletLower = bullet.toLowerCase();

        // Score each bullet based on keyword matches
        for (const keyword of jobKeywords) {
            if (bulletLower.includes(keyword.toLowerCase())) {
                score += 1;
            }
        }

        if (score > 0) {
            experiences.push({ text: bullet, score });
        }
    }

    // Sort by score (most relevant first) and return top matches
    experiences.sort((a, b) => b.score - a.score);
    return experiences.map(e => e.text);
}

/**
 * Clean LaTeX markup to plain text
 */
function cleanLatexText(latex: string): string {
    return latex
        // Remove LaTeX commands
        .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')  // \textbf{text} → text
        .replace(/\\[a-zA-Z]+/g, '')               // \section → ''
        // Remove special characters
        .replace(/[{}\\]/g, '')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        .trim();
}
