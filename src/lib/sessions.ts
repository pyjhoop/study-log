import { getDb } from "./db";
import type { SessionSummary } from "./types";

/**
 * 학습 세션(sessions) 데이터 접근. 측정 종료 시 Rust가 돌려준 요약을 여기서 INSERT한다
 * (DB 접근은 JS 한 곳으로 통일 — 기획서 §5-2). 값은 반드시 `?` 파라미터 바인딩한다.
 */

/** 측정 요약을 세션 1행으로 저장한다. duration_sec가 0이면 저장하지 않고 false. */
export async function saveSession(
  summary: SessionSummary,
  memo: string | null = null,
): Promise<boolean> {
  if (summary.duration_sec <= 0) return false;
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.execute(
    `INSERT INTO sessions
       (subject_id, started_at, ended_at, duration_sec, paused_sec, memo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      summary.subject_id,
      summary.started_at,
      summary.ended_at,
      summary.duration_sec,
      summary.paused_sec,
      memo,
      now,
    ],
  );
  return true;
}
