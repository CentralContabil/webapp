import { motion } from "framer-motion";

const easeSmooth = [0.16, 1, 0.3, 1] as const;

const gradientText =
  "bg-gradient-to-r from-accent via-accentHi to-accent2 bg-clip-text text-transparent";

type Props = {
  /** Tamanhos responsivos do título */
  size?: "home" | "download";
};

const sizeClasses = {
  home: "text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl",
  download: "text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl",
} as const;

/**
 * Título “NFe XML → XLSX” com seta em oscilação suave (trás / frente).
 */
export function TitleNfeXmlXlsx({ size = "home" }: Props) {
  const sz = sizeClasses[size];

  return (
    <h1
      className={`font-display flex flex-wrap items-center justify-center gap-x-1.5 drop-shadow-sm ${sz}`}
    >
      <span className={gradientText}>NFe XML</span>
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
      <span className={gradientText}>XLSX</span>
    </h1>
  );
}
