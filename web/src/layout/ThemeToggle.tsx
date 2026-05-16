import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () =>
      (document.documentElement.dataset.theme as "light" | "dark") || "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      title={theme === "light" ? "Switch to dark" : "Switch to light"}
      style={{
        width: 34,
        height: 34,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
