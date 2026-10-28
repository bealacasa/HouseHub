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
  cover: null,
  photos: [],
};

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
      photos: [],
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

  it("si falta el SQL en Supabase, avisa con calma y no deja añadir", async () => {
    installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingTables: ["excursions"],
    });
    renderAt("/excursiones");
    expect(await screen.findByText(/aún no están activadas/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Añadir una excursión/ })).toBeNull();
    expect(screen.queryByText("No se han podido cargar las excursiones.")).toBeNull();
  });

  it("si falta el SQL, el formulario tampoco se abre", async () => {
    installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingTables: ["excursions"],
    });
    renderAt("/excursiones/nueva");
    expect(await screen.findByText(/aún no están activadas/)).toBeTruthy();
    expect(screen.queryByLabelText("¿A dónde?")).toBeNull();
  });

  it("admiten varias fotos con su frase, como mucho 12", () => {
    const photo = (n: number) => ({ path: `h/${n}.webp`, caption: "" });
    const twelve = Array.from({ length: 12 }, (_, i) => photo(i));
    expect(excursionInputSchema.safeParse({ ...valid, photos: twelve }).success).toBe(true);
    expect(
      excursionInputSchema.safeParse({ ...valid, photos: [...twelve, photo(12)] }).success,
    ).toBe(false);
    expect(
      excursionInputSchema.safeParse({
        ...valid,
        photos: [{ path: "h/1.webp", caption: "x".repeat(201) }],
      }).success,
    ).toBe(false);
  });

  it("la portada va aparte y los pasos se numeran desde el 1", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const houseId = String(fake.tables.houses![0]!.id);
    const id = "77777777-7777-4777-8777-777777777777";
    const cover = `${houseId}/cover.webp`;
    const a = `${houseId}/a.webp`;
    const b = `${houseId}/b.webp`;
    fake.tables.excursions!.push({
      id,
      house_id: houseId,
      title: "Cascada",
      description: "",
      getting_there: "",
      duration: "medio",
      difficulty: "facil",
      map_url: null,
      photo_path: cover,
      photos: [
        { path: a, caption: "Aparcar junto a la ermita" },
        { path: b, caption: "En la fuente, a la izquierda" },
      ],
      last_visited: null,
      created_by: fake.user.id,
    });
    const user = userEvent.setup();
    renderAt(`/excursiones/${id}`);
    expect(await screen.findByRole("heading", { name: "Cómo encontrar el sitio" })).toBeTruthy();
    expect(screen.getByText("Paso 1 de 2")).toBeTruthy();
    expect(screen.getByText("Paso 2 de 2")).toBeTruthy();
    expect(screen.queryByText("Paso 3 de 3")).toBeNull();

    await user.click(screen.getByRole("link", { name: "Cambiar esta excursión" }));
    expect(await screen.findByRole("heading", { name: "Foto de portada" })).toBeTruthy();
    // Reordenar: el paso 2 sube y su frase va con él.
    await user.click(screen.getByRole("button", { name: "Subir el paso 2" }));
    expect((screen.getByLabelText("Paso 1") as HTMLInputElement).value).toBe(
      "En la fuente, a la izquierda",
    );
    // El paso 2 (aparcar) pasa a ser la portada; la portada antigua, el paso 1.
    await user.click(screen.getByRole("button", { name: "Poner la foto del paso 2 de portada" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await vi.waitFor(() =>
      expect(fake.tables.excursions![0]).toMatchObject({
        photo_path: a,
        photos: [
          { path: cover, caption: "" },
          { path: b, caption: "En la fuente, a la izquierda" },
        ],
      }),
    );
  });

  it("si la portada también está entre las fotos (versión anterior), no se repite", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const houseId = String(fake.tables.houses![0]!.id);
    const id = "99999999-9999-4999-8999-999999999999";
    fake.tables.excursions!.push({
      id,
      house_id: houseId,
      title: "Ermita",
      description: "",
      getting_there: "",
      duration: "rato",
      difficulty: "facil",
      map_url: null,
      photo_path: `${houseId}/cover.webp`,
      photos: [
        { path: `${houseId}/cover.webp`, caption: "" },
        { path: `${houseId}/a.webp`, caption: "El camino" },
      ],
      last_visited: null,
      created_by: fake.user.id,
    });
    renderAt(`/excursiones/${id}`);
    expect(await screen.findByText("Paso 1 de 1")).toBeTruthy();
    expect(screen.getByText("El camino")).toBeTruthy();
  });

  it("sin el SQL de varias fotos sigue funcionando con la portada", async () => {
    const fake = installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingColumns: { excursions: ["photos"] },
    });
    const houseId = String(fake.tables.houses![0]!.id);
    const id = "88888888-8888-4888-8888-888888888888";
    fake.tables.excursions!.push({
      id,
      house_id: houseId,
      title: "Mirador",
      description: "",
      getting_there: "",
      duration: "rato",
      difficulty: "facil",
      map_url: null,
      photo_path: `${houseId}/a.webp`,
      last_visited: null,
      created_by: fake.user.id,
    });
    const user = userEvent.setup();
    renderAt(`/excursiones/${id}/editar`);
    expect(await screen.findByText(/falta un paso en Supabase/)).toBeTruthy();
    expect(screen.getByText(/Cambiar la portada/)).toBeTruthy();
    expect(screen.queryByText(/Añadir fotos/)).toBeNull();
    await user.clear(screen.getByLabelText("¿A dónde?"));
    await user.type(screen.getByLabelText("¿A dónde?"), "Mirador nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await vi.waitFor(() =>
      expect(fake.tables.excursions![0]).toMatchObject({
        title: "Mirador nuevo",
        photo_path: `${houseId}/a.webp`,
      }),
    );
    expect(fake.tables.excursions![0]).not.toHaveProperty("photos");
  });
});
