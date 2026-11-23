# paperoid — AI 보드게임 아지트

여러 보드게임과 모바일 해루질 액션 게임 **해루질럿**을 제공하는 Vinext 기반 웹 애플리케이션입니다.

- 운영 사이트: <https://games.itnadcom.chatgpt.site>
- 독립 배포 사이트(자체 Cloudflare Workers): <https://games.itnadcom.workers.dev>
- 해루질럿: <https://games.itnadcom.chatgpt.site/haeru>
- 해루질럿 내부 QA 도구: `/haeru-dev`
- 원격 저장소: <https://github.com/itnad/games>

운영 환경은 두 곳입니다. 기존 사이트는 OpenAI Sites가 관리하는 Cloudflare Workers이고, 독립 배포 사이트는 자체 Cloudflare 계정의 Worker로 `main`에 푸시될 때마다 Cloudflare가 직접 빌드해 배포합니다. 두 사이트는 데이터베이스(D1)가 따로라서 순위표와 추천 게시판이 따로 쌓입니다. 절차는 [배포·D1·복구 가이드](docs/deployment-and-recovery.md)에 있습니다.

## 1. 신규 개발자 빠른 시작

### 준비 사항

- Git
- Node.js `>=22.13.0`
- npm
- GitHub에 변경사항을 올리려면 저장소 쓰기 권한
- 배포할 때만 OpenAI Sites 권한 또는 Cloudflare 계정

### 설치와 실행

```bash
git clone https://github.com/itnad/games.git
cd games
npm ci
npm run dev
```

로컬 주소는 터미널에 출력되는 주소를 사용합니다. 기본 포트를 사용한다면 다음 경로를 확인합니다.

- 메인: `http://localhost:3000/`
- 해루질럿: `http://localhost:3000/haeru`
- 내부 QA 도구: `http://localhost:3000/haeru-dev`
- 박살 0단계 검증: 메인 하단의 전체 게임 표시 토글을 켠 뒤 `모바일` 카테고리의 `박살` 카드 (카메라·방향 센서가 있는 폰에서 확인)

작업 전에는 반드시 [AGENTS.md](AGENTS.md)를 읽습니다. 특히 런타임 값 뒤에 한국어 조사를 붙일 때는 `app/korean-particles.js`의 헬퍼를 사용해야 합니다.

## 2. 주요 명령

| 명령 | 용도 |
| --- | --- |
| `npm ci` | `package-lock.json`과 동일한 의존성 설치 |
| `npm run dev` | Vinext 로컬 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 생성 |
| `npm test` | 프로덕션 빌드 후 전체 회귀 테스트 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run db:generate` | `db/schema.ts` 변경분으로 D1 마이그레이션 생성 |

변경사항을 제출하기 전 최소 기준은 `npm test` 통과입니다. 의존성이나 타입 구성을 변경했다면 `npm run lint`도 실행합니다.

## 3. 프로젝트 구조

```text
app/
  page.tsx                       메인 게임 목록, URL 라우팅, 게임 진입
  [gameId]/page.tsx              게임별 직접 URL 진입
  api/version/route.ts           배포 버전 확인
  api/game-suggestions/route.ts  D1 기반 게임 추천 게시판 API
  mudflat-*.{ts,tsx,js,css}      해루질럿 구현
  stardraft/                       스타드래프트 (모바일 웨이브 전략) 전용 폴더
  haeru-dev/page.tsx             내부 QA 도구 라우트
public/
  mudflat-creatures/             해산물 이미지
  mudflat-illustrations/         캐릭터·결과 화면 이미지
  mudflat-ui/                    튜토리얼 등 UI 이미지
db/
  schema.ts                      Drizzle/D1 스키마
  index.ts                       Worker의 D1 바인딩 연결
