import { useEffect, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/Switch";
import {
  DEFAULT_OVERLAY_OPTIONS,
  hexToRgba,
  loadOverlayOptions,
  saveOverlayOptions,
  type OverlayOptions,
  type OverlayShowItems,
} from "@/lib/overlaySettings";
import { cn } from "@/lib/utils";
import { Section, Row, NumberField } from "./parts";

const SHOW_LABELS: { key: keyof OverlayShowItems; label: string }[] = [
  { key: "time", label: "경과 시간" },
  { key: "subject", label: "과목명" },
  { key: "dot", label: "과목 색 점" },
  { key: "goalPct", label: "목표 대비 %" },
  { key: "pausedBadge", label: "일시정지 배지" },
];

/**
 * 오버레이 커스터마이즈(기획서 §10-3). 값을 바꾸면 즉시 저장 + `overlay-options-changed`로
 * 타이머 창에 바로 반영된다(측정 중이면 실시간 미리보기처럼 바뀜).
 */
export function OverlaySection() {
  const [opt, setOpt] = useState<OverlayOptions>(DEFAULT_OVERLAY_OPTIONS);

  useEffect(() => {
    void loadOverlayOptions().then(setOpt);
  }, []);

  const patch = async (next: Partial<OverlayOptions>) => {
    const merged = { ...opt, ...next };
    setOpt(merged);
    try {
      await saveOverlayOptions(merged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const patchShow = (key: keyof OverlayShowItems, v: boolean) =>
    void patch({ show: { ...opt.show, [key]: v } });

  return (
    <Section
      icon={MonitorSmartphone}
      title="오버레이"
      description="타이머 창의 색·투명도·글자·표시 항목을 바꿉니다. 변경은 즉시 반영됩니다."
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">항상 위</span>
          <Switch
            checked={opt.alwaysOnTop}
            onChange={(v) => void patch({ alwaysOnTop: v })}
            aria-label="항상 위"
          />
        </div>
      }
    >
      {/* 미리보기 */}
      <div className="flex justify-center rounded-lg border bg-[repeating-conic-gradient(#e5e7eb_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-4 dark:bg-[repeating-conic-gradient(#3f3f46_0_25%,transparent_0_50%)]">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 backdrop-blur-sm"
          style={{ backgroundColor: hexToRgba(opt.bgColor, opt.bgOpacity) }}
        >
          {opt.show.dot && <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />}
          <div className="flex flex-col leading-none">
            {opt.show.time && (
              <span
                className="font-mono font-semibold tabular-nums"
                style={{
                  color: opt.textColor,
                  fontSize: opt.fontMode === "fixed" ? `${opt.fontSizePx}px` : "20px",
                }}
              >
                00:25:00
              </span>
            )}
            <span
              className="mt-0.5 text-[10px]"
              style={{ color: opt.textColor, opacity: 0.7 }}
            >
              {[opt.show.subject && "영어", opt.show.goalPct && "목표 60%"]
                .filter(Boolean)
                .join(" · ") || " "}
            </span>
          </div>
        </div>
      </div>

      <Row label="배경 투명도">
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
          {opt.bgOpacity}%
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={opt.bgOpacity}
          onChange={(e) => void patch({ bgOpacity: Number(e.target.value) })}
          className="w-40 accent-primary"
          aria-label="배경 투명도"
        />
      </Row>

      <Row label="배경 색">
        <ColorInput value={opt.bgColor} onChange={(v) => void patch({ bgColor: v })} />
      </Row>
      <Row label="글자 색">
        <ColorInput value={opt.textColor} onChange={(v) => void patch({ textColor: v })} />
      </Row>

      <Row label="글자 크기">
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border text-xs">
            {(["auto", "fixed"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => void patch({ fontMode: mode })}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  opt.fontMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {mode === "auto" ? "창 비례" : "고정"}
              </button>
            ))}
          </div>
          <NumberField
            value={opt.fontSizePx}
            min={10}
            max={72}
            unit="px"
            disabled={opt.fontMode !== "fixed"}
            onCommit={(v) => void patch({ fontSizePx: v })}
          />
        </div>
      </Row>

      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">표시 항목</p>
        <div className="space-y-2.5">
          {SHOW_LABELS.map(({ key, label }) => (
            <Row key={key} label={label}>
              <Switch
                checked={opt.show[key]}
                onChange={(v) => patchShow(key, v)}
                aria-label={label}
              />
            </Row>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** 색상 선택기 + hex 표시. */
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-input bg-background"
        aria-label="색 선택"
      />
    </div>
  );
}
