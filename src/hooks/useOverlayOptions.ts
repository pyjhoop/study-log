import { useEffect, useState } from "react";
import { onOverlayOptionsChanged } from "@/lib/ipc";
import {
  DEFAULT_OVERLAY_OPTIONS,
  loadOverlayOptions,
  type OverlayOptions,
} from "@/lib/overlaySettings";

/**
 * 타이머 오버레이가 커스터마이즈 옵션을 구독하는 훅.
 *  1) 마운트 시 settings에서 로드,
 *  2) 설정 화면에서 바꾸면 `overlay-options-changed` 이벤트로 즉시 반영.
 */
export function useOverlayOptions(): OverlayOptions {
  const [options, setOptions] = useState<OverlayOptions>(DEFAULT_OVERLAY_OPTIONS);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void loadOverlayOptions().then((o) => {
      if (!cancelled) setOptions(o);
    });

    void onOverlayOptionsChanged<OverlayOptions>((o) => setOptions(o)).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return options;
}
