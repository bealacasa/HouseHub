import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { guideInputSchema, moveStep } from "./guides";

function renderAt(path: string) {
  localStorage.setItem("househub:passkey-asked", "1");
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={memory} />
    </QueryClientProvider>,
  );
  return memory;
}

describe("instrucciones", () => {
  it("validan título y pasos (al menos uno, con texto)", () => {
    const ok = { title: "Caldera", intro: "", steps: [{ text: "Abre el gas", photo: null }] };
    expect(guideInputSchema.safeParse(ok).success).toBe(true);
    expect(guideInputSchema.safeParse({ ...ok, steps: [] }).success).toBe(false);
    expect(guideInputSchema.safeParse({ ...ok, steps: [{ text: " ", photo: null }] }).success).toBe(
      false,
    );
    expect(guideInputSchema.safeParse({ ...ok, title: "" }).success).toBe(false);
  });

  it("los pasos se reordenan sin salirse de la lista", () => {
    expect(moveStep(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveStep(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("se escriben con varios pasos, en orden, y se ven numerados", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    const memory = renderAt("/instrucciones/nueva");
    await user.type(await screen.findByLabelText("¿De qué son?"), "Cómo encender la caldera");
    await user.type(screen.getByLabelText("Paso 1"), "Encender la caldera");
    await user.click(screen.getByRole("button", { name: "+ Añadir otro paso" }));
    await user.type(screen.getByLabelText("Paso 2"), "Abrir el gas");
    // El gas va primero: subir el paso 2.
    await user.click(screen.getByRole("button", { name: "Subir el paso 2" }));
    await user.click(screen.getByRole("button", { name: "Guardar instrucciones" }));

    await vi.waitFor(() => expect(fake.tables.guides).toHaveLength(1));
    expect(fake.tables.guides![0]).toMatchObject({
      title: "Cómo encender la caldera",
      steps: [
        { text: "Abrir el gas", photo: null },
        { text: "Encender la caldera", photo: null },
      ],
    });
    await vi.waitFor(() => expect(memory.state.location.pathname).toMatch(/^\/instrucciones\//));
    expect(await screen.findByText("Paso 1 de 2")).toBeTruthy();
  });
});

describe("pestañas Casa y Pueblo, y Familia y ajustes", () => {
  it("cada sección está en su sitio y la pestaña se marca también dentro", async () => {
    installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    const memory = renderAt("/casa");
    for (const name of ["Instrucciones", "Notas", "Datos de la casa"]) {
      expect(await screen.findByRole("link", { name: new RegExp(name) })).toBeTruthy();
    }
    await user.click(screen.getByRole("link", { name: /Instrucciones/ }));
    await vi.waitFor(() => expect(memory.state.location.pathname).toBe("/instrucciones"));
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Casa");

    await user.click(within(nav).getByRole("link", { name: "Pueblo" }));
    for (const name of ["Eventos del pueblo", "Excursiones"]) {
      expect(await screen.findByRole("link", { name: new RegExp(name) })).toBeTruthy();
    }

    await user.click(screen.getByRole("link", { name: /Ajustes/ }));
    for (const name of ["La familia", "Mi cuenta", "Privacidad"]) {
      expect(await screen.findByRole("link", { name: new RegExp(name) })).toBeTruthy();
    }
  });

  it("la antigua «Más» lleva al inicio", async () => {
    installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const memory = renderAt("/mas");
    await vi.waitFor(() => expect(memory.state.location.pathname).toBe("/"));
  });
});
