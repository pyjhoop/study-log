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
| 7 | 부가기능: 뽀모도로/목표 → 트레이 → 오버레이 커스터마이즈 + 설정 화면 | ✅ 완료 |
| 8 | 폴리시 & 패키징 (빈 상태/에러, 아이콘, 빌드) | ✅ 완료 |
| 9 | **v2**: 비정상 종료 세션 자동 복구 · Windows 자동 시작 · GitHub 백업/복원 · Actions 릴리스 자동화 | ✅ 완료 |
| 10 | **v3**: 오버레이 레이아웃(variant) 6종 · 에셋 파일명 영문화(productName) · v3.0.0 | ✅ 완료 |
| 11 | **v3.1**: 대시보드 학습 잔디(GitHub 컨트리뷰션 히트맵) · v3.1.0 | ✅ 완료 |
| 12 | **안정성 보강**(멀티에이전트 코드리뷰 후속): 데이터 유실·경합·견고성·통계 표시 오차 수정 | ✅ 완료 |

- v2 기획: [`docs/03-v2-기능-기획.md`](./docs/03-v2-기능-기획.md)

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

### ✅ 단계 12 — 안정성 보강 (코드리뷰 후속) (2026-07-18)
버전 **3.1.0 → 3.1.1**(버그·안정성 패치, 기능 추가 없음). 상세: [`docs/04-안정성-보강.md`](./docs/04-안정성-보강.md).

**배경**: 서브시스템별 코드리뷰(Rust 코어·세션/뽀모도로·통계·백업·오버레이/UI)로 데이터 유실·경합·견고성·표시 오차를 점검하고 수정.

**한 일(14건)**
- 🔴 **데이터 유실 3**: ①복원 파괴 전 `validatePayload`로 버전·행 전량 검증(부분 복원=유실 방지, `backup.ts`). ②뽀모도로 `blockStartStudy: args.elapsedSec` — 측정 중 리로드가 진행 세션을 강제 일시정지하던 것 수정(`usePomodoro.ts`). ③종료 요약을 Rust `PendingFinished`에 보관 + `take_pending_finished`로 메인 창 마운트 시 배수 → 리스너 준비 전 종료 유실 방어(`commands.rs`/`lib.rs`/`useSessionRecorder.ts`).
- 🟠 **경합 4**: ④핫키 재등록 generation 토큰 직렬화(`useGlobalShortcuts.ts`). ⑤`sessionExists` 자연키 dedup(`sessions.ts`/`useLiveSessionGuard.ts`) — 복구·배수 중복 저장 방지. ⑥단축키 캡처 제어형화 + 활성 행 단일화(`HotkeyCapture.tsx`/`HotkeysSection.tsx`). ⑦오버레이 설정 `optRef` 병합으로 빠른 편집 유실 방지(`OverlaySection.tsx`).
- 🟡 **견고성 4**: ⑧Alt+F4 창 파괴 방지(main/timer/quickstart 모두 hide, `lib.rs`). ⑨오버레이 `clampToMonitors`로 화면 밖 복원 방지 + 권한 2종(`useOverlayWindow.ts`/`timer.json`). ⑩Rust 뮤텍스 poison 복구 `lock()` 헬퍼 + 트레이 아이콘 `expect`→에러 반환(`commands.rs`/`tray.rs`). ⑪백업 버전·스키마 검증(#1에 포함).
- 🟢 **통계 표시 4**: ⑫`samePointInPrev` 달력 연산으로 DST·월말 비교 정확화(`stats.ts`). ⑬히트맵 월 라벨을 1일 포함 열에, "최근 1년"은 365일 카운트(`stats.ts`/`ContributionHeatmap.tsx`). ⑭`StatBucket.prevTotal`로 기간 표 증감 경계 끊김 수정(`stats.ts`/`PeriodTable.tsx`).
- **버전 3.1.1**: `tauri.conf.json`/`Cargo.toml`/`package.json`/사이드바.

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2271 모듈) · `cargo check` ✅ (`study-log v3.1.1`, 에러 0).
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — 체크리스트는 [`docs/04-안정성-보강.md`](./docs/04-안정성-보강.md) "검증 안내" 참고(복원 손상본 방어·리로드 강제휴식·핫키 연속저장·멀티모니터 복귀·Alt+F4·히트맵/표 표시).

