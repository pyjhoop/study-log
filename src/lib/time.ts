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

const pad2 = (n: number) => String(n).padStart(2, "0");
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** 초 → 사람이 읽는 길이. 예: `1시간 23분`, `5분`, `0분`(1분 미만). */
export function formatDurationKo(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${m}분`;
}

/** 초 → 부호 있는 길이. 증감 표시용. 예: `+1시간 40분`, `-30분`, `±0분`. */
export function formatSignedDurationKo(deltaSec: number): string {
  const s = Math.round(deltaSec);
  if (s === 0) return "±0분";
  return (s > 0 ? "+" : "-") + formatDurationKo(Math.abs(s));
}

/** epoch(초) → 로컬 날짜 라벨 `YYYY-MM-DD (요일)`. 기록 일별 그룹 헤더용. */
export function formatDayLabel(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} (${WEEKDAY_KO[d.getDay()]})`;
}

/** epoch(초) → 로컬 시:분 `HH:MM`. 기록 목록의 시작·종료 시각용. */
export function formatClock(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * epoch(초) → `<input type="datetime-local">` 값(`YYYY-MM-DDTHH:MM`, 로컬 기준).
 * 세션 수정/수동 추가 폼에서 시각을 편집할 때 사용.
 */
export function toDatetimeLocal(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** datetime-local 문자열(로컬 기준) → epoch(초). 값이 비었거나 잘못되면 null. */
export function fromDatetimeLocal(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}
