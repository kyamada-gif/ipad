/* 学習の記録の書き出し。**画面が通る道と同じ道**を通す。
     ① 書き出しの画面が開く
     ② 名前とメールを打ちこむと、その場の JSON に入り、端末にも残る
     ③ progress が **10ステージぶん・7項目そろって** 出る
        （端末の中には触った分しか無いので、そのまま出すと歯抜けになる）
     ④ テストに合格すると、そのステージの solo が true になって出る
        ＝ **バッジの有無が読み取れる**。ここが書き出しの目的

   前に「検査が画面と同じ道すじを通っていなくて、永久に解けないバグを見逃した」ので、
   ④ は localStorage を直に書かず、**盤を押して1問ずつ解く。** */
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM, VirtualConsole } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS } = require(path.join(R, "gen.js"));
const B = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map((f) => fs.readFileSync(path.join(R, f), "utf8")).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FIELDS = ["seen", "correct", "lit", "solo", "bestMs", "testBestMs", "lastMs"];

function open(progress, me) {
  /* ファイル保存のリンクを押すと jsdom が「そこへは進めない」と言う。
     **それだけを黙らせる。**ほかの異常はそのまま出す（黙らせすぎると検査の意味が消える） */
  const vc = new VirtualConsole();
  for (const m of ["log", "info", "warn", "error", "debug"]) vc.on(m, (...a) => console[m](...a));
  vc.on("jsdomError", (e) => {
    if (!/Not implemented: navigation/.test(String(e && e.message))) console.error(String(e && e.message));
  });
  const d = new JSDOM(fs.readFileSync(path.join(R, "index.html"), "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/", virtualConsole: vc });
  const w = d.window;
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.scrollTo = () => {}; w.navigator.vibrate = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  // ファイルの保存とコピーは、この仕組みでは動かない。**押せることだけ**見る
  w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
  w.__debug = true;                        // いま出ている問題（__q）を見るため
  if (progress) w.localStorage.setItem("ipcalc2-progress", JSON.stringify(progress));
  if (me) w.localStorage.setItem("ipcalc2-me", me);
  const errs = []; w.addEventListener("error", (e) => errs.push(String(e.message)));
  w.eval(B);
  return {
    w, errs,
    $: (s) => w.document.querySelector(s),
    $$: (s) => [...w.document.querySelectorAll(s)],
    click: (e) => e && e.dispatchEvent(new w.MouseEvent("click", { bubbles: true })),
  };
}

/** 書き出しの画面を開いて、出ている JSON を読む */
async function openExport(h) {
  h.click(h.$$("button").find((b) => b.textContent.includes("書き出す"))); await wait(200);
  if (!h.$(".exp-t")) return null;
  try { return JSON.parse(h.$(".exp-t").value); } catch (e) { return { __bad: e.message }; }
}

/** ステージ1を1問。**loop.js と同じ解き方**（表の回と電卓の回） */
async function answer(h) {
  if (h.w.__q.input === "table") {                      // 桁の重み表を8つともうめる回
    const V = [128, 64, 32, 16, 8, 4, 2, 1];
    for (let c = 0; c < 8; c++) {
      h.click(h.$$(".row8 button.cell")[c]); await wait(20);
      for (const ch of String(V[c])) { h.click(h.$$(".calc .k").find((x) => x.textContent === ch)); await wait(20); }
    }
    h.click(h.$$("button.next")[0]); await wait(120);
    return;
  }
  const want = String(h.w.__q.answer);
  if (h.$(".calc")) {                                   // テスト（表なし・電卓）
    for (const ch of want) { h.click(h.$$(".calc .k").find((x) => x.textContent === ch)); await wait(20); }
  } else {                                              // 練習（盤のマスを押す）
    const cells = h.$$(".sp-row button.sp-c");
    h.click(cells[cells.findIndex((c) => c.textContent.trim() === want)]); await wait(40);
  }
  h.click(h.$$("button.next").find((b) => /決定/.test(b.textContent))); await wait(120);
}

