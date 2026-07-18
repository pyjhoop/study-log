import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSession } from "@/hooks/useSession";
import { useOverlayWindowPersistence } from "@/hooks/useOverlayWindow";
import { pauseSession, resumeSession, stopSession } from "@/lib/ipc";
import { getSubject } from "@/lib/subjects";
import { formatHMS } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Subject } from "@/lib/types";

/**
 * 타이머 오버레이 창(기획서 §8). 항상-위·테두리 없는 작은 알약.
 *  - 표시: 경과 시간 HH:MM:SS + 과목 색점/이름, 일시정지 시 색 변경·깜빡임.
 *  - 이동: 알약 전체가 드래그 영역(`data-tauri-drag-region`). 텍스트는 pointer-events 차단해 뒤 영역이 잡히게.
 *  - 크기조절: 우하단 그립에서 `startResizeDragging`.
 *  - 미니 컨트롤: 마우스 오버 시에만 일시정지/재개·종료 버튼 노출.
 *  - 위치/크기는 useOverlayWindowPersistence가 settings에 저장/복원.
 * 표시/숨김 자체는 Rust가 측정 시작/종료 시 자동 처리한다.
 */
export default function TimerOverlay() {
  const { status, subjectId, elapsedSec } = useSession();
  const [subject, setSubject] = useState<Subject | null>(null);
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

  const isPaused = status === "paused";
  const dotColor = subject?.color ?? "#10b981";

  const handleResizeGrip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void getCurrentWindow().startResizeDragging("SouthEast");
  };

  return (
    <div className="h-screen w-screen select-none">
      <div
        data-tauri-drag-region
        className={cn(
          "group relative flex h-full w-full items-center gap-2 overflow-hidden rounded-xl px-3 text-white backdrop-blur-sm transition-colors",
          isPaused ? "bg-black/55" : "bg-black/70",
        )}
      >
        {/* 과목 색점 (일시정지 시 앰버 + 깜빡임) */}
        <span
          className={cn(
            "pointer-events-none h-2.5 w-2.5 shrink-0 rounded-full",
            isPaused && "animate-pulse",
          )}
          style={{ backgroundColor: isPaused ? "#f59e0b" : dotColor }}
        />

        {/* 경과 시간 + 과목명 (드래그가 잡히도록 pointer-events 차단) */}
        <div className="pointer-events-none flex min-w-0 flex-col leading-none">
          <span
            className={cn(
              "font-mono font-semibold tabular-nums",
              isPaused && "text-amber-300",
            )}
            style={{ fontSize: "clamp(15px, 42vh, 44px)" }}
          >
            {formatHMS(elapsedSec)}
          </span>
          {subject && (
            <span className="mt-0.5 max-w-[45vw] truncate text-[10px] text-white/70">
              {isPaused ? "일시정지 · " : ""}
              {subject.name}
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
