import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { ToastProvider } from "./ui/Toast";
import "./theme.css";

// No-op in dev: the service worker is only built for production.
if (import.meta.env.PROD) registerSW({ immediate: true });

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
