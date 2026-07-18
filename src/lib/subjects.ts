import { getDb } from "./db";
import type { Subject, SubjectInput } from "./types";

/**
 * 과목(subjects) 데이터 접근 계층. SQL은 직접 작성하되 값은 반드시 `?` 파라미터 바인딩한다.
 * (Spring의 Repository와 역할은 같지만, ORM 없이 얇은 함수 모음으로 둔다.)
 */

/** 과목 목록. 기본은 보관 제외, 정렬 순서 → 생성 순. */
export async function listSubjects(includeArchived = false): Promise<Subject[]> {
  const db = await getDb();
  const where = includeArchived ? "" : "WHERE archived = 0";
  return db.select<Subject[]>(
    `SELECT id, name, color, sort_order, archived, created_at
       FROM subjects ${where}
      ORDER BY sort_order ASC, id ASC`,
  );
}

/** 과목 1건 조회(id). 오버레이가 측정 중인 과목 이름/색을 표시할 때 사용. 없으면 null. */
export async function getSubject(id: number): Promise<Subject | null> {
  const db = await getDb();
  const rows = await db.select<Subject[]>(
    `SELECT id, name, color, sort_order, archived, created_at
       FROM subjects WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** 과목 생성. sort_order는 현재 최대값 + 1로 맨 끝에 붙인다. */
export async function createSubject(input: SubjectInput): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const rows = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM subjects",
  );
  const nextOrder = rows[0]?.next ?? 0;
  await db.execute(
    `INSERT INTO subjects (name, color, sort_order, archived, created_at)
     VALUES (?, ?, ?, 0, ?)`,
    [input.name.trim(), input.color, nextOrder, now],
  );
}

/** 과목 이름/색 수정. */
export async function updateSubject(id: number, input: SubjectInput): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE subjects SET name = ?, color = ? WHERE id = ?", [
    input.name.trim(),
    input.color,
    id,
  ]);
}

/** 보관/보관 해제 토글. */
export async function setSubjectArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE subjects SET archived = ? WHERE id = ?", [archived ? 1 : 0, id]);
}

/**
 * 과목 삭제. 세션이 하나라도 연결돼 있으면 기록 무결성을 위해 막고 보관을 권한다.
 * (SQLite FK가 기본 비활성이라 앱 레벨에서 직접 확인한다.)
 */
export async function deleteSubject(id: number): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) AS cnt FROM sessions WHERE subject_id = ?",
    [id],
  );
  if ((rows[0]?.cnt ?? 0) > 0) {
    throw new Error("이 과목에는 학습 기록이 있어 삭제할 수 없습니다. 대신 보관하세요.");
  }
  await db.execute("DELETE FROM subjects WHERE id = ?", [id]);
}

/**
 * 두 과목의 sort_order를 맞바꿔 순서를 이동한다(위/아래 버튼용).
 * 화면에 보이는 목록에서 인접 항목과 교환하므로 보관 필터와 무관하게 안전하다.
 */
export async function swapSubjectOrder(a: Subject, b: Subject): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE subjects SET sort_order = ? WHERE id = ?", [b.sort_order, a.id]);
  await db.execute("UPDATE subjects SET sort_order = ? WHERE id = ?", [a.sort_order, b.id]);
}
