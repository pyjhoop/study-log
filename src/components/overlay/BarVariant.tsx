import { cn } from "@/lib/utils";
import type { OverlayViewModel } from "./types";

const DONE_COLOR = "#10b981"; // emerald

/** 진행 막대: 알약과 비슷하되 하단에 목표 대비 진행 막대를 얇게 깐다. */
export function BarVariant({ vm }: { vm: OverlayViewModel }) {
  const pct = vm.progressPct == null ? null : Math.max(0, Math.min(100, vm.progressPct));
  const fillColor = pct != null && pct >= 100 ? DONE_COLOR : vm.dotColor;

  return (
    <div
      className="pointer-events-none relative flex h-full w-full items-center gap-2 px-3 pb-1.5 backdrop-blur-sm"
      style={{ backgroundColor: vm.bg }}
    >
      {vm.showDot && (
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            (vm.isPaused || vm.isBreak) && "animate-pulse",
          )}
          style={{ backgroundColor: vm.dotColor }}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col leading-none">
        {vm.showTime && (
          <span
            className="font-mono font-semibold tabular-nums"
            style={{ fontSize: vm.fontSize, color: vm.timeColor }}
          >
            {vm.timeStr}
          </span>
        )}
        {vm.subline && (
          <span className="mt-0.5 truncate text-[10px]" style={{ color: vm.textColor, opacity: 0.7 }}>
            {vm.subline}
          </span>
        )}
      </div>

      {/* 하단 진행 막대 */}
      <div className="absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct ?? 0}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}
