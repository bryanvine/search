import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          50: "#fafaf7",
          100: "#f4f3ee",
          200: "#e9e7dd",
          300: "#d6d3c5",
          400: "#a8a48f",
          500: "#7b7868",
          600: "#54524a",
          700: "#3a3830",
          800: "#26241f",
          900: "#1a1915",
        },
        accent: {
          DEFAULT: "var(--accent, #c2410c)",
          dark: "var(--accent-dark, #9a3412)",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
