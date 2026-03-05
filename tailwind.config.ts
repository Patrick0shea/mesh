import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mesh: {
          bg: "#0f1117",
          card: "#1a1d27",
          border: "#2a2d3a",
          accent: "#3b82f6",
          online: "#22c55e",
          warn: "#f59e0b",
          danger: "#ef4444",
          muted: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;
