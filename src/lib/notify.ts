import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/**
 * 시스템 알림 전송(best-effort). 권한이 없으면 먼저 요청하고, 허용된 경우에만 보낸다.
 * 실패는 조용히 무시한다 — 알림은 부가 기능이라 앱 흐름을 막지 않는다.
 * (창별 capability에 notification 권한이 있어야 동작: main·timer 창에 부여됨.)
 */
export async function notify(title: string, body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    /* ignore — 알림 실패는 삼킨다. */
  }
}
