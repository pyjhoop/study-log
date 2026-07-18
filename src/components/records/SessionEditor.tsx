import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { formatDurationKo, fromDatetimeLocal, nowSec, toDatetimeLocal } from "@/lib/time";
import type { SessionInput, SessionWithSubject, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionEditorProps {
  open: boolean;
  /** null이면 수동 추가, 값이 있으면 수정. */
  target: SessionWithSubject | null;
  /** 선택 가능한 과목(보관 포함 — 과거 세션이 보관 과목에 속할 수 있음). */
  subjects: Subject[];
  onClose: () => void;
  onSubmit: (input: SessionInput) => Promise<void>;
}

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

/** 세션 수동 추가/수정 모달. 과목·시작/종료 시각·메모를 편집한다. */
export function SessionEditor({ open, target, subjects, onClose, onSubmit }: SessionEditorProps) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [memo, setMemo] = useState("");
  const [pausedSec, setPausedSec] = useState(0);
  const [saving, setSaving] = useState(false);

  // 열릴 때 폼 초기화: 수정이면 대상 값, 추가면 기본값(1시간 전 ~ 지금, 첫 과목).
  useEffect(() => {
    if (!open) return;
    if (target) {
      setSubjectId(target.subject_id);
      setStartStr(toDatetimeLocal(target.started_at));
      setEndStr(toDatetimeLocal(target.ended_at));
      setMemo(target.memo ?? "");
      setPausedSec(target.paused_sec);
    } else {
      const now = nowSec();
      setSubjectId(subjects[0]?.id ?? null);
      setStartStr(toDatetimeLocal(now - 3600));
      setEndStr(toDatetimeLocal(now));
      setMemo("");
      setPausedSec(0);
    }
    setSaving(false);
  }, [open, target, subjects]);

  const started = fromDatetimeLocal(startStr);
  const ended = fromDatetimeLocal(endStr);
  const duration = useMemo(() => {
    if (started == null || ended == null) return null;
    return Math.max(0, ended - started - pausedSec);
  }, [started, ended, pausedSec]);

  const timeInvalid = started != null && ended != null && ended <= started;
  const canSave =
    subjectId != null && started != null && ended != null && !timeInvalid && !saving;

  const handleSubmit = async () => {
    if (!canSave || subjectId == null || started == null || ended == null) return;
    setSaving(true);
    try {
      await onSubmit({
        subject_id: subjectId,
        started_at: started,
        ended_at: ended,
        paused_sec: pausedSec,
        memo: memo.trim() ? memo.trim() : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? "세션 수정" : "세션 수동 추가"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">과목</label>
          <select
            value={subjectId ?? ""}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className={inputClass}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.archived === 1 ? " (보관됨)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">시작</label>
            <input
              type="datetime-local"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">종료</label>
            <input
              type="datetime-local"
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              className={cn(inputClass, timeInvalid && "border-destructive")}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {timeInvalid ? (
            <span className="text-destructive">종료 시각은 시작보다 뒤여야 합니다.</span>
          ) : duration != null ? (
            <>
              공부 시간 <span className="font-medium text-foreground">{formatDurationKo(duration)}</span>
              {pausedSec > 0 && <> (일시정지 {formatDurationKo(pausedSec)} 제외)</>}
            </>
          ) : (
            "시작·종료 시각을 입력하세요."
          )}
        </p>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">메모</label>
          <textarea
            value={memo}
            maxLength={500}
            rows={3}
            placeholder="무엇을 공부했나요? (선택)"
            onChange={(e) => setMemo(e.target.value)}
            className={cn(inputClass, "h-auto resize-none py-2")}
          />
        </div>
      </div>
    </Modal>
  );
}