(async () => {
  const why = [];
  const lit = { S0: { seen: 10, correct: 10, lit: true, solo: false } };

  /* ①②③ 画面が開く／名前が入って残る／progress の形 */
  {
    const h = open(lit); await wait(150);
    const d = await openExport(h);
    if (!d) { why.push("書き出しの画面が出ない"); }
    else if (d.__bad) { why.push(`JSON として読めない: ${d.__bad}`); }
    else {
      if (d.app !== "ipcalc2") why.push(`app が ${d.app}`);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(d.exportedAt || "")) {
        why.push(`exportedAt の形が ${d.exportedAt}`);
      }
      // **テストの1回ごとの記録は持たない。**入っていたら、消し忘れ
      if ("tests" in d) why.push("tests が残っている（1回ごとの記録は持たない決まり）");
      // ステージの並び。キーは番号順ではないので、これが無いと受け取った側が名前を出せない
      if ((d.stations || []).map((s) => s.id).join(",") !== STATIONS.map((s) => s.id).join(",")) {
        why.push(`stations の並びが違う（${(d.stations || []).map((s) => s.id).join(",")}）`);
      }
      if ((d.stations || []).some((s) => typeof s.no !== "number" || !s.name)) why.push("stations に番号か名前が無い");

      /* **10ステージぶん、7項目そろって出ているか。**
         端末の中には触った分しか無いので、そのまま出すと歯抜けになる。
         受け取る側が「無いのか、0なのか」を考えずに済むように、ここでそろえている */
      const pk = Object.keys(d.progress || {});
      if (pk.join(",") !== STATIONS.map((s) => s.id).join(",")) {
        why.push(`progress のキーが ${pk.join(",")}（10ステージぶん、並び順で出るはず）`);
      }
      for (const s of STATIONS) {
        const row = (d.progress || {})[s.id] || {};
        const miss = FIELDS.filter((f) => !(f in row));
        if (miss.length) { why.push(`${s.id}: ${miss.join(",")} が無い`); break; }
        for (const f of ["bestMs", "testBestMs", "lastMs"]) {
          if (row[f] !== null && typeof row[f] !== "number") why.push(`${s.id}.${f} が ${row[f]}（数か null のはず）`);
        }
        for (const f of ["lit", "solo"]) {
          if (typeof row[f] !== "boolean") why.push(`${s.id}.${f} が ${row[f]}（true か false のはず）`);
        }
      }
      // まだ触っていないステージも、0 と false と null で埋まっていること
      const zero = (d.progress || {})[STATIONS[STATIONS.length - 1].id] || {};
      if (zero.seen !== 0 || zero.lit !== false || zero.bestMs !== null) {
        why.push(`まだ触っていないステージが ${JSON.stringify(zero)}`);
      }

      // 名前とメールを打ちこむ（画面と同じ道すじ。localStorage を直に書かない）
      const set = (el, v) => {
        Object.getOwnPropertyDescriptor(h.w.HTMLInputElement.prototype, "value").set.call(el, v);
        el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
      };
      const [nm, ml] = h.$$(".fld-i");
      set(nm, "山田太郎"); await wait(60);
      set(ml, "yamada@example.com"); await wait(60);
      const d2 = JSON.parse(h.$(".exp-t").value);
      if (d2.name !== "山田太郎") why.push(`打ちこんでも name が ${d2.name}`);
      if (d2.email !== "yamada@example.com") why.push(`打ちこんでも email が ${d2.email}`);

      /* 端末に残って、次に開いたときも出るか。
         JSDOM は窓ごとに別の入れ物を持つので、残った文字列を新しい窓に持っていって見る */
      const saved = h.w.localStorage.getItem("ipcalc2-me");
      if (!saved || !saved.includes("山田太郎")) why.push(`名前が端末に残っていない（${saved}）`);
      const h2 = open(lit, saved); await wait(150);
      await openExport(h2);
      if (h2.$$(".fld-i")[0].value !== "山田太郎") why.push("残っているのに、次に開いたとき出ない");

      // 渡し方は2つ。押したら何が起きたかが出ること
      const btns = h.$$(".t-go .go").map((b) => b.textContent);
      if (btns.join("/") !== "ファイルに保存/文字をコピー") why.push(`書き出しの入口が ${btns.join("/")}`);
      h.click(h.$$(".t-go .go")[0]); await wait(80);
      if (!h.$(".exp-done")) why.push("ファイルに保存を押しても、何が起きたか出ない");

      console.log(`  ①②③ 画面と形   ${d.stations.length}ステージ／7項目そろい／${h.$(".exp-done").textContent}`);
    }
    if (h.errs.length) why.push(`画面の例外: ${h.errs[0]}`);
  }

  /* ④ **ここが書き出しの目的。**テストに合格したら solo が true で出る */
  {
    const h = open(lit); await wait(150);
    const before = await openExport(h);
    if (before && before.progress.S0.solo !== false) why.push("受ける前から solo が true");
    h.click(h.$(".topbar .x")); await wait(150);

    const t = h.$$(".tile")[0];
    h.click(t.querySelector(".t-h")); await wait(60);
    h.click(t.querySelectorAll(".go")[1]); await wait(200);      // テストへ
    const total = Number((h.$(".pnum") || { textContent: "0/0" }).textContent.split("/")[1]);
    for (let i = 0; i < total; i++) {
      await answer(h);
      h.click(h.$$("button").find((b) => /次へ|結果を見る/.test(b.textContent))); await wait(150);
    }
    await wait(150);
    h.click(h.$$("button").find((b) => b.textContent.includes("トップ画面に戻る"))); await wait(200);

    const after = await openExport(h);
    if (!after) { why.push("テストのあと、書き出しの画面が出ない"); }
    else {
      if (after.progress.S0.solo !== true) why.push(`合格したのに solo が ${after.progress.S0.solo}`);
      if (after.progress.S0.lit !== true) why.push(`合格したのに lit が ${after.progress.S0.lit}`);
      if (typeof after.progress.S0.testBestMs !== "number") why.push(`testBestMs が ${after.progress.S0.testBestMs}`);
      const got = STATIONS.filter((s) => after.progress[s.id].solo).map((s) => s.id);
      console.log(`  ④ バッジ        ${total}問すべて正解 → solo:true のステージ ${got.join(",")}`);
    }
    if (h.errs.length) why.push(`画面の例外: ${h.errs[0]}`);
  }

  if (why.length) { console.error("✗ 学習の記録の書き出し\n  " + why.join("\n  ")); process.exit(1); }
  console.log("✓ 学習の記録：10ステージぶんの progress と、バッジの有無が JSON に出る");
})();
