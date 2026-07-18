use std::sync::Mutex;

use tauri::{Manager, WindowEvent};
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
        // GitHub 백업/복원(F3)이 GitHub API를 CORS 없이 호출하기 위한 HTTP 플러그인.
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(DB_URL, migrations())
                .build(),
        );

    // 데스크톱 전용 플러그인: 전역 핫키(단계 4) + 부팅 자동 시작(F2).
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            // 자동 시작. 부팅 실행을 `--autostart` 인자로 식별해 setup에서 조용히 상주시킨다.
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--autostart"]),
            ));
    }

    builder
        // 트레이 상주(기획서 §10-2). setup에서 한 번 생성한다.
        .setup(|app| {
            tray::build_tray(app.handle())?;
            // 부팅 자동 시작(`--autostart`)이면 창을 띄우지 않고 트레이에만 조용히 상주한다(F2).
            // 그 외(사용자가 직접 실행)에는 메인 창을 표시한다. (main 창은 visible:false로 시작.)
            let autostart = std::env::args().any(|a| a == "--autostart");
            if !autostart {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
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
