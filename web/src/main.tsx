import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ToastProvider } from "./ui/Toast";
import "./theme.css";

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 25_000, refetchInterval: 30_000, retry: 1 },
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
