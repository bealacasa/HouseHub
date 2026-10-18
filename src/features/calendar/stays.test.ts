import { describe, expect, it } from "vitest";
import {
  monthGrid,
  nightsLabel,
  overlapping,
  overlaps,
  periodLabel,
  stayInputSchema,
  staysOn,
  toKey,
  type Stay,
} from "./stays";

const stay = (id: string, start: string, end: string): Stay => ({
  id,
  memberId: "m",
  start,
  end,
  people: 2,
  note: "",
  createdBy: null,
});

describe("reservas", () => {
  it("detecta solapes con los días incluidos", () => {
    const ana = stay("a", "2026-10-17", "2026-10-19");
    expect(overlaps(ana, { start: "2026-10-19", end: "2026-10-21" })).toBe(true); // mismo día
    expect(overlaps(ana, { start: "2026-10-20", end: "2026-10-21" })).toBe(false);
    expect(overlaps(ana, { start: "2026-10-10", end: "2026-10-30" })).toBe(true); // la contiene
    expect(overlapping([ana], { start: "2026-10-18", end: "2026-10-18" })).toEqual([ana]);
    // Al editar una reserva no choca consigo misma.
    expect(overlapping([ana], ana, "a")).toEqual([]);
  });

  it("qué reservas hay un día", () => {
    const all = [stay("a", "2026-10-17", "2026-10-19"), stay("b", "2026-10-19", "2026-10-25")];
    expect(staysOn(all, "2026-10-19").map((s) => s.id)).toEqual(["a", "b"]);
    expect(staysOn(all, "2026-10-26")).toEqual([]);
  });

  it("valida fechas, personas y que la vuelta no sea antes que la llegada", () => {
    const base = {
      memberId: "11111111-1111-4111-8111-111111111111",
      start: "2026-10-17",
      end: "2026-10-19",
      people: 2,
      note: "",
    };
    expect(stayInputSchema.safeParse(base).success).toBe(true);
    expect(stayInputSchema.safeParse({ ...base, end: "2026-10-16" }).success).toBe(false);
    expect(stayInputSchema.safeParse({ ...base, people: 0 }).success).toBe(false);
    expect(stayInputSchema.safeParse({ ...base, start: "" }).success).toBe(false);
    expect(stayInputSchema.safeParse({ ...base, end: "2028-01-01" }).success).toBe(false);
  });

  it("textos claros de fechas y noches", () => {
    expect(periodLabel({ start: "2026-10-17", end: "2026-10-19" })).toBe("Del 17 al 19 de octubre");
    expect(periodLabel({ start: "2026-10-30", end: "2026-11-02" })).toBe(
      "Del 30 de octubre al 2 de noviembre",
    );
    expect(periodLabel({ start: "2026-10-17", end: "2026-10-17" })).toBe("El sábado 17 de octubre");
    expect(nightsLabel({ start: "2026-10-17", end: "2026-10-19" })).toBe("2 noches");
    expect(nightsLabel({ start: "2026-10-17", end: "2026-10-17" })).toBe("1 día");
  });

  it("la cuadrícula del mes empieza en lunes y tiene semanas completas", () => {
    const weeks = monthGrid(new Date(2026, 9, 15)); // octubre de 2026 (empieza en jueves)
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(toKey(weeks[0]![0]!)).toBe("2026-09-28");
    expect(toKey(weeks.at(-1)!.at(-1)!)).toBe("2026-11-01");
  });
});
