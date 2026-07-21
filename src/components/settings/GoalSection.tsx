import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { getSetting, setSetting } from "@/lib/settings";
import { emitGoalChanged } from "@/lib/ipc";
import { DAILY_GOAL_KEY, DEFAULT_DAILY_GOAL_MIN } from "@/hooks/useStats";
import { Section, Row, NumberField } from "./parts";

const PRESETS = [30, 60, 120, 180, 240];

/** 일일 목표시간(분) 설정. 대시보드 진행 링과 같은 키(daily_goal_min)를 쓴다. */
export function GoalSection() {
  const [goalMin, setGoalMin] = useState(DEFAULT_DAILY_GOAL_MIN);

  useEffect(() => {
    void getSetting<number>(DAILY_GOAL_KEY)
      .then((g) => {
        if (typeof g === "number" && g > 0) setGoalMin(g);
      })
      .catch((e) => console.error("[GoalSection] 설정 로드 실패", e));
  }, []);

  const save = async (min: number) => {
    setGoalMin(min);
    try {
      await setSetting(DAILY_GOAL_KEY, min);
      void emitGoalChanged(); // 오버레이·대시보드 즉시 반영(측정 중이어도)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Section
      icon={Target}
      title="일일 목표시간"
      description="대시보드 오늘 진행 링과 오버레이 목표% 표시에 쓰입니다."
    >
      <Row label="하루 목표" hint="0~1440분">
        <NumberField value={goalMin} min={0} max={1440} unit="분" onCommit={(v) => void save(v)} />
      </Row>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => void save(m)}
            className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {m >= 60 ? `${m / 60}시간` : `${m}분`}
          </button>
        ))}
      </div>
    </Section>
  );
}
