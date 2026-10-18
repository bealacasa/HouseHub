import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { houseInputSchema, inviteLink, isPending, peekPendingInvite } from "./house";

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

const TOKEN = "abcdefghijABCDEFGHIJ0123456789_-abcdefghijk"; // 43

describe("la casa", () => {
  it("el primero que entra crea la casa y queda como administrador", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana" });
    const user = userEvent.setup();
    renderAt("/");
    await user.type(await screen.findByLabelText("¿Cómo la llamáis?"), "Casa del pueblo");
    await user.click(screen.getByRole("button", { name: "Crear la casa" }));
    expect(await screen.findByRole("heading", { name: "Hola, Ana" })).toBeTruthy();
    expect(screen.getByText("Casa del pueblo")).toBeTruthy();
    expect(fake.tables.house_members![0]).toMatchObject({ role: "admin" });
    // Solo está ella: le propone invitar a la familia.
    expect(screen.getByRole("link", { name: "Invitar a alguien" })).toBeTruthy();
  });

  it("si la casa existe y no eres miembro, pide una invitación", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Bruno" });
    fake.tables.houses!.push({ id: "h9", name: "Ajena" });
    // RLS ocultaría la casa: simulamos que no se ve, pero existe.
    fake.rpc.mockImplementation(async (fn: string) =>
      fn === "house_exists" ? { data: true, error: null } : { data: null, error: null },
    );
    fake.tables.houses = [];
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Necesitas una invitación" })).toBeTruthy();
  });

  it("valida los datos de la casa (enlace del termostato solo https)", () => {
    const base = { name: "Casa", address: "", notes: "" };
    expect(houseInputSchema.safeParse({ ...base, thermostatUrl: "" }).success).toBe(true);
    expect(
      houseInputSchema.safeParse({ ...base, thermostatUrl: "https://app.tado.com" }).success,
    ).toBe(true);
    expect(
      houseInputSchema.safeParse({ ...base, thermostatUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(houseInputSchema.safeParse({ ...base, name: " " }).success).toBe(false);
  });
});

describe("familia e invitaciones", () => {
  it("el administrador añade un familiar sin cuenta y crea una invitación para él", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa del pueblo" });
    const user = userEvent.setup();
    renderAt("/familia");
    await user.type(await screen.findByLabelText("Nombre"), "Abuelo José");
    await user.click(screen.getByRole("button", { name: "Añadir a la familia" }));
    expect(await screen.findByText("Abuelo José")).toBeTruthy();
    expect(fake.tables.house_members!.find((m) => m.display_name === "Abuelo José")).toMatchObject({
      user_id: null,
      role: "member",
    });

    await user.selectOptions(
      await screen.findByLabelText("¿Es para alguien que ya está en la lista?"),
      "Sí, para Abuelo José",
    );
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));
    expect(await screen.findByText("Invitación creada.")).toBeTruthy();
    expect(fake.rpc).toHaveBeenCalledWith(
      "create_invitation",
      expect.objectContaining({ p_role: "member", p_member: expect.any(String) }),
    );
    const list = await screen.findByText("Invitaciones sin usar");
    expect(within(list.parentElement!).getByText("Para Abuelo José")).toBeTruthy();
  });

  it("un miembro no ve las opciones de administración", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Carmen", house: "Casa" });
    fake.tables.house_members![0]!.role = "member";
    renderAt("/familia");
    expect(await screen.findByText("Carmen")).toBeTruthy();
    expect(screen.queryByText("Invitar a alguien")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cambiar" })).toBeNull();
  });

  it("el enlace lleva el token tras «#» y la invitación se acepta al entrar", async () => {
    expect(inviteLink(TOKEN, "https://x.app")).toBe(`https://x.app/invitacion#t=${TOKEN}`);
    const fake = installFakeSupabase({ signedIn: true, name: "Carmen", house: "Casa" });
    window.location.hash = `#t=${TOKEN}`;
    renderAt("/invitacion");
    expect(await screen.findByRole("heading", { name: "Hola, Carmen" })).toBeTruthy();
    await vi.waitFor(() =>
      expect(fake.functions.invoke).toHaveBeenCalledWith("accept-invite", {
        body: { token: TOKEN },
      }),
    );
    await vi.waitFor(() => expect(peekPendingInvite()).toBeNull());
  });

  it("un enlace de invitación mal formado no se guarda", async () => {
    installFakeSupabase();
    window.location.hash = "#t=corto";
    renderAt("/invitacion");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(peekPendingInvite()).toBeNull();
  });

  it("una invitación caducada, usada o anulada ya no está pendiente", () => {
    const base = {
      id: "i",
      role: "member" as const,
      memberId: null,
      createdAt: "",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      usedAt: null,
      revokedAt: null,
    };
    expect(isPending(base)).toBe(true);
    expect(isPending({ ...base, usedAt: "x" })).toBe(false);
    expect(isPending({ ...base, revokedAt: "x" })).toBe(false);
    expect(isPending({ ...base, expiresAt: new Date(Date.now() - 1000).toISOString() })).toBe(
      false,
    );
  });
});
