import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./app/router";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró #root");

const queryClient = new QueryClient({
  defaultOptions: {
    // Datos de la familia: no cambian cada segundo; se refrescan al volver a la app.
    queries: { staleTime: 60_000, retry: 2 },
  },
});

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
