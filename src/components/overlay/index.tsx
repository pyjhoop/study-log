import type { ReactElement } from "react";
import type { OverlayVariantId } from "@/lib/overlaySettings";
import type { OverlayViewModel } from "./types";
import { PillVariant } from "./PillVariant";
import { DigitalVariant } from "./DigitalVariant";
import { MinimalVariant } from "./MinimalVariant";
import { RingVariant } from "./RingVariant";
import { BarVariant } from "./BarVariant";
import { PomodoroVariant } from "./PomodoroVariant";

/** variant 레지스트리: id → 라벨 + 렌더 컴포넌트. 설정 선택기와 타이머 창이 공유한다. */
export const OVERLAY_VARIANTS: {
  id: OverlayVariantId;
  label: string;
  Component: (props: { vm: OverlayViewModel }) => ReactElement;
}[] = [
  { id: "pill", label: "알약", Component: PillVariant },
  { id: "digital", label: "디지털", Component: DigitalVariant },
  { id: "minimal", label: "미니멀", Component: MinimalVariant },
  { id: "ring", label: "링", Component: RingVariant },
  { id: "bar", label: "막대", Component: BarVariant },
  { id: "pomodoro", label: "뽀모도로", Component: PomodoroVariant },
];

/** 선택된 variant를 렌더한다. 알 수 없는 id면 알약으로 폴백. */
export function OverlayVariantView({
  variant,
  vm,
}: {
  variant: OverlayVariantId;
  vm: OverlayViewModel;
}) {
  const entry = OVERLAY_VARIANTS.find((v) => v.id === variant) ?? OVERLAY_VARIANTS[0];
  const { Component } = entry;
  return <Component vm={vm} />;
}

export type { OverlayViewModel } from "./types";
