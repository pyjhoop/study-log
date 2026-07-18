import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/Switch";
import {
  DEFAULT_POMODORO,
  loadPomodoro,
  savePomodoro,
  type PomodoroConfig,
} from "@/lib/pomodoro";
import { Section, Row, NumberField } from "./parts";

/**
 * 뽀모도로 설정. 켜면 다음 측정부터 오버레이가 남은 시간 카운트다운 + 사이클을 표시하고,
 * 집중/휴식이 자동 전환된다(휴식은 측정의 자동 일시정지로 처리 → 집중 시간만 적립).
 */
export function PomodoroSection() {
  const [cfg, setCfg] = useState<PomodoroConfig>(DEFAULT_POMODORO);

  useEffect(() => {
    void loadPomodoro().then(setCfg);
  }, []);

  const patch = async (next: Partial<PomodoroConfig>) => {
    const merged = { ...cfg, ...next };
    setCfg(merged);
    try {
      await savePomodoro(merged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const disabled = !cfg.enabled;

  return (
    <Section
      icon={Timer}
      title="뽀모도로"
      description="집중/휴식을 번갈아 진행하고 전환 시 알림을 보냅니다. 집중 시간만 기록에 쌓입니다."
      action={
        <Switch
          checked={cfg.enabled}
          onChange={(v) => void patch({ enabled: v })}
          aria-label="뽀모도로 사용"
        />
      }
    >
      <Row label="집중 길이">
        <NumberField
          value={cfg.focusMin}
          min={1}
          max={180}
          unit="분"
          disabled={disabled}
          onCommit={(v) => void patch({ focusMin: v })}
        />
      </Row>
      <Row label="짧은 휴식">
        <NumberField
          value={cfg.shortBreakMin}
          min={1}
          max={60}
          unit="분"
          disabled={disabled}
          onCommit={(v) => void patch({ shortBreakMin: v })}
        />
      </Row>
      <Row label="긴 휴식">
        <NumberField
          value={cfg.longBreakMin}
          min={1}
          max={90}
          unit="분"
          disabled={disabled}
          onCommit={(v) => void patch({ longBreakMin: v })}
        />
      </Row>
      <Row label="긴 휴식 주기" hint="집중 N번마다 긴 휴식">
        <NumberField
          value={cfg.cyclesUntilLong}
          min={1}
          max={12}
          unit="회"
          disabled={disabled}
          onCommit={(v) => void patch({ cyclesUntilLong: v })}
        />
      </Row>
      <Row label="전환 알림" hint="집중/휴식 전환 시 데스크톱 알림">
        <Switch
          checked={cfg.notify}
          onChange={(v) => void patch({ notify: v })}
          disabled={disabled}
          aria-label="전환 알림"
        />
      </Row>
    </Section>
  );
}
