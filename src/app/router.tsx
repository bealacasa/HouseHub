import { createBrowserRouter } from "react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { HouseGate } from "@/features/house/HouseGate";
import { HomePage } from "@/pages/HomePage";
import { Layout } from "./Layout";

/*
 * Inicio va en el paquete inicial; el resto de pantallas se descarga al abrirlas
 * (code splitting por ruta). Con la app instalada, el service worker ya las tiene.
 */
export const router = createBrowserRouter([
  {
    path: "/acceso",
    lazy: async () => ({ Component: (await import("@/features/auth/LoginPage")).LoginPage }),
  },
  {
    path: "/acceso/confirmar",
    lazy: async () => ({
      Component: (await import("@/features/auth/ConfirmLinkPage")).ConfirmLinkPage,
    }),
  },
  {
    path: "/privacidad",
    lazy: async () => ({ Component: (await import("@/pages/PrivacyPage")).PrivacyPage }),
  },
  {
    // Enlace de invitación (WhatsApp): guarda el token y lleva a entrar.
    path: "/invitacion",
    lazy: async () => ({ Component: (await import("@/features/house/InvitePage")).InvitePage }),
  },
  {
    element: (
      <RequireAuth>
        <HouseGate>
          <Layout />
        </HouseGate>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "calendario",
        lazy: async () => {
          const { ComingSoonPage } = await import("@/pages/ComingSoonPage");
          return {
            Component: () => (
              <ComingSoonPage
                title="Calendario"
                text="Muy pronto verás aquí quién va a cada casa y cuándo."
              />
            ),
          };
        },
      },
      {
        path: "gastos",
        lazy: async () => {
          const { ComingSoonPage } = await import("@/pages/ComingSoonPage");
          return {
            Component: () => (
              <ComingSoonPage
                title="Gastos"
                text="Muy pronto podréis apuntar los gastos de la casa y ver quién debe a quién."
              />
            ),
          };
        },
      },
      {
        path: "mas",
        lazy: async () => ({ Component: (await import("@/pages/MorePage")).MorePage }),
      },
      {
        path: "casa",
        lazy: async () => ({
          Component: (await import("@/features/house/HouseSettingsPage")).HouseSettingsPage,
        }),
      },
      {
        path: "familia",
        lazy: async () => ({
          Component: (await import("@/features/house/FamilyPage")).FamilyPage,
        }),
      },
      {
        path: "ajustes",
        lazy: async () => ({
          Component: (await import("@/features/settings/SettingsPage")).SettingsPage,
        }),
      },
      {
        path: "*",
        lazy: async () => ({ Component: (await import("@/pages/NotFoundPage")).NotFoundPage }),
      },
    ],
  },
]);
