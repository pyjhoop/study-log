import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSession } from "@/hooks/useSession";
import { useOverlayWindowPersistence } from "@/hooks/useOverlayWindow";
import { useOverlayOptions } from "@/hooks/useOverlayOptions";
import { usePomodoro } from "@/hooks/usePomodoro";
import { pauseSession, resumeSession, stopSession, onSessionSaved, onGoalChanged } from "@/lib/ipc";
import { getSubject } from "@/lib/subjects";
import { getSetting } from "@/lib/settings";
import { fetchTodaySec } from "@/lib/stats";
import { DAILY_GOAL_KEY, DEFAULT_DAILY_GOAL_MIN } from "@/hooks/useStats";
import { hexToRgba } from "@/lib/overlaySettings";
import { formatHMS } from "@/lib/time";
import { OverlayVariantView } from "@/components/overlay";
import type { OverlayViewModel } from "@/components/overlay";
import type { Subject } from "@/lib/types";

const PAUSED_COLOR = "#f59e0b"; // amber
const BREAK_COLOR = "#38bdf8"; // sky

/**
 * 타이머 오버레이 창(기획서 §8·10). 항상-위·테두리 없는 작은 창.
 *  - 이 컴포넌트는 **공유 데이터 계산 + 공유 크롬**(드래그 영역·미니 컨트롤·리사이즈 그립·항상위)을 담당하고,
 *    실제 레이아웃은 선택된 variant 컴포넌트(`components/overlay`)에 위임한다(알약/디지털/미니멀/링/막대/뽀모도로).
 *  - 색·투명도·글자·표시항목 옵션은 모든 variant가 공유한다(useOverlayOptions).
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

  // 목표% 또는 링/막대 variant일 때 오늘 누적·목표를 로드(세션 저장 시 갱신).
  const needGoal = options.show.goalPct || options.variant === "ring" || options.variant === "bar";
  const [todaySec, setTodaySec] = useState(0);
  const [goalMin, setGoalMin] = useState(DEFAULT_DAILY_GOAL_MIN);
  useEffect(() => {
    if (!needGoal) return;
    const unlisteners: Array<() => void> = [];
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
    // 세션 저장(누적 갱신) · 목표시간 변경(측정 중 설정 변경) 둘 다에 반응.
    const subscribe = (on: (h: () => void) => Promise<() => void>) => {
      void on(load).then((fn) => {
        if (cancelled) fn();
        else unlisteners.push(fn);
      });
    };
    subscribe(onSessionSaved);
    subscribe(onGoalChanged);
    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [needGoal]);

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
  const curSec = todaySec + (status !== "idle" ? elapsedSec : 0);
  const progressPct = needGoal && goalSec > 0 ? (curSec / goalSec) * 100 : null;
  if (options.show.goalPct && goalSec > 0) {
    parts.push(`목표 ${Math.round((curSec / goalSec) * 100)}%`);
  }
  const subline = parts.join(" · ");

  // 시간 문자열: 뽀모도로면 남은 시간, 아니면 경과 시간.
  const timeStr = formatHMS(pomo.active ? pomo.remainingSec : elapsedSec);
  const fontSize =
    options.fontMode === "fixed" ? `${options.fontSizePx}px` : "clamp(15px, 42vh, 44px)";
  const fontSizeBig =
    options.fontMode === "fixed"
      ? `${Math.round(options.fontSizePx * 1.6)}px`
      : "clamp(20px, 60vh, 96px)";

  const vm: OverlayViewModel = {
    timeStr,
    subline,
    timeColor,
    dotColor,
    textColor: options.textColor,
    bg: hexToRgba(options.bgColor, options.bgOpacity),
    fontSize,
    fontSizeBig,
    showDot: options.show.dot,
    showTime: options.show.time,
    isPaused,
    isBreak,
    progressPct,
    pomo,
  };

  const handleResizeGrip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void getCurrentWindow().startResizeDragging("SouthEast");
  };

  return (
    <div className="h-screen w-screen select-none">
      <div
        data-tauri-drag-region
        className="group relative h-full w-full overflow-hidden rounded-xl transition-colors"
      >
        {/* variant별 콘텐츠(드래그가 잡히도록 내부는 pointer-events-none) */}
        <OverlayVariantView variant={options.variant} vm={vm} />

        {/* 미니 컨트롤 (마우스 오버 시에만) */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute right-1.5 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
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
