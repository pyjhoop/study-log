import { useState } from "react";
import { LayoutDashboard, ListChecks, BookOpen, Settings } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { SubjectsScreen } from "@/components/subjects/SubjectsScreen";
import { SessionTester } from "@/components/session/SessionTester";

type Screen = "dashboard" | "records" | "subjects" | "settings";

const NAV: { id: Screen; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "records", label: "기록", icon: ListChecks },
  { id: "subjects", label: "과목 관리", icon: BookOpen },
  { id: "settings", label: "설정", icon: Settings },
];

const PLACEHOLDER: Record<Screen, string> = {
  dashboard: "오늘 진행 · 일/주/월 통계 · 최근 세션이 여기에 표시됩니다.",
  records: "학습 세션 목록(수정/삭제/수동 추가)과 메모가 여기에 표시됩니다.",
  subjects: "과목 CRUD(이름/색/정렬/보관)가 여기에 표시됩니다.",
  settings: "핫키 · 오버레이 · 뽀모도로 · 목표시간 설정이 여기에 표시됩니다.",
};

export default function MainApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const active = NAV.find((n) => n.id === screen)!;

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
          ) : screen === "dashboard" ? (
            <SessionTester />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed">
              <div className="max-w-md text-center">
                <active.icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{PLACEHOLDER[screen]}</p>
              </div>
            </div>
          )}
        </section>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
