import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { toKey } from "@/features/calendar/stays";
import { installFakeSupabase } from "@/test/fakeSupabase";

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

const OTHER_USER = "99999999-9999-4999-8999-999999999999";
const EVENT_ID = "abababab-abab-4bab-8bab-abababababab";

function seedEvent(fake: ReturnType<typeof installFakeSupabase>) {
  const day = toKey(new Date());
  fake.tables.village_events!.push({
    id: EVENT_ID,
    house_id: fake.tables.houses![0]!.id,
    title: "Fiestas",
    start_date: day,
    end_date: day,
    place: "",
    note: "",
    created_by: OTHER_USER,
  });
}

describe("toda la familia puede hacer de todo", () => {
  it("alguien que no administra cambia y borra un evento que añadió otra persona", async () => {
    const fake = installFakeSupabase({
      signedIn: true,
      name: "Marta",
      house: "Casa",
      role: "member",
    });
    seedEvent(fake);
    const user = userEvent.setup();
    const memory = renderAt(`/eventos/${EVENT_ID}`);
    const title = await screen.findByLabelText("¿Qué es?");
    expect(screen.queryByText(/Solo quien/)).toBeNull();
    await user.clear(title);
    await user.type(title, "Fiestas de San Roque");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await vi.waitFor(() => expect(memory.state.location.pathname).toBe("/eventos"));
    expect(fake.tables.village_events![0]).toMatchObject({ title: "Fiestas de San Roque" });

    renderAt(`/eventos/${EVENT_ID}`);
    await user.click(await screen.findByRole("button", { name: "Borrar el evento" }));
    await user.click(await screen.findByRole("button", { name: "Sí, borrar" }));
    await vi.waitFor(() => expect(fake.tables.village_events).toHaveLength(0));
  });

  it("si la base de datos no deja cambiarlo, lo dice en vez de fingir que se guardó", async () => {
    const fake = installFakeSupabase({
      signedIn: true,
      name: "Marta",
      house: "Casa",
      role: "member",
      lockedTables: ["village_events"],
    });
    seedEvent(fake);
    const user = userEvent.setup();
    const memory = renderAt(`/eventos/${EVENT_ID}`);
    await user.type(await screen.findByLabelText("¿Qué es?"), " 2026");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/No se ha podido guardar el cambio/)).toBeTruthy();
    expect(memory.state.location.pathname).toBe(`/eventos/${EVENT_ID}`);
    expect(fake.tables.village_events![0]).toMatchObject({ title: "Fiestas" });
  });

  it("los datos de la casa los puede cambiar cualquiera de la familia", async () => {
    const fake = installFakeSupabase({
      signedIn: true,
      name: "Marta",
      house: "Casa",
      role: "member",
    });
    const user = userEvent.setup();
    renderAt("/casa/datos");
    const name = await screen.findByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Casa del pueblo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Guardado.")).toBeTruthy();
    expect(fake.tables.houses![0]).toMatchObject({ name: "Casa del pueblo" });
  });
});
