import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { buildHeatmap, type HeatCell, type StatRow } from "@/lib/stats";
import { formatDayLabel, formatDurationKo } from "@/lib/time";
import { cn } from "@/lib/utils";

/** 화면에 그릴 주 수(약 1년). GitHub 잔디처럼 마지막 열이 이번 주. */
const WEEKS = 53;

/** 색 단계(0=없음 → 4=진함) → Tailwind 클래스. 앱 테마(teal) 기준, 라이트/다크 대응. */
const CELL_CLASS = [
  "bg-muted",
  "bg-teal-200 dark:bg-teal-900",
  "bg-teal-300 dark:bg-teal-700",
  "bg-teal-500 dark:bg-teal-500",
  "bg-teal-600 dark:bg-teal-300",
];

/** 요일 라벨(월=0). GitHub처럼 월·수·금만 표기. */
const WEEKDAY_LABELS = ["월", "", "수", "", "금", "", ""];

/**
 * 그날 공부 시간(초) → 색 단계(0~4).
 * 일일 목표가 설정돼 있으면 목표 대비 비율(50%/100%/150%)로, 없으면 절대 시간(30분/1시간/2시간)으로 나눈다.
 */
function levelFor(total: number, goalSec: number): number {
  if (total <= 0) return 0;
  if (goalSec <= 0) {
    if (total < 1800) return 1;
    if (total < 3600) return 2;
    if (total < 7200) return 3;
    return 4;
  }
  const r = total / goalSec;
  if (r < 0.5) return 1;
  if (r < 1) return 2;
  if (r < 1.5) return 3;
  return 4;
}

/** 대시보드 하단 학습 잔디: 최근 1년의 일별 학습 여부/강도를 GitHub 컨트리뷰션 그래프처럼 표시. */
export function ContributionHeatmap({
  rows,
  goalMin,
}: {
  rows: StatRow[];
  goalMin: number;
}) {
  const { weeks, months } = useMemo(() => buildHeatmap(rows, WEEKS), [rows]);
  const goalSec = goalMin * 60;
  const activeDays = useMemo(
    () => weeks.reduce((n, w) => n + w.filter((c) => c.total > 0).length, 0),
    [weeks],
  );

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          학습 잔디
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          최근 1년 {activeDays}일 학습
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* 월 라벨 */}
          <div className="flex">
            <div className="w-6 shrink-0" />
            <div className="flex gap-[3px]">
              {weeks.map((_, c) => {
                const label = months.find((m) => m.col === c)?.label ?? "";
                return (
                  <div
                    key={c}
                    className="w-[11px] whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 요일 라벨 + 잔디 격자 */}
          <div className="mt-1 flex">
            <div className="flex w-6 shrink-0 flex-col gap-[3px] pr-1 text-right">
              {WEEKDAY_LABELS.map((lbl, i) => (
                <div
                  key={i}
                  className="h-[11px] text-[9px] leading-[11px] text-muted-foreground"
                >
                  {lbl}
                </div>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, c) => (
                <div key={c} className="flex flex-col gap-[3px]">
                  {week.map((cell) => (
                    <Cell key={cell.key} cell={cell} goalSec={goalSec} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>적음</span>
        {CELL_CLASS.map((cls, i) => (
          <span key={i} className={cn("h-[11px] w-[11px] rounded-[2px]", cls)} />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}

function Cell({ cell, goalSec }: { cell: HeatCell; goalSec: number }) {
  if (!cell.inRange) {
    // 이번 주의 아직 오지 않은 날 — 자리만 비워 정렬 유지.
    return <div className="h-[11px] w-[11px]" />;
  }
  const lvl = levelFor(cell.total, goalSec);
  const time = cell.total > 0 ? formatDurationKo(cell.total) : "기록 없음";
  return (
    <div
      className={cn("h-[11px] w-[11px] rounded-[2px]", CELL_CLASS[lvl])}
      title={`${formatDayLabel(cell.sec)} · ${time}`}
    />
  );
}
