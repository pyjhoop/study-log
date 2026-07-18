import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** KeyboardEvent → Tauri accelerator의 메인 키 토큰. 수정자 단독/미지원 키는 null. */
function mapKey(e: KeyboardEvent): string | null {
  const k = e.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(k)) return null; // 수정자 단독은 대기
  if (/^[a-z]$/i.test(k)) return k.toUpperCase();
  if (/^[0-9]$/.test(k)) return k;
  if (/^F([1-9]|1[0-2])$/.test(k)) return k;
  const named: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    " ": "Space",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
  };
  if (k in named) return named[k];
  if (k.length === 1) return k.toUpperCase(); // 문장부호 등
  return null;
}

/**
 * 전역 핫키 하나를 캡처하는 컨트롤(**제어형**). "변경"을 누르면 부모에 캡처 시작을 알리고,
 * 부모(HotkeysSection)가 **한 번에 한 행만** 캡처 상태로 두어 여러 행이 동시에 키를 먹어
 * 두 바인딩이 한 번에 덮어써지는 문제를 막는다. 반드시 수정자(Ctrl/Alt/Shift/Super)를
 * 포함해야 하며, Esc로 취소한다.
 */
export function HotkeyCapture({
  value,
  capturing,
  onCapturingChange,
  onChange,
}: {
  value: string;
  capturing: boolean;
  onCapturingChange: (capturing: boolean) => void;
  onChange: (accel: string) => void;
}) {
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // 같은 노드의 다른 캡처 리스너까지 차단(안전망)
      if (e.key === "Escape") {
        onCapturingChange(false);
        return;
      }
      const main = mapKey(e);
      if (!main) return; // 수정자만 눌린 상태 — 메인 키 대기

      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Super");
      if (mods.length === 0) {
        toast.error("Ctrl · Alt · Shift 등 수정자 키를 포함해 주세요.");
        return;
      }
      onChange([...mods, main].join("+"));
      onCapturingChange(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, onCapturingChange, onChange]);

  return (
    <button
      type="button"
      onClick={() => onCapturingChange(!capturing)}
      className={cn(
        "inline-flex h-8 min-w-[9rem] items-center justify-center rounded-md border px-3 font-mono text-xs transition-colors",
        capturing
          ? "animate-pulse border-primary bg-primary/10 text-primary"
          : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
      )}
      aria-label="단축키 변경"
    >
      {capturing ? "키를 누르세요… (Esc 취소)" : value}
    </button>
  );
}

/** 접근성/재사용을 위한 기본값 되돌리기 버튼(HotkeysSection에서 사용). */
export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      기본값으로
    </Button>
  );
}
