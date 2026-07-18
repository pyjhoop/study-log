import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search } from "lucide-react";
import { listSubjects } from "@/lib/subjects";
import { startSession, requestFocusMain } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import type { Subject } from "@/lib/types";

/**
 * 빠른 시작 피커 창(기획서 §7). 시작 핫키(Ctrl+Alt+S) → Rust `show_quickstart`가 이 창을 표시한다.
 *  - 과목 목록 표시, 타이핑으로 필터.
 *  - ↑/↓ 이동 + Enter, 또는 숫자키(1~9)로 즉시 선택, Esc로 취소.
 *  - 선택 → `start_session` → 창 숨김(오버레이는 Rust가 자동 표시).
 *  - 과목이 없으면 "과목 관리 열기"로 유도.
 * 창은 숨김 상태로 유지(재사용)되므로, 창이 포커스될 때마다 목록·필터·선택을 초기화한다.
 */
export default function QuickStart() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = subjects.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const reload = useCallback(async () => {
    try {
      setSubjects(await listSubjects());
    } catch {
      /* 조회 실패 시 빈 목록 유지 — 창을 다시 열면 재시도된다. */
    }
  }, []);

  // 마운트 시 1회 로드 + 창이 포커스될 때마다 초기화(재표시 대비).
  useEffect(() => {
    void reload();
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return;
        setQuery("");
        setHighlight(0);
        void reload();
        // 창 포커스 직후 입력창으로 포커스를 넘겨 바로 타이핑할 수 있게 한다.
        setTimeout(() => inputRef.current?.focus(), 0);
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [reload]);

  // 필터가 바뀌면 하이라이트가 범위를 벗어나지 않게 보정.
  useEffect(() => {
    setHighlight((h) => (h >= filtered.length ? 0 : h));
  }, [filtered.length]);

  const cancel = useCallback(() => {
    void getCurrentWindow().hide();
  }, []);

  const pick = useCallback(async (subject: Subject) => {
    try {
      await startSession(subject.id);
    } catch {
      /* 이미 측정 중 등 — 어차피 피커는 닫는다(오버레이/상태는 Rust 단일 소스). */
    }
    setQuery("");
    setHighlight(0);
    await getCurrentWindow().hide();
  }, []);

  const openSubjectManager = useCallback(async () => {
    await requestFocusMain("subjects");
    await getCurrentWindow().hide();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = filtered[highlight];
      if (s) void pick(s);
    } else if (/^[1-9]$/.test(e.key)) {
      // 숫자키 = 보이는 목록의 n번째 즉시 선택(입력창에 숫자가 들어가지 않도록 preventDefault).
      const idx = Number(e.key) - 1;
      const s = filtered[idx];
      if (s) {
        e.preventDefault();
        void pick(s);
      }
    }
  };

  const hasNoSubjects = subjects.length === 0;

  return (
    <div className="flex h-screen w-screen items-center justify-center p-3 select-none">
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl">
        {hasNoSubjects ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm font-medium">아직 과목이 없어요</p>
            <p className="text-xs text-muted-foreground">
              측정하려면 먼저 과목을 만들어 주세요.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => void openSubjectManager()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                과목 관리 열기
              </button>
              <button
                onClick={cancel}
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 검색 입력 */}
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="과목 검색…"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* 과목 목록 */}
            <div className="max-h-72 flex-1 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  "{query}"에 맞는 과목이 없어요.
                </p>
              ) : (
                filtered.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => void pick(s)}
                    onMouseMove={() => setHighlight(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      i === highlight
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground",
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {i < 9 && (
                      <kbd className="shrink-0 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                        {i + 1}
                      </kbd>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* 하단 힌트 */}
            <div className="flex items-center justify-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
              <span>↑↓ 이동</span>
              <span>Enter 선택</span>
              <span>1–9 바로가기</span>
              <span>Esc 취소</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
