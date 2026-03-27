/**
 * Smoke: gera XLSX a partir de tests/fixtures/sped_minimo.txt via webapp-02/sped_engine/cli.py
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = path.resolve(root, "..", "webapp-02", "sped_engine");
const fixture = path.join(root, "tests", "fixtures", "sped_minimo.txt");
const out = path.join(os.tmpdir(), `sped-smoke-${Date.now()}.xlsx`);

if (!fs.existsSync(engine)) {
  console.error("Pasta do motor SPED não encontrada:", engine);
  process.exit(1);
}
if (!fs.existsSync(fixture)) {
  console.error("Fixture não encontrada:", fixture);
  process.exit(1);
}

const cliPath = path.join(engine, "cli.py");
const isWin = process.platform === "win32";
const cmd = process.env.PYTHON_CMD || (isWin ? "py" : "python3");
const base = path.basename(cmd).replace(/\.exe$/i, "").toLowerCase();
const args =
  base === "py"
    ? ["-3", cliPath, "--input", fixture, "--output", out]
    : [cliPath, "--input", fixture, "--output", out];

const r = spawnSync(cmd, args, {
  cwd: engine,
  encoding: "utf-8",
  windowsHide: true,
});

if (r.status !== 0) {
  console.error("cli.py falhou:", r.stderr || r.stdout || r.error);
  process.exit(r.status ?? 1);
}

if (!fs.existsSync(out)) {
  console.error("XLSX não foi criado:", out);
  process.exit(1);
}

const st = fs.statSync(out);
if (st.size < 200) {
  console.error("XLSX muito pequeno (suspeito):", st.size);
  process.exit(1);
}

console.log("OK:", out, `(${st.size} bytes)`);
fs.unlinkSync(out);
