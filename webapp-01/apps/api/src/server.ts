import { randomUUID } from "node:crypto";
import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fs from "node:fs";
import path from "node:path";
import { API_PREFIX, SPED_EXPORT_SHEET_KEYS } from "@webapp/contracts";
import { getOutName } from "@webapp/nfe-core";
import { loadEnv } from "./env.js";
import { collectXmlFiles, extractZipSafe } from "./fs-utils.js";
import {
  getQueue,
  getRedis,
  getSciConsolidadoQueue,
  getSpedMergeQueue,
  getSpedQueue,
  type NfeJobPayload,
  type SciConsolidadoJobPayload,
  type SpedJobPayload,
  type SpedMergeJobPayload,
} from "./queue.js";
import { signDownloadToken, verifyDownloadToken } from "./tokens.js";

const SPED_SHEET_ALLOWED = new Set<string>(SPED_EXPORT_SHEET_KEYS);

function parseAndValidateSpedSheets(
  raw: string | undefined
): { ok: true; sheets: string[] | undefined } | { ok: false; error: string } {
  if (raw == null || raw.trim() === "") {
    return { ok: true, sheets: undefined };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Campo sheets deve ser JSON válido (array de strings)." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Campo sheets deve ser um array." };
  }
  if (parsed.length === 0) {
    return { ok: true, sheets: undefined };
  }
  for (const x of parsed) {
    if (typeof x !== "string" || !SPED_SHEET_ALLOWED.has(x)) {
      return {
        ok: false,
        error: `Aba SPED inválida: ${typeof x === "string" ? JSON.stringify(x) : String(x)}`,
      };
    }
  }
  const requested = new Set(parsed as string[]);
  const ordered = SPED_EXPORT_SHEET_KEYS.filter((k) => requested.has(k));
  if (ordered.length === 0) {
    return { ok: false, error: "Nenhuma aba válida em sheets." };
  }
  return { ok: true, sheets: ordered };
}

const env = loadEnv();
const app = fastify({
  logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
  bodyLimit: env.MAX_UPLOAD_MB * 1024 * 1024,
});

const origins = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

await app.register(helmet, { global: true });
await app.register(cors, { origin: origins, credentials: true });
/** Partes de arquivo no multipart (cada XML/ZIP = 1 parte). Precisa ≥ qtd enviada antes da validação de MAX_XML_FILES. */
const maxMultipartFileParts = Math.min(env.MAX_XML_FILES + 2_000, 20_000);

await app.register(multipart, {
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: maxMultipartFileParts,
  },
});
await app.register(rateLimit, {
  max: 30,
  timeWindow: "1 minute",
});

app.setErrorHandler((err, req, reply) => {
  if ((err as { code?: string }).code === "FST_FILES_LIMIT") {
    req.log.warn({ err }, "limite de partes multipart");
    return reply.code(413).send({
      error: `Envio com partes demais no formulário (máx. ${maxMultipartFileParts} arquivos por requisição). Envie em lotes menores ou use ZIP. Limite de XMLs após processar: ${env.MAX_XML_FILES}.`,
    });
  }
  return reply.send(err);
});

const queue = getQueue(env);
const spedQueue = getSpedQueue(env);
const spedMergeQueue = getSpedMergeQueue(env);
const sciConsolidadoQueue = getSciConsolidadoQueue(env);

function jobDir(id: string): string {
  /** Absoluto para o payload BullMQ: o worker/Python usa outro cwd e paths relativos quebram (ex.: SPED). */
  return path.resolve(env.TEMP_JOBS_ROOT, id);
}

function mapBullState(s: string): "queued" | "running" | "done" | "failed" {
  if (s === "completed") return "done";
  if (s === "failed") return "failed";
  if (s === "active") return "running";
  return "queued";
}

app.get(`${API_PREFIX}/health`, async () => ({ ok: true }));

