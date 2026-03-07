/** Mock data for development/preview mode
 *
 * Use this when database is not available to preview UI with realistic data.
 *
 * Source Distribution Strategy:
 * - Blue (Aggregators): jobspy-* sources for broad coverage
 * - Green (ATS): ats-* sources for reliable company listings
 * - Yellow (Curated): github-simplify for vetted new grad positions
 * - Purple (Startups): wellfound for equity-heavy early stage roles
 *
 * Equity fields only populated for startup sources (wellfound) and select ATS postings.
 */

import type { Job, PipelineModule, UserConfig, ScrapedCompany } from './types';

export const MOCK_JOBS: Job[] = [
    // Incoming (discovered)
    {
        id: 1,
        source: 'jobspy-linkedin',
        title: 'Software Engineer',
        company: 'Vercel',
        location: 'Remote',
        url: 'https://vercel.com/careers',
        description_raw: `## About Vercel

Vercel is the platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration. We enable teams to iterate quickly and develop, preview, and ship delightful user experiences. Vercel has zero-configuration support for 35+ frontend frameworks and integrates with your headless content, commerce, or database of choice.

## About the Role

We're looking for a **Software Engineer** to join our Developer Experience team. You'll work on the tools and frameworks that millions of developers use every day, including Next.js, Turbopack, and the Vercel platform.

### What You'll Do

- Design and build features for Next.js and the Vercel platform that delight developers
- Collaborate with open-source community members and enterprise customers to understand their needs
- Write high-quality, well-tested code that scales to millions of developers
- Contribute to technical discussions and architectural decisions
- Help maintain and improve our build and deployment pipeline

### Requirements

- 3+ years of professional software engineering experience
- Strong proficiency in JavaScript/TypeScript and React
- Experience building and shipping production web applications
- Passion for developer tools and improving developer experience
- Excellent written and verbal communication skills
- Experience with Next.js or similar React frameworks is a plus

### Benefits

- Competitive salary and equity
- Remote-first culture with team offsites
- Health, dental, and vision insurance
- 401(k) with company match
- Unlimited PTO
- Home office stipend`,
        salary_min: 140000,
        salary_max: 180000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'vercel-swe-remote',
        discovered_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(), // 2h ago
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
    },
    {
        id: 2,
        source: 'ats-greenhouse',
        title: 'Backend Engineer',
        company: 'Linear',
        location: 'San Francisco, CA',
        url: 'https://linear.app/careers',
        description_raw: 'Help us build the best issue tracking software...',
        salary_min: 160000,
        salary_max: 220000,
        equity_min: 0.1,
        equity_max: 0.5,
        company_role_location_hash: 'linear-backend-sf',
        discovered_at: new Date(Date.now() - 5 * 60 * 60000).toISOString(), // 5h ago
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
    },
    {
        id: 3,
        source: 'github-simplify',
        title: 'Full Stack Engineer',
        company: 'Anthropic',
        location: 'San Francisco, CA',
        url: 'https://anthropic.com/careers',
        description_raw: 'Build AI safety systems and interfaces...',
        salary_min: 180000,
        salary_max: 250000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'anthropic-fullstack-sf',
        discovered_at: new Date(Date.now() - 8 * 60 * 60000).toISOString(), // 8h ago
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
    },

    // Ready (queued)
    {
        id: 4,
        source: 'jobspy-indeed',
        title: 'Backend Engineer',
        company: 'Stripe',
        location: 'Remote',
        url: 'https://stripe.com/jobs',
        description_raw: 'Build payment infrastructure for the internet...',
        salary_min: 150000,
        salary_max: 220000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'stripe-backend-remote',
        discovered_at: new Date(Date.now() - 1 * 24 * 60 * 60000).toISOString(), // 1d ago
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
    },
    {
        id: 5,
        source: 'ats-lever',
        title: 'Software Engineer',
        company: 'Figma',
        location: 'San Francisco, CA',
        url: 'https://figma.com/careers',
        description_raw: 'Help designers and developers collaborate...',
        salary_min: 170000,
        salary_max: 240000,
        equity_min: 0.1,
        equity_max: 0.3,
        company_role_location_hash: 'figma-swe-sf',
        discovered_at: new Date(Date.now() - 1 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
    },
    {
        id: 6,
        source: 'wellfound',
        title: 'Senior Backend Engineer',
        company: 'Notion',
        location: 'New York, NY',
        url: 'https://notion.so/careers',
        description_raw: `## About Notion

We're on a mission to make toolmaking ubiquitous. Notion is a workspace that adapts to your needs. It's as minimal or as powerful as you need it to be. Millions of people use Notion every day — from founders running their companies to students organizing their lives.

## The Role

As a **Senior Backend Engineer**, you'll be building the infrastructure and APIs that power Notion's collaborative workspace. You'll work on systems that need to handle millions of concurrent users while maintaining Notion's signature speed and reliability.

### What You'll Build

- Real-time collaboration infrastructure handling millions of concurrent edits
- Scalable APIs serving hundreds of millions of requests per day
- Data models and systems for our block-based editor
- Infrastructure for AI-powered features and integrations
- Performance optimizations across our entire stack

### What We're Looking For

- 5+ years of backend engineering experience at scale
- Deep expertise in distributed systems and databases
- Experience with real-time systems (WebSockets, operational transforms, CRDTs)
- Strong CS fundamentals and system design skills
- Product mindset and empathy for user experience
- Experience with Node.js, PostgreSQL, Redis is a plus

### Tech Stack

Node.js (TypeScript), PostgreSQL, Redis, AWS, Kubernetes, React

### Why Notion?

- Competitive salary + **significant equity (0.08% - 0.25%)**
- Health, dental, vision insurance (100% covered for employees)
- 5% 401k match
- Hybrid work with 3 days/week in our NYC office
- Generous PTO and company-wide shutdowns
- $3000/year learning & development budget
- Catered lunches and snacks in office

### Our Values

We hire based on these values: **care, craft, and championship**. We want people who care about users, take pride in their craft, and champion their teammates.`,
        salary_min: 140000,
        salary_max: 180000,
        equity_min: 0.08,
        equity_max: 0.25,
        company_role_location_hash: 'notion-backend-ny',
        discovered_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(), // 2d ago
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
    },
    {
        id: 7,
        source: 'jobspy-glassdoor',
        title: 'Full Stack Developer',
        company: 'Datadog',
        location: 'Remote',
        url: 'https://datadog.com/careers',
        description_raw: 'Build monitoring and analytics platform...',
        salary_min: 140000,
        salary_max: 190000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'datadog-fullstack-remote',
        discovered_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
    },

    // Attention (review-incomplete, docs-failed, fill-failed)
    {
        id: 8,
        source: 'ats-ashby',
        title: 'Frontend Engineer',
        company: 'Retool',
        location: 'San Francisco, CA',
        url: 'https://retool.com/careers',
        description_raw: 'Build internal tools platform...',
        salary_min: 150000,
        salary_max: 200000,
        equity_min: 0.1,
        equity_max: 0.3,
        company_role_location_hash: 'retool-frontend-sf',
        discovered_at: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(), // 3d ago
        docs_fail_reason: null,
        state: 'review-incomplete',
        company_logo_url: null,
    },
    {
        id: 9,
        source: 'jobspy-ziprecruiter',
        title: 'DevOps Engineer',
        company: 'HashiCorp',
        location: 'Remote',
        url: 'https://hashicorp.com/careers',
        description_raw: 'Manage infrastructure automation tools...',
        salary_min: null,
        salary_max: null,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'hashicorp-devops-remote',
        discovered_at: new Date(Date.now() - 4 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: 'Failed to parse PDF',
        state: 'docs-failed',
        company_logo_url: null,
    },
    {
        id: 10,
        source: 'ats-greenhouse',
        title: 'Platform Engineer',
        company: 'Cloudflare',
        location: 'Austin, TX',
        url: 'https://cloudflare.com/careers',
        description_raw: 'Build edge computing platform...',
        salary_min: 160000,
        salary_max: 220000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'cloudflare-platform-austin',
        discovered_at: new Date(Date.now() - 4 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: null,
        state: 'fill-failed',
        company_logo_url: null,
    },

    // Submitted (review-ready, submitted, tracking)
    {
        id: 11,
        source: 'jobspy-linkedin',
        title: 'Machine Learning Engineer',
        company: 'OpenAI',
        location: 'San Francisco, CA',
        url: 'https://openai.com/careers',
        description_raw: `## About OpenAI

OpenAI is an AI research and deployment company dedicated to ensuring that artificial general intelligence benefits all of humanity. We're the team behind **ChatGPT, GPT-4, DALL·E, and Codex**.

## The Opportunity

We're seeking **Machine Learning Engineers** to help build and scale the next generation of AI systems. You'll work on fundamental research problems while also ensuring our models are safe, reliable, and beneficial. This role offers the unique opportunity to work on cutting-edge AI research that is immediately deployed to hundreds of millions of users.

### Key Responsibilities

- Train and fine-tune large language models using distributed systems
- Design and implement novel architectures for improved model capabilities
- Develop evaluation frameworks to measure model performance and safety
- Optimize training infrastructure and reduce computational costs
- Collaborate with research scientists to implement new algorithms
- Deploy models to production at massive scale
- Contribute to AI alignment and safety research

### Qualifications

- MS or PhD in Computer Science, Machine Learning, or related field (or equivalent experience)
- 3+ years of experience training large-scale neural networks
- Strong fundamentals in deep learning, optimization, and statistics
- Proficiency in Python and ML frameworks (PyTorch, JAX, TensorFlow)
- Experience with distributed training and large-scale systems
- Track record of publications or significant ML projects
- Passion for AI safety and beneficial AI development

### Nice to Have

- Experience with transformer architectures and LLMs
- Background in reinforcement learning from human feedback (RLHF)
- Contributions to open-source ML projects
- Experience deploying ML models at scale

### What We Offer

- Highly competitive compensation **($200k-$300k base + equity)**
- Comprehensive health, dental, and vision coverage
- Unlimited PTO + quarterly company-wide reset weeks
- $5,000/year in professional development
- Daily lunch and dinner in our SF office
- Relocation assistance if moving to San Francisco
- Work on the most advanced AI systems in the world
- Collaborate with leading researchers and engineers

---

OpenAI is committed to diversity and inclusion. We're an equal opportunity employer and value diverse perspectives in building beneficial AGI.

**Note:** This role requires working in-person from our San Francisco office 4-5 days per week.`,
        salary_min: 200000,
        salary_max: 300000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'openai-ml-sf',
        discovered_at: new Date(Date.now() - 5 * 24 * 60 * 60000).toISOString(), // 5d ago
        docs_fail_reason: null,
        state: 'review-ready',
        company_logo_url: null,
    },
    {
        id: 12,
        source: 'ats-lever',
        title: 'Software Engineer',
        company: 'Ramp',
        location: 'New York, NY',
        url: 'https://ramp.com/careers',
        description_raw: 'Build corporate card and expense management...',
        salary_min: 170000,
        salary_max: 230000,
        equity_min: 0.1,
        equity_max: 0.4,
        company_role_location_hash: 'ramp-swe-ny',
        discovered_at: new Date(Date.now() - 6 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: null,
        state: 'submitted',
        company_logo_url: null,
    },
    {
        id: 13,
        source: 'github-simplify',
        title: 'New Grad Software Engineer',
        company: 'Cursor',
        location: 'Remote',
        url: 'https://cursor.com/careers',
        description_raw: 'Build AI-powered code editor. New grad position from SimplifyJobs community list...',
        salary_min: 120000,
        salary_max: 160000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'cursor-backend-remote',
        discovered_at: new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: null,
        state: 'tracking',
        company_logo_url: null,
    },

    // Archive (filtered-out, rejected)
    {
        id: 14,
        source: 'wellfound',
        title: 'Founding Engineer',
        company: 'Scale AI',
        location: 'San Francisco, CA',
        url: 'https://scale.com/careers',
        description_raw: 'Join as a founding engineer building data labeling platform for AI...',
        salary_min: 140000,
        salary_max: 180000,
        equity_min: 0.5,
        equity_max: 2.0,
        company_role_location_hash: 'scale-founding-sf',
        discovered_at: new Date(Date.now() - 8 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: null,
        state: 'filtered-out',
        company_logo_url: null,
    },
    {
        id: 15,
        source: 'jobspy-indeed',
        title: 'Principal Engineer',
        company: 'Databricks',
        location: 'Remote',
        url: 'https://databricks.com/careers',
        description_raw: 'Architect large-scale data systems...',
        salary_min: null,
        salary_max: null,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'databricks-principal-remote',
        discovered_at: new Date(Date.now() - 9 * 24 * 60 * 60000).toISOString(),
        docs_fail_reason: null,
        state: 'rejected',
        company_logo_url: null,
    },
];

export const MOCK_CONFIG: UserConfig = {
    llm_endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    llm_api_key: '••••••••••••••••',
    llm_model: 'gemini-1.5-flash',
    ntfy_topic: 'notiapply-demo',
    github_token: '••••••••••••••••',
    decodo_proxy: 'user:pass@gate.decodo.com:7000',
    cloudflare_email_domain: 'example.com',
    application_email_catch_all: 'jobs+{hash}@example.com',
    ats_shared_password: '••••••••',
    search_terms: ['software engineer', 'backend engineer', 'full stack developer'],
    locations: ['Remote', 'San Francisco', 'New York'],
    github_repos: ['SimplifyJobs/New-Grad-Positions', 'pittcsc/Summer2025-Internships'],
    filter: {
        seniority: ['entry', 'mid'],
        new_grad_only: false,
        exclude_keywords: ['senior', 'staff', 'principal', 'lead', 'manager'],
        require_keywords: [],
    },
    n8n_webhook_url: 'https://n8n.example.com/webhook/pipeline',
    n8n_webhook_secret: '••••••••',
    setup_complete: true,
    last_scrape_at: new Date(Date.now() - 3 * 60 * 60000).toISOString(), // 3h ago
};

export const MOCK_MODULES: PipelineModule[] = [
    {
        id: 1,
        key: 'scrape-linkedin',
        name: 'LinkedIn (JobSpy)',
        description: 'Scrape job postings from LinkedIn via JobSpy',
        phase: 'scraping',
        execution_order: 10,
        enabled: true,
        is_builtin: true,
        n8n_workflow_id: 'scrape_linkedin',
        config_schema: null,
        module_config: {},
        dependencies: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 2,
        key: 'scrape-indeed',
        name: 'Indeed (JobSpy)',
        description: 'Scrape job postings from Indeed via JobSpy',
        phase: 'scraping',
        execution_order: 20,
        enabled: true,
        is_builtin: true,
        n8n_workflow_id: 'scrape_indeed',
        config_schema: null,
        module_config: {},
        dependencies: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 3,
        key: 'scrape-ats',
        name: 'ATS Direct',
        description: 'Scrape company career pages directly (Greenhouse, Lever, Ashby)',
        phase: 'scraping',
        execution_order: 30,
        enabled: true,
        is_builtin: true,
        n8n_workflow_id: 'scrape_ats',
        config_schema: null,
        module_config: {},
        dependencies: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 4,
        key: 'scrape-github',
        name: 'GitHub Repos',
        description: 'Pull job postings from curated GitHub repos',
        phase: 'scraping',
        execution_order: 40,
        enabled: false,
        is_builtin: true,
        n8n_workflow_id: 'scrape_github',
        config_schema: null,
        module_config: {},
        dependencies: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 5,
        key: 'filter-jobs',
        name: 'Job Filter',
        description: 'Filter jobs by keywords, seniority, location, etc.',
        phase: 'processing',
        execution_order: 10,
        enabled: true,
        is_builtin: true,
        n8n_workflow_id: 'filter_jobs',
        config_schema: null,
        module_config: {},
        dependencies: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 6,
        key: 'generate-docs',
        name: 'Generate Resume/Cover',
        description: 'AI-generate tailored resume and cover letter LaTeX',
        phase: 'processing',
        execution_order: 20,
        enabled: true,
        is_builtin: true,
        n8n_workflow_id: 'generate_docs',
        config_schema: null,
        module_config: {},
        dependencies: ['filter-jobs'],
        created_at: new Date().toISOString(),
    },
    {
        id: 7,
        key: 'compile-pdfs',
        name: 'Compile PDFs',
        description: 'Compile LaTeX to PDF using Tectonic',
        phase: 'processing',
        execution_order: 30,
        enabled: true,
        is_builtin: true,
        n8n_workflow_id: 'compile_pdfs',
        config_schema: null,
        module_config: {},
        dependencies: ['generate-docs'],
        created_at: new Date().toISOString(),
    },
    {
        id: 8,
        key: 'notify',
        name: 'Push Notification',
        description: 'Send ntfy.sh notification when pipeline completes',
        phase: 'output',
        execution_order: 10,
        enabled: true,
        is_builtin: true,
        n8n_workflow_id: 'notify',
        config_schema: null,
        module_config: {},
        dependencies: [],
        created_at: new Date().toISOString(),
    },
];

export const MOCK_COMPANIES: ScrapedCompany[] = [
    {
        id: 1,
        name: 'Stripe',
        ats_platform: 'greenhouse',
        ats_slug: 'stripe',
        active: true,
        added_at: new Date(Date.now() - 10 * 24 * 60 * 60000).toISOString(),
    },
    {
        id: 2,
        name: 'Vercel',
        ats_platform: 'lever',
        ats_slug: 'vercel',
        active: true,
        added_at: new Date(Date.now() - 15 * 24 * 60 * 60000).toISOString(),
    },
    {
        id: 3,
        name: 'Linear',
        ats_platform: 'ashby',
        ats_slug: 'linear',
        active: true,
        added_at: new Date(Date.now() - 20 * 24 * 60 * 60000).toISOString(),
    },
];
