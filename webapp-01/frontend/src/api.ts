const API_PREFIX = "/api/v1";

/**
 * Se `VITE_API_URL` estiver vazio, usa URL relativa (`/api/...`) para o proxy do Vite
 * encaminhar para a API (padrão: 127.0.0.1:8000). Caso contrário, chama a API direto.
 */
function baseUrl(): string {
  const b = import.meta.env.VITE_API_URL as string | undefined;
  return (b ?? "").replace(/\/$/, "");
}

export type JobStatus = "queued" | "running" | "done" | "failed" | "not_found";

export type JobResponse = {
  id: string;
  status: JobStatus;
  progress?: number;
  error?: string;
  downloadToken?: string;
  fileName?: string;
};

export type ToolManifestEntry = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  route: string;
  available: boolean;
};

function mergeToolsManifest(
  apiList: ToolManifestEntry[] | undefined,
  fallback: ToolManifestEntry[]
): ToolManifestEntry[] {
  const api = Array.isArray(apiList) ? apiList : [];
  const apiMap = new Map(api.map((t) => [t.id, t]));
  const merged: ToolManifestEntry[] = [];
  for (const t of fallback) {
    const o = apiMap.get(t.id);
    merged.push(o ? { ...t, ...o } : t);
  }
  const fallbackIds = new Set(fallback.map((t) => t.id));
  for (const t of api) {
    if (!fallbackIds.has(t.id)) merged.push(t);
  }
  return merged;
}

export async function fetchToolsManifest(): Promise<ToolManifestEntry[]> {
  const fallback = defaultToolsManifest();
  try {
    const res = await fetch(`${baseUrl()}${API_PREFIX}/tools`);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { tools?: ToolManifestEntry[] };
    return mergeToolsManifest(data.tools, fallback);
  } catch {
    return fallback;
  }
}

function defaultToolsManifest(): ToolManifestEntry[] {
  return [
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
        "Envie a exportação SCI (CSV ou Excel). Receba ProdutosSCI.xlsx com Produtos, Base e Consolidado (SCI).",
      route: "/tools/sci-consolidado",
      available: true,
    },
  ];
}

const UPLOAD_TIMEOUT_MS = 180_000;

function apiOfflineMessage(): string {
  return (
    "Não foi possível falar com a API em http://127.0.0.1:8000 (o Vite encaminha /api para lá). " +
    "Na pasta webapp-01: npm run redis:up (Docker) e npm run dev (API + workers + Vite), ou npm run dev:stack. " +
    "Inclui worker Consolidado SCI (Python). Só Vite: npm run dev:fe + npm run dev:backend noutro terminal. " +
    "Se a API já estiver no ar e forem muitos XMLs, o envio pode demorar — confira o terminal da API."
  );
}

function isFetchNetworkError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return false;
  if (e instanceof TypeError) return true;
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return (
      m === "failed to fetch" ||
      m.includes("networkerror") ||
      m.includes("load failed") ||
      m.includes("connection aborted") ||
      m.includes("network request failed")
    );
  }
  return false;
}

export async function createJob(files: File[]): Promise<{ id: string }> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/jobs`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new Error(
        `Envio excedeu ${Math.round(UPLOAD_TIMEOUT_MS / 60_000)} minutos (rede lenta ou API sem resposta). Verifique Redis, API em :8000 e tente de novo.`
      );
    }
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let msg = (err as { error?: string }).error ?? res.statusText;
    const relative = !baseUrl();
    if (
      relative &&
      (res.status === 500 || res.status === 502 || res.status === 503) &&
      (msg === "Internal Server Error" || msg.length < 3)
    ) {
      msg =
        "A API em http://127.0.0.1:8000 não está rodando (o Vite faz proxy para lá). " +
        "Na pasta webapp-01: Redis (npm run redis:up) e npm run dev — " +
        "ou npm run dev:backend num terminal e npm run dev:fe noutro.";
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ id: string }>;
}

export async function getJob(id: string): Promise<JobResponse> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/jobs/${id}`);
  } catch (e) {
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  }
  return res.json() as Promise<JobResponse>;
}

