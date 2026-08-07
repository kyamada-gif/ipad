/* 学習の記録の書き出し。**画面が通る道と同じ道**を通す。
     ① テストを1回、最後まで解く → 記録が1行増える（点・型ごとの正誤が入る）
     ② 途中でやめた回は増えない（何問中何問だったのか言えないので、残すと嘘になる）
     ③ 練習の回は増えない（テストの行が埋もれる）
     ④ 書き出しの画面が、いまの記録どおりの JSON を出す

   前に「検査が画面と同じ道すじを通っていなくて、永久に解けないバグを見逃した」ので、
   ここも localStorage を直に書かず、**盤を押して1問ずつ解く。** */
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM, VirtualConsole } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS } = require(path.join(R, "gen.js"));
const B = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map((f) => fs.readFileSync(path.join(R, f), "utf8")).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
    tests: () => { try { return JSON.parse(w.localStorage.getItem("ipcalc2-tests")) || []; } catch (e) { return []; } },
  };
}

/** ステージ1を1問。miss なら わざと外す。**loop.js と同じ解き方**（表の回と電卓の回） */
async function answer(h, miss) {
  if (h.w.__q.input === "table") {                      // 桁の重み表を8つともうめる回
    const V = [128, 64, 32, 16, 8, 4, 2, 1];
    for (let c = 0; c < 8; c++) {
      h.click(h.$$(".row8 button.cell")[c]); await wait(20);
      const v = miss && c === 0 ? String(V[c] + 1) : String(V[c]);
      for (const ch of v) { h.click(h.$$(".calc .k").find((x) => x.textContent === ch)); await wait(20); }
    }
    h.click(h.$$("button.next")[0]); await wait(120);
    return;
  }
  const want = String(h.w.__q.answer);
  if (h.$(".calc")) {                                   // テスト（表なし・電卓）
    for (const ch of (miss ? String(Number(want) + 1) : want)) {
      h.click(h.$$(".calc .k").find((x) => x.textContent === ch)); await wait(20);
    }
  } else {                                              // 練習（盤のマスを押す）
    const cells = h.$$(".sp-row button.sp-c");
    const idx = cells.findIndex((c) => c.textContent.trim() === want);
    h.click(cells[miss ? (idx + 1) % cells.length : idx]); await wait(40);
  }
  h.click(h.$$("button.next").find((b) => /決定/.test(b.textContent))); await wait(120);
}

/** ステージ1を、テスト（表なし）か練習で一周する。missAt は わざと外す問題の番号 */
async function run(h, test, missAt) {
  const t = h.$$(".tile")[0];
  h.click(t.querySelector(".t-h")); await wait(60);
  h.click(t.querySelectorAll(".go")[test ? 1 : 0]); await wait(200);
  if (!test) { h.click(h.$$(".gotest button")[0]); await wait(200); }
  const total = Number((h.$(".pnum") || { textContent: "0/0" }).textContent.split("/")[1]);
  for (let i = 0; i < total; i++) {
    await answer(h, i === missAt);
    /* **正解するまで次へ進まない**のは、練習でもテストでも同じ決まり。
       外した回は「もう一度」が出るので、押し直して正解してから次へ行く。
       点になるのは最初の答えだけなので、ここで直しても記録は 外したまま。 */
    if (i === missAt) {
      h.click(h.$$("button.next").find((b) => /もう一度/.test(b.textContent))); await wait(150);
      await answer(h, false);
    }
    h.click(h.$$("button").find((b) => /次へ|結果を見る/.test(b.textContent))); await wait(150);
  }
  await wait(150);
  h.click(h.$$("button").find((b) => b.textContent.includes("トップ画面に戻る"))); await wait(200);
  return total;
}

