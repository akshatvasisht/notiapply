/**
 * Volume stress test: Generate 900 mock jobs to test UI performance
 *
 * Run with: npx tsx tests/stress/generate-volume.ts
 */

import type { Job, JobState, JobSource } from '@/lib/types';

const SOURCES: JobSource[] = [
    'jobspy-linkedin',
    'jobspy-indeed',
    'jobspy-glassdoor',
    'ats-greenhouse',
    'ats-lever',
    'github-simplify',
    'wellfound',
];

const STATES: JobState[] = [
    'discovered',
    'filtered',
    'queued',
    'submitted',
    'rejected',
];

const COMPANIES = [
    'Anthropic', 'OpenAI', 'Google', 'Meta', 'Apple', 'Amazon', 'Microsoft',
    'Netflix', 'Airbnb', 'Stripe', 'Coinbase', 'Databricks', 'Scale AI',
    'Ramp', 'Plaid', 'Figma', 'Notion', 'Linear', 'Vercel', 'Supabase',
];

const TITLES = [
    'Software Engineer',
    'Backend Engineer',
    'Frontend Engineer',
    'Full Stack Engineer',
    'Machine Learning Engineer',
    'Data Engineer',
    'DevOps Engineer',
    'Platform Engineer',
    'Security Engineer',
    'Mobile Engineer',
];

const LOCATIONS = [
    'San Francisco, CA',
    'New York, NY',
    'Seattle, WA',
    'Austin, TX',
    'Remote',
    'Boston, MA',
    'Los Angeles, CA',
    'Chicago, IL',
    'Denver, CO',
    'Portland, OR',
];

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateJob(id: number): Job {
    const company = randomChoice(COMPANIES);
    const title = randomChoice(TITLES);
    const source = randomChoice(SOURCES);
    const state = randomChoice(STATES);
    const location = randomChoice(LOCATIONS);

    // More jobs in submitted/rejected (realistic distribution)
    const biasedState: JobState = Math.random() < 0.6
        ? randomChoice(['submitted', 'rejected'])
        : state;

    const daysAgo = randomInt(1, 180);
    const discoveredAt = new Date();
    discoveredAt.setDate(discoveredAt.getDate() - daysAgo);

    return {
        id,
        source,
        title,
        company,
        location,
        url: `https://example.com/jobs/${id}`,
        description_raw: `## About ${company}\n\n${company} is hiring for a ${title} role.\n\n### Requirements\n- 3+ years experience\n- Strong programming skills\n- Team collaboration`,
        salary_min: randomInt(100, 180) * 1000,
        salary_max: randomInt(200, 300) * 1000,
        equity_min: source === 'wellfound' ? randomInt(1, 10) / 100 : null,
        equity_max: source === 'wellfound' ? randomInt(10, 50) / 100 : null,
        company_role_location_hash: `${company}-${title}-${location}`.toLowerCase().replace(/\s+/g, '-'),
        discovered_at: discoveredAt.toISOString(),
        docs_fail_reason: null,
        state: biasedState,
        company_logo_url: null,
    };
}

/**
 * Generate 900 jobs for stress testing
 */
export function generateStressTestJobs(count: number = 900): Job[] {
    const jobs: Job[] = [];

    for (let i = 1; i <= count; i++) {
        jobs.push(generateJob(i));
    }

    return jobs;
}

// CLI execution
if (require.main === module) {
    const jobs = generateStressTestJobs(900);

    // Group by state for reporting
    const stateCount = jobs.reduce((acc, job) => {
        acc[job.state] = (acc[job.state] || 0) + 1;
        return acc;
    }, {} as Record<JobState, number>);

    console.log('Generated 900 stress test jobs:');
    console.log(JSON.stringify(stateCount, null, 2));
    console.log('\nDistribution by state:');
    Object.entries(stateCount).forEach(([state, count]) => {
        const percentage = ((count / 900) * 100).toFixed(1);
        console.log(`  ${state}: ${count} (${percentage}%)`);
    });

    console.log(`\nTo test: Update lib/mock-data.ts MOCK_JOBS with this output`);
    console.log(`\nSample job:`);
    console.log(JSON.stringify(jobs[0], null, 2));
}
