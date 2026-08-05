#!/usr/bin/env node
/*
 * ビルド: app.jsx -> app.js
 *   Babel で JSX をコンパイルし、ブラウザが素で読める形に直す。
 *   あわせて、7つのステージがちゃんと問題を吐けるかを検査する。
 */
const { execSync } = require("child_process");
const fs = require("fs");
process.chdir(__dirname);

execSync("npx babel app.jsx --presets @babel/preset-react -o app.js", { stdio: "inherit" });
let code = fs.readFileSync("app.js", "utf8");
code = code.replace(/^import React,\s*\{([^}]*)\}\s*from\s*"react";?\s*$/m, (_, n) => `const {${n}} = React;`);
code = code.replace(/export default function App/, "function App");
const boot = 'ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));';
if (!code.includes(boot)) code = code.trimEnd() + "\n" + boot + "\n";
fs.writeFileSync("app.js", "/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */\n" + code);

try {
  let html = fs.readFileSync("index.html", "utf8");
  const g = fs.readFileSync("gen.js", "utf8").length;
  const next = html.replace(/(\.\/app\.js)(\?v=\d+)?/, `$1?v=${code.length}`)
                   .replace(/(\.\/gen\.js)(\?v=\d+)?/, `$1?v=${g}`);
  if (next !== html) fs.writeFileSync("index.html", next);
} catch (e) { console.warn("index.html のバージョン更新をとばした:", e.message); }
console.log("built app.js (" + code.length + " bytes)");

// ── 見張り ──
const { STATIONS, EXAMPLES, makeQuestion } = require("./gen.js");
const bad = [];
const INPUTS = ["pow", "sum", "sub", "split", "pick", "stack", "mask", "wild"];
for (const s of STATIONS) {
  if (!EXAMPLES[s.id]) bad.push(`${s.id}: やり方（見本）が無い`);
  for (const n of s.need) if (!STATIONS.some((x) => x.id === n)) bad.push(`${s.id}: 前提 ${n} が無い`);
  for (let i = 0; i < 200; i++) {
    let q;
    try { q = makeQuestion(s.id, i / 199); } catch (e) { bad.push(`${s.id}: 例外 ${e.message}`); break; }
    if (!q.prompt || !q.given.length) bad.push(`${s.id}: 問題文か材料が無い`);
    // 練習とテストで問いが変わると、同じことを聞かれている気がしなくなる
    const t = makeQuestion(s.id, i / 199, true);
    if (t.prompt !== q.prompt && t.goal === q.goal) bad.push(`${s.id}: 練習とテストで問いが違う`);
    if (/盤/.test(t.prompt)) bad.push(`${s.id}: 問いに「盤」と書いてある（${t.prompt}）`);
    // 画面に出る言葉に、初めての人に通じない言い方を混ぜない
    for (const w of ["ビット目", "基準"]) {
      if (q.prompt.includes(w)) bad.push(`${s.id}: 問いに「${w}」が入っている`);
      for (const st2 of q.steps) if ((st2.t + st2.v).includes(w)) bad.push(`${s.id}: 手順に「${w}」が入っている（${st2.t}）`);
    }
    if (!q.steps || q.steps.length < 2) bad.push(`${s.id}: 手順が足りない`);
    if (!INPUTS.includes(q.input)) bad.push(`${s.id}: 知らない盤 ${q.input}`);
    if (q.answer == null || q.answer === "") bad.push(`${s.id}: 答えが空`);
    if (q.input === "split" && (!q.board || !q.board.ip)) bad.push(`${s.id}: 盤の材料が足りない`);
    if (q.input === "split" && q.board.len % 8 === 0) bad.push(`${s.id}: 区切りのあるオクテットが無い長さ`);
    if (q.input === "stack" && (!q.board || q.board.nets.length < 2)) bad.push(`${s.id}: まとめる材料が足りない`);
  }
}
// ── 盤の検査 ──
// 「正しく操作したら、その問題の答えになるか」。
// 画面と検算が同じ関数（splitOut / pickOut / stackOut）を使っているので、ここで確かめられる。
const { splitOut, pickOut, stackOut, maskBoardOut, cutOct, cutBit, bin8, maskStr } = require("./gen.js");
const W8 = [128, 64, 32, 16, 8, 4, 2, 1];
let boards = 0;
for (const s of STATIONS) {
  for (let i = 0; i < 200; i++) {
    const q = makeQuestion(s.id, i / 199);
    let out;
    if (q.input === "sum") {
      // 与えられた2進数を盤に写す → 押した重みの合計
      out = bin8(q.answer).split("").reduce((a, c, j) => a + (c === "1" ? W8[j] : 0), 0);
    } else if (q.input === "sub") {
      // 残りが 0 になるまで押す → 並びがそのまま2進数
      const v = q.target;
      let rest = v, got = "";
      for (const w of W8) { if (rest >= w) { rest -= w; got += "1"; } else got += "0"; }
      if (rest !== 0) bad.push(`${s.id}: 引ききれない（残り ${rest}）`);
      out = got;
    } else if (q.input === "split") {
      out = splitOut(q.board.ip, cutOct(q.board.len), cutBit(q.board.len), q.goal).out;
    } else if (q.input === "pick") {
      const bits = q.goal === "host" ? 32 - Number(q.answer.match(/\/(\d+)/)[1])
        : Number(q.answer.match(/\/(\d+)/)[1]) - q.base;
      out = pickOut(Math.pow(2, bits), q.goal, q.base).out;
    } else if (q.input === "wild") {
      // 255 から引くだけ
      out = maskStr(q.board.len).split(".").map((v) => 255 - Number(v)).join(".");
    } else if (q.input === "pow") {
      // 表から、その回数のところを押す
      out = q.goal === "toValue" ? String(Math.pow(2, q.board.n)) : String(q.board.n);
    } else if (q.input === "mask") {
      // 左から 255 をつめて、あまりを上の桁から 1 にする
      const len = q.board.len, full = Math.floor(len / 8), rest = len % 8;
      let bits = 0;
      for (let j = 0; j < rest; j++) bits += W8[j];
      out = maskBoardOut(full, bits, q.goal).out;
    } else {
      const len = Number(q.answer.split("/")[1]);
      const cut = len - q.board.oc * 8;
      // 盤に並ぶのは8ビット。線は1〜8ビット目のうしろにしか引けない
      if (cut < 1 || cut > 8) { bad.push(`${s.id}: 盤の上で線が引けない（${cut} ビット目 / 答え=${q.answer}）`); break; }
      out = stackOut(q.board.nets[0].split("/")[0], q.board.oc, cut).out;
    }
    boards++;
    if (String(out) !== String(q.answer)) {
      bad.push(`${s.id}: 正しく操作しても答えにならない（盤=${out} / 答え=${q.answer}）`);
      break;
    }
  }
}

