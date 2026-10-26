import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { router } from "@/app/router";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { addDays } from "date-fns";
import { toKey } from "./stays";

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

describe("calendario", () => {
  it("reservar avisa del solape pero deja guardar igualmente", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const day = toKey(new Date());
    const memberId = String(fake.tables.house_members![0]!.id);
    fake.tables.stays!.push({
      id: "44444444-4444-4444-8444-444444444444",
      member_id: memberId,
      start_date: day,
      end_date: day,
      people: 2,
      note: "",
      created_by: null,
    });
    const user = userEvent.setup();
    renderAt(`/calendario/nueva?dia=${day}`);

    expect(await screen.findByText(/Esos días ya va/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Añadir uno/ }));
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await user.click(await screen.findByRole("button", { name: "Sí, reservar igualmente" }));
    expect(await screen.findByRole("heading", { name: "Calendario", level: 1 })).toBeTruthy();
    expect(fake.tables.stays).toHaveLength(2);
    expect(fake.tables.stays![1]).toMatchObject({ start_date: day, end_date: day, people: 2 });
  });

  it("el inicio dice quién está ahora en la casa", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const day = toKey(new Date());
    fake.tables.stays!.push({
      id: "55555555-5555-4555-8555-555555555555",
      member_id: String(fake.tables.house_members![0]!.id),
      start_date: day,
      end_date: day,
      people: 1,
      note: "",
      created_by: null,
    });
    renderAt("/");
    const box = await screen.findByRole("heading", { name: "¿Quién está en la casa?" });
    expect(box.parentElement!.textContent).toContain("Ana");
    expect(box.parentElement!.textContent).not.toContain("no hay nadie");
  });

  it("al tocar un nombre de la leyenda se ven solo las reservas de esa persona", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const ana = String(fake.tables.house_members![0]!.id);
    const bruno = "33333333-3333-4333-8333-333333333333";
    fake.tables.house_members!.push({
      id: bruno,
      house_id: fake.tables.house_members![0]!.house_id,
      user_id: null,
      display_name: "Bruno",
      role: "member",
    });
    const day = (n: number) => toKey(addDays(new Date(), n));
    const stay = (id: string, member: string, start: string, end: string, people: number) => ({
      id,
      member_id: member,
      start_date: start,
      end_date: end,
      people,
      note: "",
      created_by: null,
    });
    fake.tables.stays!.push(
      stay("66666666-6666-4666-8666-666666666661", ana, day(2), day(4), 2),
      stay("66666666-6666-4666-8666-666666666662", bruno, day(10), day(12), 3),
      stay("66666666-6666-4666-8666-666666666663", bruno, day(-20), day(-18), 4),
    );
    const user = userEvent.setup();
    const memory = renderAt("/calendario");

    const brunoButton = await screen.findByRole("button", { name: "Bruno", pressed: false });
    await user.click(brunoButton);
    const box = (await screen.findByRole("heading", { name: "Reservas de Bruno" })).closest(
      "section",
    )!;
    expect(memory.state.location.search).toContain("persona=" + bruno);
    expect(within(box).getByText(/3 personas/)).toBeTruthy();
    expect(within(box).queryByText(/2 personas/)).toBeNull();
    expect(within(box).queryByText(/4 personas/)).toBeNull();

    await user.click(within(box).getByRole("button", { name: "Ver las pasadas (1)" }));
    expect(within(box).getByText(/4 personas/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Bruno/, pressed: true }));
    expect(screen.queryByRole("heading", { name: "Reservas de Bruno" })).toBeNull();
  });
});
