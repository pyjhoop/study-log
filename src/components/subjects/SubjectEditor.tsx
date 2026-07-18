import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Subject, SubjectInput } from "@/lib/types";

/** 기본 과목 색 팔레트 (Tailwind 계열 톤). */
const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9", "#3b82f6",
];

interface SubjectEditorProps {
  open: boolean;
  /** null이면 생성, Subject면 수정. */
  target: Subject | null;
  onClose: () => void;
  onSubmit: (input: SubjectInput) => Promise<void>;
}

/** 과목 생성/수정 모달. 이름 입력 + 색 선택(팔레트/직접). */
export function SubjectEditor({ open, target, onClose, onSubmit }: SubjectEditorProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);

  // 모달이 열릴 때 대상 값으로 폼을 초기화한다.
  useEffect(() => {
    if (open) {
      setName(target?.name ?? "");
      setColor(target?.color ?? PALETTE[0]);
      setSaving(false);
    }
  }, [open, target]);

  const canSave = name.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({ name, color });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? "과목 수정" : "과목 추가"}
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
          <label className="text-sm font-medium">이름</label>
          <Input
            autoFocus
            value={name}
            maxLength={40}
            placeholder="예: 알고리즘"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">색</label>
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                  color.toLowerCase() === c.toLowerCase()
                    ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    : "border-border",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            {/* 직접 색 선택 */}
            <label
              className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-dashed"
              title="직접 선택"
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span
                className="pointer-events-none absolute inset-1 rounded-full"
                style={{ backgroundColor: color }}
              />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
