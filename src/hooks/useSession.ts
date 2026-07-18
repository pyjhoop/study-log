import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSessionState,
  onSessionChanged,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
} from "@/lib/ipc";
import { computeElapsed } from "@/lib/time";
import type { SessionSnapshot, SessionSummary } from "@/lib/types";

/**
 * 측정 상태 구독 훅. Rust가 단일 소스이므로 여기서는:
 *  1) 마운트 시 `get_session_state`로 현재 상태 복구,
 *  2) `session-changed` 이벤트로 이후 변경 반영,
 *  3) Running 중에는 1초마다 경과 시간(elapsedSec)만 로컬에서 다시 계산한다.
 * 커맨드(시작/정지 등)는 그대로 노출하되, 상태 갱신은 이벤트로 들어오므로 여기서 setState하지 않는다.
 */
export function useSession() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const snapRef = useRef<SessionSnapshot | null>(null);

  // 상태 복구 + 이벤트 구독 (마운트 1회).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const apply = (snap: SessionSnapshot) => {
      snapRef.current = snap;
      setSnapshot(snap);
      setElapsedSec(computeElapsed(snap));
    };

    void getSessionState()
      .then((snap) => {
        if (!cancelled) apply(snap);
      })
      .catch(() => {
        /* 초기 조회 실패는 무시 — 이후 이벤트로 복구된다. */
      });

    void onSessionChanged(apply).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Running일 때만 1초 틱으로 경과 시간 갱신(Paused/Idle은 고정값이라 타이머 불필요).
  useEffect(() => {
    if (snapshot?.status !== "running") return;
    const id = setInterval(() => {
      if (snapRef.current) setElapsedSec(computeElapsed(snapRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [snapshot?.status]);

  const start = useCallback((subjectId: number) => startSession(subjectId), []);
  const pause = useCallback(() => pauseSession(), []);
  const resume = useCallback(() => resumeSession(), []);
  const stop = useCallback((): Promise<SessionSummary> => stopSession(), []);

  return {
    snapshot,
    status: snapshot?.status ?? "idle",
    subjectId: snapshot?.subject_id ?? null,
    elapsedSec,
    start,
    pause,
    resume,
    stop,
  } as const;
}
