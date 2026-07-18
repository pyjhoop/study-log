import { getSetting, setSetting } from "./settings";
import { emitOverlayOptionsChanged } from "./ipc";

/**
 * 오버레이 커스터마이즈 옵션(기획서 §10-3). 설정 화면에서 바꾸면 settings(JSON)에 저장하고,
 * `overlay-options-changed` 이벤트로 타이머 창에 즉시 반영한다.
 *  - 투명도(배경 alpha), 배경/글자 색, 글자 크기 모드(창 비례/고정), 표시 항목 토글, 항상 위.
 */
export interface OverlayShowItems {
  /** 경과 시간 HH:MM:SS */
  time: boolean;
  /** 과목명 */
  subject: boolean;
  /** 과목 색 점 */
  dot: boolean;
  /** 일일 목표 대비 % */
  goalPct: boolean;
  /** 일시정지 배지 */
  pausedBadge: boolean;
}

export interface OverlayOptions {
  /** 배경 불투명도 0~100(%). */
  bgOpacity: number;
  /** 배경 기준 색(hex). 실제 알파는 bgOpacity로. */
  bgColor: string;
  /** 글자 색(hex). */
  textColor: string;
  /** 글자 크기 모드: 창 크기 비례(auto) / 고정(fixed). */
  fontMode: "auto" | "fixed";
  /** fontMode가 fixed일 때 글자 크기(px). */
  fontSizePx: number;
  /** 항상 위 on/off. */
  alwaysOnTop: boolean;
  /** 표시 항목 토글. */
  show: OverlayShowItems;
}

/** 기본 옵션 — 현재(단계 3) 오버레이 외형과 동일하게 맞춘다. */
export const DEFAULT_OVERLAY_OPTIONS: OverlayOptions = {
  bgOpacity: 70,
  bgColor: "#000000",
  textColor: "#ffffff",
  fontMode: "auto",
  fontSizePx: 22,
  alwaysOnTop: true,
  show: {
    time: true,
    subject: true,
    dot: true,
    goalPct: false,
    pausedBadge: true,
  },
};

const OVERLAY_OPTIONS_KEY = "overlay_options";

/** 저장된 옵션을 기본값과 병합해 읽는다(누락 키 보정 — 특히 show 하위 키). */
export async function loadOverlayOptions(): Promise<OverlayOptions> {
  const saved = await getSetting<Partial<OverlayOptions>>(OVERLAY_OPTIONS_KEY);
  return {
    ...DEFAULT_OVERLAY_OPTIONS,
    ...(saved ?? {}),
    show: { ...DEFAULT_OVERLAY_OPTIONS.show, ...(saved?.show ?? {}) },
  };
}

/** 옵션 저장 + 타이머 창에 즉시 반영 이벤트 발행. */
export async function saveOverlayOptions(options: OverlayOptions): Promise<void> {
  await setSetting(OVERLAY_OPTIONS_KEY, options);
  await emitOverlayOptionsChanged(options);
}

/** hex(#rrggbb) + 불투명도(%) → `rgba(...)`. 배경색 계산용. */
export function hexToRgba(hex: string, opacityPct: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const int = m ? parseInt(m[1], 16) : 0;
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  const a = Math.max(0, Math.min(100, opacityPct)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
