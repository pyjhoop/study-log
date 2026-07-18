import { useEffect, useRef, useState } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { pauseSession, resumeSession } from "@/lib/ipc";
import { DEFAULT_POMODORO, loadPomodoro, type PomodoroConfig } from "@/lib/pomodoro";
import { nowSec } from "@/lib/time";
import type { SessionStatus } from "@/lib/types";

/** 오버레이가 그릴 뽀모도로 표시 상태. */
export interface PomodoroView {
  /** 뽀모도로가 켜져 있고 측정이 진행 중이라 카운트다운을 보여야 하는지. */
  active: boolean;
  phase: "focus" | "break";
  breakKind: "short" | "long";
  /** 현재 집중 회차(1-based). 휴식 중이면 방금 끝낸 회차. */
  cycle: number;
  /** 현재 구간 남은 시간(초). */
  remainingSec: number;
  /** 오버레이 라벨. 예: `집중 3` / `휴식` / `긴 휴식`. */
  label: string;
}

const INACTIVE: PomodoroView = {
  active: false,
  phase: "focus",
  breakKind: "short",
  cycle: 1,
  remainingSec: 0,
  label: "집중 1",
};

/** 전환 알림(설정에서 껐으면 무시). 권한이 없으면 한 번 요청한다. */
async function notify(cfg: PomodoroConfig, title: string, body: string): Promise<void> {
  if (!cfg.notify) return;
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    /* 알림 실패는 무시 — 전환 자체는 계속된다. */
  }
}

/**
 * 뽀모도로 컨트롤러(기획서 §10-1). **타이머(오버레이) 창에서만** 마운트한다.
 * 측정 창은 집중 중 항상 표시되므로(일시정지=휴식도 표시 유지) 타이머가 죽지 않고,
 * 다른 앱에 포커스가 있어도 이 창의 타이머는 스로틀되지 않아 전환이 안정적이다.
 *
 * **모델**: 휴식 = 측정 세션의 자동 일시정지. 집중 목표시간만큼 공부가 쌓이면 pause(휴식 시작),
 * 휴식 시간이 지나면 resume(다음 집중). 세션 하나의 duration이 곧 집중 시간 합계가 된다.
 * 컨트롤러 진행 상태는 메모리에만 있으므로, 측정 중 창 리로드 시 현재 집중 블록부터 새로 센다(허용 오차).
 */
export function usePomodoro(args: {
  status: SessionStatus;
  startedAt: number | null;
  elapsedSec: number;
}): PomodoroView {
  const cfgRef = useRef<PomodoroConfig>(DEFAULT_POMODORO);
  // 컨트롤러 진행 상태(틱에서 직접 읽고 쓴다 — 렌더 유발 없이).
  const ctl = useRef({
    runId: null as number | null,
    phase: "focus" as "focus" | "break",
    breakKind: "short" as "short" | "long",
    /** 현재 집중 블록 시작 시점의 누적 공부 초. */
    blockStartStudy: 0,
    /** 현재 휴식 시작 벽시계(epoch sec). */
    breakStartWall: 0,
    completedFocus: 0,
  });
  // 최신 세션 값을 틱이 읽도록 ref에 흘려둔다(interval을 매번 다시 걸지 않기 위해).
  const live = useRef(args);
  live.current = args;

  const [view, setView] = useState<PomodoroView>(INACTIVE);

  // 마운트 시 설정 로드.
  useEffect(() => {
    let cancelled = false;
    void loadPomodoro().then((cfg) => {
      if (!cancelled) cfgRef.current = cfg;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 새 세션이 시작되면 컨트롤러 리셋 + 설정 재로드(세션 사이 설정 변경 반영).
  useEffect(() => {
    if (args.startedAt == null) return;
    void loadPomodoro().then((cfg) => {
      cfgRef.current = cfg;
    });
    ctl.current = {
      runId: args.startedAt,
      phase: "focus",
      breakKind: "short",
      blockStartStudy: 0,
      breakStartWall: 0,
      completedFocus: 0,
    };
  }, [args.startedAt]);

  // 1초 틱: 전환 판정 + 남은 시간 계산.
  useEffect(() => {
    const tick = () => {
      const cfg = cfgRef.current;
      const { status, startedAt, elapsedSec } = live.current;

      if (!cfg.enabled || startedAt == null || status === "idle") {
        setView((v) => (v.active ? INACTIVE : v)); // 비활성이면 재렌더 안 함
        return;
      }

      const s = ctl.current;
      const focusTarget = Math.max(1, cfg.focusMin) * 60;

      if (s.phase === "focus") {
        const blockElapsed = elapsedSec - s.blockStartStudy;
        // 집중 목표 달성 → 휴식 시작(자동 일시정지). 정지 상태에선 elapsed가 멈추므로 running일 때만.
        if (status === "running" && blockElapsed >= focusTarget) {
          s.completedFocus += 1;
          s.breakKind =
            s.completedFocus % Math.max(1, cfg.cyclesUntilLong) === 0 ? "long" : "short";
          s.phase = "break";
          s.breakStartWall = nowSec();
          void pauseSession().catch(() => {});
          void notify(
            cfg,
            "집중 완료 🎉",
            s.breakKind === "long" ? "긴 휴식 시간이에요." : "잠깐 휴식하세요.",
          );
        }
      } else {
        const breakTarget =
          (s.breakKind === "long" ? cfg.longBreakMin : cfg.shortBreakMin) * 60;
        const breakElapsed = nowSec() - s.breakStartWall;
        // 휴식 종료 → 다음 집중(자동 재개).
        if (breakElapsed >= Math.max(1, breakTarget)) {
          s.phase = "focus";
          s.blockStartStudy = elapsedSec; // 정지 중 멈춰 있던 누적 공부 = 이 블록 시작점
          void resumeSession().catch(() => {});
          void notify(cfg, "휴식 종료", "다시 집중해볼까요?");
        }
      }

      // 표시값 계산.
      let remainingSec: number;
      let label: string;
      if (s.phase === "focus") {
        remainingSec = Math.max(0, focusTarget - (elapsedSec - s.blockStartStudy));
        label = `집중 ${s.completedFocus + 1}`;
      } else {
        const breakTarget =
          (s.breakKind === "long" ? cfg.longBreakMin : cfg.shortBreakMin) * 60;
        remainingSec = Math.max(0, breakTarget - (nowSec() - s.breakStartWall));
        label = s.breakKind === "long" ? "긴 휴식" : "휴식";
      }
      setView({
        active: true,
        phase: s.phase,
        breakKind: s.breakKind,
        cycle: s.completedFocus + (s.phase === "focus" ? 1 : 0),
        remainingSec,
        label,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return view;
}
