import { motion } from "framer-motion";

const easeSmooth = [0.16, 1, 0.3, 1] as const;

/** Mesmo degradê em todas as ferramentas (NFe, SPED, download). */
const gradientText =
  "bg-gradient-to-r from-accent via-accentHi to-accent2 bg-clip-text text-transparent";

const sizeClasses = {
  home: "text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl",
  download: "text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl",
} as const;

export type ToolPageTitleSize = keyof typeof sizeClasses;

type Props = {
  /** Texto antes da seta (ex.: "NFe XML", "SPED") */
  left: string;
  /** Texto depois da seta; padrão XLSX */
  right?: string;
  size?: ToolPageTitleSize;
};

/**
 * Título de ferramenta interna: “A → B” com degradê índigo e seta animada.
 */
export function ToolPageTitle({ left, right = "XLSX", size = "home" }: Props) {
  const sz = sizeClasses[size];

  return (
    <h1
      className={`font-display flex flex-wrap items-center justify-center gap-x-1.5 drop-shadow-sm ${sz}`}
    >
      <span className={gradientText}>{left}</span>
      <motion.span
        className="inline-block select-none text-accentHi"
        style={{ willChange: "transform" }}
        aria-hidden
        animate={{ x: [-6, 8, -6] }}
        transition={{
          duration: 2.6,
          repeat: Infinity,
          ease: easeSmooth,
          times: [0, 0.5, 1],
        }}
      >
        →
      </motion.span>
      <span className={gradientText}>{right}</span>
    </h1>
  );
}
