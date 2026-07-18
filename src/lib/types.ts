/**
 * DB row · 커맨드 payload 타입 정의. 프론트 전역에서 재사용한다.
 * (Rust snake_case 컬럼명을 그대로 따른다 — sql 플러그인이 컬럼명 키로 객체를 돌려주기 때문.)
 */

/** subjects 테이블 1행 */
export interface Subject {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  /** SQLite에는 boolean이 없어 0/1로 저장된다. */
  archived: number;
  created_at: number;
}

/** 과목 생성/수정 입력 (id·created_at 제외) */
export interface SubjectInput {
  name: string;
  color: string;
}

/** sessions 테이블 1행 */
export interface Session {
  id: number;
  subject_id: number;
  started_at: number;
  ended_at: number;
  duration_sec: number;
  paused_sec: number;
  memo: string | null;
  created_at: number;
}

/**
 * 세션 + 과목 이름/색(JOIN 결과). 기록 화면 목록에서 과목 표시에 쓴다.
 * (과목 삭제는 세션이 있으면 막으므로 subject는 항상 존재한다.)
 */
export interface SessionWithSubject extends Session {
  subject_name: string;
  subject_color: string;
}

/**
 * 세션 생성(수동 추가)/수정 입력. duration_sec는 저장 계층에서
 * `ended_at - started_at - paused_sec`(하한 0)로 파생한다 → 입력에 포함하지 않는다.
 */
export interface SessionInput {
  subject_id: number;
  started_at: number;
  ended_at: number;
  paused_sec: number;
  memo: string | null;
}

/** 측정 상태(Rust `Status` enum과 일치). */
export type SessionStatus = "idle" | "running" | "paused";

/**
 * 측정 상태 스냅샷. Rust가 단일 소스로 들고 `session-changed`로 브로드캐스트하며,
 * `get_session_state`의 응답 타입이기도 하다(Rust `SessionSnapshot`과 필드 일치).
 */
export interface SessionSnapshot {
  status: SessionStatus;
  subject_id: number | null;
  started_at: number | null;
  accumulated_paused_sec: number;
  paused_at: number | null;
  /** 스냅샷 시점의 공부 경과 시간(초). */
  elapsed_sec: number;
  /** 스냅샷을 만든 Rust 기준 시각(epoch sec). */
  server_now: number;
}

/** 측정 종료 요약(Rust `SessionSummary`). 세션 저장(INSERT)의 입력이 된다. */
export interface SessionSummary {
  subject_id: number;
  started_at: number;
  ended_at: number;
  duration_sec: number;
  paused_sec: number;
}
