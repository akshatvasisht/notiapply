
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  company_name TEXT NOT NULL,
  linkedin_url TEXT,
  email TEXT,
  drafted_message TEXT,
  notes TEXT,
  state TEXT NOT NULL DEFAULT 'identified'
    CHECK (state IN ('identified', 'drafted', 'contacted', 'replied', 'interviewing', 'rejected')),
  job_id INTEGER REFERENCES jobs(id),
  scraped_company_id INTEGER REFERENCES scraped_companies(id),
  contact_hash CHAR(64) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_state ON contacts(state);

INSERT INTO pipeline_modules
  (key, name, description, phase, execution_order, enabled, is_builtin, n8n_workflow_id, config_schema, dependencies)
VALUES
('scrape-outreach-yc', 'Startup Founders (YC)', 'Scrapes founder names and LinkedIn pages dynamically from YCombinator based on user-defined slugs.', 'scraping', 50, true, true, '09-scrape-outreach-yc', '{"type":"object","properties":{"yc_slugs":{"type":"array","title":"Target YC Slugs","items":{"type":"string"}}}}', '{}'),
('scrape-outreach-github', 'Lead Engineering Strategy (GitHub)', 'Polls open source GitHub organizations to find primary contributors, scraping their public emails and names for direct cold outreach.', 'scraping', 60, true, true, '10-scrape-outreach-github', '{"type":"object","properties":{"github_orgs":{"type":"array","title":"Target GitHub Orgs","items":{"type":"string"}}}}', '{}'),
('outreach-drafting', 'Outreach Drafter', 'Drafts 2-sentence cold emails for startup contacts.', 'processing', 15, true, true, '11-outreach-drafting', NULL, '{}');

