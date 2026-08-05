// ステージ5のテスト（前半＝手順テスト）が、手順どおり押すと正解になるか
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS } = require(path.join(R, "gen.js"));
const B = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map((f) => fs.readFileSync(path.join(R, f), "utf8")).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W8 = [128, 64, 32, 16, 8, 4, 2, 1];
(async () => {
  let ng = 0, n = 0;
  for (let t = 0; t < 4; t++) {
    const prog = {}; for (const s of STATIONS) prog[s.id] = { seen: 10, correct: 10, lit: true, solo: true };
    const d = new JSDOM(fs.readFileSync(path.join(R, "index.html"), "utf8"),
      { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
    const w = d.window; w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    w.scrollTo = () => {}; w.navigator.vibrate = () => {}; w.Element.prototype.scrollIntoView = function () {};
    w.__debug = true; w.localStorage.setItem("ipcalc2-progress", JSON.stringify(prog));
    w.eval(B); await wait(120);
    const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
    const click = (e) => e && e.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    const st = STATIONS.find((x) => x.id === "S3");
    const tile = $$(".tile").find((x) => x.textContent.includes(st.name));
    click(tile.querySelector(".t-h")); await wait(50);
    click(tile.querySelectorAll(".go")[1]); await wait(150);   // テストへ
    const q = w.__q; n++;
    if (!q.steps5) { ng++; console.log("1問目が手順テストになっていない"); continue; }
    let bad = "";
    for (const round of q.steps5) {
      // 正解の手順を選ぶ
      const opt = $$(".ch").find((c) => c.textContent.trim() === round.ok);
      if (!opt) { bad = `選択肢に正解が無い（${round.ok}）`; break; }
      click(opt); await wait(60);
      // その処理をやる
      if (round.kind === "oct") { click($$("button.oct")[round.want]); await wait(40); }
      else {
        for (let i = 0; i < 8; i++) if (round.want & W8[i]) { click($$(".row8 button.cell")[i]); await wait(15); }
      }
      click($$("button").find((b) => b.textContent.includes("できた"))); await wait(60);
      if (round.kind === "fill") {
        // ぜんぶ 1 の番
        const cur = $$(".row8 button.cell");
        for (let i = 0; i < 8; i++) {
          const on = cur[i].className.includes(" on");
          const want = !!(round.want2 & W8[i]);
          if (on !== want) { click(cur[i]); await wait(15); }
        }
        click($$("button").find((b) => b.textContent.includes("できた"))); await wait(60);
      }
    }
    if (bad) { ng++; console.log(bad); continue; }
    // 最後の4択
    const ch = $$(".ch").find((c) => c.textContent.trim() === String(q.answer));
    if (!ch) { ng++; console.log("最後の4択に正解が無い"); continue; }
    click(ch); await wait(40);
    click($$("button").find((b) => b.textContent.includes("これで決定"))); await wait(120);
    if (!$(".dhead.ok")) { ng++; console.log(`手順どおり進めたのに正解にならない（${$(".dhead") ? $(".dhead").textContent : "判定なし"}）`); }
  }
  console.log(ng ? `✗ ${n}問中 ${ng}問 が通らない` : `✓ ${n}問すべて、手順どおり進めて正解になった`);

  // 途中で1回外したら、最後に正解を選んでも ✕ になるか
  {
    const prog = {}; for (const s of STATIONS) prog[s.id] = { seen: 10, correct: 10, lit: true, solo: true };
    const d = new JSDOM(fs.readFileSync(path.join(R, "index.html"), "utf8"),
      { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
    const w = d.window; w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    w.scrollTo = () => {}; w.navigator.vibrate = () => {}; w.Element.prototype.scrollIntoView = function () {};
    w.__debug = true; w.localStorage.setItem("ipcalc2-progress", JSON.stringify(prog));
    w.eval(B); await wait(120);
    const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
    const click = (e) => e && e.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    const st = STATIONS.find((x) => x.id === "S3");
    const tile = $$(".tile").find((x) => x.textContent.includes(st.name));
    click(tile.querySelector(".t-h")); await wait(50);
    click(tile.querySelectorAll(".go")[1]); await wait(150);
    const q = w.__q;
    // 1つ目の手順で、わざと外れを選ぶ → その場でミス判定になり、次の問題へ行けるはず
    const wrong = $$(".ch").find((c) => c.textContent.trim() !== q.steps5[0].ok);
    click(wrong); await wait(150);
    console.log($(".dhead.ng") ? "  外した手順に ✕ が出た" : "  ✗ ✕ が出ない");
    const rt = $$("button").find((b) => b.textContent.includes("もう一度"));
    console.log(rt ? "  「もう一度」が出た" : "  ✗ もう一度 が出ない");
    if (rt) {
      const before = w.__q;
      click(rt); await wait(120);
      console.log(w.__q === before ? "  同じ問題のまま（そのフェーズだけやり直し）" : "  ✗ 問題が変わった");
      console.log($$(".ch").length === 4 && !$(".dhead") ? "  手順を選び直せる" : "  ✗ 選び直せない");
    }
    // 選び直して最後まで進めると、途中で外したぶん ✕ になる
    for (const round of q.steps5) {
      click($$(".ch").find((c) => c.textContent.trim() === round.ok)); await wait(60);
      if (round.kind === "oct") { click($$("button.oct")[round.want]); await wait(40); }
      else for (let i = 0; i < 8; i++) if (round.want & W8[i]) { click($$(".row8 button.cell")[i]); await wait(15); }
      click($$("button").find((b) => b.textContent.includes("できた"))); await wait(60);
      if (round.kind === "fill") {
        const cur = $$(".row8 button.cell");
        for (let i = 0; i < 8; i++) {
          const on = cur[i].className.includes(" on"), want = !!(round.want2 & W8[i]);
          if (on !== want) { click(cur[i]); await wait(15); }
        }
        click($$("button").find((b) => b.textContent.includes("できた"))); await wait(60);
      }
    }
    click($$(".ch").find((c) => c.textContent.trim() === String(q.answer))); await wait(40);
    click($$("button").find((b) => b.textContent.includes("これで決定"))); await wait(150);
    const m2 = $(".dhead") ? $(".dhead").textContent : "";
    console.log(m2.includes("とちゅう") ? "  最後まで進めても ✕ とちゅうでまちがえました" : `  ✗ 判定が違う（${m2}）`);
  }
})();
