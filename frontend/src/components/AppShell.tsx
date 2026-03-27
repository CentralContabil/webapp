import { motion } from "framer-motion";
import { Link, Outlet } from "react-router-dom";
import { transitionSmooth } from "../motion-variants.js";

export default function AppShell() {
  return (
    <div className="min-h-screen">
      <motion.header
        className="sticky top-0 z-40 border-b border-white/40 bg-white/55 shadow-sm backdrop-blur-xl"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionSmooth}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-accent sm:text-xl"
          >
            Central de conversões
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link
              to="/"
              className="rounded-lg px-2 py-1 transition hover:bg-white/80 hover:text-accent"
            >
              Início
            </Link>
          </nav>
        </div>
      </motion.header>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
