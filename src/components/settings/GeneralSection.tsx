import { useEffect, useState } from "react";
import { PanelsTopLeft, RefreshCw } from "lucide-react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/Switch";
import { emitCheckUpdate } from "@/lib/ipc";
import { Section, Row } from "./parts";

/**
 * 일반 설정: Windows 자동 시작 토글(F2) + 트레이 상주 동작 안내.
 * 창 닫기 동작은 트레이 상주로 고정이라 설명만 둔다(기획서 §10-2).
 */
export function GeneralSection() {
  const [autostart, setAutostart] = useState(false);
  const [busy, setBusy] = useState(true);

  // 마운트 시 현재 자동 시작 등록 여부를 읽어 초기값으로.
  useEffect(() => {
    isEnabled()
      .then((v) => setAutostart(v))
      .catch(console.error)
      .finally(() => setBusy(false));
  }, []);

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) await enable();
      else await disable();
      setAutostart(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // 수동 업데이트 확인 요청 → 메인 창의 UpdateDialog가 확인/팝업/안내를 처리한다.
  const [checking, setChecking] = useState(false);
  const checkUpdate = async () => {
    setChecking(true);
    try {
      await emitCheckUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      // 실제 확인은 비동기라, 버튼은 잠깐만 비활성(중복 클릭 방지) 후 되돌린다.
      setTimeout(() => setChecking(false), 1500);
    }
  };

  return (
    <Section icon={PanelsTopLeft} title="일반" description="자동 시작 · 트레이 상주 동작">
      <Row
        label="Windows 시작 시 자동 실행"
        hint="부팅하면 창을 띄우지 않고 트레이에 조용히 상주합니다(핫키·측정 대기)."
      >
        <Switch
          checked={autostart}
          onChange={toggle}
          disabled={busy}
          aria-label="Windows 시작 시 자동 실행"
        />
      </Row>
      <Row
        label="업데이트"
        hint="시작할 때 자동으로 새 버전을 확인합니다. 여기서 지금 바로 확인할 수도 있어요."
      >
        <Button variant="outline" size="sm" onClick={() => void checkUpdate()} disabled={checking}>
          <RefreshCw className={checking ? "animate-spin" : ""} />
          업데이트 확인
        </Button>
      </Row>
      <ul className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
        <li>· 창을 닫아도(X) 종료되지 않고 <b className="text-foreground">트레이로 숨겨</b> 백그라운드에서 계속 동작합니다.</li>
        <li>· 트레이 아이콘 <b className="text-foreground">좌클릭</b>으로 창을 다시 열고, <b className="text-foreground">우클릭 메뉴</b>로 측정·오버레이를 제어할 수 있습니다.</li>
        <li>· 숨겨진 동안에도 <b className="text-foreground">전역 핫키</b>는 그대로 동작합니다.</li>
        <li>· 완전히 끄려면 트레이 메뉴의 <b className="text-foreground">종료</b>를 누르세요.</li>
      </ul>
    </Section>
  );
}
