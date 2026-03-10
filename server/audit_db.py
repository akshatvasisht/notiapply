
import os
import psycopg2
import json

db_url = os.environ.get("db_url")
if not db_url:
    print("Error: db_url environment variable not set.")
    exit(1)

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- Pipeline Modules ---")
    cur.execute("SELECT key, name, is_builtin, n8n_workflow_id FROM pipeline_modules;")
    modules = cur.fetchall()
    for m in modules:
        print(f"Module: {m[0]} ({m[1]}) | Builtin: {m[2]} | n8n: {m[3]}")
        
    print("\n--- Module Configuration Keys ---")
    # Just list keys to avoid leaking secrets in logs if possible, but I need to see if Gemini/OpenAI are there
    cur.execute("SELECT module_key, config FROM module_config;")
    configs = cur.fetchall()
    for c in configs:
        conf = c[1]
        keys = list(conf.keys()) if isinstance(conf, dict) else []
        print(f"Module: {c[0]} | Config Keys: {keys}")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Database Error: {e}")
