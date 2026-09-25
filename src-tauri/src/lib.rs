mod commands;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::system::greet,
            commands::system::list_system_fonts,
            commands::system::list_ssh_config_aliases,
            commands::connection::test_connection,
            commands::connection::create_sqlite_database,
            commands::connection::list_databases,
            commands::schema::list_schema_objects,
            commands::schema::get_routine_definition,
            commands::schema::get_table_data,
            commands::schema::get_table_schema,
            commands::query::run_query
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
