
INSERT INTO pipeline_modules
  (key, name, description, phase, execution_order, enabled, is_builtin, n8n_workflow_id, config_schema, dependencies)
VALUES
  ('liveness-check', 'Liveness Check', 'HEAD-checks job URLs to detect dead postings (404/410, redirect-to-listing, stale phrasing). Marks dead jobs is_live=false and transitions to filtered-out.', 'processing', 5, true, true, '09-liveness-check', NULL, '{}');

