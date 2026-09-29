import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./components/Toast";
import { AppRoutes } from "./app/routes";
import { useAuthStore } from "./stores/authStore";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 is handled by the axios interceptor (single refresh-and-retry);
      // retrying here on top of that would just multiply failed calls.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  // Session restoration runs once, before any protected route renders —
  // the guards hold on "bootstrapping" until it resolves, so the wrong
  // role's shell is never shown even for a frame.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
