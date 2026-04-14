/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1a1a2e",
        "sage-green": "#4ade80",
        "sage-green-dark": "#166534",
        "warm-yellow": "#fef3c7",
        "target-bg": "#fffbeb",
        "target-border": "#fde68a",
        "script-header": "#f0fdf4",
        slate: { secondary: "#64748b", muted: "#94a3b8" },
        "cool-gray": "#f8fafc",
      },
      fontSize: {
        "walk-away": [
          "38px",
          { lineHeight: "1.1", letterSpacing: "-2px", fontWeight: "800" },
        ],
      },
    },
  },
  plugins: [],
};
