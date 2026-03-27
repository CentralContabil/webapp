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
      },
      colors: {
        mist: "#E8F4F8",
        lilac: "#F5F0FF",
        mint: "#D8F3E7",
        accent: "#7C9AE4",
        accent2: "#9B8FD9",
      },
    },
  },
  plugins: [],
};
