// 스타드래프트를 HTML 파일 하나로 묶는다.
//   node scripts/build-game-standalone.mjs            → dist-standalone/starswar.html (React·PixiJS 포함, 오프라인 실행)
//   node scripts/build-game-standalone.mjs --artifact → dist-standalone/starswar-artifact.html (React는 cdnjs, PixiJS는 jsDelivr에서 로드)
import { execSync } from "node:child_process";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const artifact = process.argv.includes("--artifact");
// 게임 판: 결과 화면의 리포트에 넣어, 재현 코드가 어느 코드에서 나온 경기인지 알 수 있게 한다.
const gitText = (command) => {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};
const commit = gitText("git rev-parse --short HEAD") || "unknown";
const dirty = gitText("git status --porcelain --untracked-files=no") ? "+수정" : "";
const buildId = `${commit}${dirty} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
const pixiVersion = JSON.parse(await readFile(new URL("../node_modules/pixi.js/package.json", import.meta.url), "utf8")).version;
const here = fileURLToPath(new URL("./game-standalone/", import.meta.url));
const outDir = fileURLToPath(new URL("../dist-standalone/", import.meta.url));

const globalsPlugin = {
  name: "react-umd-globals",
  setup(context) {
    context.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: `${here}jsx-runtime-shim.js` }));
    context.onResolve({ filter: /^(react|react-dom\/client|pixi\.js|pixi\.js\/unsafe-eval)$/ }, (args) => ({ path: args.path, namespace: "umd-global" }));
    const globals = {
      react: "module.exports = window.React;",
      "react-dom/client": "module.exports = window.ReactDOM;",
      "pixi.js": "module.exports = window.PIXI;",
      // jsDelivr의 unsafe-eval 패키지가 PIXI 전역에 직접 설치되므로 번들 쪽은 비워 둔다.
      "pixi.js/unsafe-eval": "module.exports = {};",
    };
    context.onLoad({ filter: /.*/, namespace: "umd-global" }, (args) => ({ contents: globals[args.path], loader: "js" }));
  },
};

const result = await build({
  entryPoints: [`${here}entry.tsx`],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  outdir: "out",
  // 웹 빌드용 값(app-version.ts). 단일 HTML은 __STW_BUILD__로 게임 판을 적으므로 자리만 채운다.
  define: { "process.env.NODE_ENV": '"production"', __STW_BUILD__: JSON.stringify(buildId), "import.meta.env.VITE_PAPEROID_BUILD_ID": '"standalone"', "import.meta.env.VITE_PAPEROID_GIT_SHA": '"standalone"' },
  plugins: artifact ? [globalsPlugin] : [],
  logLevel: "warning",
});

const js = result.outputFiles.find((file) => file.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const css = result.outputFiles.find((file) => file.path.endsWith(".css")).text.replace(/<\/style/gi, "<\\/style");
const title = "<title>스타드래프트</title>";
const body = `<div id="game-root"></div>`;
const react = artifact
  ? [
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>',
      `<script src="https://cdn.jsdelivr.net/npm/pixi.js@${pixiVersion}/dist/pixi.min.js"></script>`,
      `<script src="https://cdn.jsdelivr.net/npm/pixi.js@${pixiVersion}/dist/packages/unsafe-eval.min.js"></script>`,
    ].join("\n")
  : "";

const html = artifact
  ? `${title}\n<meta name="theme-color" content="#120d07">\n<style>${css}</style>\n${body}\n${react}\n<script>${js}</script>\n`
  : `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#120d07">
<meta name="apple-mobile-web-app-capable" content="yes">
${title}
<style>${css}</style>
</head>
<body>
${body}
<script>${js}</script>
</body>
</html>
`;

await mkdir(outDir, { recursive: true });
const file = `${outDir}${artifact ? "starswar-artifact.html" : "starswar.html"}`;
await writeFile(file, html);
console.log(`${file} (${Math.round(Buffer.byteLength(html) / 1024)}KB)`);