/** Manifest para o hub de ferramentas (cards no frontend). */
app.get(`${API_PREFIX}/tools`, async () => ({
  tools: [
    {
      id: "nfe",
      title: "XML → XLSX",
      subtitle: "Notas fiscais eletrônicas",
      description: "Junte os arquivos das notas e baixe tudo numa planilha só.",
      route: "/tools/nfe",
      available: true,
    },
    {
      id: "sped",
      title: "SPED → XLSX",
      subtitle: "EFD Contribuições · ICMS-IPI",
      description: "Envie o arquivo do contador e receba uma planilha fácil de conferir e ajustar.",
      route: "/tools/sped",
      available: true,
    },
    {
      id: "webapp-03",
      title: "XLSX → SPED",
      subtitle: "Mescla planilha no .txt",
      description: "Envie o arquivo original e a planilha que você editou; baixe o resultado pronto para reenviar.",
      route: "/tools/sped-merge",
      available: true,
    },
    {
      id: "sci-consolidado",
      title: "Consolidado SCI",
      subtitle: "Planilha SCI → Excel",
      description:
        "Envie a exportação SCI (CSV ou Excel). Receba ProdutosSCI.xlsx com abas Produtos, Base e Consolidado (SCI).",
      route: "/tools/sci-consolidado",
      available: true,
    },
  ],
}));

app.get(`${API_PREFIX}/ready`, async (_req, reply) => {
  try {
    const redis = getRedis(env);
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error("redis");
    await fs.promises.mkdir(env.TEMP_JOBS_ROOT, { recursive: true });
    await fs.promises.access(env.TEMP_JOBS_ROOT, fs.constants.W_OK);
    return { ok: true };
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

app.post(`${API_PREFIX}/jobs`, async (req, reply) => {
  const jobId = randomUUID();
  const inDir = path.join(jobDir(jobId), "in");
  const outDir = path.join(jobDir(jobId), "out");

  try {
    const pong = await getRedis(env).ping();
    if (pong !== "PONG") {
      throw new Error("Redis não respondeu");
    }
  } catch (e) {
    req.log.warn({ err: e }, "redis indisponível ao criar job");
    return reply.code(503).send({
      error:
        "Redis não está acessível (porta 6379). Inicie o Redis e reinicie API + worker — ex.: Docker Desktop + docker run -p 6379:6379 redis:7-alpine",
    });
  }

  await fs.promises.mkdir(inDir, { recursive: true });
  await fs.promises.mkdir(outDir, { recursive: true });

  let totalBytes = 0;
  const parts = req.parts();
  for await (const part of parts) {
    if (part.type !== "file") continue;
    const name = (part.filename ?? "file").replace(/[/\\]/g, "_");
    const lower = name.toLowerCase();
    const buf = await part.toBuffer();
    totalBytes += buf.length;
    if (totalBytes > env.MAX_UPLOAD_MB * 1024 * 1024) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      return reply.code(413).send({ error: "Payload muito grande" });
    }
    if (lower.endsWith(".zip")) {
      try {
        await extractZipSafe(buf, inDir);
      } catch {
        await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
        return reply.code(400).send({ error: "ZIP inválido ou inseguro" });
      }
    } else if (lower.endsWith(".xml")) {
      const dest = path.join(inDir, name);
      await fs.promises.writeFile(dest, buf);
    }
  }

  const xmlPaths = await collectXmlFiles(inDir);
  if (xmlPaths.length === 0) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    return reply.code(400).send({ error: "Nenhum XML encontrado" });
  }
  if (xmlPaths.length > env.MAX_XML_FILES) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    return reply.code(400).send({ error: "Excesso de arquivos XML" });
  }

  const outName = getOutName(xmlPaths[0]!);
  const outputPath = path.join(outDir, outName);

  try {
    await Promise.race([
      queue.add(
        "convert",
        {
          jobId,
          xmlPaths,
          outputPath,
        } satisfies NfeJobPayload,
        { jobId }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Fila timeout")), 15_000)
      ),
    ]);
  } catch (e) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    req.log.error({ err: e }, "falha ao enfileirar job");
    return reply.code(503).send({
      error:
        "Não foi possível enfileirar o job (Redis/BullMQ). Verifique se o Redis está rodando e reinicie API e worker.",
    });
  }

  return reply.code(202).send({ id: jobId, status: "queued" as const });
});

