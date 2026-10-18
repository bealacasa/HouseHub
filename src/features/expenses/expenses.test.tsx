import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
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

const ABUELO = "77777777-7777-4777-8777-777777777777";

describe("gastos", () => {
  it("apuntar 10 € a partes iguales entre 3 guarda céntimos que suman el total", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    fake.tables.house_members!.push(
      {
        id: ABUELO,
        house_id: "33333333-3333-4333-8333-333333333333",
        user_id: null,
        display_name: "Abuelo",
        role: "member",
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        house_id: "33333333-3333-4333-8333-333333333333",
        user_id: null,
        display_name: "Eva",
        role: "member",
      },
    );
    const user = userEvent.setup();
    const memory = renderAt("/gastos/nuevo");
    await user.type(await screen.findByLabelText("¿Cuánto ha costado?"), "10");
    await user.type(screen.getByLabelText("¿Qué es?"), "Butano");
    await user.click(screen.getByLabelText(/Gas$/));
    await user.click(screen.getByRole("button", { name: "Apuntar gasto" }));

    await vi.waitFor(() => expect(memory.state.location.pathname).toBe("/gastos"), {
      timeout: 5000,
    });
    const saved = fake.tables.expenses![0]!;
    expect(saved).toMatchObject({ amount_cents: 1000, category: "gas", split_mode: "equal" });
    const shares = (saved.expense_shares as { cents: number }[]).map((s) => s.cents).sort();
    expect(shares).toEqual([333, 333, 334]);
    // Ana pagó: le deben 6,66–6,67 €.
    expect(await screen.findByText(/Te deben 6,6\d/)).toBeTruthy();
  });

  it("con cantidades a mano avisa si no suman el total y no guarda", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    renderAt("/gastos/nuevo");
    await user.type(await screen.findByLabelText("¿Cuánto ha costado?"), "20");
    await user.type(screen.getByLabelText("¿Qué es?"), "Compra");
    await user.click(screen.getByLabelText("Cantidades a mano"));
    await user.type(screen.getByLabelText("Ana"), "15");
    expect(screen.getByText(/Faltan 5,00/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Apuntar gasto" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no suman el total");
    expect(fake.tables.expenses).toHaveLength(0);
  });

  it("muestra cómo quedar en paz y apunta el pago", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const me = String(fake.tables.house_members![0]!.id);
    fake.tables.house_members!.push({
      id: ABUELO,
      house_id: "33333333-3333-4333-8333-333333333333",
      user_id: null,
      display_name: "Abuelo",
      role: "member",
    });
    fake.tables.expenses!.push({
      id: "99999999-9999-4999-8999-999999999999",
      concept: "Luz",
      category: "luz",
      amount_cents: 4000,
      date: "2026-10-01",
      paid_by: me,
      split_mode: "equal",
      note: "",
      created_by: null,
      expense_shares: [
        { member_id: me, cents: 2000 },
        { member_id: ABUELO, cents: 2000 },
      ],
    });
    const user = userEvent.setup();
    renderAt("/gastos");
    expect(
      await screen.findByText(
        (_, el) => el?.tagName === "P" && /Abuelo paga 20,00\s€ a Ana/.test(el.textContent ?? ""),
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Marcar como pagado" }));
    await user.click(await screen.findByRole("button", { name: "Sí, ya está pagado" }));
    await vi.waitFor(() =>
      expect(fake.tables.settlements![0]).toMatchObject({
        from_member: ABUELO,
        to_member: me,
        cents: 2000,
      }),
    );
  });
});
