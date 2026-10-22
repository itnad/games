# paperoid 배포·D1·장애 복구 가이드

이 문서는 GitHub 소스를 인수받은 사람이나 다른 개발 에이전트가 paperoid를 검증하고 배포할 때 사용하는 운영 절차입니다.

## 1. 배포 방식 선택

| 방식 | 현재 상태 | 적합한 경우 |
| --- | --- | --- |
| OpenAI Sites 관리형 배포 | 현재 운영 방식 | 기존 `games.itnadcom.chatgpt.site` 주소와 Sites D1을 유지할 때 |
| 자체 Cloudflare Workers 배포 | 별도 Cloudflare 계정 설정 필요 | Codex/Sites 없이 GitHub 중심으로 독립 운영할 때 |

두 방식은 서로 다른 프로젝트입니다. 자체 Cloudflare 배포는 기존 `chatgpt.site` 주소나 Sites D1 데이터를 자동으로 이어받지 않습니다. 새 `workers.dev` 주소 또는 소유한 사용자 도메인을 사용하고, 필요한 데이터는 명시적으로 내보내고 가져옵니다.

## 2. 자체 Cloudflare Workers에 독립 배포

### 2.1 준비 사항

- Cloudflare 계정
- Workers와 D1 생성 권한
- Node.js `>=22.13.0`
- GitHub 저장소 읽기 권한
- 자동 배포를 구성한다면 GitHub 저장소 관리자 권한

처음 한 번 로그인합니다.

```bash
npx wrangler login
```

CI에서는 브라우저 로그인 대신 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`를 비밀값으로 사용합니다.

### 2.2 소스 복제와 검증

```bash
git clone https://github.com/itnad/games.git
cd games
npm ci
npm test
```

테스트가 실패한 상태로 배포를 진행하지 않습니다.

### 2.3 D1 생성

자체 계정에 운영 DB를 생성합니다.

```bash
npx wrangler d1 create paperoid-games-db
```

출력된 `database_id`를 기록합니다. ID는 비밀번호는 아니지만 계정별 설정값이므로 다른 프로젝트의 값을 재사용하지 않습니다.

### 2.4 Wrangler 설정 준비

저장소의 `wrangler.direct.example.jsonc`를 복사합니다.

macOS/Linux:

```bash
cp wrangler.direct.example.jsonc wrangler.direct.jsonc
```

PowerShell:

```powershell
Copy-Item wrangler.direct.example.jsonc wrangler.direct.jsonc
```

`wrangler.direct.jsonc`에서 다음 값을 바꿉니다.

- `name`: 본인 Cloudflare 계정에서 사용할 Worker 이름
- `database_name`: 앞 단계에서 생성한 D1 이름
- `database_id`: D1 생성 결과의 실제 ID
- `compatibility_date`: 업데이트하려면 별도 브랜치에서 전체 테스트 후 변경

`images.binding`은 `worker/index.ts`의 이미지 최적화 경로가 사용하는 `IMAGES`를 제공합니다. Images 사용량과 요금 정책은 Cloudflare 계정에서 별도로 확인합니다.

독립 배포를 장기 운영한다면 완성한 `wrangler.direct.jsonc`를 저장소에 커밋해 배포 설정을 코드와 함께 관리할 수 있습니다. API 토큰이나 계정 비밀번호는 이 파일에 넣지 않습니다.

### 2.5 최초 D1 마이그레이션

먼저 적용될 SQL을 확인합니다.

```bash
git diff -- drizzle/
```

그다음 운영 D1에 적용합니다.

```bash
npx wrangler d1 migrations apply paperoid-games-db --remote --config wrangler.direct.jsonc
```

목록을 확인하려면 다음을 사용합니다.

```bash
npx wrangler d1 migrations list paperoid-games-db --remote --config wrangler.direct.jsonc
```

### 2.6 빌드와 수동 배포

```bash
npm run build
npx wrangler deploy --config wrangler.direct.jsonc
```

빌드 후 Vinext/Cloudflare 플러그인이 `dist/server`, `dist/client`, `.wrangler/deploy/config.json`을 생성합니다. 이 폴더들은 빌드 산출물이므로 Git에 커밋하지 않습니다.

배포 후 다음을 확인합니다.

1. `/` 메인 목록
2. `/haeru` 게임 진입
3. `/haeru-dev` 내부 QA 도구
4. `/api/version`
5. 게임 추천 게시판 조회와 등록
6. 휴대폰 터치 이동, 일시정지, 이어하기

### 2.7 GitHub Actions 자동 배포

수동 배포가 한 번 성공한 뒤 자동화를 추가합니다. 완성된 `wrangler.direct.jsonc`를 커밋하고 GitHub 저장소 Settings → Secrets and variables → Actions에 다음 비밀값을 등록합니다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

예시 워크플로:

```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.13.0
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npx wrangler d1 migrations apply paperoid-games-db --remote --config wrangler.direct.jsonc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - run: npx wrangler deploy --config wrangler.direct.jsonc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

