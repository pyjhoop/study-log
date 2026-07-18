# 개발 진행 상황 (PROGRESS)

> 이 문서는 **세션 간 핸드오프**용이다. 단계마다 세션을 새로 열어 진행하므로,
> 새 세션은 이 문서 + [`CLAUDE.md`](./CLAUDE.md) + [`docs/`](./docs) 만 읽고 이어서 작업한다.
> **한 단계를 끝내면: 이 문서의 체크리스트/로그 갱신 → 커밋·푸시 → 사용자 테스트.**

- 리포: `github.com/pyjhoop/study-log` (origin, 브랜치 `main`)
- 기획 로드맵 원본: [`docs/02-핵심기능-기획서.md`](./docs/02-핵심기능-기획서.md) §11

---

## 단계 체크리스트

| 단계 | 내용 | 상태 |
|------|------|------|
| 0 | 스캐폴딩 (Tauri v2 + React/TS + Tailwind + shadcn/ui, 3-창, capabilities 골격) | ✅ 완료 |
| 1 | DB 계층(tauri-plugin-sql + 마이그레이션) + 과목 CRUD/관리 화면 | ✅ 완료 |
| 2 | 측정 엔진 (Rust 상태/커맨드/이벤트) — 임시 버튼 검증 | ✅ 완료 |
| 3 | 타이머 오버레이 창 (드래그·크기조절·숨김/표시·위치 복원) | ✅ 완료 |
| 4 | 전역 핫키 + 빠른 시작 피커 | ✅ 완료 |
| 5 | 세션 저장 + 기록 화면 | ✅ 완료 |
| 6 | 대시보드 통계 (일/주/월 + 오늘 목표 링) | ✅ 완료 |
| 7 | 부가기능: 뽀모도로/목표 → 트레이 → 오버레이 커스터마이즈 + 설정 화면 | ⬜ |
| 8 | 폴리시 & 패키징 (빈 상태/에러, 아이콘, 빌드) | ⬜ |

---

## 환경 셋업 (중요)

- **Windows Smart App Control(스마트 앱 제어)를 껐다.** (2026-07-18)
  - 켜져 있으면(강제 상태) cargo가 컴파일한 서명 없는 빌드 스크립트 실행이 차단됨 → Tauri 빌드 불가 (`os error 4551`).
  - 확인 방법: `Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -Name VerifiedAndReputablePolicyState` → **0 = Off** 이어야 함.
  - ⚠️ 한 번 끄면 Windows 초기화 없이는 다시 못 켠다.
- 툴체인: Rust 1.97.1 / cargo / Node v24 / npm 11. (모두 설치 완료)

### 실행 명령
```bash
npm install            # 최초 1회 (의존성)
npm run tauri dev      # 개발 모드 (Vite + Tauri). 첫 Rust 빌드 ~1~2분
npm run build          # 프론트 타입체크 + 번들 (빠른 검증용)
npm run tauri build    # 배포 빌드 (단계 8)
```

---

## 단계별 완료 로그

