import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { onCheckUpdate } from "@/lib/ipc";
import { checkForUpdate, downloadAndInstall, type Update, type UpdateProgress } from "@/lib/updater";

type Phase = "idle" | "available" | "downloading" | "error";

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 자동 업데이트 UI. **메인 창에서 한 번만** 렌더한다.
 *  - 시작 시 1회 조용히 새 버전을 확인 → 있으면 팝업(현재/새 버전·릴리스 노트·"지금 업데이트").
 *  - 설정의 "업데이트 확인" 버튼(`check-update` 이벤트)으로 **수동 확인**도 가능(없으면 toast 안내).
 *  - "지금 업데이트" → 다운로드(진행률) → 설치 후 자동 재시작.
 */
export function UpdateDialog() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>({ downloaded: 0, total: null });
  const busyRef = useRef(false); // 확인/설치 중복 방지

  // 확인 실행(manual=true면 결과 없음/오류를 toast로 알린다; 자동은 조용히).
  const runCheck = async (manual: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const found = await checkForUpdate();
      if (found) {
        setUpdate(found);
        setPhase("available");
      } else if (manual) {
        toast.success("이미 최신 버전입니다.");
      }
    } catch (e) {
      if (manual) toast.error(`업데이트 확인 실패: ${e instanceof Error ? e.message : String(e)}`);
      else console.warn("[updater] 자동 확인 실패", e);
    } finally {
      busyRef.current = false;
    }
  };

  // 시작 시 자동 확인 1회 + 설정 버튼(수동) 구독.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void runCheck(false);
    void onCheckUpdate(() => void runCheck(true)).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
    // 마운트 시 1회만. runCheck는 ref로 중복을 막으므로 deps 불필요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const install = async () => {
    if (!update || busyRef.current) return;
    busyRef.current = true;
    setPhase("downloading");
    setProgress({ downloaded: 0, total: null });
    try {
      // 완료되면 relaunch로 새 버전이 뜬다(이 창은 함께 종료됨).
      await downloadAndInstall(update, setProgress);
    } catch (e) {
      busyRef.current = false;
      setPhase("error");
      toast.error(`업데이트 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const downloading = phase === "downloading";
  const open = phase === "available" || phase === "downloading" || phase === "error";
  if (!open || !update) return null;

  const pct =
    progress.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!downloading) setPhase("idle"); // 다운로드 중엔 닫기 무시
      }}
      title="업데이트 있음"
      footer={
        downloading ? (
          <Button disabled>
            <RefreshCw className="animate-spin" />
            설치 중…
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setPhase("idle")}>
              나중에
            </Button>
            <Button onClick={() => void install()}>
              <Download />
              지금 업데이트
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          새 버전 <b className="text-foreground">v{update.version}</b>이 있습니다.
          <span className="text-muted-foreground"> (현재 v{update.currentVersion})</span>
        </p>

        {update.body && (
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {update.body}
          </div>
        )}

        {downloading && (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: pct != null ? `${pct}%` : "40%" }}
              />
            </div>
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {pct != null
                ? `${pct}% · ${formatMB(progress.downloaded)}${
                    progress.total ? ` / ${formatMB(progress.total)}` : ""
                  }`
                : `${formatMB(progress.downloaded)} 받는 중…`}
            </p>
          </div>
        )}

        {!downloading && (
          <p className="text-xs text-muted-foreground">
            업데이트를 받으면 앱이 자동으로 재시작됩니다.
          </p>
        )}
      </div>
    </Modal>
  );
}
