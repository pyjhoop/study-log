use std::sync::Mutex;

use tauri::WindowEvent;
use tauri_plugin_sql::{Migration, MigrationKind};

mod commands;
mod state;
mod tray;

use state::Measurement;

/// SQLite 연결 문자열. 프론트(`src/lib/db.ts`)의 `Database.load` 인자와 반드시 일치해야 한다.
const DB_URL: &str = "sqlite:studylog.db";

/// 마이그레이션 목록. 새 스키마 변경은 version을 올려 뒤에 추가한다(기존 항목 수정 금지).
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init schema (subjects/sessions/settings)",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        // 측정 상태 단일 소스. 커맨드에서 `State<Mutex<Measurement>>`로 주입받는다.
        .manage(Mutex::new(Measurement::idle()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(DB_URL, migrations())
                .build(),
        );

    // 전역 핫키는 데스크톱에서만 사용한다 (단계 4에서 실제 등록).
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        // 트레이 상주(기획서 §10-2). setup에서 한 번 생성한다.
        .setup(|app| {
            tray::build_tray(app.handle())?;
            Ok(())
        })
        // 메인 창 X → 종료 대신 트레이로 숨김(백그라운드 유지·핫키 계속 동작).
        // 완전 종료는 트레이 "종료"(app.exit)로만.
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_session,
            commands::pause_session,
            commands::resume_session,
            commands::stop_session,
            commands::get_session_state,
            commands::toggle_overlay,
            commands::show_quickstart,
            commands::toggle_pause,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