app.get<{ Params: { id: string } }>(`${API_PREFIX}/jobs/:id`, async (req, reply) => {
  const { id } = req.params;
  const job = await queue.getJob(id);
  if (!job) {
    return reply.code(404).send({
      id,
      status: "not_found" as const,
    });
  }
  const state = await job.getState();
  const status = mapBullState(state);
  const progress =
    typeof job.progress === "number" ? Math.round(job.progress) : undefined;

  let downloadToken: string | undefined;
  let fileName: string | undefined;
  let error: string | undefined;

  if (status === "done") {
    const rv = job.returnvalue as { fileName?: string } | undefined;
    fileName = rv?.fileName ?? path.basename(String(job.data?.outputPath ?? "NFe_Itens.xlsx"));
    downloadToken = await signDownloadToken(env, id, fileName, "nfe");
  }
  if (status === "failed") {
    error = job.failedReason?.slice(0, 500) ?? "Falha no processamento";
  }

  return {
    id,
    status,
    progress,
    error,
    downloadToken,
    fileName,
  };
});

app.post(`${API_PREFIX}/tools/sped/jobs`, async (req, reply) => {
  const jobId = randomUUID();
  const inDir = path.join(jobDir(jobId), "in");
  const outDir = path.join(jobDir(jobId), "out");

  try {
    const pong = await getRedis(env).ping();
    if (pong !== "PONG") throw new Error("Redis não respondeu");
  } catch (e) {
    req.log.warn({ err: e }, "redis indisponível ao criar job SPED");
    return reply.code(503).send({
      error:
        "Redis não está acessível. Inicie o Redis e o worker SPED (worker-sped-bridge + Python).",
    });
  }

  await fs.promises.mkdir(inDir, { recursive: true });
  await fs.promises.mkdir(outDir, { recursive: true });

  let totalBytes = 0;
  let fileCount = 0;
  let sheetsFieldRaw: string | undefined;
  const parts = req.parts();
  for await (const part of parts) {
    if (part.type === "field") {
      if (part.fieldname === "sheets") {
        const v = part.value;
        sheetsFieldRaw =
          typeof v === "string"
            ? v
            : Buffer.isBuffer(v)
              ? v.toString("utf8")
              : String(v ?? "");
      }
      continue;
    }
    if (part.type !== "file") continue;
    fileCount += 1;
    if (fileCount > 1) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      return reply.code(400).send({ error: "Envie apenas um arquivo .txt SPED por vez." });
    }
    const name = (part.filename ?? "sped.txt").replace(/[/\\]/g, "_");
    const lower = name.toLowerCase();
    if (!lower.endsWith(".txt")) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      return reply.code(400).send({ error: "Apenas arquivos .txt são aceitos para SPED." });
    }
    const buf = await part.toBuffer();
    totalBytes += buf.length;
    if (totalBytes > env.MAX_UPLOAD_MB * 1024 * 1024) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      return reply.code(413).send({ error: "Arquivo SPED muito grande" });
    }
    const dest = path.join(inDir, "sped.txt");
    await fs.promises.writeFile(dest, buf);
  }

  if (fileCount === 0) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    return reply.code(400).send({ error: "Nenhum arquivo enviado" });
  }

  const sheetsParsed = parseAndValidateSpedSheets(sheetsFieldRaw);
  if (!sheetsParsed.ok) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    return reply.code(400).send({ error: sheetsParsed.error });
  }

  const inputPath = path.join(inDir, "sped.txt");
  const outputPath = path.join(outDir, "SPED_Convertido.xlsx");

  const payload: SpedJobPayload = {
    jobId,
    inputPath,
    outputPath,
    ...(sheetsParsed.sheets !== undefined ? { sheets: sheetsParsed.sheets } : {}),
  };

  try {
    await Promise.race([
      spedQueue.add(
        "convert",
        payload,
        { jobId }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Fila timeout")), 15_000)
      ),
    ]);
  } catch (e) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    req.log.error({ err: e }, "falha ao enfileirar job SPED");
    return reply.code(503).send({
      error:
        "Não foi possível enfileirar o job SPED. Verifique Redis e se o worker-sped-bridge está rodando.",
    });
  }

  return reply.code(202).send({ id: jobId, status: "queued" as const });
});

