# paperoid project conventions

## Korean dynamic copy

- Every Korean sentence that appends a particle to a runtime value such as a player name, card, place, number, or game object must use the helpers in `app/korean-particles.js`.
- Use `withKoreanSubject`, `withKoreanTopic`, `withKoreanObject`, `withKoreanAnd`, or `withKoreanDirection` as appropriate. Never append raw `이/가`, `은/는`, `을/를`, `과/와`, or `으로/로` after an interpolation, and never show combined forms such as `이(가)` or `을(를)`.
- Keep the shared particle tests and the source audit in `tests/rendered-html.test.mjs` passing whenever an existing game is changed or a new game is added.

## Publishing after changes

- After completing and validating any user-requested source modification in this repository, publish the latest saved version to the existing Sites project in the same turn.
- Do not publish for read-only analysis, explanations, or status checks that make no source changes.
- Skip publishing when the user explicitly asks to keep a change local, save only, or not publish.

## Haerujilot source-of-truth synchronization

- When changing Haerujilot victory/failure conditions, stage identity, terminology, storage shape, or QA entry behavior, update the matching source, `docs/haeru-game-design.md`, `docs/haeru-architecture.md` or `docs/haeru-qa-matrix.md`, user-facing objective copy, and regression tests in the same change.
- Keep recurring stage hazards named `돌발 물살`, the final four-minute return event named `밀물`, the safe return facility named `베이스캠프`, and the between-stage UI named `정비 화면`.
- Gameplay randomness in the live Mudflat loop must use the saved deterministic runtime RNG, not direct `Math.random()` calls.
- Keep the daily challenge on KST dates, deterministic server-issued stage/seed conditions, unlimited retries with one best result per anonymous participant and day, and isolated from ordinary campaign/run saves.
- Daily participant identity is social identity: do not include it in `/haeru-dev` export or accept client-selected challenge conditions on the API.
