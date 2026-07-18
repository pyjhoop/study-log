import { fetch } from "@tauri-apps/plugin-http";
import { getDb } from "./db";
import { getSetting, setSetting } from "./settings";
import { LIVE_SESSION_KEY } from "./liveSession";
import { nowSec } from "./time";
import type { Session, Subject } from "./types";

/**
 * GitHub 백업/복원(기획 F3). 전체 데이터(과목·세션·설정)를 JSON 한 파일로 만들어
 * GitHub Contents API(REST)로 레포에 커밋하고, 반대로 받아 로컬 DB를 복원한다.
 *
 * - 전송은 `@tauri-apps/plugin-http`의 `fetch`(CORS 없이 api.github.com 호출, 스코프는 capability).
 * - 토큰(PAT)은 로컬 SQLite `settings`에 평문 저장된다(개인용 로컬 앱). 백업 JSON에는 담지 않는다.
 */

const API = "https://api.github.com";

/** settings 저장 key. */
export const BACKUP_CONFIG_KEY = "backup_config";
export const GITHUB_TOKEN_KEY = "github_token";
export const LAST_BACKUP_KEY = "last_backup_at";

/** 백업 JSON에 절대 담지 않는 settings key(토큰·설정·휘발 상태). */
const EXCLUDED_SETTING_KEYS = new Set([
  GITHUB_TOKEN_KEY,
  BACKUP_CONFIG_KEY,
  LAST_BACKUP_KEY,
  LIVE_SESSION_KEY,
]);

export interface BackupConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  owner: "",
  repo: "",
  branch: "main",
  path: "study-log-backup.json",
};

/** 이 앱이 복원할 수 있는 백업 포맷 버전. */
const SUPPORTED_VERSIONS = new Set([1, 2]);

/** 백업 파일 전체 구조(버전 2). */
export interface BackupPayload {
  version: number;
  exported_at: number;
  subjects: Subject[];
  sessions: Session[];
  settings: Record<string, unknown>;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 평범한 객체(배열·null 아님)인지. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * 파괴적 복원(전체 DELETE) 전에 페이로드를 검증한다. 버전·각 행의 필드 타입까지 확인해,
 * 손상/손편집된 백업이 삭제만 시키고 일부만 복원되는 사고(부분 복원 = 데이터 유실)를 막는다.
 * 문제가 있으면 던진다(→ DB는 손대지 않음).
 */
function validatePayload(payload: BackupPayload): void {
  if (!isNum(payload.version) || !SUPPORTED_VERSIONS.has(payload.version)) {
    throw new Error(`지원하지 않는 백업 버전입니다(v${payload.version}). 앱을 업데이트하세요.`);
  }
  if (!Array.isArray(payload.subjects) || !Array.isArray(payload.sessions)) {
    throw new Error("백업 파일 형식이 올바르지 않습니다.");
  }
  if (payload.settings !== undefined && !isPlainObject(payload.settings)) {
    throw new Error("백업 설정 형식이 올바르지 않습니다.");
  }
  payload.subjects.forEach((s, i) => {
    if (
      !isPlainObject(s) ||
      !isNum(s.id) ||
      typeof s.name !== "string" ||
      typeof s.color !== "string" ||
      !isNum(s.sort_order) ||
      !isNum(s.archived) ||
      !isNum(s.created_at)
    ) {
      throw new Error(`백업 과목 ${i + 1}행의 형식이 올바르지 않습니다.`);
    }
  });
  payload.sessions.forEach((s, i) => {
    if (
      !isPlainObject(s) ||
      !isNum(s.id) ||
      !isNum(s.subject_id) ||
      !isNum(s.started_at) ||
      !isNum(s.ended_at) ||
      !isNum(s.duration_sec) ||
      !isNum(s.paused_sec) ||
      !isNum(s.created_at) ||
      !(s.memo === null || typeof s.memo === "string")
    ) {
      throw new Error(`백업 세션 ${i + 1}행의 형식이 올바르지 않습니다.`);
    }
  });
}

// ── 설정 로드/저장 ────────────────────────────────────────────────

export async function getBackupConfig(): Promise<BackupConfig> {
  const saved = await getSetting<Partial<BackupConfig>>(BACKUP_CONFIG_KEY);
  return { ...DEFAULT_BACKUP_CONFIG, ...(saved ?? {}) };
}

export async function saveBackupConfig(config: BackupConfig): Promise<void> {
  await setSetting(BACKUP_CONFIG_KEY, config);
}

export async function getToken(): Promise<string> {
  return (await getSetting<string>(GITHUB_TOKEN_KEY)) ?? "";
}

export async function saveToken(token: string): Promise<void> {
  await setSetting(GITHUB_TOKEN_KEY, token);
}

export async function getLastBackupAt(): Promise<number | null> {
  return getSetting<number>(LAST_BACKUP_KEY);
}

/** owner/repo/path/token이 모두 채워졌는지 — 백업·복원 버튼 활성 조건. */
export function isConfigReady(config: BackupConfig, token: string): boolean {
  return Boolean(config.owner && config.repo && config.path && token);
}

// ── base64(UTF-8) ────────────────────────────────────────────────
// 과목명/메모에 한글이 들어가므로 btoa 직접 사용 금지. UTF-8 바이트로 변환 후 인코딩.

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ── export / import (DB) ─────────────────────────────────────────

/** 로컬 DB 전체를 백업 페이로드로 직렬화한다(민감/휘발 설정 제외). */
export async function exportData(): Promise<BackupPayload> {
  const db = await getDb();
  const subjects = await db.select<Subject[]>(
    "SELECT id, name, color, sort_order, archived, created_at FROM subjects ORDER BY id ASC",
  );
  const sessions = await db.select<Session[]>(
    `SELECT id, subject_id, started_at, ended_at, duration_sec, paused_sec, memo, created_at
       FROM sessions ORDER BY id ASC`,
  );
  const settingRows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings",
  );
  const settings: Record<string, unknown> = {};
  for (const { key, value } of settingRows) {
    if (EXCLUDED_SETTING_KEYS.has(key)) continue;
    try {
      settings[key] = JSON.parse(value);
    } catch {
      settings[key] = value;
    }
  }
  return { version: 2, exported_at: nowSec(), subjects, sessions, settings };
}

