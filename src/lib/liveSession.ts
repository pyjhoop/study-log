import { getSetting, setSetting } from "./settings";
import type { SessionSummary } from "./types";

/**
 * 진행 중(Running/Paused) 세션의 "살아있는 스냅샷"을 DB(settings)에 주기적으로 남겨,
 * 앱/PC가 비정상 종료돼도 다음 실행 때 마지막 기록 시점까지 복구할 수 있게 한다(기획 F1).
 *
 * 측정 상태 단일 소스는 여전히 Rust 인메모리다. 여기 저장하는 값은 오직 "크래시 복구용 백업"으로,
 * 정상 종료(stop) 시에는 반드시 `clearLive()`로 지워야 중복 저장이 나지 않는다.
 *
 * 저장 형태는 `SessionSummary`와 동일하다 → 복구 시 기존 `saveSession`에 그대로 넘긴다.
 * `ended_at`은 마지막 하트비트 시각, `duration_sec`/`paused_sec`은 그 시점의 파생값이다.
 */

/** settings 테이블 key. 백업(F3)에서는 이 key를 제외한다(휘발 상태라 백업 대상 아님). */
export const LIVE_SESSION_KEY = "live_session";

/** 진행 중 세션의 마지막 스냅샷을 upsert한다(시작·일시정지·재개·하트비트마다 호출). */
export async function writeLive(snapshot: SessionSummary): Promise<void> {
  await setSetting(LIVE_SESSION_KEY, snapshot);
}

/** 진행 중 세션 스냅샷을 읽는다. 없으면 null. */
export async function readLive(): Promise<SessionSummary | null> {
  return getSetting<SessionSummary>(LIVE_SESSION_KEY);
}

/** 진행 중 세션 스냅샷을 지운다(정상 종료·복구 완료 시). */
export async function clearLive(): Promise<void> {
  await setSetting(LIVE_SESSION_KEY, null);
}
