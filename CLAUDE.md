# CLAUDE.md — 개발 가이드

> 이 파일은 이 리포에서 코드를 작성할 때 지켜야 할 **기술 스택 · 아키텍처 · 공통 규약**을 정리한다.
> **읽는 사람 전제:** 이 프로젝트 오너는 **Java / Spring 백엔드 개발자**다. 설명은 Spring 개념에 빗대어 하되, Spring의 무거운 아키텍처(빈/DI 컨테이너, JPA/ORM, 계층 강제, 어노테이션/AOP)를 그대로 옮겨오지 말고 이 스택(가벼운 UI + 얇은 네이티브 코어 + 직접 SQL)에 맞춘다.

---

## 1. 프로젝트 개요

로컬에서 동작하는 **개인용 학습기록 데스크톱 앱**(Windows). 학습 시간을 측정·기록하고 일/주/월 통계를 시각화한다. 서버·클라우드 없이 로컬 SQLite에 저장한다.

- 기획/결정 문서: [`docs/01-기술스택-결정.md`](./docs/01-기술스택-결정.md), [`docs/02-기획-v1-핵심기능.md`](./docs/02-기획-v1-핵심기능.md)

---

## 2. 기술 스택

| 구분 | 선택 |
|------|------|
| 데스크톱 프레임워크 | **Tauri v2** |
| 프론트엔드 | **React + TypeScript** |
| 스타일 | **Tailwind CSS + shadcn/ui** |
| 로컬 저장 | **SQLite** (`tauri-plugin-sql`) |
| 백엔드(코어) | **Rust** |
| 차트 | Recharts (구현 시 확정) |
| 주요 플러그인 | `tauri-plugin-sql`, `tauri-plugin-global-shortcut`, (선택) `tauri-plugin-positioner` |

**실행 명령**
```bash
npm run tauri dev      # 개발 모드 (React + Tauri 동시)
npm run tauri build    # 배포 빌드
cargo --version        # (선행) Rust 툴체인 설치 확인
```

---

## 3. 아키텍처 (코드 관점)

### 3-1. 큰 그림
```
┌─────────────── React (WebView, UI) ───────────────┐
│  main 창 | timer 오버레이 | quickstart 피커        │
│         (같은 번들 → window.label로 화면 분기)      │
└───────────────┬───────────────────────────────────┘
                │  invoke(요청/응답)  +  event(브로드캐스트)
┌───────────────▼───────────────────────────────────┐
│           Rust (Tauri 코어)                         │
│  측정 상태(단일 소스) · 커맨드 · 이벤트 · 트레이     │
└───────────────┬───────────────────────────────────┘
                │  tauri-plugin-sql
          ┌─────▼─────┐
          │  SQLite   │
          └───────────┘
```

- **3-창 구조**: `main` / `timer` / `quickstart`. 하나의 프론트 번들을 공유하고 `getCurrentWindow().label`로 렌더할 화면을 분기한다. 창 정의는 `tauri.conf.json`의 `app.windows`.
- **React ↔ Rust 경계**: 오직 `invoke()`(커맨드 = 요청/응답)와 `event`(emit/listen = 브로드캐스트)로만 통신한다. HTTP/REST가 아니다. 함수 호출처럼 쓰지만 프로세스 경계를 넘는다.
- **상태 관리**:
  - **측정 상태**(진행/정지/경과·현재 과목)는 **Rust가 단일 소스**로 들고, 변경 시 `session-changed` 이벤트로 모든 창에 알린다. → 창을 새로 열거나 리로드해도 `get_session_state`로 복구.
  - **UI 상태**(현재 탭, 모달 열림 등)는 React 쪽. 굳이 전역 상태 라이브러리를 도입하지 말고 필요해지면 가벼운 것부터.
- **데이터 접근**: `tauri-plugin-sql`로 **SQL을 직접 작성**한다. ORM 없음.

### 3-2. 폴더 구조 (제안)
```
src/                     # React (프론트엔드)
  main.tsx               # window.label로 화면 분기 진입점
  windows/               # MainApp / TimerOverlay / QuickStart
  components/            # 재사용 UI (shadcn/ui 포함)
  hooks/                 # useSession 등 커맨드/이벤트 래핑
  lib/                   # db.ts(sql), ipc.ts(invoke 래퍼), types.ts
src-tauri/
  src/
    lib.rs / main.rs
    commands.rs          # #[tauri::command] 모음
    state.rs             # MeasurementState (Mutex)
    tray.rs
  capabilities/          # 창별 권한 파일 (*.json)
  migrations/            # SQL 마이그레이션
  tauri.conf.json
docs/                    # 기획/결정 문서
```

---

## 4. 공통 코드 · 컨벤션

- **네이밍**
  - TS 변수/함수: `camelCase` · React 컴포넌트/파일: `PascalCase`
  - Rust 함수/변수, DB 테이블·컬럼: `snake_case`
  - Tauri 커맨드: `snake_case`(예: `start_session`) · 이벤트 이름: `kebab-case`(예: `session-changed`)
- **에러 처리**: Rust 커맨드는 `Result<T, String>` 반환 → JS에서 `try/catch` → 사용자에게는 shadcn `toast`로. 조용히 삼키지 말 것.
- **타입 공유**: DB row / 커맨드 payload는 `src/lib/types.ts`에 TS 타입으로 정의해 프론트 전역에서 재사용.
- **스타일**: Tailwind 유틸 우선 + shadcn/ui 컴포넌트. 과목 색은 DB `color` 값, 그 외는 테마 토큰 사용.
- **커밋 메시지**: 기존 스타일 유지 → `type: 한글 요약` (예: `feat: 전역 핫키 등록 추가`, `docs: 기획서 작성`).
- **보안 기본**
  - SQL은 **반드시 파라미터 바인딩**(`?` placeholder). 문자열로 값 이어붙이지 말 것(인젝션).
  - `capabilities`는 **창별 최소 권한**만 부여. 와일드카드로 다 열지 말 것.

---

## 5. 참고 문서

- [`docs/01-기술스택-결정.md`](./docs/01-기술스택-결정.md) — 왜 이 스택인지
- [`docs/02-기획-v1-핵심기능.md`](./docs/02-기획-v1-핵심기능.md) — 기능 세부 기획(V1)