/**
 * 백업 페이로드로 로컬 DB를 전체 교체한다(복원). 파괴적이므로 호출부에서 확인 후 실행할 것.
 * 반드시 `validatePayload`를 통과한(=`fetchBackup`이 돌려준) 페이로드만 넘긴다 — 삭제 후
 * INSERT 도중 타입 오류로 던져 부분 복원(데이터 유실)이 나지 않도록 값은 미리 검증돼 있어야 한다.
 * (tauri-plugin-sql은 커넥션 풀이라 JS에서 BEGIN/COMMIT을 나눠 걸어도 한 트랜잭션이 보장되지
 *  않으므로, 원자성 대신 사전 검증으로 실패 지점을 없애는 전략이다.)
 */
export async function importData(payload: BackupPayload): Promise<void> {
  validatePayload(payload); // 방어적 재검증(직접 호출 대비)
  const db = await getDb();
  // FK 때문에 sessions 먼저 비우고, subjects → sessions 순으로 채운다.
  await db.execute("DELETE FROM sessions");
  await db.execute("DELETE FROM subjects");

  for (const s of payload.subjects ?? []) {
    await db.execute(
      `INSERT INTO subjects (id, name, color, sort_order, archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.name, s.color, s.sort_order, s.archived, s.created_at],
    );
  }
  for (const s of payload.sessions ?? []) {
    await db.execute(
      `INSERT INTO sessions
         (id, subject_id, started_at, ended_at, duration_sec, paused_sec, memo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.subject_id, s.started_at, s.ended_at, s.duration_sec, s.paused_sec, s.memo, s.created_at],
    );
  }
  // 설정 upsert(민감/휘발 key는 백업에 없으므로 자연히 유지된다).
  for (const [key, value] of Object.entries(payload.settings ?? {})) {
    if (EXCLUDED_SETTING_KEYS.has(key)) continue;
    await setSetting(key, value);
  }
}

// ── GitHub Contents API ──────────────────────────────────────────

function apiUrl(config: BackupConfig): string {
  const path = config.path.replace(/^\/+/, "");
  return `${API}/repos/${config.owner}/${config.repo}/contents/${path}`;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** 응답이 실패면 GitHub 메시지를 붙여 에러를 던진다. */
async function ensureOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    detail = body?.message ? ` — ${body.message}` : "";
  } catch {
    /* ignore */
  }
  throw new Error(`GitHub ${action} 실패 (HTTP ${res.status})${detail}`);
}

/** 원격 파일의 현재 sha를 조회한다. 없으면(404) undefined. */
async function fetchRemoteSha(config: BackupConfig, token: string): Promise<string | undefined> {
  const url = `${apiUrl(config)}?ref=${encodeURIComponent(config.branch)}`;
  const res = await fetch(url, { method: "GET", headers: headers(token) });
  if (res.status === 404) return undefined;
  await ensureOk(res, "파일 조회");
  const body = (await res.json()) as { sha?: string };
  return body.sha;
}

/**
 * 로컬 데이터를 백업 파일로 커밋한다(신규 생성 또는 갱신).
 * 성공 시 마지막 백업 시각(last_backup_at)을 저장하고 그 값을 반환한다.
 */
export async function pushBackup(config: BackupConfig, token: string): Promise<number> {
  const payload = await exportData();
  const json = JSON.stringify(payload, null, 2);
  const sha = await fetchRemoteSha(config, token);

  const body = {
    message: `study-log backup ${new Date(payload.exported_at * 1000).toISOString()}`,
    content: toBase64Utf8(json),
    branch: config.branch,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(apiUrl(config), {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await ensureOk(res, "백업 업로드");

  const at = nowSec();
  await setSetting(LAST_BACKUP_KEY, at);
  return at;
}

/** 원격 백업 파일을 받아 파싱한다(복원 전용, DB는 건드리지 않음). */
export async function fetchBackup(config: BackupConfig, token: string): Promise<BackupPayload> {
  const url = `${apiUrl(config)}?ref=${encodeURIComponent(config.branch)}`;
  const res = await fetch(url, { method: "GET", headers: headers(token) });
  if (res.status === 404) throw new Error("백업 파일을 찾을 수 없습니다. 먼저 백업을 실행하세요.");
  await ensureOk(res, "백업 다운로드");
  const body = (await res.json()) as { content?: string; encoding?: string };
  if (!body.content) throw new Error("백업 파일 내용을 읽을 수 없습니다.");
  const json = fromBase64Utf8(body.content);
  const payload = JSON.parse(json) as BackupPayload;
  // 파괴적 복원 전에 여기서 전량 검증 → 문제가 있으면 DB를 건드리기 전에 던진다.
  validatePayload(payload);
  return payload;
}

/** 원격 백업을 받아 로컬 DB를 복원한다(전체 교체). 호출부에서 확인 후 실행. */
export async function restoreBackup(config: BackupConfig, token: string): Promise<BackupPayload> {
  const payload = await fetchBackup(config, token);
  await importData(payload);
  return payload;
}
