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
| 2 | 측정 엔진 (Rust 상태/커맨드/이벤트) — 임시 버튼 검증 | ⬜ |
| 3 | 타이머 오버레이 창 (드래그·크기조절·숨김/표시·위치 복원) | ⬜ |
| 4 | 전역 핫키 + 빠른 시작 피커 | ⬜ |
| 5 | 세션 저장 + 기록 화면 | ⬜ |
| 6 | 대시보드 통계 (일/주/월 + 오늘 목표 링) | ⬜ |
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
  windows/                 # MainApp(과목 화면 연결) / TimerOverlay / QuickStart
  hooks/useSubjects.ts     # 과목 목록 로드 훅
  lib/{utils,db,types,subjects}.ts   # cn() / DB 연결 / 타입 / 과목 CRUD
  components/
    ui/{button,input,Modal,ConfirmDialog}.tsx
    subjects/{SubjectsScreen,SubjectEditor}.tsx
src-tauri/
  src/{lib.rs, main.rs}    # 플러그인 초기화 + 마이그레이션 등록 (commands.rs/state.rs/tray.rs는 단계 2·7)
  migrations/0001_init.sql # subjects/sessions/settings
  capabilities/{main,timer,quickstart}.json   # main에 sql:allow-execute 추가됨
  tauri.conf.json          # 3-창 + productName/identifier
  Cargo.toml
docs/                      # 기획/결정 문서
PROGRESS.md                # (이 문서)
CLAUDE.md                  # 개발 가이드·규약
```
※ `lib/ipc.ts`(invoke 래퍼)는 단계 2(측정 커맨드)에서 생성.

---

## 다음 세션 시작 가이드
1. 이 문서 + `CLAUDE.md` + `docs/02-핵심기능-기획서.md` 확인.
2. 스마트 앱 제어 Off 상태 확인(위 명령), `npm install` 되어 있는지 확인.
3. **체크리스트에서 다음 ⬜ 단계**를 진행. (예: "단계 1 진행해줘")
4. 규약: 커밋 메시지 `type: 한글 요약`, SQL 파라미터 바인딩 필수, 창별 최소 권한, 에러는 toast.
5. 단계 완료 시: 이 문서 갱신 → 커밋·푸시 → 사용자에게 테스트 안내.
