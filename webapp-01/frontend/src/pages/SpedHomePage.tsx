import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { createSpedJob, getSpedJob, type JobResponse } from "../api.js";
import { fileLabel, getSpedFilesFromEvent } from "../dropFiles.js";
import { ToolPageTitle } from "../components/ToolPageTitle.js";
import {
  toolDropzoneClass,
  toolErrorBannerClass,
  toolErrorPanelClass,
  toolPageShellClass,
  toolPanelClass,
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

export default function SpedHomePage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(() => accepted.slice(0, 1));
    setErr(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    getFilesFromEvent: getSpedFilesFromEvent,
    /** Sem `accept`: no Windows o MIME do .txt costuma ser vazio e o dropzone descartava o arquivo. Validação só pela extensão. */
    validator: (file) => {
      const n = file.name.toLowerCase();
      if (n.endsWith(".txt")) return null;
      return {
        code: "file-invalid-type",
        message: "Envie só o arquivo de texto da declaração",
      };
    },
  });

  const removeFile = () => {
    setFiles([]);
  };

  const submit = async () => {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    setErr(null);
    setJob(null);
    try {
      const { id } = await createSpedJob(f);
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
        const j = await getSpedJob(job.id);
        setJob(j);
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (job?.status === "done" && job.downloadToken && job.id) {
      navigate(`/tools/sped/download/${encodeURIComponent(job.id)}`, { replace: true });
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
    ? "Enviando arquivo…"
    : job?.status === "running"
      ? "Gerando planilha…"
      : job?.status === "queued"
        ? "Na fila…"
        : "Aguarde…";

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
          <ToolPageTitle left="SPED" right="XLSX" size="home" />
        </motion.div>
        <motion.p
          className="mt-3 text-[15px] leading-relaxed text-[#1e3d4d]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Envie um arquivo por vez — o mesmo que você recebe do contador. Na planilha, cada tipo de informação aparece
          separado para ficar fácil de ler.
        </motion.p>
      </motion.header>

      <section {...getRootProps()} className={toolDropzoneClass(isDragActive)}>
        <motion.div
          className="flex min-h-0 w-full flex-col"
          initial={{ opacity: 0, y: 20, scale: 0.98, filter: "blur(6px)" }}
          animate={{
            opacity: 1,
            y: 0,
            scale: isDragActive ? 1.02 : 1,
            filter: "blur(0px)",
          }}
          transition={isDragActive ? springSnappy : { ...transitionSmooth, delay: 0.12 }}
          whileHover={{ scale: isDragActive ? 1.02 : 1.01 }}
          whileTap={{ scale: 0.995 }}
        >
          <input {...getInputProps({ accept: ".txt,text/plain" })} />
          <motion.p
            className="font-display font-semibold text-brand-ink"
            animate={{ opacity: 1, y: 0 }}
            key={isDragActive ? "drag" : "idle"}
            initial={{ opacity: 0.85, y: 4 }}
            transition={transitionFast}
          >
            {isDragActive ? "Solte o arquivo…" : "Clique ou arraste o arquivo do escritório fiscal"}
          </motion.p>
          <p className="mt-2 text-sm text-[#347891]">Só um arquivo por vez</p>
        </motion.div>
      </section>

      <AnimatePresence mode="popLayout">
        {files.length > 0 && (
          <motion.div
            key="files-panel"
            className={`flex flex-col p-4 ${toolPanelClass}`}
            initial={{ opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -16, scale: 0.98, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            layout
          >
            <ul className="space-y-2" aria-label="Arquivo selecionado">
              {files.map((f, i) => (
                <motion.li
                  key={`${fileLabel(f)}-${i}`}
                  layout
                  initial={{ opacity: 0, x: -16, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={transitionSmooth}
                  className="flex items-center justify-between gap-2 rounded-lg bg-brand-soft/90 px-3 py-2 text-sm text-brand-ink ring-1 ring-brand-line/60"
                >
                  <span className="min-w-0 truncate" title={fileLabel(f)}>
                    {fileLabel(f)}
                  </span>
                  <motion.button
                    type="button"
                    className="shrink-0 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                    onClick={removeFile}
                    whileHover={{ scale: 1.06, filter: "brightness(1.08)" }}
                    whileTap={{ scale: 0.92 }}
                    transition={springSnappy}
                  >
                    remover
                  </motion.button>
                </motion.li>
              ))}
            </ul>
            <motion.button
              type="button"
              disabled={busy}
              onClick={submit}
              className={`mt-4 ${toolPrimaryButtonClass}`}
              whileHover={busy ? undefined : { scale: 1.015, boxShadow: "0 12px 40px -8px rgb(42 79 96 / 0.2)" }}
              whileTap={busy ? undefined : { scale: 0.985 }}
              transition={springSnappy}
            >
              {busy ? "Enviando…" : "Gerar planilha"}
            </motion.button>
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  key="progress"
                  className="mt-4 space-y-2"
                  aria-live="polite"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                  <motion.p
                    className="text-center text-xs font-semibold text-accent"
                    key={progressLabel}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={transitionFast}
                  >
                    {progressLabel}
                  </motion.p>
                  <div
                    className="relative h-3 w-full overflow-hidden rounded-full bg-brand-soft ring-1 ring-brand-line/70"
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {err && (
          <motion.p
            key="err"
            className={toolErrorBannerClass}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
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
            className={toolErrorPanelClass}
            initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={transitionSmooth}
          >
            <p className="font-bold text-rose-700">Erro ao processar</p>
            {job.error && <p className="mt-2 text-sm text-rose-600">{job.error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
