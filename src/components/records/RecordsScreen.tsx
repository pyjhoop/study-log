import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSessions } from "@/hooks/useSessions";
import { useSubjects } from "@/hooks/useSubjects";
import { createSession, updateSession, deleteSession } from "@/lib/sessions";
import { formatClock, formatDayLabel, formatDurationKo } from "@/lib/time";
import type { SessionInput, SessionWithSubject } from "@/lib/types";
import { SessionEditor } from "./SessionEditor";

/** 일별로 묶은 세션 그룹(최근 날짜부터). */
interface DayGroup {
  key: string;
  total: number;
  items: SessionWithSubject[];
}

function groupByDay(sessions: SessionWithSubject[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const s of sessions) {
    const key = formatDayLabel(s.started_at);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, total: 0, items: [] };
      groups.push(g);
    }
    g.items.push(s);
    g.total += s.duration_sec;
  }
  return groups;
}

export function RecordsScreen() {
  const { sessions, loading, error, reload } = useSessions();
  // 편집 시 과목 선택에는 보관 과목도 포함(과거 세션이 보관 과목에 속할 수 있음).
  const { subjects } = useSubjects(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SessionWithSubject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SessionWithSubject | null>(null);

  const groups = useMemo(() => groupByDay(sessions), [sessions]);

  const openCreate = () => {
    setEditTarget(null);
    setEditorOpen(true);
  };
  const openEdit = (s: SessionWithSubject) => {
    setEditTarget(s);
    setEditorOpen(true);
  };

  const handleSubmit = async (input: SessionInput) => {
    try {
      if (editTarget) {
        await updateSession(editTarget.id, input);
        toast.success("세션을 수정했습니다.");
      } else {
        await createSession(input);
        toast.success("세션을 추가했습니다.");
      }
      setEditorOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSession(deleteTarget.id);
      toast.success("세션을 삭제했습니다.");
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      setDeleteTarget(null);
    }
  };

  const noSubjects = subjects.length === 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {/* 상단 액션 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {sessions.length > 0 ? `총 ${sessions.length}개 세션` : "학습 세션 기록"}
        </p>
        <Button onClick={openCreate} disabled={noSubjects} title={noSubjects ? "먼저 과목을 만들어 주세요" : undefined}>
          <Plus />
          수동 추가
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          목록을 불러오지 못했습니다: {error}
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : sessions.length === 0 ? (
        <EmptyState onCreate={openCreate} noSubjects={noSubjects} />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.key}>
              {/* 날짜 헤더 + 그날 합계 */}
              <div className="mb-2 flex items-baseline justify-between border-b pb-1.5">
                <h3 className="text-sm font-semibold">{g.key}</h3>
                <span className="text-xs text-muted-foreground">
                  합계 {formatDurationKo(g.total)}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {g.items.map((s) => (
                  <li
                    key={s.id}
                    className="group flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5"
                  >
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: s.subject_color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.subject_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatClock(s.started_at)} ~ {formatClock(s.ended_at)}
                        </span>
                      </div>
                      {s.memo && (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {s.memo}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
                      {formatDurationKo(s.duration_sec)}
                    </span>

                    {/* 항목 액션 (평소 숨김, hover 시 표시) */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="iconSm" onClick={() => openEdit(s)} aria-label="수정">
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => setDeleteTarget(s)}
                        aria-label="삭제"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <SessionEditor
        open={editorOpen}
        target={editTarget}
        subjects={subjects}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="세션 삭제"
        message={
          deleteTarget
            ? `'${deleteTarget.subject_name}' · ${formatDurationKo(deleteTarget.duration_sec)} 기록을 삭제할까요? 되돌릴 수 없습니다.`
            : ""
        }
        confirmLabel="삭제"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function EmptyState({ onCreate, noSubjects }: { onCreate: () => void; noSubjects: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <ListChecks className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="mb-1 text-sm font-medium">아직 학습 기록이 없습니다</p>
      <p className="mb-4 max-w-xs text-sm text-muted-foreground">
        {noSubjects
          ? "측정을 시작하려면 먼저 과목을 만들어 주세요."
          : "측정을 종료하면 여기에 기록됩니다. 지난 공부는 수동으로 추가할 수도 있어요."}
      </p>
      {!noSubjects && (
        <Button onClick={onCreate}>
          <Plus />
          세션 수동 추가
        </Button>
      )}
    </div>
  );
}
