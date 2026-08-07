/* 一周する道すじを見る。**ここが通らないと、アプリとして成立していない。**
 *   まっさら → **10ステージとも開いている（鍵は無い）。**いきなりテストにも入れる
 *   練習を5問ぜんぶ解く → ● が付く
 *   テストを10問ぜんぶ解く → 🏅 が付く
 *   わざと外すと、その場に手順が出る
 *
 * 前は .check/run.js が見ていたが、あれは**もう無い画面**（暗記ドリル）を前提に
 * 書かれていて落ちたままだった。作りに追いつける大きさで書き直したもの。
 * ステージ1（2の◯乗）で通す。盤の押し方がいちばん単純で、道すじの検査に集中できる。 */
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS } = require(path.join(R, "gen.js"));
const B = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map((f) => fs.readFileSync(path.join(R, f), "utf8")).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function open(progress) {
  const d = new JSDOM(fs.readFileSync(path.join(R, "index.html"), "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  const w = d.window; w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.scrollTo = () => {}; w.navigator.vibrate = () => {}; w.Element.prototype.scrollIntoView = function () {};
  w.__debug = true;
  if (progress) w.localStorage.setItem("ipcalc2-progress", JSON.stringify(progress));
  const errs = []; w.addEventListener("error", (e) => errs.push(String(e.message)));
  w.eval(B);
  return {
    w, errs,
    $: (s) => w.document.querySelector(s),
    $$: (s) => [...w.document.querySelectorAll(s)],
    click: (e) => e && e.dispatchEvent(new w.MouseEvent("click", { bubbles: true })),
  };
}

/** ステージ1を1問解く。miss なら わざと外す。
 *  練習は盤のマスを押す。**テストは表が消えて電卓になる**ので、数字を打つ。 */
async function answer(h, miss) {
  const want = String(h.w.__q.answer);
  if (h.$(".calc")) {                                   // テスト（表なし・電卓）
    const v = miss ? String(Number(want) + 1) : want;
    for (const ch of v) {
      const k = h.$$(".calc .k").find((x) => x.textContent === ch);
      if (!k) return `電卓に ${ch} のキーが無い`;
      h.click(k); await wait(20);
    }
  } else {                                              // 練習（盤のマスを押す）
    const cells = h.$$(".sp-row button.sp-c");
    const idx = cells.findIndex((c) => c.textContent.trim() === want);
    if (idx < 0) return `答え ${want} のマスが無い`;
    h.click(cells[miss ? (idx + 1) % cells.length : idx]); await wait(40);
  }
  const dec = h.$$("button.next").find((b) => /決定/.test(b.textContent));
  if (!dec) return "決定ボタンが無い";
  h.click(dec); await wait(120);
  return null;
}
/** 結果の画面からトップへ戻る。 */
async function toHome(h) {
  h.click(h.$$("button").find((b) => b.textContent.includes("トップ画面に戻る")));
  await wait(250);
}

(async () => {
  const why = [];

  /* ① まっさら。**鍵は無い。**10ステージとも ○ で、どれも押すと2つの入口が出る */
  {
    const h = open(null); await wait(150);
    const lamps = h.$$(".tile .lamp").map((e) => e.textContent);
    if (lamps.length !== STATIONS.length) why.push(`札が ${lamps.length} 枚`);
    if (lamps.some((x) => x !== "○")) why.push(`まっさらなのに ○ でない札がある（${lamps.join("")}）`);
    if (h.$$(".tile.locked").length) why.push("鍵のかかった札が残っている");
    // まっさらでも、最後のステージから始められる（練習もテストも押せる）
    const last = h.$$(".tile")[STATIONS.length - 1];
    h.click(last.querySelector(".t-h")); await wait(80);
    const go = [...last.querySelectorAll(".t-go .go")].map((b) => b.textContent);
    if (!go.length) why.push("まっさらだと、最後のステージの入口が出ない");
    console.log(`  ① まっさら      ${lamps.join("")}   最後のステージの入口:${go.join("/") || "無し"}`);

    // 1つ目のステージも、練習を1回もやらずにテストへ入れる
    const t1 = h.$$(".tile")[0];
    h.click(t1.querySelector(".t-h")); await wait(80);
    const go1 = [...t1.querySelectorAll(".t-go .go")].map((b) => b.textContent);
    if (go1.join("/") !== "練習をする/テストをする") why.push(`ステージ1の入口が ${go1.join("/")}`);
    h.click([...t1.querySelectorAll(".t-go .go")][1]); await wait(200);
    if (!h.$(".play")) why.push("まっさらなのに、テストに入れない");
    console.log(`  ①' いきなりテスト  入口:${go1.join("/")}   入れる:${h.$(".play") ? "OK" : "NG"}`);
  }

  /* ①'' コツは、札の中で開く。**押しどころが二重になっていないか**も見る */
  {
    const ts = STATIONS.filter((s) => s.tip);
    if (!ts.length) why.push("コツを持つステージが gen.js に1つも無い");
    const h = open(null); await wait(150);
    const btns = h.$$(".t-tip");
    if (btns.length !== ts.length) why.push(`コツのボタンが ${btns.length} 個（gen.js では ${ts.length} 個）`);
    for (const st of ts) {
      const card = h.$$(".tile").find((t) => t.textContent.includes(st.name));
      const top = card.querySelector(".t-top");
      const kids = [...top.children].map((e) => e.className.split(" ")[0]);
      // 上の段は 名前の押しどころ → バッジ。ボタンはその下の行
      if (kids.join(">") !== "t-h>slot") why.push(`${st.name}: 上の段の並びが ${kids.join(">")}`);
      const rows = [...card.children].map((e) => e.className.split(" ")[0]);
      if (rows[0] !== "t-top" || rows[1] !== "t-tip") why.push(`${st.name}: 札の中の並びが ${rows.join(">")}`);
      // 押しどころの入れ子（ボタンの中のボタン）は、押しても反応しない場所を作る
      if (card.querySelector("button button")) why.push(`${st.name}: 押しどころが入れ子になっている`);
      const b = card.querySelector(".t-tip");
      if (card.querySelector(".tipb-b")) why.push(`${st.name}: 押す前から中身が開いている`);
      h.click(b); await wait(60);
      if (!card.querySelector(".tipb-b")) why.push(`${st.name}: 押しても中身が開かない`);
      if (card.querySelectorAll(".tip-r").length === 0) why.push(`${st.name}: 開いても行が1つも無い`);
      // コツを開いても、札そのものは開かない（練習・テストの入口は出てこない）
      if (card.querySelector(".t-go")) why.push(`${st.name}: コツを押したら札まで開いた`);
      h.click(b); await wait(60);
      if (card.querySelector(".tipb-b")) why.push(`${st.name}: もう一度押しても閉じない`);
    }
    if (h.errs.length) why.push(`画面の例外: ${h.errs[0]}`);
    console.log(`  ①'' コツのボタン  ${btns.length}個   名前の下の行   押すと札の中で開く:${why.length ? "NG" : "OK"}`);
  }

  /* ② 練習を5問。● が付いて、次のステージの鍵が外れる */
  {
    const h = open(null); await wait(150);
    const t = h.$$(".tile")[0];
    h.click(t.querySelector(".t-h")); await wait(60);
    h.click(t.querySelector(".go")); await wait(150);        // 説明の1枚
    h.click(h.$$(".gotest button")[0]); await wait(180);      // 練習へ
    const total = Number((h.$(".pnum") || { textContent: "0/0" }).textContent.split("/")[1]);
    if (total !== 5) why.push(`練習が ${total} 問（5問のはず）`);
    for (let i = 0; i < total; i++) {
      const e = await answer(h, false); if (e) { why.push(`練習${i + 1}問目: ${e}`); break; }
      h.click(h.$$("button").find((b) => /次へ|結果を見る/.test(b.textContent))); await wait(150);
    }
    await wait(150);
    const score = (h.$(".rscore") || {}).textContent;
    await toHome(h);
    const lamps = h.$$(".tile .lamp").map((e) => e.textContent);
    if (lamps[0] !== "●") why.push(`練習を全問正解しても ● が付かない（${lamps[0]}／${score}）`);
    // 鍵は無いので、ほかの札は ○ のまま（練習しても勝手に印は付かない）
    if (lamps.slice(1).some((x) => x !== "○")) why.push(`ほかの札の印が変わっている（${lamps.join("")}）`);
    console.log(`  ② 練習5問      ${score}  → ${lamps.join("")}`);
  }

  /* ③ テストを10問。🏅 が付く */
  {
    const h = open({ S0: { seen: 5, correct: 5, lit: true } }); await wait(150);
    const t = h.$$(".tile")[0];
    h.click(t.querySelector(".t-h")); await wait(60);
    h.click(t.querySelectorAll(".go")[1]); await wait(200);   // テストへ
    const total = Number((h.$(".pnum") || { textContent: "0/0" }).textContent.split("/")[1]);
    if (total !== 10) why.push(`テストが ${total} 問（10問のはず）`);
    for (let i = 0; i < total; i++) {
      // 1問目は「桁の重み表を8つともうめる」。中身は .check/table.js が見ている
      if (h.w.__q.input === "table") {
        // eslint-disable-next-line
        const V = [128, 64, 32, 16, 8, 4, 2, 1];
        for (let c = 0; c < 8; c++) {
          h.click(h.$$(".row8 button.cell")[c]); await wait(20);
          for (const ch of String(V[c])) { h.click(h.$$(".calc .k").find((x) => x.textContent === ch)); await wait(20); }
        }
        h.click(h.$$("button.next")[0]); await wait(120);
      } else {
        const e = await answer(h, false); if (e) { why.push(`テスト${i + 1}問目: ${e}`); break; }
      }
      h.click(h.$$("button").find((b) => /次へ|結果を見る/.test(b.textContent))); await wait(150);
    }
    await wait(150);
    const score = (h.$(".rscore") || {}).textContent, badge = !!h.$(".rbadge");
    if (!badge) why.push(`テストを全問正解しても 🏅 が出ない（${score}）`);
    console.log(`  ③ テスト10問   ${score}  🏅${badge ? "出た" : "出ない"}`);
  }

  /* ④ 外すと、その場に手順が出る */
  {
    const h = open(null); await wait(150);
    const t = h.$$(".tile")[0];
    h.click(t.querySelector(".t-h")); await wait(60);
    h.click(t.querySelector(".go")); await wait(150);
    h.click(h.$$(".gotest button")[0]); await wait(180);
    await answer(h, true);
    const ng = (h.$(".dhead") || {}).textContent || "";
    const ans = !!h.$(".j-ans");
    if (!ng.includes("不正解")) why.push(`外したのに ✕ が出ない（${ng}）`);
    if (!ans) why.push("外したのに、正しい答えが出ない");
    // 丸暗記のステージ（memorize）は手順を出さない。答えだけでよい
    console.log(`  ④ わざと外す   ${ng.trim()}  答えの案内:${ans ? "出る" : "出ない"}`);
  }

  for (const m of why) console.log("      ↳ " + m);
  console.log(why.length ? "✗ 一周する道すじに問題" : "✓ 一周する道すじ：鍵なしで全部開く → 練習で ● → テストで 🏅 → 外すと ✕ と答え");
  if (why.length) process.exit(1);
})();
