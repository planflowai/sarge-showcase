import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        trading: {
          bull: "#22c55e",
          bear: "#ef4444",
          active: "#FF6700",
        },
      },
    },
  },
  plugins: [],
};

export default config;
