import { test, expect } from "@playwright/test";
// ============================================================
// 出した 請求書と 今の 明細の 額が 違う 時は 入金の 画面で 知らせる 2026-10-14
//
//   司さん「編集したらちゃんと反映」（出した 月の 明細も 直したら 変える）＋指示役「渡した 紙と 額が 変わる 事を 黙らない」
//   計算（請求額・入金・繰越）は 変えない。字を 出す だけ。
//   比べる 額は「出した 時の 明細の 行」を 今の 足し方（invoiceTotals）に 通した 物
//   （外税の 古い 写しは total が 税抜＝total と 比べると 嘘の「違う」が 出る・対立役）
//
//   ★わざと壊して 赤に なるのを 見た（2026-10-14 実測）★
//     知らせを 入れる 前の 版 ⇒ 赤（字が 出ない）
// ============================================================
test.setTimeout(120000);
const CO = "差の試し株式会社";

function seed() {
  return (arg) => {
    const uid = "u_sa";
    const co = "差の試し株式会社";
    const meisai = (id, date, amount) => ({
      id,
      user_id: uid,
      company: co,
      date,
      destination: "本社〜北浜",
      amount,
      note: "",
      distance: null,
      people: 1,
      name: "",
      extra: null,
      created_at: "2026-05-01T00:00:00.000Z",
      deleted_at: null,
    });
    const rowsJson = (amts) =>
      amts.map((a, k) => ({ 日付: "2026-05-0" + (k + 6), 行き先: "本社〜北浜", 金額: a }));
    localStorage.setItem(
      "__fake_supa_db__",
      JSON.stringify({
        users: { "s@x.com": { id: uid, email: "s@x.com", password: "himitsu123" } },
        session: { user: { id: uid, email: "s@x.com" } },
        tables: {
          meisai: arg.ima.map((a, k) => meisai("m" + k, "2026-05-0" + (k + 6), a)),
          companies: [
            {
              id: "c1",
              user_id: uid,
              name: co,
              items: ["日付", "行き先", "金額"],
              config: arg.tm ? { taxMode: arg.tm } : {},
              created_at: "2026-05-01T00:00:00.000Z",
              deleted_at: null,
            },
          ],
          issuer: [
            {
              user_id: uid,
              config: {
                issuer: "合同会社ZEROact\nZERO代行",
                bank: "見本銀行",
                showInvoiceNo: true,
              },
              updated_at: "2026-08-01T00:00:00.000Z",
            },
          ],
          payments: [],
          invoices: arg.dashita
            ? [
                {
                  id: "i1",
                  user_id: uid,
                  month: "2026-05",
                  company: arg.kyuuMei || co,
                  invoice_no: "2026-05-01",
                  total: arg.total,
                  tax: 0,
                  rows_json: rowsJson(arg.dashita),
                  issued_at: arg.issued || "2026-06-01T00:00:00.000Z",
                  deleted_at: null,
                },
              ]
            : [],
          invoice_no: arg.bangou
            ? [
                {
                  user_id: uid,
                  month: "2026-05",
                  company: co,
                  invoice_no: "2026-05-01",
                  decided_at: "2026-06-01T00:00:00.000Z",
                },
              ]
            : [],
        },
      })
    );
  };
}

async function hiraku(page, arg) {
  await page.route(/cdn\.jsdelivr\.net/, (r) => r.abort());
  await page.addInitScript({ path: "tests/e2e/fake-supabase.js" });
  await page.addInitScript(seed(), arg);
  await page.goto("/daikou-seikyu.html", { waitUntil: "load" });
  await expect(page.locator("#scr-input")).toBeVisible({ timeout: 20000 });
  await page.locator('.nav-item[data-scr="payment"]').click();
  const gyou = page.locator("#payBody .pay-row, #payBody > div").filter({ hasText: CO }).first();
  await expect(gyou).toBeVisible({ timeout: 20000 });
  return gyou;
}

test("出した 後に 明細が 増えた＝入金の 一覧と 窓に 差を 出す（額は 今の 明細のまま）", async ({
  page,
}) => {
  const gyou = await hiraku(page, { ima: [12000, 4000], dashita: [12000, 3400], total: 15400 });
  await expect(gyou).toContainText("出した時 ¥15,400 → 今 ¥16,000（+¥600）");
  await expect(gyou).toContainText("先方に渡した請求書と額が違います");
  await expect(gyou).toContainText("¥16,000"); // 請求額は 今の 明細（変えていない）
  await gyou.click();
  await expect(page.locator("#modalBody .pay-sagaku")).toContainText(
    "出した時 ¥15,400 → 今 ¥16,000"
  );
});

