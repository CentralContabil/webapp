import { ArrowRight, Combine, FileSpreadsheet, ScrollText, Table2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchToolsManifest, type ToolManifestEntry } from "../api.js";

const TOOL_ICONS: Record<string, typeof FileSpreadsheet> = {
  nfe: FileSpreadsheet,
  sped: ScrollText,
  "webapp-03": Combine,
  "sci-consolidado": Table2,
};

const TOOL_ACCENT: Record<string, string> = {
  nfe: "from-[#447f98] via-[#4f8aa3] to-[#629bb5]",
  sped: "from-[#629bb5] via-[#5599b0] to-[#447f98]",
  "webapp-03": "from-[#3d7390] to-[#629bb5]",
  "sci-consolidado": "from-[#4a7f95] via-[#5a8fab] to-[#447f98]",
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
  /** Quatro ferramentas: 3 na primeira linha + 1 centralizada abaixo (grid 6 colunas). Com mais itens, fluxo em 3 colunas no md+. */
  const hubThreePlusOne = list.length === 4;

  const hubGridClass = [
    "mx-auto grid w-full items-stretch gap-3 px-0.5 max-[480px]:grid-cols-1 sm:grid-cols-2 sm:gap-4",
    hubThreePlusOne
      ? "max-w-3xl md:max-w-5xl md:grid-cols-6 md:gap-4 lg:max-w-6xl lg:gap-5"
      : "max-w-3xl md:max-w-4xl md:grid-cols-3 md:gap-5",
  ].join(" ");

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#183844] sm:text-3xl md:text-4xl">
          Ferramentas <span className="text-[#347891]">fiscais</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-sans text-sm leading-relaxed text-[#1e3d4d] sm:mt-3.5 sm:max-w-xl sm:text-[15px]">
          Conversões fiscais em um só lugar: envie os arquivos, acompanhe na tela e baixe o resultado quando estiver
          pronto.
        </p>
      </div>

      <ul className={hubGridClass}>
        {list.map((tool, index) => (
          <li
            key={tool.id}
            className={
              hubThreePlusOne
                ? index === 3
                  ? "flex h-full min-h-0 md:col-span-2 md:col-start-3"
                  : "flex h-full min-h-0 md:col-span-2"
                : "flex h-full min-h-0"
            }
          >
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
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-start gap-2">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-md ring-1 ring-white/55 transition-transform duration-200 group-hover:scale-[1.02] sm:h-10 sm:w-10 sm:rounded-xl sm:ring-2`}
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 pt-px">
          <div className="flex items-start justify-between gap-1.5">
            <h2 className="font-display text-[15px] font-bold leading-tight tracking-tight text-brand-inkStrong sm:text-base">
              {tool.title}
            </h2>
            {!tool.available && (
              <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                Breve
              </span>
            )}
          </div>
          <p className="mt-px text-[9px] font-bold uppercase tracking-[0.12em] text-[#347891] sm:mt-0.5 sm:text-[10px] sm:tracking-[0.14em]">
            {tool.subtitle}
          </p>
        </div>
      </div>
      <p className="relative min-h-0 flex-1 font-sans text-[12px] leading-[1.35] text-[#2a4f60] selection:bg-[#cfe8f4] sm:text-[13px] sm:leading-snug">
        {tool.description}
      </p>
      {tool.available && (
        <span className="relative mt-auto flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#2d6a82] transition-all duration-200 group-hover:gap-1.5 group-hover:text-[#447f98] sm:text-[13px]">
          Abrir ferramenta
          <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5 sm:h-3.5 sm:w-3.5" />
        </span>
      )}
    </div>
  );

  const cardBase =
    "group relative flex h-full min-h-[168px] w-full min-w-0 flex-col overflow-hidden rounded-xl p-3 outline-none sm:min-h-[178px] sm:rounded-2xl sm:p-3.5";

  const cardAvailable = `${cardBase} border border-[#dadee1]/90 bg-white shadow-[0_2px_10px_-2px_rgb(68_127_152/0.12)] transition-[transform,box-shadow,border-color] duration-200 [-webkit-tap-highlight-color:transparent] hover:-translate-y-px hover:border-[#b9d8e1] hover:shadow-[0_8px_22px_-6px_rgb(68_127_152/0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#447f98]/55`;

  const cardDisabled = `${cardBase} cursor-not-allowed border border-brand-line/60 bg-gradient-to-b from-brand-bg/50 to-brand-bg/25 opacity-85 shadow-[0_2px_12px_-4px_rgb(68_127_152/0.08)]`;

  if (tool.available) {
    return (
      <Link
        to={tool.route}
        aria-label={`Abrir ${tool.title}`}
        className={`${cardAvailable} flex h-full w-full min-w-0 flex-col`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={`${cardDisabled} flex h-full w-full min-w-0 flex-col`} aria-label={`${tool.title} indisponivel`}>
      {inner}
    </div>
  );
}
