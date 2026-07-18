import { Component, type ReactNode } from "react";

type Props = {
  /** 창 라벨(main/timer/quickstart) — 창에 맞는 폴백을 그린다. */
  label: string;
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * 렌더링 중 던져진 예외를 잡아 흰 화면(WSOD) 대신 복구 UI를 보여준다.
 * - main: 새로고침 버튼이 있는 안내 카드.
 * - timer/quickstart: 투명·소형 창이라 조용히 아무것도 안 그린다(측정은 Rust가 유지).
 * 커맨드/이벤트/DB 등 비동기 에러는 각 화면의 try/catch→toast가 담당하고,
 * 여기서는 그 그물을 빠져나온 렌더 예외만 최후로 받는다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // 콘솔로 남겨 개발/디버깅 때 스택을 확인할 수 있게 한다.
    console.error("[ErrorBoundary]", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // 투명 오버레이/피커 창에서는 큰 에러 카드가 오히려 방해 → 숨긴다.
    if (this.props.label !== "main") return null;

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
        <div className="text-2xl">😵</div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">문제가 발생했어요</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            화면을 그리는 중 오류가 났습니다. 측정 기록은 안전하게 보관되어 있어요.
            새로고침하면 대부분 복구됩니다.
          </p>
        </div>
        <pre className="max-h-32 max-w-md overflow-auto rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
          {error.message || String(error)}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          새로고침
        </button>
      </div>
    );
  }
}