### ✅ 단계 6 — 대시보드 통계 (2026-07-18)
**한 일**
- **통계 집계 계층**(`lib/stats.ts`): 세션 원시 행을 **한 번 조회**(`fetchStatRows` — 과목 이름/색 JOIN, 오래된→최근)해서 **일/주/월 버킷·과목별 분포·오늘/이번주/이번달 합계·연속 학습일수를 전부 JS(로컬 시계)에서 계산**. SQL `strftime` 대신 JS로 집계하는 이유는 주(week) 경계를 SQLite와 정확히 일치시키기 어렵고 빈 버킷 0채움도 어차피 JS라서(개인용 앱이라 전량 조회 비용 무시 가능). 주 경계는 **월요일 시작**, 버킷 수 일14/주8/월6, 빈 버킷은 0. 연속일수는 오늘 아직 공부 전이면 어제부터 세어 하루 중 0으로 안 보이게.
- **데이터 훅**(`hooks/useStats.ts`): 원시 행 + 일일 목표(분, settings `daily_goal_min`, 기본 120) 로드·`reload`·`saveGoal`(0~1440 clamp). **`session-saved` 이벤트 구독**으로 종료→저장 시 자동 새로고침(집계·차트는 화면에서 `useMemo` 파생).
- **저장 완료 신호**(`lib/ipc.ts` + `useSessionRecorder`): 새 이벤트 `session-saved` 추가 — 저장 리스너가 INSERT **성공 후** `emitSessionSaved()` → 대시보드가 **insert 완료 뒤** 통계를 다시 읽음(리로드가 저장과 경합하지 않게, 오버레이/핫키 종료도 반영).
- **대시보드 화면**(`components/dashboard/`): `DashboardScreen`(조합) + ①`LiveMeasure`(과목 select→시작/일시정지/재개/종료 — 피커가 핫키 전용이라 마우스 측정 경로 제공, 상태는 `useSession` 구독) ②`GoalRing`(오늘 누적÷목표 SVG 도넛 + 달성 시 초록, 연필로 **즉석 목표 편집**·프리셋 30/60/120/180/240) ③요약 타일 4개(오늘/이번주/이번달/연속) ④`StudyBarChart`(Recharts 막대 + **일/주/월 토글**, 현재 버킷 강조, 커스텀 툴팁, 빈 기간 안내) ⑤`SubjectDonut`(선택 기간 과목별 도넛+범례·%) ⑥최근 세션 6개. 테마 색은 `hsl(var(--*))`로 라이트/다크 대응.
- **정리**: 단계 2 임시 패널 `components/session/SessionTester.tsx` 삭제(대시보드로 대체), `MainApp` 대시보드 탭 → `<DashboardScreen/>`. **Rust·capabilities·마이그레이션 변경 없음**(조회는 `sql:default`, 목표 저장은 기존 `sql:allow-execute`).

**추가(같은 세션, 통계 페이지 분리)**
- **별도 "통계" 탭 신설**(사이드바 대시보드↔기록 사이, `BarChart3`). 대시보드는 통합 요약 그대로 두고, 통계 페이지는 **일간/주간/월간 전환**으로 더 깊이 본다(`components/stats/`).
- **지난 기간 "같은 시점" 대비 증감(페이스)** — 사용자 선택. `lib/stats.ts` `paceComparison`: 이번 기간 시작~지금 경과 오프셋을 지난 기간 시작에 더한 지점까지를 이전 누적으로 봄(월 비교는 지난달이 짧으면 이번 기간 시작으로 clamp). 일간=오늘vs어제, 주간=이번주vs지난주, 월간=이번달vs지난달. KST는 DST 없어 주/일 오프셋이 정확.
- **기간별 통계 기록 표**(`PeriodTable`): 최근이 위로, 각 행에 학습시간·세션수·**직전(더 이전) 완료 기간 대비 증감**(▲초록/▼빨강). 진행 중인 이번 기간은 '진행 중' 배지 + 증감 생략(완료 기간과 비교 시 오해 방지).
- **집계 확장**: `StatBucket`에 `count`(세션 수) 추가, `buildBuckets`/`rangeStart`에 `count` 파라미터(통계 페이지는 일30·주12·월12로 더 길게). `StudyBarChart`에 `title`/`showToggle` prop + 막대 많을 때 X축 라벨 솎기. `time.ts` `formatSignedDurationKo`(`+1시간 40분`). 통계 페이지도 과목별 도넛 재사용.

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2240 모듈 — recharts 번들 포함). Rust 변경 없어 `cargo check` 불필요.
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후:
  - **대시보드**: ①측정 시작→종료 시 오늘 링·요약·차트·최근 세션 **자동 갱신** ②목표 연필→분/프리셋→링·% 반영, 달성 시 초록·🎉 ③일/주/월 토글로 막대·도넛 범위 전환 ④로컬 날짜 기준 집계(주=월요일 시작) ⑤과목 도넛 %·합계 ⑥연속 학습일수 ⑦과목 0개 시 "과목 관리 열기" 유도.
  - **통계**: ①일간/주간/월간 전환 시 증감 카드·막대·기록 표·도넛이 함께 바뀌는지 ②지난 기간 같은 시점 대비 증감(시간·%)이 맞는지(예: 지난주 같은 요일·시각까지와 비교) ③기록 표의 완료 기간 증감 정확·진행 중 행은 '진행 중' 표시 ④지난 기간 기록이 없을 때 "새 기록" 표시.

