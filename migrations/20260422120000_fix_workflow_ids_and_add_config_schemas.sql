-- Resolve the n8n_workflow_id collision between liveness-check and scrape-outreach-yc
-- (both had '09-*') and populate config_schema for the three modules whose runner
-- scripts landed in commit 4602af3.

UPDATE pipeline_modules
   SET n8n_workflow_id = '13-scrape-outreach-yc'
 WHERE key = 'scrape-outreach-yc';

UPDATE pipeline_modules
   SET config_schema = '{
     "type": "object",
     "properties": {
       "title":    {"type": "string",  "title": "Notification title",      "default": "Notiapply"},
       "message":  {"type": "string",  "title": "Override message (otherwise auto-summary)"},
       "priority": {"type": "string",  "title": "Priority", "enum": ["min","low","default","high","urgent"], "default": "default"},
       "tags":     {"type": "array",   "title": "Tags",     "items": {"type": "string"}}
     }
   }'::jsonb
 WHERE key = 'notifications';

UPDATE pipeline_modules
   SET config_schema = '{
     "type": "object",
     "properties": {
       "batch_size": {"type": "integer", "title": "Contacts per run", "default": 25, "minimum": 1, "maximum": 200}
     }
   }'::jsonb
 WHERE key = 'outreach-drafting';
