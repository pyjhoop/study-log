import Database from "@tauri-apps/plugin-sql";

/**
 * SQLite 연결. Rust(`src-tauri/src/lib.rs`)의 DB_URL과 반드시 일치해야 한다.
 * 마이그레이션은 Rust 쪽에서 이 URL로 등록되어 load 시 자동 실행된다.
 */
const DB_URL = "sqlite:studylog.db";

let dbPromise: Promise<Database> | null = null;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `Database.load`를 재시도한다. 앱 첫 실행 직후에는 웹뷰가 Tauri SQL 플러그인
 * (+마이그레이션) 준비보다 먼저 뜰 수 있어, 그 순간의 load/쿼리가 실패한다.
 * (증상: 첫 실행 시 "통계를 불러오지 못했습니다" → 새로고침하면 정상.)
 * 짧은 백오프로 몇 번 다시 시도해 플러그인이 준비될 때까지 기다린다.
 */
async function loadWithRetry(): Promise<Database> {
  const backoffMs = [100, 200, 400, 800, 1200];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    try {
      return await Database.load(DB_URL);
    } catch (e) {
      lastErr = e;
      if (attempt < backoffMs.length) await delay(backoffMs[attempt]);
    }
  }
  throw lastErr;
}

/**
 * DB 싱글턴. 여러 곳에서 호출해도 연결은 한 번만 만든다.
 * (Spring의 DataSource/Connection 풀 대신, 로컬 단일 연결을 재사용한다고 보면 된다.)
 *
 * 연결에 **실패하면 캐시를 비워** 다음 호출이 다시 시도하게 한다. 실패한 promise를
 * 그대로 캐싱하면 웹뷰를 새로고침하기 전까지 모든 DB 접근이 영구히 실패하기 때문.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = loadWithRetry().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