app.get<{ Params: { id: string } }>(`${API_PREFIX}/tools/sped/jobs/:id`, async (req, reply) => {
  const { id } = req.params;
  const job = await spedQueue.getJob(id);
  if (!job) {
    return reply.code(404).send({
      id,
      status: "not_found" as const,
    });
  }
  const state = await job.getState();
  const status = mapBullState(state);
  const progress =
    typeof job.progress === "number" ? Math.round(job.progress) : undefined;

  let downloadToken: string | undefined;
  let fileName: string | undefined;
  let error: string | undefined;

  if (status === "done") {
    const rv = job.returnvalue as { fileName?: string } | undefined;
    fileName =
      rv?.fileName ?? path.basename(String((job.data as SpedJobPayload).outputPath ?? "SPED_Convertido.xlsx"));
    downloadToken = await signDownloadToken(env, id, fileName, "sped");
  }
  if (status === "failed") {
    error = job.failedReason?.slice(0, 500) ?? "Falha no processamento";
  }

  return {
    id,
    status,
    progress,
    error,
    downloadToken,
    fileName,
  };
});

app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
  `${API_PREFIX}/jobs/:id/download`,
  async (req, reply) => {
    const { id } = req.params;
    const token = req.query.token;
    if (!token) return reply.code(401).send({ error: "Token ausente" });

    const claims = await verifyDownloadToken(env, token);
    if (!claims || claims.jobId !== id) {
      return reply.code(401).send({ error: "Token inválido" });
    }
    if (claims.tool === "sped" || claims.tool === "sped-merge" || claims.tool === "sci-consolidado") {
      return reply.code(401).send({ error: "Use o endpoint de download da ferramenta correspondente" });
    }

    const job = await queue.getJob(id);
    if (!job || (await job.getState()) !== "completed") {
      return reply.code(404).send({ error: "Job não concluído" });
    }

    const outPath = (job.data as NfeJobPayload).outputPath;
    if (!outPath || !fs.existsSync(outPath)) {
      return reply.code(404).send({ error: "Arquivo não encontrado" });
    }

    const stream = fs.createReadStream(outPath);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const fn = claims.fileName.replace(/[\r\n"]/g, "_");
    const asciiFallback = fn.replace(/[^\x20-\x7e]/g, "_");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fn)}`
    );
    return reply.send(stream);
  }
);

app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
  `${API_PREFIX}/tools/sped/jobs/:id/download`,
  async (req, reply) => {
    const { id } = req.params;
    const token = req.query.token;
    if (!token) return reply.code(401).send({ error: "Token ausente" });

    const claims = await verifyDownloadToken(env, token);
    if (!claims || claims.jobId !== id || claims.tool !== "sped") {
      return reply.code(401).send({ error: "Token inválido" });
    }

    const job = await spedQueue.getJob(id);
    if (!job || (await job.getState()) !== "completed") {
      return reply.code(404).send({ error: "Job não concluído" });
    }

    const outPath = (job.data as SpedJobPayload).outputPath;
    if (!outPath || !fs.existsSync(outPath)) {
      return reply.code(404).send({ error: "Arquivo não encontrado" });
    }

    const stream = fs.createReadStream(outPath);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const fn = claims.fileName.replace(/[\r\n"]/g, "_");
    const asciiFallback = fn.replace(/[^\x20-\x7e]/g, "_");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fn)}`
    );
    return reply.send(stream);
  }
);

