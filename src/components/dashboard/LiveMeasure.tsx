import { useState } from "react";
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useSubjects } from "@/hooks/useSubjects";
import { requestFocusMain } from "@/lib/ipc";
import { formatHMS } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * 대시보드 측정 컨트롤. 빠른 시작 피커가 핫키 전용이라, 마우스만으로도
 * 과목을 골라 측정을 시작/일시정지/종료할 수 있게 한다(상태는 Rust 단일 소스 구독).
 */
export function LiveMeasure() {
  const { status, subjectId, elapsedSec, start, pause, resume, stop } = useSession();
  const { subjects, loading, error: subjectsError } = useSubjects();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isIdle = status === "idle";
  const isRunning = status === "running";
  const isPaused = status === "paused";

  const activeSubject = subjects.find((s) => s.id === subjectId);
  const startId = selectedId ?? subjects[0]?.id ?? null;
  const noSubjects = subjects.length === 0;

  async function guard(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const handleStart = () =>
    guard(async () => {
      if (startId == null) return;
      await start(startId);
    });

  // 종료만 트리거 — 저장·토스트는 메인 창의 useSessionRecorder가 일원화해 처리한다.
  const handleStop = () => guard(async () => void (await stop()));

  return (
    <div className="flex flex-col rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">측정</span>
        <StatusBadge status={status} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div
          className={cn(
            "font-mono text-4xl font-semibold tabular-nums tracking-tight",
            isPaused && "text-amber-500",
          )}
        >
          {formatHMS(elapsedSec)}
        </div>
        <div className="mt-1 h-5 text-sm text-muted-foreground">
          {isIdle ? "대기 중" : (activeSubject?.name ?? "과목")}
        </div>
      </div>

      {isIdle ? (
        subjectsError ? (
          // 로드 실패를 "과목 없음" 빈 상태로 오인시키지 않도록 에러를 명시한다.
          <p className="text-center text-xs text-destructive">
            과목을 불러오지 못했어요: {subjectsError}
          </p>
        ) : noSubjects ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs text-muted-foreground">
              측정하려면 먼저 과목을 만들어 주세요.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void requestFocusMain("subjects")}
            >
              과목 관리 열기
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={startId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              disabled={loading}
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button onClick={handleStart} disabled={busy}>
              <Play /> 시작
            </Button>
          </div>
        )
      ) : (
        <div className="flex gap-2">
          {isRunning ? (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => guard(pause)}
              disabled={busy}
            >
              <Pause /> 일시정지
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => guard(resume)}
              disabled={busy}
            >
              <RotateCcw /> 재개
            </Button>
          )}
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleStop}
            disabled={busy}
          >
            <Square /> 종료
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "idle" | "running" | "paused" }) {
  const map = {
    idle: { label: "대기", cls: "text-muted-foreground" },
    running: { label: "측정 중", cls: "text-emerald-500" },
    paused: { label: "일시정지", cls: "text-amber-500" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cls)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full bg-current",
          status === "running" && "animate-pulse",
        )}
      />
      {label}
    </span>
  );
}
