// 전선 지휘관을 HTML 파일 하나로 묶는다.
//   node scripts/build-frontline-standalone.mjs            → dist-standalone/frontline.html (React 포함, 오프라인 실행)
//   node scripts/build-frontline-standalone.mjs --artifact → dist-standalone/frontline-artifact.html (React는 cdnjs에서 로드)
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const artifact = process.argv.includes("--artifact");
const here = fileURLToPath(new URL("./frontline-standalone/", import.meta.url));
const outDir = fileURLToPath(new URL("../dist-standalone/", import.meta.url));

const globalsPlugin = {
  name: "react-umd-globals",
  setup(context) {
    context.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: `${here}jsx-runtime-shim.js` }));
    context.onResolve({ filter: /^(react|react-dom\/client)$/ }, (args) => ({ path: args.path, namespace: "umd-global" }));
    context.onLoad({ filter: /.*/, namespace: "umd-global" }, (args) => ({
      contents: args.path === "react" ? "module.exports = window.React;" : "module.exports = window.ReactDOM;",
      loader: "js",
    }));
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
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: artifact ? [globalsPlugin] : [],
  logLevel: "warning",
});

const js = result.outputFiles.find((file) => file.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const css = result.outputFiles.find((file) => file.path.endsWith(".css")).text.replace(/<\/style/gi, "<\\/style");
const title = "<title>전선 지휘관</title>";
const body = `<div id="frontline-root"></div>`;
const react = artifact
  ? [
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>',
    ].join("\n")
  : "";

const html = artifact
  ? `${title}\n<meta name="theme-color" content="#0b1210">\n<style>${css}</style>\n${body}\n${react}\n<script>${js}</script>\n`
  : `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b1210">
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
const file = `${outDir}${artifact ? "frontline-artifact.html" : "frontline.html"}`;
await writeFile(file, html);
console.log(`${file} (${Math.round(Buffer.byteLength(html) / 1024)}KB)`);
