# 해루질럿 시스템·코드 구조

## 1. 실행 구조

`/haeru`는 `MudflatSurvivorGame`을 진입점으로 사용합니다. 화면 상태는 `setup → running ↔ paused/upgrade → camp 또는 defeat`로 전환됩니다. Canvas 월드는 React 렌더와 분리된 `runtimeRef`에 있고, HUD에 필요한 값만 주기적으로 React 상태로 복사합니다.

## 2. 모듈 경계

| 모듈 | 책임 |
| --- | --- |
| `mudflat-survivor-game.tsx` | 화면 상태, 입력, 게임 루프, Canvas와 UI 연결 |
| `mudflat-survivor-engine.js` | 밸런스 데이터와 순수 규칙 |
| `mudflat-survivor-model.ts` | 캠페인, 저장 키, 표시 모델 |
| `mudflat-survivor-types.ts` | 공유 TypeScript 타입 |
| `mudflat-terrain.ts` | 깊은 펄·갯벌 표면의 결정적 지형 계산과 경로 |
| `mudflat-rng.js` | 시드 정규화와 결정적 게임 난수 |
| `mudflat-run-save.js` | 진행 중 월드 직렬화, 검증, 이전 필드 보완 |
| `mudflat-cast-net*.js` | 그물 목표·상태와 렌더링 |
| `mudflat-lumi-*` | 루미 애니메이션·렌더링 |
| `mudflat-dev-tools.tsx` | 로컬 저장 내보내기·복원과 고정 시드 프리셋 |

최상위 게임 파일에 새 순수 계산을 직접 늘리지 않습니다. 지형, 확률, 가격, 충돌 규칙은 독립 모듈로 옮기고 Node 테스트에서 검증합니다.

## 3. 상태와 저장

- `Campaign`: 스테이지 사이에 유지되는 코인, 체력, 레벨, 기술, 장비, 조과입니다.
- `Runtime`: 진행 중 원정의 플레이어, 월드 엔티티, 타이머, 이펙트, `seed`, `rngState`입니다.
- `Hud`: 화면 표시용 축약 상태입니다.
- `choiceIds`, `nextSequence`: 기술 선택 복원과 엔티티 ID 충돌 방지용입니다.

런타임의 새 필드는 저장 템플릿 검사 대상입니다. 이전 저장에도 기본값을 줄 수 있는 필드는 `decodeMudflatRun`에서 명시적으로 보완하고 테스트합니다. 의미가 달라져 안전하게 변환할 수 없으면 저장 버전을 올립니다.

## 4. 결정적 난수

원정 시작 시 `createMudflatSeed()`로 시드를 만들고 모든 게임플레이 확률은 `runtimeRandom(runtime)`을 거칩니다. 다음 상태는 `runtime.rngState`에 기록되므로 저장 후 이어하기도 동일한 확률 흐름을 이어갑니다.

- 엔진의 단계 조합처럼 입력만으로 결정되는 값은 자체 결정 함수를 사용할 수 있습니다.
- 게임 루프에서 `Math.random()`을 직접 호출하지 않습니다.
- `/haeru-dev` 프리셋은 고정 시드를 사용해 같은 조건을 재현합니다.

## 5. 렌더링과 모바일

- Canvas는 최대 2배 device pixel ratio로 내부 해상도를 조정합니다.
- 오버레이는 `100dvh`, 내부 스크롤 영역의 `min-height: 0`, 안전 영역 여백을 함께 사용해야 합니다.
- 360×640, 390×844, 412×915에서 닫기 버튼, 기본 행동 버튼, 하단 기술바가 서로 가리지 않아야 합니다.
- 큰 이미지는 표시 크기를 먼저 예약하고, 실제 표시용 WebP와 보존용 원본을 구분합니다.

## 6. 소스 기준과 변경 순서

1. 기획 의미: `docs/haeru-game-design.md`
2. 실제 수치·규칙: `mudflat-survivor-engine.js`
3. 저장 계약: `mudflat-run-save.js`, `mudflat-survivor-types.ts`
4. 사용자 안내: `game-objectives.js`, 화면 컴포넌트
5. 회귀 계약: `tests/mudflat-*.test.mjs`, `tests/rendered-html.test.mjs`

서로 충돌하면 실제 코드만 조용히 따르지 말고, 의도와 구현을 확인한 뒤 같은 변경에서 모두 맞춥니다.