app.post(`${API_PREFIX}/tools/sped-merge/jobs`, async (req, reply) => {
  const jobId = randomUUID();
  const inDir = path.join(jobDir(jobId), "in");
  const outDir = path.join(jobDir(jobId), "out");

  try {
    const pong = await getRedis(env).ping();
    if (pong !== "PONG") throw new Error("Redis não respondeu");
  } catch (e) {
    req.log.warn({ err: e }, "redis indisponível ao criar job SPED merge");
    return reply.code(503).send({
      error:
        "Redis não está acessível. Inicie o Redis e o worker SPED merge (worker-sped-merge-bridge + Python webapp-03).",
    });
  }

  await fs.promises.mkdir(inDir, { recursive: true });
  await fs.promises.mkdir(outDir, { recursive: true });

  let totalBytes = 0;
  let gotSped = false;
  let gotXlsx = false;
  const parts = req.parts();
  for await (const part of parts) {
    if (part.type !== "file") continue;
    const field = (part as { fieldname?: string }).fieldname ?? "";
    const name = (part.filename ?? "file").replace(/[/\\]/g, "_");
    const lower = name.toLowerCase();
    const buf = await part.toBuffer();
    totalBytes += buf.length;
    if (totalBytes > env.MAX_UPLOAD_MB * 1024 * 1024) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      return reply.code(413).send({ error: "Payload muito grande" });
    }

    if (field === "sped" || (!gotSped && lower.endsWith(".txt"))) {
      if (!lower.endsWith(".txt")) {
        await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
        return reply.code(400).send({ error: "O arquivo SPED deve ser .txt" });
      }
      await fs.promises.writeFile(path.join(inDir, "sped.txt"), buf);
      gotSped = true;
      continue;
    }
    if (field === "xlsx" || (!gotXlsx && (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")))) {
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
        await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
        return reply.code(400).send({ error: "A planilha deve ser .xlsx" });
      }
      await fs.promises.writeFile(path.join(inDir, "planilha.xlsx"), buf);
      gotXlsx = true;
      continue;
    }
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    return reply.code(400).send({ error: "Use os campos sped (.txt) e xlsx (.xlsx)." });
  }

  if (!gotSped || !gotXlsx) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    return reply.code(400).send({ error: "Envie o SPED .txt e o XLSX (dois arquivos)." });
  }

  const spedPath = path.join(inDir, "sped.txt");
  const xlsxPath = path.join(inDir, "planilha.xlsx");
  const outputPath = path.join(outDir, "SPED_mesclado.txt");

  try {
    await Promise.race([
      spedMergeQueue.add(
        "merge",
        {
          jobId,
          spedPath,
          xlsxPath,
          outputPath,
        } satisfies SpedMergeJobPayload,
        { jobId }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Fila timeout")), 15_000)
      ),
    ]);
  } catch (e) {
    await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
    req.log.error({ err: e }, "falha ao enfileirar job SPED merge");
    return reply.code(503).send({
      error:
        "Não foi possível enfileirar o job. Verifique Redis e se o worker-sped-merge-bridge está rodando.",
    });
  }

  return reply.code(202).send({ id: jobId, status: "queued" as const });
});

app.get<{ Params: { id: string } }>(`${API_PREFIX}/tools/sped-merge/jobs/:id`, async (req, reply) => {
  const { id } = req.params;
  const job = await spedMergeQueue.getJob(id);
  if (!job) {
    return reply.code(404).send({
      id,
      status: "not_found" as const,
    });
  }
  const state = await job.getState();
  const status = mapBullState(state);
  const progress =
    typeof job.progress === "number" ? Math.round(job.progress) : undefined;

  let downloadToken: string | undefined;
  let fileName: string | undefined;
  let error: string | undefined;

  if (status === "done") {
    const rv = job.returnvalue as { fileName?: string } | undefined;
    fileName =
      rv?.fileName ?? path.basename(String((job.data as SpedMergeJobPayload).outputPath ?? "SPED_mesclado.txt"));
    downloadToken = await signDownloadToken(env, id, fileName, "sped-merge");
  }
  if (status === "failed") {
    error = job.failedReason?.slice(0, 500) ?? "Falha no processamento";
  }

  return {
    id,
    status,
    progress,
    error,
    downloadToken,
    fileName,
  };
});

