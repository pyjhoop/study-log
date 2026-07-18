import { getDb } from "./db";

/**
 * 대시보드/통계 집계 계층. 세션을 원시 행으로 한 번 읽어와 **일/주/월 버킷·과목별 분포·
 * 오늘·이번주·이번달 합계·연속 학습일수·기간 상세(증감)**를 전부 JS(로컬 시계)에서 계산한다.
 *
 * 집계를 SQL `strftime` 대신 JS에서 하는 이유: 주(week) 경계 등을 SQLite와 JS가
 * 정확히 일치시키기 어렵고, 빈 버킷을 0으로 채우는 로직도 어차피 JS가 필요하기 때문.
 * 개인용 앱이라 세션 수가 적어 전체 조회 비용은 무시할 만하다. 값은 `?` 바인딩한다.
 *
 * **기간 오프셋(offset)**: 0 = 현재 기간(오늘/이번주/이번달), 1 = 직전(어제/지난주/지난달), …
 * 통계 페이지가 좌우 화살표로 이 오프셋을 움직여 과거 기간을 본다.
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
  /** 바로 직전(더 이전) 기간의 합계(초) — 표의 증감 계산용(창 경계와 무관). */
  prevTotal: number;
  /** 그 기간의 세션 수. */
  count: number;
  /** 현재 기준 몇 기간 전인지(0 = 현재 기간). */
  offset: number;
  /** 실제 현재 기간(offset 0)인지 — '진행 중' 표시용. */
  isCurrent: boolean;
  /** 이 창(window)에서 사용자가 보고 있는 초점 기간인지 — 강조용. */
  isFocused: boolean;
}

/** 특정 기간(offset) 상세 + 직전 기간 대비 증감. */
export interface PeriodStats {
  granularity: Granularity;
  offset: number;
  /** 현재 기간(진행 중)인지. */
  isCurrent: boolean;
  /** 기간 제목. 예: `7/14 ~ 7/20`, `2026년 7월`, `7/18 (금)` */
  title: string;
  /** 상대 라벨. 예: `오늘`/`이번 주`/`3주 전` */
  relLabel: string;
  /** 직전 기간 상대 라벨. 예: `지난 주`/`4주 전` */
  prevRelLabel: string;
  /** 이 기간 누적(초). 진행 중이면 지금까지. */
  total: number;
  /** 이 기간 세션 수. */
  count: number;
  /** 비교 대상(직전 기간) 누적(초). 진행 중이면 같은 시점까지. */
  previous: number;
  deltaSec: number;
  /** 증감률(%). previous가 0이면 null. */
  deltaPct: number | null;
  /** 진행 중이면 같은 시점 설명, 완료 기간이면 빈 문자열. */
  note: string;
  /** 이 기간 시작 epoch(초) — 과목별 분포 범위. */
  startSec: number;
  /** 이 기간 끝 epoch(초, exclusive). 진행 중이면 지금 직후. */
  endSec: number;
  /** 더 최근(오른쪽)으로 이동 가능한지(offset > 0). */
  canGoNewer: boolean;
}

/** 히트맵(잔디) 한 칸 = 하루. */
export interface HeatCell {
  /** 날짜 키 `YYYY-MM-DD`. */
  key: string;
  /** 날짜 0시 epoch(초) — 툴팁 라벨용. */
  sec: number;
  /** 그날 공부 시간 합계(초). */
  total: number;
  /** 표시 범위(과거~오늘) 안이면 true. 이번 주의 미래 날짜 등 패딩 칸은 false. */
  inRange: boolean;
}

/** GitHub 잔디 형태의 일별 학습시간 히트맵. */
export interface Heatmap {
  /** 열(주) 단위, 오래된 주 → 최근 주. 각 주는 7칸(월~일). */
  weeks: HeatCell[][];
  /** 열 인덱스 → 그 열에서 달이 바뀔 때의 월 라벨. */
  months: { col: number; label: string }[];
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

/**
 * 진행 중 기간의 "같은 시점"을 직전 기간에서 **달력 연산**으로 찾는다(페이스 비교용).
 * epoch 초 delta를 더하면 DST 경계에서 1시간 어긋나므로, 요일/일자+시:분:초를 직접 옮긴다.
 * (KST는 DST가 없어 현재는 무해하지만, 다른 시간대 배포 시 정확해진다.)
 *  - day  : 직전 날의 같은 시:분:초
 *  - week : 직전 주의 같은 요일·시:분:초
 *  - month: 직전 달의 같은 일(말일 초과 시 그 달 말일로 clamp)·시:분:초
 */
function samePointInPrev(g: Granularity, now: Date, prevStart: Date): Date {
  const d = new Date(prevStart);
  if (g === "week") {
    d.setDate(d.getDate() + ((now.getDay() + 6) % 7)); // 월=0 기준 요일 오프셋
  } else if (g === "month") {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(now.getDate(), lastDay));
  }
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return d;
}

