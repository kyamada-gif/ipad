/* 一周する道すじを見る。**ここが通らないと、アプリとして成立していない。**
 *   まっさら → ステージ1だけ開いている（あとは鍵）
 *   練習を5問ぜんぶ解く → ● が付く → 次のステージの鍵が外れる
 *   テストを10問ぜんぶ解く → 🏅 が付く
 *   わざと外すと、その場に手順が出る
 *
 * 前は .check/run.js が見ていたが、あれは**もう無い画面**（暗記ドリル）を前提に
 * 書かれていて落ちたままだった。作りに追いつける大きさで書き直したもの。
 * ステージ1（2の◯乗）で通す。盤の押し方がいちばん単純で、道すじの検査に集中できる。 */
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS, GROUPS } = require(path.join(R, "gen.js"));
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

  /* ① まっさら。ステージ1だけ開いていて、あとは鍵 */
  {
    const h = open(null); await wait(150);
    const lamps = h.$$(".tile .lamp").map((e) => e.textContent);
    if (lamps[0] !== "○") why.push(`まっさら: ステージ1が開いていない（${lamps[0]}）`);
    if (lamps.slice(1).some((x) => x !== "🔒")) why.push(`まっさら: 2つ目から先に鍵がかかっていない（${lamps.join("")}）`);
    // 鍵の札を押すと、何ができれば開くのかが出る
    const t2 = h.$$(".tile")[1];
    h.click(t2.querySelector(".t-h")); await wait(80);
    if (!h.$(".blocked")) why.push("鍵の札を押しても、開く条件が出ない");
    console.log(`  ① まっさら      ${lamps.join("")}   条件の案内:${h.$(".blocked") ? "出る" : "出ない"}`);

    /* まとまりの最後の、押すと開くブロック。**閉じているのが最初の姿。**
       置き場所（基礎の最後の札の下）も、gen.js の GROUPS から見て確かめる */
    const gs = GROUPS.filter((g) => g.tip);
    if (!gs.length) why.push("押すと開くブロックが gen.js に1つも無い");
    const tb = h.$$(".tipb");
    if (tb.length !== gs.length) why.push(`押すと開くブロックが ${tb.length} 個（GROUPS では ${gs.length} 個）`);
    for (const b of tb) {
      if (b.querySelector(".tipb-b")) why.push("押す前から中身が開いている");
      h.click(b.querySelector(".tipb-h")); await wait(60);
      if (!b.querySelector(".tipb-b")) why.push("押しても中身が開かない");
      // 中身が本当に出ているか（枠だけ開いて空、を通さない）
      if (b.querySelectorAll(".tip-r").length === 0) why.push("開いても行が1つも無い");
      h.click(b.querySelector(".tipb-h")); await wait(60);
      if (b.querySelector(".tipb-b")) why.push("もう一度押しても閉じない");
    }
    // 基礎の最後＝ステージ4の札の下に出ているか（札より前や、まとまりの頭に出ていない）
    const kids = [...h.$(".road").children];
    const at = kids.findIndex((k) => k.querySelector(".tipb"));
    const no = at >= 0 ? kids[at].querySelector(".t-name").textContent.trim().split("　")[0] : "無し";
    if (String(no) !== String(gs[0].to)) why.push(`ブロックがステージ ${no} の下（基礎の最後は ${gs[0].to}）`);
    console.log(`  ①' コツのブロック  ${tb.length}個   置き場所:ステージ${no} の下   押すと開く:${why.length ? "NG" : "OK"}`);
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
    if (lamps[1] !== "○") why.push(`次のステージの鍵が外れない（${lamps[1]}）`);
    console.log(`  ② 練習5問      ${score}  → ${lamps.slice(0, 2).join("")}（次のステージが開く）`);
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
  console.log(why.length ? "✗ 一周する道すじに問題" : "✓ 一周する道すじ：鍵 → 練習で ● → 次が開く → テストで 🏅 → 外すと ✕ と答え");
  if (why.length) process.exit(1);
})();
