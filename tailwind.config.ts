import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          primary: "rgb(var(--color-primary) / <alpha-value>)",
          onPrimary: "rgb(var(--color-on-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-secondary) / <alpha-value>)",
          accent: "rgb(var(--color-accent) / <alpha-value>)",
          accent2: "rgb(var(--color-accent-2) / <alpha-value>)",
          background: "rgb(var(--color-background) / <alpha-value>)",
          foreground: "rgb(var(--color-foreground) / <alpha-value>)",
          muted: "rgb(var(--color-muted) / <alpha-value>)",
          border: "rgb(var(--color-border) / <alpha-value>)",
          destructive: "rgb(var(--color-destructive) / <alpha-value>)",
          ring: "rgb(var(--color-ring) / <alpha-value>)",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
