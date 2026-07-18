import type { SessionSnapshot } from "./types";

/** 로컬 현재 시각을 epoch 초로. */
export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 스냅샷 + 현재 시각으로 공부 경과 시간(초)을 다시 계산한다(기획서 §5-3).
 * 오버레이/타이머가 초당 이벤트 없이 `setInterval`로 이 값을 그린다.
 * 같은 기기라 로컬 시계와 Rust 시계가 사실상 같으므로 로컬 now로 계산한다.
 */
export function computeElapsed(snap: SessionSnapshot, now = nowSec()): number {
  if (snap.status === "idle" || snap.started_at == null) return 0;
  const pausedNow =
    snap.status === "paused" && snap.paused_at != null ? Math.max(0, now - snap.paused_at) : 0;
  return Math.max(0, now - snap.started_at - snap.accumulated_paused_sec - pausedNow);
}

/** 초 → `HH:MM:SS` (시가 0이어도 항상 표시해 오버레이 폭을 고정). */
export function formatHMS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