export async function createSpedJob(file: File): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/tools/sped/jobs`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new Error(
        `Envio excedeu ${Math.round(UPLOAD_TIMEOUT_MS / 60_000)} minutos (rede lenta ou API sem resposta). Verifique Redis, API em :8000 e worker SPED e tente de novo.`
      );
    }
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let msg = (err as { error?: string }).error ?? res.statusText;
    const relative = !baseUrl();
    if (
      relative &&
      (res.status === 500 || res.status === 502 || res.status === 503) &&
      (msg === "Internal Server Error" || msg.length < 3)
    ) {
      msg =
        "A API em http://127.0.0.1:8000 não está rodando ou o worker SPED não está ativo. Na pasta webapp-01: npm run redis:up e npm run dev (inclui worker-sped).";
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ id: string }>;
}

export async function getSpedJob(id: string): Promise<JobResponse> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/tools/sped/jobs/${id}`);
  } catch (e) {
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  }
  return res.json() as Promise<JobResponse>;
}

export async function createSpedMergeJob(spedTxt: File, xlsx: File): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("sped", spedTxt);
  fd.append("xlsx", xlsx);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/tools/sped-merge/jobs`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new Error(
        `Envio excedeu ${Math.round(UPLOAD_TIMEOUT_MS / 60_000)} minutos. Verifique Redis, API e worker SPED merge (webapp-03).`
      );
    }
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let msg = (err as { error?: string }).error ?? res.statusText;
    const relative = !baseUrl();
    if (
      relative &&
      (res.status === 500 || res.status === 502 || res.status === 503) &&
      (msg === "Internal Server Error" || msg.length < 3)
    ) {
      msg =
        "API ou worker SPED merge inativo. Na pasta webapp-01: npm run redis:up e npm run dev (inclui worker-sped-merge-bridge e Python webapp-03).";
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ id: string }>;
}

export async function getSpedMergeJob(id: string): Promise<JobResponse> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/tools/sped-merge/jobs/${id}`);
  } catch (e) {
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  }
  return res.json() as Promise<JobResponse>;
}

export async function createSciConsolidadoJob(
  file: File,
  sheet?: string
): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const q =
    sheet && sheet.trim().length > 0
      ? `?sheet=${encodeURIComponent(sheet.trim())}`
      : "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/tools/sci-consolidado/jobs${q}`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new Error(
        `Envio excedeu ${Math.round(UPLOAD_TIMEOUT_MS / 60_000)} minutos. Verifique Redis, API e worker Consolidado SCI.`
      );
    }
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let msg = (err as { error?: string }).error ?? res.statusText;
    const relative = !baseUrl();
    if (
      relative &&
      (res.status === 500 || res.status === 502 || res.status === 503) &&
      (msg === "Internal Server Error" || msg.length < 3)
    ) {
      msg =
        "API ou worker Consolidado SCI inativo. Na pasta webapp-01: npm run redis:up e npm run dev (inclui worker-sci-consolidado + Python).";
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ id: string }>;
}

export async function getSciConsolidadoJob(id: string): Promise<JobResponse> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${API_PREFIX}/tools/sci-consolidado/jobs/${id}`);
  } catch (e) {
    if (!baseUrl() && isFetchNetworkError(e)) {
      throw new Error(apiOfflineMessage());
    }
    throw e;
  }
  return res.json() as Promise<JobResponse>;
}

export function sciConsolidadoDownloadUrl(id: string, token: string): string {
  return `${baseUrl()}${API_PREFIX}/tools/sci-consolidado/jobs/${id}/download?token=${encodeURIComponent(token)}`;
}

export function downloadUrl(id: string, token: string): string {
  return `${baseUrl()}${API_PREFIX}/jobs/${id}/download?token=${encodeURIComponent(token)}`;
}

export function spedDownloadUrl(id: string, token: string): string {
  return `${baseUrl()}${API_PREFIX}/tools/sped/jobs/${id}/download?token=${encodeURIComponent(token)}`;
}

export function spedMergeDownloadUrl(id: string, token: string): string {
  return `${baseUrl()}${API_PREFIX}/tools/sped-merge/jobs/${id}/download?token=${encodeURIComponent(token)}`;
}
