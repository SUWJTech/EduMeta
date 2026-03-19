import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "meta-primary": "#8b5cf6",
        "meta-secondary": "#06b6d4",
      },
    },
  },
  plugins: [],
};

export default config;
