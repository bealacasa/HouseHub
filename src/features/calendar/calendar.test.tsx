import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { router } from "@/app/router";
import { installFakeSupabase } from "@/test/fakeSupabase";
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
    await user.click(screen.getByRole("button", { name: "Una persona más" }));
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
});
