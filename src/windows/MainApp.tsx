import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, BarChart3, ListChecks, BookOpen, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { SubjectsScreen } from "@/components/subjects/SubjectsScreen";
import { RecordsScreen } from "@/components/records/RecordsScreen";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { StatsScreen } from "@/components/stats/StatsScreen";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useTray } from "@/hooks/useTray";
import { onFocusMain } from "@/lib/ipc";

type Screen = "dashboard" | "stats" | "records" | "subjects" | "settings";

const NAV: { id: Screen; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "stats", label: "통계", icon: BarChart3 },
  { id: "records", label: "기록", icon: ListChecks },
  { id: "subjects", label: "과목 관리", icon: BookOpen },
  { id: "settings", label: "설정", icon: Settings },
];

const SCREENS: Screen[] = ["dashboard", "stats", "records", "subjects", "settings"];

export default function MainApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const active = NAV.find((n) => n.id === screen)!;

  // 측정 종료 요약을 받아 세션을 저장하는 단일 리스너(오버레이/핫키/트레이 종료 모두 여기로).
  useSessionRecorder();
  // 트레이 툴팁을 측정 상태에 맞춰 갱신(트레이 자체는 Rust가 소유).
  useTray();

  // 메인 창을 표시·포커스하고(대시보드 핫키·피커 유도) 선택 화면으로 전환한다.
  const focusMain = useCallback((next?: Screen) => {
    const win = getCurrentWindow();
    void win.unminimize().catch(() => {});
    void win.show().catch(() => {});
    void win.setFocus().catch(() => {});
    if (next) setScreen(next);
  }, []);

  // 대시보드 핫키(Ctrl+Alt+D): 메인 창 표시·포커스 + 대시보드 화면.
  const onDashboard = useCallback(() => focusMain("dashboard"), [focusMain]);
  useGlobalShortcuts(onDashboard);

  // 다른 창(피커 등)의 `focus-main` 요청 처리 — 표시·포커스(+화면 전환).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void onFocusMain(({ screen: next }) => {
      focusMain(SCREENS.includes(next as Screen) ? (next as Screen) : undefined);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [focusMain]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 사이드바 */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card/40 p-3">
        <div className="mb-6 px-2 pt-2">
          <h1 className="text-lg font-semibold tracking-tight">학습기록</h1>
          <p className="text-xs text-muted-foreground">Study Log</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setScreen(id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                screen === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 text-[10px] text-muted-foreground">v0.1.0</div>
      </aside>

      {/* 콘텐츠 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b px-6">
          <h2 className="text-base font-semibold">{active.label}</h2>
        </header>
        <section className="flex-1 overflow-auto p-6">
          {screen === "subjects" ? (
            <SubjectsScreen />
          ) : screen === "records" ? (
            <RecordsScreen />
          ) : screen === "dashboard" ? (
            <DashboardScreen />
          ) : screen === "stats" ? (
            <StatsScreen />
          ) : (
            <SettingsScreen />
          )}
        </section>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