보호 브랜치를 사용한다면 Pull Request 테스트가 통과한 변경만 `main`에 병합하도록 설정합니다. 운영 DB 마이그레이션과 애플리케이션 배포는 같은 커밋에서 실행해야 합니다.

## 3. 기존 OpenAI Sites에 저장하고 게시

이 절차는 기존 주소를 유지하는 방법이며 Sites 프로젝트에 대한 소유자 또는 편집자 권한과 Sites 도구가 필요합니다. 일반 GitHub 권한만으로는 `chatgpt.site`에 게시할 수 없습니다.

현재 연결 정보:

- 프로젝트 ID: `.openai/hosting.json`의 `project_id`
- D1 바인딩: `DB`
- 운영 주소: `https://games.itnadcom.chatgpt.site`
- 공개 범위: 기존 설정을 조회하고 그대로 유지

Sites 기능을 지원하는 에이전트의 표준 절차:

1. `.openai/hosting.json`을 읽고 기존 `project_id`를 재사용합니다.
2. `get_site`로 프로젝트 상태, 공개 범위, 현재 버전을 확인합니다.
3. `create_source_repository_write_credential`로 짧은 수명의 쓰기 자격정보를 발급합니다.
4. Sites의 `site-workflow.mjs`로 해당 프로젝트 소스를 엽니다. 자격정보는 표준 입력으로만 전달하고 출력·파일·Git 설정에 저장하지 않습니다.
5. 변경 후 `npm test`를 통과시킵니다.
6. 변경을 커밋하고 Sites가 지정한 소스 브랜치에 푸시합니다.
7. 동일한 커밋 SHA로 Sites 빌드 아카이브를 만듭니다.
8. 공개 사이트라면 `save_site_version`으로 버전을 저장하고 `deploy_site_version`으로 그 버전을 게시합니다.
9. 상태가 `pending`, `building`, `publishing`이면 `get_deployment_status`로 종료 상태까지 확인합니다.
10. 성공 URL과 저장된 버전 번호를 기록합니다.

주의 사항:

- GitHub `origin/main` 푸시와 Sites 내부 소스 푸시는 별개일 수 있습니다. 두 저장소의 커밋 SHA를 확인합니다.
- 빌드 아카이브는 반드시 저장하려는 커밋에서 생성해야 합니다.
- 배포 실패 응답에 이미 저장된 `version_id`가 있다면 새 버전을 다시 만들지 말고 해당 버전을 재배포합니다.
- 공개 범위는 배포를 위해 변경하지 않습니다.
- Sites 쓰기 토큰은 절대 문서, 셸 인자, 환경 파일, Git remote URL에 남기지 않습니다.

사람이 Sites 도구 없이 작업하는 경우 GitHub까지는 개발·검증·푸시할 수 있지만 기존 Sites 게시 단계는 권한 있는 에이전트나 Sites 편집자가 이어서 수행해야 합니다.

## 4. D1 마이그레이션

### 4.1 소스 위치

- 스키마: `db/schema.ts`
- Drizzle 설정: `drizzle.config.ts`
- 마이그레이션: `drizzle/*.sql`
- Worker 연결: `db/index.ts`, `worker/index.ts`
- API 사용처: `app/api/game-suggestions/route.ts`

현재 D1은 게임 추천 게시판에 사용됩니다. 해루질럿의 진행 데이터는 브라우저 `localStorage`에 있으므로 D1 장애가 게임 플레이 저장을 직접 지우지는 않습니다.

### 4.2 변경 절차

1. `db/schema.ts`를 수정합니다.
2. 마이그레이션을 생성합니다.

```bash
npm run db:generate
```

3. 새 SQL을 직접 검토합니다.
4. 기존 마이그레이션 파일은 수정하지 않고 새 파일을 추가합니다.
5. `npm test`를 실행합니다.
6. 운영 DB를 백업합니다.
7. 선택한 배포 방식에 맞춰 마이그레이션을 적용합니다.

직접 Cloudflare 배포의 백업 예시:

```bash
npx wrangler d1 export paperoid-games-db --remote --output backups/paperoid-games-YYYYMMDD.sql --config wrangler.direct.jsonc
```

직접 Cloudflare 적용:

```bash
npx wrangler d1 migrations apply paperoid-games-db --remote --config wrangler.direct.jsonc
```

Sites 배포에서는 추적된 `drizzle/` 마이그레이션을 빌드 아카이브에 포함하고 Sites 버전 배포 절차를 사용합니다. 운영 DB에 직접 SQL을 실행한 뒤 같은 변경을 마이그레이션 파일에서 누락하지 않도록 주의합니다.

### 4.3 마이그레이션 원칙

- 운영에 적용된 SQL 파일을 나중에 고쳐 쓰지 않습니다.
- 열 삭제나 이름 변경은 데이터 복사·검증·전환 순서로 나눕니다.
- 파괴적인 변경 전에는 반드시 원격 백업을 만듭니다.
- 애플리케이션이 구·신 스키마 모두를 잠시 처리할 수 있도록 호환 배포를 우선합니다.
- DB 변경 커밋과 그 DB를 요구하는 애플리케이션 커밋을 따로 잃어버리지 않습니다.

