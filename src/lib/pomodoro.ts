import { getSetting, setSetting } from "./settings";

/**
 * 뽀모도로 설정(기획서 §10-1). 켜면 측정 중 오버레이가 남은 시간 카운트다운 + 사이클을 표시하고,
 * 집중 구간이 끝나면 알림 후 자동으로 휴식으로 전환한다(그 반대도).
 *
 * **구현 모델**: 하나의 측정 세션 안에서 **휴식 = 자동 일시정지**로 처리한다. 측정 엔진이
 * 이미 일시정지 시간을 공부 시간에서 제외하므로, 세션 하나의 duration이 곧 집중 시간 합계가 된다
 * (집중 구간만 적립). 자동 전환 로직은 오버레이 창의 usePomodoro 컨트롤러가 담당한다.
 */
export interface PomodoroConfig {
  enabled: boolean;
  /** 집중 길이(분). */
  focusMin: number;
  /** 짧은 휴식(분). */
  shortBreakMin: number;
  /** 긴 휴식(분). */
  longBreakMin: number;
  /** 몇 번의 집중마다 긴 휴식을 넣을지. */
  cyclesUntilLong: number;
  /** 전환 시 데스크톱 알림을 보낼지. */
  notify: boolean;
}

/** 기본값(기획서 §10-1: 집중 25 / 휴식 5 / 롱브레이크). */
export const DEFAULT_POMODORO: PomodoroConfig = {
  enabled: false,
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  cyclesUntilLong: 4,
  notify: true,
};

const POMODORO_KEY = "pomodoro";

/** 저장된 설정을 기본값과 병합해 읽는다. */
export async function loadPomodoro(): Promise<PomodoroConfig> {
  const saved = await getSetting<Partial<PomodoroConfig>>(POMODORO_KEY);
  return { ...DEFAULT_POMODORO, ...(saved ?? {}) };
}

/** 설정 저장. */
export async function savePomodoro(config: PomodoroConfig): Promise<void> {
  await setSetting(POMODORO_KEY, config);
}
