use tauri;

#[tauri::command]
async fn create_fill_session(session_id: String) -> Result<(), String> {
    let db_url = std::env::var("DATABASE_URL").map_err(|e| e.to_string())?;
    let pool = sqlx::PgPool::connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("INSERT INTO fill_sessions (session_uuid) VALUES ($1::uuid)")
        .bind(&session_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_env(key: String) -> Result<String, String> {
    std::env::var(&key).map_err(|_| format!("env var {} not set", key))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![create_fill_session, get_env])
        .run(tauri::generate_context!())
        .expect("error running Notiapply");
}
