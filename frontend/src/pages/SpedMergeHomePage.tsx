import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { createSpedMergeJob, getSpedMergeJob, type JobResponse } from "../api.js";
import { fileLabel, getSpedFilesFromEvent } from "../dropFiles.js";
import { ToolPageTitle } from "../components/ToolPageTitle.js";
import {
  toolDropzoneClass,
  toolPageShellClass,
  toolPrimaryButtonClass,
  toolProgressFillClass,
} from "../toolLayout.js";
import {
  fadeUp,
  springSnappy,
  springSoft,
  transitionFast,
  transitionSmooth,
} from "../motion-variants.js";

export default function SpedMergeHomePage() {
  const navigate = useNavigate();
  const [spedFile, setSpedFile] = useState<File | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDropSped = useCallback((accepted: File[]) => {
    setSpedFile(accepted[0] ?? null);
    setErr(null);
  }, []);

  const onDropXlsx = useCallback((accepted: File[]) => {
    setXlsxFile(accepted[0] ?? null);
    setErr(null);
  }, []);

  const spedDrop = useDropzone({
    onDrop: onDropSped,
    maxFiles: 1,
    multiple: false,
    getFilesFromEvent: getSpedFilesFromEvent,
    validator: (file) => {
      if (file.name.toLowerCase().endsWith(".txt")) return null;
      return { code: "file-invalid-type", message: "Apenas .txt SPED" };
    },
  });

  const xlsxDrop = useDropzone({
    onDrop: onDropXlsx,
    maxFiles: 1,
    multiple: false,
    validator: (file) => {
      if (file.name.toLowerCase().endsWith(".xlsx")) return null;
      return { code: "file-invalid-type", message: "Apenas .xlsx" };
    },
  });

  const submit = async () => {
    if (!spedFile || !xlsxFile) return;
    setBusy(true);
    setErr(null);
    setJob(null);
    try {
      const { id } = await createSpedMergeJob(spedFile, xlsxFile);
      setJob({ id, status: "queued" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!job?.id || job.status === "done" || job.status === "failed") return;
    const t = setInterval(async () => {
      try {
        const j = await getSpedMergeJob(job.id);
        setJob(j);
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (job?.status === "done" && job.downloadToken && job.id) {
      navigate(`/tools/sped-merge/download/${encodeURIComponent(job.id)}`, { replace: true });
    }
  }, [job?.status, job?.downloadToken, job?.id, navigate]);

  const isProcessing =
    busy ||
    (job != null &&
      job.status !== "not_found" &&
      job.status !== "done" &&
      job.status !== "failed");

  const showDeterminateBar =
    job?.status === "running" &&
    job.progress != null &&
    !Number.isNaN(job.progress);

  const progressLabel = busy
    ? "Enviando arquivos…"
    : job?.status === "running"
      ? "Mesclando SPED…"
      : job?.status === "queued"
        ? "Na fila…"
        : "Aguarde…";

  const bothSelected = Boolean(spedFile && xlsxFile);

  return (
    <motion.div
      className={toolPageShellClass}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.header
        className="text-center"
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={{ ...transitionSmooth, delay: 0.05 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...springSoft, delay: 0.08 }}
        >
          <ToolPageTitle left="XLSX" right="SPED" size="home" />
        </motion.div>
        <motion.p
          className="mt-3 text-[15px] leading-relaxed text-slate-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Envie o <strong>SPED .txt original</strong> e o <strong>XLSX editado</strong> exportado pela ferramenta{" "}
          <strong>SPED → XLSX</strong> (planilha com coluna <code className="rounded bg-slate-100 px-1">_LINHA</code>
          ). O restante do arquivo que não está na planilha é preservado.
        </motion.p>
      </motion.header>

      <div className="grid gap-4 sm:grid-cols-2">
        <motion.section
          {...spedDrop.getRootProps()}
          className={toolDropzoneClass(spedDrop.isDragActive)}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitionSmooth, delay: 0.1 }}
        >
          <input {...spedDrop.getInputProps({ accept: ".txt,text/plain" })} />
          <p className="font-display text-sm font-semibold text-slate-800">1. SPED (.txt)</p>
          <p className="mt-1 text-xs text-slate-600">
            {spedDrop.isDragActive ? "Solte…" : "Clique ou arraste o .txt original"}
          </p>
          {spedFile && (
            <p className="mt-2 truncate text-xs text-indigo-700" title={fileLabel(spedFile)}>
              {fileLabel(spedFile)}
            </p>
          )}
        </motion.section>

        <motion.section
          {...xlsxDrop.getRootProps()}
          className={toolDropzoneClass(xlsxDrop.isDragActive)}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitionSmooth, delay: 0.14 }}
        >
          <input {...xlsxDrop.getInputProps({ accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })} />
          <p className="font-display text-sm font-semibold text-slate-800">2. Planilha (.xlsx)</p>
          <p className="mt-1 text-xs text-slate-600">
            {xlsxDrop.isDragActive ? "Solte…" : "Mesma exportação SPED→XLSX, já editada"}
          </p>
          {xlsxFile && (
            <p className="mt-2 truncate text-xs text-indigo-700" title={fileLabel(xlsxFile)}>
              {fileLabel(xlsxFile)}
            </p>
          )}
        </motion.section>
      </div>

      <AnimatePresence mode="popLayout">
        {bothSelected && (
          <motion.div
            key="submit-panel"
            className="flex flex-col rounded-2xl border border-white/50 bg-white/75 p-4 shadow-card backdrop-blur-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={transitionSmooth}
          >
            <motion.button
              type="button"
              disabled={busy || isProcessing}
              onClick={submit}
              className={toolPrimaryButtonClass}
              whileHover={
                busy || isProcessing
                  ? undefined
                  : { scale: 1.015, boxShadow: "0 12px 40px -8px rgb(79 70 229 / 0.45)" }
              }
              whileTap={busy || isProcessing ? undefined : { scale: 0.985 }}
              transition={springSnappy}
            >
              {busy || isProcessing ? "Processando…" : "Mesclar e gerar SPED"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProcessing && (
          <motion.div
            key="progress"
            className="space-y-2 rounded-2xl border border-white/50 bg-white/75 p-4 shadow-card backdrop-blur-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transitionSmooth}
          >
            <p className="text-center text-xs font-semibold text-indigo-600">{progressLabel}</p>
            <div
              className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-slate-300/50"
              role="progressbar"
              aria-valuetext={progressLabel}
              aria-busy={!showDeterminateBar}
              {...(showDeterminateBar
                ? {
                    "aria-valuemin": 0,
                    "aria-valuemax": 100,
                    "aria-valuenow": Math.round(
                      Math.min(100, Math.max(0, job!.progress as number))
                    ),
                  }
                : {})}
            >
              {showDeterminateBar ? (
                <motion.div
                  className={toolProgressFillClass}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, Math.max(0, job!.progress as number))}%`,
                  }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : (
                <div
                  className={`absolute top-0 h-full w-[38%] animate-loadingBar ${toolProgressFillClass}`}
                  aria-hidden
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {err && (
          <motion.p
            key="err"
            className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-orange-50 px-4 py-3 text-sm font-medium text-rose-900 shadow-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transitionSmooth}
          >
            {err}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {job?.status === "failed" && (
          <motion.div
            key="failed"
            className="rounded-2xl border border-rose-200/80 bg-white/80 p-6 shadow-card backdrop-blur-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transitionSmooth}
          >
            <p className="font-bold text-rose-700">Erro ao mesclar</p>
            {job.error && <p className="mt-2 text-sm text-rose-600">{job.error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