/** 현재에서 k기간 전 기간의 시작(0시). k=0 현재, k=1 직전 … 음수면 미래. */
function shiftStart(g: Granularity, now: Date, k: number): Date {
  if (g === "day") {
    const d = startOfDay(now);
    d.setDate(d.getDate() - k);
    return d;
  }
  if (g === "week") {
    const d = startOfWeek(now);
    d.setDate(d.getDate() - k * 7);
    return d;
  }
  const d = startOfMonth(now);
  d.setMonth(d.getMonth() - k);
  return d;
}

/** 버킷 키(그 기간을 대표하는 문자열). 세션 배정과 축 라벨이 같은 키를 쓰게 한다. */
function bucketKey(g: Granularity, start: Date): string {
  return g === "month" ? monthKey(start) : dateKey(start);
}

/** 기간 짧은 축 라벨. */
function bucketLabel(g: Granularity, start: Date): string {
  if (g === "month") return `${start.getMonth() + 1}월`;
  return `${start.getMonth() + 1}/${start.getDate()}`;
}

/** 기간 긴 제목(툴팁/표/헤더용). */
function periodTitle(g: Granularity, start: Date): string {
  if (g === "day") return `${start.getMonth() + 1}/${start.getDate()} (${WEEKDAY_KO[start.getDay()]})`;
  if (g === "month") return `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
}

/** 상대 라벨. offset 0/1은 특별히, 그 이상은 `N일/주/개월 전`. */
function relLabel(g: Granularity, offset: number): string {
  if (g === "day") return offset === 0 ? "오늘" : offset === 1 ? "어제" : `${offset}일 전`;
  if (g === "week") return offset === 0 ? "이번 주" : offset === 1 ? "지난 주" : `${offset}주 전`;
  return offset === 0 ? "이번 달" : offset === 1 ? "지난 달" : `${offset}개월 전`;
}

/** 진행 중 기간의 "같은 시점" 설명. */
function pointNote(g: Granularity, now: Date): string {
  const hh = now.getHours();
  if (g === "day") return `오늘 ${hh}시 기준`;
  if (g === "week") return `${WEEKDAY_KO[now.getDay()]}요일 ${hh}시까지`;
  return `${now.getDate()}일 ${hh}시까지`;
}

/** 각 granularity에서 기본으로 몇 개의 버킷을 보여줄지(대시보드용). 통계 페이지는 더 길게 요청. */
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

/** 오늘(로컬 날짜) 저장된 세션의 공부 시간 합계(초). 오버레이 목표% 표시용 경량 쿼리. */
export async function fetchTodaySec(now = new Date()): Promise<number> {
  const db = await getDb();
  const todayStart = sec(startOfDay(now));
  const rows = await db.select<{ total: number | null }[]>(
    "SELECT SUM(duration_sec) AS total FROM sessions WHERE started_at >= ?",
    [todayStart],
  );
  return rows[0]?.total ?? 0;
}

// ── 집계(순수 함수) ───────────────────────────────────────────────

/**
 * 세션을 buckets로 묶어 반환(오래된→최근). 빈 버킷은 0으로 채운다.
 * - count: 버킷 개수(통계 페이지는 더 길게, 기본은 대시보드용 BUCKET_COUNT).
 * - endOffset: 창의 가장 최근 버킷이 몇 기간 전인지(0 = 지금까지, N = N기간 전에서 끝나는 창).
 */
export function buildBuckets(
  rows: StatRow[],
  g: Granularity,
  count: number = BUCKET_COUNT[g],
  endOffset = 0,
  now = new Date(),
): StatBucket[] {
  // 세션 → 버킷 키별 합계·개수.
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const rd = new Date(r.started_at * 1000);
    const start = g === "day" ? startOfDay(rd) : g === "week" ? startOfWeek(rd) : startOfMonth(rd);
    const key = bucketKey(g, start);
    totals.set(key, (totals.get(key) ?? 0) + r.duration_sec);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: StatBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const offset = endOffset + i;
    const start = shiftStart(g, now, offset);
    const key = bucketKey(g, start);
    // 직전 기간 합계는 창 밖이어도 totals 맵에서 직접 찾는다 → 표 증감이 창 경계에서 끊기지 않음.
    const prevKey = bucketKey(g, shiftStart(g, now, offset + 1));
    out.push({
      key,
      label: bucketLabel(g, start),
      tooltip: periodTitle(g, start),
      total: totals.get(key) ?? 0,
      prevTotal: totals.get(prevKey) ?? 0,
      count: counts.get(key) ?? 0,
      offset,
      isCurrent: offset === 0,
      isFocused: i === 0,
    });
  }
  return out;
}

/** 현재 granularity에서 보이는 범위의 시작 epoch(초) — 과목별 분포 범위와 맞춘다. */
export function rangeStart(
  g: Granularity,
  count: number = BUCKET_COUNT[g],
  now = new Date(),
): number {
  return sec(shiftStart(g, now, count - 1));
}

/**
 * 특정 기간(offset)의 상세와 직전 기간 대비 증감.
 * - 진행 중(offset 0): 지난 기간의 **같은 시점**까지와 비교(페이스). 이번 기간 경과 오프셋을
 *   직전 기간 시작에 더한 지점까지를 이전 누적으로 본다(월 비교는 이번 기간 시작으로 clamp).
 * - 완료 기간(offset ≥ 1): 직전 완료 기간 **전체**와 비교.
 */
export function focusedStats(
  rows: StatRow[],
  g: Granularity,
  offset: number,
  now = new Date(),
): PeriodStats {
  const start = shiftStart(g, now, offset);
  const next = shiftStart(g, now, offset - 1); // 더 최근 인접 기간 시작 = 이 기간 끝
  const prev = shiftStart(g, now, offset + 1); // 직전 기간 시작
  const startSec = sec(start);
  const nextSec = sec(next);
  const prevSec = sec(prev);
  const nowSec = Math.floor(now.getTime() / 1000);
  const isCurrent = offset === 0;

  // 이 기간 집계 구간: 진행 중이면 [start, now], 완료면 [start, next).
  const endSec = isCurrent ? nowSec + 1 : nextSec;
  // 비교(직전) 구간의 끝: 진행 중이면 직전 기간의 **같은 시점**(달력 기준), 완료면 이 기간
  // 시작(= 직전 기간 전체). 진행 중은 startSec으로 clamp해 이 기간을 침범하지 않게 한다.
  const prevEnd = isCurrent
    ? Math.min(sec(samePointInPrev(g, now, prev)), startSec)
    : startSec;

  let total = 0;
  let count = 0;
  let previous = 0;
  for (const r of rows) {
    if (r.started_at >= startSec && r.started_at < endSec) {
      total += r.duration_sec;
      count++;
    } else if (r.started_at >= prevSec && r.started_at < prevEnd) {
      previous += r.duration_sec;
    }
  }

  const deltaSec = total - previous;
  const deltaPct = previous > 0 ? Math.round((deltaSec / previous) * 100) : null;
  return {
    granularity: g,
    offset,
    isCurrent,
    title: periodTitle(g, start),
    relLabel: relLabel(g, offset),
    prevRelLabel: relLabel(g, offset + 1),
    total,
    count,
    previous,
    deltaSec,
    deltaPct,
    note: isCurrent ? pointNote(g, now) : "",
    startSec,
    endSec,
    canGoNewer: offset > 0,
  };
}

/**
 * 최근 `weeksCount`주의 일별 학습시간 히트맵(월요일 시작, GitHub 잔디 형태).
 * 마지막 열이 이번 주다. 이번 주의 오늘 이후 날짜는 `inRange:false`(빈 칸)로 둔다.
 */
export function buildHeatmap(
  rows: StatRow[],
  weeksCount = 53,
  now = new Date(),
): Heatmap {
  // 날짜별 합계.
  const totals = new Map<string, number>();
  for (const r of rows) {
    const k = dateKey(new Date(r.started_at * 1000));
    totals.set(k, (totals.get(k) ?? 0) + r.duration_sec);
  }

  const todayMs = startOfDay(now).getTime();
  const thisWeekStart = startOfWeek(now);
  const weeks: HeatCell[][] = [];
  const months: { col: number; label: string }[] = [];
  let prevMonth = -1;

  for (let c = 0; c < weeksCount; c++) {
    const weekStart = new Date(thisWeekStart);
    weekStart.setDate(weekStart.getDate() - (weeksCount - 1 - c) * 7);
    const week: HeatCell[] = [];
    // 이 주(월~일)에 '1일'이 들어있으면 그 달이 이 열에서 시작한다(GitHub 라벨 규약).
    let startsMonth = -1;
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + d);
      const k = dateKey(day);
      if (day.getDate() === 1) startsMonth = day.getMonth();
      week.push({
        key: k,
        sec: sec(day),
        total: totals.get(k) ?? 0,
        inRange: day.getTime() <= todayMs,
      });
    }
    // 월 라벨: 그 달의 1일이 포함된 열에 붙인다(월요일 기준으로 한 칸 밀리지 않게).
    if (startsMonth !== -1 && startsMonth !== prevMonth) {
      months.push({ col: c, label: `${startsMonth + 1}월` });
      prevMonth = startsMonth;
    }
    weeks.push(week);
  }
  return { weeks, months };
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

/** [fromSec, toSec) 구간의 과목별 합계(내림차순, 0 제외). toSec 미지정 시 이후 전체. */
export function subjectBreakdown(
  rows: StatRow[],
  fromSec: number,
  toSec = Infinity,
): SubjectSlice[] {
  const map = new Map<number, SubjectSlice>();
  for (const r of rows) {
    if (r.started_at < fromSec || r.started_at >= toSec) continue;
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
