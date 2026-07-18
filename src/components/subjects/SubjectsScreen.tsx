import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronUp,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSubjects } from "@/hooks/useSubjects";
import {
  createSubject,
  updateSubject,
  deleteSubject,
  setSubjectArchived,
  swapSubjectOrder,
} from "@/lib/subjects";
import type { Subject, SubjectInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SubjectEditor } from "./SubjectEditor";

export function SubjectsScreen() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { subjects, loading, error, reload } = useSubjects(includeArchived);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setEditorOpen(true);
  };
  const openEdit = (s: Subject) => {
    setEditTarget(s);
    setEditorOpen(true);
  };

  const handleSubmit = async (input: SubjectInput) => {
    try {
      if (editTarget) {
        await updateSubject(editTarget.id, input);
        toast.success("과목을 수정했습니다.");
      } else {
        await createSubject(input);
        toast.success("과목을 추가했습니다.");
      }
      setEditorOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const handleArchive = async (s: Subject) => {
    try {
      await setSubjectArchived(s.id, s.archived === 0);
      toast.success(s.archived === 0 ? "보관했습니다." : "보관을 해제했습니다.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리에 실패했습니다.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSubject(deleteTarget.id);
      toast.success("과목을 삭제했습니다.");
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      // 세션이 연결된 경우 등 — 삭제 불가 사유를 알린다.
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      setDeleteTarget(null);
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const a = subjects[index];
    const b = subjects[index + dir];
    if (!a || !b) return;
    try {
      await swapSubjectOrder(a, b);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "순서 변경에 실패했습니다.");
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {/* 상단 액션 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          보관한 과목 표시
        </label>
        <Button onClick={openCreate}>
          <Plus />
          과목 추가
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          목록을 불러오지 못했습니다: {error}
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : subjects.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <ul className="flex flex-col gap-2">
          {subjects.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
                s.archived === 1 && "opacity-60",
              )}
            >
              {/* 순서 이동 */}
              <div className="flex flex-col">
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => handleMove(i, -1)}
                  aria-label="위로"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === subjects.length - 1}
                  onClick={() => handleMove(i, 1)}
                  aria-label="아래로"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
              {s.archived === 1 && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  보관됨
                </span>
              )}

              {/* 항목 액션 */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="iconSm" onClick={() => openEdit(s)} aria-label="수정">
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => handleArchive(s)}
                  aria-label={s.archived === 1 ? "보관 해제" : "보관"}
                >
                  {s.archived === 1 ? <ArchiveRestore /> : <Archive />}
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
      )}

      <SubjectEditor
        open={editorOpen}
        target={editTarget}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="과목 삭제"
        message={`'${deleteTarget?.name ?? ""}' 과목을 삭제할까요? 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="mb-1 text-sm font-medium">아직 과목이 없습니다</p>
      <p className="mb-4 max-w-xs text-sm text-muted-foreground">
        측정을 시작하려면 먼저 공부할 과목을 만들어 주세요.
      </p>
      <Button onClick={onCreate}>
        <Plus />첫 과목 만들기
      </Button>
    </div>
  );
}
