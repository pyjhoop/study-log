import { GoalSection } from "./GoalSection";
import { PomodoroSection } from "./PomodoroSection";
import { OverlaySection } from "./OverlaySection";
import { HotkeysSection } from "./HotkeysSection";
import { BackupSection } from "./BackupSection";
import { GeneralSection } from "./GeneralSection";

/**
 * 설정 화면(기획서 §3 + v2). 목표시간 · 뽀모도로 · 오버레이 · 전역 핫키 · GitHub 백업 · 일반(트레이)을
 * 카드 섹션으로 쌓는다. 각 섹션이 자기 설정 키를 직접 로드/저장한다.
 */
export function SettingsScreen() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <GoalSection />
      <PomodoroSection />
      <OverlaySection />
      <HotkeysSection />
      <BackupSection />
      <GeneralSection />
    </div>
  );
}
