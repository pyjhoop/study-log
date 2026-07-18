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

/** sessions 테이블 1행 (단계 5에서 본격 사용) */
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
