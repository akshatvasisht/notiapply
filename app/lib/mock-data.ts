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

import type { Job, PipelineModule, UserConfig, ScrapedCompany, Contact } from './types';

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

    // Ready (queued)
    {
        id: 2,
        source: 'ats-greenhouse',
        title: 'Backend Engineer',
        company: 'Stripe',
        location: 'Remote',
        url: 'https://stripe.com/jobs',
        description_raw: `## About Stripe

Stripe is a financial infrastructure platform for the web. Millions of companies—from the world's largest enterprises to the most ambitious startups—use Stripe to accept payments, grow their revenue, and accelerate new business opportunities.

### The Role

We're looking for a **Backend Engineer** to help us build the future of global commerce. You'll work on distributed systems that handle billions of dollars in transactions while maintaining five-nines of availability.

### What you'll do

- Design, build, and maintain the complex financial infrastructure that powers Stripe
- Scale our systems to handle ever-increasing transaction volumes
- Build APIs that developers love and rely on
- Collaborate across engineering teams to ship high-impact features
- Participate in an on-call rotation to ensure the reliability of our mission-critical services

### Who you are

- You have a strong background in distributed systems and API design
- You have 4+ years of professional software engineering experience
- You are comfortable working in a fast-paced environment and dealing with ambiguity
- You have a track record of shipping high-quality, reliable software
- You are proficient in languages like Java, Ruby, or Go

### Benefits

- Comprehensive medical, dental, and vision coverage
- Mental health support and resources
- Generous parental leave
- Retirement savings plan with company match
- Charitable contribution matching`,
        salary_min: 160000,
        salary_max: 220000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'stripe-backend-remote',
        discovered_at: new Date(Date.now() - 5 * 60 * 60000).toISOString(), // 5h ago
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
    },

    // Attention (review-incomplete)
    {
        id: 3,
        source: 'ats-ashby',
        title: 'Frontend Engineer',
        company: 'Retool',
        location: 'San Francisco, CA',
        url: 'https://retool.com/careers',
        description_raw: `## About Retool

Retool is the fast way to build internal tools. Visually design apps that interface with any database or API. Switch to code nearly anywhere to customize how your apps look and work. With Retool, you can ship more tools and move your business forward—all without starting from scratch.

### The Opportunity

As a **Frontend Engineer** at Retool, you'll be responsible for building the visual editor and the core components that our customers use to build their applications. This is a high-leverage role where your work will directly impact the productivity of thousands of developers.

### What You'll Do

- Architect and build complex, state-heavy React components for the Retool editor
- Optimize frontend performance for massive JSON schemas and real-time data binding
- Work closely with designers to implement intuitive and powerful UI patterns
- Help scale our component library and design system

### Requirements

- 5+ years of experience building complex frontend applications
- Expert-level knowledge of React and TypeScript
- Deep understanding of browser performance and profiling tools
- Experience with state management libraries (Redux, MobX, etc.)
- Strong product intuition and attention to detail

### Why Retool?

- Work on a product that you, as a developer, would use every day
- Join a fast-growing company at a pivotal stage
- Collaborative and transparent culture
- Health, dental, and vision insurance
- 401(k) and equity packages`,
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

    // Submitted (review-ready)
    {
        id: 4,
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
- Deploy models to production at massive scale

### Qualifications

- MS or PhD in Computer Science, Machine Learning, or related field (or equivalent experience)
- 3+ years of experience training large-scale neural networks
- Strong fundamentals in deep learning, optimization, and statistics
- Proficiency in Python and ML frameworks (PyTorch, JAX, TensorFlow)
- Track record of significant ML projects

### Benefits

- Highly competitive compensation ($200k-$300k base + equity)
- Comprehensive health, dental, and vision coverage
- Unlimited PTO + quarterly company-wide reset weeks
- Daily lunch and dinner in our SF office
- Relocation assistance if moving to San Francisco`,
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

    // Archive (rejected)
    {
        id: 5,
        source: 'ats-greenhouse',
        title: 'Product Engineer',
        company: 'Linear',
        location: 'San Francisco, CA',
        url: 'https://linear.app/careers',
        description_raw: `## About Linear

Linear is the new standard for modern software development. It's built for speed, performance, and attention to detail. We believe that software should be beautiful, fast, and easy to use. Our mission is to build the tool that helps teams build better products.

### The Role

As a **Product Engineer** at Linear, you'll be building the features that help teams manage their workflow with surgical precision. You'll work on everything from our real-time synchronization engine to our high-performance UI components.

### What You'll Build

- New features for the Linear product that help teams collaborate more effectively
- Performance optimizations that keep Linear "Linear fast"
- Integrations with other tools in the modern software stack
- Tooling and infrastructure that helps us move faster as a team

### Who You Are

- You have a deep love for craft and attention to detail
- You are a full-stack engineer who is comfortable working across the entire stack
- You have 5+ years of experience building high-quality software
- You are proficient in TypeScript, React, and GraphQL
- You have a strong product mindset and empathy for the user

### Benefits

- Top-tier compensation and equity
- Remote-friendly culture with offsites
- Health, dental, and vision insurance
- Flexible time off
- Whatever gear you need to do your best work`,
        salary_min: 160000,
        salary_max: 220000,
        equity_min: 0.1,
        equity_max: 0.5,
        company_role_location_hash: 'linear-product-sf',
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
    cloudflare_email_domain: 'example.com',
    application_email_catch_all: 'jobs+{hash}@example.com',
    ats_shared_password: '••••••••',
    search_terms: ['software engineer', 'backend engineer', 'full stack developer'],
    locations: ['Remote', 'San Francisco', 'New York'],
    github_repos: ['SimplifyJobs/New-Grad-Positions'],
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
        id: 3,
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
];

export const MOCK_CONTACTS: Contact[] = [
    // Identified (Prospects)
    {
        id: 1,
        name: 'Patrick Collison',
        role: 'CEO',
        company_name: 'Stripe',
        linkedin_url: 'https://linkedin.com/in/pcollison',
        email: 'patrick@stripe.com',
        drafted_message: null,
        notes: 'Targeting the financial infrastructure team. Patrick frequently writes about the "Stripe style" of engineering—precision and reliability are key hooks for this outreach.',
        state: 'identified',
        job_id: 2,
        scraped_company_id: 1,
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60000).toISOString(),
        company_funding_stage: 'Public',
        company_headcount_range: '5,001–10,000 employees',
        company_industry: 'Financial Services',
        linkedin_posts_summary: 'Recent posts focus on the intersection of engineering craft and global economic infrastructure. Deep dives into API reliability and "Stripe style" documentation.',
    },

    // Drafted (Drafting)
    {
        id: 2,
        name: 'Karri Saarinen',
        role: 'CEO & Co-founder',
        company_name: 'Linear',
        linkedin_url: 'https://linkedin.com/in/ksaarinen',
        email: 'karri@linear.app',
        drafted_message: `Hi Karri,

The attention to detail in Linear's UI is genuinely inspiring—it's rare to see that level of craft in modern software. I'm a product engineer applying to Linear, and I've spent considerable time studying how your team handles real-time synchronization and the "optimistic UI" patterns.

I'd love to share my experience building high-performance frontend systems and discuss how I could contribute to Linear's mission. Do you have 10 minutes for a brief chat this week?`,
        notes: 'Drafting a highly personalized note focused on their design philosophy and UI craft.',
        state: 'drafted',
        job_id: 5,
        scraped_company_id: null,
        created_at: new Date(Date.now() - 18 * 60 * 60000).toISOString(),
        company_funding_stage: 'Series B',
        company_headcount_range: '51–200 employees',
        company_industry: 'Software Development',
        linkedin_posts_summary: 'Writing extensively about the "Linear Method"—quality over speed, native-feeling performance, and why focus is the most important trait for engineering teams.',
    },

    // Contacted (Reached Out)
    {
        id: 3,
        name: 'Dario Amodei',
        role: 'CEO',
        company_name: 'Anthropic',
        linkedin_url: 'https://linkedin.com/in/dario-amodei',
        email: 'dario@anthropic.com',
        drafted_message: null,
        notes: 'Sent a note regarding their recent Constitutional AI research paper and how my background in distributed systems could help scale their training clusters.',
        state: 'contacted',
        job_id: null,
        scraped_company_id: null,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
        company_funding_stage: 'Series D',
        company_headcount_range: '501–1,000 employees',
        company_industry: 'Artificial Intelligence',
        linkedin_posts_summary: 'Shared thoughts on "Constitutional AI" and safety-first scaling laws. Discussing the technical challenges of RLHF at massive scale.',
    },

    // Replied (Engaged)
    {
        id: 4,
        name: 'Guillermo Rauch',
        role: 'CEO',
        company_name: 'Vercel',
        linkedin_url: 'https://linkedin.com/in/rauchg',
        email: 'guillermo@vercel.com',
        drafted_message: `Hi Guillermo,

Huge fan of the latest Next.js 15 updates—the performance gains in the dev server are impressive. As someone who has been building with the Vercel stack for years, I'm particularly excited about the direction you're taking with Partial Prerendering.

I've just applied for the SWE role on the DX team. I'd love to learn more about how Vercel plans to further bridge the gap between development and production.`,
        notes: 'Guillermo replied! He mentioned they are specifically looking for people with deep React Server Components knowledge. Setting up a technical interview with the DX team.',
        state: 'replied',
        job_id: 1,
        scraped_company_id: 2,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
        company_funding_stage: 'Series E',
        company_headcount_range: '1,001–5,000 employees',
        company_industry: 'Cloud Computing',
        linkedin_posts_summary: 'Promoting the benefits of Partial Prerendering and the importance of DX in frontend stacks. Frequently sharing performance metrics from major Next.js deployments.',
    },

    // Interviewing (Engaged)
    {
        id: 5,
        name: 'Sam Altman',
        role: 'CEO',
        company_name: 'OpenAI',
        linkedin_url: 'https://linkedin.com/in/samaltman',
        email: 'sam@openai.com',
        drafted_message: null,
        notes: 'Currently in the late-stage interview rounds for the Machine Learning Engineer position. Discussion has been focused on latency optimizations for inference at scale.',
        state: 'interviewing',
        job_id: 4,
        scraped_company_id: null,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString(),
        company_funding_stage: 'Late Stage',
        company_headcount_range: '1,001–5,000 employees',
        company_industry: 'Artificial Intelligence',
        linkedin_posts_summary: 'Focused on the societal impact of AGI and the roadmap for GPT-5. Recently posted about the importance of alignment in frontier models.',
    },

];
