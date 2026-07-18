import Database from "@tauri-apps/plugin-sql";

/**
 * SQLite 연결. Rust(`src-tauri/src/lib.rs`)의 DB_URL과 반드시 일치해야 한다.
 * 마이그레이션은 Rust 쪽에서 이 URL로 등록되어 load 시 자동 실행된다.
 */
const DB_URL = "sqlite:studylog.db";

let dbPromise: Promise<Database> | null = null;

/**
 * DB 싱글턴. 여러 곳에서 호출해도 연결은 한 번만 만든다.
 * (Spring의 DataSource/Connection 풀 대신, 로컬 단일 연결을 재사용한다고 보면 된다.)
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}
