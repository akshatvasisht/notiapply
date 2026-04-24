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
 *
 * Coverage targets:
 * - Every JobState appears at least once (13 states → all board columns populated)
 * - Every ContactState appears at least once (6 states → all CRM columns populated)
 * - All conditional badges exercised: relevance_score, is_live=false, age>30d, urgency tiers
 * - Source diversity: all 10 JobSource variants represented
 * - Channel tags: mix of LinkedIn-only, email-only, and both
 */

import type { Job, PipelineModule, UserConfig, ScrapedCompany, Contact } from './types';

// ── Helper: relative date from now ──────────────────────────────────────
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60000).toISOString();

// ════════════════════════════════════════════════════════════════════════
// MOCK JOBS  (15 total — 3–4 per board column, every state represented)
// ════════════════════════════════════════════════════════════════════════

export const MOCK_JOBS: Job[] = [
    // ── Incoming (discovered) ×4 ─────────────────────────────────────
    {
        id: 1,
        source: 'jobspy-linkedin',
        title: 'Software Engineer',
        company: 'Vercel',
        location: 'Remote',
        url: 'https://vercel.com/careers',
        description_raw: `## About Vercel

Vercel is the platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration. We enable teams to iterate quickly and develop, preview, and ship delightful user experiences.

## About the Role

We're looking for a **Software Engineer** to join our Developer Experience team. You'll work on the tools and frameworks that millions of developers use every day, including Next.js, Turbopack, and the Vercel platform.

### What You'll Do

- Design and build features for Next.js and the Vercel platform
- Collaborate with open-source community members and enterprise customers
- Write high-quality, well-tested code that scales to millions of developers

### Requirements

- 3+ years of professional software engineering experience
- Strong proficiency in JavaScript/TypeScript and React
- Experience building and shipping production web applications
- Passion for developer tools and improving developer experience`,
        salary_min: 140000,
        salary_max: 180000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'vercel-swe-remote',
        discovered_at: hoursAgo(2),
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
        updated_at: hoursAgo(2),
        got_callback: null,
        callback_notes: null,
        relevance_score: 82,
        score_breakdown: {
            reasons: ['Strong TypeScript/React match', 'Remote role aligns with preferences'],
            red_flags: [],
            match_highlights: ['Next.js experience', 'Developer tools focus'],
        },
        is_live: true,
        liveness_checked_at: hoursAgo(1),
    },
    {
        id: 6,
        source: 'wellfound',
        title: 'Founding Engineer',
        company: 'Momento',
        location: 'San Francisco, CA',
        url: 'https://wellfound.com/l/momento-founding-eng',
        description_raw: `## Momento — Founding Engineer

We're building the next generation of serverless caching infrastructure. As a founding engineer, you'll have outsized impact on architecture decisions and product direction.

### Responsibilities
- Design and implement distributed cache systems
- Build developer SDKs in TypeScript, Python, Go
- Own the reliability and performance of core infrastructure

### What We're Looking For
- 2+ years building distributed systems
- Experience with Redis, Memcached, or similar
- Comfort with ambiguity and startup pace

### Compensation
- $130k–$170k base + 0.5–1.2% equity
- Full benefits, unlimited PTO`,
        salary_min: 130000,
        salary_max: 170000,
        equity_min: 0.5,
        equity_max: 1.2,
        company_role_location_hash: 'momento-founding-sf',
        discovered_at: hoursAgo(6),
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
        updated_at: hoursAgo(6),
        got_callback: null,
        callback_notes: null,
        relevance_score: 88,
        score_breakdown: {
            reasons: ['Founding role with high equity', 'Distributed systems match'],
            red_flags: ['Early stage — funding risk'],
            match_highlights: ['TypeScript SDK work', 'Infrastructure focus'],
        },
        is_live: true,
        liveness_checked_at: hoursAgo(3),
    },
    {
        id: 7,
        source: 'github-simplify',
        title: 'Design Engineer',
        company: 'Figma',
        location: 'New York, NY',
        url: 'https://figma.com/careers',
        description_raw: `## Design Engineer at Figma

Bridge the gap between design and engineering. Work on Figma's core editor and plugin platform, turning ambitious design concepts into performant, accessible UI.

### You Will
- Implement complex interactive components in the Figma editor
- Collaborate closely with designers on prototyping and iteration
- Optimize Canvas rendering performance

### You Have
- 3+ years experience in frontend engineering
- Strong CSS and animation skills
- Experience with WebGL, Canvas API, or similar`,
        salary_min: null,
        salary_max: null,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'figma-design-eng-nyc',
        discovered_at: hoursAgo(12),
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
        updated_at: hoursAgo(12),
        got_callback: null,
        callback_notes: null,
        relevance_score: 65,
        score_breakdown: {
            reasons: ['Frontend focus matches', 'Design-heavy role may not align'],
            red_flags: ['WebGL/Canvas requirement — gap in experience'],
            match_highlights: ['React/TypeScript overlap', 'Plugin platform work'],
        },
        is_live: true,
        liveness_checked_at: hoursAgo(8),
    },
    {
        id: 8,
        source: 'jobspy-indeed',
        title: 'Platform Engineer',
        company: 'Notion',
        location: 'San Francisco, CA',
        url: 'https://notion.so/careers',
        description_raw: `## Platform Engineer — Notion

Join the team building Notion's internal developer platform. Improve build systems, CI/CD pipelines, and developer tooling for a fast-growing engineering org.

### What You'll Do
- Design and maintain CI/CD infrastructure (GitHub Actions, Buildkite)
- Build internal developer tools and dashboards
- Improve build times and developer feedback loops

### Requirements
- 4+ years of platform/infra engineering experience
- Proficiency in TypeScript or Go
- Experience with containerization (Docker, Kubernetes)`,
        salary_min: 155000,
        salary_max: 210000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'notion-platform-sf',
        discovered_at: daysAgo(45),
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
        updated_at: daysAgo(44),
        got_callback: null,
        callback_notes: null,
        relevance_score: null,
        score_breakdown: null,
        is_live: false,
        liveness_checked_at: daysAgo(2),
    },

    // ── Ready (queued) ×3 ────────────────────────────────────────────
    {
        id: 2,
        source: 'ats-greenhouse',
        title: 'Backend Engineer',
        company: 'Stripe',
        location: 'Remote',
        url: 'https://stripe.com/jobs',
        description_raw: `## About Stripe

Stripe is a financial infrastructure platform for the web. Millions of companies use Stripe to accept payments, grow their revenue, and accelerate new business opportunities.

### The Role

We're looking for a **Backend Engineer** to help us build the future of global commerce. You'll work on distributed systems that handle billions of dollars in transactions.

### What you'll do
- Design and maintain complex financial infrastructure
- Scale systems to handle ever-increasing transaction volumes
- Build APIs that developers love and rely on

### Who you are
- Strong background in distributed systems and API design
- 4+ years of professional software engineering experience
- Proficient in Java, Ruby, or Go`,
        salary_min: 160000,
        salary_max: 220000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'stripe-backend-remote',
        discovered_at: hoursAgo(5),
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
        updated_at: hoursAgo(3),
        got_callback: null,
        callback_notes: null,
        relevance_score: 76,
        score_breakdown: {
            reasons: ['API design experience aligns', 'Strong company reputation'],
            red_flags: ['Java/Ruby primary — TypeScript not listed'],
            match_highlights: ['Distributed systems', 'Remote role'],
        },
        is_live: true,
        liveness_checked_at: hoursAgo(2),
    },
    {
        id: 9,
        source: 'ats-lever',
        title: 'Full Stack Engineer',
        company: 'Airbnb',
        location: 'Remote',
        url: 'https://careers.airbnb.com',
        description_raw: `## Full Stack Engineer — Airbnb

Work on the core booking platform used by millions of guests and hosts worldwide. Build features across the React frontend and Java/Kotlin backend.

### Responsibilities
- Ship user-facing features end-to-end
- Collaborate with product, design, and data science
- Improve platform reliability and performance

### Requirements
- 3+ years full-stack experience
- React + TypeScript proficiency
- Experience with microservices architecture`,
        salary_min: 150000,
        salary_max: 200000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'airbnb-fullstack-remote',
        discovered_at: daysAgo(1),
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
        updated_at: hoursAgo(8),
        got_callback: null,
        callback_notes: null,
        relevance_score: 72,
        score_breakdown: {
            reasons: ['Full-stack matches skill set', 'React + TypeScript listed'],
            red_flags: ['Java/Kotlin backend — not primary stack'],
            match_highlights: ['React frontend', 'Remote position'],
        },
        is_live: true,
        liveness_checked_at: hoursAgo(6),
    },
    {
        id: 10,
        source: 'manual',
        title: 'Systems Engineer',
        company: 'Cloudflare',
        location: 'Austin, TX',
        url: 'https://cloudflare.com/careers',
        description_raw: `## Systems Engineer — Cloudflare

Help build and scale Cloudflare's global network. Work on low-level systems that handle millions of requests per second across 300+ data centers.

### What You'll Do
- Develop and optimize network proxy software in Rust and Go
- Debug complex distributed systems issues at global scale
- Contribute to open-source projects (e.g., Pingora, quiche)

### Requirements
- Strong systems programming skills (Rust, Go, or C++)
- Understanding of TCP/IP, HTTP, DNS, TLS
- Experience with performance profiling and optimization`,
        salary_min: 145000,
        salary_max: 195000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'cloudflare-systems-austin',
        discovered_at: daysAgo(2),
        docs_fail_reason: null,
        state: 'queued',
        company_logo_url: null,
        updated_at: daysAgo(1),
        got_callback: null,
        callback_notes: null,
        relevance_score: 58,
        score_breakdown: {
            reasons: ['Systems engineering aligns with interest'],
            red_flags: ['Rust/Go/C++ primary — not TypeScript', 'Austin location — relocation needed'],
            match_highlights: ['Open source contribution culture'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(1),
    },

    // ── Attention (review-incomplete, docs-failed, fill-failed) ×3 ───
    {
        id: 3,
        source: 'ats-ashby',
        title: 'Frontend Engineer',
        company: 'Retool',
        location: 'San Francisco, CA',
        url: 'https://retool.com/careers',
        description_raw: `## Frontend Engineer at Retool

Build the visual editor and core components that customers use to create internal tools. High-leverage role where your work impacts thousands of developers.

### What You'll Do
- Architect complex, state-heavy React components for the editor
- Optimize frontend performance for massive JSON schemas
- Work closely with designers on intuitive UI patterns

### Requirements
- 5+ years building complex frontend applications
- Expert-level React and TypeScript
- Deep understanding of browser performance profiling`,
        salary_min: 150000,
        salary_max: 200000,
        equity_min: 0.1,
        equity_max: 0.3,
        company_role_location_hash: 'retool-frontend-sf',
        discovered_at: daysAgo(3),
        docs_fail_reason: null,
        state: 'review-incomplete',
        company_logo_url: null,
        updated_at: daysAgo(2),
        got_callback: null,
        callback_notes: null,
        relevance_score: 79,
        score_breakdown: {
            reasons: ['React/TypeScript expert match', 'Product engineering focus'],
            red_flags: ['5+ years required — borderline'],
            match_highlights: ['Editor UI work', 'Performance optimization'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(1),
    },
    {
        id: 11,
        source: 'jobspy-glassdoor',
        title: 'Infrastructure Engineer',
        company: 'Coinbase',
        location: 'Remote',
        url: 'https://coinbase.com/careers',
        description_raw: `## Infrastructure Engineer — Coinbase

Build and maintain the cloud infrastructure powering the world's most trusted cryptocurrency platform. Focus on reliability, security, and scale.

### Responsibilities
- Manage Kubernetes clusters across multiple cloud providers
- Build infrastructure-as-code with Terraform
- Design disaster recovery and incident response systems

### Requirements
- 4+ years infrastructure/DevOps experience
- Strong Kubernetes and cloud (AWS/GCP) experience
- Experience with Terraform, Ansible, or Pulumi`,
        salary_min: 140000,
        salary_max: 190000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'coinbase-infra-remote',
        discovered_at: daysAgo(4),
        docs_fail_reason: 'LaTeX compilation failed: missing \\usepackage{enumitem} in preamble',
        state: 'docs-failed',
        company_logo_url: null,
        updated_at: daysAgo(3),
        got_callback: null,
        callback_notes: null,
        relevance_score: 61,
        score_breakdown: {
            reasons: ['Remote role', 'Cloud infrastructure interest'],
            red_flags: ['Heavy Kubernetes focus — limited experience', 'Crypto industry risk'],
            match_highlights: ['Infrastructure-as-code', 'Multi-cloud exposure'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(2),
    },
    {
        id: 12,
        source: 'ats-greenhouse',
        title: 'Backend Engineer',
        company: 'Ramp',
        location: 'New York, NY',
        url: 'https://ramp.com/careers',
        description_raw: `## Backend Engineer — Ramp

Join the fastest-growing fintech in America. Build the APIs and services that power corporate card management, expense tracking, and bill payments.

### What You'll Do
- Design and build RESTful and GraphQL APIs
- Improve system reliability and observability
- Collaborate with product and data teams

### Requirements
- 3+ years backend engineering experience
- Python or Go proficiency
- Experience with PostgreSQL and distributed systems`,
        salary_min: 155000,
        salary_max: 215000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'ramp-backend-nyc',
        discovered_at: daysAgo(5),
        docs_fail_reason: null,
        state: 'fill-failed',
        company_logo_url: null,
        updated_at: daysAgo(4),
        got_callback: null,
        callback_notes: null,
        relevance_score: 74,
        score_breakdown: {
            reasons: ['API design focus', 'Fintech growth trajectory'],
            red_flags: ['Python/Go primary stack', 'NYC — may require relocation'],
            match_highlights: ['PostgreSQL experience', 'GraphQL overlap'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(3),
    },

    // ── Submitted (review-ready, submitted, tracking) ×3 ────────────
    {
        id: 4,
        source: 'jobspy-linkedin',
        title: 'Machine Learning Engineer',
        company: 'OpenAI',
        location: 'San Francisco, CA',
        url: 'https://openai.com/careers',
        description_raw: `## Machine Learning Engineer — OpenAI

We're seeking ML Engineers to help build and scale the next generation of AI systems. Work on fundamental research problems while ensuring models are safe and reliable.

### Key Responsibilities
- Train and fine-tune large language models using distributed systems
- Design novel architectures for improved model capabilities
- Develop evaluation frameworks for model performance and safety

### Qualifications
- MS or PhD in CS, ML, or related field
- 3+ years training large-scale neural networks
- Strong fundamentals in deep learning and optimization
- Proficiency in Python and ML frameworks (PyTorch, JAX)`,
        salary_min: 200000,
        salary_max: 300000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'openai-ml-sf',
        discovered_at: daysAgo(5),
        docs_fail_reason: null,
        state: 'review-ready',
        company_logo_url: null,
        updated_at: daysAgo(3),
        got_callback: null,
        callback_notes: null,
        relevance_score: 91,
        score_breakdown: {
            reasons: ['ML engineering aligns with interest', 'Top-tier compensation'],
            red_flags: ['PhD preferred — may be underqualified'],
            match_highlights: ['Distributed systems overlap', 'Python proficiency'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(1),
    },
    {
        id: 13,
        source: 'jobspy-ziprecruiter',
        title: 'Frontend Engineer',
        company: 'Figma',
        location: 'San Francisco, CA',
        url: 'https://figma.com/careers',
        description_raw: `## Frontend Engineer — Figma

Work on FigJam and Figma's collaboration features. Build real-time multiplayer experiences for millions of designers and engineers.

### What You'll Do
- Build interactive UI components with React and TypeScript
- Implement real-time collaboration features (CRDTs, WebSockets)
- Optimize rendering performance for complex documents

### Requirements
- 3+ years frontend engineering
- React + TypeScript expertise
- Experience with real-time/collaborative systems a plus`,
        salary_min: 160000,
        salary_max: 230000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'figma-frontend-sf',
        discovered_at: daysAgo(8),
        docs_fail_reason: null,
        state: 'submitted',
        company_logo_url: null,
        updated_at: daysAgo(6),
        got_callback: true,
        callback_notes: 'Recruiter reached out for technical phone screen — scheduled for next Tuesday',
        relevance_score: 85,
        score_breakdown: {
            reasons: ['React/TypeScript core match', 'Collaboration features — interesting domain'],
            red_flags: [],
            match_highlights: ['Frontend specialization', 'Real-time systems'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(4),
    },
    {
        id: 14,
        source: 'ats-lever',
        title: 'Backend Engineer',
        company: 'Discord',
        location: 'San Francisco, CA',
        url: 'https://discord.com/careers',
        description_raw: `## Backend Engineer — Discord

Build the real-time communication platform used by 200M+ monthly active users. Work on chat infrastructure, voice/video, and platform APIs.

### Responsibilities
- Design and build scalable backend services (Elixir, Rust, Python)
- Improve system reliability for real-time messaging
- Build APIs used by millions of bot developers

### Requirements
- 3+ years backend experience
- Experience with real-time systems or messaging infrastructure
- Proficiency in at least one of: Elixir, Rust, Python, Go`,
        salary_min: 170000,
        salary_max: 240000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'discord-backend-sf',
        discovered_at: daysAgo(12),
        docs_fail_reason: null,
        state: 'tracking',
        company_logo_url: null,
        updated_at: daysAgo(7),
        got_callback: true,
        callback_notes: 'Passed phone screen. On-site scheduled — 4 rounds (system design, coding, behavioral, team fit)',
        relevance_score: 78,
        score_breakdown: {
            reasons: ['Real-time systems interest', 'Strong engineering culture'],
            red_flags: ['Elixir/Rust primary — learning curve'],
            match_highlights: ['API platform work', 'Scale challenges'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(5),
    },

    // ── Archive (filtered-out, rejected) ×3 ──────────────────────────
    {
        id: 5,
        source: 'ats-greenhouse',
        title: 'Product Engineer',
        company: 'Linear',
        location: 'San Francisco, CA',
        url: 'https://linear.app/careers',
        description_raw: `## Product Engineer at Linear

Build features that help teams manage their workflow with surgical precision. Work on everything from real-time sync to high-performance UI components.

### What You'll Build
- New features for the Linear product
- Performance optimizations that keep Linear fast
- Integrations with other tools in the modern software stack

### Who You Are
- Deep love for craft and attention to detail
- Full-stack engineer comfortable across the entire stack
- 5+ years building high-quality software
- Proficient in TypeScript, React, and GraphQL`,
        salary_min: 160000,
        salary_max: 220000,
        equity_min: 0.1,
        equity_max: 0.5,
        company_role_location_hash: 'linear-product-sf',
        discovered_at: daysAgo(9),
        docs_fail_reason: null,
        state: 'rejected',
        company_logo_url: null,
        updated_at: daysAgo(6),
        got_callback: false,
        callback_notes: null,
        relevance_score: 83,
        score_breakdown: {
            reasons: ['TypeScript/React match', 'Product-minded engineering'],
            red_flags: ['5+ years required'],
            match_highlights: ['Real-time sync', 'Performance focus'],
        },
        is_live: true,
        liveness_checked_at: daysAgo(5),
    },
    {
        id: 15,
        source: 'jobspy-linkedin',
        title: 'Software Engineer II',
        company: 'Meta',
        location: 'Menlo Park, CA',
        url: 'https://metacareers.com',
        description_raw: `## Software Engineer II — Meta

Work on Instagram's feed ranking and recommendation systems. Build ML-powered features that reach billions of users.

### Requirements
- 2+ years software engineering experience
- Experience with large-scale distributed systems
- Proficiency in Python, C++, or Java
- Strong problem-solving and communication skills`,
        salary_min: 165000,
        salary_max: 225000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'meta-swe2-menlo',
        discovered_at: daysAgo(40),
        docs_fail_reason: null,
        state: 'filtered-out',
        company_logo_url: null,
        updated_at: daysAgo(39),
        got_callback: null,
        callback_notes: null,
        relevance_score: 45,
        score_breakdown: {
            reasons: ['Large company experience'],
            red_flags: ['C++/Java primary', 'Menlo Park — not preferred location', 'ML ranking — not core interest'],
            match_highlights: [],
        },
        is_live: true,
        liveness_checked_at: daysAgo(10),
    },
    {
        id: 16,
        source: 'jobspy-glassdoor',
        title: 'SDE II',
        company: 'Amazon',
        location: 'Seattle, WA',
        url: 'https://amazon.jobs',
        description_raw: `## SDE II — Amazon Web Services

Build core AWS services used by millions of developers. Work on distributed systems at unprecedented scale.

### Requirements
- 3+ years professional development experience
- Proficiency in Java, C++, or Python
- Experience with distributed systems
- Strong computer science fundamentals`,
        salary_min: 150000,
        salary_max: 200000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'amazon-sde2-seattle',
        discovered_at: daysAgo(15),
        docs_fail_reason: null,
        state: 'rejected',
        company_logo_url: null,
        updated_at: daysAgo(10),
        got_callback: false,
        callback_notes: null,
        relevance_score: 52,
        score_breakdown: {
            reasons: ['AWS distributed systems — interesting technically'],
            red_flags: ['Java/C++ stack', 'Amazon culture fit concerns', 'Seattle relocation'],
            match_highlights: [],
        },
        is_live: false,
        liveness_checked_at: daysAgo(5),
    },
];

// ════════════════════════════════════════════════════════════════════════
// MOCK CONTACTS  (12 total — 2–3 per board column, every state + badge)
// ════════════════════════════════════════════════════════════════════════

export const MOCK_CONTACTS: Contact[] = [
    // ── Prospects (identified) ×3 ────────────────────────────────────
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
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: null,
        intro_source: null,
        last_contacted_at: null,
        interaction_log: [],
        got_response: null,
        company_funding_stage: 'Public',
        company_headcount_range: '5,001–10,000 employees',
        company_industry: 'Financial Services',
        company_notes: null,
        linkedin_posts_summary: 'Recent posts focus on the intersection of engineering craft and global economic infrastructure. Deep dives into API reliability and "Stripe style" documentation.',
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
    {
        id: 6,
        name: 'Satya Nadella',
        role: 'Chairman & CEO',
        company_name: 'Microsoft',
        linkedin_url: null,
        email: 'satya@microsoft.com',
        drafted_message: null,
        notes: 'Exploring Azure AI platform roles. Found via job description contact info.',
        state: 'identified',
        job_id: null,
        scraped_company_id: null,
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
        department: 'Executive',
        source: 'job_description_email',
        follow_up_date: null,
        intro_source: null,
        last_contacted_at: null,
        interaction_log: [],
        got_response: null,
        company_funding_stage: 'Public',
        company_headcount_range: '10,000+ employees',
        company_industry: 'Technology',
        company_notes: 'Massive AI investment — Azure OpenAI Service, Copilot ecosystem',
        linkedin_posts_summary: null,
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
    {
        id: 7,
        name: 'Lisa Su',
        role: 'CEO',
        company_name: 'AMD',
        linkedin_url: null,
        email: null,
        drafted_message: null,
        notes: 'No direct contact info yet. Need to find engineering team leads instead.',
        state: 'identified',
        job_id: null,
        scraped_company_id: null,
        created_at: hoursAgo(8),
        updated_at: hoursAgo(8),
        department: null,
        source: 'yc_scraper',
        follow_up_date: null,
        intro_source: null,
        last_contacted_at: null,
        interaction_log: [],
        got_response: null,
        company_funding_stage: 'Public',
        company_headcount_range: '10,000+ employees',
        company_industry: 'Semiconductors',
        company_notes: null,
        linkedin_posts_summary: null,
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },

    // ── Drafting (drafted) ×2 ────────────────────────────────────────
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
        created_at: hoursAgo(18),
        updated_at: hoursAgo(4),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: null,
        intro_source: 'cold LinkedIn',
        last_contacted_at: null,
        interaction_log: [],
        got_response: null,
        company_funding_stage: 'Series B',
        company_headcount_range: '51–200 employees',
        company_industry: 'Software Development',
        company_notes: null,
        linkedin_posts_summary: 'Writing extensively about the "Linear Method"—quality over speed, native-feeling performance, and why focus is the most important trait for engineering teams.',
        drafted_subject: 'Re: Product Engineer Role — Craft & Performance',
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
    {
        id: 8,
        name: 'Dylan Field',
        role: 'CEO & Co-founder',
        company_name: 'Figma',
        linkedin_url: 'https://linkedin.com/in/dylanfield',
        email: 'dylan@figma.com',
        drafted_message: `Hi Dylan,

I've been following Figma's journey since the early days of browser-based design tools. The way your team solved multiplayer collaboration in the browser is something I reference constantly when thinking about real-time architecture.

I'm applying for the Design Engineer role and would love to discuss how my frontend performance work could contribute to Figma's editor experience. Would you have 15 minutes sometime this week?`,
        notes: 'Emphasizing technical depth in browser-based collaboration. Figma has strong engineering culture.',
        state: 'drafted',
        job_id: 7,
        scraped_company_id: null,
        created_at: daysAgo(1),
        updated_at: hoursAgo(6),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: null,
        intro_source: 'cold LinkedIn',
        last_contacted_at: null,
        interaction_log: [],
        got_response: null,
        company_funding_stage: 'Series E',
        company_headcount_range: '1,001–5,000 employees',
        company_industry: 'Design Software',
        company_notes: 'Post-Adobe acquisition fallout — independent and hiring aggressively',
        linkedin_posts_summary: 'Posts about the future of design tools, browser-native collaboration, and building products that feel "native" despite being web-based.',
        drafted_subject: 'Design Engineer — Browser-Native Performance',
        send_at: new Date(Date.now() + 2 * 24 * 60 * 60000).toISOString(),
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },

    // ── Reached Out (contacted) ×3 ───────────────────────────────────
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
        created_at: daysAgo(3),
        updated_at: daysAgo(2),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: daysAgo(1),
        intro_source: 'cold LinkedIn',
        last_contacted_at: daysAgo(3),
        interaction_log: [
            { timestamp: daysAgo(3), event: 'LinkedIn message sent', notes: 'Constitutional AI hook + distributed systems angle' },
        ],
        got_response: null,
        company_funding_stage: 'Series D',
        company_headcount_range: '501–1,000 employees',
        company_industry: 'Artificial Intelligence',
        company_notes: null,
        linkedin_posts_summary: 'Shared thoughts on "Constitutional AI" and safety-first scaling laws. Discussing the technical challenges of RLHF at massive scale.',
        drafted_subject: null,
        send_at: null,
        sent_at: daysAgo(3),
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
    {
        id: 9,
        name: 'Tobi Lutke',
        role: 'CEO',
        company_name: 'Shopify',
        linkedin_url: 'https://linkedin.com/in/tobias-lutke',
        email: null,
        drafted_message: null,
        notes: 'Messaged about their Remix/React adoption and developer tools team. Tobi is very active on Twitter — might respond there instead.',
        state: 'contacted',
        job_id: null,
        scraped_company_id: null,
        created_at: daysAgo(5),
        updated_at: daysAgo(4),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: new Date(Date.now() + 2 * 24 * 60 * 60000).toISOString(),
        intro_source: 'cold LinkedIn',
        last_contacted_at: daysAgo(5),
        interaction_log: [
            { timestamp: daysAgo(5), event: 'LinkedIn connection request sent', notes: 'Personalized note about Remix migration' },
        ],
        got_response: null,
        company_funding_stage: 'Public',
        company_headcount_range: '10,000+ employees',
        company_industry: 'E-commerce',
        company_notes: 'Massive Remix/React investment for Hydrogen storefront framework',
        linkedin_posts_summary: 'Discusses entrepreneurship, the future of commerce, and Shopify\'s bet on AI-powered merchant tools.',
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
    {
        id: 10,
        name: 'Brian Chesky',
        role: 'CEO & Co-founder',
        company_name: 'Airbnb',
        linkedin_url: null,
        email: 'brian@airbnb.com',
        drafted_message: null,
        notes: 'Sent email about the full-stack role. Brian responded asking to connect with the hiring manager — waiting on intro.',
        state: 'contacted',
        job_id: 9,
        scraped_company_id: null,
        created_at: daysAgo(7),
        updated_at: daysAgo(3),
        department: 'Executive',
        source: 'job_description_email',
        follow_up_date: daysAgo(2),
        intro_source: 'cold email',
        last_contacted_at: daysAgo(4),
        interaction_log: [
            { timestamp: daysAgo(7), event: 'Cold email sent', notes: 'Referenced Airbnb\'s new design system and full-stack role' },
            { timestamp: daysAgo(4), event: 'Reply received', notes: 'Brian said he\'d forward to hiring manager' },
        ],
        got_response: true,
        company_funding_stage: 'Public',
        company_headcount_range: '5,001–10,000 employees',
        company_industry: 'Travel & Hospitality',
        company_notes: null,
        linkedin_posts_summary: null,
        drafted_subject: null,
        send_at: null,
        sent_at: daysAgo(7),
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },

    // ── Engaged (replied + interviewing) ×3 ──────────────────────────
    {
        id: 4,
        name: 'Guillermo Rauch',
        role: 'CEO',
        company_name: 'Vercel',
        linkedin_url: 'https://linkedin.com/in/rauchg',
        email: 'guillermo@vercel.com',
        drafted_message: `Hi Guillermo,

Huge fan of the latest Next.js updates—the performance gains in the dev server are impressive. As someone who has been building with the Vercel stack for years, I'm particularly excited about the direction you're taking with Partial Prerendering.

I've just applied for the SWE role on the DX team. I'd love to learn more about how Vercel plans to further bridge the gap between development and production.`,
        notes: 'Guillermo replied! He mentioned they are specifically looking for people with deep React Server Components knowledge. Setting up a technical interview with the DX team.',
        state: 'replied',
        job_id: 1,
        scraped_company_id: 2,
        created_at: daysAgo(2),
        updated_at: daysAgo(1),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: new Date(Date.now() + 1 * 24 * 60 * 60000).toISOString(),
        intro_source: 'cold LinkedIn',
        last_contacted_at: daysAgo(2),
        interaction_log: [
            { timestamp: daysAgo(5), event: 'LinkedIn message sent', notes: 'PPR + DX team hook' },
            { timestamp: daysAgo(2), event: 'Reply received', notes: 'Guillermo mentioned RSC knowledge — forwarded to DX team' },
        ],
        got_response: true,
        company_funding_stage: 'Series E',
        company_headcount_range: '1,001–5,000 employees',
        company_industry: 'Cloud Computing',
        company_notes: null,
        linkedin_posts_summary: 'Promoting the benefits of Partial Prerendering and the importance of DX in frontend stacks. Frequently sharing performance metrics from major Next.js deployments.',
        drafted_subject: null,
        send_at: null,
        sent_at: daysAgo(5),
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
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
        created_at: daysAgo(7),
        updated_at: daysAgo(1),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: null,
        intro_source: 'warm intro via YC network',
        last_contacted_at: daysAgo(2),
        interaction_log: [
            { timestamp: daysAgo(14), event: 'Warm intro via YC connection', notes: 'YC alum connected us' },
            { timestamp: daysAgo(7), event: 'Initial call with recruiter' },
            { timestamp: daysAgo(4), event: 'Technical phone screen', notes: 'Went well — system design focused' },
            { timestamp: daysAgo(2), event: 'On-site scheduled', notes: '4 rounds: ML depth, system design, coding, team fit' },
        ],
        got_response: true,
        company_funding_stage: 'Late Stage',
        company_headcount_range: '1,001–5,000 employees',
        company_industry: 'Artificial Intelligence',
        company_notes: null,
        linkedin_posts_summary: 'Focused on the societal impact of AGI and the roadmap for GPT-5. Recently posted about the importance of alignment in frontier models.',
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
    {
        id: 11,
        name: 'Jensen Huang',
        role: 'CEO',
        company_name: 'NVIDIA',
        linkedin_url: 'https://linkedin.com/in/jenhsunhuang',
        email: null,
        drafted_message: null,
        notes: 'Reached out about CUDA platform engineering roles. Got connected to the developer tools team lead.',
        state: 'replied',
        job_id: null,
        scraped_company_id: null,
        created_at: daysAgo(10),
        updated_at: daysAgo(3),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: daysAgo(1),
        intro_source: 'cold LinkedIn',
        last_contacted_at: daysAgo(5),
        interaction_log: [
            { timestamp: daysAgo(10), event: 'LinkedIn message sent', notes: 'CUDA developer tools angle' },
            { timestamp: daysAgo(7), event: 'Reply from EA', notes: 'Jensen\'s EA forwarded to dev tools team' },
            { timestamp: daysAgo(5), event: 'Call with team lead', notes: 'Discussed CUDA compiler infrastructure' },
        ],
        got_response: true,
        company_funding_stage: 'Public',
        company_headcount_range: '10,000+ employees',
        company_industry: 'Semiconductors / AI',
        company_notes: 'Developer tools team is expanding rapidly for CUDA and Triton compiler work',
        linkedin_posts_summary: 'Keynote highlights from GTC, AI infrastructure vision, and NVIDIA\'s role in the AI revolution.',
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },

    // ── Closed (rejected) ×2 ─────────────────────────────────────────
    {
        id: 12,
        name: 'Tim Cook',
        role: 'CEO',
        company_name: 'Apple',
        linkedin_url: null,
        email: 'tcook@apple.com',
        drafted_message: null,
        notes: 'Reached out about Apple Intelligence team. Got a polite decline — they\'re looking for PhD candidates for current openings.',
        state: 'rejected',
        job_id: null,
        scraped_company_id: null,
        created_at: daysAgo(14),
        updated_at: daysAgo(8),
        department: 'Executive',
        source: 'cold_email',
        follow_up_date: null,
        intro_source: 'cold email',
        last_contacted_at: daysAgo(10),
        interaction_log: [
            { timestamp: daysAgo(14), event: 'Cold email sent', notes: 'Apple Intelligence team inquiry' },
            { timestamp: daysAgo(10), event: 'Reply from recruiter', notes: 'Polite decline — PhD required for current roles' },
        ],
        got_response: true,
        company_funding_stage: 'Public',
        company_headcount_range: '10,000+ employees',
        company_industry: 'Consumer Electronics',
        company_notes: null,
        linkedin_posts_summary: null,
        drafted_subject: null,
        send_at: null,
        sent_at: daysAgo(14),
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
    {
        id: 13,
        name: 'Andy Jassy',
        role: 'CEO',
        company_name: 'Amazon',
        linkedin_url: 'https://linkedin.com/in/ajassy',
        email: null,
        drafted_message: null,
        notes: 'No response after two follow-ups. Moving to closed.',
        state: 'rejected',
        job_id: 16,
        scraped_company_id: null,
        created_at: daysAgo(20),
        updated_at: daysAgo(5),
        department: 'Executive',
        source: 'linkedin_search',
        follow_up_date: null,
        intro_source: 'cold LinkedIn',
        last_contacted_at: daysAgo(10),
        interaction_log: [
            { timestamp: daysAgo(20), event: 'LinkedIn connection request', notes: 'AWS SDE II role reference' },
            { timestamp: daysAgo(15), event: 'Follow-up message', notes: 'No response to connection request' },
            { timestamp: daysAgo(10), event: 'Final follow-up', notes: 'Still no response — closing' },
        ],
        got_response: false,
        company_funding_stage: 'Public',
        company_headcount_range: '10,000+ employees',
        company_industry: 'Technology / Cloud',
        company_notes: null,
        linkedin_posts_summary: 'Posts about AWS innovation, customer obsession, and leadership principles.',
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
    },
];

// ════════════════════════════════════════════════════════════════════════
// MOCK CONFIG
// ════════════════════════════════════════════════════════════════════════

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
    last_scrape_at: hoursAgo(3),
};

// ════════════════════════════════════════════════════════════════════════
// MOCK PIPELINE MODULES
// ════════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════════
// MOCK COMPANIES
// ════════════════════════════════════════════════════════════════════════

export const MOCK_COMPANIES: ScrapedCompany[] = [
    {
        id: 1,
        name: 'Stripe',
        ats_platform: 'greenhouse',
        ats_slug: 'stripe',
        active: true,
        added_at: daysAgo(10),
    },
    {
        id: 2,
        name: 'Vercel',
        ats_platform: 'lever',
        ats_slug: 'vercel',
        active: true,
        added_at: daysAgo(15),
    },
    {
        id: 3,
        name: 'Retool',
        ats_platform: 'ashby',
        ats_slug: 'retool',
        active: true,
        added_at: daysAgo(12),
    },
    {
        id: 4,
        name: 'Ramp',
        ats_platform: 'greenhouse',
        ats_slug: 'ramp',
        active: true,
        added_at: daysAgo(8),
    },
    {
        id: 5,
        name: 'Linear',
        ats_platform: 'ashby',
        ats_slug: 'linear',
        active: false,
        added_at: daysAgo(20),
    },
];
