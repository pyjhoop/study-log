import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import type { SubjectSlice } from "@/lib/stats";
import { formatDurationKo } from "@/lib/time";

/** 선택 기간의 과목별 학습 분포(도넛 + 범례). */
export function SubjectDonut({ slices }: { slices: SubjectSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <PieIcon className="h-4 w-4" />
        과목별 분포
      </div>

      {total === 0 ? (
        <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
          이 기간에 기록된 학습이 없습니다.
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-[160px] w-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.subject_id} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
            {slices.map((s) => {
              const pct = Math.round((s.total / total) * 100);
              return (
                <li key={s.subject_id} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatDurationKo(s.total)}
                  </span>
                  <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
