import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * 자동 업데이트(기획: 자동 업데이트). GitHub Release의 `latest.json`을 확인해
 * **서명된** 설치본을 내려받아 설치하고 앱을 재시작한다. 서명 검증은 Rust(updater 플러그인)가
 * `tauri.conf.json`의 `plugins.updater.pubkey`로 수행하므로, 위·변조된 업데이트는 설치되지 않는다.
 *
 * 업데이터는 **업데이터가 포함된 버전부터** 동작한다(그 이전 설치본은 이 기능이 없어 자동 갱신 불가).
 */

export type { Update };

/** 진행 상태(다운로드 바이트 추적용). */
export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

/** 새 버전이 있으면 Update 객체, 없으면 null. 네트워크/서버 오류는 throw. */
export async function checkForUpdate(): Promise<Update | null> {
  return check();
}

/**
 * 업데이트를 내려받아 설치한다. 진행률을 콜백으로 알린다.
 * 설치가 끝나면 `relaunch()`로 새 버전을 띄운다(Windows NSIS는 passive 모드로 조용히 설치).
 */
export async function downloadAndInstall(
  update: Update,
  onProgress?: (p: UpdateProgress) => void,
): Promise<void> {
  let total: number | null = null;
  let downloaded = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? null;
        onProgress?.({ downloaded, total });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.({ downloaded, total });
        break;
      case "Finished":
        onProgress?.({ downloaded, total });
        break;
    }
  });
  await relaunch();
}
