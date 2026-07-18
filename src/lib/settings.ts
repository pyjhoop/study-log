import { getDb } from "./db";

/**
 * 앱 설정(settings) 접근 계층. key-value(값은 JSON 문자열) 테이블에 임의 구조를 저장한다.
 * 오버레이 위치/크기, (이후 단계) 핫키 바인딩·오버레이 옵션·목표시간 등이 여기에 담긴다.
 * 값은 반드시 `?` 파라미터 바인딩한다.
 */

/** 설정 값을 읽어 JSON 파싱해 돌려준다. 없거나 파싱 실패면 null. */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return null;
  }
}

/** 설정 값을 JSON 문자열로 upsert 저장한다. */
export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}
