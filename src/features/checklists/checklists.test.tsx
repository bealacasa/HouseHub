import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { CHECKLISTS } from "./checklists";

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

describe("lista para irse", () => {
  it("vacía, se empieza con las típicas, se tacha y al terminar se apunta", async () => {
    localStorage.removeItem("househub:checklist:leave");
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    renderAt("/irse");
    await user.click(await screen.findByRole("button", { name: "Poner las típicas" }));
    const total = CHECKLISTS.leave.defaults.length;
    await vi.waitFor(() => expect(fake.tables.checklist_items).toHaveLength(total));
    expect(fake.tables.checklist_items![0]).toMatchObject({
      kind: "leave",
      text: "Cerrar la llave del gas",
    });

    await user.click(await screen.findByRole("checkbox", { name: "Cerrar la llave del gas" }));
    await user.click(screen.getByRole("checkbox", { name: "Cerrar la llave del agua" }));
    expect(screen.getByText(`2 de ${total} hechas`)).toBeTruthy();
    // Lo tachado se recuerda en el móvil por si se cierra la app.
    expect(localStorage.getItem("househub:checklist:leave")).toContain('"ids"');

    await user.click(screen.getByRole("button", { name: "✓ Terminado" }));
    await user.click(await screen.findByRole("button", { name: "Sí, terminar" }));
    await vi.waitFor(() => expect(fake.tables.checklist_runs).toHaveLength(1));
    expect(fake.tables.checklist_runs![0]).toMatchObject({ kind: "leave", checked: 2, total });
    expect(await screen.findByText(/¡Casa cerrada!/)).toBeTruthy();
    expect(localStorage.getItem("househub:checklist:leave")).toBeNull();
  });

  it("dice quién la hizo la última vez", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const house = fake.tables.houses![0]!.id;
    fake.tables.checklist_items!.push({
      id: "cccccccc-cccc-4ccc-8ccc-000000000001",
      house_id: house,
      kind: "leave",
      text: "Cerrar la llave del gas",
      position: 1,
    });
    fake.tables.checklist_runs!.push({
      id: "dddddddd-dddd-4ddd-8ddd-000000000001",
      house_id: house,
      kind: "leave",
      user_id: fake.user.id,
      checked: 1,
      total: 1,
      finished_at: "2026-10-26T10:00:00Z",
    });
    renderAt("/irse");
    expect(await screen.findByText(/Ana cerró la casa el lunes 26 de octubre/)).toBeTruthy();
    expect(screen.getByText("(✓ todo)")).toBeTruthy();
  });

  it("la lista se cambia: añadir, subir y quitar", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const house = fake.tables.houses![0]!.id;
    const item = (n: number, text: string) => ({
      id: `cccccccc-cccc-4ccc-8ccc-00000000000${n}`,
      house_id: house,
      kind: "leave",
      text,
      position: n,
    });
    fake.tables.checklist_items!.push(item(1, "Cerrar el agua"), item(2, "Bajar persianas"));
    const user = userEvent.setup();
    renderAt("/irse");
    await user.click(await screen.findByRole("button", { name: "✏️ Cambiar la lista" }));
    await user.type(screen.getByLabelText("Añadir a la lista"), "Regar las plantas");
    await user.click(screen.getByRole("button", { name: "+ Añadir" }));
    await vi.waitFor(() => expect(fake.tables.checklist_items).toHaveLength(3));
    expect(fake.tables.checklist_items![2]).toMatchObject({
      text: "Regar las plantas",
      position: 3,
    });

    await user.click(await screen.findByRole("button", { name: "Subir «Bajar persianas»" }));
    await vi.waitFor(() =>
      expect(fake.tables.checklist_items!.find((i) => i.text === "Bajar persianas")!.position).toBe(
        1,
      ),
    );
    await user.click(await screen.findByRole("button", { name: "Quitar «Cerrar el agua»" }));
    await vi.waitFor(() => expect(fake.tables.checklist_items).toHaveLength(2));
  });

  it("si falta el SQL en Supabase, avisa con calma", async () => {
    installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingTables: ["checklist_items", "checklist_runs"],
    });
    renderAt("/irse");
    expect(await screen.findByText(/aún no están activadas/)).toBeTruthy();
  });
});
