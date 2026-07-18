import { getDb } from "./db";

/**
 * 대시보드 통계 집계 계층. 세션을 원시 행으로 한 번 읽어와 **일/주/월 버킷·과목별 분포·
 * 오늘·이번주·이번달 합계·연속 학습일수**를 전부 JS(로컬 시계)에서 계산한다.
 *
 * 집계를 SQL `strftime` 대신 JS에서 하는 이유: 주(week) 경계 등을 SQLite와 JS가
 * 정확히 일치시키기 어렵고, 빈 버킷을 0으로 채우는 로직도 어차피 JS가 필요하기 때문.
 * 개인용 앱이라 세션 수가 적어 전체 조회 비용은 무시할 만하다. 값은 `?` 바인딩한다.
 */

/** 통계 계산에 필요한 최소 세션 행(과목 이름/색 JOIN). */
export interface StatRow {
  id: number;
  started_at: number;
  ended_at: number;
  duration_sec: number;
  subject_id: number;
  subject_name: string;
  subject_color: string;
}

export type Granularity = "day" | "week" | "month";

/** 일/주/월 막대 하나(버킷). total은 초 단위. */
export interface StatBucket {
  key: string;
  /** X축 라벨(짧게). 예: `7/18`, `7월` */
  label: string;
  /** 툴팁 제목(길게). 예: `7/18 (금)`, `2026년 7월` */
  tooltip: string;
  total: number;
  /** 현재(오늘/이번주/이번달) 버킷인지 — 강조용. */
  isCurrent: boolean;
}

/** 과목별 분포 조각. */
export interface SubjectSlice {
  subject_id: number;
  name: string;
  color: string;
  total: number;
}

/** 오늘/이번주/이번달 누적(초). */
export interface PeriodTotals {
  today: number;
  week: number;
  month: number;
}

// ── 날짜 헬퍼(전부 로컬 시계 기준) ────────────────────────────────
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const pad2 = (n: number) => String(n).padStart(2, "0");

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** 그 주의 월요일 0시. */
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const diff = (s.getDay() + 6) % 7; // 월=0 … 일=6
  s.setDate(s.getDate() - diff);
  return s;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function sec(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

/** 각 granularity에서 몇 개의 버킷을 보여줄지. */
const BUCKET_COUNT: Record<Granularity, number> = { day: 14, week: 8, month: 6 };

// ── 조회 ─────────────────────────────────────────────────────────
/** 통계용 세션 행 전체(오래된→최근). */
export async function fetchStatRows(): Promise<StatRow[]> {
  const db = await getDb();
  return db.select<StatRow[]>(
    `SELECT s.id, s.started_at, s.ended_at, s.duration_sec, s.subject_id,
            sub.name AS subject_name, sub.color AS subject_color
       FROM sessions s
       JOIN subjects sub ON sub.id = s.subject_id
      ORDER BY s.started_at ASC, s.id ASC`,
  );
}

// ── 집계(순수 함수) ───────────────────────────────────────────────

/** 세션을 buckets(현재 시점 기준 최근 N개)로 묶어 반환. 빈 버킷은 0으로 채운다. */
export function buildBuckets(rows: StatRow[], g: Granularity, now = new Date()): StatBucket[] {
  const count = BUCKET_COUNT[g];

  // 세션 → 버킷 키별 합계.
  const totals = new Map<string, number>();
  for (const r of rows) {
    const rd = new Date(r.started_at * 1000);
    const key =
      g === "day" ? dateKey(startOfDay(rd)) : g === "week" ? dateKey(startOfWeek(rd)) : monthKey(rd);
    totals.set(key, (totals.get(key) ?? 0) + r.duration_sec);
  }

  const out: StatBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const isCurrent = i === 0;
    if (g === "day") {
      const d = startOfDay(now);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      out.push({
        key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        tooltip: `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY_KO[d.getDay()]})`,
        total: totals.get(key) ?? 0,
        isCurrent,
      });
    } else if (g === "week") {
      const d = startOfWeek(now);
      d.setDate(d.getDate() - i * 7);
      const key = dateKey(d);
      out.push({
        key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        tooltip: `${d.getMonth() + 1}/${d.getDate()} 주`,
        total: totals.get(key) ?? 0,
        isCurrent,
      });
    } else {
      const d = startOfMonth(now);
      d.setMonth(d.getMonth() - i);
      const key = monthKey(d);
      out.push({
        key,
        label: `${d.getMonth() + 1}월`,
        tooltip: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
        total: totals.get(key) ?? 0,
        isCurrent,
      });
    }
  }
  return out;
}

/** 현재 granularity에서 보이는 범위의 시작 epoch(초) — 과목별 분포 범위와 맞춘다. */
export function rangeStart(g: Granularity, now = new Date()): number {
  const count = BUCKET_COUNT[g];
  if (g === "day") {
    const d = startOfDay(now);
    d.setDate(d.getDate() - (count - 1));
    return sec(d);
  }
  if (g === "week") {
    const d = startOfWeek(now);
    d.setDate(d.getDate() - (count - 1) * 7);
    return sec(d);
  }
  const d = startOfMonth(now);
  d.setMonth(d.getMonth() - (count - 1));
  return sec(d);
}

/** 오늘/이번주/이번달 누적(초). */
export function periodTotals(rows: StatRow[], now = new Date()): PeriodTotals {
  const todayStart = sec(startOfDay(now));
  const weekStart = sec(startOfWeek(now));
  const monthStart = sec(startOfMonth(now));
  let today = 0;
  let week = 0;
  let month = 0;
  for (const r of rows) {
    if (r.started_at >= todayStart) today += r.duration_sec;
    if (r.started_at >= weekStart) week += r.duration_sec;
    if (r.started_at >= monthStart) month += r.duration_sec;
  }
  return { today, week, month };
}

/** fromSec 이후 과목별 합계(내림차순, 0 제외). */
export function subjectBreakdown(rows: StatRow[], fromSec: number): SubjectSlice[] {
  const map = new Map<number, SubjectSlice>();
  for (const r of rows) {
    if (r.started_at < fromSec) continue;
    const cur =
      map.get(r.subject_id) ??
      { subject_id: r.subject_id, name: r.subject_name, color: r.subject_color, total: 0 };
    cur.total += r.duration_sec;
    map.set(r.subject_id, cur);
  }
  return [...map.values()].filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
}

/**
 * 오늘까지 이어진 연속 학습일수. 오늘 아직 공부 전이면 어제부터 세어(하루가 다 가기 전
 * 스트릭이 0으로 보이지 않게) 현재 연속 기록을 보여준다.
 */
export function computeStreak(rows: StatRow[], now = new Date()): number {
  const active = new Set(
    rows.filter((r) => r.duration_sec > 0).map((r) => dateKey(new Date(r.started_at * 1000))),
  );
  const d = startOfDay(now);
  if (!active.has(dateKey(d))) d.setDate(d.getDate() - 1); // 오늘은 아직 여유
  let streak = 0;
  while (active.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
