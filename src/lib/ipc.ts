import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SessionSnapshot, SessionSummary } from "./types";

/**
 * 측정 커맨드/이벤트 래퍼. React ↔ Rust 경계는 오직 `invoke`(요청/응답)와
 * `event`(브로드캐스트)로만 통신한다(HTTP 아님). 여기서 한 겹 감싸 화면 코드가
 * 커맨드 이름·페이로드 형태를 몰라도 되게 한다.
 *
 * 인자 키는 camelCase로 넘긴다 — Tauri가 Rust snake_case 파라미터로 자동 매핑한다
 * (예: `subjectId` → `subject_id`).
 */

/** 상태 변경 브로드캐스트 이벤트 이름(Rust와 일치). */
export const EVENT_SESSION_CHANGED = "session-changed";

/** 측정 시작. Idle일 때만 성공. */
export function startSession(subjectId: number): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("start_session", { subjectId });
}

/** 일시정지. Running일 때만. */
export function pauseSession(): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("pause_session");
}

/** 재개. Paused일 때만. */
export function resumeSession(): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("resume_session");
}

/** 측정 종료. 저장할 요약을 돌려준다(INSERT는 호출부에서 수행). */
export function stopSession(): Promise<SessionSummary> {
  return invoke<SessionSummary>("stop_session");
}

/** 현재 측정 상태 조회(창 로드/리로드 시 동기화). */
export function getSessionState(): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("get_session_state");
}

/** `session-changed` 구독. 반환된 함수를 호출하면 구독 해제. */
export function onSessionChanged(
  handler: (snapshot: SessionSnapshot) => void,
): Promise<UnlistenFn> {
  return listen<SessionSnapshot>(EVENT_SESSION_CHANGED, (e) => handler(e.payload));
}
