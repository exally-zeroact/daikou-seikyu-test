// @vitest-environment node
// ============================================================
// ★繰越（前回の残りを次の請求に乗せる）★ 2026-08-11 → ★2026-11-02 5項目に 揃えた★
//
//   並べる順（2026-11-02 司さん「それでやれ」＝MF・弥生の 5項目）
//     合計（今月分）→ 前回ご請求額 → −ご入金額 → 繰越金額 → 今回ご請求額
//   ・ご入金額＝前回の 請求書（前の 月の 行）への 入金。★その 月への 入金は その 月の 紙に 載せない★
//     ⇒ 払い終えた 後に 出し直しても 紙は 1円も 変わらない（前は 上が ¥0・払い過ぎで マイナス＝司さん「なんぼで請求したか見直せんやろが」）
//   ・入金は「払ってもらった 請求書の 月の 行」に 記録する（司さん 2026-11-02）
//
//   ★ここで守ること★
//     ・★手で計算した値を必ず埋める★（紙とExcelが一致だけの試験は 両方 同じだけ 間違うと 素通りする）
//     ・★0円と書かない★ 前回の請求が無い → 「前回の請求はありません」
// ============================================================
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { describe, it, expect } from "vitest";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const E = createRequire(import.meta.url)(path.join(ROOT, "meisai-engine.js"));

describe("★繰越（5項目）★", () => {
  it("エンジンが読めている", () => {
    expect(typeof E.carryoverOf).toBe("function");
  });

  it("★手で計算した例：前回 37,200 のうち 20,000 入金 → 繰越 17,200・今回ご請求額 29,200★", () => {
    // 2026-05 の 紙：37,200（前の 繰越 無し）／5月の 行に 20,000 入金
    // 2026-06 の 紙：前回ご請求額 37,200・ご入金額 20,000・繰越金額 17,200・今月分 12,000・今回ご請求額 29,200
    const r = E.carryoverOf([{ month: "2026-05", seikyu: 37200, nyukin: 20000 }], 12000);
    expect(r.konkai).toBe(12000);
    expect(r.maeSeikyu).toBe(37200);
    expect(r.nyukin).toBe(20000);
    expect(r.kurikoshi).toBe(17200);
    expect(r.seikyuGaku).toBe(29200);
    expect(r.riyu).toEqual([]);
  });

  it("★複数月：前回ご請求額＝前の 月の 紙の 今回ご請求額★", () => {
    // 3月 10,000 請求・3月の 行に 10,000 入金 → 4月の 紙 = 0 + 8,600 = 8,600
    // 4月 8,600・4月の 行に 0       → 5月の 紙 = 8,600 + 9,400 = 18,000
    // 5月 9,400・5月の 行に 4,000   → 6月の 紙：前回ご請求額 18,000・ご入金額 4,000・繰越 14,000・今回 7,200 → 21,200
    const r = E.carryoverOf(
      [
        { month: "2026-03", seikyu: 10000, nyukin: 10000 },
        { month: "2026-04", seikyu: 8600, nyukin: 0 },
        { month: "2026-05", seikyu: 9400, nyukin: 4000 },
      ],
      7200
    );
    expect(r.maeSeikyu).toBe(18000);
    expect(r.nyukin).toBe(4000);
    expect(r.kurikoshi).toBe(14000);
    expect(r.seikyuGaku).toBe(21200);
  });

  it("★続く 月で つながる：M の 前回ご請求額 ＝ M−1 の 今回ご請求額（入金を 変えない 時）★", () => {
    // わざと 壊す：maeSeikyu = kurikoshi に すると ここが 赤
    const tsuki = [
      { month: "2026-01", seikyu: 5000, nyukin: 3000 },
      { month: "2026-02", seikyu: 7000, nyukin: 0 },
      { month: "2026-03", seikyu: 1000, nyukin: 12000 },
      { month: "2026-04", seikyu: 6400, nyukin: 2500 },
    ];
    for (let i = 1; i < tsuki.length; i++) {
      const mae = E.carryoverOf(tsuki.slice(0, i - 1), tsuki[i - 1].seikyu);
      const ima = E.carryoverOf(tsuki.slice(0, i), tsuki[i].seikyu);
      const maeNoGaku = mae.seikyuGaku == null ? tsuki[i - 1].seikyu : mae.seikyuGaku;
      expect(ima.maeSeikyu, tsuki[i].month + " の 前回ご請求額").toBe(maeNoGaku);
      expect(ima.maeSeikyu - ima.nyukin, "前回ご請求額 − ご入金額 ＝ 繰越金額").toBe(ima.kurikoshi);
    }
  });

  it("★その 月への 入金は 紙に 載らない＝払い終えても 出し直した 紙は 変わらない★", () => {
    // 6月の 紙は 6月の 行の 入金を 見ない（kako は 6月より 前の 月だけ）。3つ目の 引数を 渡しても 無視する。
    // わざと 壊す：当月の 入金を 引く 式に 戻すと ここが 赤
    const kako = [{ month: "2026-05", seikyu: 37200, nyukin: 20000 }];
    const mae = E.carryoverOf(kako, 12000);
    const harai = E.carryoverOf(kako, 12000, 29200);
    expect(harai).toEqual(mae);
    expect(E.ueNoGaku(12000, harai), "★払い終えた 月の 上の 額が 変わった★").toBe(29200);
  });

  it("★過去に払い過ぎている時は 繰越がマイナスになる（勝手に0にしない）★", () => {
    // 5月 10,000 請求・5月の 行に 12,000 入金 → 繰越 −2,000・今回 5,000 → 3,000
    const r = E.carryoverOf([{ month: "2026-05", seikyu: 10000, nyukin: 12000 }], 5000);
    expect(r.kurikoshi, "★払い過ぎを0に丸めている★").toBe(-2000);
    expect(r.maeSeikyu).toBe(10000);
    expect(r.seikyuGaku).toBe(3000);
  });

  it("★払い過ぎが 今月分より 大きい 時だけ 今回ご請求額が マイナス★", () => {
    // 5月 10,000・5月の 行に 18,000 → 繰越 −8,000・今回 3,000 → −5,000
    const r = E.carryoverOf([{ month: "2026-05", seikyu: 10000, nyukin: 18000 }], 3000);
    expect(r.seikyuGaku).toBe(-5000);
  });

  it("★前回の請求が1件も無い → 0円と書かず「前回の請求はありません」★", () => {
    const r = E.carryoverOf([], 12000);
    expect(r.kurikoshi, "★0円と書いている（無いのと0は別物）★").toBe(null);
    expect(r.maeSeikyu).toBe(null);
    expect(r.nyukin).toBe(null);
    expect(r.seikyuGaku, "出せないのに数を出している").toBe(null);
    expect(r.riyu).toContain("前回の請求はありません");
  });

  it("★過去の月の請求額が読めない → 繰越を出さない★", () => {
    const r = E.carryoverOf(
      [
        { month: "2026-04", seikyu: null, nyukin: 0 },
        { month: "2026-05", seikyu: 9400, nyukin: 0 },
      ],
      7200
    );
    expect(r.kurikoshi, "★読めない月が在るのに 足して出している★").toBe(null);
    expect(r.seikyuGaku).toBe(null);
    expect(r.riyu).toContain("前回の請求額が読めません");
  });

  it("★過去の入金が0の月と 未確認の月は別物★", () => {
    const zero = E.carryoverOf([{ month: "2026-05", seikyu: 1000, nyukin: 0 }], 0);
    expect(zero.kurikoshi).toBe(1000);
    const fumei = E.carryoverOf([{ month: "2026-05", seikyu: 1000, nyukin: null }], 0);
    expect(fumei.kurikoshi, "★未確認を0として足している★").toBe(null);
    expect(fumei.nyukin).toBe(null);
    expect(fumei.riyu).toContain("入金は未確認");
  });
});

