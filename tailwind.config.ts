import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        card: "var(--card)",
        text: "var(--text)",
        muted: "var(--muted)",
        primary: "var(--primary)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.4rem",
        "3xl": "1.9rem"
      },
      boxShadow: {
        glass: "0 10px 30px rgba(15, 23, 42, 0.15)",
        soft: "0 8px 20px rgba(15, 23, 42, 0.12)"
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      }
    }
  },
  plugins: []
};

export default config;
