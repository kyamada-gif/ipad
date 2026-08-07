/* ステージ4の②（サブネットマスク → プレフィックス長）を、画面と同じ手つきで解く。
   見るのは **答えの /◯ が、どこから出てくるか画面に出ているか**。

   前はここが抜けていた。盤の「1 の数」が 8 16 24 32 の動かない目盛りで、
   押しても変わらず、②のあと いきなり「プレフィックス長 /28」が出ていた。
   手順（gen.js の steps）も toMask 向きしか無く、この向きでも
   「/28 なら 1 が 28個」から始めていた ＝ **答えから逆算していた。** */
const path = require("path"), fs = require("fs");
const R = path.join(__dirname, "..");
const { JSDOM } = require(path.join(R, ".check/node_modules/jsdom"));
const { STATIONS, GEN, onesPerOctet } = require(path.join(R, "gen.js"));
const B = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map((f) => fs.readFileSync(path.join(R, f), "utf8")).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 画面を1つ立ち上げて、ステージ4の説明の1枚（やってみる）まで進める */
async function open() {
  const prog = {}; for (const s of STATIONS) prog[s.id] = { seen: 10, correct: 10, lit: true, solo: true };
  const d = new JSDOM(fs.readFileSync(path.join(R, "index.html"), "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  const w = d.window;
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.scrollTo = () => {}; w.navigator.vibrate = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.localStorage.setItem("ipcalc2-progress", JSON.stringify(prog));
  const errs = []; w.addEventListener("error", (e) => errs.push(String(e.message)));
  w.eval(B); await wait(120);
  const h = {
    w, errs,
    $: (s) => w.document.querySelector(s),
    $$: (s) => [...w.document.querySelectorAll(s)],
    click: (e) => e && e.dispatchEvent(new w.MouseEvent("click", { bubbles: true })),
  };
  const st = STATIONS.find((s) => s.id === "S8");
  const tile = h.$$(".tile").find((t) => t.textContent.includes(st.name));
  h.click(tile.querySelector(".t-h")); await wait(60);
  h.click(tile.querySelector(".go")); await wait(140);
  return h;
}

/** 1回ぶん。problem は毎回ちがうので、余りのある回・無い回の両方が出るまで回す */
async function once(why) {
  const h = await open();

  /* 説明の1枚の「やってみる」は2つ。②がマスク → プレフィックス長 */
  const boxes = h.$$(".box");
  if (boxes.length !== 2) why.push(`やってみるの盤が ${boxes.length} 個（ステージ4は2つ）`);
  const box = boxes[1];
  const oct = [...box.querySelectorAll(".dots .oct")];
  const maskText = box.textContent;

  // 問われているマスクを、画面の材料の枠から読む
  const given = h.$$(".given .gv")[1] || h.$$(".given .gv")[0];
  const mask = (given ? given.textContent : "").trim();
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(mask)) why.push(`②の問いがマスクになっていない（${mask}）`);
  const ones = onesPerOctet(mask);
  const len = ones.reduce((a, b) => a + b, 0);

  /* 押す前は「1 の数」が空。**押していないのに数が出ていると、考える前に答えが見える** */
  const before = [...box.querySelectorAll(".ticks .tick")].map((e) => e.textContent).join("");
  if (before.trim() !== "") why.push(`押す前から 1 の数が出ている（${before}）`);

  /* ① 255 のオクテットを、左から順に押す */
  const full = ones.filter((n) => n === 8).length;
  for (let i = 0; i < full; i++) { h.click(oct[i]); await wait(40); }

  /* ② 255 でないオクテットを 1 と 0 で作る */
  const rest = ones[full] || 0;
  if (rest) {
    const cells = [...box.querySelectorAll(".split .sp-row button.sp-c")];
    if (cells.length !== 8) why.push(`②のマスが ${cells.length} 個`);
    for (let i = 0; i < rest; i++) { h.click(cells[i]); await wait(40); }
  }

  /* ここからが本題。**オクテットごとの 1 の数が、オクテットの真下に出ているか** */
  const ticks = [...box.querySelectorAll(".ticks .tick")].map((e) => e.textContent.trim());
  if (ticks.join(",") !== ones.join(",")) {
    why.push(`1 の数の並びが ${ticks.join(",")}（マスク ${mask} は ${ones.join(",")}）`);
  }
  const on = box.querySelectorAll(".ticks .tick.on").length;
  if (on !== full + (rest ? 1 : 0)) why.push(`数えたオクテットの印が ${on} 個（${full + (rest ? 1 : 0)} 個のはず）`);

  /* 上の並びの合計が、名前つきで出ているか。**ここが無いと、答えの /◯ が急に現れる。**
     青い式（.o-x）で出すと、②の「128 ＋ 64 … ＝ 240」と見分けが付かなくなるので、
     合計は .o-n（灰の名前 ＋ 大きい数）で出す約束にしてある */
  const sums = [...box.querySelectorAll(".out .o-n")].map((e) => e.textContent.replace(/\s/g, ""));
  if (!sums.some((s) => s.includes("1の数を全部足すと") && s.endsWith(String(len)))) {
    why.push(`1 の数の合計が出ていない（欲しいのは ${len} ／ 出ているのは ${sums.join(" ／ ") || "無し"}）`);
  }
  // 同じ数の並びを、青い式でもう1本出していないか（真上の行の繰り返しになる）
  const blues = [...box.querySelectorAll(".out .o-x")].map((e) => e.textContent.replace(/\s/g, ""));
  if (blues.some((s) => s === ones.join("＋") + "＝" + len)) why.push("1 の数の足し算が、青い式でも重ねて出ている");

  /* 答えの行が、その合計と同じか */
  const ans = box.querySelector(".derive .d-r.ans");
  if (!ans) why.push("答えの行に印が付いていない");
  else if (!ans.textContent.includes(`/${len}`)) why.push(`答えの行が ${ans.textContent}（/${len} のはず）`);

  /* 解けるか（決定を押して正解になるか） */
  const dec = [...box.querySelectorAll("button.next")].find((b) => /決定/.test(b.textContent));
  h.click(dec); await wait(120);
  const ok = box.textContent.includes("正解") || h.$(".sheet-p").textContent.includes("正解");

  if (!ok) why.push(`マスク ${mask}: 正しく操作しても正解にならない`);
  console.log(`  マスク ${mask}   1の数 ${ticks.join(" ＋ ")} ＝ ${len}   式:${sums.length ? "出る" : "出ない"}   答え:/${len}   ${ok ? "正解" : "正解にならない"}`);
  if (h.errs.length) why.push(`画面の例外: ${h.errs[0]}`);
  return rest;
}

(async () => {
  const why = [];
  // 余りのある回（/28 など）と、無い回（/24 など）の両方を必ず通す
  let sawRest = false, sawFlat = false;
  for (let i = 0; i < 14 && !(sawRest && sawFlat); i++) {
    const rest = await once(why);
    if (rest) sawRest = true; else sawFlat = true;
  }
  if (!sawRest) why.push("余りのあるマスク（255 でないオクテットがある回）を1度も引けなかった");
  if (!sawFlat) why.push("余りの無いマスク（255 と 0 だけの回）を1度も引けなかった");

  /* 手順（間違えたときに出るやつ）も、この向きの道すじになっているか。
     **答えの /◯ から始まっていたら、逆算している** */
  for (let i = 0; i < 60; i++) {
    const q = GEN.S8(0.9, "toLen");
    const first = q.steps[0].t + q.steps[0].v;
    if (first.includes(`/${q.board.len}`)) {
      why.push(`手順が答えから始まっている（${first}）`); break;
    }
    const sum = q.steps.find((s) => s.v.includes("＋") && s.v.includes(`＝ ${q.board.len}`));
    if (!sum) { why.push(`手順に「オクテットごとに足す」が無い（/${q.board.len}）`); break; }
  }

  if (why.length) { console.error("✗ ステージ4の②\n  " + why.join("\n  ")); process.exit(1); }
  console.log("✓ ステージ4の②：答えの /◯ が、オクテットごとの 1 の数から出ている");
})();
