import { ArrowRight, Combine, FileSpreadsheet, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchToolsManifest, type ToolManifestEntry } from "../api.js";

const TOOL_ICONS: Record<string, typeof FileSpreadsheet> = {
  nfe: FileSpreadsheet,
  sped: ScrollText,
  "webapp-03": Combine,
};

const TOOL_ACCENT: Record<string, string> = {
  nfe: "from-[#447f98] via-[#4f8aa3] to-[#629bb5]",
  sped: "from-[#629bb5] via-[#5599b0] to-[#447f98]",
  "webapp-03": "from-[#3d7390] to-[#629bb5]",
};

export default function ToolsHubPage() {
  const [tools, setTools] = useState<ToolManifestEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchToolsManifest().then((t) => {
      if (!cancelled) setTools(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = tools ?? [];

  return (
    <div className="space-y-10 sm:space-y-12">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#183844] sm:text-3xl md:text-4xl">
          Ferramentas <span className="text-[#347891]">fiscais</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-sans text-sm leading-relaxed text-[#1e3d4d] sm:text-[15px]">
          Três conversões em um só lugar: envie os arquivos, acompanhe na tela e baixe o resultado quando estiver
          pronto.
        </p>
      </div>

      <ul className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-5 sm:grid-cols-2 md:max-w-6xl md:grid-cols-3 md:gap-6">
        {list.map((tool) => (
          <li key={tool.id} className="flex min-h-0">
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolManifestEntry }) {
  const Icon = TOOL_ICONS[tool.id] ?? FileSpreadsheet;
  const accent = TOOL_ACCENT[tool.id] ?? TOOL_ACCENT.nfe;

  const inner = (
    <>
      <div className="relative flex flex-1 flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-md ring-2 ring-white/60 transition-transform duration-200 group-hover:scale-[1.03] sm:h-14 sm:w-14`}
            aria-hidden
          >
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-lg font-bold leading-tight tracking-tight text-brand-inkStrong sm:text-xl">
                {tool.title}
              </h2>
              {!tool.available && (
                <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                  Breve
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#347891]">{tool.subtitle}</p>
          </div>
        </div>
        <p className="relative font-sans text-sm leading-relaxed text-[#2a4f60] selection:bg-[#cfe8f4]">
          {tool.description}
        </p>
        {tool.available && (
          <span className="relative mt-auto flex items-center gap-1.5 text-sm font-semibold text-[#2d6a82] transition-all duration-200 group-hover:gap-2.5 group-hover:text-[#447f98]">
            Abrir ferramenta
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
    </>
  );

  const cardBase =
    "group relative flex h-full min-h-[220px] w-full flex-col overflow-hidden rounded-2xl p-5 outline-none sm:min-h-[240px] sm:p-6";

  const cardAvailable = `${cardBase} border border-[#dadee1]/90 bg-white shadow-[0_2px_12px_-2px_rgb(68_127_152/0.14)] transition-[transform,box-shadow,border-color] duration-200 [-webkit-tap-highlight-color:transparent] hover:-translate-y-0.5 hover:border-[#b9d8e1] hover:shadow-[0_10px_28px_-6px_rgb(68_127_152/0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#447f98]/55`;

  const cardDisabled = `${cardBase} cursor-not-allowed border border-brand-line/60 bg-gradient-to-b from-brand-bg/50 to-brand-bg/25 opacity-85 shadow-[0_2px_12px_-4px_rgb(68_127_152/0.08)]`;

  if (tool.available) {
    return (
      <Link to={tool.route} aria-label={`Abrir ${tool.title}`} className={`${cardAvailable} block h-full w-full`}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={cardDisabled} aria-label={`${tool.title} — indisponível`}>
      {inner}
    </div>
  );
}