### ✅ 단계 5 — 세션 저장 + 기록 화면 (2026-07-18)
**한 일**
- **세션 저장 경로는 이미 완성**(단계 2·3): 측정 종료 → `session-finished` → `useSessionRecorder`(메인 창 단일 리스너)가 `saveSession`으로 INSERT. 이번 단계에서 `saveSession`이 인라인 `Date.now()` 대신 `time.ts`의 `nowSec()`를 쓰도록 정리(중복 제거), 나머지는 그대로.
- **세션 데이터 계층 확장**(`lib/sessions.ts`): `listSessions`(과목 이름·색 JOIN, 최근순, `LIMIT ?`), `createSession`(수동 추가), `updateSession`(수정), `deleteSession`. **`duration_sec`는 저장 계층에서 파생**(`deriveDuration = max(0, ended-started-paused)`) — 프론트가 계산을 흘리지 않게. 전부 `?` 바인딩.
- **타입**(`lib/types.ts`): `SessionWithSubject`(= Session + `subject_name`/`subject_color`), `SessionInput`(subject/시작/종료/paused/memo, duration 제외). 기존 `Session`의 "단계 5에서 사용" 주석 정리.
- **시간 헬퍼**(`lib/time.ts`): `formatDurationKo`(초→"1시간 23분"), `formatDayLabel`("2026-07-18 (금)"), `formatClock`("14:05"), `toDatetimeLocal`/`fromDatetimeLocal`(epoch ↔ `datetime-local` 값, 로컬 tz). 모두 같은 기기 로컬 시계 기준.
- **기록 화면**(`components/records/RecordsScreen.tsx` + `SessionEditor.tsx`, `hooks/useSessions.ts`): 세션을 **일별로 그룹핑**(날짜 헤더 + 그날 합계), 각 항목에 과목 색점·이름·시작~종료·공부시간 배지·메모. hover 시 수정/삭제 노출. **수동 추가**(우상단, 과목 없으면 비활성)와 **수정**은 같은 `SessionEditor` 모달(과목 select+보관 과목 포함, 시작/종료 `datetime-local`, 메모 textarea, 공부시간 실시간 미리보기, 종료≤시작 검증). 삭제는 `ConfirmDialog`. 빈 상태 2가지(과목 없음/기록 없음). 에러는 전부 toast.
- **연결**: `MainApp`의 `records` 탭 플레이스홀더 → `<RecordsScreen/>`. (Rust·capabilities 변경 없음 — 조회는 `sql:default`, 쓰기는 이미 있는 `sql:allow-execute`로 충분.)

**검증 결과**
- `npm run build` ✅ (tsc + vite, 1614 모듈). Rust 변경 없어 `cargo check` 불필요.
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후 기록 탭에서: ①측정 시작→종료하면 기록 목록에 새 세션이 그날 그룹에 뜨는지 ②수동 추가(과목·시작/종료·메모)→목록 반영·공부시간 계산 ③수정(과목/시각/메모 바꾸면 시간 재계산) ④삭제(확인 후 사라짐) ⑤메모가 목록에 표시되는지 ⑥여러 날짜 세션이 날짜별로 그룹·합계 정확한지 ⑦과목 0개일 때 "수동 추가" 비활성 + 안내.

