/**
 * 빠른 시작 피커 창 (단계 4에서 과목 목록/필터/키보드 선택 구현).
 * 지금은 중앙 카드 형태 플레이스홀더만 렌더한다.
 */
export default function QuickStart() {
  return (
    <div className="flex h-screen w-screen items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm rounded-2xl border bg-popover p-5 text-popover-foreground shadow-2xl">
        <h2 className="mb-1 text-sm font-semibold">과목 선택</h2>
        <p className="text-xs text-muted-foreground">
          측정을 시작할 과목을 선택하세요 (단계 4에서 구현).
        </p>
      </div>
    </div>
  );
}
