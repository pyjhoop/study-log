//! 측정 커맨드 모음(기획서 §5-2). 프론트는 `invoke("start_session", …)` 형태로 호출한다.
//! 모든 커맨드는 상태를 바꾼 뒤 `session-changed` 이벤트로 전 창에 브로드캐스트한다.
//!
//! 규약: 커맨드는 `Result<T, String>` 반환 → 프론트에서 try/catch → toast.
//! 잘못된 상태 전이(예: 측정 중 시작)는 조용히 무시하지 않고 에러 메시지로 돌려준다.

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use crate::state::{now_epoch, Measurement, SessionSnapshot, SessionSummary, Status};

/// 상태 변경 브로드캐스트 이벤트 이름(kebab-case 규약).
const EVENT_SESSION_CHANGED: &str = "session-changed";

/// 현재 스냅샷을 모든 창에 emit. 락을 잡은 채로 호출하지 말 것(먼저 drop 후 emit).
fn broadcast(app: &AppHandle, snap: &SessionSnapshot) -> Result<(), String> {
    app.emit(EVENT_SESSION_CHANGED, snap)
        .map_err(|e| e.to_string())
}

/// 측정 시작. Idle일 때만 Running으로 전환한다.
#[tauri::command]
pub fn start_session(
    subject_id: i64,
    app: AppHandle,
    state: State<'_, Mutex<Measurement>>,
) -> Result<SessionSnapshot, String> {
    let now = now_epoch();
    let snap = {
        let mut m = state.lock().map_err(|e| e.to_string())?;
        if m.status != Status::Idle {
            return Err("이미 측정 중입니다.".into());
        }
        m.status = Status::Running;
        m.subject_id = Some(subject_id);
        m.started_at = Some(now);
        m.accumulated_paused_sec = 0;
        m.paused_at = None;
        m.snapshot(now)
    };
    broadcast(&app, &snap)?;
    Ok(snap)
}

/// 일시정지. Running일 때만.
#[tauri::command]
pub fn pause_session(
    app: AppHandle,
    state: State<'_, Mutex<Measurement>>,
) -> Result<SessionSnapshot, String> {
    let now = now_epoch();
    let snap = {
        let mut m = state.lock().map_err(|e| e.to_string())?;
        if m.status != Status::Running {
            return Err("측정 중이 아니어서 일시정지할 수 없습니다.".into());
        }
        m.status = Status::Paused;
        m.paused_at = Some(now);
        m.snapshot(now)
    };
    broadcast(&app, &snap)?;
    Ok(snap)
}

/// 재개. Paused일 때만. 정지했던 구간을 누적 정지 시간에 더한다.
#[tauri::command]
pub fn resume_session(
    app: AppHandle,
    state: State<'_, Mutex<Measurement>>,
) -> Result<SessionSnapshot, String> {
    let now = now_epoch();
    let snap = {
        let mut m = state.lock().map_err(|e| e.to_string())?;
        if m.status != Status::Paused {
            return Err("일시정지 상태가 아닙니다.".into());
        }
        if let Some(p) = m.paused_at.take() {
            m.accumulated_paused_sec += (now - p).max(0);
        }
        m.status = Status::Running;
        m.snapshot(now)
    };
    broadcast(&app, &snap)?;
    Ok(snap)
}

/// 측정 종료. 요약을 산출해 돌려주고 상태는 Idle로 리셋한다.
/// **세션 INSERT는 이 요약으로 메인 창 JS가 수행**한다(DB 접근을 JS 한 곳으로 통일).
#[tauri::command]
pub fn stop_session(
    app: AppHandle,
    state: State<'_, Mutex<Measurement>>,
) -> Result<SessionSummary, String> {
    let now = now_epoch();
    let (summary, snap) = {
        let mut m = state.lock().map_err(|e| e.to_string())?;
        if m.status == Status::Idle {
            return Err("측정 중이 아닙니다.".into());
        }
        // 정지 중에 종료하면 마지막 정지 구간도 누적에 포함한다.
        if m.status == Status::Paused {
            if let Some(p) = m.paused_at.take() {
                m.accumulated_paused_sec += (now - p).max(0);
            }
        }
        let subject_id = m.subject_id.ok_or_else(|| "과목 정보가 없습니다.".to_string())?;
        let started_at = m.started_at.ok_or_else(|| "시작 시각이 없습니다.".to_string())?;
        let paused_sec = m.accumulated_paused_sec;
        let duration_sec = (now - started_at - paused_sec).max(0);

        *m = Measurement::idle();
        let snap = m.snapshot(now);
        (
            SessionSummary {
                subject_id,
                started_at,
                ended_at: now,
                duration_sec,
                paused_sec,
            },
            snap,
        )
    };
    broadcast(&app, &snap)?;
    Ok(summary)
}

/// 현재 측정 상태 조회. 창이 새로 뜨거나 리로드될 때 동기화용(기획서 §5-2).
#[tauri::command]
pub fn get_session_state(
    state: State<'_, Mutex<Measurement>>,
) -> Result<SessionSnapshot, String> {
    let now = now_epoch();
    let m = state.lock().map_err(|e| e.to_string())?;
    Ok(m.snapshot(now))
}
