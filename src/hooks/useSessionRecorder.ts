import { useEffect } from "react";
import { toast } from "sonner";
import { onSessionFinished } from "@/lib/ipc";
import { saveSession } from "@/lib/sessions";
import { getSubject } from "@/lib/subjects";
import { formatHMS } from "@/lib/time";

/**
 * 측정 종료(`session-finished`) 시 세션을 DB에 저장하는 단일 리스너.
 * 종료가 어디서 일어나든(측정 패널·오버레이 미니컨트롤·이후 핫키/트레이) 저장 경로를
 * **메인 창 한 곳**으로 모은다(기획서 §5-2 "세션 저장은 메인 창 JS가 수행").
 * 메인 창에서 한 번만 마운트할 것.
 */
export function useSessionRecorder() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void onSessionFinished(async (summary) => {
      try {
        const saved = await saveSession(summary);
        const name = (await getSubject(summary.subject_id))?.name ?? "과목";
        if (saved) {
          toast.success(`세션 저장: ${name} · ${formatHMS(summary.duration_sec)}`);
        } else {
          toast.info("공부 시간이 0초여서 저장하지 않았습니다.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
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