### ✅ 단계 11 — v3.1 (대시보드 학습 잔디) (2026-07-18)
버전 **3.0.0 → 3.1.0**(`tauri.conf.json`/`Cargo.toml`/`package.json`/사이드바).

**한 일**
- **학습 잔디**(GitHub 컨트리뷰션 그래프 형태의 일별 히트맵)를 **대시보드 최하단**에 추가. 순수 프론트(Rust/capabilities/마이그레이션 변경 없음, 기존 `useStats.rows` 재사용).
  - `lib/stats.ts` `buildHeatmap(rows, weeksCount=53, now)`: 세션을 날짜별 합계로 접고 **최근 53주(약 1년)**를 **월요일 시작**(앱의 주 경계 규약과 일치) 열들로 만든다. 각 주는 7칸(월~일). 마지막 열이 이번 주이고 오늘 이후 날짜는 `inRange:false`(빈 칸)로 정렬만 유지. 월이 바뀌는 열에 월 라벨(`months`). 타입 `HeatCell`/`Heatmap` 추가.
  - `components/dashboard/ContributionHeatmap.tsx`: 열=주/행=요일 격자, 셀 11px. **색 단계 0~4는 일일 목표(`goalMin`) 대비 비율**(0 / <50% / <100% / <150% / ≥150%)로 결정, 목표 미설정(0)이면 절대 시간(30분/1시간/2시간)으로 폴백. 색은 앱 테마 **teal** 스케일 + 라이트/다크 대응. 월 라벨(상단)·요일 라벨(월/수/금)·범례(적음→많음)·"최근 1년 N일 학습" 카운트. 셀 `title`에 `formatDayLabel · 공부시간`(hover 툴팁). 좁은 화면 대비 `overflow-x-auto`.
  - `components/dashboard/DashboardScreen.tsx`: 최근 세션 카드 아래에 `<ContributionHeatmap rows={rows} goalMin={goalMin} />` 연결.

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2271 모듈) · `cargo check` ✅ (버전 문자열만 변경, 에러 0).
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후 대시보드 하단에서: ①기록 있는 날이 teal로, 공부량 많을수록 진하게 칠해지는지 ②오늘 이후 날짜는 빈 칸 ③셀 hover 시 날짜+공부시간 툴팁 ④월/요일 라벨·범례 정렬 ⑤측정 종료 시 오늘 칸 자동 반영(session-saved) ⑥라이트/다크 색 대비 ⑦일일 목표 바꾸면 색 단계 기준 변화.

### ✅ 단계 10 — v3 (오버레이 레이아웃 6종 · 파일명 영문화 · v3.0.0) (2026-07-18)
**기획**: [`plans/v3`]. 버전 **2.0.0 → 3.0.0**.

