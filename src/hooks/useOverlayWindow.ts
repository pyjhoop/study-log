import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getSetting, setSetting } from "@/lib/settings";

/** settings 테이블에 저장되는 오버레이 창 위치/크기(물리 픽셀). */
const GEOMETRY_KEY = "overlay_geometry";
interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 타이머 오버레이 창의 위치/크기를 settings에 저장하고 복원한다(기획서 §8-2 "위치·크기 복원").
 *  - 마운트 시: 저장된 값이 있으면 창에 적용(없으면 tauri.conf 기본값 유지).
 *  - 이후 이동/크기조절 이벤트를 디바운스해서 저장.
 * 창은 앱 시작 시(숨김 상태로) 생성돼 이 훅이 한 번 돌고, show()되면 복원된 위치에 나타난다.
 */
export function useOverlayWindowPersistence() {
  useEffect(() => {
    const win = getCurrentWindow();
    let unlistenMoved: (() => void) | undefined;
    let unlistenResized: (() => void) | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    // 복원 중 발생하는 move/resize 이벤트가 곧바로 되쓰지 않도록, 복원 완료 후에만 저장한다.
    let persistReady = false;
    let cancelled = false;

    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void (async () => {
          try {
            const pos = await win.outerPosition();
            const size = await win.innerSize();
            const geo: Geometry = { x: pos.x, y: pos.y, w: size.width, h: size.height };
            await setSetting(GEOMETRY_KEY, geo);
          } catch {
            /* 저장 실패는 무시 — 다음 이동/크기조절 때 다시 시도된다. */
          }
        })();
      }, 400);
    };

    void (async () => {
      try {
        const geo = await getSetting<Geometry>(GEOMETRY_KEY);
        if (geo && !cancelled) {
          await win.setSize(new PhysicalSize(geo.w, geo.h));
          await win.setPosition(new PhysicalPosition(geo.x, geo.y));
        }
      } catch {
        /* 최초 실행 등 저장값 없음 — 기본 위치/크기 사용. */
      }
      if (cancelled) return;
      persistReady = true;
      unlistenMoved = await win.onMoved(() => {
        if (persistReady) scheduleSave();
      });
      unlistenResized = await win.onResized(() => {
        if (persistReady) scheduleSave();
      });
    })();

    return () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      unlistenMoved?.();
      unlistenResized?.();
    };
  }, []);
}
