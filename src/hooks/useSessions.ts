import { useCallback, useEffect, useState } from "react";
import { listSessions } from "@/lib/sessions";
import type { SessionWithSubject } from "@/lib/types";

/**
 * 세션 목록을 로드/보관하는 훅. 수정/삭제/추가는 `lib/sessions.ts`를 직접 호출하고
 * 변경 후 `reload()`로 다시 읽는다(과목 관리와 동일한 얇은 패턴).
 */
export function useSessions(limit = 1000) {
  const [sessions, setSessions] = useState<SessionWithSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setSessions(await listSessions(limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sessions, loading, error, reload };
}
