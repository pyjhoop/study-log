import { useMemo } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { StatBucket } from "@/lib/stats";
import { formatDurationKo, formatSignedDurationKo } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * 기간별 통계 기록 표. 최근 기간이 위로 오고, 각 행은 학습 시간·세션 수와
 * **직전(더 이전) 기간 대비 증감**을 보여준다. 진행 중인 이번 기간은 '진행 중'으로 표시하고
 * 증감은 생략한다(완료 기간이 아니어서 완료 기간과 비교하면 오해 소지).
 * 행을 클릭하면 그 기간으로 초점을 옮긴다.
 */
export function PeriodTable({
  buckets,
  onSelect,
}: {
  buckets: StatBucket[];
  onSelect: (offset: number) => void;
}) {
  // 직전 기간 대비 증감(bucket.prevTotal은 창 밖이어도 실제 직전 기간 합계라 경계에서 안 끊긴다).
  // 기록이 아예 없던 직전 기간(0)과의 비교는 의미가 약하므로 증감을 생략한다.
  const rows = useMemo(
    () =>
      buckets
        .map((b) => ({ bucket: b, delta: b.prevTotal > 0 ? b.total - b.prevTotal : null }))
        .reverse(),
    [buckets],
  );

  const hasAny = buckets.some((b) => b.total > 0);
  if (!hasAny) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="py-8 text-center text-sm text-muted-foreground">
          이 범위에 기록된 통계가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">기간</th>
            <th className="px-4 py-2.5 text-right font-medium">학습 시간</th>
            <th className="px-4 py-2.5 text-right font-medium">세션</th>
            <th className="px-4 py-2.5 text-right font-medium">증감</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ bucket, delta }) => (
            <tr
              key={bucket.key}
              onClick={() => onSelect(bucket.offset)}
              className={cn(
                "cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/50",
                bucket.isFocused && "bg-primary/5",
              )}
            >
              <td className="px-4 py-2.5">
                <span className="font-medium">{bucket.tooltip}</span>
                {bucket.isCurrent && (
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    진행 중
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {bucket.total > 0 ? formatDurationKo(bucket.total) : "—"}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                {bucket.count > 0 ? bucket.count : "—"}
              </td>
              <td className="px-4 py-2.5 text-right">
                {bucket.isCurrent || delta === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <DeltaBadge delta={delta} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const up = delta > 0;
  const down = delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = up ? "text-emerald-500" : down ? "text-rose-500" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center justify-end gap-1 tabular-nums", tone)}>
      <Icon className="h-3.5 w-3.5" />
      {formatSignedDurationKo(delta)}
    </span>
  );
}
