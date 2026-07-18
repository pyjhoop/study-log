import type { OverlayViewModel } from "./types";

/**
 * 뽀모도로: 사이클 라벨(집중 N / 휴식) + 남은 시간을 크게. 뽀모도로 모드에 최적화.
 * 뽀모도로가 꺼져 있으면 경과 시간(vm.timeStr)으로 자연 폴백해 깨지지 않는다.
 */
export function PomodoroVariant({ vm }: { vm: OverlayViewModel }) {
  const topLabel = vm.pomo.active ? vm.pomo.label : vm.subline || "측정 중";

  return (
    <div
      className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-0.5 px-3 backdrop-blur-sm"
      style={{ backgroundColor: vm.bg }}
    >
      <span
        className="flex items-center gap-1 truncate text-[11px] font-medium uppercase tracking-wide"
        style={{ color: vm.timeColor, opacity: 0.85 }}
      >
        {vm.showDot && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: vm.dotColor }}
          />
        )}
        {topLabel}
      </span>
      {vm.showTime && (
        <span
          className="font-mono font-bold leading-none tabular-nums"
          style={{ fontSize: vm.fontSizeBig, color: vm.timeColor }}
        >
          {vm.timeStr}
        </span>
      )}
    </div>
  );
}
