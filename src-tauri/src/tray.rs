//! 시스템 트레이(기획서 §10-2). 트레이 아이콘 + 우클릭 메뉴로 앱을 제어하고,
//! 좌클릭으로 메인 창을 표시·포커스한다. **메인 창 X는 종료 대신 트레이로 숨김**(lib.rs의
//! on_window_event에서 처리)이라, 트레이 "종료"만이 앱을 완전히 끝낸다(핫키는 계속 동작).
//!
//! 메뉴 동작은 측정 커맨드(commands.rs)를 그대로 재사용한다 — 상태 판단(Idle 가드 등)은
//! 전부 Rust 단일 소스에 있으므로, 트레이든 핫키든 같은 함수를 호출하면 된다.

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::commands;
use crate::state::Measurement;

const MENU_START: &str = "tray_start";
const MENU_STOP: &str = "tray_stop";
const MENU_PAUSE: &str = "tray_pause";
const MENU_OVERLAY: &str = "tray_overlay";
const MENU_DASHBOARD: &str = "tray_dashboard";
const MENU_QUIT: &str = "tray_quit";

/// JS(useTray)가 `TrayIcon.getById`로 찾아 툴팁을 갱신할 수 있게 고정 id를 준다.
pub const TRAY_ID: &str = "main-tray";

/// 앱 setup에서 한 번 호출해 트레이를 만든다.
pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let start = MenuItem::with_id(app, MENU_START, "측정 시작", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, MENU_STOP, "측정 종료", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, MENU_PAUSE, "일시정지 / 재개", true, None::<&str>)?;
    let overlay = MenuItem::with_id(app, MENU_OVERLAY, "오버레이 표시 / 숨김", true, None::<&str>)?;
    let dashboard = MenuItem::with_id(app, MENU_DASHBOARD, "대시보드 열기", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "종료", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[&start, &stop, &pause, &overlay, &dashboard, &sep, &quit],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().cloned().expect("트레이 아이콘 없음"))
        .tooltip("학습기록")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            // 상태에 맞지 않는 입력(측정 중 시작, Idle 중 종료 등)은 커맨드가 알아서 거절/무시한다.
            MENU_START => {
                let _ = commands::show_quickstart(app.clone(), app.state::<Mutex<Measurement>>());
            }
            MENU_STOP => {
                let _ = commands::stop_session(app.clone(), app.state::<Mutex<Measurement>>());
            }
            MENU_PAUSE => {
                let _ = commands::toggle_pause(app.clone(), app.state::<Mutex<Measurement>>());
            }
            MENU_OVERLAY => {
                let _ = commands::toggle_overlay(app.clone());
            }
            MENU_DASHBOARD => show_main(app),
            MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // 좌클릭(Up) → 메인 창 표시·포커스.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// 메인 창을 최소화 해제 → 표시 → 포커스.
fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}