drizzle/                         생성된 D1 마이그레이션
worker/index.ts                  Cloudflare Worker 진입점
build/sites-vite-plugin.ts       Sites 빌드 산출물 패키징
tests/                           게임 규칙·저장·렌더링 회귀 테스트
.openai/hosting.json             기존 Sites 프로젝트와 D1 바인딩 선언
```

## 3-1. 스타드래프트

`/stardraft`에서 실행되는 모바일 웨이브 전략 게임입니다(내부 ID와 폴더 이름도 `stardraft`. 예전 이름 `starswar`의 주소와 저장 데이터는 이어지지 않습니다). 유닛·건물은 원작 이름 그대로라 공개 시점을 정할 때까지 홈 목록에서 숨겨 두었습니다(바닥글의 "즐거운"으로 모든 게임을 켜면 보입니다). 화면은 PixiJS로 그리며, PixiJS는 브라우저에서만 불러옵니다. 모든 소스는 `app/stardraft/` 폴더에 있고, 기획과 규칙은 [스타드래프트 기획·구현 문서](docs/stardraft-design.md)에 있습니다. 유닛 목록과 유닛별 점검 기록은 [유닛 목록과 전체 점검](docs/stardraft-unit-audit.md)에 있습니다. 엔진과 AI 테스트는 `tests/stardraft-engine.test.mjs`에 있습니다. 결과 화면의 리포트에 담긴 재현 코드는 `node scripts/stardraft-replay.mjs 리포트.txt`로 다시 돌려 볼 수 있습니다.

사이트 없이 휴대폰에서 바로 시험하려면 HTML 파일 하나로 묶을 수 있습니다. 결과는 Git에 올라가지 않는 `dist-standalone/` 폴더에 생깁니다.

```bash
npm run build:game-html
```

`dist-standalone/stardraft.html`은 React와 PixiJS까지 포함해 인터넷 없이 열립니다. `-- --artifact`를 붙이면 라이브러리를 CDN에서 불러오는 가벼운 `stardraft-artifact.html`을 만듭니다.

## 4. 해루질럿 코드 구조

| 파일 | 책임 |
| --- | --- |
| `app/mudflat-survivor-game.tsx` | 화면 전환, Canvas 렌더링, 입력, 게임 루프, 정산 UI를 연결하는 최상위 컴포넌트 |
| `app/mudflat-survivor-engine.js` | 해산물·장비·기술·스테이지 수치와 순수 계산 함수 |
| `app/mudflat-survivor-model.ts` | 캐릭터·캠페인 생성, 저장 키, 공통 표시 모델 |
| `app/mudflat-survivor-types.ts` | `Campaign`, `StageProfile` 등 공유 타입 |
| `app/mudflat-terrain.ts` | 깊은 펄과 갯벌 표면의 결정적 지형 계산·경로 |
| `app/mudflat-rng.js` | 원정 시드와 저장 가능한 결정적 난수 |
| `app/mudflat-run-save.js` | 진행 중 원정 직렬화·검증·5초 자동 저장·복원 |
| `app/mudflat-cast-net.js` | 그물 목표 선정, 구속, 피해, 해제 규칙 |
| `app/mudflat-cast-net-renderer.js` | 그물 비행·전개·조임 Canvas 표현 |
| `app/mudflat-experience.js` | 경험치 보석의 출현·비행·획득 처리와 소쿠리의 달인 흡입 시작 |
| `app/mudflat-lumi-animation.js` | 루미 이동 방향과 애니메이션 상태 계산 |
| `app/mudflat-lumi-renderer.ts` | 루미 스프라이트 렌더링 |
| `app/mudflat-kids-effects.js` | 어린이 모드 기술 효과 |
| `app/mudflat-seafood-guide.tsx` | 해산물 도감 |
| `app/mudflat-exit-dialog.tsx` | 게임 이탈 확인과 이어하기 저장 안내 |
| `app/mudflat-retry-button.tsx` | 실패 재도전과 비밀 길게 누르기 처리 |
| `app/mudflat-supervisor.js` | 개발용 AI 감독모드의 이동·회피·귀환 판단(레벨업·교체·정비 선택은 사람) |
| `app/mudflat-supervisor-log.js` | 감독 플레이 로그 수집·직렬화 |
| `app/mudflat-daily-challenge.js` | 오늘의 갯벌 날짜·단계·시드 규칙 |
| `app/mudflat-daily-challenge-panel.tsx` | 오늘의 갯벌 진입, 통합 순위, 결과 공유 |
| `app/mudflat-dev-tools.tsx` | 브라우저 로컬 데이터를 이용한 QA 프리셋, 감독모드 진입, 맞춤 원정 빌더 화면 |
| `app/mudflat-dev-build.js` | 맞춤 원정 빌드 명세의 기본값·검증·캠페인 변환·시드 결정(순수 함수) |
| `app/mudflat-survivor.css` | 해루질럿 전체 UI와 반응형 레이아웃 |

게임 밸런스 수치와 규칙은 가능한 한 `mudflat-survivor-engine.js`에 두고, React 상태와 DOM/Canvas 연결만 `mudflat-survivor-game.tsx`에 둡니다. 순수 규칙을 변경할 때는 같은 입력에 같은 결과를 내는 함수로 분리하고 테스트를 추가합니다.

## 5. 주요 저장 키와 진행 데이터

해루질럿 저장은 계정 서버가 아니라 현재 브라우저의 origin별 저장소를 사용합니다. 도메인이나 브라우저가 달라지면 자동으로 옮겨지지 않습니다.

| 키 | 저장소 | 내용 |
| --- | --- | --- |
| `paperoid-mudflat-survivor-best-v1` | `localStorage` | 최고 점수 |
| `paperoid-mudflat-survivor-campaign-v1` | `localStorage` | 스테이지 사이 정비 상태와 캠페인 진행 |
| `paperoid-mudflat-survivor-last-mode-v1` | `localStorage` | 마지막으로 선택한 일반/어린이 모드 |
| `paperoid-mudflat-survivor-highest-stage-v1` | `localStorage` | 열린 최고 스테이지 |
| `paperoid-mudflat-survivor-active-run-v1` | `localStorage` | 생존 중인 원정 전체 스냅샷 |
| `paperoid-mudflat-dev-launch-v1` | `sessionStorage` | `/haeru-dev`에서 한 번만 전달하는 실행 프리셋 |
| `paperoidMudflatRunBackGuard` | `history.state` | 휴대폰/브라우저 뒤로가기 방어 표식 |

### 캠페인 저장 구조

`Campaign`은 `app/mudflat-survivor-types.ts`에 정의되어 있습니다. 핵심 필드는 다음과 같습니다.

```text
version, mode, characterId, stage
coins, hp, maxHp, baseMaxHp
level, xp, nextXp
levels         기술 인벤토리: 익힌 모든 기술의 레벨 맵(보관 기술 포함)
activeSkills   원정에서 작동하는 선택 기술 ID 목록(최대 6개, 집게·호미질 제외)
equipment      장비 레벨과 일회용품 맵
inventory      누적 보유물
lastHaul       직전 스테이지 조과
lastSaleValue, totalScore
lastBossCaught, lastObjective*
gemsCollected  캠페인 누적 경험치 보석 수(소쿠리의 달인 해금 기준)
digsCompleted  플레이어가 직접 끝낸 호미질 수(호미봇 해금 기준)
hitByCrab, hitByShrimp  게·새우에게 접촉 피해를 받은 경험(파이어볼·화염 방사 해금 기준)
hitByRock, hitByTide    바위·돌발 물살에 피해를 받은 경험(서리 발자국·빙결 파동 해금 기준)
hitByMosquito, hitByPufferfish  모기떼·복어에게 피해를 받은 경험(번개 체인·낙뢰 해금 기준)
pendingSkillDiscovery  정비 화면에서 새 기술 해금을 알릴지 여부
```

`activeSkills`나 `gemsCollected`가 없는 예전 저장은 복원 시 익힌 선택 기술 앞 6개와 0으로 보완합니다.

`version`을 올리는 변경은 저장 호환성 변경입니다. 필드를 삭제하거나 의미를 바꾸기 전에 복원 로직과 테스트를 함께 수정해야 합니다.

### 진행 중 원정 저장 구조

`paperoid-mudflat-survivor-active-run-v1`에는 다음 래퍼가 JSON으로 저장됩니다.

```text
version, savedAt
campaign
choiceIds       현재 기술 선택 화면의 선택값
nextSequence    월드 엔티티 ID 충돌 방지값
runtime         플레이어, 시간, 생물, 획득물, 투사체, 그물,
                바위, 조개구멍, 이펙트, seed/rngState와 스테이지 상태,
                skillInventory/activeSkills(levels에는 활성 기술만),
                gemsCollected와 소쿠리의 달인 충전·흡입 상태,
                digsCompleted와 호미봇 목록(hoeBots), 건곤대나이 타이머와 바위의 lift,
                뻘권 타이머와 생물의 넉백 상태, 파이어볼(fireballs)·불줄기(flameRays)와 화염 타이머,
                서리 바닥(frostPatches)·냉기 고리(frostWaves)와 빙결 타이머, 생물의 둔화 상태(slowUntil·slowFactor),
                번개 선(lightningArcs)·낙뢰(thunderbolts)와 번개 타이머, 생물의 감전 상태(shockUntil),
                대왕 박하지 기술 상태(bossSkill·bossSkillPhase·bossSkillClock·jumpX/Y)·보스 파이어볼(bossFireballs)·집게발(bossClaws)·등장 시각(bossSpawnAt)
