import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { excursionInputSchema } from "./excursions";
import { toCleanGpx } from "./gpx";

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
  track: null,
  timeMinutes: null,
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

  it("se añade una y se ve su ficha (sin «cuándo hemos ido»)", async () => {
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
    // Sin GPX: la duración elegida al apuntarla.
    expect(screen.getByText("Día entero")).toBeTruthy();
    expect(screen.queryByText(/hemos ido/i)).toBeNull();
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

  it("se sube un GPX: se limpia, se ve la ruta con sus km y se guarda", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    const memory = renderAt("/excursiones/nueva");
    await user.type(await screen.findByLabelText("¿A dónde?"), "Cascada");
    const gpx = new File(
      [
        `<gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata><time>2026-10-01T08:00:00Z</time></metadata><trk><trkseg>
          <trkpt lat="41" lon="-2"><ele>1000</ele><time>2026-10-01T08:00:00Z</time></trkpt>
          <trkpt lat="41.009" lon="-2"><ele>1100</ele></trkpt></trkseg></trk></gpx>`,
      ],
      "ruta.gpx",
      { type: "application/gpx+xml" },
    );
    await user.upload(screen.getByLabelText(/Añadir archivo GPX/), gpx);
    expect(await screen.findByText("Distancia")).toBeTruthy();
    expect(screen.getByText("100 m")).toBeTruthy();
    // El GPX trae la hora de salida pero no la de llegada: no se sabe cuánto se tardó,
    // así que no se enseña ningún tiempo.
    expect(screen.queryByText("Se tardó")).toBeNull();
    expect(screen.queryByText(/aprox/i)).toBeNull();
    const stored = [...fake.files.entries()].find(([k]) => k.startsWith("excursion-tracks/"));
    expect(stored).toBeTruthy();
    expect(await stored![1].text()).not.toContain("<time>");

    await user.click(screen.getByRole("button", { name: "Añadir excursión" }));
    await vi.waitFor(() => expect(memory.state.location.pathname).toMatch(/^\/excursiones\/.+/));
    expect(fake.tables.excursions![0]!.track_path).toMatch(/\.gpx$/);
    expect(await screen.findByRole("heading", { name: "La ruta" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Descargar la ruta/ })).toBeTruthy();
  });

  it("un archivo que no es GPX se rechaza con un mensaje claro", async () => {
    installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup({ applyAccept: false });
    renderAt("/excursiones/nueva");
    const bad = new File(["hola"], "foto.gpx", { type: "application/gpx+xml" });
    await user.upload(await screen.findByLabelText(/Añadir archivo GPX/), bad);
    expect(await screen.findByText("Ese archivo no es una ruta GPX.")).toBeTruthy();
  });

  it("sin el SQL de rutas no aparece la sección GPX", async () => {
    installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingColumns: { excursions: ["track_path"] },
    });
    renderAt("/excursiones/nueva");
    expect(await screen.findByLabelText("¿A dónde?")).toBeTruthy();
    expect(screen.queryByText("Ruta (archivo GPX)")).toBeNull();
  });

  it("en la lista sale el tiempo exacto y los km si la ruta GPX trae horas", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const house = String(fake.tables.houses![0]!.id);
    const path = `${house}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.gpx`;
    const points = [
      { lat: 41, lon: -2, ele: 1000 },
      { lat: 41.009, lon: -2, ele: 1100 },
    ];
    fake.files.set(
      `excursion-tracks/${path}`,
      new Blob([toCleanGpx(points, "Mirador", { total: 3 * 3600 + 25 * 60, moving: 3 * 3600 })]),
    );
    const row = (n: number, title: string, track: string | null) => ({
      id: `cccccccc-cccc-4ccc-8ccc-00000000000${n}`,
      house_id: house,
      title,
      description: "",
      getting_there: "",
      duration: "rato",
      difficulty: "facil",
      map_url: null,
      photo_path: null,
      photos: [],
      track_path: track,
      created_by: null,
    });
    fake.tables.excursions!.push(row(1, "Mirador", path), row(2, "Ermita", null));
    renderAt("/excursiones");
    expect(await screen.findByText("3 h 25 min · 1 km · Fácil")).toBeTruthy();
    expect(screen.getByText("Un rato · Fácil")).toBeTruthy();
  });

  it("el tiempo exacto puesto a mano se guarda y sale en la lista por delante del GPX", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const house = String(fake.tables.houses![0]!.id);
    const path = `${house}/dddddddd-dddd-4ddd-8ddd-dddddddddddd.gpx`;
    fake.files.set(
      `excursion-tracks/${path}`,
      new Blob([
        toCleanGpx(
          [
            { lat: 41, lon: -2, ele: null },
            { lat: 41.009, lon: -2, ele: null },
          ],
          "Mirador",
          { total: 3 * 3600 + 25 * 60, moving: 3 * 3600 },
        ),
      ]),
    );
    const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    fake.tables.excursions!.push({
      id,
      house_id: house,
      title: "Mirador",
      description: "",
      getting_there: "",
      duration: "medio",
      difficulty: "facil",
      map_url: null,
      photo_path: null,
      photos: [],
      track_path: path,
      time_minutes: null,
      created_by: null,
    });
    const user = userEvent.setup();
    const memory = renderAt(`/excursiones/${id}/editar`);
    // Copiar el del GPX con un toque…
    await user.click(await screen.findByRole("button", { name: "Poner el del GPX (3 h 25 min)" }));
    expect((screen.getByLabelText("Horas") as HTMLSelectElement).value).toBe("3");
    // …o ponerlo a mano: 2 h 30 min.
    await user.selectOptions(screen.getByLabelText("Horas"), "2");
    await user.selectOptions(screen.getByLabelText("Minutos"), "30");
    expect(screen.getByText("Saldrá en la lista: 2 h 30 min.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await vi.waitFor(() => expect(fake.tables.excursions![0]!.time_minutes).toBe(150));
    await vi.waitFor(() => expect(memory.state.location.pathname).toBe(`/excursiones/${id}`));
    expect(await screen.findByText("Lo que se tarda")).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "← Excursiones" }));
    expect(await screen.findByText("2 h 30 min · 1 km · Fácil")).toBeTruthy();
  });

  it("sin el SQL del tiempo exacto no aparece el campo y se guarda igual", async () => {
    const fake = installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingColumns: { excursions: ["time_minutes"] },
    });
    const user = userEvent.setup();
    renderAt("/excursiones/nueva");
    await user.type(await screen.findByLabelText("¿A dónde?"), "Ermita");
    expect(screen.queryByLabelText("Horas")).toBeNull();
    // La ruta GPX sí está (su SQL es anterior).
    expect(screen.getByText("Ruta (archivo GPX)")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Añadir excursión" }));
    await vi.waitFor(() => expect(fake.tables.excursions).toHaveLength(1));
    expect(fake.tables.excursions![0]).not.toHaveProperty("time_minutes");
  });
});
