import { cn } from "@/lib/utils";
import type { OverlayViewModel } from "./types";

/** 기본 알약: 색점 + (시간 · 서브라인) 가로 배치. v2까지의 오버레이 레이아웃. */
export function PillVariant({ vm }: { vm: OverlayViewModel }) {
  return (
    <div
      className="pointer-events-none flex h-full w-full items-center gap-2 px-3 backdrop-blur-sm"
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
    </div>
  );
}
