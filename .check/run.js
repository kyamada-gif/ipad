#!/usr/bin/env node
/*
 * ブラウザを開かずに、アプリを本当に描画して触る。
 *
 * ■ なぜ要るか
 *   問題の答えが合っていることと、**画面がちゃんと出て操作できること**は別の話。
 *   jsdom（ブラウザの中身だけを Node で動かすもの）に index.html と同じ順でファイルを読ませ、
 *   React に描かせて、実際に押す。
 *
 * ■ できること／できないこと
 *   できる  … 要素が出ているか、押したら進むか、7ステージを通しで解けるか、盤の値が正しいか
 *   できない … 見た目の大きさ・はみ出し（jsdom は絵を描かないため）
 *
 *   node .check/run.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require(path.join(__dirname, "node_modules/jsdom"));
// ステージの一覧などは、画面の中（eval の中）からは取り出せないので、そのまま読み込む
const { STATIONS, bin8, cutOct, cutBit, maskStr } = require(path.join(__dirname, "..", "gen.js"));

const tick = () => new Promise((r) => setTimeout(r, 0));
/** 条件がそろうまで待つ。決め打ちの秒数だと、機械の速さで結果が変わってしまう。 */
const waitFor = (fn, ms = 6000) => new Promise((res, rej) => {
  const t0 = Date.now();
  const loop = () => (fn() ? res() : Date.now() - t0 > ms ? rej(new Error("待ちすぎ")) : setTimeout(loop, 15));
  loop();
});

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
/* index.html と同じ順。**1つにつなげて1回で読ませる**
   （別々に読ませると、gen.js の const が app.js から見えない） */
const BUNDLE = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "gen.js", "app.js"]
  .map(read).join("\n;\n");

/** まっさらな画面を1つ立ち上げる。progress を渡すと、その進み具合から始まる。
    **描き終わるまで待つ**（1回の tick では間に合わないことがある）。 */
async function boot(progress, mode) {
  const dom = new JSDOM(read("index.html"), { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.scrollTo = () => {};
  window.navigator.vibrate = () => {};
  window.Element.prototype.scrollIntoView = function () {};
  if (progress) window.localStorage.setItem("ipcalc2-progress", JSON.stringify(progress));
  if (mode) window.localStorage.setItem("ipcalc2-mode", mode);
  window.__debug = true;
  window.eval(BUNDLE);
  const doc = window.document;
  const h = {
    window, doc,
    $: (s) => doc.querySelector(s),
    $$: (s) => [...doc.querySelectorAll(s)],
    txt: (s) => { const e = doc.querySelector(s); return e ? e.textContent.replace(/\s+/g, " ").trim() : null; },
    click: (el) => { if (!el) throw new Error("押すものが無い"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); },
    q: () => window.__q,
  };
  await waitFor(() => h.$(".hero") || h.$(".play"), 4000);
  return h;
}

const W8 = [128, 64, 32, 16, 8, 4, 2, 1];

const fails = [];
const note = (s) => console.log("  " + s);
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log("  ✗ " + msg); } };

/** 札から練習の問題まで入る（説明の1枚をはさむ） */
async function enterDrill(h, tile) {
  h.click(tile.querySelector(".t-h")); await tick();
  h.click(tile.querySelector(".go")); await waitFor(() => h.$(".sheet-p"), 4000);
  h.click(h.$$(".gotest button")[0]); await waitFor(() => h.$(".drill"), 4000);
}

