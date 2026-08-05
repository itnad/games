# paperoid project conventions

## Korean dynamic copy

- Every Korean sentence that appends a particle to a runtime value such as a player name, card, place, number, or game object must use the helpers in `app/korean-particles.js`.
- Use `withKoreanSubject`, `withKoreanTopic`, `withKoreanObject`, `withKoreanAnd`, or `withKoreanDirection` as appropriate. Never append raw `이/가`, `은/는`, `을/를`, `과/와`, or `으로/로` after an interpolation, and never show combined forms such as `이(가)` or `을(를)`.
- Keep the shared particle tests and the source audit in `tests/rendered-html.test.mjs` passing whenever an existing game is changed or a new game is added.

## Publishing after changes

- After completing and validating any user-requested source modification in this repository, publish the latest saved version to the existing Sites project in the same turn.
- Do not publish for read-only analysis, explanations, or status checks that make no source changes.
- Skip publishing when the user explicitly asks to keep a change local, save only, or not publish.
