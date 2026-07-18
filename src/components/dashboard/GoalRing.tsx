import { useEffect, useState } from "react";
import { Check, Pencil, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDurationKo } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * 오늘 진행 링. 오늘 누적 학습시간 ÷ 일일 목표를 SVG 도넛으로 그리고,
 * 가운데에 누적/목표·달성률을 보여준다. 목표는 연필 버튼으로 즉석 편집(설정 화면과 동일 키).
 */
export function GoalRing({
  todaySec,
  goalMin,
  onSaveGoal,
}: {
  todaySec: number;
  goalMin: number;
  onSaveGoal: (min: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const goalSec = goalMin * 60;
  const ratio = goalSec > 0 ? todaySec / goalSec : 0;
  const pct = Math.round(ratio * 100);
  const done = goalSec > 0 && todaySec >= goalSec;

  // SVG 링 기하값.
  const size = 176;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, Math.max(0, ratio));

  return (
    <div className="flex flex-col items-center rounded-xl border bg-card p-5">
      <div className="mb-3 flex w-full items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Target className="h-4 w-4" />
          오늘 진행
        </span>
        {!editing && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setEditing(true)}
            aria-label="목표 시간 수정"
            className="text-muted-foreground"
          >
            <Pencil />
          </Button>
        )}
      </div>

      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={done ? "hsl(142 71% 45%)" : "hsl(var(--primary))"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-semibold tabular-nums">{formatDurationKo(todaySec)}</span>
          <span className="mt-0.5 text-xs text-muted-foreground">
            목표 {formatDurationKo(goalSec)}
          </span>
          <span
            className={cn(
              "mt-1 text-sm font-semibold tabular-nums",
              done ? "text-emerald-500" : "text-primary",
            )}
          >
            {goalSec > 0 ? `${pct}%` : "목표 없음"}
          </span>
        </div>
      </div>

      <div className="mt-3 h-9 w-full">
        {editing ? (
          <GoalEditor
            initialMin={goalMin}
            onCancel={() => setEditing(false)}
            onSave={async (min) => {
              await onSaveGoal(min);
              setEditing(false);
            }}
          />
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {done ? "🎉 오늘 목표를 달성했어요!" : "목표를 향해 달리는 중"}
          </p>
        )}
      </div>
    </div>
  );
}

const PRESETS = [30, 60, 120, 180, 240];

function GoalEditor({
  initialMin,
  onCancel,
  onSave,
}: {
  initialMin: number;
  onCancel: () => void;
  onSave: (min: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(initialMin));
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(String(initialMin)), [initialMin]);

  const submit = async () => {
    const min = Number(value);
    if (!Number.isFinite(min) || min < 0) return;
    setSaving(true);
    try {
      await onSave(min);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={1440}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") onCancel();
          }}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="shrink-0 text-xs text-muted-foreground">분</span>
        <Button size="iconSm" onClick={() => void submit()} disabled={saving} aria-label="저장">
          <Check />
        </Button>
        <Button variant="ghost" size="iconSm" onClick={onCancel} aria-label="취소">
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => setValue(String(m))}
            className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {m >= 60 ? `${m / 60}시간` : `${m}분`}
          </button>
        ))}
      </div>
    </div>
  );
}
