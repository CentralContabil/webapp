import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchToolsManifest, type ToolManifestEntry } from "../api.js";
import { listParent, listItem, transitionSmooth } from "../motion-variants.js";

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
    <div className="space-y-10">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitionSmooth, delay: 0.04 }}
      >
        <h1 className="font-display text-3xl font-bold text-slate-800 sm:text-4xl">
          Ferramentas fiscais
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600">
          Escolha uma conversão. Cada ferramenta roda de forma independente — novas opções entram aqui
          conforme forem disponibilizadas.
        </p>
      </motion.div>

      <motion.ul
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        variants={listParent}
        initial="hidden"
        animate="show"
      >
        {list.map((tool) => (
          <motion.li key={tool.id} variants={listItem}>
            <ToolCard tool={tool} />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V7H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ToolCard({ tool }: { tool: ToolManifestEntry }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-800">{tool.title}</h2>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
            {tool.subtitle}
          </p>
        </div>
        {!tool.available && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
            Em breve
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{tool.description}</p>
      <div className="mt-4 flex justify-end">
        {tool.available ? (
          <span className="pointer-events-none inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-accentHi px-3.5 py-1.5 text-[11px] font-display font-bold uppercase tracking-wide text-white shadow-[0_4px_16px_-6px_rgb(79_70_229/0.65)] transition duration-200 ease-out group-hover:shadow-[0_6px_22px_-6px_rgb(79_70_229/0.5)] group-hover:brightness-[1.06]">
            Abrir
            <IconArrowRight className="h-3 w-3 shrink-0 opacity-90 transition duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </span>
        ) : (
          <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-slate-200/90 px-3 py-1.5 text-[11px] font-bold text-slate-500">
            <IconLock className="h-3 w-3 shrink-0 text-slate-400" />
            Indisponível
          </span>
        )}
      </div>
    </>
  );

  return (
    <Link
      to={tool.route}
      aria-label={tool.available ? `Abrir ${tool.title}` : `${tool.title} — indisponível`}
      className={`group block rounded-2xl border p-6 shadow-card backdrop-blur-xl outline-none transition duration-200 ${
        tool.available
          ? "border-white/60 bg-white/75 hover:border-accent/35 hover:shadow-card-hover"
          : "border-slate-200/80 bg-white/55 opacity-95 hover:border-amber-200/80 hover:bg-white/70"
      } focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50`}
    >
      {inner}
    </Link>
  );
}