(async () => {
  const why = [];
  const lit = { S0: { seen: 10, correct: 10, lit: true, solo: false } };

  /* ① テストを最後まで。1行増えて、点と型ごとの正誤が入っているか */
  {
    const h = open(lit); await wait(150);
    if (h.tests().length) why.push("まっさらなのに記録がある");
    const total = await run(h, true, 3);            // 4問目だけ わざと外す
    const t = h.tests();
    if (t.length !== 1) { why.push(`テスト1回で記録が ${t.length} 行`); }
    else {
      const r = t[0];
      if (r.station !== "S0") why.push(`station が ${r.station}`);
      if (r.total !== total) why.push(`total が ${r.total}（解いたのは ${total} 問）`);
      if (r.correct !== total - 1) why.push(`correct が ${r.correct}（1問だけ外したので ${total - 1} のはず）`);
      if (r.passed !== (r.correct >= Math.ceil(total * 0.9))) why.push(`passed が ${r.passed}`);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(r.at)) why.push(`日時の形が ${r.at}`);
      if (typeof r.avgMs !== "number") why.push(`avgMs が ${r.avgMs}`);
      // 型ごとの正誤。足すと全体の点になっていること
      const sum = Object.values(r.byKind || {}).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
      if (sum[0] !== r.correct || sum[1] !== r.total) {
        why.push(`型ごとの合計 ${sum.join("/")} が、全体 ${r.correct}/${r.total} と合わない`);
      }
      console.log(`  ① テスト1回   ${r.correct}/${r.total} ${r.passed ? "合格" : "не"}  型:${Object.keys(r.byKind).join(",")}  ${r.at}`);
    }
    if (h.errs.length) why.push(`画面の例外: ${h.errs[0]}`);
  }

  /* ② 途中でやめた回は残さない ／ ③ 練習の回も残さない */
  {
    const h = open(lit); await wait(150);
    const t = h.$$(".tile")[0];
    h.click(t.querySelector(".t-h")); await wait(60);
    h.click(t.querySelectorAll(".go")[1]); await wait(200);
    await answer(h, false);                          // 1問だけ解いて
    h.click(h.$(".topbar .x")); await wait(150);      // 途中でやめる
    if (h.tests().length) why.push(`途中でやめた回が残っている（${h.tests().length} 行）`);
    console.log(`  ② 途中でやめる  記録:${h.tests().length} 行`);

    await run(h, false, null);                        // 練習を一周
    if (h.tests().length) why.push(`練習の回が残っている（${h.tests().length} 行）`);
    console.log(`  ③ 練習を一周    記録:${h.tests().length} 行`);
  }

  /* ④ 書き出しの画面。いまの記録どおりの JSON が出るか */
  {
    const h = open(lit); await wait(150);
    await run(h, true, null);                         // 全問正解で1行
    h.click(h.$$("button").find((b) => b.textContent.includes("書き出す"))); await wait(200);
    if (!h.$(".exp-t")) { why.push("書き出しの画面が出ない"); }
    else {
      // 名前とメールを打ちこむ（画面と同じ道すじ。localStorage を直に書かない）
      const set = (el, v) => {
        const p = Object.getOwnPropertyDescriptor(h.w.HTMLInputElement.prototype, "value");
        p.set.call(el, v);
        el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
      };
      const [nm, ml] = h.$$(".fld-i");
      set(nm, "山田太郎"); await wait(60);
      set(ml, "yamada@example.com"); await wait(60);

      let d = null;
      try { d = JSON.parse(h.$(".exp-t").value); } catch (e) { why.push(`JSON として読めない: ${e.message}`); }
      if (d) {
        if (d.app !== "ipcalc2") why.push(`app が ${d.app}`);
        if (d.name !== "山田太郎") why.push(`name が ${d.name}`);
        if (d.email !== "yamada@example.com") why.push(`email が ${d.email}`);
        if (!/^\d{4}-\d{2}-\d{2}T/.test(d.exportedAt || "")) why.push(`exportedAt が ${d.exportedAt}`);
        // ステージの並びが、gen.js のとおり入っているか（受け取った側が名前を出せる）
        if ((d.stations || []).map((s) => s.id).join(",") !== STATIONS.map((s) => s.id).join(",")) {
          why.push(`stations の並びが違う（${(d.stations || []).map((s) => s.id).join(",")}）`);
        }
        if (!d.progress || !d.progress.S0) why.push("progress が入っていない");
        if ((d.tests || []).length !== 1) why.push(`tests が ${(d.tests || []).length} 行`);
        /* 打ちこんだ名前が、端末に残って、次に開いたときも出るか。
           JSDOM は窓ごとに別の入れ物を持つので、残った文字列を新しい窓に持っていって見る */
        const saved = h.w.localStorage.getItem("ipcalc2-me");
        if (!saved || !saved.includes("山田太郎")) why.push(`名前が端末に残っていない（${saved}）`);
        const h2 = open(lit, saved); await wait(150);
        h2.click(h2.$$("button").find((b) => b.textContent.includes("書き出す"))); await wait(200);
        if (h2.$$(".fld-i")[0].value !== "山田太郎") why.push("残っているのに、次に開いたとき出ない");
        // 保存とコピーのボタンが押せるか（実際の保存はこの仕組みでは動かない）
        const btns = h.$$(".t-go .go").map((b) => b.textContent);
        if (btns.join("/") !== "ファイルに保存/文字をコピー") why.push(`書き出しの入口が ${btns.join("/")}`);
        h.click(h.$$(".t-go .go")[0]); await wait(80);
        if (!h.$(".exp-done")) why.push("ファイルに保存を押しても、何が起きたか出ない");
        console.log(`  ④ 書き出し     ${d.stations.length}ステージ／tests ${d.tests.length}行／${h.$(".exp-done").textContent}`);
      }
    }
    if (h.errs.length) why.push(`画面の例外: ${h.errs[0]}`);
  }

  if (why.length) { console.error("✗ 学習の記録の書き出し\n  " + why.join("\n  ")); process.exit(1); }
  console.log("✓ 学習の記録：テストだけが1行ずつ積まれ、そのとおりの JSON が出る");
})();
