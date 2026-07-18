import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { PeriodStats } from "@/lib/stats";
import { formatDurationKo, formatSignedDurationKo } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * 선택한 기간의 학습 시간과 **직전 기간 대비 증감** 카드.
 * 진행 중인 기간은 지난 기간의 같은 시점(페이스)과, 완료 기간은 직전 기간 전체와 비교한다.
 */
export function ComparisonCard({ stats }: { stats: PeriodStats }) {
  const up = stats.deltaSec > 0;
  const down = stats.deltaSec < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = up ? "text-emerald-500" : down ? "text-rose-500" : "text-muted-foreground";
  const noBaseline = stats.previous === 0;
  const basis = stats.isCurrent ? "같은 시점" : "전체";

  return (
    <div className="flex flex-col rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-muted-foreground">{stats.relLabel}</span>
        {stats.isCurrent ? (
          <span className="text-xs text-muted-foreground">{stats.note}</span>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            완료
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{stats.title}</div>

      <div className="mt-2 text-3xl font-semibold tabular-nums">
        {formatDurationKo(stats.total)}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">세션 {stats.count}개</div>

      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {stats.prevRelLabel} {basis}
          <div className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
            {formatDurationKo(stats.previous)}
          </div>
        </div>

        <div className={cn("flex items-center gap-1.5 text-sm font-semibold", tone)}>
          <Icon className="h-4 w-4" />
          {noBaseline ? (
            <span>{stats.total > 0 ? "새 기록" : "기록 없음"}</span>
          ) : (
            <span className="tabular-nums">
              {formatSignedDurationKo(stats.deltaSec)}
              {stats.deltaPct !== null && (
                <span className="ml-1 text-xs">
                  ({stats.deltaPct > 0 ? "+" : ""}
                  {stats.deltaPct}%)
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