/** 正しく操作して答えを出す */
async function solve(h) {
  const cur = h.q();
  if (cur.input === "sum") {
    const bits = bin8(cur.answer).split("");
    for (let i = 0; i < 8; i++) if (bits[i] === "1") { h.click(h.$(".box").querySelectorAll(".row8 button.cell")[i]); await tick(); }
  } else if (cur.input === "sub") {
    let rest = cur.target;
    for (let i = 0; i < 8; i++) if (rest >= W8[i]) { rest -= W8[i]; h.click(h.$(".box").querySelectorAll(".row8 button.cell")[i]); await tick(); }
  } else if (cur.input === "split") {
    const len = cur.board.len;
    // ① マスクの並びから、その位置の数を押す
    h.click(h.$(".box").querySelectorAll("button.oct")[cutOct(len)]); await tick();
    // ② その数を自分で 1 と 0 にする
    const mo = Number(maskStr(len).split(".")[cutOct(len)]);
    for (let i = 0; i < 8; i++) if (mo & W8[i]) { h.click(h.$(".box").querySelectorAll(".sp-row")[0].children[i]); await tick(); }
    // ③ 右をぜんぶ 0／ぜんぶ 1 にする
    for (const b of h.$(".box").querySelectorAll(".rowbtn")) { h.click(b); await tick(); }
  } else if (cur.input === "pow") {
    h.click(h.$(".box").querySelectorAll(".sp-row")[0].children[7 - cur.board.n]); await tick();
  } else if (cur.input === "mask") {
    // 左から 8 個ずつ 255 にして、あまりを上の桁から 1 にする
    const len = cur.board.len, full = Math.floor(len / 8), rest = len % 8;
    if (full > 0) { h.click(h.$(".box").querySelectorAll("button.oct")[full - 1]); await tick(); }
    for (let i = 0; i < rest; i++) { h.click(h.$(".box").querySelectorAll(".sp-row")[0].children[i]); await tick(); }
  } else if (cur.input === "pick") {
    const len = Number(String(cur.answer).match(/\/(\d+)/)[1]);
    const w = Math.pow(2, cur.goal === "host" ? 32 - len : len - cur.base);
    h.click([...h.$(".box").querySelectorAll(".cell.wide")].find((e) => e.textContent.trim() === String(w))); await tick();
  } else {
    const len = Number(String(cur.answer).split("/")[1]);
    // ① 違っているところを押す　② 4つとも同じところまで押す
    h.click(h.$(".box").querySelectorAll("button.oct")[cur.board.oc]); await tick();
    check(h.$(".stack"), `${cur.station}: ①を押しても②が出ない`);
    h.click(h.$(".box").querySelectorAll(".st-row")[0].querySelectorAll(".st-c")[len - cur.board.oc * 8 - 1]); await tick();
  }
  const btn = h.$$("button").find((b) => b.textContent.includes("これで決定"));
  check(btn && !btn.disabled, `${cur.station}: 決定ボタンが押せない`);
  h.click(btn); await tick();
}

/** テスト（表なし）を正しく解く */
async function solveTest(h) {
  const cur = h.q();
  if (cur.station === "S0") {
    // 数を打ち込む（足し引きは要らないので ＋− は出ていない）
    for (const d of String(cur.answer)) { h.click(h.$$(".k").find((k) => k.textContent === d)); await tick(); }
  } else if (cur.station === "S1") {
    // 計算するところに、1 の桁の重みを足していく
    const on = bin8(cur.answer).split("").map((c, i) => (c === "1" ? W8[i] : 0)).filter(Boolean);
    for (let j = 0; j < on.length; j++) {
      if (j > 0) { h.click(h.$$(".k").find((k) => k.textContent === "＋")); await tick(); }
      for (const d of String(on[j])) { h.click(h.$$(".k").find((k) => k.textContent === d)); await tick(); }
    }
  } else if (cur.station === "S2") {
    let rest = cur.target;
    for (let i = 0; i < 8; i++) if (rest >= W8[i]) { rest -= W8[i]; h.click(h.$(".box").querySelectorAll(".row8 button.cell")[i]); await tick(); }
  } else {
    h.click(h.$$(".ch").find((c) => c.textContent.trim() === String(cur.answer))); await tick();
  }
  const btn = h.$$("button").find((b) => b.textContent.includes("決定"));
  check(btn && !btn.disabled, `${cur.station}: 決定ボタンが押せない`);
  h.click(btn); await tick();
}