**한 일**
- **오버레이 레이아웃(variant) 6종**(순수 프론트, Rust/capabilities 변경 없음): 기존 단일 알약 레이아웃을 **선택 가능한 variant 6종**으로 확장 — `pill`(알약, 기존) / `digital`(큰 디지털 시계) / `minimal`(배경 없이 시간만+text-shadow) / `ring`(목표 진행 원형 링+가운데 시간) / `bar`(하단 목표 진행 막대) / `pomodoro`(사이클 라벨+남은시간, 뽀모도로 꺼지면 경과시간 폴백). **색·투명도·글자·표시항목 옵션은 그대로 공유**하고 배치/모양만 교체.
  - `lib/overlaySettings.ts`: `OverlayOptions`에 `variant` 필드(+`OverlayVariantId` 타입), 기본 `"pill"`. `loadOverlayOptions`의 기존 spread 병합으로 누락 자동 보정.
  - **리팩터** `windows/TimerOverlay.tsx`: 데이터 계산(시간/서브라인/색/과목/뽀모도로/**목표 진행률**)을 `OverlayViewModel`로 묶어 variant에 위임. 드래그 영역·마우스오버 미니 컨트롤(재개/일시정지/종료)·리사이즈 그립·항상위는 **공용 크롬**으로 래퍼에 유지. 목표% 로드 조건을 `show.goalPct || variant∈{ring,bar}`로 확장(링/막대는 진행률이 핵심).
  - 신규 `components/overlay/`: `types.ts`(뷰모델), `index.tsx`(레지스트리+`OverlayVariantView` 스위처), `{Pill,Digital,Minimal,Ring,Bar,Pomodoro}Variant.tsx`. 링은 대시보드 `GoalRing`의 SVG 패턴을 viewBox로 축약해 창 크기에 스케일.
  - **설정**(`components/settings/OverlaySection.tsx`): 상단에 **레이아웃 선택 버튼 6개**(선택 강조), 미리보기를 **선택 variant 실제 렌더**(샘플 뷰모델)로 교체해 WYSIWYG. 색/투명도/표시항목 컨트롤은 그대로. 변경은 기존대로 즉시 저장+`overlay-options-changed`로 타이머 창 실시간 전환.
- **에셋 파일명 영문화**: `tauri.conf.json` `productName` **"학습기록" → "StudyLog"**. 릴리스 산출물이 `StudyLog_3.0.0_x64-setup.exe`가 되도록(v2에서 한글 productName 탓에 파일명 앞이 비던 문제 해결). 창 제목·사이드바 h1은 한글 유지, identifier(`com.studylog.app`) 불변 → **데이터 경로/기존 데이터 보존**. 설치 시 시작메뉴/폴더는 "StudyLog"(영문).
- **버전 3.0.0**: `tauri.conf.json`/`Cargo.toml`/`package.json`/사이드바.

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2270 모듈) · `cargo check` ✅ (`study-log v3.0.0`, 에러 0).
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후: 측정 시작→오버레이 표시, 설정 "오버레이"에서 레이아웃 6종을 바꿀 때 타이머 창이 **즉시** 전환(디지털/미니멀/링/막대/뽀모도로), 각 레이아웃에서 드래그·리사이즈·마우스오버 컨트롤·색/투명도/표시항목·목표% 정확. 재시작 시 선택 레이아웃 복원. `npm run tauri build` 산출물 파일명이 `StudyLog_3.0.0_x64-setup.exe`인지.

### ✅ 단계 9 — v2 (자동복구 · 자동시작 · GitHub 백업/복원 · 릴리스 자동화) (2026-07-18)
**기획**: [`docs/03-v2-기능-기획.md`](./docs/03-v2-기능-기획.md) (F1~F4). 버전 **1.0.0 → 2.0.0** 승격(`tauri.conf.json`/`Cargo.toml`/`package.json`/사이드바).

**한 일**
- **F1 · 비정상 종료 세션 자동 복구**(Rust 무변경): 측정 상태가 Rust 인메모리에만 있고 `stop_session` 때만 DB INSERT되던 구조라, 타이머 켠 채 PC 종료/강제종료 시 세션 전체가 유실되던 문제 해결. `lib/liveSession.ts`(settings key `live_session`에 진행 중 스냅샷 upsert/read/clear) + `hooks/useLiveSessionGuard.ts`(메인 창 1회 마운트). ①**복구**: 시작 시 Rust가 idle인데 잔재가 있으면 = 비정상 종료 → 마지막 하트비트 시점까지 자동 저장(기존 `saveSession` 재사용)+toast+`session-saved`. ②**지속화**: `session-changed`로 running/paused면 스냅샷 기록, idle이면 삭제(정상 종료 시 잔재 제거→중복 저장 방지). ③**하트비트**: 측정 중 25초 간격으로 스냅샷 갱신(손실 ≤ 25초). 웹뷰만 리로드된 경우(Rust running/paused)는 복구 안 함. `MainApp`에 `useSessionRecorder` 옆에 마운트.
- **F2 · Windows 자동 시작**: `tauri-plugin-autostart` 추가(Cargo+npm), `lib.rs` `#[cfg(desktop)]`에 `init(LaunchAgent, Some(["--autostart"]))` 등록. **조용한 상주**: `main` 창을 `visible:false`로 바꾸고, setup에서 `std::env::args()`에 `--autostart`가 **없을 때만** main 창 `show()+set_focus()`(부팅 실행이면 트레이만 상주). 설정 "일반" 섹션(`GeneralSection.tsx`)에 자동 시작 토글(`isEnabled`/`enable`/`disable`). `main.json`에 `autostart:default` 권한.
- **F3 · GitHub 백업/복원**: `tauri-plugin-http` 추가(Cargo+npm), `lib.rs`에 `.plugin(tauri_plugin_http::init())`, `main.json`에 http 권한을 **api.github.com로 스코프 제한**. `lib/backup.ts` — `exportData`(subjects/sessions/settings 전량 → `{version:2,...}`, **민감/휘발 key 제외**: `github_token`/`backup_config`/`last_backup_at`/`live_session`), `pushBackup`(Contents API: GET sha → PUT base64(UTF-8) JSON, `Bearer` 토큰), `restoreBackup`(GET→파싱→**전체 교체**: sessions/subjects DELETE 후 id 보존 INSERT + settings upsert). 한글 때문에 `btoa` 대신 TextEncoder→base64 헬퍼. UI `components/settings/BackupSection.tsx`(owner/repo/branch/path/토큰 입력·저장, "지금 백업"·마지막 백업 시각, "복원"은 `ConfirmDialog` 뒤, 미설정 시 버튼 비활성, 토큰 평문 저장 안내). `SettingsScreen`에 섹션 연결. **토큰은 로컬 SQLite 평문 저장**(개인용, OS 키체인은 Not-V2).
- **F4 · GitHub Actions 릴리스 자동화**: `.github/workflows/release.yml` — `v*` 태그 push(또는 수동) → `windows-latest`에서 checkout/Node20+npm ci/Rust+캐시/`tauri-apps/tauri-action`으로 빌드 + Release 생성·업로드. `GITHUB_TOKEN`으로 업로드, 미서명(서명 secrets 자리는 주석), NSIS만(한글 productName→WiX 비활성 유지).

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2263 모듈) · `cargo check` ✅ (autostart·http 플러그인 컴파일, 경고·에러 0, `study-log v2.0.0`).
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev`(또는 설치파일) 후:
  - **F1**: 측정 시작→25초+ 후 작업관리자로 강제 종료(또는 트레이 "종료") → 재실행 시 "비정상 종료된 세션 자동 저장" toast + 기록/대시보드에 반영. 정상 종료(stop) 후 재실행 시엔 복구 없음(중복 X). 측정 중 F5 리로드는 복구 아님(Rust 생존).
  - **F2**: 설정 "일반"에서 자동 시작 ON → 재부팅 시 창 없이 트레이만 상주, 좌클릭 복귀. OFF 시 해제.
  - **F3**: 설정 "GitHub 백업"에 owner/repo/토큰 입력 → "지금 백업" → 레포에 `study-log-backup.json` 커밋 생성(diff 확인). 데이터 바꾼 뒤 "복원"→확인→백업 시점으로 되돌아옴(대시보드 자동 갱신). 잘못된 토큰/repo는 toast 에러.
  - **F4**: `git tag v2.0.0 && git push origin v2.0.0` → Actions 빌드 후 Release v2.0.0에 설치파일 첨부 확인.
- ⚠️ 주의: 설치 후 첫 실행 경로가 바뀜 — `main`이 `visible:false`라 **반드시 setup의 조건부 show가 동작**해야 창이 뜬다(정상 실행 시). 자동 시작 등록은 **설치된 exe 경로** 기준이므로 dev가 아닌 설치 빌드에서 최종 확인.

### ✅ 단계 8 — 폴리시 & 패키징 (2026-07-18)
**한 일**
- **전역 ErrorBoundary**(`components/ErrorBoundary.tsx`): 렌더 중 던져진 예외를 잡아 흰 화면(WSOD) 대신 복구 카드(안내 + 에러 메시지 + "새로고침")를 보여준다. **main 창만** 카드 표시, 투명·소형 창(timer/quickstart)은 방해 안 되게 `null` 렌더. `main.tsx`에서 `<ErrorBoundary label={label}>`로 `Root` 감쌈 + `window`에 `unhandledrejection`/`error` 리스너로 미처리 비동기 예외를 콘솔에 남김(조용히 사라지지 않게). 사용자 대면 에러는 여전히 각 화면 try/catch→toast, 이 그물은 최후 방어선.
- **빈 상태/에러 폴리시 보완**(Explore 점검 후 3곳): ①`useStats.saveGoal`에 try/catch+toast 추가 — 대시보드 목표 링 저장 실패가 무반응이던 것 수정(설정 화면 경로와 처리 일치). ②`LiveMeasure` — `useSubjects.error`를 무시해 과목 로드 실패가 "과목 없음" 빈 상태로 위장되던 것 수정(에러 메시지 명시 분기). ③설정 4섹션(Goal/Pomodoro/Overlay/Hotkeys) 로드-온-마운트 `.then`에 `.catch(console.error)` 추가 — 조용히 기본값으로 떨어지던 로드 실패를 콘솔에 기록. (나머지 화면은 빈 상태·toast 이미 일관.)
- **버전 1.0.0 승격**: `tauri.conf.json`/`Cargo.toml`/`package.json`/사이드바 표기 모두 `1.0.0`. V1 기획 전 단계 완료 기념 첫 정식 릴리스.
- **아이콘**: 이미 앱 테마(teal/orange) 커스텀 아이콘으로 교체되어 있음(스캐폴딩 시 반영). 별도 작업 불필요.
- **패키징**: `bundle.targets`를 `"all"`→`["nsis"]`로 변경. WiX(MSI) `light.exe`가 **한글 productName("학습기록")** 에서 실패해, 유니코드 이름을 잘 처리하는 **NSIS 설치파일**만 생성하도록 고정. 산출물 `src-tauri/target/release/bundle/nsis/학습기록_1.0.0_x64-setup.exe`(≈3.2MB) → GitHub 릴리스 **v1.0.0** 업로드.

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2257 모듈) · `npm run tauri build` ✅ (NSIS 설치파일 생성).
- 참고: NSIS 첫 빌드 시 `nsis_tauri_utils.dll` 플러그인 다운로드에서 일시적 `os error 5(액세스 거부)`가 날 수 있음 → **재시도하면 통과**(툴체인 캐시 후). WiX MSI는 한글 이름 이슈로 비활성.
- ⚠️ 미서명 빌드라 첫 실행 시 Windows SmartScreen "알 수 없는 게시자" 경고(추가 정보→실행). 코드 서명은 Not-V1(docs/01 §7).
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — 설치파일로 설치 후: 앱 실행·측정·기록·통계·설정 전반 동작, 재실행 후 데이터 유지.

### ✅ 단계 7 — 부가기능(뽀모도로 · 트레이 · 오버레이 커스터마이즈 · 설정 화면) (2026-07-18)
**한 일**
- **시스템 트레이 + 종료 정책**(Rust, `src-tauri/src/tray.rs`): setup에서 트레이 1개 생성. 우클릭 메뉴 6종(측정 시작→`show_quickstart`/종료→`stop_session`/일시정지·재개→`toggle_pause`/오버레이 표시·숨김→`toggle_overlay`/대시보드 열기/종료→`app.exit`), **좌클릭→메인 표시·포커스**. 메뉴 동작은 기존 커맨드를 그대로 재사용(상태 판단은 Rust 단일 소스). `lib.rs` `on_window_event`로 **메인 창 X→종료 대신 `hide()`+`prevent_close`**(백그라운드 유지·핫키 계속 동작), 완전 종료는 트레이 "종료"만. 툴팁 과목/상태는 JS(`useTray`)가 `TrayIcon.getById("main-tray").setTooltip`으로 갱신(경과 초 실시간까지는 X). `tauri-plugin-notification` 추가(뽀모도로 알림용).
- **오버레이 커스터마이즈**(`lib/overlaySettings.ts` + `hooks/useOverlayOptions.ts`): 옵션(배경색/투명도·글자색·글자크기 모드(창비례/고정)·표시항목 5종 토글·항상위)을 settings(`overlay_options`)에 저장하고, 설정 변경 시 **`overlay-options-changed` 이벤트로 타이머 창에 즉시 반영**(실시간 미리보기처럼). `TimerOverlay`가 옵션을 적용(배경 `hexToRgba`, 글자색/크기, 항목 조건부 표시, `setAlwaysOnTop`). 목표% 표시용 경량 쿼리 `fetchTodaySec`(stats.ts) 추가.
- **뽀모도로**(`lib/pomodoro.ts` + `hooks/usePomodoro.ts`, **오버레이 창 컨트롤러**): 설정(집중/짧은휴식/긴휴식/긴휴식주기/알림). **핵심 모델 — 휴식 = 측정 세션의 자동 일시정지**: 집중 목표만큼 공부가 쌓이면 `pause_session`(휴식 시작), 휴식 시간이 지나면 `resume_session`(다음 집중). 측정 엔진이 이미 일시정지 시간을 제외하므로 **세션 하나의 duration이 곧 집중 시간 합계**(집중만 적립) → **Rust 측정 엔진 변경 없음**. 전환 시 데스크톱 알림, 오버레이는 **남은 시간 카운트다운 + 사이클(집중N/휴식/긴휴식)** 표시(휴식은 sky 색). 컨트롤러를 **항상 표시되는 오버레이 창**에 둔 이유: 숨겨진 창의 JS 타이머 스로틀을 피해 전환이 안정적. (진행 상태는 메모리라 측정 중 창 리로드 시 현재 집중 블록부터 새로 셈 — 허용 오차.)
- **설정 화면**(`components/settings/`): `SettingsScreen` = 목표시간 · 뽀모도로 · 오버레이 · 전역 핫키 · 일반(트레이 안내) 5개 카드 섹션. 공용 `parts.tsx`(Section/Row/NumberField), `ui/Switch.tsx`(경량 토글). **핫키 재바인딩**: `HotkeyCapture`(키 조합 캡처, 수정자 필수·Esc 취소), 저장 시 중복 검사 후 `hotkeys-changed` 이벤트 → `useGlobalShortcuts`가 **재등록**(이미 점유된 조합은 toast 안내). 오버레이/뽀모도로/목표는 변경 즉시 저장.
- **연결**: `MainApp` 설정 탭 placeholder → `<SettingsScreen/>`, `useTray()` 추가. `useGlobalShortcuts`는 `hotkeys-changed` 구독으로 재등록(콜백은 ref로 안정화). `ipc.ts`에 `overlay-options-changed`/`hotkeys-changed` emit·listen 추가.
- **권한**: `main.json`에 `core:tray:allow-get-by-id`/`allow-set-tooltip`. `timer.json`에 `core:window:allow-set-always-on-top` + `notification:*`(notify/is-permission-granted/request-permission). 트레이 메뉴·종료 정책은 Rust 네이티브라 capabilities 불필요.

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2256 모듈) · `cargo check` ✅ (경고·에러 0, notification 플러그인 다운로드/컴파일 + tauri-build capabilities 검증 통과).
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후:
  - **트레이**: 메인 창 X→트레이로 숨김(창 사라져도 앱 유지)·좌클릭으로 복귀, 우클릭 메뉴 각 항목(시작 피커/종료/일시정지·재개/오버레이/대시보드), 측정 중 트레이 툴팁에 "측정 중 · 과목", **"종료"로만 완전 종료**, 숨긴 상태에서도 핫키 동작.
  - **뽀모도로**: 설정에서 켜고 집중 1분·휴식 1분 등 짧게 → 측정 시작 시 오버레이가 카운트다운+"집중 1", 집중 끝나면 알림+자동 휴식(오버레이 sky·카운트다운), 휴식 끝나면 알림+다음 집중, 종료 시 **집중 시간만** 세션에 적립(휴식 제외).
  - **오버레이 커스터마이즈**: 설정에서 투명도/색/글자크기/표시항목/항상위 바꾸면 측정 중 오버레이가 **즉시** 반영, 목표% 표시 토글.
  - **핫키 재바인딩**: 설정에서 조합 변경→저장→새 조합 동작(옛 조합 해제), 중복·점유 조합 안내(toast).

### ✅ 단계 6 — 대시보드 통계 (2026-07-18)
**한 일**
- **통계 집계 계층**(`lib/stats.ts`): 세션 원시 행을 **한 번 조회**(`fetchStatRows` — 과목 이름/색 JOIN, 오래된→최근)해서 **일/주/월 버킷·과목별 분포·오늘/이번주/이번달 합계·연속 학습일수를 전부 JS(로컬 시계)에서 계산**. SQL `strftime` 대신 JS로 집계하는 이유는 주(week) 경계를 SQLite와 정확히 일치시키기 어렵고 빈 버킷 0채움도 어차피 JS라서(개인용 앱이라 전량 조회 비용 무시 가능). 주 경계는 **월요일 시작**, 버킷 수 일14/주8/월6, 빈 버킷은 0. 연속일수는 오늘 아직 공부 전이면 어제부터 세어 하루 중 0으로 안 보이게.
- **데이터 훅**(`hooks/useStats.ts`): 원시 행 + 일일 목표(분, settings `daily_goal_min`, 기본 120) 로드·`reload`·`saveGoal`(0~1440 clamp). **`session-saved` 이벤트 구독**으로 종료→저장 시 자동 새로고침(집계·차트는 화면에서 `useMemo` 파생).
- **저장 완료 신호**(`lib/ipc.ts` + `useSessionRecorder`): 새 이벤트 `session-saved` 추가 — 저장 리스너가 INSERT **성공 후** `emitSessionSaved()` → 대시보드가 **insert 완료 뒤** 통계를 다시 읽음(리로드가 저장과 경합하지 않게, 오버레이/핫키 종료도 반영).
- **대시보드 화면**(`components/dashboard/`): `DashboardScreen`(조합) + ①`LiveMeasure`(과목 select→시작/일시정지/재개/종료 — 피커가 핫키 전용이라 마우스 측정 경로 제공, 상태는 `useSession` 구독) ②`GoalRing`(오늘 누적÷목표 SVG 도넛 + 달성 시 초록, 연필로 **즉석 목표 편집**·프리셋 30/60/120/180/240) ③요약 타일 4개(오늘/이번주/이번달/연속) ④`StudyBarChart`(Recharts 막대 + **일/주/월 토글**, 현재 버킷 강조, 커스텀 툴팁, 빈 기간 안내) ⑤`SubjectDonut`(선택 기간 과목별 도넛+범례·%) ⑥최근 세션 6개. 테마 색은 `hsl(var(--*))`로 라이트/다크 대응.
- **정리**: 단계 2 임시 패널 `components/session/SessionTester.tsx` 삭제(대시보드로 대체), `MainApp` 대시보드 탭 → `<DashboardScreen/>`. **Rust·capabilities·마이그레이션 변경 없음**(조회는 `sql:default`, 목표 저장은 기존 `sql:allow-execute`).

**추가(같은 세션, 통계 페이지 분리 + 기간 이동)**
- **별도 "통계" 탭 신설**(사이드바 대시보드↔기록 사이, `BarChart3`). 대시보드는 통합 요약 그대로 두고, 통계 페이지는 **일간/주간/월간 전환 + 좌우 화살표로 기간 이동**(`components/stats/`).
- **초점 기간(offset) 모델**: offset 0=현재(오늘/이번주/이번달), 1=직전 … 좌우 화살표(◀ 이전/▶ 다음, offset 0에서 ▶ 비활성)와 "현재로" 버튼, **표 행 클릭**으로 offset 이동. 이동하면 아래 카드·도넛·차트·표가 모두 그 기간을 반영.
- **기간 상세 + 증감**(`lib/stats.ts` `focusedStats(rows, g, offset)`): 선택 기간 누적·세션수 + 직전 기간 대비 증감. **진행 중(offset 0)은 지난 기간 '같은 시점'(페이스)**, **완료 기간(offset≥1)은 직전 기간 '전체'** 와 비교. 같은 시점: 이번 기간 경과 오프셋을 직전 기간 시작에 더한 지점까지(월 비교는 이번 기간 시작으로 clamp). 상대 라벨 `오늘/어제/N일 전` 등, 제목은 날짜 범위. KST는 DST 없어 주/일 오프셋 정확.
- **차트/표는 초점 기간에서 끝나는 창(window)**: `buildBuckets`에 `endOffset` 파라미터 추가 → 화살표로 뒤로 가면 창 전체가 스크롤. 초점 버킷은 `isFocused`로 강조(막대 진하게·표 행 하이라이트). 표(`PeriodTable`)는 최근이 위로, 학습시간·세션수·**직전 완료 기간 대비 증감**(▲초록/▼빨강), 진행 중 기간은 '진행 중' 배지+증감 생략, 행 클릭 시 이동.
- **집계 확장**: `StatBucket`에 `count`/`offset`/`isFocused` 추가, `buildBuckets`(count·endOffset)·`subjectBreakdown`(toSec로 구간 제한)·`rangeStart`. `StudyBarChart`에 `title`/`showToggle` prop + 막대 많을 때 X축 라벨 솎기. `time.ts` `formatSignedDurationKo`(`+1시간 40분`). 통계 페이지 과목 도넛은 **초점 기간 [startSec,endSec)** 만.

**검증 결과**
- `npm run build` ✅ (tsc + vite, 2240 모듈 — recharts 번들 포함). Rust 변경 없어 `cargo check` 불필요.
- ⏳ 런타임 E2E는 **사용자 테스트 대기** — `npm run tauri dev` 후:
  - **대시보드**: ①측정 시작→종료 시 오늘 링·요약·차트·최근 세션 **자동 갱신** ②목표 연필→분/프리셋→링·% 반영, 달성 시 초록·🎉 ③일/주/월 토글로 막대·도넛 범위 전환 ④로컬 날짜 기준 집계(주=월요일 시작) ⑤과목 도넛 %·합계 ⑥연속 학습일수 ⑦과목 0개 시 "과목 관리 열기" 유도.
  - **통계**: ①일간/주간/월간 전환(offset 0 복귀) ②좌우 화살표(◀ 이전/▶ 다음, "현재로")·표 행 클릭으로 기간 이동 시 카드·도넛·차트·표가 그 기간 반영 ③진행 중 기간은 지난 기간 같은 시점, 과거 완료 기간은 직전 기간 전체와 비교한 증감(시간·%)이 맞는지 ④차트에서 초점 막대 강조·표에서 초점 행 하이라이트 ⑤진행 중 행 '진행 중' 표시·증감 생략 ⑥지난 기간 기록 없을 때 "새 기록".

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
  windows/                 # MainApp(대시보드/통계/기록/과목/설정/저장리스너/핫키등록/트레이툴팁) / TimerOverlay(옵션·뽀모도로 반영) / QuickStart(피커)
  hooks/{useSubjects,useSessions,useSession,useStats,useOverlayWindow,useOverlayOptions,usePomodoro,useSessionRecorder,useGlobalShortcuts,useTray}.ts
  #   과목/세션목록 / 측정상태구독 / 대시보드통계 / 오버레이 위치·크기 / 오버레이 옵션 구독 / 뽀모도로 컨트롤러(오버레이) / 종료→저장 / 전역핫키 등록·재등록 / 트레이 툴팁
  lib/{utils,db,types,subjects,ipc,sessions,stats,time,settings,hotkeys,overlaySettings,pomodoro}.ts
  #   cn / DB / 타입 / 과목CRUD / invoke·event래퍼(+overlay-options-changed/hotkeys-changed) / 세션CRUD / 통계집계(+fetchTodaySec) / 시간 / settings K-V / 핫키 / 오버레이옵션 / 뽀모도로설정
  components/
    ui/{button,input,Switch,Modal,ConfirmDialog}.tsx
    subjects/{SubjectsScreen,SubjectEditor}.tsx
    records/{RecordsScreen,SessionEditor}.tsx   # 세션 일별 목록/수정/삭제/수동 추가·메모
    dashboard/{DashboardScreen,LiveMeasure,GoalRing,StudyBarChart,SubjectDonut,ContributionHeatmap}.tsx  # 통합 요약 대시보드(Recharts) + 학습 잔디
    stats/{StatsScreen,ComparisonCard,PeriodTable}.tsx  # 일/주/월 통계 + 지난 기간 같은 시점 대비 증감
    settings/{SettingsScreen,parts,GoalSection,PomodoroSection,OverlaySection,HotkeysSection,HotkeyCapture,GeneralSection}.tsx  # 설정 5섹션 + 핫키 캡처
src-tauri/
  src/
    lib.rs                 # 플러그인(sql/global-shortcut/notification) + 마이그레이션 + manage + setup(트레이) + on_window_event(X→트레이) + invoke_handler
    main.rs
    state.rs               # Measurement(측정 상태 단일 소스) + Status + 스냅샷/요약
    commands.rs            # start/pause/resume/stop/get_session_state/toggle_overlay/show_quickstart/toggle_pause
                           #   (+ session-changed/session-finished emit, 시작·종료 시 오버레이 show/hide)
    tray.rs                # 트레이 아이콘·메뉴(6종)·좌클릭 복귀 (종료 정책은 lib.rs on_window_event)
  migrations/0001_init.sql # subjects/sessions/settings
  capabilities/{main,timer,quickstart}.json   # main:sql+global-shortcut+자기창제어+트레이툴팁 / timer:창제어+always-on-top+notification / quickstart:hide
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
