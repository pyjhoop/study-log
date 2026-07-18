import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { PaceComparison } from "@/lib/stats";
import { formatDurationKo, formatSignedDurationKo } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * 진행 중인 이번 기간을 지난 기간의 **같은 시점**과 비교한 증감 카드(페이스).
 * 상단에 현재 누적, 하단에 지난 기간 같은 시점 누적과 증감(시간·%).
 */
export function ComparisonCard({ cmp }: { cmp: PaceComparison }) {
  const up = cmp.deltaSec > 0;
  const down = cmp.deltaSec < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = up ? "text-emerald-500" : down ? "text-rose-500" : "text-muted-foreground";

  // 지난 기간에 기록이 없으면 비율이 무의미 — 문구로 대체.
  const noBaseline = cmp.previous === 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-muted-foreground">{cmp.currentLabel}</span>
        <span className="text-xs text-muted-foreground">{cmp.pointNote}</span>
      </div>

      <div className="mt-1 text-3xl font-semibold tabular-nums">
        {formatDurationKo(cmp.current)}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {cmp.previousLabel} 같은 시점
          <div className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
            {formatDurationKo(cmp.previous)}
          </div>
        </div>

        <div className={cn("flex items-center gap-1.5 text-sm font-semibold", tone)}>
          <Icon className="h-4 w-4" />
          {noBaseline ? (
            <span>{cmp.current > 0 ? "새 기록" : "기록 없음"}</span>
          ) : (
            <span className="tabular-nums">
              {formatSignedDurationKo(cmp.deltaSec)}
              {cmp.deltaPct !== null && (
                <span className="ml-1 text-xs">
                  ({cmp.deltaPct > 0 ? "+" : ""}
                  {cmp.deltaPct}%)
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
