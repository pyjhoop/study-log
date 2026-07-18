import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_HOTKEYS,
  loadHotkeys,
  saveHotkeys,
  type HotkeyBindings,
} from "@/lib/hotkeys";
import { emitHotkeysChanged } from "@/lib/ipc";
import { Section, Row } from "./parts";
import { HotkeyCapture } from "./HotkeyCapture";

const ROWS: { key: keyof HotkeyBindings; label: string }[] = [
  { key: "start", label: "측정 시작 (피커)" },
  { key: "stop", label: "측정 종료" },
  { key: "pause", label: "일시정지 / 재개" },
  { key: "dashboard", label: "대시보드 열기" },
  { key: "overlay", label: "오버레이 숨김 / 표시" },
];

/** 중복 조합이 있으면 그 조합 문자열, 없으면 null. */
function findDuplicate(b: HotkeyBindings): string | null {
  const seen = new Set<string>();
  for (const { key } of ROWS) {
    const v = b[key];
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

/**
 * 전역 핫키 바인딩(기획서 §6). 각 기능의 조합을 캡처해 편집하고, 저장 시
 * `hotkeys-changed`로 메인 창이 재등록한다. 이미 점유된 조합은 재등록 때 toast로 안내된다.
 */
export function HotkeysSection() {
  const [binds, setBinds] = useState<HotkeyBindings>(DEFAULT_HOTKEYS);
  const [saved, setSaved] = useState<HotkeyBindings>(DEFAULT_HOTKEYS);

  useEffect(() => {
    void loadHotkeys()
      .then((b) => {
        setBinds(b);
        setSaved(b);
      })
      .catch((e) => console.error("[HotkeysSection] 설정 로드 실패", e));
  }, []);

  const dirty = JSON.stringify(binds) !== JSON.stringify(saved);

  const save = async () => {
    const dup = findDuplicate(binds);
    if (dup) {
      toast.error(`중복된 단축키가 있어요: ${dup}`);
      return;
    }
    try {
      await saveHotkeys(binds);
      setSaved(binds);
      await emitHotkeysChanged(); // 메인 창이 재등록 (점유 조합은 그쪽에서 안내)
      toast.success("단축키를 저장했어요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Section
      icon={Keyboard}
      title="전역 핫키"
      description="다른 앱을 쓰는 중에도 동작합니다. 조합을 바꾸고 저장하면 즉시 적용됩니다."
      action={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setBinds(DEFAULT_HOTKEYS)}>
            기본값
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={!dirty}>
            저장
          </Button>
        </div>
      }
    >
      {ROWS.map(({ key, label }) => (
        <Row key={key} label={label}>
          <HotkeyCapture
            value={binds[key]}
            onChange={(accel) => setBinds((b) => ({ ...b, [key]: accel }))}
          />
        </Row>
      ))}
    </Section>
  );
}
