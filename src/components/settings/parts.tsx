import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** 설정 섹션 카드(제목 · 설명 · 우측 액션 · 본문). */
export function Section({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** 라벨(+힌트) 좌 · 컨트롤 우 한 줄. */
export function Row({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** 숫자 입력(문자열 버퍼로 편집, blur/Enter에 clamp 커밋). */
export function NumberField({
  value,
  min,
  max,
  unit,
  disabled,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [buf, setBuf] = useState(String(value));
  useEffect(() => setBuf(String(value)), [value]);

  const commit = () => {
    const n = Number(buf);
    const v = Number.isFinite(n) ? clamp(Math.round(n), min, max) : value;
    setBuf(String(v));
    if (v !== value) onCommit(v);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        value={buf}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => setBuf(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      {unit && <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>}
    </div>
  );
}