### ✅ 단계 4 — 전역 핫키 + 빠른 시작 피커 (2026-07-18)
**한 일**
- **핫키 등록은 메인 창 JS**(`@tauri-apps/plugin-global-shortcut`)에서 수행(`hooks/useGlobalShortcuts.ts`). 마운트 시 `loadHotkeys()`로 바인딩 읽어 `unregisterAll()` 후 5종 `register()`. 콜백은 **Pressed 상태만** 처리(플러그인이 Press/Release 양쪽 호출). 등록 실패(조합 점유)는 `console.warn`만 — 사용자 안내/재바인딩 UI는 단계 7 설정 화면.
- **핸들러를 정적으로** 유지하려고 **상태 판단을 전부 Rust에 위임**: `commands.rs`에 ① `show_quickstart`(Idle일 때만 `quickstart` 창 show+set_focus, 아니면 무시), ② `toggle_pause`(Running↔Paused 한 커맨드로 통합) 추가. 종료는 기존 `stop_session`(Idle이면 Rust가 거절→JS는 swallow). 덕분에 JS가 측정 상태를 추적할 필요 없음. `lib.rs` invoke_handler에 2개 등록.
- **5종 핫키**(기획서 §6, 기본값 `lib/hotkeys.ts`): 시작 `Ctrl+Alt+S`→피커 / 종료 `Ctrl+Alt+E` / 정지·재개 `Ctrl+Alt+P` / 대시보드 `Ctrl+Alt+D`→메인 표시·포커스 / 오버레이 `Ctrl+Alt+H`→`toggle_overlay`. 바인딩은 `settings`의 `hotkeys` 키(JSON), 누락 키는 기본값 병합.
- **빠른 시작 피커**(`windows/QuickStart.tsx`): 과목 목록+검색 필터, `↑/↓` 순환 이동+`Enter`, **숫자키 1~9 즉시 선택**(preventDefault로 입력창에 안 들어감), `Esc` 취소. 선택 시 `start_session`→창 `hide()`(오버레이는 Rust가 자동 표시). 창은 숨김 재사용이므로 **`onFocusChanged`로 재표시마다 목록·필터·선택 초기화 + 입력 포커스**. 과목이 하나도 없으면 "과목 관리 열기"(→`requestFocusMain('subjects')`)로 유도.
- **메인 창 표시·포커스 경로 일원화**: `focus-main` 이벤트(`ipc.ts` `requestFocusMain`/`onFocusMain`). 대시보드 핫키는 `MainApp`이 자기 창을 `unminimize→show→setFocus`(+화면 전환), 피커 빈 상태는 이 이벤트로 메인 창을 과목 관리 화면으로 연다.
- **권한(창별 최소)**: `main.json`에 `global-shortcut:allow-register`/`allow-unregister`/`allow-unregister-all` + 자기 창 제어 `core:window:allow-show`/`allow-set-focus`/`allow-unminimize` 추가. `quickstart.json`에 `core:window:allow-hide` 추가(표시·포커스는 Rust `show_quickstart`가 처리하므로 JS 권한 불필요).

**검증 결과**
- `npm run build` ✅ (tsc + vite) · `cargo check` ✅ (경고·에러 0, tauri-build가 capabilities 권한 식별자까지 검증)
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후 **다른 앱(메모장 등)에 포커스를 둔 채로**: `Ctrl+Alt+S`→중앙에 피커 팝업(타이핑 필터·↑↓·숫자키·Esc), 과목 선택→측정 시작+오버레이 표시, `Ctrl+Alt+P` 정지/재개(오버레이 색 변화), `Ctrl+Alt+H` 오버레이 숨김/표시, `Ctrl+Alt+D` 메인 창 앞으로, `Ctrl+Alt+E` 종료+"세션 저장" toast. 과목이 없을 때 피커의 "과목 관리 열기"로 메인 유도.