/** わざと外す */
async function miss(h) {
  const cur = h.q();
  if (cur.input === "sum" || cur.input === "sub") {
    // 正解と1ビットだけ違う形。**必ず1つ以上押す**（空だと決定ボタンが押せない）
    const right = cur.input === "sum" ? bin8(cur.answer) : bin8(cur.target);
    let bits = 0;
    for (let j = 0; j < 8; j++) if (right[j] === "1") bits |= 1 << (7 - j);
    let wrong = bits ^ 1;               // いちばん下の桁を反転
    if (wrong === 0) wrong = 2;
    for (let j = 0; j < 8; j++) if (wrong & (1 << (7 - j))) { h.click(h.$(".box").querySelectorAll(".row8 button.cell")[j]); await tick(); }
  }
  else if (cur.input === "split") {
    const len = cur.board.len, oc = cutOct(len), cb = cutBit(len);
    h.click(h.$(".box").querySelectorAll("button.oct")[oc]); await tick();
    // わざと線を1つずらす（1 と 0 の作り方を1つ間違える）
    const w = cb === 1 ? 1 : cb - 1;
    for (let i = 0; i < w; i++) { h.click(h.$(".box").querySelectorAll(".sp-row")[0].children[i]); await tick(); }
    check(h.$$(".dots").length === 2, `${cur.station}: ③で IP の並びが出ていない`);
    check(h.$$(".dots")[1].querySelectorAll(".num.on").length === 1, `${cur.station}: ③で同じ場所に色が付いていない`);
    check(h.$$(".dots")[1].querySelector("button") === null, `${cur.station}: IP の並びが押せてしまう`);
    for (const b of h.$(".box").querySelectorAll(".rowbtn")) { h.click(b); await tick(); }
  }
  else if (cur.input === "pow") {
    h.click(h.$(".box").querySelectorAll(".sp-row")[0].children[7 - (cur.board.n === 7 ? 6 : cur.board.n + 1)]); await tick();
  }
  else if (cur.input === "mask") {
    // わざと 1 個ずらす
    const len = cur.board.len, full = Math.floor(len / 8), rest = len % 8;
    if (full > 0) { h.click(h.$(".box").querySelectorAll("button.oct")[full - 1]); await tick(); }
    const w = rest === 0 ? 1 : rest + 1 > 8 ? rest - 1 : rest + 1;
    for (let i = 0; i < w; i++) { h.click(h.$(".box").querySelectorAll(".sp-row")[0].children[i]); await tick(); }
  }
  else if (cur.input === "pick") {
    const len = Number(String(cur.answer).match(/\/(\d+)/)[1]);
    const right = Math.pow(2, cur.goal === "host" ? 32 - len : len - cur.base);
    h.click([...h.$(".box").querySelectorAll(".cell.wide")].find((e) => e.textContent.trim() !== String(right))); await tick();
  }
  else {
    const len = Number(String(cur.answer).split("/")[1]), cut = len - cur.board.oc * 8;
    h.click(h.$(".box").querySelectorAll("button.oct")[cur.board.oc]); await tick();
    h.click(h.$(".box").querySelectorAll(".st-row")[0].querySelectorAll(".st-c")[cut === 1 ? 1 : cut - 2]); await tick();
  }
  h.click(h.$$("button").find((b) => b.textContent.includes("これで決定"))); await tick();
}

