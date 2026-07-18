import { useEffect, useRef } from "react";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { toast } from "sonner";
import { showQuickstart, stopSession, togglePause, toggleOverlay, onHotkeysChanged } from "@/lib/ipc";
import { loadHotkeys } from "@/lib/hotkeys";

/**
 * 전역 핫키 등록 훅(기획서 §6). **메인 창에서 한 번만** 마운트한다.
 * settings의 바인딩을 읽어 5종 단축키를 register하고, 각 핸들러는 상태 판단을 Rust에 위임한다:
 *  - 시작:  show_quickstart (Idle 가드는 Rust)
 *  - 종료:  stop_session (Idle이면 Rust가 거절 → 무시)
 *  - 정지:  toggle_pause (Idle이면 Rust가 거절 → 무시)
 *  - 대시보드: onDashboard (메인 창 표시·포커스)
 *  - 오버레이: toggle_overlay
 *
 * 설정 화면에서 바인딩을 바꾸면 `hotkeys-changed` 이벤트로 재등록하고, 이미 점유된 조합은
 * toast로 안내한다(최초 마운트 시 실패는 console.warn만 — 起動 소음 방지).
 *
 * @param onDashboard 대시보드 핫키 동작(메인 창을 자기 자신으로 표시·포커스).
 */
export function useGlobalShortcuts(onDashboard: () => void) {
  // 최신 콜백을 ref로 흘려 effect를 재실행하지 않고도 최신 동작을 부른다.
  const onDashRef = useRef(onDashboard);
  onDashRef.current = onDashboard;

  useEffect(() => {
    // StrictMode(개발) 이중 마운트/비동기 경쟁 대비.
    let active = true;

    const registerAll = async (announce: boolean) => {
      const binds = await loadHotkeys();
      await unregisterAll().catch(() => {});

      // global-shortcut 콜백은 Pressed/Released 양쪽에서 불리므로 Pressed만 처리한다.
      const entries: [string, () => void][] = [
        [binds.start, () => void showQuickstart().catch(() => {})],
        [binds.stop, () => void stopSession().catch(() => {})],
        [binds.pause, () => void togglePause().catch(() => {})],
        [binds.dashboard, () => onDashRef.current()],
        [binds.overlay, () => void toggleOverlay().catch(() => {})],
      ];

      const failed: string[] = [];
      for (const [accel, action] of entries) {
        if (!active) return;
        try {
          await register(accel, (event) => {
            if (event.state === "Pressed") action();
          });
        } catch (e) {
          // 이미 다른 앱이 점유한 조합 → 등록 실패.
          failed.push(accel);
          console.warn(`전역 핫키 등록 실패: ${accel}`, e);
        }
      }
      if (announce && failed.length) {
        toast.error(`이미 사용 중인 단축키: ${failed.join(", ")}`);
      }
    };

    void registerAll(false);

    // 설정 화면에서 바인딩을 바꾸면 재등록(실패 시 toast).
    let unlisten: (() => void) | undefined;
    void onHotkeysChanged(() => void registerAll(true)).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });

    return () => {
      active = false;
      unlisten?.();
      void unregisterAll().catch(() => {});
    };
  }, []);
}
