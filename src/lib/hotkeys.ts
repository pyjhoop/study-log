import { getSetting, setSetting } from "./settings";

/**
 * 전역 핫키 바인딩(기획서 §6). 5종 기능의 단축키 문자열을 settings(JSON)에 저장한다.
 * 값은 Tauri global-shortcut accelerator 형식("Ctrl+Alt+S" 등).
 * 커스터마이즈 UI(키 캡처)는 단계 7 설정 화면에서 붙인다 — 여기서는 로드/기본값/저장만 둔다.
 */
export interface HotkeyBindings {
  /** 측정 시작 → 빠른 시작 피커 표시(Idle일 때만) */
  start: string;
  /** 측정 종료 → 저장 */
  stop: string;
  /** 일시정지/재개 토글 */
  pause: string;
  /** 대시보드(메인 창) 표시·포커스 */
  dashboard: string;
  /** 타이머 오버레이 숨김/표시 토글 */
  overlay: string;
}

/** 기본 단축키(기획서 §6 표). */
export const DEFAULT_HOTKEYS: HotkeyBindings = {
  start: "Ctrl+Alt+S",
  stop: "Ctrl+Alt+E",
  pause: "Ctrl+Alt+P",
  dashboard: "Ctrl+Alt+D",
  overlay: "Ctrl+Alt+H",
};

const HOTKEYS_KEY = "hotkeys";

/** 저장된 바인딩을 읽어 기본값과 병합한다(누락 키는 기본값으로 보정). */
export async function loadHotkeys(): Promise<HotkeyBindings> {
  const saved = await getSetting<Partial<HotkeyBindings>>(HOTKEYS_KEY);
  return { ...DEFAULT_HOTKEYS, ...(saved ?? {}) };
}

/** 바인딩 저장(단계 7 설정 화면에서 사용). */
export async function saveHotkeys(bindings: HotkeyBindings): Promise<void> {
  await setSetting(HOTKEYS_KEY, bindings);
}
