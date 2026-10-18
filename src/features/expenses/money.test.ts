import { describe, expect, it } from "vitest";
import {
  balances,
  formatEuros,
  parseEuros,
  seedFrom,
  settleUp,
  splitEqually,
  type ExpenseLike,
} from "./money";

const sum = (m: ReadonlyMap<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("importes", () => {
  it("entiende cómo se escriben los euros en España", () => {
    expect(parseEuros("12")).toBe(1200);
    expect(parseEuros("12,5")).toBe(1250);
    expect(parseEuros("12,50")).toBe(1250);
    expect(parseEuros("12.50")).toBe(1250);
    expect(parseEuros("0,01")).toBe(1);
    expect(parseEuros("1.234,56")).toBe(123456);
    expect(parseEuros("1.234")).toBe(123400);
    expect(parseEuros(" 45,90 € ")).toBe(4590);
  });

  it("rechaza lo que no es un importe válido", () => {
    for (const bad of ["", "abc", "0", "0,00", "-5", "12,345", "1,2,3", "100000,01"]) {
      expect(parseEuros(bad)).toBeNull();
    }
    expect(parseEuros("100000")).toBe(10_000_000);
  });

  it("muestra los céntimos como euros", () => {
    expect(formatEuros(1234).replace(/\s/g, " ")).toBe("12,34 €");
    expect(formatEuros(5).replace(/\s/g, " ")).toBe("0,05 €");
  });
});

describe("reparto a partes iguales (céntimos)", () => {
  it("10 € entre 3: 3,34 + 3,33 + 3,33 y suma exacta", () => {
    const r = splitEqually(1000, ["a", "b", "c"]);
    expect([...r.values()]).toEqual([334, 333, 333]);
    expect(sum(r)).toBe(1000);
  });

  it("el céntimo que sobra va a una persona distinta según la semilla", () => {
    expect([...splitEqually(1000, ["a", "b", "c"], 1).values()]).toEqual([333, 334, 333]);
    expect([...splitEqually(1000, ["a", "b", "c"], 2).values()]).toEqual([333, 333, 334]);
    expect([...splitEqually(1000, ["a", "b", "c"], 5).values()]).toEqual([333, 333, 334]);
  });

  it("la suma es siempre el total, para muchos importes y personas", () => {
    for (let total = 1; total <= 2000; total += 7) {
      for (let n = 1; n <= 9; n++) {
        const ids = Array.from({ length: n }, (_, i) => `m${i}`);
        for (const seed of [0, 1, 4, 99]) {
          const r = splitEqually(total, ids, seed);
          expect(sum(r)).toBe(total);
          const values = [...r.values()];
          // Nadie paga más de 1 céntimo de diferencia respecto a otro.
          expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("1 céntimo entre 4: uno paga 1 y los demás 0", () => {
    expect(sum(splitEqually(1, ["a", "b", "c", "d"]))).toBe(1);
  });

  it("la semilla es estable", () => {
    expect(seedFrom("2026-10-18")).toBe(seedFrom("2026-10-18"));
  });
});

const expense = (paidBy: string, amount: number, shares: Record<string, number>): ExpenseLike => ({
  paidBy,
  amount,
  shares: new Map(Object.entries(shares)),
});

describe("saldos y cómo quedar en paz", () => {
  it("Ana paga 30 € entre 3: Luis y Eva le deben 10 € cada uno", () => {
    const b = balances(
      ["ana", "luis", "eva"],
      [expense("ana", 3000, { ana: 1000, luis: 1000, eva: 1000 })],
      [],
    );
    expect(Object.fromEntries(b)).toEqual({ ana: 2000, luis: -1000, eva: -1000 });
    expect(sum(b)).toBe(0);
    expect(settleUp(b)).toEqual([
      { from: "eva", to: "ana", cents: 1000 },
      { from: "luis", to: "ana", cents: 1000 },
    ]);
  });

  it("un pago marcado como hecho reduce la deuda", () => {
    const b = balances(
      ["ana", "luis"],
      [expense("ana", 2000, { ana: 1000, luis: 1000 })],
      [{ from: "luis", to: "ana", cents: 1000 }],
    );
    expect(Object.fromEntries(b)).toEqual({ ana: 0, luis: 0 });
    expect(settleUp(b)).toEqual([]);
  });

  it("deudas cruzadas: como mucho n−1 pagos y todos quedan en 0", () => {
    const b = balances(
      ["a", "b", "c", "d"],
      [
        expense("a", 10000, { a: 2500, b: 2500, c: 2500, d: 2500 }),
        expense("b", 3333, splitObj(splitEqually(3333, ["a", "b", "c"]))),
        expense("c", 101, { d: 101 }),
      ],
      [],
    );
    expect(sum(b)).toBe(0);
    const transfers = settleUp(b);
    expect(transfers.length).toBeLessThanOrEqual(3);
    const after = new Map(b);
    for (const t of transfers) {
      after.set(t.from, (after.get(t.from) ?? 0) + t.cents);
      after.set(t.to, (after.get(t.to) ?? 0) - t.cents);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
  });

  it("los familiares sin cuenta cuentan igual", () => {
    const b = balances(["ana", "abuelo"], [expense("abuelo", 500, { ana: 500 })], []);
    expect(settleUp(b)).toEqual([{ from: "ana", to: "abuelo", cents: 500 }]);
  });
});

function splitObj(m: Map<string, number>): Record<string, number> {
  return Object.fromEntries(m);
}
