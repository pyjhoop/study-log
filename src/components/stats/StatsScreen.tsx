import { useMemo, useState } from "react";
import { useStats } from "@/hooks/useStats";
import {
  buildBuckets,
  paceComparison,
  rangeStart,
  subjectBreakdown,
  type Granularity,
} from "@/lib/stats";
import { StudyBarChart } from "@/components/dashboard/StudyBarChart";
import { SubjectDonut } from "@/components/dashboard/SubjectDonut";
import { cn } from "@/lib/utils";
import { ComparisonCard } from "./ComparisonCard";
import { PeriodTable } from "./PeriodTable";

const TABS: { id: Granularity; label: string }[] = [
  { id: "day", label: "일간" },
  { id: "week", label: "주간" },
  { id: "month", label: "월간" },
];

/** 통계 페이지에서 보여줄 기간 개수(대시보드보다 길게). */
const STATS_COUNT: Record<Granularity, number> = { day: 30, week: 12, month: 12 };

/**
 * 통계 페이지: 일간/주간/월간을 전환하며 ①지난 기간 같은 시점 대비 증감(페이스)
 * ②기간별 추이 막대 ③기간별 통계 기록 표 ④과목별 분포를 본다.
 */
export function StatsScreen() {
  const { rows, loading, error } = useStats();
  const [granularity, setGranularity] = useState<Granularity>("week");
  const count = STATS_COUNT[granularity];

  const cmp = useMemo(() => paceComparison(rows, granularity), [rows, granularity]);
  const buckets = useMemo(
    () => buildBuckets(rows, granularity, count),
    [rows, granularity, count],
  );
  const slices = useMemo(
    () => subjectBreakdown(rows, rangeStart(granularity, count)),
    [rows, granularity, count],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        통계를 불러오지 못했습니다: {error}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* 기간 단위 전환 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "불러오는 중…" : "기간별 학습 통계와 지난 기간 대비 증감"}
        </p>
        <div className="flex rounded-md border p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setGranularity(t.id)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                granularity === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 증감(페이스) + 과목별 분포 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ComparisonCard cmp={cmp} />
        <SubjectDonut slices={slices} />
      </div>

      {/* 기간별 추이 */}
      <StudyBarChart
        buckets={buckets}
        granularity={granularity}
        onGranularityChange={setGranularity}
        title="기간별 학습 시간"
        showToggle={false}
      />

      {/* 기간별 통계 기록 */}
      <PeriodTable buckets={buckets} />
    </div>
  );
}
