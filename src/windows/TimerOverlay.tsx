import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSession } from "@/hooks/useSession";
import { useOverlayWindowPersistence } from "@/hooks/useOverlayWindow";
import { useOverlayOptions } from "@/hooks/useOverlayOptions";
import { usePomodoro } from "@/hooks/usePomodoro";
import { pauseSession, resumeSession, stopSession, onSessionSaved } from "@/lib/ipc";
import { getSubject } from "@/lib/subjects";
import { getSetting } from "@/lib/settings";
import { fetchTodaySec } from "@/lib/stats";
import { DAILY_GOAL_KEY, DEFAULT_DAILY_GOAL_MIN } from "@/hooks/useStats";
import { hexToRgba } from "@/lib/overlaySettings";
import { formatHMS } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Subject } from "@/lib/types";

const PAUSED_COLOR = "#f59e0b"; // amber
const BREAK_COLOR = "#38bdf8"; // sky

/**
 * 타이머 오버레이 창(기획서 §8·10). 항상-위·테두리 없는 작은 알약.
 *  - 표시: 경과 시간(또는 뽀모도로 남은 시간) + 과목 색점/이름/목표% — 설정(오버레이 커스터마이즈)으로 토글.
 *  - 외형: 배경색/투명도·글자색·글자크기·항상위를 설정에서 즉시 반영(useOverlayOptions).
 *  - 뽀모도로: 켜져 있으면 남은 시간 카운트다운 + 사이클(집중N/휴식) 표시, 전환은 usePomodoro가 담당.
 *  - 이동/크기조절/미니 컨트롤/위치 복원은 단계 3과 동일.
 * 표시/숨김 자체는 Rust가 측정 시작/종료 시 자동 처리한다.
 */
export default function TimerOverlay() {
  const { snapshot, status, subjectId, elapsedSec } = useSession();
  const [subject, setSubject] = useState<Subject | null>(null);
  const options = useOverlayOptions();
  const pomo = usePomodoro({
    status,
    startedAt: snapshot?.started_at ?? null,
    elapsedSec,
  });
  useOverlayWindowPersistence();

  // 측정 중인 과목 정보(색·이름) 로드.
  useEffect(() => {
    if (subjectId == null) {
      setSubject(null);
      return;
    }
    let cancelled = false;
    void getSubject(subjectId)
      .then((s) => {
        if (!cancelled) setSubject(s);
      })
      .catch(() => {
        /* 조회 실패는 무시 — 시간만 표시된다. */
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  // 항상 위 on/off를 옵션 변경 시 즉시 반영.
  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(options.alwaysOnTop).catch(() => {});
  }, [options.alwaysOnTop]);

  // 목표% 표시가 켜진 경우에만 오늘 누적·목표를 로드(세션 저장 시 갱신).
  const [todaySec, setTodaySec] = useState(0);
  const [goalMin, setGoalMin] = useState(DEFAULT_DAILY_GOAL_MIN);
  useEffect(() => {
    if (!options.show.goalPct) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const load = () => {
      void fetchTodaySec()
        .then((s) => !cancelled && setTodaySec(s))
        .catch(() => {});
      void getSetting<number>(DAILY_GOAL_KEY)
        .then((g) => !cancelled && typeof g === "number" && g > 0 && setGoalMin(g))
        .catch(() => {});
    };
    load();
    void onSessionSaved(load).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [options.show.goalPct]);

  const isPaused = status === "paused";
  const isBreak = pomo.active && pomo.phase === "break";

  // 색: 휴식(뽀모도로) > 일시정지 > 기본(설정 글자색/과목색).
  const timeColor = isBreak ? BREAK_COLOR : isPaused ? PAUSED_COLOR : options.textColor;
  const dotColor = isBreak
    ? BREAK_COLOR
    : isPaused
      ? PAUSED_COLOR
      : (subject?.color ?? "#10b981");

  // 서브라인(상태/사이클 · 과목 · 목표%) 조립.
  const parts: string[] = [];
  if (pomo.active) parts.push(pomo.label);
  else if (isPaused && options.show.pausedBadge) parts.push("일시정지");
  if (options.show.subject && subject) parts.push(subject.name);
  const goalSec = goalMin * 60;
  if (options.show.goalPct && goalSec > 0) {
    const cur = todaySec + (status !== "idle" ? elapsedSec : 0);
    parts.push(`목표 ${Math.round((cur / goalSec) * 100)}%`);
  }
  const subline = parts.join(" · ");

  // 시간 문자열: 뽀모도로면 남은 시간, 아니면 경과 시간.
  const timeStr = formatHMS(pomo.active ? pomo.remainingSec : elapsedSec);
  const fontSize = options.fontMode === "fixed" ? `${options.fontSizePx}px` : "clamp(15px, 42vh, 44px)";

  const handleResizeGrip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void getCurrentWindow().startResizeDragging("SouthEast");
  };

  return (
    <div className="h-screen w-screen select-none">
      <div
        data-tauri-drag-region
        className="group relative flex h-full w-full items-center gap-2 overflow-hidden rounded-xl px-3 backdrop-blur-sm transition-colors"
        style={{ backgroundColor: hexToRgba(options.bgColor, options.bgOpacity) }}
      >
        {/* 과목 색점 (일시정지/휴식 시 상태색 + 깜빡임) */}
        {options.show.dot && (
          <span
            className={cn(
              "pointer-events-none h-2.5 w-2.5 shrink-0 rounded-full",
              (isPaused || isBreak) && "animate-pulse",
            )}
            style={{ backgroundColor: dotColor }}
          />
        )}

        {/* 시간 + 서브라인 (드래그가 잡히도록 pointer-events 차단) */}
        <div className="pointer-events-none flex min-w-0 flex-col leading-none">
          {options.show.time && (
            <span
              className="font-mono font-semibold tabular-nums"
              style={{ fontSize, color: timeColor }}
            >
              {timeStr}
            </span>
          )}
          {subline && (
            <span
              className="mt-0.5 max-w-[45vw] truncate text-[10px]"
              style={{ color: options.textColor, opacity: 0.7 }}
            >
              {subline}
            </span>
          )}
        </div>

        {/* 미니 컨트롤 (마우스 오버 시에만) */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1 pl-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          {isPaused ? (
            <OverlayButton title="재개" onClick={() => void resumeSession().catch(() => {})}>
              <Play className="h-3.5 w-3.5" />
            </OverlayButton>
          ) : status === "running" ? (
            <OverlayButton title="일시정지" onClick={() => void pauseSession().catch(() => {})}>
              <Pause className="h-3.5 w-3.5" />
            </OverlayButton>
          ) : null}
          <OverlayButton title="종료" onClick={() => void stopSession().catch(() => {})}>
            <Square className="h-3.5 w-3.5" />
          </OverlayButton>
        </div>

        {/* 우하단 크기조절 그립 */}
        <span
          onMouseDown={handleResizeGrip}
          title="크기 조절"
          className="pointer-events-auto absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize opacity-0 group-hover:opacity-70"
          style={{
            background: "linear-gradient(135deg, transparent 55%, rgba(255,255,255,0.85) 55%)",
          }}
        />
      </div>
    </div>
  );
}

/** 오버레이용 작은 아이콘 버튼(드래그 영역과 겹치지 않게 pointer-events 활성). */
function OverlayButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 text-white/90 transition-colors hover:bg-white/30"
    >
      {children}
    </button>
  );
}
