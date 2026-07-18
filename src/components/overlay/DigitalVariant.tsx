import type { OverlayViewModel } from "./types";

/** 디지털 시계: 시간을 크게 중앙에, 서브라인은 작게 아래. 멀리서도 잘 보인다. */
export function DigitalVariant({ vm }: { vm: OverlayViewModel }) {
  return (
    <div
      className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-0.5 px-3 backdrop-blur-sm"
      style={{ backgroundColor: vm.bg }}
    >
      {vm.showTime && (
        <span
          className="font-mono font-bold leading-none tabular-nums"
          style={{ fontSize: vm.fontSizeBig, color: vm.timeColor }}
        >
          {vm.timeStr}
        </span>
      )}
      {vm.subline && (
        <span className="truncate text-[11px]" style={{ color: vm.textColor, opacity: 0.75 }}>
          {vm.subline}
        </span>
      )}
    </div>
  );
}
