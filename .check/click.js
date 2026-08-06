// 押して落ちないか。**描けるだけでは足りない。**
// ステージ4の盤は「描けるが、押すと真っ白」だった。それを見つけられなかった穴をふさぐ。
// やり方：各ステージの練習で、押せるものを1つずつ押す（毎回まっさらから開き直す）。
//         押したあと、画面に文字が残っているか・エラーが出ていないかを見る。
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS } = require(path.join(R, "gen.js"));
const B = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map((f) => fs.readFileSync(path.join(R, f), "utf8")).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** まっさらな画面を開いて、そのステージの練習1問目まで進める。 */
async function open(stName) {
  const prog = {};
  for (const s of STATIONS) prog[s.id] = { seen: 10, correct: 10, lit: true, solo: true };
  const d = new JSDOM(fs.readFileSync(path.join(R, "index.html"), "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  const w = d.window;
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.scrollTo = () => {}; w.navigator.vibrate = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.__debug = true;
  w.localStorage.setItem("ipcalc2-progress", JSON.stringify(prog));
  const errs = [];
  w.onerror = (m) => errs.push(String(m));
  const con = w.console || {};
  w.console = Object.assign({}, con, { error: (...a) => errs.push(a.join(" ")) });
  w.eval(B); await wait(100);
  const $$ = (s) => [...w.document.querySelectorAll(s)];
  const click = (e) => e && e.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const tile = $$(".tile").find((x) => x.textContent.includes(stName));
  click(tile.querySelector(".t-h")); await wait(40);
  click(tile.querySelectorAll(".go")[0]); await wait(140);
  // 説明の1枚が出たら、そこから練習へ
  if (w.document.querySelector(".sheet-p")) { click($$(".gotest button")[0]); await wait(140); }
  return { w, $$, click, errs };
}

const alive = (w) => (w.document.querySelector("#app") || w.document.body).textContent.replace(/\s+/g, "").length > 20;

(async () => {
  const bad = [];
  for (const st of STATIONS) {
    const probe = await open(st.name);
    if (!alive(probe.w)) { bad.push(`${st.no} ${st.name}: 練習の画面がそもそも出ない`); continue; }
    const n = probe.$$(".box button:not([disabled]), .card button:not([disabled])").length;
    let crashed = 0;
    for (let i = 0; i < n; i++) {
      const { w, $$, click, errs } = await open(st.name);
      const btns = $$(".box button:not([disabled]), .card button:not([disabled])");
      if (!btns[i]) continue;
      const label = (btns[i].textContent || "").replace(/\s+/g, " ").slice(0, 14) || `${i}番目`;
      click(btns[i]); await wait(90);
      if (!alive(w)) { bad.push(`${st.no} ${st.name}: 「${label}」を押すと画面が真っ白`); crashed++; }
      else if (errs.length) { bad.push(`${st.no} ${st.name}: 「${label}」でエラー ${errs[0].slice(0, 60)}`); crashed++; }
      if (crashed >= 2) break;   // 同じ原因が並ぶので、2つ出たら次のステージへ
    }
    console.log(`${String(st.no).padStart(2)} ${st.name}  押せるもの ${n} 個 … ${crashed ? "✕" : "OK"}`);
  }
  if (bad.length) { bad.forEach((x) => console.log("  " + x)); console.log(`✗ ${bad.length} 件`); process.exit(1); }
  console.log("✓ どのステージも、押して落ちるところは無い");
})();