```

자동 저장 간격은 5초이며, 종료되었거나 체력이 0인 원정은 저장하지 않습니다. 복원 시 구조와 숫자 유효성을 검사하고 손상되거나 호환되지 않는 저장은 안전하게 무시합니다. 저장 형식을 수정했다면 `tests/mudflat-run-save.test.mjs`에 정상 복원, 이전 형식 보완, 손상 거부 사례를 추가합니다.

## 6. `/haeru-dev` 내부 QA 도구

`/haeru-dev`는 공개 메뉴에 노출하지 않는 직접 URL 전용 도구입니다. 로그인이나 관리자 인증으로 보호되는 페이지가 아니며, 현재 브라우저의 해루질럿 로컬 데이터만 읽고 변경합니다. 민감한 운영 기능을 추가해서는 안 됩니다.

주요 기능:

- 현재 캠페인, 열린 스테이지, 최고 점수, 진행 중 원정 요약 확인
- 해루질럿 로컬 저장 데이터 내보내기
- 내보낸 JSON의 형식과 키를 검증한 뒤 로컬 저장 데이터 복원
- 해루질럿 로컬 저장 초기화
- 1단계 튜토리얼, 4단계 랜턴 Lv.1/Lv.6, 5단계 깊은 펄, 6단계 모기·기피제, 비밀 기술, 3단계 소쿠리의 달인 Lv.6, 3단계 호미봇 Lv.6, 3단계 건곤대나이 Lv.6, 4단계 뻘권 Lv.6, 3단계 파이어볼·화염 방사 Lv.6, 3단계 서리 발자국·빙결 파동 Lv.6, 2단계 번개 체인·낙뢰 Lv.6, 8단계 대왕 박하지 8초 등장(기술 확인), 8단계 보스 프리셋
- 맞춤 원정 빌더: 모드·단계·기술 레벨과 활성 기술(최대 6개)·캐릭터 수치·장비·시드를 직접 골라 바로 실행하거나 정비 저장으로 남김. 소쿠리의 달인·호미봇 레벨이 있으면 해금 조건(경험치 보석 100개, 호미질 20회)을 자동으로 채움
- AI가 이동·채집·위험 회피·귀환을 맡고, 레벨업 채집기술과 교체 선택, 정비 화면의 구매·활성 토글·다음 출정은 사람이 고르는 감독모드
- 프리셋이나 빌드를 즉시 실행하거나 정비 저장 상태로만 저장

감독모드는 일반 진행과 분리된 관전 세션입니다. 시작해도 기존 이어하기 저장을 지우지 않고, 감독 중 열린 단계·최고 점수·일일 순위를 갱신하지 않습니다. 직접 주소 `/haeru-dev`에서 **AI 감독모드 · 1단계부터**의 **무작위 시드 관전 시작**을 누르거나, 재현 시드를 입력해 **입력 시드로 재현**을 누릅니다. 맞춤 원정 빌더의 **AI 감독모드로 관전**을 켜면 직접 만든 빌드로도 관전할 수 있습니다.

권장 QA 흐름:

1. `/haeru-dev`에서 기존 데이터를 내보냅니다.
2. 확인할 프리셋의 `바로 실행`을 누르거나, 프리셋에 없는 조합은 맞춤 원정 빌더에서 만들어 `바로 실행`을 누릅니다.
3. 모바일 화면 크기와 실제 터치 조작을 함께 확인합니다.
4. 테스트가 끝나면 개발 도구로 돌아가 로컬 데이터를 초기화하거나 원래 데이터를 복원합니다.

QA 도구 자체를 수정할 때는 `tests/rendered-html.test.mjs`의 개발 도구 라우트·저장 키·직접 실행 연결 테스트도 갱신합니다.

## 7. 테스트 기준

```bash
npm test
```

이 명령은 다음을 한 번에 확인합니다.

1. Vinext 프로덕션 빌드 성공
2. 서버 렌더링과 게임 등록
3. 한국어 조사 규칙
4. 해루질럿 저장·복원
5. 그물 목표·구속·피해 처리
6. 모바일 UI와 주요 회귀 계약
7. 다른 보드게임 규칙 테스트

새 기능은 화면 문자열 존재 여부만 검사하지 말고 가능하면 엔진의 입력과 결과를 검증하는 테스트를 추가합니다. 이미지나 Canvas 효과는 유한 좌표, 상태 복원, 화면 밖 처리 같은 실패 조건을 함께 검사합니다.

해루질럿의 `/api/haeru-daily`는 D1에 오늘의 갯벌 개인 최고 기록과 통합 순위를 저장합니다. 재도전 횟수는 제한하거나 공개하지 않으며, 더 좋은 귀환 기록만 갱신합니다. 일일 조건은 한국 표준시 날짜로 결정되고 익명 참가자 ID는 일반 원정 저장과 분리되어 `/haeru-dev` 내보내기 대상이 아닙니다.

## 8. 배포, D1, 장애 복구

다음 문서에 운영 절차를 모았습니다.

- [Cloudflare Workers 독립 배포](docs/deployment-and-recovery.md#2-자체-cloudflare-workers에-독립-배포)
- [기존 OpenAI Sites 버전 저장·게시](docs/deployment-and-recovery.md#3-기존-openai-sites에-저장하고-게시)
- [D1 마이그레이션](docs/deployment-and-recovery.md#4-d1-마이그레이션)
- [장애 발생 시 복구](docs/deployment-and-recovery.md#5-장애-발생-시-복구)

배포 방식과 관계없이 다음 순서를 지킵니다.

```text
작업 브랜치 → 구현 → npm test → 검토 → 커밋·푸시
             → 정확히 그 커밋을 빌드 → 배포 → 실제 URL 확인
