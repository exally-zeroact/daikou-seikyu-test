// @vitest-environment node
// ============================================================
// ★代行請求の画面を ダイコメの青にする★ 2026-08-09
//
//   ★司さんの言葉★
//     「代行請求書アプリの中もダイコメに合わせてな」
//     ログイン画面だけ青にしたら、入った先が緑のままで浮いていた（写真を見て言われた）。
//
//   ★ここで守ること★
//     1. 画面から ★Exally の緑が1色も残らない★
//     2. ★紙（請求書そのもの）は1色も変えない★
//        .sheet / .sh-* と @media print と invoice-pdf.js は ★刷る物★。
//        ここの色を変えると、司さんがお客さんに出す請求書が変わる。
//     3. ★Excel の緑 #217346 は残す★
//        これは Excel を表す色で、Exally の色ではない（Excel風の見せ方に使っている）
//
//   ★色は事務所(dashboard.html)と同じ値を名指しで入れる★
//     --blue #007aff / --blue-d #0a5fd0 / --bg #f2f7ff / --line #dbe7f7 / --muted #5a6b82
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "daikou-seikyu.html"), "utf8");

// <style> の中を 規則ごとに切り出す
function rules() {
  const a = HTML.indexOf("<style>");
  const b = HTML.indexOf("</style>", a);
  const style = HTML.slice(a, b);
  const printAt = style.indexOf("@media print");
  const out = [];
  const RE = /([^{}]*)\{([^{}]*)\}/g;
  let m;
  while ((m = RE.exec(style))) {
    out.push({
      // 直前のコメントや改行が混ざるので、最後の行だけを選択子とみなす
      sel: m[1].trim().split("\n").pop().trim(),
      body: m[2],
      paper: /\.sheet(?![-\w])|\.sh-/.test(m[1]),
      print: printAt >= 0 && m.index > printAt,
    });
  }
  return out;
}
const RULES = rules();

// Exally の緑（よく出る物）
const EXALLY_GREEN = ["#2e7d54", "#52b788", "#3d9e72", "#7aa08c", "#d4eae0", "#c8ecd8", "#f0faf4"];

describe("★画面から Exally の緑が消えているか★", () => {
  it("規則が読めている（数百ある）", () => {
    expect(RULES.length).toBeGreaterThan(200);
  });

  for (const g of EXALLY_GREEN) {
    it("画面に " + g + " が残っていない", () => {
      const hit = RULES.filter((r) => !r.paper && !r.print && r.body.toLowerCase().includes(g)).map(
        (r) => r.sel.split("\n").pop().trim()
      );
      expect(hit, "★" + g + " が残っている: " + hit.join(" / ")).toEqual([]);
    });
  }

  it("★事務所と同じ青が入っている★", () => {
    const all = RULES.filter((r) => !r.paper && !r.print)
      .map((r) => r.body)
      .join("")
      .toLowerCase();
    expect(all, "事務所の --blue-d が無い").toContain("#0a5fd0");
    expect(all, "事務所の --blue が無い").toContain("#007aff");
    expect(all, "事務所の --bg が無い").toContain("#f2f7ff");
  });

  it("★濃い緑 #1A4A2E は1つも無い★（全アプリ共通の禁止色）", () => {
    expect(HTML.toLowerCase()).not.toContain("#1a4a2e");
  });

  // ★影は rgba( で書いてあるので hex を探すだけでは見つからない★
  //   画面を開いて計算後の色を数えて初めて気づいた（覆いの下地が緑だった）
  it("★影や覆いの rgba も 緑がかっていない★", () => {
    const green = (v) => {
      const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (!m) return false;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      return g > r + 10 && g > b + 6;
    };
    const bad = RULES.filter((r) => !r.paper && !r.print)
      .flatMap((r) => (r.body.match(/rgba?\([^)]*\)/g) || []).map((v) => r.sel + " : " + v))
      .filter((s) => green(s));
    expect(bad, "★緑がかった rgba が残っている:\n  " + bad.join("\n  ")).toEqual([]);
  });
});

// ★<style> の中だけ直しても足りない★
//   要素に style="…" と直書きしてある所と、JSが組み立てる小さな見た目が残る。
//   実際に、画面を開いて全要素の「計算後の色」を数えて見つけた（ソースを読むだけでは気づけなかった）。
describe("★直書きの色も 緑が残っていない★", () => {
  const styleEnd = HTML.indexOf("</style>");
  const rest = HTML.slice(styleEnd);

  for (const g of ["#2e7d54", "#52b788", "#7aa08c", "#c8ecd8", "#a9c4b6", "#eaf5ef"]) {
    it("style の外に " + g + " が残っていない（★Excelに書き出す文字色は除く★）", () => {
      const bad = rest
        .split("\n")
        .filter((L) => L.toLowerCase().includes(g))
        .filter((L) => !/var C_(TEXT|LABEL|MUTED)\s*=/.test(L)) // ★紙（Excel）の色★
        .map((L) => L.trim().slice(0, 60));
      expect(bad, "★" + g + " が残っている:\n  " + bad.join("\n  ")).toEqual([]);
    });
  }

  it("★Excelに書き出す時の文字色は 変えていない★（お客さんに渡す帳票）", () => {
    expect(rest, "C_LABEL を変えている").toContain('C_LABEL = { rgb: "3D9E72" }');
    expect(rest, "C_MUTED を変えている").toContain('C_MUTED = { rgb: "7AA08C" }');
  });
});

describe("★紙（刷る物）は1色も変えていない★", () => {
  it(".sheet の枠線は今までの色のまま", () => {
    const sheet = RULES.find((r) => r.sel === ".sheet");
    expect(sheet, ".sheet の規則が無い").toBeTruthy();
    expect(sheet.body.toLowerCase(), "★紙の枠線の色を変えている★").toContain("#d4eae0");
  });

  it("紙の規則の中に 事務所の青が入り込んでいない", () => {
    const leaked = RULES.filter(
      (r) => (r.paper || r.print) && /#0a5fd0|#007aff|#f2f7ff|#dbe7f7/i.test(r.body)
    ).map((r) => r.sel.split("\n").pop().trim());
    expect(leaked, "★紙に青が漏れている: " + leaked.join(" / ")).toEqual([]);
  });

  it("★PDFを作る側(invoice-pdf.js)は触っていない★", () => {
    const pdf = fs.readFileSync(path.join(ROOT, "invoice-pdf.js"), "utf8").toLowerCase();
    expect(pdf, "★紙のPDFの色を変えている★").toContain("#2e7d54");
    expect(pdf).toContain("#52b788");
  });
});

describe("★Excel の緑は残す★", () => {
  it("#217346 が残っている（Excelを表す色。Exallyの色ではない）", () => {
    const xl = RULES.filter((r) => r.body.includes("#217346")).map((r) => r.sel);
    expect(xl.length, "★Excelの緑まで塗り替えている★").toBeGreaterThan(0);
  });
});
