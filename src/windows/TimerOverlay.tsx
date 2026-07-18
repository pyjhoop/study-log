/**
 * 타이머 오버레이 창 (단계 3에서 드래그/크기조절/미니컨트롤/상태연동 구현).
 * 지금은 항상-위 반투명 알약 모양만 렌더한다.
 */
export default function TimerOverlay() {
  return (
    <div className="flex h-screen w-screen items-center justify-center select-none">
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 rounded-xl bg-black/70 px-4 py-2 text-white backdrop-blur-sm"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="font-mono text-lg tabular-nums">00:00:00</span>
      </div>
    </div>
  );
}