## 5. 장애 발생 시 복구

### 5.1 배포 직후 화면이 비거나 로딩이 끝나지 않음

1. 배포한 커밋 SHA와 GitHub `main` SHA가 같은지 확인합니다.
2. 로컬의 깨끗한 복제본에서 `npm ci && npm test`를 실행합니다.
3. 브라우저 개발자 도구의 Console과 Network에서 첫 오류와 404 파일을 확인합니다.
4. `/api/version` 응답과 배포 로그를 확인합니다.
5. 문제가 확인되면 정상 커밋을 다시 배포하거나 문제 커밋을 `git revert`합니다.

기록을 보존하기 위해 공유 브랜치에서 `git reset --hard`나 강제 푸시로 운영 이력을 지우지 않습니다.

### 5.2 코드 롤백

권장 방식:

```bash
git revert <문제-커밋-SHA>
npm test
git push origin main
```

- Sites: 이전에 저장된 정상 버전을 다시 게시하거나 revert 커밋을 새 버전으로 게시합니다.
- 자체 Cloudflare: Cloudflare 대시보드에서 정상 Worker 버전으로 롤백하거나 revert 커밋을 다시 배포합니다.

롤백 후에도 DB 스키마가 새 버전인 경우가 있으므로 애플리케이션이 현재 DB와 호환되는지 먼저 확인합니다.

### 5.3 D1 장애 또는 잘못된 마이그레이션

1. 추가 쓰기 요청을 중단하거나 해당 API를 임시 비활성화합니다.
2. 적용된 마이그레이션 목록을 확인합니다.
3. 백업 SQL과 현재 DB를 비교합니다.
4. 데이터 보존용 보정 마이그레이션을 새로 작성하는 방식을 우선합니다.
5. 전체 복원이 필요하면 새 D1을 만든 뒤 백업을 가져오고 바인딩을 새 DB로 전환합니다.

기존 DB 위에 백업을 무조건 덮어쓰지 않습니다. 먼저 별도 DB에서 복원 결과와 행 수를 검증합니다.

### 5.4 추천 게시판만 실패함

게임은 정상인데 추천 게시판만 오류라면 다음을 확인합니다.

- Worker에 `DB` 바인딩이 존재하는지
- `game_suggestions` 테이블이 생성됐는지
- `drizzle/` 마이그레이션이 운영 DB에 적용됐는지
- 관리자 완료 처리라면 `oai-authenticated-user-email` 헤더 또는 대체 인증이 있는지

외부 Cloudflare 배포에서는 OpenAI Sites 인증 헤더가 자동으로 제공되지 않으므로 관리자 인증을 별도로 구현하기 전까지 관리자 PATCH 기능이 403이 되는 것이 정상입니다.

### 5.5 해루질럿 이어하기 또는 로컬 데이터 이상

1. `/haeru-dev`에서 저장 데이터를 먼저 내보냅니다.
2. `Campaign.version`과 활성 원정 `version`을 확인합니다.
3. `app/mudflat-run-save.js`의 검증에서 거부된 필드가 있는지 확인합니다.
4. 복구가 불가능하면 `/haeru-dev`에서 해루질럿 로컬 데이터만 초기화합니다.

브라우저 전체 저장소를 무작정 삭제하면 다른 게임 기록까지 사라질 수 있으므로 해루질럿 키만 제거합니다.

### 5.6 모바일에서 이전 버전이 계속 보임

1. `/api/version`과 화면에 표시된 빌드 ID를 비교합니다.
2. 진행 중 게임을 안전하게 종료하거나 메인으로 나가 업데이트를 반영합니다.
3. 새 시크릿 탭에서 같은 문제가 재현되는지 확인합니다.
4. Network에서 HTML과 JS 자산의 응답 코드와 파일명을 확인합니다.

캐시 삭제는 마지막 수단으로 사용하고, 먼저 실제 배포가 성공했는지 확인합니다.

## 6. 릴리스 체크리스트

- [ ] 작업 시작 전 원격 최신 변경을 받았다.
- [ ] 관련 코드와 저장 데이터 호환성을 검토했다.
- [ ] 새 규칙에 대응하는 테스트를 추가했다.
- [ ] `npm test`가 통과했다.
- [ ] D1 변경이 있다면 백업과 새 마이그레이션을 준비했다.
- [ ] 비밀값이 `git diff --cached`에 없는지 확인했다.
- [ ] 커밋 SHA를 기록하고 원격에 푸시했다.
- [ ] 바로 그 SHA에서 빌드와 배포를 수행했다.
- [ ] 배포 상태가 성공으로 끝났는지 확인했다.
- [ ] `/`, `/haeru`, `/api/version`, 추천 게시판을 확인했다.
- [ ] 모바일 터치·일시정지·이어하기를 확인했다.
- [ ] 버전 번호, 배포 URL, 필요 시 D1 마이그레이션 번호를 릴리스 기록에 남겼다.
