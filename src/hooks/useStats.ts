import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { onSessionSaved } from "@/lib/ipc";
import { getSetting, setSetting } from "@/lib/settings";
import { fetchStatRows, type StatRow } from "@/lib/stats";

/** 일일 목표시간(분) 설정 키. 설정 화면(단계 7)도 같은 키를 쓴다. */
export const DAILY_GOAL_KEY = "daily_goal_min";
/** 기본 일일 목표(분). */
export const DEFAULT_DAILY_GOAL_MIN = 120;

/**
 * 대시보드 통계 데이터 훅. 세션 원시 행 + 일일 목표(분)를 로드하고,
 * 세션 저장(`session-saved`) 시 자동으로 다시 읽는다(집계·차트는 화면에서 useMemo로 파생).
 */
export function useStats() {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [goalMin, setGoalMin] = useState(DEFAULT_DAILY_GOAL_MIN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [r, g] = await Promise.all([
        fetchStatRows(),
        getSetting<number>(DAILY_GOAL_KEY),
      ]);
      setRows(r);
      if (typeof g === "number" && g > 0) setGoalMin(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 세션이 저장되면(오버레이/핫키/패널 어디서 종료하든) 통계를 다시 읽는다.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void onSessionSaved(() => {
      void reload();
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [reload]);

  /** 일일 목표(분) 저장 + 즉시 반영. 저장 실패 시 toast로 알린다(조용히 삼키지 않게). */
  const saveGoal = useCallback(async (min: number) => {
    const clamped = Math.max(0, Math.min(1440, Math.round(min)));
    try {
      await setSetting(DAILY_GOAL_KEY, clamped);
      setGoalMin(clamped);
    } catch (e) {
      toast.error(`목표 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  return { rows, goalMin, loading, error, reload, saveGoal };
}
