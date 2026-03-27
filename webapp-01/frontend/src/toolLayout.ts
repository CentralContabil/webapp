/**
 * Layout compartilhado das páginas de ferramenta (upload + download).
 * Mantém largura, altura mínima e espaçamento iguais entre NFe e SPED.
 */
export const toolPageShellClass =
  "mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:py-12";

/** Área tracejada de upload (estados idle / drag). */
export function toolDropzoneClass(isDragActive: boolean): string {
  const base =
    "cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center shadow-card backdrop-blur-xl transition-colors";
  return isDragActive
    ? `${base} border-accent bg-white/50 shadow-card-hover ring-4 ring-accent/25`
    : `${base} border-indigo-300/70 bg-white/65 shadow-card hover:border-accent/80 hover:bg-white/80 hover:shadow-card-hover`;
}

/** Botão principal “Gerar planilha” — degradê índigo (alinhado ao hub). */
export const toolPrimaryButtonClass =
  "w-full shrink-0 rounded-full bg-gradient-to-r from-accent to-accentHi py-3.5 text-[15px] font-display font-bold uppercase tracking-wide text-white shadow-[0_6px_24px_-8px_rgb(79_70_229/0.55)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

/** Preenchimento da barra de progresso. */
export const toolProgressFillClass =
  "h-full rounded-full bg-gradient-to-r from-accent via-accentHi to-accent2 shadow-glow";