### ✅ 단계 3 — 타이머 오버레이 창 (2026-07-18)
**한 일**
- **오버레이 표시/숨김을 Rust가 자동 제어**: `commands.rs` `start_session` 성공 시 `timer` 창 `show()`, `stop_session` 시 `hide()`(기획서 §8-2). `get_webview_window("timer")` 사용(`use tauri::Manager`). 실패해도 측정은 계속되게 에러는 삼킴(`set_overlay_visible`).
- **종료 저장 경로 일원화**: `stop_session`이 요약을 `session-finished` 이벤트로도 emit. **메인 창의 `useSessionRecorder`가 유일한 저장 리스너**로 받아 `saveSession`+toast 수행 → 오버레이·(이후)핫키·트레이 어디서 종료해도 저장이 한 곳으로 모임. 기존 `SessionTester`의 종료 시 직접 저장 로직은 제거(중복 저장 방지, 종료만 트리거).
- **`toggle_overlay` 커맨드 추가**(반환: 토글 후 표시 여부) — 단계 4 오버레이 핫키·단계 7 트레이가 재사용. `lib.rs` `invoke_handler`에 등록. (커스텀 커맨드는 capabilities 권한 불필요.)
- **오버레이 창 UI**(`windows/TimerOverlay.tsx`): `useSession`으로 라이브 `HH:MM:SS`, 과목 색점+이름, 일시정지 시 앰버색·깜빡임. 알약 전체가 `data-tauri-drag-region`(내부 텍스트는 `pointer-events-none`로 드래그 위임), 우하단 그립 `startResizeDragging('SouthEast')`, **마우스 오버 시에만** 일시정지/재개·종료 미니 컨트롤 노출.
- **위치·크기 복원**(`hooks/useOverlayWindow.ts`): 마운트 시 `settings`의 `overlay_geometry`(물리 px) 읽어 `setSize`/`setPosition`으로 복원, 이동/크기조절 이벤트를 400ms 디바운스로 저장. 복원 중 되쓰기 방지 플래그.
- **설정 K-V 계층**(`lib/settings.ts`): `getSetting`/`setSetting`(JSON, upsert, `?` 바인딩). `lib/subjects.ts`에 `getSubject(id)` 추가.
- **권한**: `capabilities/timer.json`에 창 이동/크기(`start-dragging`/`start-resize-dragging`/`outer-position`/`inner-size`/`set-position`/`set-size`) + `sql:default`+`sql:allow-execute`(오버레이가 자기 위치/과목명 조회) 최소 권한 추가.
- **IPC 래퍼**: `lib/ipc.ts`에 `EVENT_SESSION_FINISHED`/`onSessionFinished`/`toggleOverlay`. `SessionTester`에 "오버레이 표시/숨김" 토글 버튼(수동 검증용).

**검증 결과**
- `npm run build` ✅ (tsc + vite) · `cargo check` ✅ (경고·에러 0)
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후: 측정 시작 시 오버레이 자동 표시, 다른 앱 위 항상 표시, **드래그 이동**·**우하단 크기조절**, 마우스 오버 시 일시정지/종료 버튼, 종료 시 자동 사라짐+"세션 저장" toast(메인), **앱 재실행 시 위치·크기 복원**, "오버레이 표시/숨김" 버튼 토글.

### ✅ 단계 2 — 측정 엔진 (Rust 상태/커맨드/이벤트) (2026-07-18)
**한 일**
- **Rust 상태 단일 소스**: `src-tauri/src/state.rs` — `Status`(Idle/Running/Paused) enum, `Measurement` 구조체(기획서 §5-1 필드 그대로), `elapsed(now)`(일시정지 제외 경과 계산 §5-3), 직렬화용 `SessionSnapshot`(원시 필드 + `elapsed_sec`/`server_now`), 종료 요약 `SessionSummary`. `now_epoch()`는 `SystemTime` 사용(chrono 미도입).
- **커맨드 5종**: `src-tauri/src/commands.rs` — `start_session(subject_id)`/`pause_session`/`resume_session`/`stop_session`/`get_session_state`. 전부 `Result<T, String>`, 잘못된 상태 전이는 한글 에러로 거절. 상태 변경 후 `emit("session-changed", snapshot)`으로 전 창 브로드캐스트(락 drop 후 emit). `stop_session`은 요약만 반환하고 Idle로 리셋 — **세션 INSERT는 메인 창 JS가 수행**(§5-2).
- **등록**: `lib.rs`에 `mod state/commands`, `.manage(Mutex::new(Measurement::idle()))`, `invoke_handler(generate_handler![...])`. (커스텀 앱 커맨드는 capabilities 권한 불필요, 이벤트는 기존 `core:default`로 충분 → capabilities 변경 없음.)
- **프론트 IPC 계층**: `lib/ipc.ts`(invoke/listen 래퍼 + `EVENT_SESSION_CHANGED`), `lib/time.ts`(`computeElapsed`/`formatHMS`/`nowSec` — 오버레이 재사용), `lib/sessions.ts`(`saveSession` — duration 0이면 저장 skip), `lib/types.ts`에 `SessionStatus`/`SessionSnapshot`/`SessionSummary` 추가.
- **구독 훅 + 검증 UI**: `hooks/useSession.ts`(마운트 시 `get_session_state` 복구 → `session-changed` 구독 → Running 중 1초 틱으로 `elapsedSec`만 재계산). `components/session/SessionTester.tsx`(과목 선택→시작, 일시정지/재개, 종료→DB 저장+toast, 상태 배지, 라이브 `HH:MM:SS`). `MainApp` **대시보드 탭**에 임시 연결.

