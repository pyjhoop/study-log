import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
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
/** 측정 종료 시 요약을 실어 보내는 이벤트(메인 창이 받아 세션 저장). */
export const EVENT_SESSION_FINISHED = "session-finished";
/** 메인 창을 표시·포커스(+선택 화면 전환) 요청 이벤트. 대시보드 핫키·피커 빈 상태 유도에서 사용. */
export const EVENT_FOCUS_MAIN = "focus-main";
/** 세션이 실제로 DB에 저장된 뒤 알리는 이벤트(대시보드 통계 새로고침용). */
export const EVENT_SESSION_SAVED = "session-saved";
/** 오버레이 커스터마이즈 옵션 변경 → 타이머 창 즉시 반영. */
export const EVENT_OVERLAY_OPTIONS_CHANGED = "overlay-options-changed";
/** 전역 핫키 바인딩 변경 → 메인 창이 재등록. */
export const EVENT_HOTKEYS_CHANGED = "hotkeys-changed";
/** 설정의 "업데이트 확인" 버튼 → 메인 창의 업데이터가 수동 확인을 실행. */
export const EVENT_CHECK_UPDATE = "check-update";

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

/**
 * 종료됐지만 아직 저장 못 한 요약을 가져간다(있으면 요약, 없으면 null). 가져가면 Rust에서 비운다.
 * 메인 창이 마운트 시 호출해 `session-finished` 이벤트를 놓쳤을 때의 유실을 메운다.
 */
export function takePendingFinished(): Promise<SessionSummary | null> {
  return invoke<SessionSummary | null>("take_pending_finished");
}

/** 타이머 오버레이 표시/숨김 토글. 반환값은 토글 후 표시 여부. */
export function toggleOverlay(): Promise<boolean> {
  return invoke<boolean>("toggle_overlay");
}

/** 빠른 시작 피커 표시(Idle일 때만 — Idle 가드는 Rust에서). 시작 핫키가 호출. */
export function showQuickstart(): Promise<void> {
  return invoke<void>("show_quickstart");
}

/** 일시정지/재개 토글. Running↔Paused, Idle이면 에러. */
export function togglePause(): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("toggle_pause");
}

/** `session-changed` 구독. 반환된 함수를 호출하면 구독 해제. */
export function onSessionChanged(
  handler: (snapshot: SessionSnapshot) => void,
): Promise<UnlistenFn> {
  return listen<SessionSnapshot>(EVENT_SESSION_CHANGED, (e) => handler(e.payload));
}

/** `session-finished` 구독(측정 종료 요약). 메인 창이 이 요약으로 세션을 저장한다. */
export function onSessionFinished(
  handler: (summary: SessionSummary) => void,
): Promise<UnlistenFn> {
  return listen<SessionSummary>(EVENT_SESSION_FINISHED, (e) => handler(e.payload));
}

/** 메인 창 표시·포커스 요청을 보낸다(다른 창에서 호출). screen 지정 시 해당 화면으로 전환. */
export function requestFocusMain(screen?: string): Promise<void> {
  return emit(EVENT_FOCUS_MAIN, { screen });
}

/** 세션 저장 완료를 알린다(저장 리스너가 INSERT 성공 후 호출). */
export function emitSessionSaved(): Promise<void> {
  return emit(EVENT_SESSION_SAVED);
}

/** `session-saved` 구독. 대시보드가 통계를 다시 읽는다. */
export function onSessionSaved(handler: () => void): Promise<UnlistenFn> {
  return listen(EVENT_SESSION_SAVED, () => handler());
}

/** `focus-main` 구독(메인 창에서). 표시·포커스하고 screen이 있으면 그 화면으로 전환. */
export function onFocusMain(
  handler: (payload: { screen?: string }) => void,
): Promise<UnlistenFn> {
  return listen<{ screen?: string }>(EVENT_FOCUS_MAIN, (e) => handler(e.payload));
}

/** 오버레이 옵션 변경을 브로드캐스트한다(설정 화면 → 타이머 창). */
export function emitOverlayOptionsChanged(options: unknown): Promise<void> {
  return emit(EVENT_OVERLAY_OPTIONS_CHANGED, options);
}

/** `overlay-options-changed` 구독(타이머 창). */
export function onOverlayOptionsChanged<T>(handler: (options: T) => void): Promise<UnlistenFn> {
  return listen<T>(EVENT_OVERLAY_OPTIONS_CHANGED, (e) => handler(e.payload));
}

/** 핫키 바인딩 변경을 알린다(설정 화면 → 메인 창 재등록). */
export function emitHotkeysChanged(): Promise<void> {
  return emit(EVENT_HOTKEYS_CHANGED);
}

/** `hotkeys-changed` 구독(메인 창). */
export function onHotkeysChanged(handler: () => void): Promise<UnlistenFn> {
  return listen(EVENT_HOTKEYS_CHANGED, () => handler());
}

/** 수동 업데이트 확인 요청(설정 화면 → 메인 창). */
export function emitCheckUpdate(): Promise<void> {
  return emit(EVENT_CHECK_UPDATE);
}

/** `check-update` 구독(메인 창의 업데이터). */
export function onCheckUpdate(handler: () => void): Promise<UnlistenFn> {
  return listen(EVENT_CHECK_UPDATE, () => handler());
}
