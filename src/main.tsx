import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./app/router";
import { isSupabaseConfigured } from "./lib/supabase";
import "./index.css";
import { applySeason } from "./lib/season";

// Tema de temporada por fecha; se revisa al volver a la app (por si cambia el día).
applySeason();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") applySeason();
});

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
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ) : (
      // Despliegue sin VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY: aviso claro.
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 text-center">
        <h1 className="text-3xl font-extrabold">House Hub no está lista todavía</h1>
        <p className="mt-3 text-xl">
          Falta configurar la conexión. Si eres quien administra la app, revisa las variables de
          entorno.
        </p>
      </main>
    )}
  </StrictMode>,
);
