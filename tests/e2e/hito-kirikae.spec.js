import { test, expect } from "@playwright/test";

// ★2026-11-14 測り（コンサル [45ab77] の候補・odan）★
//   「ログインが切れた後に 別の人が 入ると、前の人の 画面の 中身が 残るか」を 測る。
//   手順＝A で 入る → 鍵を 切る → B で 入る → A の 物が 見えるか。
//   倉庫には 出ない（偽の 倉庫 fake-supabase.js・supabase.co への 通信は 止めて 数える＝0）。
const A_SHA = "Aの会社ヒトキリカエ";

async function open(page) {
  const soto = [];
  await page.route(/supabase\.co/, (route) => {
    soto.push(route.request().url());
    return route.abort();
  });
  await page.route(
    /cdn\.jsdelivr\.net\/npm\/(@supabase\/supabase-js|xlsx-js-style|jszip)@/,
    (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
  );
  page.__errs = [];
  page.on("pageerror", (e) => page.__errs.push(String(e)));
  await page.setViewportSize({ width: 390, height: 850 });
  // 鍵を 切った 後は 開き直しても 勝手に 入り直さない（偽の 倉庫は 既定で A に 自動ログインする）
  await page.addInitScript(() => {
    if (localStorage.getItem("__t_kitta") === "1") window.__FAKE_NO_SESSION__ = true;
  });
  await page.addInitScript({ path: "tests/e2e/fake-supabase.js" });
  return soto;
}

async function kaishaNo(page) {
  return page.locator("#inputCompany option").evaluateAll((os) => os.map((o) => o.value));
}

test("A→鍵切れ→B：B の 画面に A の 会社が 出ない", async ({ page }) => {
  const soto = await open(page);
  await page.goto("/daikou-seikyu.html", { waitUntil: "load" });
  await expect(page.locator("#inputCompany")).toBeAttached();

  // A の 会社を 1つ 置き、端末の 覚え（直近の 会社・最近 使った 順）も A の 物に する
  await page.evaluate((nm) => {
    const db = JSON.parse(localStorage.getItem("__fake_supa_db__"));
    const uid = db.session.user.id;
    db.tables.companies = db.tables.companies || [];
    db.tables.companies.push({
      id: "c-a-1",
      name: nm,
      user_id: uid,
      deleted_at: null,
      created_at: "2026-11-01T00:00:00Z",
      config: {},
      items: [],
    });
    localStorage.setItem("__fake_supa_db__", JSON.stringify(db));
    localStorage.setItem("daiko_lastco_v1", nm);
    localStorage.setItem("daiko_co_recent_v1", JSON.stringify({ [nm]: Date.now() }));
  }, A_SHA);
  await page.reload({ waitUntil: "load" });
  await expect.poll(() => kaishaNo(page)).toContain(A_SHA); // A には 見える（測りの 土台）

  // 鍵を 切る（開き直さない）＝本物の トークン切れ と 同じく 画面には 何の 合図も 届かない
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("__fake_supa_db__"));
    db.session = null;
    localStorage.setItem("__fake_supa_db__", JSON.stringify(db));
    localStorage.setItem("__t_kitta", "1");
    window.__FAKE_NO_SESSION__ = true;
  });
  await page.waitForTimeout(1500);
  const kireteMo = {
    loginDeta: await page.locator("#loginOv").evaluate((el) => el.classList.contains("open")),
    aGaMieru: (await kaishaNo(page)).includes(A_SHA),
  };
  console.log("鍵を 切った 直後（開き直し 無し）:", JSON.stringify(kireteMo));

  // B が 入るには ログイン画面が 要る＝今の 作りでは 開き直し だけ が 道
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("#loginOv")).toHaveClass(/open/);
  await page.fill("#loginEmail", "b-hito@example.com");
  await page.fill("#loginPass", "pass1234");
  await page.click("#btnSignup");
  await expect(page.locator("#loginOv")).not.toHaveClass(/open/);
  await expect(page.locator("#acctLine")).toContainText("b-hito@example.com");

  const bNo = await kaishaNo(page);
  const honbun = await page.locator("body").innerText();
  console.log("B の 会社の 選び:", JSON.stringify(bNo));
  expect(bNo, "B の 会社の 選びに A の 会社が 出た").not.toContain(A_SHA);
  expect(honbun.includes(A_SHA), "B の 画面の 字に A の 会社が 出た").toBe(false);
  expect(await page.locator("#inputCompany").inputValue()).not.toBe(A_SHA);
  expect(soto.length, "倉庫へ 出た").toBe(0);
  expect(page.__errs, "画面の 例外").toEqual([]);
});
