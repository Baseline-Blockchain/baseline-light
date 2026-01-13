/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: {
                    DEFAULT: "#11131a",
                    soft: "#0c0e14",
                },
                panel: {
                    DEFAULT: "#1b1f2d",
                    strong: "#131722",
                },
                border: "rgba(255, 255, 255, 0.08)",
                text: {
                    DEFAULT: "#f8fbff",
                    muted: "#8892b0",
                },
                accent: {
                    DEFAULT: "#47c2ff",
                    strong: "#63d6ff",
                    fade: "rgba(71, 194, 255, 0.16)",
                },
                danger: "#ff6b6b",
                warning: "#f6b05e",
            },
            fontFamily: {
                sans: ['"Segoe UI"', "system-ui", "-apple-system", "sans-serif"],
            },
            borderRadius: {
                sm: "8px",
                DEFAULT: "12px",
                lg: "16px",
            },
            boxShadow: {
                DEFAULT: "0 14px 45px rgba(0, 0, 0, 0.35)",
            },
        },
    },
    plugins: [],
}
