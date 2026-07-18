import { useEffect } from "react";
import { toast } from "sonner";
import { autoBackup } from "@/lib/backup";
import { emitSessionSaved, onSessionFinished, takePendingFinished } from "@/lib/ipc";
import { notify } from "@/lib/notify";
import { saveSession, sessionExists } from "@/lib/sessions";
import { getSubject } from "@/lib/subjects";
import { formatHMS } from "@/lib/time";
import type { SessionSummary } from "@/lib/types";

/**
 * 세션 저장 직후 GitHub 자동 백업(설정돼 있을 때만). 백그라운드 best-effort로 띄운다.
 * 성공하면 시스템 알림, 실패는 조용히 콘솔만 남긴다(오프라인이 이어져도 매번 알림이 뜨지 않게).
 */
async function runAutoBackup() {
  try {
    const at = await autoBackup(); // 미설정이면 null → 아무 것도 안 함
    if (at != null) {
      void notify("GitHub 백업 완료", "학습 데이터를 GitHub에 백업했습니다.");
    }
  } catch (e) {
    console.error("[recorder] 자동 백업 실패", e);
  }
}

/**
 * 측정 종료(`session-finished`) 시 세션을 DB에 저장하는 단일 리스너.
 * 종료가 어디서 일어나든(측정 패널·오버레이 미니컨트롤·핫키/트레이) 저장 경로를
 * **메인 창 한 곳**으로 모은다(기획서 §5-2 "세션 저장은 메인 창 JS가 수행").
 * 메인 창에서 한 번만 마운트할 것.
 *
 * 유실 방어: 종료가 이 리스너 등록 전에 일어나면(예: --autostart 초기 로드) 이벤트를
 * 놓칠 수 있으므로, Rust가 보관해 둔 요약을 **마운트 시 배수(drain)**해 함께 저장한다.
 * 이벤트 경로와 배수 경로가 같은 세션에 겹쳐도 자연키 dedup으로 중복 INSERT되지 않는다.
 */
export function useSessionRecorder() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    // 요약 1건 저장(중복이면 조용히 skip, 0초면 안내). announce=true면 성공 toast.
    const record = async (summary: SessionSummary, announce: boolean) => {
      try {
        if (summary.duration_sec <= 0) {
          if (announce) toast.info("공부 시간이 0초여서 저장하지 않았습니다.");
          return;
        }
        if (await sessionExists(summary.subject_id, summary.started_at, summary.ended_at)) {
          return; // 이미 저장됨(이벤트/배수 중복) — 조용히 skip
        }
        const saved = await saveSession(summary);
        if (saved) {
          const name = (await getSubject(summary.subject_id))?.name ?? "과목";
          toast.success(`세션 저장: ${name} · ${formatHMS(summary.duration_sec)}`);
          void emitSessionSaved(); // 대시보드 통계 새로고침 신호
          void runAutoBackup(); // 백그라운드 자동 백업(비차단)
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    };

    // (1) 마운트 시: 리스너 등록 전에 종료돼 놓친 요약이 있으면 먼저 저장.
    void takePendingFinished()
      .then((p) => {
        if (!cancelled && p) void record(p, true);
      })
      .catch((e) => console.error("[recorder] pending 배수 실패", e));

    // (2) 이후 종료 이벤트를 저장. 저장 후 보관분을 비워 다음 실행에서 재저장되지 않게 한다.
    void onSessionFinished(async (summary) => {
      await record(summary, true);
      void takePendingFinished().catch(() => {});
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
