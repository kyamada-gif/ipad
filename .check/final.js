// 仕上げ（ステージ10）のテストを最後まで解いて、
//   ・15問あるか
//   ・8つの型が一通り出るか
//   ・全部正解で 🏅 が出るか
//   ・1問まちがえると 🏅 が出ないか（合格ラインが 14/15 になっているか）
// を見る。
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS, FINAL_KINDS } = require(path.join(R, "gen.js"));
const B = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map((f) => fs.readFileSync(path.join(R, f), "utf8")).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 仕上げのテストを1回とおす。miss に入れた問番号は、わざと外す。 */
async function run(...miss) {
  const prog = {};
  for (const s of STATIONS) if (s.id !== "SF") prog[s.id] = { seen: 10, correct: 10, lit: true };
  const d = new JSDOM(fs.readFileSync(path.join(R, "index.html"), "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  const w = d.window; w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.scrollTo = () => {}; w.navigator.vibrate = () => {}; w.Element.prototype.scrollIntoView = function () {};
  w.__debug = true; w.localStorage.setItem("ipcalc2-progress", JSON.stringify(prog));
  const errs = []; w.addEventListener("error", (e) => errs.push(String(e.message)));
  w.eval(B); await wait(120);
  const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
  const click = (e) => e && e.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));

  const tile = $$(".tile").find((x) => x.textContent.includes("仕上げの演習"));
  click(tile.querySelector(".t-h")); await wait(60);
  click(tile.querySelector(".go")); await wait(150);        // 「はじめる」→ 説明の1枚
  click($$(".gotest button")[0]); await wait(200);          // 「テストをする」

  const total = Number(($(".pnum") || {}).textContent.split("/")[1]);
  const kinds = [];
  for (let i = 0; i < total + 2 && w.__q; i++) {
    const q = w.__q;
    kinds.push(q.goal);
    // 4択。正解を押す（missAt の回だけ、わざと外れを押す）
    const want = miss.includes(i)
      ? $$(".ch").find((b) => !b.textContent.trim().startsWith(String(q.answer)))
      : $$(".ch").find((b) => b.textContent.trim().startsWith(String(q.answer)));
    if (!want) return { fail: `${i + 1}問目の選択肢が見つからない（答え ${q.answer}）` };
    click(want); await wait(60);
    const dec = $$("button").find((b) => b.textContent === "これで決定");
    if (dec) { click(dec); await wait(120); }
    // 外したときは「もう一度」。**点になるのは最初の答えだけ**なので、
    // ここで正解し直しても 1問まちがえた扱いのまま進む
    const again = $$("button").find((b) => b.textContent.includes("もう一度"));
    if (again) {
      click(again); await wait(120);
      click($$(".ch").find((b) => b.textContent.trim().startsWith(String(q.answer)))); await wait(60);
      const d2 = $$("button").find((b) => b.textContent === "これで決定");
      if (d2) { click(d2); await wait(120); }
    }
    const nx = $$("button").find((b) => /次へ|結果を見る/.test(b.textContent));
    if (!nx) return { fail: `${i + 1}問目で次へ進めない` };
    click(nx); await wait(150);
    if ($(".result")) break;
  }
  await wait(150);
  return { total, kinds, badge: !!$(".rbadge"), score: ($(".rscore") || {}).textContent, errs };
}

(async () => {
  const why = [];
  const a = await run();                         // 全問正解
  if (a.fail) why.push(a.fail);
  else {
    if (a.total !== 15) why.push(`問題数が ${a.total} 問（15問のはず）`);
    const miss = FINAL_KINDS.filter((k) => !a.kinds.includes(k));
    if (miss.length) why.push(`出なかった型: ${miss.join(" ")}`);
    if (!a.badge) why.push(`全問正解なのに 🏅 が出ない（${a.score}）`);
    if (a.errs.length) why.push(`例外: ${a.errs[0]}`);
    console.log(`  全問正解  ${a.score}  🏅${a.badge ? "出た" : "出ない"}  型 ${new Set(a.kinds).size}/${FINAL_KINDS.length}`);
    console.log(`  出た順    ${a.kinds.join(" ")}`);
  }
  const b = await run(2);                        // 3問目だけ わざと外す
  if (b.fail) why.push(b.fail);
  else {
    if (!b.badge) why.push(`1問まちがえただけで 🏅 が出ない（${b.score}／14問で合格のはず）`);
    console.log(`  1問はずす ${b.score}  🏅${b.badge ? "出た" : "出ない"}`);
  }
  // 合格ラインが本当に 14 か。ここを見ないと「いつも 🏅 が出る」でも気づけない
  const c = await run(2, 5);                     // 2問はずす → 13/15
  if (c.fail) why.push(c.fail);
  else {
    if (c.badge) why.push(`2問まちがえたのに 🏅 が出る（${c.score}／14問で合格のはず）`);
    console.log(`  2問はずす ${c.score}  🏅${c.badge ? "出た" : "出ない"}`);
  }
  for (const m of why) console.log("      ↳ " + m);
  console.log(why.length ? `✗ 仕上げのテストに問題` : "✓ 仕上げのテスト：15問・8つの型ぜんぶ・合格ラインも合っている");
})();
