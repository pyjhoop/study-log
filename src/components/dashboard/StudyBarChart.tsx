import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { Granularity, StatBucket } from "@/lib/stats";
import { formatDurationKo } from "@/lib/time";
import { cn } from "@/lib/utils";

const TABS: { id: Granularity; label: string }[] = [
  { id: "day", label: "일" },
  { id: "week", label: "주" },
  { id: "month", label: "월" },
];

/** 일/주/월 학습 시간 추이 막대 차트. total(초)을 분 단위 막대로 그린다. */
export function StudyBarChart({
  buckets,
  granularity,
  onGranularityChange,
  title = "학습 시간 추이",
  showToggle = true,
}: {
  buckets: StatBucket[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  title?: string;
  /** 헤더의 일/주/월 토글 표시 여부(페이지가 토글을 따로 두면 false). */
  showToggle?: boolean;
}) {
  const data = useMemo(
    () => buckets.map((b) => ({ ...b, minutes: Math.round(b.total / 60) })),
    [buckets],
  );
  const hasAny = buckets.some((b) => b.total > 0);
  // 막대가 많으면 X축 라벨을 솎아 겹치지 않게 한다(예: 30일 → 대략 8개 라벨).
  const tickInterval = Math.max(0, Math.floor(data.length / 12));

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          {title}
        </span>
        {showToggle && (
          <div className="flex rounded-md border p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => onGranularityChange(t.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  granularity === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-[220px] w-full">
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                interval={tickInterval}
              />
              <YAxis
                width={34}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(m: number) => (m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`)}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={<ChartTooltip />}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {data.map((d) => (
                  <Cell
                    key={d.key}
                    fill="hsl(var(--primary))"
                    fillOpacity={d.isFocused ? 1 : 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            이 기간에 기록된 학습이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

/** 커스텀 툴팁 — 버킷 tooltip 라벨 + 사람이 읽는 시간. */
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: StatBucket }[];
}) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium">{b.tooltip}</div>
      <div className="text-muted-foreground">
        {b.total > 0 ? formatDurationKo(b.total) : "기록 없음"}
      </div>
    </div>
  );
}
