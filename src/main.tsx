import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./index.css";

import MainApp from "./windows/MainApp";
import TimerOverlay from "./windows/TimerOverlay";
import QuickStart from "./windows/QuickStart";
import { ErrorBoundary } from "./components/ErrorBoundary";

/**
 * 하나의 프론트엔드 번들을 3개 창(main/timer/quickstart)이 공유한다.
 * getCurrentWindow().label 로 어떤 화면을 렌더할지 분기한다.
 */
const label = getCurrentWindow().label;

// 어디서도 안 잡힌 비동기 예외를 콘솔에 남긴다(조용히 사라지지 않게).
// 사용자 대면 에러는 각 화면의 try/catch→toast, 렌더 예외는 ErrorBoundary가 담당.
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
});
window.addEventListener("error", (e) => {
  console.error("[window.onerror]", e.error ?? e.message);
});

// 투명 배경이 필요한 창은 html 에 표시해 index.css 에서 배경을 제거한다.
if (label === "timer" || label === "quickstart") {
  document.documentElement.setAttribute("data-window", label);
}

function Root() {
  switch (label) {
    case "timer":
      return <TimerOverlay />;
    case "quickstart":
      return <QuickStart />;
    case "main":
    default:
      return <MainApp />;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary label={label}>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
