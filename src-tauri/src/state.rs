//! 측정 상태(단일 소스). 여러 창이 함께 봐야 하므로 Rust가 들고 있고,
//! 변경 시 `session-changed` 이벤트로 모든 창에 브로드캐스트한다(기획서 §5).
//!
//! (Spring으로 치면 앱 전역 싱글턴 빈 하나가 in-memory 상태를 들고 있는 셈.
//!  다만 DI 컨테이너 없이 Tauri `manage`로 등록한 `Mutex`를 커맨드에서 주입받는다.)

use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

/// 현재 시각을 Unix epoch(초)로. DB의 시간 컬럼과 동일 단위.
pub fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// 측정 상태. 프론트에는 소문자 문자열("idle"/"running"/"paused")로 전달된다.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Idle,
    Running,
    Paused,
}

/// 측정 상태의 내부 단일 소스. `Mutex`로 감싸 `manage`한다.
#[derive(Clone, Copy, Debug)]
pub struct Measurement {
    pub status: Status,
    pub subject_id: Option<i64>,
    /// 측정 시작 시각(epoch sec).
    pub started_at: Option<i64>,
    /// 누적 일시정지 시간(초).
    pub accumulated_paused_sec: i64,
    /// 현재 일시정지가 시작된 시각(정지 중일 때만 Some).
    pub paused_at: Option<i64>,
}

impl Measurement {
    /// 초기(Idle) 상태.
    pub fn idle() -> Self {
        Self {
            status: Status::Idle,
            subject_id: None,
            started_at: None,
            accumulated_paused_sec: 0,
            paused_at: None,
        }
    }

    /// 실제 공부 경과 시간(초). 일시정지 시간은 제외한다(기획서 §5-3).
    /// `elapsed = now - started_at - accumulated_paused - (paused ? now - paused_at : 0)`
    pub fn elapsed(&self, now: i64) -> i64 {
        let Some(started) = self.started_at else {
            return 0;
        };
        let paused_now = match (self.status, self.paused_at) {
            (Status::Paused, Some(p)) => (now - p).max(0),
            _ => 0,
        };
        (now - started - self.accumulated_paused_sec - paused_now).max(0)
    }

    /// 프론트로 보낼 직렬화용 스냅샷. 원시 필드 + 편의용 `elapsed_sec`/`server_now`를 함께 담아
    /// 오버레이가 로컬 `setInterval`로 드리프트 없이 다시 그릴 수 있게 한다.
    pub fn snapshot(&self, now: i64) -> SessionSnapshot {
        SessionSnapshot {
            status: self.status,
            subject_id: self.subject_id,
            started_at: self.started_at,
            accumulated_paused_sec: self.accumulated_paused_sec,
            paused_at: self.paused_at,
            elapsed_sec: self.elapsed(now),
            server_now: now,
        }
    }
}

/// 프론트(모든 창)로 브로드캐스트/응답되는 측정 상태 스냅샷.
#[derive(Clone, Debug, Serialize)]
pub struct SessionSnapshot {
    pub status: Status,
    pub subject_id: Option<i64>,
    pub started_at: Option<i64>,
    pub accumulated_paused_sec: i64,
    pub paused_at: Option<i64>,
    /// 스냅샷 시점의 공부 경과 시간(초).
    pub elapsed_sec: i64,
    /// 스냅샷을 만든 Rust 기준 시각(epoch sec). 프론트 시계 보정용.
    pub server_now: i64,
}

/// 측정 종료 시 산출되는 요약. 세션 저장(INSERT)은 이 값으로 **메인 창 JS**가 수행한다(기획서 §5-2).
#[derive(Clone, Debug, Serialize)]
pub struct SessionSummary {
    pub subject_id: i64,
    pub started_at: i64,
    pub ended_at: i64,
    /// 실제 공부 시간(일시정지 제외).
    pub duration_sec: i64,
    pub paused_sec: i64,
}
