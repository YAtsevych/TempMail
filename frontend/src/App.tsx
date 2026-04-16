import "./App.css";
import Header from "../src/elements/header";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);
  return (
    <>
      <div
        className={`${theme === "dark" ? "bg-[lab(1.5459_-0.0968501_-1.40916)]" : "bg-[lab(98.26%_-.25633_-.7025)]"} w-screen h-screen bg-[lab(1.5459_-0.0968501_-1.40916)]`}
      >
        <Header theme={theme} setTheme={setTheme} />
      </div>
    </>
  );
}

export default App;
