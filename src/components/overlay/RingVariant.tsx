import type { OverlayViewModel } from "./types";

const DONE_COLOR = "#10b981"; // emerald

/**
 * 목표 진행 링: 오늘 목표 대비 진행을 원형 링으로 감싸고 가운데에 시간.
 * 대시보드 GoalRing의 SVG 패턴을 오버레이용으로 축약(viewBox로 창 크기에 맞춰 스케일).
 */
export function RingVariant({ vm }: { vm: OverlayViewModel }) {
  const pct = Math.max(0, Math.min(100, vm.progressPct ?? 0));
  const done = pct >= 100;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (circ * pct) / 100;
  const arcColor = done ? DONE_COLOR : vm.dotColor;

  return (
    <div
      className="pointer-events-none relative flex h-full w-full items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: vm.bg }}
    >
      <div className="relative flex aspect-square h-full max-h-full items-center justify-center p-1">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={8} />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <div className="absolute flex flex-col items-center leading-none">
          {vm.showTime && (
            <span
              className="font-mono font-semibold tabular-nums"
              style={{ fontSize: "clamp(9px, 15%, 20px)", color: vm.timeColor }}
            >
              {vm.timeStr}
            </span>
          )}
          {vm.progressPct != null && (
            <span
              className="mt-0.5 tabular-nums"
              style={{ fontSize: "clamp(7px, 11%, 13px)", color: vm.textColor, opacity: 0.75 }}
            >
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
