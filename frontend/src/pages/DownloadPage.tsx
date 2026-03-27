import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadUrl, getJob, type JobResponse } from "../api.js";

export default function DownloadPage() {
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
        const j = await getJob(jobId);
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
  }, [jobId]);

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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          NFe XML → XLSX
        </h1>
        <p className="mt-2 text-sm text-slate-600">Download da planilha</p>
      </header>

      <div className="rounded-2xl bg-white/90 p-8 shadow-sm">
        {loadErr && (
          <p className="text-center text-sm text-rose-700">{loadErr}</p>
        )}

        {!jobId && (
          <p className="text-center text-slate-600">ID do job inválido.</p>
        )}

        {jobId && stillWaiting && !loadErr && (
          <div className="space-y-4" aria-live="polite">
            <p className="text-center text-sm font-medium text-slate-600">
              {job ? progressLabel : "Carregando…"}
            </p>
            <div
              className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
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
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, job!.progress as number))}%`,
                  }}
                />
              ) : (
                <div
                  className="absolute top-0 h-full w-[38%] rounded-full bg-gradient-to-r from-accent to-accent2 shadow-sm animate-loadingBar"
                  aria-hidden
                />
              )}
            </div>
          </div>
        )}

        {job?.status === "not_found" && (
          <p className="text-center text-slate-600">
            Job não encontrado ou expirado.
          </p>
        )}

        {job?.status === "failed" && (
          <div className="text-center">
            <p className="font-medium text-rose-800">Não foi possível gerar a planilha</p>
            {job.error && (
              <p className="mt-2 text-sm text-rose-700">{job.error}</p>
            )}
          </div>
        )}

        {job?.status === "done" && job.downloadToken && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="rounded-full bg-mint/80 p-4 text-4xl" aria-hidden>
              ✓
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">
                Planilha pronta
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Baixe o arquivo XLSX gerado a partir dos seus XMLs.
              </p>
            </div>
            <a
              className="inline-flex w-full max-w-xs justify-center rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3.5 font-semibold text-white shadow-md transition hover:opacity-95"
              href={downloadUrl(job.id, job.downloadToken)}
              download={job.fileName ?? "NFe_Itens.xlsx"}
            >
              Baixar {job.fileName ?? "planilha.xlsx"}
            </a>
          </div>
        )}

        <div className="mt-8 border-t border-slate-100 pt-6 text-center">
          <Link
            to="/"
            className="text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            ← Nova conversão
          </Link>
        </div>
      </div>
    </div>
  );
}
