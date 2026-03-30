/**
 * Smoke: gera XLSX a partir de tests/fixtures/sped_minimo.txt via webapp-02/sped_engine/cli.py
 * Valida: exportação completa (12 abas) e subconjunto --sheets (2 abas).
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = path.resolve(root, "..", "webapp-02", "sped_engine");
const fixture = path.join(root, "tests", "fixtures", "sped_minimo.txt");
const outFull = path.join(os.tmpdir(), `sped-smoke-full-${Date.now()}.xlsx`);
const outSub = path.join(os.tmpdir(), `sped-smoke-sub-${Date.now()}.xlsx`);

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

function runCli(outputPath, extraArgs = []) {
  const args =
    base === "py"
      ? ["-3", cliPath, "--input", fixture, "--output", outputPath, ...extraArgs]
      : [cliPath, "--input", fixture, "--output", outputPath, ...extraArgs];
  return spawnSync(cmd, args, {
    cwd: engine,
    encoding: "utf-8",
    windowsHide: true,
  });
}

function listSheetNames(xlsxPath) {
  const pyCode = `import openpyxl,sys; w=openpyxl.load_workbook(sys.argv[1], read_only=True); print("|".join(w.sheetnames))`;
  const args = base === "py" ? ["-3", "-c", pyCode, xlsxPath] : ["-c", pyCode, xlsxPath];
  const r = spawnSync(cmd, args, {
    cwd: engine,
    encoding: "utf-8",
    windowsHide: true,
  });
  if (r.status !== 0) {
    console.error("Falha ao ler abas do XLSX:", r.stderr || r.stdout);
    process.exit(1);
  }
  return r.stdout.trim().split("|").filter(Boolean);
}

const expectedFull = [
  "RELATORIO",
  "0150",
  "0200",
  "C100",
  "C170",
  "C190",
  "C500",
  "C590",
  "D100",
  "D190",
  "D500",
  "D590",
];

const r1 = runCli(outFull);
if (r1.status !== 0) {
  console.error("cli.py (completo) falhou:", r1.stderr || r1.stdout || r1.error);
  process.exit(r1.status ?? 1);
}
if (!fs.existsSync(outFull)) {
  console.error("XLSX não foi criado:", outFull);
  process.exit(1);
}
const st = fs.statSync(outFull);
if (st.size < 200) {
  console.error("XLSX muito pequeno (suspeito):", st.size);
  process.exit(1);
}

const namesFull = listSheetNames(outFull);
if (namesFull.join(",") !== expectedFull.join(",")) {
  console.error("Abas esperadas (completo):", expectedFull.join(","));
  console.error("Abas obtidas:", namesFull.join(","));
  process.exit(1);
}

const r2 = runCli(outSub, ["--sheets", "C100"]);
if (r2.status !== 0) {
  console.error("cli.py (--sheets C100) falhou:", r2.stderr || r2.stdout || r2.error);
  process.exit(r2.status ?? 1);
}
const namesSub = listSheetNames(outSub);
if (namesSub.join(",") !== "RELATORIO,C100") {
  console.error('Abas esperadas (subconjunto): RELATORIO,C100');
  console.error("Abas obtidas:", namesSub.join(","));
  process.exit(1);
}

console.log("OK: export completo + --sheets C100");
fs.unlinkSync(outFull);
fs.unlinkSync(outSub);
