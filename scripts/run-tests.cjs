#!/usr/bin/env node
// 离线测试入口：用 esbuild 把 TS/TSX 测试打成 CJS（react/react-dom/jsdom 走 external），再用 node 跑
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const esbuild = path.join(root, "node_modules", ".bin", "esbuild");

const cases = [
  ["scripts/check-logic.ts", "纯逻辑：分速/距离档/排行排除/24小时催查/统计"],
  ["scripts/smoke.tsx", "端到端：新建训放/登记归巢/排行筛选/待核/档案配对/持久化"],
];

let failed = 0;
for (const [entry, label] of cases) {
  console.log(`\n=== ${label} ===`);
  const out = path.join(root, "scripts", `.tmp-test-${path.basename(entry)}.cjs`);
  try {
    execFileSync(
      esbuild,
      [
        path.join(root, entry),
        "--bundle",
        "--platform=node",
        "--format=cjs",
        "--loader:.css=empty",
        "--external:jsdom",
        "--external:react",
        "--external:react-dom",
        `--outfile=${out}`,
        "--log-level=error",
      ],
      { cwd: root, stdio: "inherit" }
    );
    execFileSync(process.execPath, [out], { cwd: root, stdio: "inherit" });
  } catch {
    failed++;
  } finally {
    if (fs.existsSync(out)) fs.rmSync(out);
  }
}

if (failed > 0) {
  console.error(`\n${failed} 个测试套件失败`);
  process.exit(1);
}
console.log("\n全部测试通过");
