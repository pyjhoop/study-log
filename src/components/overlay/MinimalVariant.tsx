import type { OverlayViewModel } from "./types";

/**
 * 미니멀: 배경 없이 시간만. 공부 화면을 최대한 안 가린다.
 * 배경이 없으므로 가독성용 text-shadow로 어떤 화면 위에서도 보이게 한다.
 */
export function MinimalVariant({ vm }: { vm: OverlayViewModel }) {
  return (
    <div className="pointer-events-none flex h-full w-full items-center justify-center px-2">
      {vm.showTime && (
        <span
          className="font-mono font-bold leading-none tabular-nums"
          style={{
            fontSize: vm.fontSizeBig,
            color: vm.timeColor,
            textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)",
          }}
        >
          {vm.timeStr}
        </span>
      )}
    </div>
  );
}
