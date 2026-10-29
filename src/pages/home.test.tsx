import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { addDays } from "date-fns";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
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

const day = (n: number) => toKey(addDays(new Date(), n));

describe("inicio", () => {
  it("«Hoy» junta la lista para irse, tus recordatorios y las notas pendientes", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const house = fake.tables.houses![0]!.id;
    const me = String(fake.tables.house_members![0]!.id);
    fake.tables.stays!.push({
      id: "55555555-5555-4555-8555-555555555551",
      member_id: me,
      start_date: day(-3),
      end_date: day(0),
      people: 2,
      note: "",
      created_by: null,
    });
    fake.tables.personal_reminders!.push(
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        house_id: house,
        user_id: fake.user.id,
        text: "Pagar el gimnasio",
        due_date: day(-1),
        done_at: null,
        created_at: "2026-10-29T10:00:00Z",
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
        house_id: house,
        user_id: fake.user.id,
        text: "Para la semana que viene",
        due_date: day(7),
        done_at: null,
        created_at: "2026-10-29T10:00:00Z",
      },
    );
    fake.tables.house_notes!.push({
      id: "77777777-7777-4777-8777-777777777771",
      house_id: house,
      text: "Falta aceite",
      done_at: null,
      created_by: null,
      created_at: "2026-10-28T10:00:00Z",
    });
    renderAt("/");
    const hoy = (await screen.findByRole("heading", { name: "Hoy" })).closest("section")!;
    expect(
      await within(hoy).findByRole("link", { name: /Lista para cerrar la casa/ }),
    ).toBeTruthy();
    expect(await within(hoy).findByText("Pagar el gimnasio")).toBeTruthy();
    expect(within(hoy).getByText("Era para ayer")).toBeTruthy();
    expect(within(hoy).queryByText("Para la semana que viene")).toBeNull();
    expect(within(hoy).getByText("1 nota pendiente")).toBeTruthy();
    expect(screen.getByText(/En la casa: Ana \(se va hoy\)/)).toBeTruthy();
    expect(screen.queryByText(/Lista para abrir la casa/)).toBeNull();
  });

  it("sin nada para hoy lo dice, y no enseña excursiones ni eventos del pueblo", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    fake.tables.excursions!.push({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000009",
      house_id: fake.tables.houses![0]!.id,
      title: "Cascada del Molino",
      description: "",
      getting_there: "",
      duration: "medio",
      difficulty: "facil",
      map_url: null,
      photo_path: null,
      photos: [],
      last_visited: null,
      created_by: null,
    });
    renderAt("/");
    expect(await screen.findByText(/Nada pendiente para hoy/)).toBeTruthy();
    expect(screen.getByText(/Ahora no hay nadie en la casa/)).toBeTruthy();
    expect(screen.queryByText("Cascada del Molino")).toBeNull();
    expect(screen.queryByText(/De excursión/)).toBeNull();
    const quick = screen.getByRole("navigation", { name: "Accesos rápidos" });
    expect(
      within(quick)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Reservar días", "Apuntar gasto", "Añadir nota"]);
  });

  it("si los recordatorios no están activados, el inicio sigue funcionando", async () => {
    installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingTables: ["personal_reminders"],
    });
    renderAt("/");
    expect(await screen.findByText(/Nada pendiente para hoy/)).toBeTruthy();
  });

  it("sin foto de la casa, invita a ponerla (en el inicio y en Casa)", async () => {
    installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    renderAt("/");
    expect(
      (await screen.findByRole("link", { name: /Poner una foto de la casa/ })).getAttribute("href"),
    ).toBe("/casa/datos");
  });

  it("la pestaña Casa invita a poner la foto si no hay", async () => {
    installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    renderAt("/casa");
    expect(await screen.findByRole("link", { name: /Pon una foto de la casa/ })).toBeTruthy();
  });
});
