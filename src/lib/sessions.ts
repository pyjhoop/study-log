import { getDb } from "./db";
import { nowSec } from "./time";
import type { SessionInput, SessionSummary, SessionWithSubject } from "./types";

/**
 * 학습 세션(sessions) 데이터 접근. 측정 종료 시 Rust가 돌려준 요약을 여기서 INSERT하고,
 * 기록 화면의 조회/수정/삭제/수동 추가도 여기서 처리한다
 * (DB 접근은 JS 한 곳으로 통일 — 기획서 §5-2). 값은 반드시 `?` 파라미터 바인딩한다.
 */

/** 실제 공부 시간(초) = 종료 - 시작 - 일시정지, 하한 0. 저장 계층에서 파생한다. */
function deriveDuration(startedAt: number, endedAt: number, pausedSec: number): number {
  return Math.max(0, endedAt - startedAt - pausedSec);
}

/** 측정 요약을 세션 1행으로 저장한다. duration_sec가 0이면 저장하지 않고 false. */
export async function saveSession(
  summary: SessionSummary,
  memo: string | null = null,
): Promise<boolean> {
  if (summary.duration_sec <= 0) return false;
  const db = await getDb();
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
      nowSec(),
    ],
  );
  return true;
}

/**
 * 같은 세션이 이미 저장돼 있는지(자연키 = 과목·시작·종료 초). 크래시 복구/종료 요약 배수가
 * 정상 저장과 겹쳐도 중복 INSERT되지 않게 하는 dedup 가드. 서로 다른 실제 세션이 초 단위로
 * 과목·시작·종료가 모두 같을 가능성은 사실상 없다.
 */
export async function sessionExists(
  subjectId: number,
  startedAt: number,
  endedAt: number,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM sessions WHERE subject_id = ? AND started_at = ? AND ended_at = ?",
    [subjectId, startedAt, endedAt],
  );
  return (rows[0]?.c ?? 0) > 0;
}

/** 세션 목록(과목 이름/색 JOIN). 최근순. 기록 화면에서 사용. */
export async function listSessions(limit = 1000): Promise<SessionWithSubject[]> {
  const db = await getDb();
  return db.select<SessionWithSubject[]>(
    `SELECT s.id, s.subject_id, s.started_at, s.ended_at, s.duration_sec,
            s.paused_sec, s.memo, s.created_at,
            sub.name AS subject_name, sub.color AS subject_color
       FROM sessions s
       JOIN subjects sub ON sub.id = s.subject_id
      ORDER BY s.started_at DESC, s.id DESC
      LIMIT ?`,
    [limit],
  );
}

/** 세션 수동 추가. duration_sec는 파생한다. */
export async function createSession(input: SessionInput): Promise<void> {
  const db = await getDb();
  const duration = deriveDuration(input.started_at, input.ended_at, input.paused_sec);
  await db.execute(
    `INSERT INTO sessions
       (subject_id, started_at, ended_at, duration_sec, paused_sec, memo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.subject_id,
      input.started_at,
      input.ended_at,
      duration,
      input.paused_sec,
      input.memo,
      nowSec(),
    ],
  );
}

/** 세션 수정(과목·시각·메모). duration_sec는 다시 파생한다. */
export async function updateSession(id: number, input: SessionInput): Promise<void> {
  const db = await getDb();
  const duration = deriveDuration(input.started_at, input.ended_at, input.paused_sec);
  await db.execute(
    `UPDATE sessions
        SET subject_id = ?, started_at = ?, ended_at = ?,
            duration_sec = ?, paused_sec = ?, memo = ?
      WHERE id = ?`,
    [input.subject_id, input.started_at, input.ended_at, duration, input.paused_sec, input.memo, id],
  );
}

/** 세션 삭제. */
export async function deleteSession(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM sessions WHERE id = ?", [id]);
}
