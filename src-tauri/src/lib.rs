use tauri_plugin_sql::{Migration, MigrationKind};

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
        .plugin(tauri_plugin_opener::init())
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
