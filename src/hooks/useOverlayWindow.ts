import { useEffect } from "react";
import { availableMonitors, getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
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

/** 최소 이만큼(px)은 어떤 모니터와 겹쳐 보여야 "화면 안"으로 본다. */
const MIN_VISIBLE = 24;

/**
 * 저장된 물리 좌표가 현재 연결된 모니터 중 어디와도 겹치지 않으면(그 모니터가 분리·재배치됨)
 * 창이 화면 밖에서 실종된다. 그 경우 주 모니터 중앙으로 되돌린 값을 준다.
 */
async function clampToMonitors(geo: Geometry): Promise<Geometry> {
  try {
    const monitors = await availableMonitors();
    if (!monitors.length) return geo;
    const visible = monitors.some((m) => {
      const { x: mx, y: my } = m.position;
      const { width: mw, height: mh } = m.size;
      return (
        geo.x + geo.w > mx + MIN_VISIBLE &&
        geo.x < mx + mw - MIN_VISIBLE &&
        geo.y + geo.h > my + MIN_VISIBLE &&
        geo.y < my + mh - MIN_VISIBLE
      );
    });
    if (visible) return geo;
    const primary = (await primaryMonitor()) ?? monitors[0];
    const w = Math.min(geo.w, primary.size.width);
    const h = Math.min(geo.h, primary.size.height);
    return {
      w,
      h,
      x: Math.round(primary.position.x + (primary.size.width - w) / 2),
      y: Math.round(primary.position.y + (primary.size.height - h) / 2),
    };
  } catch {
    return geo; // 모니터 조회 실패 시 원값 유지
  }
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
        const saved = await getSetting<Geometry>(GEOMETRY_KEY);
        if (saved && !cancelled) {
          const geo = await clampToMonitors(saved);
          if (!cancelled) {
            await win.setSize(new PhysicalSize(geo.w, geo.h));
            await win.setPosition(new PhysicalPosition(geo.x, geo.y));
          }
        }
      } catch {
        /* 최초 실행 등 저장값 없음 — 기본 위치/크기 사용. */
      }
      if (cancelled) return;
      persistReady = true;
      // await 후 언마운트됐을 수 있으므로 등록 즉시 정리한다(리스너 누수 방지).
      const moved = await win.onMoved(() => {
        if (persistReady) scheduleSave();
      });
      if (cancelled) moved();
      else unlistenMoved = moved;
      const resized = await win.onResized(() => {
        if (persistReady) scheduleSave();
      });
      if (cancelled) resized();
      else unlistenResized = resized;
    })();

    return () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      unlistenMoved?.();
      unlistenResized?.();
    };
  }, []);
}
