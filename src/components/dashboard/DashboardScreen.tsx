import { useMemo, useState } from "react";
import { CalendarDays, Clock, Flame, History } from "lucide-react";
import { useStats } from "@/hooks/useStats";
import {
  buildBuckets,
  computeStreak,
  periodTotals,
  rangeStart,
  subjectBreakdown,
  type Granularity,
  type StatRow,
} from "@/lib/stats";
import { formatClock, formatDurationKo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { GoalRing } from "./GoalRing";
import { LiveMeasure } from "./LiveMeasure";
import { StudyBarChart } from "./StudyBarChart";
import { SubjectDonut } from "./SubjectDonut";

/** 대시보드: 측정 컨트롤 · 오늘 목표 링 · 요약 · 일/주/월 추이 · 과목별 분포 · 최근 세션. */
export function DashboardScreen() {
  const { rows, goalMin, loading, error, saveGoal } = useStats();
  const [granularity, setGranularity] = useState<Granularity>("day");

  const totals = useMemo(() => periodTotals(rows), [rows]);
  const streak = useMemo(() => computeStreak(rows), [rows]);
  const buckets = useMemo(() => buildBuckets(rows, granularity), [rows, granularity]);
  const slices = useMemo(
    () => subjectBreakdown(rows, rangeStart(granularity)),
    [rows, granularity],
  );
  const recent = useMemo(() => rows.slice(-6).reverse(), [rows]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        통계를 불러오지 못했습니다: {error}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* 측정 + 오늘 목표 링 */}
      <div className="grid gap-4 md:grid-cols-2">
        <LiveMeasure />
        <GoalRing todaySec={totals.today} goalMin={goalMin} onSaveGoal={saveGoal} />
      </div>

      {/* 요약 타일 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Clock} label="오늘" value={formatDurationKo(totals.today)} />
        <StatTile icon={CalendarDays} label="이번 주" value={formatDurationKo(totals.week)} />
        <StatTile icon={CalendarDays} label="이번 달" value={formatDurationKo(totals.month)} />
        <StatTile
          icon={Flame}
          label="연속 학습"
          value={streak > 0 ? `${streak}일` : "0일"}
          accent={streak > 0}
        />
      </div>

      {/* 일/주/월 추이 */}
      <StudyBarChart
        buckets={buckets}
        granularity={granularity}
        onGranularityChange={setGranularity}
      />

      {/* 과목별 분포 + 최근 세션 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SubjectDonut slices={slices} />
        <RecentSessions sessions={recent} loading={loading} />
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", accent && "text-orange-500")}>
        {value}
      </div>
    </div>
  );
}

function RecentSessions({
  sessions,
  loading,
}: {
  sessions: StatRow[];
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <History className="h-4 w-4" />
        최근 세션
      </div>
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : sessions.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          아직 기록된 세션이 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.subject_color }}
              />
              <span className="min-w-0 flex-1 truncate">{s.subject_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatClock(s.started_at)}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums">
                {formatDurationKo(s.duration_sec)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