(async () => {
  console.log("=== ホーム（まっさら） ===");
  {
    const h = await boot(null); await tick();
    check(h.$(".hero"), "ホームが出ない");
    note("見出し: " + h.txt(".hero-t") + " ／ " + h.txt(".hero-n"));
    note("ステージの数: " + h.$$(".tile").length + " ／ 開いている: " + h.$$(".tile:not(.locked)").length);
    check(h.$$(".tile").length === STATIONS.length, `ステージが ${STATIONS.length} でない`);
    check(h.$$(".tile:not(.locked)").length === 1, "最初に開いているステージが1つでない");
    h.$$(".tile").slice(0, 3).forEach((t) => note("札: " + t.textContent.replace(/\s+/g, " ").trim()));

    // 鍵を押すと、開く条件が出るか
    h.click(h.$$(".tile")[2].querySelector(".t-h")); await tick();
    note("鍵を押すと: " + h.txt(".blocked"));
    check(h.txt(".blocked"), "開く条件が出ない");
  }

  console.log("\n=== 説明の1枚 → 暗記ドリル → テスト（どのステージも同じ作り）===");
  for (const st of STATIONS) {
    console.log(`\n=== ${st.no}ステージ ${st.name} ===`);
    const prog = {};
    for (const s2 of STATIONS) if (s2.id !== st.id) prog[s2.id] = { seen: 10, correct: 10, lit: true, solo: true };
    let h = await boot(prog); await tick();

    const tile = h.$$(".tile").find((t) => t.textContent.includes(st.name));
    check(tile && !tile.classList.contains("locked"), `${st.id}: 札が開いていない`);
    if (!tile) continue;
    h.click(tile.querySelector(".t-h")); await tick();
    h.click(tile.querySelector(".go")); await waitFor(() => h.$(".sheet-p"), 4000);

    // 説明の1枚は「1行 ＋ 表 ＋ 下に貼り付いた2つのボタン」
    check(h.$(".mtitle"), `${st.id}: 説明の1枚が出ない`);
    check(h.$$(".how").length === 1, `${st.id}: 説明が1行でない（${h.$$(".how").length} 行）`);
    check(h.$$(".dtr").length > 0, `${st.id}: 説明の1枚に表も例も出ていない`);
    check(h.$$(".gotest button").length === 2, `${st.id}: 入口が2つ出ていない`);
    check(!h.$(".box"), `${st.id}: 説明の1枚に盤が残っている`);
    note("説明: " + h.txt(".how"));

    // 覚える表があるステージだけ、暗記ドリルを見る
    // つぎにテスト
    prog[st.id] = { seen: 10, correct: 10, lit: true, solo: false };
    h = await boot(prog); await tick();
    const tile3 = h.$$(".tile").find((t) => t.textContent.includes(st.name));
    h.click(tile3.querySelector(".t-h")); await tick();
    h.click(tile3.querySelectorAll(".go")[1]); await waitFor(() => h.$(".play"), 4000);
    check(h.$(".testnote"), `${st.id}: テストが表なしで始まらない`);
    check(h.txt(".pnum").endsWith("/10"), `${st.id}: テストが10問でない`);
    let g2 = 0;
    while (h.$(".play") && g2++ < 14) {
      await tick();
      if (!h.$(".play")) break;
      const cur = h.q();
      await solveTest(h);
      if (h.$(".judge.ok")) { h.click(h.$$(".judge button")[0]); await tick(); }
      else if (h.$(".why")) { check(false, `${st.id}: 正しく答えたのに不正解（答え=${cur.answer}）`); h.click(h.$$(".judge button")[0]); await tick(); }
      else if (h.$(".judge.ng")) { h.click(h.$$(".judge button")[0]); await tick(); }
      else break;
    }
    check(h.$(".result"), `${st.id}: 結果が出ない`);
    if (h.$(".result")) {
      note("テストの結果: " + h.txt(".result"));
      check(h.txt(".result").includes("バッジをもらいました"), `${st.id}: 10問正解なのにバッジが出ない`);
    }
  }

  console.log("\n=== 問題が変わると、盤の中身が消えるか ===");
  {
    const prog = { S0: { seen: 10, correct: 10, lit: true, solo: false } };
    const h = await boot(prog); await tick();
    const t = h.$$(".tile")[0];
    h.click(t.querySelector(".t-h")); await tick();
    h.click(t.querySelectorAll(".go")[1]); await waitFor(() => h.$(".play"), 4000);
    // 1問目を解く
    await solveTest(h);
    const prev = h.q();
    await waitFor(() => h.q() !== prev || h.$(".result"), 4000);
    // 2問目のはじめに、前の答えが残っていないこと
    check(h.txt(".calc-t") === "0", `問題が変わっても盤に前の答えが残っている（${h.txt(".calc-t")}）`);
    note("    問題が変わると、打った数が消えた");
  }

  console.log("\n=== 間違えたら、正解するまで次へ行かないか ===");
  {
    const h = await boot({ S0: { seen: 10, correct: 10, lit: true, solo: false } }); await tick();
    const t0 = h.$$(".tile")[0];
    h.click(t0.querySelector(".t-h")); await tick();
    h.click(t0.querySelectorAll(".go")[1]); await waitFor(() => h.$(".play"), 4000);
    const prev = h.q();
    // わざと外す
    for (const d of String(Number(h.q().answer) + 1)) { h.click(h.$$(".k").find((k) => k.textContent === d)); await tick(); }
    h.click(h.$$("button").find((b) => b.textContent.includes("決定"))); await tick();
    check(h.$(".judge.ng"), "外しても不正解の帯が出ない");
    const b = h.$$(".judge button").find((x) => x.textContent.includes("もう一度"));
    check(b, "「もう一度」が出ない");
    if (b) {
      h.click(b); await tick();
      check(h.q() === prev, "同じ問題に戻っていない");
      check(h.txt(".calc-t") === "0", "打った数が残っている");
      note("    外すと、同じ問題をもう一度やり直す");
    }
  }

  console.log("\n=== 正解の画面を押すと、すぐ次へ行けるか ===");
  {
    const h = await boot({ S0: { seen: 10, correct: 10, lit: true, solo: false } }); await tick();
    const t0 = h.$$(".tile")[0];
    h.click(t0.querySelector(".t-h")); await tick();
    h.click(t0.querySelectorAll(".go")[1]); await waitFor(() => h.$(".play"), 4000);
    const prev = h.q();
    await solveTest(h);
    check(h.$(".judge.ok"), "正解にならない");
    check(h.$(".j-next"), "「押すと次へ」の案内が出ない");
    // すぐ押しても効かない（指がそのまま触れて飛ばさないように）
    h.click(h.$(".judge.ok")); await tick();
    check(h.q() === prev, "正解の直後に押しても飛んでしまう");
    note("    直後に押しても飛ばない（正しい）");
    await waitFor(() => Date.now() > 0 && true);
    await new Promise((r) => setTimeout(r, 350));
    h.click(h.$(".judge.ok")); await tick();
    check(h.q() !== prev, "少し待ってから押しても次へ行かない");
    note("    少し待って押すと、すぐ次へ進んだ");
  }

  console.log("\n=== ぜんぶ開く（お試し）===");
  {
    const h = await boot(null); await tick();
    check(h.$$(".tile.locked").length === STATIONS.length - 1, "はじめに開いているのは1つだけのはず");
    h.click(h.$(".unlock")); await tick();
    check(h.$$(".tile.locked").length === 0, "ぜんぶ開くを押しても鍵が外れない");
    check(h.txt(".unlock") === "鍵をかけ直す", "押したあとの言い方が違う");
    // 開いたステージがちゃんと始まる
    await enterDrill(h, h.$$(".tile")[STATIONS.length - 1]);
    check(h.$(".drill"), "鍵を外したステージが始まらない");
    note("    7ステージまで開いて、そのまま始められた");
    // テスト側も開く
    const h2 = await boot(null, "test"); await tick();
    h2.click(h2.$(".unlock")); await tick();
    check(h2.$$(".tile.locked").length === 0, "テスト側で鍵が外れない");
    check(!h2.$(".empty"), "鍵を外したのに「まず練習で」が出たまま");
    note("    テスト側でも開いた");
  }

  console.log("\n=== 札ごとに、練習とテストを選べるか ===");
  {
    const h0 = await boot(null); await tick();
    const t0 = h0.$$(".tile")[0];
    // はじめは札だけ。押した札にだけボタンが出る
    check(h0.$$(".go").length === 0, "押す前からボタンが出ている");
    h0.click(t0.querySelector(".t-h")); await tick();
    check(h0.$$(".go").length === 2, "押した札にボタンが2つ出ない");
    check(t0.querySelectorAll(".go").length === 2, "札にボタンが2つ出ていない");
    note("    はじめは札だけ。押した札にだけ2つ出た");
    check(t0.textContent.includes("練習する") && t0.textContent.includes("テストをする"), "札のボタンの言い方が違う");
    // まだ練習していないので、テストは開いていない
    check(t0.querySelectorAll(".go")[1].classList.contains("off"), "練習していないのにテストが開いている");
    h0.click(t0.querySelectorAll(".go")[1]); await tick();
    check(h0.txt(".blocked") === "先に練習でできると、テストが開きます", "テストの鍵の説明が違う");
    check(!h0.$(".play"), "練習していないのにテストが始まった");
    note("    練習していないステージは、テストのボタンが閉じている");
    // 練習のボタンは、表あり
    h0.click(t0.querySelectorAll(".go")[0]); await waitFor(() => h0.$(".sheet-p"), 4000);
    check(h0.$(".how") && h0.$(".gotest"), "「練習する」で説明の1枚が出ない");
    h0.click(h0.$$(".gotest button")[0]); await waitFor(() => h0.$(".drill"), 4000);
    check(h0.$(".dcard"), "「覚える」で暗記ドリルが始まらない");
    note("    「練習する」→ 説明の1枚 →「覚える」→ 暗記ドリル");
    // 練習ができているステージは、テストのボタンが開く
    const prog = {};
    for (const s2 of STATIONS) prog[s2.id] = { seen: 5, correct: 5, lit: true, solo: false };
    const h = await boot(prog); await tick();
    const t1 = h.$$(".tile")[0];
    h.click(t1.querySelector(".t-h")); await tick();
    check(!t1.querySelectorAll(".go")[1].classList.contains("off"), "練習ができたのにテストが開かない");
    // 進み具合は、練習とテストの両方を出す（ホームにいるうちに見る）
    check(h.txt(".hero-n").includes("バッジ"), "進み具合が2つ出ていない");
    note("    進み具合: " + h.txt(".hero-n"));
    h.click(t1.querySelectorAll(".go")[1]); await waitFor(() => h.$(".play"));
    check(h.$(".testnote"), "「テストをする」なのに表ありで始まった");
    note("    「テストをする」→ 表なし");
  }

  console.log("\n=== テスト（表なし）===");
  for (const st of STATIONS) {
    const prog = {};
    for (const s2 of STATIONS) prog[s2.id] = { seen: 5, correct: 5, lit: true, solo: false };
    const h = await boot(prog); await tick();
    { const _t = h.$$(".tile").find((t) => t.textContent.includes(st.name)); h.click(_t.querySelector(".t-h")); await tick(); h.click(_t.querySelectorAll(".go")[1]); } await tick();
    const line = h.txt(".testnote");
    const hasTable = !!h.$(".c-w") || !!h.$(".sp-w") || !!h.$(".c-w2");
    const hasCalc = !!h.$(".calc");
    console.log(`  ${st.no}ステージ ${st.name}`);
    check(line, `${st.id}: 表なしの断りが出ない`);
    check(!hasTable, `${st.id}: テストなのに桁の重みが出ている`);
    check(h.$(".choices") ? !hasCalc : hasCalc, `${st.id}: 選ぶ回に電卓が出ている／打ち込む回に電卓が無い`);
    check(line && line.includes("思い出して"), `${st.id}: 表なしの断りの言い方が違う（${line}）`);
    const kind = h.$(".choices") ? "選ぶ（" + h.$$(".ch").length + "択）" : h.$(".row8") ? "空の8マス" : "計算した数で決定";
    note(`    表なし=${!hasTable} ／ 計算欄=${hasCalc} ／ 答え方=${kind}`);
    if (h.$(".choices")) {
      const chs = h.$$(".ch").map((c) => c.textContent.trim());
      check(new Set(chs).size === chs.length, `${st.id}: 選択肢が重複している`);
      check(chs.includes(String(h.q().answer)), `${st.id}: 正解が選択肢に無い`);
      check(chs.length === 4, `${st.id}: 選択肢が4つでない（${chs.length}つ）`);
      note("    選択肢: " + chs.join(" ／ "));
    }
    // 5問とも正しく解けるか
    let guard = 0;
    while (h.$(".play") && guard++ < 24) {
      const before = h.q();
      await solveTest(h);
      if (h.$(".judge.ok")) { h.click(h.$$(".judge button")[0]); await tick(); }
      else if (h.$(".why")) {
        check(false, `${st.id}: 表なしで正しく解いたのに不正解（答え=${before.answer}）`);
        check(h.$$(".judge button").some((b) => b.textContent.includes("もう一度")), `${st.id}: 正解するまでやり直す形になっていない`);
        h.click(h.$$(".judge button")[0]); await tick();
      }
      else break;
    }
    check(h.$(".result"), `${st.id}: 表なしの結果が出ない`);
    if (h.$(".result")) note("    結果: " + h.txt(".result"));
  }

  console.log("\n" + (fails.length ? `✗ ${fails.length} 件:\n  ` + fails.join("\n  ") : "✓ ぜんぶ通りました"));
  process.exit(fails.length ? 1 : 0);
})();
