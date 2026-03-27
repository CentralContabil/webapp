import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { createJob, getJob, type JobResponse } from "../api.js";
import { fileLabel, getFilesFromEvent } from "../dropFiles.js";

export default function HomePage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted]);
    setErr(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    getFilesFromEvent,
    accept: {
      "application/xml": [".xml"],
      "text/xml": [".xml"],
      "application/zip": [".zip"],
    },
    validator: (file) => {
      const n = file.name.toLowerCase();
      if (n.endsWith(".xml") || n.endsWith(".zip")) return null;
      return {
        code: "file-invalid-type",
        message: "Apenas .xml ou .zip na seleção",
      };
    },
  });

  const removeAt = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setErr(null);
    setJob(null);
    try {
      const { id } = await createJob(files);
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
        const j = await getJob(job.id);
        setJob(j);
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (job?.status === "done" && job.downloadToken && job.id) {
      navigate(`/download/${encodeURIComponent(job.id)}`, { replace: true });
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
      ? "Gerando planilha…"
      : job?.status === "queued"
        ? "Na fila…"
        : "Aguarde…";

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">
          NFe XML → XLSX
        </h1>
        <p className="mt-2 text-slate-600">
          Arraste XMLs, um ZIP ou uma pasta (só entram arquivos .xml; na raiz também
          .zip). Outros tipos são ignorados.
        </p>
      </header>

      <section
        {...getRootProps()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed bg-white/80 p-10 text-center shadow-sm backdrop-blur transition
          ${isDragActive ? "border-accent bg-lilac/50" : "border-slate-200 hover:border-accent/60"}`}
      >
        <input {...getInputProps()} />
        <p className="font-medium text-slate-700">
          {isDragActive
            ? "Solte os arquivos…"
            : "Clique ou arraste XML, ZIP ou pasta com XMLs"}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Pastas: apenas .xml dentro da pasta; demais arquivos ignorados
        </p>
      </section>

      {files.length > 0 && (
        <div className="flex flex-col rounded-2xl bg-white/90 p-4 shadow-sm">
          <ul
            className="max-h-[min(42vh,20rem)] space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]"
            aria-label="Arquivos selecionados"
          >
            {files.map((f, i) => (
              <li
                key={`${fileLabel(f)}-${i}`}
                className="flex items-center justify-between gap-2 text-sm text-slate-700"
              >
                <span className="min-w-0 truncate" title={fileLabel(f)}>
                  {fileLabel(f)}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-rose-100 px-2 py-1 text-rose-700 text-xs"
                  onClick={() => removeAt(i)}
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="mt-4 w-full shrink-0 rounded-xl bg-gradient-to-r from-accent to-accent2 py-3 font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Gerar planilha"}
          </button>
          {isProcessing && (
            <div className="mt-4 space-y-2" aria-live="polite">
              <p className="text-center text-xs font-medium text-slate-500">
                {progressLabel}
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
        </div>
      )}

      {err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800 text-sm">{err}</p>
      )}

      {job?.status === "failed" && (
        <div className="rounded-2xl bg-white/90 p-6 shadow-sm">
          <p className="font-medium text-rose-800">Erro ao processar</p>
          {job.error && (
            <p className="mt-2 text-sm text-rose-700">{job.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