**검증 결과**
- `cargo check` ✅ (경고·에러 0)
- `npm run build` ✅ (tsc 타입체크 + vite 번들 통과)
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후 대시보드 탭에서: 과목 선택→시작(시간 흐름), 일시정지(멈춤)→재개(정지분 제외하고 이어짐), 종료→"세션 저장" toast, **측정 중 새로고침(F5)해도 상태·경과시간 복구**(=Rust 단일 소스), 기록 저장은 단계 5 기록 화면에서 최종 확인(현재는 DB에 INSERT까지).

### ✅ 단계 1 — DB 계층 + 과목 관리 화면 (2026-07-18)
**한 일**
- **마이그레이션**: `src-tauri/migrations/0001_init.sql` — `subjects`/`sessions`/`settings` 테이블 + 인덱스(기획서 §9 스키마 그대로). `lib.rs`에서 `tauri_plugin_sql::Builder::add_migrations(DB_URL, …)`로 등록(`DB_URL = "sqlite:studylog.db"`, 프론트 `db.ts`와 일치). `include_str!`로 SQL 파일 임베드.
- **권한 보강**: `capabilities/main.json`에 `sql:allow-execute` 추가. (`sql:default`는 select/load/close만 허용 → INSERT/UPDATE/DELETE에 필요.)
- **프론트 DB 계층**: `lib/types.ts`(Subject/Session), `lib/db.ts`(`getDb()` 연결 싱글턴), `lib/subjects.ts`(CRUD·보관·순서교환, 전부 `?` 파라미터 바인딩). 삭제 시 연결된 세션이 있으면 막고 보관 유도.
- **UI 토대**: `components/ui/{button,input,Modal,ConfirmDialog}.tsx`(shadcn 스타일, radix 미의존 경량 모달). 토스트는 `sonner` 도입(`MainApp`에 `<Toaster richColors>`).
- **과목 관리 화면**: `components/subjects/{SubjectsScreen,SubjectEditor}.tsx` + `hooks/useSubjects.ts`. 추가/수정(이름·색 팔레트+직접), 보관/해제, 삭제(확인 모달), 위/아래 순서 이동, 보관 과목 토글, 빈 상태. `MainApp`의 "과목 관리" 탭에 연결. 에러는 전부 toast.

**검증 결과**
- `npm run build` ✅ (tsc 타입체크 + vite 번들 통과)
- `cargo check` ✅ (마이그레이션 등록 포함 컴파일)
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후 과목 관리 탭에서: 추가→목록 표시, 수정, 순서 이동, 보관/해제, 삭제(확인), 앱 재실행 후에도 유지(=DB 영속) 확인.

### ✅ 단계 0 — 스캐폴딩 (2026-07-18)
**한 일**
- `create-tauri-app`(react-ts) 베이스라인을 기존 리포에 병합 (docs/·CLAUDE.md·.git 보존).
- **앱 이름 `학습기록`, 식별자 `com.studylog.app`** (`src-tauri/tauri.conf.json`).
- **3-창 구조** 정의: `main`(일반 창) / `timer`(항상위·테두리없음·투명·skipTaskbar·visible:false) / `quickstart`(중앙 팝업·visible:false).
- `src/main.tsx`에서 `getCurrentWindow().label`로 화면 분기 → `src/windows/{MainApp,TimerOverlay,QuickStart}.tsx` (현재 플레이스홀더).
- **Tailwind + shadcn/ui 토대**: `tailwind.config.js`, `postcss.config.js`, `src/index.css`(테마 CSS 변수 light/dark + 투명창 처리), `components.json`, `src/lib/utils.ts`(cn), `@/*` 경로 별칭(tsconfig+vite).
- **플러그인 추가**: Cargo `tauri-plugin-sql`(sqlite), `tauri-plugin-global-shortcut`, `tauri`(tray-icon feature). `src-tauri/src/lib.rs`에서 sql + (desktop)global-shortcut 초기화. npm `@tauri-apps/plugin-sql`, `plugin-global-shortcut`, `recharts`, `lucide-react`.
- **capabilities 창별 분리**: `src-tauri/capabilities/{main,timer,quickstart}.json` (최소 권한, 기존 default.json 삭제).

