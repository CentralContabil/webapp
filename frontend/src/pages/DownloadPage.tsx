import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { TitleNfeXmlXlsx } from "../components/TitleNfeXmlXlsx.js";
import { ToolPageTitle } from "../components/ToolPageTitle.js";
import { toolPageShellClass, toolProgressFillClass } from "../toolLayout.js";
import {
  downloadUrl,
  getJob,
  getSpedJob,
  spedDownloadUrl,
  type JobResponse,
} from "../api.js";
import { fadeUp, transitionFast, transitionSmooth } from "../motion-variants.js";

type UiPhase =
  | "net_err"
  | "bad_id"
  | "loading"
  | "not_found"
  | "failed"
  | "done";

export default function DownloadPage() {
  const { pathname } = useLocation();
  const isSped = pathname.includes("/tools/sped/download");
  const { jobId: rawId } = useParams<{ jobId: string }>();
  const jobId = rawId ? decodeURIComponent(rawId) : "";
  const [job, setJob] = useState<JobResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const j = isSped ? await getSpedJob(jobId) : await getJob(jobId);
        if (cancelled) return;
        setLoadErr(null);
        setJob(j);
        if (
          j.status === "done" ||
          j.status === "failed" ||
          j.status === "not_found"
        ) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch {
        if (!cancelled) setLoadErr("Não foi possível consultar o job.");
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [jobId, isSped]);

  const showDeterminateBar =
    job?.status === "running" &&
    job.progress != null &&
    !Number.isNaN(job.progress);

  const progressLabel =
    job?.status === "running"
      ? "Gerando planilha…"
      : job?.status === "queued"
        ? "Na fila…"
        : "Carregando…";

  const stillWaiting =
    job == null ||
    job.status === "queued" ||
    job.status === "running" ||
    (job.status !== "done" &&
      job.status !== "failed" &&
      job.status !== "not_found");

  const phase: UiPhase = useMemo(() => {
    if (loadErr) return "net_err";
    if (!jobId) return "bad_id";
    if (stillWaiting) return "loading";
    if (job?.status === "not_found") return "not_found";
    if (job?.status === "failed") return "failed";
    if (job?.status === "done" && job.downloadToken) return "done";
    return "loading";
  }, [loadErr, jobId, stillWaiting, job]);

  const progressPct = showDeterminateBar
    ? Math.min(100, Math.max(0, job!.progress as number))
    : 0;

  const panelVariants = {
    initial: { opacity: 0, y: 14, scale: 0.98, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, y: -10, scale: 0.99, filter: "blur(4px)" },
  };

  return (
    <motion.div
      className={toolPageShellClass}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transitionSmooth}
    >
      <motion.header
        className="text-center"
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={{ ...transitionSmooth, delay: 0.04 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitionSmooth, delay: 0.08 }}
        >
          {isSped ? (
            <ToolPageTitle left="SPED" right="XLSX" size="download" />
          ) : (
            <TitleNfeXmlXlsx size="download" />
          )}
        </motion.div>
        <motion.p
          className="mt-3 text-[15px] leading-relaxed text-slate-600"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitionSmooth, delay: 0.14 }}
        >
          Download da planilha
        </motion.p>
      </motion.header>

      <motion.div
        className="rounded-2xl border border-white/50 bg-white/75 p-8 shadow-card backdrop-blur-xl"
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...transitionSmooth, delay: 0.1 }}
        layout
      >
        <AnimatePresence mode="wait">
          {phase === "net_err" && (
            <motion.p
              key="net_err"
              className="text-center text-sm font-medium text-rose-700"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionFast}
            >
              {loadErr}
            </motion.p>
          )}

          {phase === "bad_id" && (
            <motion.p
              key="bad_id"
              className="text-center text-slate-600"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionFast}
            >
              ID do job inválido.
            </motion.p>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              className="space-y-4"
              aria-live="polite"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionSmooth}
            >
              <motion.p
                className="text-center text-sm font-semibold text-indigo-600"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.06, ...transitionFast }}
              >
                {job ? progressLabel : "Carregando…"}
              </motion.p>
              <div
                className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-slate-300/50"
                role="progressbar"
                aria-valuetext={progressLabel}
                aria-busy={!showDeterminateBar}
                {...(showDeterminateBar
                  ? {
                      "aria-valuemin": 0,
                      "aria-valuemax": 100,
                      "aria-valuenow": Math.round(progressPct),
                    }
                  : {})}
              >
                <AnimatePresence mode="wait">
                  {showDeterminateBar ? (
                    <motion.div
                      key="determinate"
                      className={toolProgressFillClass}
                      initial={{ width: 0, opacity: 0.85 }}
                      animate={{ width: `${progressPct}%`, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ) : (
                    <motion.div
                      key="indeterminate"
                      className={`absolute top-0 h-full w-[38%] animate-loadingBar ${toolProgressFillClass}`}
                      aria-hidden
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={transitionFast}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {phase === "not_found" && (
            <motion.p
              key="not_found"
              className="text-center font-medium text-slate-600"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionFast}
            >
              Job não encontrado ou expirado.
            </motion.p>
          )}

          {phase === "failed" && job && (
            <motion.div
              key="failed"
              className="text-center"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionSmooth}
            >
              <motion.p
                className="font-bold text-rose-700"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitionFast}
              >
                Não foi possível gerar a planilha
              </motion.p>
              {job.error && (
                <motion.p
                  className="mt-2 text-sm text-rose-600"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transitionFast, delay: 0.06 }}
                >
                  {job.error}
                </motion.p>
              )}
            </motion.div>
          )}

          {phase === "done" && job?.downloadToken && (
            <motion.div
              key="done"
              className="flex flex-col items-center gap-6 text-center"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionSmooth}
            >
              <motion.div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-3xl font-bold text-white shadow-btn ring-4 ring-emerald-300/50"
                aria-hidden
                initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
              >
                ✓
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transitionSmooth, delay: 0.12 }}
              >
                <p className="font-display text-lg font-bold text-slate-800">Planilha pronta</p>
                <p className="mt-1 text-sm text-slate-600">
                  {isSped
                    ? "Baixe o arquivo XLSX gerado a partir do SPED .txt."
                    : "Baixe o arquivo XLSX gerado a partir dos seus XMLs."}
                </p>
              </motion.div>
              <motion.a
                className="flex w-full max-w-md flex-col items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accentHi px-5 py-4 text-center text-white shadow-[0_6px_24px_-8px_rgb(79_70_229/0.55)]"
                href={
                  isSped
                    ? spedDownloadUrl(job.id, job.downloadToken)
                    : downloadUrl(job.id, job.downloadToken)
                }
                download={job.fileName ?? (isSped ? "SPED_Convertido.xlsx" : "NFE_Itens.xlsx")}
                title={job.fileName ?? (isSped ? "SPED_Convertido.xlsx" : "NFE_Itens.xlsx")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transitionSmooth, delay: 0.2 }}
                whileHover={{ scale: 1.02, filter: "brightness(1.06)" }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="font-display text-[15px] font-bold uppercase tracking-wide">
                  Baixar planilha
                </span>
                <span className="w-full break-all font-sans text-[12px] font-medium normal-case leading-snug tracking-normal text-white/95">
                  {job.fileName ?? (isSped ? "SPED_Convertido.xlsx" : "NFE_Itens.xlsx")}
                </span>
              </motion.a>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="mt-8 border-t border-indigo-100/80 pt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...transitionSmooth, delay: 0.28 }}
        >
          <motion.div whileHover={{ x: -2 }} transition={transitionFast}>
            <Link
              to={isSped ? "/tools/sped" : "/tools/nfe"}
              className="font-display text-sm font-bold text-accent underline-offset-4 hover:text-accent2 hover:underline"
            >
              ← Nova conversão
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
