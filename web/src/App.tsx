import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    const t = localStorage.getItem("theme");
    if (t) document.documentElement.dataset.theme = t;
    else if (matchMedia("(prefers-color-scheme: dark)").matches)
      document.documentElement.dataset.theme = "dark";
  }, []);
  return <div style={{ padding: 20 }}>Dashboard scaffold up.</div>;
}