// ★紙の 上の 大きい「御請求金額（税込）」★ 繰越の 会社＝今回ご請求額／使わない 会社・出せない 月＝その 月の 合計
describe("★上の 御請求金額（ueNoGaku）★", () => {
  it("繰越の 会社は 今回ご請求額（手で 計算：17,200 ＋ 12,000 = 29,200）", () => {
    const c = E.carryoverOf([{ month: "2026-05", seikyu: 37200, nyukin: 20000 }], 12000);
    expect(E.ueNoGaku(12000, c)).toBe(29200);
  });
  it("繰越を 使わない 会社（carry が 無い）は その 月の 合計の まま", () => {
    expect(E.ueNoGaku(12000, null)).toBe(12000);
    expect(E.ueNoGaku(12000, undefined)).toBe(12000);
  });
  it("前回の 請求が 無い 月は その 月の 合計", () => {
    const c = E.carryoverOf([], 37200);
    expect(c.seikyuGaku).toBe(null);
    expect(E.ueNoGaku(37200, c)).toBe(37200);
  });
  it("★今回ご請求額が 0 の 時に 今月分へ 化けない（!= null で 見る）★", () => {
    expect(E.ueNoGaku(12000, { seikyuGaku: 0 })).toBe(0);
    expect(E.ueNoGaku(12000, { seikyuGaku: -5000 })).toBe(-5000);
  });
});

describe("★繰越の 額の 字（▲）★", () => {
  it("マイナスは ▲¥・プラスと 0 は ¥", () => {
    expect(E.sankakuYen(-5000)).toBe("▲¥5,000");
    expect(E.sankakuYen(29200)).toBe("¥29,200");
    expect(E.sankakuYen(0)).toBe("¥0");
    expect(E.sankakuYen(-1234567)).toBe("▲¥1,234,567");
  });
  it("▲の 説明の 字", () => {
    expect(E.SASHIHIKI_JI).toBe("▲の額は次回のご請求から差し引きます");
  });
});
