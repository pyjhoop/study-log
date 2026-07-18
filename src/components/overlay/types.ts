import type { ReactElement } from "react";
import type { PomodoroView } from "@/hooks/usePomodoro";

/**
 * 오버레이 variant 컴포넌트가 공유하는 표시용 뷰모델.
 * `TimerOverlay`가 옵션 + 측정상태 + 뽀모도로 + 목표진행률에서 파생해 만들어 넘긴다.
 * variant는 이 값을 받아 **콘텐츠 배치/모양만** 다르게 렌더한다(드래그·리사이즈·컨트롤은 공용 크롬).
 */
export interface OverlayViewModel {
  /** 표시할 시간 문자열(HH:MM:SS). 뽀모도로 활성 시 남은 시간, 아니면 경과 시간. */
  timeStr: string;
  /** 상태/사이클 · 과목 · 목표% 를 조립한 서브라인(없으면 빈 문자열). */
  subline: string;
  /** 시간 글자 색(휴식>일시정지>기본). */
  timeColor: string;
  /** 과목 색점 색(상태색 우선). */
  dotColor: string;
  /** 기본 글자 색(옵션). */
  textColor: string;
  /** 계산된 배경 색(rgba). variant가 배경을 채울 때 사용(미니멀은 무시). */
  bg: string;
  /** 시간 글자 크기 CSS 값(auto=창비례 clamp / fixed=px). */
  fontSize: string;
  /** 큰 시계용 글자 크기 CSS 값(디지털/뽀모도로 variant). */
  fontSizeBig: string;
  /** 과목 색점 표시 여부. */
  showDot: boolean;
  /** 시간 표시 여부. */
  showTime: boolean;
  /** 일시정지 상태. */
  isPaused: boolean;
  /** 뽀모도로 휴식 상태. */
  isBreak: boolean;
  /** 오늘 목표 대비 진행률 %(0~ ). 목표 없음/미로드면 null. 링/막대 variant가 사용. */
  progressPct: number | null;
  /** 뽀모도로 상태(뽀모도로 variant가 사용). */
  pomo: PomodoroView;
}

/** 모든 variant 컴포넌트의 공통 시그니처. */
export type OverlayVariantComponent = (props: { vm: OverlayViewModel }) => ReactElement;
