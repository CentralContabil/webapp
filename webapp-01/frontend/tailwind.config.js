/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        loadingBar: {
          "0%": { left: "-38%" },
          "100%": { left: "100%" },
        },
      },
      animation: {
        loadingBar: "loadingBar 1.35s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["\"Plus Jakarta Sans\"", "system-ui", "sans-serif"],
        /** BabaPro-Bold.ttf em ../Font (peso 700) — títulos e CTAs */
        display: ["\"Baba Pro\"", "\"Plus Jakarta Sans\"", "system-ui", "sans-serif"],
      },
      colors: {
        lilac: "#c4b5fd",
        mist: "#7dd3fc",
        mint: "#34d399",
        accent: "#4f46e5",
        accent2: "#db2777",
        accentHi: "#818cf8",
      },
      boxShadow: {
        card: "0 12px 40px -12px rgb(79 70 229 / 0.18), 0 4px 16px -4px rgb(219 39 119 / 0.12)",
        "card-hover": "0 20px 50px -16px rgb(79 70 229 / 0.28), 0 8px 24px -8px rgb(219 39 119 / 0.15)",
        btn: "0 8px 28px -6px rgb(79 70 229 / 0.55), 0 4px 12px -4px rgb(219 39 119 / 0.35)",
        glow: "0 0 40px -8px rgb(129 140 248 / 0.65)",
      },
    },
  },
  plugins: [],
};