```

빌드한 커밋과 배포한 커밋이 다르면 재현과 롤백이 어려워지므로 배포 중에는 소스를 다시 수정하지 않습니다.

## 9. 인증과 비밀값

- `.env*`, 토큰, API 키, Sites 쓰기 자격정보는 커밋하지 않습니다.
- Cloudflare 자동 배포 토큰은 GitHub Actions Secrets에 저장합니다.
- `.openai/hosting.json`의 프로젝트 ID와 바인딩 이름은 비밀값이 아니지만 기존 Sites 연결 정보이므로 임의로 바꾸지 않습니다.
- `app/api/game-suggestions/route.ts`의 관리자 이메일은 인증 비밀이 아니라 권한 목록입니다. 운영자 변경 시 코드 리뷰를 거칩니다.
- OpenAI Sites에서 제공하는 `oai-authenticated-user-*` 헤더는 다른 호스팅에서 자동 제공되지 않습니다. 외부 호스팅으로 이전할 때는 별도 인증으로 교체해야 합니다.

## 10. 인수인계 체크리스트

- [ ] GitHub 저장소를 새 폴더에 복제했다.
- [ ] Node.js 요구 버전을 확인했다.
- [ ] `npm ci`와 `npm test`가 통과한다.
- [ ] `/haeru`와 `/haeru-dev`가 로컬에서 열린다.
- [ ] 저장 키와 `Campaign` 버전 정책을 이해했다.
- [ ] D1 변경 전 백업·마이그레이션 절차를 확인했다.
- [ ] 사용할 배포 대상의 계정과 권한을 확보했다.
- [ ] 비밀값을 Git이나 문서에 남기지 않았다.
- [ ] 배포할 커밋 SHA를 기록했다.
- [ ] 배포 후 실제 모바일 브라우저에서 핵심 흐름을 확인했다.

## 참고 자료

- [해루질럿 게임 기획 기준](docs/haeru-game-design.md)
- [해루질럿 시스템·코드 구조](docs/haeru-architecture.md)
- [해루질럿 QA 매트릭스](docs/haeru-qa-matrix.md)
- [박살: 리듬 AR 퇴마 댄싱 기획서](docs/baksal-game-design.md)
- [배포 이력](docs/releases.md)

- [Vinext 문서](https://vinext.dev/docs)
- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 문서](https://developers.cloudflare.com/d1/)
- [Drizzle ORM 문서](https://orm.drizzle.team/docs/overview)
