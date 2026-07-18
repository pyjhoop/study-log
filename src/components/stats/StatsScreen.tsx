import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStats } from "@/hooks/useStats";
import {
  buildBuckets,
  focusedStats,
  subjectBreakdown,
  type Granularity,
} from "@/lib/stats";
import { Button } from "@/components/ui/button";
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
 * 통계 페이지: 일간/주간/월간을 고르고 **좌우 화살표로 기간을 이동**하며
 * ①그 기간의 학습 시간·직전 대비 증감 ②과목별 분포 ③기간별 추이 막대 ④기간별 통계 기록 표를 본다.
 * 화살표/표 클릭으로 초점 기간(offset)이 바뀌면 아래가 모두 그 기간을 반영한다.
 */
export function StatsScreen() {
  const { rows, loading, error } = useStats();
  const [granularity, setGranularity] = useState<Granularity>("week");
  // 초점 기간: 0 = 현재(오늘/이번주/이번달), 1 = 직전 …
  const [offset, setOffset] = useState(0);
  const count = STATS_COUNT[granularity];

  const changeGranularity = (g: Granularity) => {
    setGranularity(g);
    setOffset(0); // 단위가 바뀌면 현재 기간으로 복귀
  };

  const stats = useMemo(() => focusedStats(rows, granularity, offset), [rows, granularity, offset]);
  const buckets = useMemo(
    () => buildBuckets(rows, granularity, count, offset),
    [rows, granularity, count, offset],
  );
  const slices = useMemo(
    () => subjectBreakdown(rows, stats.startSec, stats.endSec),
    [rows, stats.startSec, stats.endSec],
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
          {loading ? "불러오는 중…" : "기간을 이동하며 학습 통계와 지난 기간 대비 증감을 확인하세요"}
        </p>
        <div className="flex rounded-md border p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => changeGranularity(t.id)}
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

      {/* 기간 네비게이터 (좌우 화살표) */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOffset((o) => o + 1)}
          aria-label="이전 기간"
        >
          <ChevronLeft />
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold">{stats.relLabel}</span>
          <span className="text-xs text-muted-foreground">{stats.title}</span>
        </div>

        <div className="flex items-center gap-1">
          {offset > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
              현재로
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={!stats.canGoNewer}
            aria-label="다음 기간"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* 선택 기간 증감 + 과목별 분포 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ComparisonCard stats={stats} />
        <SubjectDonut slices={slices} />
      </div>

      {/* 기간별 추이 (초점 기간에서 끝나는 창) */}
      <StudyBarChart
        buckets={buckets}
        granularity={granularity}
        onGranularityChange={changeGranularity}
        title="기간별 학습 시간"
        showToggle={false}
      />

      {/* 기간별 통계 기록 (행 클릭 시 그 기간으로 이동) */}
      <PeriodTable buckets={buckets} onSelect={setOffset} />
    </div>
  );
}