**검증 결과**
- `npm run build` ✅ (프론트 타입체크/번들 통과)
- `cargo check` ✅ (모든 플러그인 컴파일)
- `npm run tauri dev` ✅ — `학습기록` 창이 뜨고 사이드바 4메뉴(대시보드/기록/과목 관리/설정) 전환 동작. 오류·패닉·권한 문제 없음.
- 참고: `timer`/`quickstart` 창은 `visible:false`라 아직 화면에 안 뜸 (설계상 정상, 단계 3·4에서 표시).

---

## 폴더 구조 현황
```
src/
  main.tsx                 # window.label 분기 진입점
  index.css                # Tailwind + 테마 토큰
  windows/                 # MainApp(대시보드/통계/기록/과목/저장리스너/핫키등록) / TimerOverlay(완성) / QuickStart(피커 완성)
  hooks/{useSubjects,useSessions,useSession,useStats,useOverlayWindow,useSessionRecorder,useGlobalShortcuts}.ts
  #   과목목록 / 세션목록 / 측정상태구독 / 대시보드통계(행+목표+session-saved구독) / 오버레이 위치·크기 / 종료→저장 리스너 / 전역핫키 등록(메인 창)
  lib/{utils,db,types,subjects,ipc,sessions,stats,time,settings,hotkeys}.ts
  #   cn / DB연결 / 타입 / 과목CRUD / invoke·event래퍼(+showQuickstart/togglePause/focus-main/session-saved) / 세션 저장·조회·수정·삭제 / 통계 집계(일주월버킷·과목분포·연속일·페이스비교) / 경과·날짜·duration·증감계산 / settings K-V / 핫키
  components/
    ui/{button,input,Modal,ConfirmDialog}.tsx
    subjects/{SubjectsScreen,SubjectEditor}.tsx
    records/{RecordsScreen,SessionEditor}.tsx   # 세션 일별 목록/수정/삭제/수동 추가·메모
    dashboard/{DashboardScreen,LiveMeasure,GoalRing,StudyBarChart,SubjectDonut}.tsx  # 통합 요약 대시보드(Recharts)
    stats/{StatsScreen,ComparisonCard,PeriodTable}.tsx  # 일/주/월 통계 + 지난 기간 같은 시점 대비 증감
src-tauri/
  src/
    lib.rs                 # 플러그인 초기화 + 마이그레이션 + manage(상태) + invoke_handler
    main.rs
    state.rs               # Measurement(측정 상태 단일 소스) + Status + 스냅샷/요약
    commands.rs            # start/pause/resume/stop/get_session_state/toggle_overlay/show_quickstart/toggle_pause
                           #   (+ session-changed/session-finished emit, 시작·종료 시 오버레이 show/hide)
                           # (tray.rs는 단계 7)
  migrations/0001_init.sql # subjects/sessions/settings
  capabilities/{main,timer,quickstart}.json   # main:sql+global-shortcut+자기창제어 / quickstart:hide
  tauri.conf.json          # 3-창 + productName/identifier
  Cargo.toml
docs/                      # 기획/결정 문서
PROGRESS.md                # (이 문서)
CLAUDE.md                  # 개발 가이드·규약
```

---

## 다음 세션 시작 가이드
1. 이 문서 + `CLAUDE.md` + `docs/02-핵심기능-기획서.md` 확인.
2. 스마트 앱 제어 Off 상태 확인(위 명령), `npm install` 되어 있는지 확인.
3. **체크리스트에서 다음 ⬜ 단계**를 진행. (예: "단계 1 진행해줘")
4. 규약: 커밋 메시지 `type: 한글 요약`, SQL 파라미터 바인딩 필수, 창별 최소 권한, 에러는 toast.
5. 단계 완료 시: 이 문서 갱신 → 커밋·푸시 → 사용자에게 테스트 안내.
