import { useEffect } from "react";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getSessionState, onSessionChanged } from "@/lib/ipc";
import { getSubject } from "@/lib/subjects";
import type { SessionSnapshot } from "@/lib/types";

/** Rust가 만든 트레이의 고정 id(tray.rs TRAY_ID와 일치). */
const TRAY_ID = "main-tray";

/**
 * 트레이 툴팁을 측정 상태에 맞춰 갱신한다(기획서 §10-2 "측정 중이면 툴팁에 과목 표시").
 * **메인 창에서 한 번만** 마운트. 트레이 자체(메뉴/클릭/종료 정책)는 Rust가 소유하고,
 * 여기서는 과목 이름(DB)이 필요한 툴팁만 JS에서 얹는다. (경과 초까지 실시간 반영하진 않는다.)
 */
export function useTray() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const apply = async (snap: SessionSnapshot) => {
      let tooltip = "학습기록";
      if (snap.status !== "idle" && snap.subject_id != null) {
        const name = (await getSubject(snap.subject_id))?.name ?? "과목";
        const label = snap.status === "paused" ? "일시정지" : "측정 중";
        tooltip = `${label} · ${name}`;
      }
      try {
        const tray = await TrayIcon.getById(TRAY_ID);
        await tray?.setTooltip(tooltip);
      } catch {
        /* 트레이가 아직 없거나 실패 — 다음 상태 변경 때 다시 시도된다. */
      }
    };

    void getSessionState()
      .then((s) => {
        if (!cancelled) void apply(s);
      })
      .catch(() => {});

    void onSessionChanged((s) => void apply(s)).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