if (bad.length) { console.error("\n生成器の異常:\n  " + [...new Set(bad)].join("\n  ")); process.exit(1); }
console.log(`生成器の検査 OK（${STATIONS.length} ステージ × 200 問）`);
console.log(`盤の検査 OK（正しく操作すれば答えになる：${boards} 通り）`);

// ── 見た目の検査 ──
// 画面で使っているクラス名と、見た目の指定が食い違っていないか。
// 前に「同じ名前を2か所で使っていた」「見た目ごと消していた」で2回やらかしているので、機械で捕まえる。
const src = fs.readFileSync("app.jsx", "utf8");
// 画面に出る言葉の見張り（注記は除く）
for (const line of src.split("\n")) {
  const t = line.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
  for (const w of ["ビット目", "基準"]) if (t.includes(w)) bad.push(`画面の言葉に「${w}」が残っている: ${t.slice(0, 60)}`);
}
if (bad.length) { console.error("\n言葉の異常:\n  " + [...new Set(bad)].join("\n  ")); process.exit(1); }
const cssBody = src.slice(src.indexOf("const CSS = `"));
const used = new Set();
for (const m of src.matchAll(/className=\{?["`]([^"`{}]+)["`]/g)) {
  for (const c of m[1].split(/\s+/)) if (c) used.add(c);
}
for (const m of src.matchAll(/["`]\s+([a-z][a-z0-9-]*)["`]/g)) { /* 条件付きで足すクラス */ used.add(m[1]); }
for (const m of src.matchAll(/,\s*"([a-z][a-z0-9-]*)"\)\}/g)) used.add(m[1]);  /* key(…, "op") の形 */
for (const m of src.matchAll(/\?\s*"([a-z][a-z0-9-]*)"\s*:\s*""/g)) used.add(m[1]);  /* 条件で付け外しするクラス */
const defined = new Set();
for (const m of cssBody.matchAll(/\.([a-z][a-z0-9-]*)/g)) defined.add(m[1]);
const noStyle = [...used].filter((c) => !defined.has(c) && !["wrap"].includes(c));
const noUse = [...defined].filter((c) => !used.has(c));
// 文字の大きさは7段だけ。色は決めた12色だけ。
// Apple の目安：小さい文字は 11px 以上、押すところは 44px 以上、見出しと本文は大きさで差をつける。
// 段を増やすと画面ごとに少しずつずれていくので、機械で止める。
const SIZES = [11, 13, 15, 17, 22, 34, 44];
const PALETTE = [
  "#0d1117", "#161b22", "#21262d", "#262c36", "#30363d",   // 地・枠
  "#484f58", "#8b949e", "#e6edf3",                          // 文字（薄い→濃い）
  "#58a6ff", "#79c0ff", "#132030",                          // 青＝いま選んでいるもの
  "#2ea043", "#238636", "#56d364", "#0f2a16",               // 緑＝進む・できた
  "#f85149", "#ff7b72", "#2a1315",                          // 赤＝ちがう
  "#e3b341", "#241c10", "#5c4d20",                          // 黄＝区切りの線・断り書き
  "#121a14", "#1a170f", "#2ea04355", "#e3b34188",           // 札の地
  "#12261a", "#0f141b", "#1c222b", "#1d2a1a", "#fff", "#000a", "#0f1a12", // 押したとき・影
];
for (const m of cssBody.matchAll(/font-size:(\d+)px/g)) {
  if (!SIZES.includes(Number(m[1]))) bad.push(`文字の大きさが段に無い: ${m[1]}px（使えるのは ${SIZES.join(" ")}）`);
}
for (const m of cssBody.matchAll(/#[0-9a-f]{3,8}/g)) {
  if (!PALETTE.includes(m[0])) bad.push(`決めた色に無い: ${m[0]}`);
}
if (bad.length) { console.error("\n見た目の異常:\n  " + [...new Set(bad)].join("\n  ")); process.exit(1); }
console.log(`見た目の決まり OK（文字は ${SIZES.length} 段 ／ 色は ${PALETTE.length} 色）`);

if (noStyle.length) console.warn("  見た目の指定が無いクラス:", noStyle.join(" "));
if (noUse.length) console.warn("  使われていない見た目:", noUse.join(" "));
if (!noStyle.length && !noUse.length) console.log("見た目の検査 OK（クラス名の食い違いなし）");
