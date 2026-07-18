import { useState } from "react";
import { Play, Pause, Square, RotateCcw, Circle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useSubjects } from "@/hooks/useSubjects";
import { saveSession } from "@/lib/sessions";
import { formatHMS } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * 단계 2 임시 측정 검증 패널. 실제 오버레이/대시보드는 단계 3·6에서 만든다.
 * 여기서는 Rust 측정 엔진(시작/일시정지/재개/종료 + session-changed 이벤트)이
 * 정상 동작하는지, 종료 시 세션이 DB에 저장되는지를 확인한다.
 */
export function SessionTester() {
  const { status, subjectId, elapsedSec, start, pause, resume, stop } = useSession();
  const { subjects, loading } = useSubjects();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isIdle = status === "idle";
  const isRunning = status === "running";
  const isPaused = status === "paused";

  const activeSubject = subjects.find((s) => s.id === subjectId);
  // 시작용 선택값: 명시 선택이 없으면 첫 과목을 기본으로.
  const startId = selectedId ?? subjects[0]?.id ?? null;

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
      if (startId == null) {
        toast.error("먼저 과목을 만들어 주세요. (과목 관리 탭)");
        return;
      }
      await start(startId);
    });

  const handleStop = () =>
    guard(async () => {
      const summary = await stop();
      const saved = await saveSession(summary);
      const name = subjects.find((s) => s.id === summary.subject_id)?.name ?? "과목";
      if (saved) {
        toast.success(`세션 저장: ${name} · ${formatHMS(summary.duration_sec)}`);
      } else {
        toast.info("공부 시간이 0초여서 저장하지 않았습니다.");
      }
    });

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 rounded-xl border bg-card/40 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">측정 (단계 2 검증)</h3>
        <StatusBadge status={status} />
      </div>

      {/* 경과 시간 */}
      <div className="text-center">
        <div
          className={cn(
            "font-mono text-5xl font-semibold tabular-nums tracking-tight",
            isPaused && "text-muted-foreground",
          )}
        >
          {formatHMS(elapsedSec)}
        </div>
        <div className="mt-1 h-5 text-sm text-muted-foreground">
          {isIdle ? "대기 중" : (activeSubject?.name ?? "과목")}
        </div>
      </div>

      {/* 컨트롤 */}
      {isIdle ? (
        <div className="flex flex-col gap-3">
          <select
            value={startId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            disabled={loading || subjects.length === 0}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {subjects.length === 0 ? (
              <option value="">과목 없음 — 과목 관리에서 추가</option>
            ) : (
              subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            )}
          </select>
          <Button onClick={handleStart} disabled={busy || subjects.length === 0}>
            <Play /> 측정 시작
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {isRunning ? (
            <Button variant="secondary" className="flex-1" onClick={() => guard(pause)} disabled={busy}>
              <Pause /> 일시정지
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1" onClick={() => guard(resume)} disabled={busy}>
              <RotateCcw /> 재개
            </Button>
          )}
          <Button variant="destructive" className="flex-1" onClick={handleStop} disabled={busy}>
            <Square /> 종료
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        상태는 Rust가 단일 소스로 관리하며, 창을 새로 열거나 새로고침해도 복구됩니다.
      </p>
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
      <Circle className={cn("h-2 w-2 fill-current", status === "running" && "animate-pulse")} />
      {label}
    </span>
  );
}
