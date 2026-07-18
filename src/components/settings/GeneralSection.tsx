import { PanelsTopLeft } from "lucide-react";
import { Section } from "./parts";

/** 일반(트레이 동작 안내). 창 닫기 동작은 트레이 상주로 고정이라 설명만 둔다(기획서 §10-2). */
export function GeneralSection() {
  return (
    <Section icon={PanelsTopLeft} title="일반" description="트레이 상주 동작">
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li>· 창을 닫아도(X) 종료되지 않고 <b className="text-foreground">트레이로 숨겨</b> 백그라운드에서 계속 동작합니다.</li>
        <li>· 트레이 아이콘 <b className="text-foreground">좌클릭</b>으로 창을 다시 열고, <b className="text-foreground">우클릭 메뉴</b>로 측정·오버레이를 제어할 수 있습니다.</li>
        <li>· 숨겨진 동안에도 <b className="text-foreground">전역 핫키</b>는 그대로 동작합니다.</li>
        <li>· 완전히 끄려면 트레이 메뉴의 <b className="text-foreground">종료</b>를 누르세요.</li>
      </ul>
    </Section>
  );
}
