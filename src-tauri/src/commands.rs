//! 측정 커맨드 모음(기획서 §5-2). 프론트는 `invoke("start_session", …)` 형태로 호출한다.
//! 모든 커맨드는 상태를 바꾼 뒤 `session-changed` 이벤트로 전 창에 브로드캐스트한다.
//!
//! 규약: 커맨드는 `Result<T, String>` 반환 → 프론트에서 try/catch → toast.
//! 잘못된 상태 전이(예: 측정 중 시작)는 조용히 무시하지 않고 에러 메시지로 돌려준다.

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::state::{now_epoch, Measurement, SessionSnapshot, SessionSummary, Status};

/// 종료됐지만 아직 메인 창 JS가 저장하지 못한 마지막 요약을 보관하는 상태.
/// `lib.rs`에서 `Mutex::new(None)`으로 manage하고, 메인 창이 마운트 시 배수한다.
pub type PendingFinished = Mutex<Option<SessionSummary>>;

/// 상태 변경 브로드캐스트 이벤트 이름(kebab-case 규약).
const EVENT_SESSION_CHANGED: &str = "session-changed";
/// 측정 종료 시 요약을 실어 보내는 이벤트. **메인 창이 받아 세션을 저장**한다
/// (핫키·트레이·오버레이 어디서 종료해도 저장 경로가 하나가 되도록 — 기획서 §5-2).
const EVENT_SESSION_FINISHED: &str = "session-finished";
/// 항상-위 타이머 오버레이 창 라벨(tauri.conf.json과 일치).
const TIMER_LABEL: &str = "timer";
/// 빠른 시작 피커 창 라벨(tauri.conf.json과 일치).
const QUICKSTART_LABEL: &str = "quickstart";

/// 현재 스냅샷을 모든 창에 emit. 락을 잡은 채로 호출하지 말 것(먼저 drop 후 emit).
fn broadcast(app: &AppHandle, snap: &SessionSnapshot) -> Result<(), String> {
    app.emit(EVENT_SESSION_CHANGED, snap)
        .map_err(|e| e.to_string())
}

/// Mutex 락을 잡되, 이전에 락을 쥔 스레드가 패닉해 **poison된 경우에도 복구**한다.
/// 측정 상태는 서로 독립적인 `Copy` 필드뿐이라 깨진 불변식이 없다 → poison을 무시하고
/// 내부 값을 그대로 쓴다(그러지 않으면 한 번 패닉 후 모든 측정 커맨드가 영구 불능이 됨).
fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

/// 타이머 오버레이 창을 표시/숨김. 창이 없거나 실패해도 측정 자체는 계속되므로 에러는 삼킨다.
fn set_overlay_visible(app: &AppHandle, visible: bool) {
    if let Some(win) = app.get_webview_window(TIMER_LABEL) {
        let _ = if visible { win.show() } else { win.hide() };
    }
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
        let mut m = lock(&state);
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
    // 측정 시작 시 오버레이 자동 표시(기획서 §8-2).
    set_overlay_visible(&app, true);
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
        let mut m = lock(&state);
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
        let mut m = lock(&state);
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
    pending: State<'_, PendingFinished>,
) -> Result<SessionSummary, String> {
    let now = now_epoch();
    let (summary, snap) = {
        let mut m = lock(&state);
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
    // 저장 리스너(메인 창)가 아직 준비 전이어도 요약을 잃지 않도록 보관한다.
    // 메인 창이 마운트 시 `take_pending_finished`로 배수(drain)해 저장한다
    // (중복은 저장 계층의 자연키 검사로 방지). --autostart 초기 로드 구간의 유실 방어.
    *lock(&pending) = Some(summary.clone());

    broadcast(&app, &snap)?;
    // 종료 요약을 메인 창에 전달해 세션을 저장하게 한다(저장 경로 일원화).
    app.emit(EVENT_SESSION_FINISHED, &summary)
        .map_err(|e| e.to_string())?;
    // 종료 시 오버레이 자동 숨김(기획서 §8-2).
    set_overlay_visible(&app, false);
    Ok(summary)
}

/// 타이머 오버레이 표시/숨김 토글. 반환값은 토글 후 표시 여부.
/// 단계 4의 오버레이 핫키(`Ctrl+Alt+H`)·단계 7 트레이 메뉴가 재사용한다.
#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> Result<bool, String> {
    let win = app
        .get_webview_window(TIMER_LABEL)
        .ok_or_else(|| "타이머 창을 찾을 수 없습니다.".to_string())?;
    let visible = win.is_visible().map_err(|e| e.to_string())?;
    if visible {
        win.hide().map_err(|e| e.to_string())?;
    } else {
        win.show().map_err(|e| e.to_string())?;
    }
    Ok(!visible)
}

/// 시작 핫키(`Ctrl+Alt+S`)용: **Idle일 때만** 빠른 시작 피커를 표시·포커스한다.
/// 측정 중이면 조용히 무시한다(기획서 §6 "상태에 맞지 않는 입력은 무시").
/// Idle 가드를 Rust(단일 소스)에 두어 프론트가 상태를 몰라도 되게 한다.
#[tauri::command]
pub fn show_quickstart(
    app: AppHandle,
    state: State<'_, Mutex<Measurement>>,
) -> Result<(), String> {
    {
        let m = lock(&state);
        if m.status != Status::Idle {
            return Ok(());
        }
    }
    if let Some(win) = app.get_webview_window(QUICKSTART_LABEL) {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 일시정지/재개 토글(일시정지 핫키 `Ctrl+Alt+P`·단계 7 트레이용). Running↔Paused.
/// pause/resume 로직을 한 커맨드로 합쳐 프론트가 현재 상태를 알 필요 없게 한다.
#[tauri::command]
pub fn toggle_pause(
    app: AppHandle,
    state: State<'_, Mutex<Measurement>>,
) -> Result<SessionSnapshot, String> {
    let now = now_epoch();
    let snap = {
        let mut m = lock(&state);
        match m.status {
            Status::Running => {
                m.status = Status::Paused;
                m.paused_at = Some(now);
            }
            Status::Paused => {
                if let Some(p) = m.paused_at.take() {
                    m.accumulated_paused_sec += (now - p).max(0);
                }
                m.status = Status::Running;
            }
            Status::Idle => return Err("측정 중이 아닙니다.".into()),
        }
        m.snapshot(now)
    };
    broadcast(&app, &snap)?;
    Ok(snap)
}

/// 종료 요약 배수(drain). 메인 창이 마운트 시/저장 후 호출해, `stop_session`이 보관해 둔
/// 아직 저장 못 한 요약을 가져가 저장한다(있으면 Some, 없으면 None). 가져가면 비운다.
/// 저장은 자연키 중복 검사를 거치므로 이벤트 저장과 겹쳐도 중복 INSERT되지 않는다.
#[tauri::command]
pub fn take_pending_finished(
    pending: State<'_, PendingFinished>,
) -> Result<Option<SessionSummary>, String> {
    Ok(lock(&pending).take())
}

/// 현재 측정 상태 조회. 창이 새로 뜨거나 리로드될 때 동기화용(기획서 §5-2).
#[tauri::command]
pub fn get_session_state(
    state: State<'_, Mutex<Measurement>>,
) -> Result<SessionSnapshot, String> {
    let now = now_epoch();
    let m = lock(&state);
    Ok(m.snapshot(now))
}