test("明細が 同じ＝何も 出さない", async ({ page }) => {
  const gyou = await hiraku(page, { ima: [12000, 3400], dashita: [12000, 3400], total: 15400 });
  await expect(gyou.locator(".pay-sagaku")).toHaveCount(0);
});

test("外税の 古い 写し（total が 税抜）でも 明細が 同じなら 何も 出さない", async ({ page }) => {
  const gyou = await hiraku(page, {
    tm: "外税",
    ima: [12000, 3400],
    dashita: [12000, 3400],
    total: 15400, // 古い 形＝税抜（今の 足し方なら 16,940）
  });
  await expect(gyou.locator(".pay-sagaku")).toHaveCount(0);
});

test("番号だけ 決まって 出した 時の 明細が 無い 月＝窓で「比べられません」", async ({ page }) => {
  const gyou = await hiraku(page, { ima: [12000, 3400], bangou: true });
  await expect(gyou.locator(".pay-sagaku")).toHaveCount(0);
  await gyou.click();
  await expect(page.locator("#modalBody")).toContainText("比べられません");
});

test("同じ 画面で 出し直した 直後は 新しい 額と 比べる（嘘の「違う」を 出さない）", async ({
  page,
}) => {
  const gyou = await hiraku(page, { ima: [12000, 4000], dashita: [12000, 3400], total: 15400 });
  await expect(gyou).toContainText("出した時 ¥15,400");
  await page.evaluate(async (co) => {
    const rows = DB.filter((r) => r.会社名 === co);
    await saveInvoiceCopy("2026-05", co, rows, issuerForEngine(co, "2026-05"), "2026-05-01");
    renderPayments();
  }, CO);
  await expect(
    page
      .locator("#payBody .pay-row, #payBody > div")
      .filter({ hasText: CO })
      .first()
      .locator(".pay-sagaku")
  ).toHaveCount(0);
});

// ── 本番前の 対立役（09c3103）の 指摘への 試験 ──
//   ★わざと壊して 赤に なるのを 見た★：直す 前の 版（09c3103）で 下の 4本とも 赤
test("内税で 出してから 外税へ 切り替えた（10-02 夜 より 後に 出した 物）＝知らせる", async ({
  page,
}) => {
  const gyou = await hiraku(page, {
    tm: "外税",
    ima: [12000, 3400],
    dashita: [12000, 3400],
    total: 15400, // 出した 時は 内税＝合計 15,400
    issued: "2026-10-05T03:00:00.000Z",
  });
  await expect(gyou).toContainText("出した時 ¥15,400 → 今 ¥16,940（+¥1,540）");
});

test("額が 減った＝マイナスの 符号・日付は 日本時間（朝 9時 前に 出した 物が 前の 日に ならない）", async ({
  page,
}) => {
  const gyou = await hiraku(page, {
    ima: [12000, 2800],
    dashita: [12000, 3400],
    total: 15400,
    issued: "2026-06-13T23:30:00.000Z", // 日本時間 6/14 8:30
  });
  await expect(gyou).toContainText("6/14 に出した後");
  await expect(gyou).toContainText("出した時 ¥15,400 → 今 ¥14,800（−¥600）");
});

test("出した 時の 明細を 読めなかった＝読めなかったと 出す（「残っていない」と 言わない）", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const t = setInterval(() => {
      const SBx = window.__EXALLY_FAKE_SB__;
      if (!SBx || SBx.__waza) return;
      SBx.__waza = true;
      const moto = SBx.from.bind(SBx);
      SBx.from = function (tbl) {
        const q = moto(tbl);
        if (tbl !== "invoices") return q;
        const sel = q.select.bind(q);
        q.select = function (cols, o) {
          if (String(cols).indexOf("rows_json") >= 0) {
            const bad = {
              order: () => bad,
              range: () => Promise.resolve({ data: null, error: { message: "boom" } }),
            };
            return bad;
          }
          return sel(cols, o);
        };
        return q;
      };
      clearInterval(t);
    }, 0);
  });
  const gyou = await hiraku(page, { ima: [12000, 4000], dashita: [12000, 3400], total: 15400 });
  await gyou.click();
  await expect(page.locator("#modalBody")).toContainText("明細を読めませんでした");
  await expect(page.locator("#modalBody")).not.toContainText("残っていない");
});

test("会社名を 付け替えた 会社＝「残っていない」と 嘘を 言わず 見つからない 訳を 出す", async ({
  page,
}) => {
  const gyou = await hiraku(page, {
    ima: [12000, 4000],
    dashita: [12000, 3400],
    total: 15400,
    bangou: true,
    kyuuMei: "差の試し株式会社（旧名）",
  });
  await gyou.click();
  await expect(page.locator("#modalBody")).toContainText("会社名を変えた月など");
  await expect(page.locator("#modalBody")).not.toContainText("残っていない");
});
