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
const { STATIONS, GROUPS, EXAMPLES, makeQuestion } = require("./gen.js");
const bad = [];
const jsx = fs.readFileSync("app.jsx", "utf8");

// 覚える表を作ってあるのに、画面で使っていない（説明文の「この表」が何も指さなくなる）
if (!jsx.includes("EXAMPLES[")) bad.push("画面: 覚える表（EXAMPLES）を1回も使っていない");

// 同じ動作は同じ言葉で。ボタンの言い方がばらけると、押す前に読み直しが起きる
{
  const labels = [...jsx.matchAll(/>([^<>{}]{2,20})<\/button>/g)].map((m) => m[1].trim());
    // **同じ動作**を指すものだけを並べる。
  // 「これで決定」（答えを出す）と「次へ進む」（手順を1つ送る）は別の動作なので混ぜない
  const groups = [["練習をする", "練習する", "練習をはじめる"], ["テストをする", "テストする"]];
  for (const g of groups) {
    const used = g.filter((x) => labels.includes(x));
    if (used.length > 1) bad.push(`画面: 同じ動作のボタンが ${used.length} 通り（${used.join(" / ")}）`);
  }
  const again = labels.filter((x) => x.includes("もう一度"));
  if (new Set(again.map((x) => /^\p{Emoji}/u.test(x))).size > 1) {
    bad.push(`画面: 「もう一度」に絵文字が付いたり付かなかったり（${again.join(" / ")}）`);
  }
}
/* トップ画面の区切り（基礎／試験レベル／仕上げ）。
   捕まえるのは **並び順**だけ。いちばん上から始まっているか、前の区切りと重なっていないか。
   最後の区切りは必ず最後のステージまで伸びるので、「どこにも入らない札」は起きない。
   **ステージを足すと、その前の区切りに黙って入る。**そこは機械では分からないので、
   ステージを足したら GROUPS も見ること（名前の書き間違いは gen.js が止める）。 */
{
  if (GROUPS[0].at !== STATIONS[0].id) bad.push("区切り: いちばん上のステージから始まっていない");
  let n = 0;
  for (const g of GROUPS) {
    if (g.from <= n) bad.push(`区切り「${g.name}」の始まりが前と重なっている（${g.from} ≦ ${n}）`);
    // 並びが逆だと、終わりが始まりより前に来る。ここを見ないと順番違いが素通りする
    if (g.to < g.from) bad.push(`区切り「${g.name}」が ${g.from} 〜 ${g.to} になっている（並びが逆）`);
    n = g.to;
  }
}
/* ステージ7・8は「最も小さい」と書いてあるが、**かかる先が逆**。
     7（台数）… len が小さいほど台数が多い。条件を満たす他は /len−1。
                 正解のマスクは候補の中でいちばん大きいので、小さいのは「サブネット」のほう
     8（個数）… len が大きいほど個数が多い。条件を満たす他は /len+1。
                 正解のマスクが候補の中でいちばん小さいので、「サブネットマスク」でよい
   ここが入れ替わると、問いが誤答を指すのに検査は通ってしまう。 */
{
  const ipn = (s) => s.split(".").reduce((a, o) => a * 256 + Number(o), 0);
  const mask = (n) => ipn(require("./gen.js").maskStr ? require("./gen.js").maskStr(n) : "");
  for (const [id, label, dir, wantSmallestMask] of [["S5", "7", -1, false], ["S6", "8", +1, true]]) {
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion(id, i / 199);
      const len = Number(String(q.answer).match(/\/(\d+)/)[1]);
      const alts = [len + dir, len + 2 * dir].filter((n) => n >= 1 && n <= 30);
      if (!alts.length) continue;
      const me = mask(len);
      const ok = wantSmallestMask ? alts.every((n) => me < mask(n)) : alts.every((n) => me > mask(n));
      if (!ok) { bad.push(`${id}: ステージ${label}の「最も小さい」の向きが答えと合っていない（${q.answer}）`); break; }
      if (!/最も小さい/.test(q.prompt)) { bad.push(`${id}: ステージ${label}の問いに「最も小さい」が無い（${q.prompt}）`); break; }
      // 7 は「サブネットの」、8 は「サブネットマスク」に かかっていること
      const phrase = wantSmallestMask ? "最も小さいサブネットマスク" : "最も小さいサブネットの";
      if (!q.prompt.includes(phrase)) { bad.push(`${id}: 「${phrase}」になっていない（${q.prompt}）`); break; }
    }
  }
}
/* 仕上げのテストは、**8つの型を一通り出す**（15問）。
   ここが抜けると「本番で聞かれる8つの形」と言っておきながら、出ない型が生まれる。
   並び順が毎回同じでないことも見る（同じだと、問題を読まずに順番で覚えられる）。 */
{
  const { FINAL_KINDS: KINDS, finalOrder } = require("./gen.js");
  const heads = new Set();
  for (let r = 0; r < 200; r++) {
    const o = finalOrder(15);
    if (o.length !== 15) bad.push(`仕上げ: 15問にならない（${o.length}問）`);
    const miss = KINDS.filter((k) => !o.includes(k));
    if (miss.length) bad.push(`仕上げ: 出ない型がある（${miss.join(" ")}）`);
    if (o.some((k) => !KINDS.includes(k))) bad.push("仕上げ: 知らない型が混ざっている");
    heads.add(o.join(","));
  }
  if (heads.size < 100) bad.push(`仕上げ: 並び順がまざっていない（200回で ${heads.size} 通り）`);
}
const INPUTS = ["pow", "sum", "sub", "split", "pick", "stack", "mask", "final", "table"];
for (const s of STATIONS) {
  if (!EXAMPLES[s.id]) bad.push(`${s.id}: やり方（見本）が無い`);
  // 向きを指定して作れるか。**指定を無視して別の向きを返すと、
  //   「サブネットマスク → プレフィックス長」の見出しの下に逆向きの問題が出る**
  {
    const goals = new Set();
    for (let i = 0; i < 40; i++) { const q = makeQuestion(s.id, i / 39); if (q.goal) goals.add(q.goal); }
    for (const gl of goals) {
      for (const ez of [0, 0.2, 0.6, 1]) {
        try {
          const q = makeQuestion(s.id, ez, false, gl);
          if (q.goal !== gl) bad.push(`${s.id}: 向き ${gl} を頼んだのに ${q.goal} が出る（ease=${ez}）`);
        } catch (e) { bad.push(`${s.id}: ${e.message}（ease=${ez}）`); }
      }
    }
  }
  for (let i = 0; i < 200; i++) {
    let q;
    try { q = makeQuestion(s.id, i / 199); } catch (e) { bad.push(`${s.id}: 例外 ${e.message}`); break; }
    if (!q.prompt || !q.given.length) bad.push(`${s.id}: 問題文か材料が無い`);
    // 練習とテストで問いが変わると、同じことを聞かれている気がしなくなる
    const t = makeQuestion(s.id, i / 199, true);
    // 数だけは材料に合わせて変わってよい（「この2つ」「この4つ」）。**言い方**が変わるのを止める
    const shape = (x) => x.replace(/\d+/g, "#");
    if (shape(t.prompt) !== shape(q.prompt) && t.goal === q.goal) bad.push(`${s.id}: 練習とテストで問いが違う`);
    if (/盤/.test(t.prompt)) bad.push(`${s.id}: 問いに「盤」と書いてある（${t.prompt}）`);
    /* **聞いている言葉が、宙に浮いていないか。**
       「…を使います。どれですか。」のように、句点のあとに問いの言葉だけが残ると、
       何を聞かれているのか読み返さないと分からない。何を答えるのかは同じ文の中で言う。 */
    if (/。\s*(どれ|どこ|いくつ|なに|何)/.test(q.prompt)) {
      bad.push(`${s.id}: 問いの言葉が宙に浮いている（${q.prompt}）`);
    }
    // 画面に出る言葉に、初めての人に通じない言い方を混ぜない
    // 「桁の重み」だけで使わない。**8つ並べた表そのものの名前が「桁の重み表」。**
    for (const w of ["ビット目", "基準", "かたまり"]) {
      if (q.prompt.includes(w)) bad.push(`${s.id}: 問いに「${w}」が入っている`);
      for (const st2 of q.steps) if ((st2.t + st2.v).includes(w)) bad.push(`${s.id}: 手順に「${w}」が入っている（${st2.t}）`);
    }
    if (!q.steps || q.steps.length < 2) bad.push(`${s.id}: 手順が足りない`);
    // 問いの言い方をそろえる（「？」「〜ください」「。」が混ざると、別のアプリに見える）
    if (!q.prompt.endsWith("。")) bad.push(`${s.id}: 問いが「。」で終わっていない（${q.prompt}）`);
    // 問いが「この4つを」と数えているのに、材料が4つ無い、を止める
    const said = (q.prompt.match(/この(\d+)つ/) || [])[1];
    if (said && Number(said) !== (q.given || []).length) {
      bad.push(`${s.id}: 問いは「この${said}つ」なのに、材料は ${(q.given || []).length} つ`);
    }
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
const { splitOut, pickOut, stackOut, maskBoardOut, addrWith, pairOut, cutOct, cutBit, bin8, maskStr } = require("./gen.js");
const W8 = [128, 64, 32, 16, 8, 4, 2, 1];
let boards = 0;
for (const s of STATIONS) {
  // 向きを指定して作れるか。**指定を無視して別の向きを返すと、
  //   「サブネットマスク → プレフィックス長」の見出しの下に逆向きの問題が出る**
  {
    const goals = new Set();
    for (let i = 0; i < 40; i++) { const q = makeQuestion(s.id, i / 39); if (q.goal) goals.add(q.goal); }
    for (const gl of goals) {
      for (const ez of [0, 0.2, 0.6, 1]) {
        try {
          const q = makeQuestion(s.id, ez, false, gl);
          if (q.goal !== gl) bad.push(`${s.id}: 向き ${gl} を頼んだのに ${q.goal} が出る（ease=${ez}）`);
        } catch (e) { bad.push(`${s.id}: ${e.message}（ease=${ez}）`); }
      }
    }
  }
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
      // **画面と同じ道すじ**で確かめる。押した 1 と 0 から住所を組み立てて、答えに一致するか。
      // splitOut だけを見ていたので、うしろのオクテットを埋め忘れたバグを見逃していた
      const len = q.board.len, oc = cutOct(len), cb = cutBit(len);
      const W = [128, 64, 32, 16, 8, 4, 2, 1];
      const ipb = bin8(Number(q.board.ip.split(".")[oc])).split("").map(Number);
      const keep = ipb.slice(0, cb).reduce((a, c, j) => a + (c ? W[j] : 0), 0);
      const rest = 255 - (256 - Math.pow(2, 8 - cb));
      out = pairOut(addrWith(q.board.ip, oc, keep, 0), addrWith(q.board.ip, oc, keep + rest, 255), q.goal);
    } else if (q.input === "pick") {
      const bits = q.goal === "host" ? 32 - Number(q.answer.match(/\/(\d+)/)[1])
        : Number(q.answer.match(/\/(\d+)/)[1]) - q.base;
      out = pickOut(Math.pow(2, bits), q.goal, q.base).out;
    } else if (q.input === "final") {
      // 仕上げは盤を使わない（本番と同じ4択）。正解が選択肢に入っているかだけ見る
      if (!q.choices || !q.choices.includes(String(q.answer))) {
        bad.push(`${s.id}: 4択に正解が入っていない（答え=${q.answer}）`);
      }
      continue;
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
/* ── かな漢字の見張り ────────────────────────────────
   「中学1年生の言葉で」を、**ひらがなで書くこと**と取り違えていた。
   「引き算」と書いておきながら「たし算」、「見比べる」と書いておきながら「見くらべて」。
   同じ語が2通りで出てくると、読むたびに引っかかる。

   決まりは **常用漢字は漢字で書く。中1が読めない字だけ ひらがな**。
   （「そろえる」「ずらす」は常用漢字表に無いので、ひらがなのままでよい） */
const KANA = [
  ["とちゅう", "途中"], ["ぜんぶ", "全部"], ["おなじ", "同じ"], ["つづく", "続く"],
  ["ならぶ", "並ぶ"], ["のばす", "延ばす"], ["ちがう", "違う"], ["ちがい", "違い"],
  ["はじめて", "初めて"], ["うしろ", "後ろ"], ["まちがえ", "間違え"],
  ["あまり", "余り"], ["あまっ", "余っ"], ["たし算", "足し算"], ["ひき算", "引き算"],
  ["のこり", "残り"], ["かぞえ", "数え"], ["ふくむ", "含む"], ["のぞいた", "除いた"],
  ["見くらべ", "見比べ"], ["ぶん、", "分、"], ["個ぶん", "個分"], ["桁ぶん", "桁分"],
  ["こんど", "今度"], ["置きかえ", "置き換え"], ["ひと通り", "一通り"],
];

// 画面に出る言葉の見張り（注記は除く）
for (const line of src.split("\n")) {
  const t = line.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
  for (const w of ["ビット目", "基準"]) if (t.includes(w)) bad.push(`画面の言葉に「${w}」が残っている: ${t.slice(0, 60)}`);
  /* 画面の言葉は**説明だけ**にする。励ましも、呼びかけも入れない。
     「まちがえても大丈夫」「この速さを保ちましょう」のような言い方は、
     何が起きるかを1つも増やさないのに、読む量だけ増える。 */
  for (const w of ["大丈夫", "ましょう", "がんば", "その調子"]) {
    if (t.includes(w) && /[">]/.test(t)) bad.push(`画面の言葉が説明になっていない「${w}」: ${t.slice(0, 60)}`);
  }
  for (const [a, b] of KANA) if (t.includes(a)) bad.push(`ひらがなのままの語「${a}」→「${b}」: ${t.slice(0, 60)}`);
}
/* 説明の1枚の文章は gen.js の表に移した（WAY / LINK / FIGURE / 見本の注記）。
   app.jsx だけ見ていると、そこがまるごと見張りの外に出てしまう。 */
{
  const { WAY, LINK, FIGURE, EXAMPLES: EX, GROUPS: GR, STATIONS: ST } = require("./gen.js");
  const texts = [];
  for (const k of Object.keys(WAY)) texts.push(WAY[k].h, WAY[k].b);
  for (const k of Object.keys(LINK)) texts.push(LINK[k]);
  // トップ画面の区切りと、札の名前・例も画面に出る
  for (const g of GR) texts.push(g.name, g.note);
  // 札の中で開く「コツ」（バッジの左のボタン）
  for (const s of ST) {
    texts.push(s.name, s.ex);
    if (!s.tip) continue;
    texts.push(s.tip.label, s.tip.sub);
    for (const p of s.tip.parts) texts.push(p.h, p.b, ...p.rows.flat());
  }
  // 見本の表も画面に出る。ここが見張りの外だったので「基準」が1つ残っていた
  for (const k of Object.keys(EX)) {
    texts.push(EX[k].title, EX[k].note || "", ...EX[k].rows.flat());
  }
  for (const k of Object.keys(FIGURE)) {
    const f = FIGURE[k];
    texts.push(f.intro || "", f.foot || "", (f.head || {}).l || "", (f.head || {}).r || "",
      ...(f.caps || []), ...f.rows.map((r) => [r.cap, r.lab, r.r].filter(Boolean).join(" ")));
    // 図は表で組む。列の数と、各行のマスの数が食い違うと、静かにずれる
    for (const r of f.rows) {
      if (r.cells.length !== f.cols) bad.push(`${k}の図: 「${r.lab}」のマスが ${r.cells.length} 個（列は ${f.cols}）`);
    }
    if (f.cut != null && (f.cut < 1 || f.cut >= f.cols)) bad.push(`${k}の図: 区切りの列 ${f.cut} が範囲の外`);
  }
  for (const t of texts) {
    for (const w of ["ビット目", "基準", "かたまり"]) {
      if (t.includes(w)) bad.push(`説明の言葉に「${w}」が入っている: ${t.slice(0, 40)}`);
    }
    // 励ましも呼びかけも入れない（画面側と同じ決まり）
    for (const w of ["大丈夫", "ましょう", "がんば", "その調子"]) {
      if (t.includes(w)) bad.push(`説明が説明になっていない「${w}」: ${t.slice(0, 40)}`);
    }
    for (const [a, b] of KANA) if (t.includes(a)) bad.push(`ひらがなのままの語「${a}」→「${b}」: ${t.slice(0, 40)}`);
    // *…* は太字の印。開いたら必ず閉じる（閉じ忘れると、そこから先が全部太字になる）
    if ((t.match(/\*/g) || []).length % 2) bad.push(`太字の印 * が閉じていない: ${t.slice(0, 40)}`);
  }
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
for (const m of src.matchAll(/\?\s*"([a-z][a-z0-9-]*)"\s*:\s*"([a-z][a-z0-9-]*)"/g)) { used.add(m[1]); used.add(m[2]); }
for (const m of src.matchAll(/\?\s*"([a-z][a-z0-9- ]*)"\s*:\s*"([a-z][a-z0-9- ]*)"/g)) { for (const c of (m[1] + " " + m[2]).split(/\s+/)) if (c) used.add(c); }
const defined = new Set();
for (const m of cssBody.matchAll(/\.([a-z][a-z0-9-]*)/g)) defined.add(m[1]);
const noStyle = [...used].filter((c) => !defined.has(c) && !["wrap", "auto", "smooth"].includes(c));
const noUse = [...defined].filter((c) => !used.has(c));
/* ── 見た目の見張り ─────────────────────────────────────────
   文字の大きさは7段だけ。色は決めた32色だけ。余白は6きざみだけ。
   Apple の目安：小さい文字は 11px 以上、押すところは 44px 以上、見出しと本文は大きさで差をつける。
   段を増やすと画面ごとに少しずつずれていくので、機械で止める。

   **決めた値を書いてよいのは :root の中だけ。**
   前は330行のCSSに直値が散らばっていて、この見張り自体に穴があった
   （`font-size:(\d+)px` が小数に一致せず、11.5 / 12.5 / 14.5 の3つが素通りしていた）。
   いまは「:root の外に px や #hex があれば止める」なので、書き方で抜けることがない。 */
const SIZES = [11, 13, 15, 17, 22, 34, 44];
const SPACES = [4, 8, 12, 16, 22, 32];
const PALETTE = [
  "#0d1117", "#161b22", "#21262d", "#262c36", "#30363d",   // 地・枠
  "#484f58", "#8b949e", "#e6edf3",                          // 文字（薄い→濃い）
  "#58a6ff", "#79c0ff", "#132030",                          // 青＝いま選んでいるもの
  "#2ea043", "#238636", "#56d364", "#0f2a16",               // 緑＝進む・できた
  "#f85149", "#ff7b72", "#2a1315",                          // 赤＝ちがう
  "#e3b341", "#241c10", "#5c4d20",                          // 黄＝区切りの線・断り書き
  "#121a14", "#1a170f", "#2ea04355", "#e3b34188",           // 札の地
  "#0f141b", "#1c222b", "#1d2a1a", "#fff", "#000a",         // へこみ・キー・一瞬の地・影
];
// :root（決めた値の表）と、それ以外（本体）に分ける
const rootM = cssBody.match(/:root\{([\s\S]*?)\n\}/);
if (!rootM) bad.push("CSS に :root（決めた値の表）が無い");
const root = rootM ? rootM[1] : "";
const rest = cssBody.replace(/:root\{[\s\S]*?\n\}/, "");

// ① 表の中身が、決めた段・決めた色からはみ出していないか
for (const m of root.matchAll(/--f\d+:([\d.]+)px/g)) {
  if (!SIZES.includes(Number(m[1]))) bad.push(`文字の大きさが段に無い: ${m[1]}px（使えるのは ${SIZES.join(" ")}）`);
}
for (const m of root.matchAll(/--s\d+:([\d.]+)px/g)) {
  if (!SPACES.includes(Number(m[1]))) bad.push(`余白がきざみに無い: ${m[1]}px（使えるのは ${SPACES.join(" ")}）`);
}
for (const m of root.matchAll(/#[0-9a-f]{3,8}/g)) {
  if (!PALETTE.includes(m[0])) bad.push(`決めた色に無い: ${m[0]}`);
}
// ② 表の外に直値を書いていないか。**ここが、書き方で抜けられない形にした本体**
for (const m of rest.matchAll(/font-size:\s*([\d.]+px)/g)) {
  bad.push(`文字の大きさを直に書いている: ${m[1]}（var(--f1)〜var(--f7) を使う）`);
}
for (const m of rest.matchAll(/#[0-9a-f]{3,8}/g)) {
  bad.push(`色を直に書いている: ${m[0]}（:root の変数を使う）`);
}
// ③ 使っていない変数が表に残っていないか（消したのに表だけ残る、を防ぐ）
for (const m of root.matchAll(/(--[a-z0-9-]+):/g)) {
  if (!rest.includes(`var(${m[1]})`)) bad.push(`表にあるのに使われていない: ${m[1]}`);
}
if (bad.length) { console.error("\n見た目の異常:\n  " + [...new Set(bad)].join("\n  ")); process.exit(1); }
console.log(`見た目の決まり OK（文字は ${SIZES.length} 段 ／ 色は ${PALETTE.length} 色 ／ 余白は ${SPACES.length} きざみ）`);

/* ④ 余白は、まだ直値が残っている画面がある（ホームや結果など、今回触っていないところ）。
      止めると先へ進めないので、いまは数えて出すだけにする。触った所から --s に寄せていく。 */
{
  const off = [...rest.matchAll(/(?:margin|padding)(?:-top|-right|-bottom|-left)?:\s*([^;{}]+)/g)]
    .flatMap((m) => m[1].match(/(\d+)px/g) || [])
    .map((x) => Number(x.replace("px", "")))
    .filter((n) => n > 0 && !SPACES.includes(n));
  if (off.length) console.warn(`  余白がきざみの外（あと ${off.length} か所）:`, [...new Set(off)].sort((a, b) => a - b).join(" "));
}

if (noStyle.length) console.warn("  見た目の指定が無いクラス:", noStyle.join(" "));
if (noUse.length) console.warn("  使われていない見た目:", noUse.join(" "));
if (!noStyle.length && !noUse.length) console.log("見た目の検査 OK（クラス名の食い違いなし）");
