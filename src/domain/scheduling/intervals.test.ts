import { describe, expect, it } from "vitest";
import { contains, isAdjacent, mergeIntervals, overlaps, subtractIntervals } from "@/domain/scheduling/intervals";

const h = (hour: number, minute = 0) => hour * 60 + minute;

describe("overlaps — semântica [start, end) igual à exclusion constraint", () => {
  it("10–11 e 11–12 NÃO se sobrepõem (adjacentes)", () => {
    expect(overlaps({ start: h(10), end: h(11) }, { start: h(11), end: h(12) })).toBe(false);
    expect(isAdjacent({ start: h(10), end: h(11) }, { start: h(11), end: h(12) })).toBe(true);
  });

  it("10–11 e 10:30–11:30 se sobrepõem", () => {
    expect(overlaps({ start: h(10), end: h(11) }, { start: h(10, 30), end: h(11, 30) })).toBe(true);
  });

  it("contido e igual também se sobrepõem", () => {
    expect(overlaps({ start: h(10), end: h(12) }, { start: h(10, 30), end: h(11) })).toBe(true);
    expect(overlaps({ start: h(10), end: h(11) }, { start: h(10), end: h(11) })).toBe(true);
    expect(contains({ start: h(8), end: h(12) }, { start: h(10), end: h(11) })).toBe(true);
    expect(contains({ start: h(8), end: h(12) }, { start: h(11, 30), end: h(12, 30) })).toBe(false);
  });
});

describe("mergeIntervals", () => {
  it("funde sobrepostos e adjacentes, descarta vazios", () => {
    expect(
      mergeIntervals([
        { start: h(14), end: h(15) },
        { start: h(8), end: h(10) },
        { start: h(10), end: h(12) },
        { start: h(9), end: h(11) },
        { start: h(16), end: h(16) },
      ]),
    ).toEqual([
      { start: h(8), end: h(12) },
      { start: h(14), end: h(15) },
    ]);
  });
});

describe("subtractIntervals", () => {
  it("08–18 menos 12–14 = 08–12 e 14–18", () => {
    expect(subtractIntervals([{ start: h(8), end: h(18) }], [{ start: h(12), end: h(14) }])).toEqual([
      { start: h(8), end: h(12) },
      { start: h(14), end: h(18) },
    ]);
  });

  it("bloqueio cobrindo tudo zera; fora do intervalo não afeta", () => {
    expect(subtractIntervals([{ start: h(8), end: h(12) }], [{ start: h(7), end: h(13) }])).toEqual([]);
    expect(subtractIntervals([{ start: h(8), end: h(12) }], [{ start: h(14), end: h(15) }])).toEqual([{ start: h(8), end: h(12) }]);
  });
});
