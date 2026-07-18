import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { emitSessionSaved, getSessionState, onSessionChanged } from "@/lib/ipc";
import { clearLive, readLive, writeLive } from "@/lib/liveSession";
import { saveSession } from "@/lib/sessions";
import { getSubject } from "@/lib/subjects";
import { computeElapsed, formatHMS, nowSec } from "@/lib/time";
import type { SessionSnapshot, SessionSummary } from "@/lib/types";

/** 하트비트 간격(초). 크래시 시 최대 이 값만큼 손실될 수 있다. */
const HEARTBEAT_SEC = 25;

/**
 * 진행 중 스냅샷 → 저장용 요약(now 시점). 과목/시작이 없으면(=idle) null.
 * `stop_session`이 산출하는 값과 계산식이 일치한다(일시정지 시간 제외).
 */
function snapshotToSummary(snap: SessionSnapshot, now: number): SessionSummary | null {
  if (snap.status === "idle" || snap.subject_id == null || snap.started_at == null) return null;
  const pausedNow =
    snap.status === "paused" && snap.paused_at != null ? Math.max(0, now - snap.paused_at) : 0;
  return {
    subject_id: snap.subject_id,
    started_at: snap.started_at,
    ended_at: now,
    duration_sec: computeElapsed(snap, now),
    paused_sec: snap.accumulated_paused_sec + pausedNow,
  };
}

/**
 * 비정상 종료 세션 자동 복구 가드(기획 F1). **메인 창에서 1회만 마운트**한다.
 *
 *  1) 복구: 앱 시작 시 Rust가 idle인데 DB에 진행 중 잔재(live_session)가 남아 있으면
 *     = 지난 실행이 측정 중 비정상 종료된 것 → 마지막 하트비트 시점까지 자동 저장.
 *  2) 지속화: `session-changed`로 running/paused면 스냅샷을 DB에 기록, idle이면 지운다.
 *  3) 하트비트: 측정 중 주기적으로 스냅샷을 갱신해 복구 정확도를 높인다.
 *
 * 측정 상태 단일 소스는 여전히 Rust다. 여기 저장하는 값은 크래시 복구용 백업일 뿐이다.
 */
export function useLiveSessionGuard() {
  const snapRef = useRef<SessionSnapshot | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    // 진행 중 스냅샷을 DB에 기록(있으면)하거나, idle이면 잔재를 지운다.
    const persist = (snap: SessionSnapshot) => {
      const summary = snapshotToSummary(snap, nowSec());
      if (summary) void writeLive(summary).catch(console.error);
      else void clearLive().catch(console.error);
    };

    // (1) 복구 → (2) 구독 순서로 진행. 복구가 먼저 잔재를 읽어야 중복 저장이 안 난다.
    const init = async () => {
      try {
        const state = await getSessionState();
        snapRef.current = state;

        // Rust가 측정 중이면 웹뷰만 리로드된 경우 → 복구 아님. 최신 스냅샷만 기록.
        if (state.status !== "idle") {
          persist(state);
        } else {
          // idle인데 잔재가 있으면 비정상 종료 → 마지막 시점까지 자동 저장.
          const live = await readLive();
          if (live) {
            await clearLive();
            if (live.duration_sec > 0) {
              const saved = await saveSession(live);
              if (saved) {
                const name = (await getSubject(live.subject_id))?.name ?? "과목";
                toast.warning(`비정상 종료된 세션 자동 저장: ${name} · ${formatHMS(live.duration_sec)}`);
                void emitSessionSaved();
              }
            }
          }
        }
      } catch (e) {
        console.error(e);
      }

      if (cancelled) return;

      // (2) 이후 상태 변경을 계속 반영.
      const fn = await onSessionChanged((snap) => {
        snapRef.current = snap;
        persist(snap);
      });
      if (cancelled) fn();
      else unlisten = fn;
    };

    void init();

    // (3) 하트비트: 측정 중이면 주기적으로 스냅샷 갱신.
    const heartbeat = setInterval(() => {
      const snap = snapRef.current;
      if (snap && snap.status !== "idle") persist(snap);
    }, HEARTBEAT_SEC * 1000);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      unlisten?.();
    };
  }, []);
}