app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
  `${API_PREFIX}/tools/sped-merge/jobs/:id/download`,
  async (req, reply) => {
    const { id } = req.params;
    const token = req.query.token;
    if (!token) return reply.code(401).send({ error: "Token ausente" });

    const claims = await verifyDownloadToken(env, token);
    if (!claims || claims.jobId !== id || claims.tool !== "sped-merge") {
      return reply.code(401).send({ error: "Token inválido" });
    }

    const job = await spedMergeQueue.getJob(id);
    if (!job || (await job.getState()) !== "completed") {
      return reply.code(404).send({ error: "Job não concluído" });
    }

    const outPath = (job.data as SpedMergeJobPayload).outputPath;
    if (!outPath || !fs.existsSync(outPath)) {
      return reply.code(404).send({ error: "Arquivo não encontrado" });
    }

    const stream = fs.createReadStream(outPath);
    reply.header("Content-Type", "text/plain; charset=utf-8");
    const fn = claims.fileName.replace(/[\r\n"]/g, "_");
    const asciiFallback = fn.replace(/[^\x20-\x7e]/g, "_");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fn)}`
    );
    return reply.send(stream);
  }
);

const ALLOWED_SCI_EXT = new Set([".csv", ".txt", ".xlsx", ".xls"]);

app.post<{ Querystring: { sheet?: string } }>(
  `${API_PREFIX}/tools/sci-consolidado/jobs`,
  async (req, reply) => {
    const sheetName = req.query.sheet?.trim().slice(0, 120);
    const jobId = randomUUID();
    const inDir = path.join(jobDir(jobId), "in");
    const outDir = path.join(jobDir(jobId), "out");

    try {
      const pong = await getRedis(env).ping();
      if (pong !== "PONG") throw new Error("Redis não respondeu");
    } catch (e) {
      req.log.warn({ err: e }, "redis indisponível ao criar job SCI");
      return reply.code(503).send({
        error:
          "Redis não está acessível. Inicie o Redis e o worker Consolidado SCI (worker-sci-consolidado + Python).",
      });
    }

    await fs.promises.mkdir(inDir, { recursive: true });
    await fs.promises.mkdir(outDir, { recursive: true });

    let totalBytes = 0;
    let fileCount = 0;
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type !== "file") continue;
      fileCount += 1;
      if (fileCount > 1) {
        await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
        return reply.code(400).send({ error: "Envie apenas um arquivo por vez." });
      }
      const name = (part.filename ?? "entrada").replace(/[/\\]/g, "_");
      const ext = path.extname(name).toLowerCase();
      if (!ALLOWED_SCI_EXT.has(ext)) {
        await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
        return reply.code(400).send({
          error: "Formato não suportado. Use .csv, .txt, .xlsx ou .xls.",
        });
      }
      const buf = await part.toBuffer();
      totalBytes += buf.length;
      if (totalBytes > env.MAX_UPLOAD_MB * 1024 * 1024) {
        await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
        return reply.code(413).send({ error: "Arquivo muito grande" });
      }
      const dest = path.join(inDir, `entrada${ext}`);
      await fs.promises.writeFile(dest, buf);
    }

    if (fileCount === 0) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      return reply.code(400).send({ error: "Nenhum arquivo enviado" });
    }

    const entries = await fs.promises.readdir(inDir);
    const inputFile = entries.find((f) => f.startsWith("entrada."));
    if (!inputFile) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      return reply.code(400).send({ error: "Arquivo de entrada não encontrado" });
    }
    const inputPath = path.join(inDir, inputFile);
    const outputPath = path.join(outDir, "ProdutosSCI.xlsx");

    const payload: SciConsolidadoJobPayload = {
      jobId,
      inputPath,
      outputPath,
      ...(sheetName && sheetName.length > 0 ? { sheetName } : {}),
    };

    try {
      await Promise.race([
        sciConsolidadoQueue.add("consolidado", payload, { jobId }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Fila timeout")), 15_000)
        ),
      ]);
    } catch (e) {
      await fs.promises.rm(jobDir(jobId), { recursive: true, force: true });
      req.log.error({ err: e }, "falha ao enfileirar job SCI");
      return reply.code(503).send({
        error:
          "Não foi possível enfileirar o job. Verifique Redis e se o worker-sci-consolidado está rodando.",
      });
    }

    return reply.code(202).send({ id: jobId, status: "queued" as const });
  }
);

app.get<{ Params: { id: string } }>(`${API_PREFIX}/tools/sci-consolidado/jobs/:id`, async (req, reply) => {
  const { id } = req.params;
  const job = await sciConsolidadoQueue.getJob(id);
  if (!job) {
    return reply.code(404).send({
      id,
      status: "not_found" as const,
    });
  }
  const state = await job.getState();
  const status = mapBullState(state);
  const progress =
    typeof job.progress === "number" ? Math.round(job.progress) : undefined;

  let downloadToken: string | undefined;
  let fileName: string | undefined;
  let error: string | undefined;

  if (status === "done") {
    const rv = job.returnvalue as { fileName?: string } | undefined;
    fileName =
      rv?.fileName ??
      path.basename(String((job.data as SciConsolidadoJobPayload).outputPath ?? "ProdutosSCI.xlsx"));
    downloadToken = await signDownloadToken(env, id, fileName, "sci-consolidado");
  }
  if (status === "failed") {
    error = job.failedReason?.slice(0, 500) ?? "Falha no processamento";
  }

  return {
    id,
    status,
    progress,
    error,
    downloadToken,
    fileName,
  };
});

app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
  `${API_PREFIX}/tools/sci-consolidado/jobs/:id/download`,
  async (req, reply) => {
    const { id } = req.params;
    const token = req.query.token;
    if (!token) return reply.code(401).send({ error: "Token ausente" });

    const claims = await verifyDownloadToken(env, token);
    if (!claims || claims.jobId !== id || claims.tool !== "sci-consolidado") {
      return reply.code(401).send({ error: "Token inválido" });
    }

    const job = await sciConsolidadoQueue.getJob(id);
    if (!job || (await job.getState()) !== "completed") {
      return reply.code(404).send({ error: "Job não concluído" });
    }

    const outPath = (job.data as SciConsolidadoJobPayload).outputPath;
    if (!outPath || !fs.existsSync(outPath)) {
      return reply.code(404).send({ error: "Arquivo não encontrado" });
    }

    const stream = fs.createReadStream(outPath);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const fn = claims.fileName.replace(/[\r\n"]/g, "_");
    const asciiFallback = fn.replace(/[^\x20-\x7e]/g, "_");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fn)}`
    );
    return reply.send(stream);
  }
);

async function cleanupOldJobs(): Promise<void> {
  const root = path.resolve(env.TEMP_JOBS_ROOT);
  try {
    const dirs = await fs.promises.readdir(root, { withFileTypes: true });
    const maxAgeMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const p = path.join(root, d.name);
      const st = await fs.promises.stat(p);
      if (now - st.mtimeMs > maxAgeMs) {
        await fs.promises.rm(p, { recursive: true, force: true });
      }
    }
  } catch {
    /* ignore */
  }
}

setInterval(() => {
  cleanupOldJobs().catch(() => undefined);
}, 60 * 60 * 1000);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
app.log.info(`API ${API_PREFIX} na porta ${env.PORT}`);
