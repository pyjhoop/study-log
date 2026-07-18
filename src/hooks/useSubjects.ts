import { useCallback, useEffect, useState } from "react";
import { listSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/types";

/**
 * 과목 목록을 로드/보관하는 훅. CRUD 자체는 `lib/subjects.ts`를 직접 호출하고,
 * 변경 후 `reload()`로 목록을 다시 읽는다(로컬 단일 사용자라 낙관적 갱신은 생략).
 */
export function useSubjects(includeArchived = false) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const rows = await listSubjects(includeArchived);
      setSubjects(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { subjects, loading, error, reload };
}
