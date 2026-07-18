import { useEffect } from "react";
import {
  register,
  unregisterAll,
} from "@tauri-apps/plugin-global-shortcut";
import { showQuickstart, stopSession, togglePause, toggleOverlay } from "@/lib/ipc";
import { loadHotkeys } from "@/lib/hotkeys";

/**
 * 전역 핫키 등록 훅(기획서 §6). **메인 창에서 한 번만** 마운트한다.
 * settings의 바인딩을 읽어 5종 단축키를 register하고, 각 핸들러는:
 *  - 시작:  show_quickstart (Idle 가드는 Rust)
 *  - 종료:  stop_session (Idle이면 Rust가 거절 → 무시)
 *  - 정지:  toggle_pause (Idle이면 Rust가 거절 → 무시)
 *  - 대시보드: onDashboard (메인 창 표시·포커스)
 *  - 오버레이: toggle_overlay
 * 모든 상태 판단을 Rust에 위임했기 때문에 핸들러는 정적이고 JS가 측정 상태를 추적할 필요가 없다.
 *
 * @param onDashboard 대시보드 핫키 동작(메인 창을 자기 자신으로 표시·포커스). 안정적인 참조여야 함.
 */
export function useGlobalShortcuts(onDashboard: () => void) {
  useEffect(() => {
    // StrictMode(개발) 이중 마운트/비동기 경쟁 대비 — 이 실행이 취소되면 register를 건너뛴다.
    let active = true;

    void (async () => {
      const binds = await loadHotkeys();
      // 깨끗한 상태에서 다시 등록(리로드/재마운트 시 중복 방지).
      await unregisterAll().catch(() => {});

      // global-shortcut 콜백은 Pressed/Released 양쪽에서 불리므로 Pressed만 처리한다.
      const bindings: [string, () => void][] = [
        [binds.start, () => void showQuickstart().catch(() => {})],
        [binds.stop, () => void stopSession().catch(() => {})],
        [binds.pause, () => void togglePause().catch(() => {})],
        [binds.dashboard, onDashboard],
        [binds.overlay, () => void toggleOverlay().catch(() => {})],
      ];

      for (const [accel, action] of bindings) {
        if (!active) return;
        try {
          await register(accel, (event) => {
            if (event.state === "Pressed") action();
          });
        } catch (e) {
          // 이미 다른 앱이 점유한 조합 → 등록 실패. 사용자 안내(재바인딩)는 단계 7 설정 화면에서.
          console.warn(`전역 핫키 등록 실패: ${accel}`, e);
        }
      }
    })();

    return () => {
      active = false;
      void unregisterAll().catch(() => {});
    };
  }, [onDashboard]);
}
