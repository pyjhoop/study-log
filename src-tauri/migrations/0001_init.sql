-- 단계 1: 초기 스키마 (과목 / 세션 / 설정)
-- 시간은 Unix epoch(초, INTEGER)로 저장하고, 집계 시 localtime으로 변환한다.

-- 과목
CREATE TABLE subjects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 학습 세션 (측정 1회 = 1행)
CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id   INTEGER NOT NULL REFERENCES subjects(id),
  started_at   INTEGER NOT NULL,     -- epoch sec
  ended_at     INTEGER NOT NULL,     -- epoch sec
  duration_sec INTEGER NOT NULL,     -- 실제 공부 시간(일시정지 제외)
  paused_sec   INTEGER NOT NULL DEFAULT 0,
  memo         TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_sessions_started ON sessions(started_at);
CREATE INDEX idx_sessions_subject ON sessions(subject_id);

-- 앱 설정(키-값): 핫키 바인딩, 오버레이 옵션, 뽀모도로 설정, 목표시간 등 (JSON 문자열)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
