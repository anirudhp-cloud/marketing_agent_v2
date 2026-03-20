/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
        },
        coral: {
          DEFAULT: "rgb(var(--coral) / <alpha-value>)",
          2: "rgb(var(--coral-2) / <alpha-value>)",
        },
        amber: "rgb(var(--amber) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        sky: "rgb(var(--sky) / <alpha-value>)",
        lilac: "rgb(var(--lilac) / <alpha-value>)",
        fg: {
          DEFAULT: "rgb(var(--fg) / <alpha-value>)",
          2: "rgb(var(--fg-2) / <alpha-value>)",
          3: "rgb(var(--fg-3) / <alpha-value>)",
        },
        rim: {
          DEFAULT: "var(--rim)",
          2: "var(--rim-2)",
        },
        glass: {
          DEFAULT: "var(--glass)",
          2: "var(--glass-2)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      borderRadius: {
        r: "14px",
        r2: "10px",
      },
      animation: {
        pulse_glow: "pulse_glow 1.5s ease-in-out infinite",
        "slide-up": "slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        pulse_glow: {
          "0%, 100%": { boxShadow: "0 0 30px var(--pulse-sm)" },
          "50%": { boxShadow: "0 0 60px var(--pulse-lg)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
