import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { toKey } from "@/features/calendar/stays";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { excursionInputSchema, lastVisitedLabel } from "./excursions";

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

const valid = {
  title: "Cascada del Molino",
  description: "",
  gettingThere: "",
  duration: "medio",
  difficulty: "facil",
  mapUrl: "",
  photo: null,
} as const;

describe("excursiones", () => {
  it("validan el nombre y que el enlace al mapa sea https", () => {
    expect(excursionInputSchema.safeParse(valid).success).toBe(true);
    expect(excursionInputSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
    expect(
      excursionInputSchema.safeParse({ ...valid, mapUrl: "https://maps.app.goo.gl/abc" }).success,
    ).toBe(true);
    expect(excursionInputSchema.safeParse({ ...valid, mapUrl: "http://x.com" }).success).toBe(
      false,
    );
    expect(
      excursionInputSchema.safeParse({ ...valid, mapUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(excursionInputSchema.safeParse({ ...valid, duration: "semana" }).success).toBe(false);
  });

  it("dicen con palabras cuándo fuimos por última vez", () => {
    const today = "2026-10-25";
    expect(lastVisitedLabel(null, today)).toBe("Aún no hemos ido");
    expect(lastVisitedLabel("2026-10-25", today)).toBe("Fuimos hoy");
    expect(lastVisitedLabel("2026-10-24", today)).toBe("Fuimos ayer");
    expect(lastVisitedLabel("2026-10-15", today)).toBe("Fuimos hace 10 días");
    expect(lastVisitedLabel("2026-07-25", today)).toBe("Fuimos hace 3 meses");
    expect(lastVisitedLabel("2024-10-25", today)).toBe("Fuimos hace 2 años");
  });

  it("se añade una, se ve su ficha y se apunta «Hoy hemos ido»", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    const memory = renderAt("/excursiones/nueva");
    await user.type(await screen.findByLabelText("¿A dónde?"), "Mirador de la Peña");
    await user.type(screen.getByLabelText(/¿Cómo se llega\?/), "15 minutos en coche");
    await user.click(screen.getByRole("radio", { name: /Día entero/ }));
    await user.click(screen.getByRole("radio", { name: /^Media(?! jornada)/ }));
    await user.type(screen.getByLabelText("Enlace al mapa"), "https://maps.app.goo.gl/abc");
    await user.click(screen.getByRole("button", { name: "Añadir excursión" }));

    await vi.waitFor(() => expect(fake.tables.excursions).toHaveLength(1));
    expect(fake.tables.excursions![0]).toMatchObject({
      title: "Mirador de la Peña",
      getting_there: "15 minutos en coche",
      duration: "dia",
      difficulty: "media",
      map_url: "https://maps.app.goo.gl/abc",
      photo_path: null,
    });
    await vi.waitFor(() => expect(memory.state.location.pathname).toMatch(/^\/excursiones\/.+/));
    expect(await screen.findByRole("heading", { name: "Mirador de la Peña" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver en el mapa/ }).getAttribute("href")).toBe(
      "https://maps.app.goo.gl/abc",
    );
    expect(screen.getByText("Aún no hemos ido")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Hoy hemos ido/ }));
    expect(await screen.findByText("Fuimos hoy")).toBeTruthy();
    expect(fake.tables.excursions![0]!.last_visited).toBe(toKey(new Date()));
  });

  it("sin nombre no se guarda y lo explica", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    renderAt("/excursiones/nueva");
    await user.click(await screen.findByRole("button", { name: "Añadir excursión" }));
    expect(await screen.findByText("Escribe a dónde es la excursión.")).toBeTruthy();
    expect(fake.tables.excursions).toHaveLength(0);
  });
});
