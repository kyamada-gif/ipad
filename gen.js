/*
 * IPアドレスの計算 ── 問題を作るところ
 *
 * ■ もとにした教材
 *   `IPアドレス計算問題.pdf`（A4・9ページ）。
 *   冒頭に「2進数の桁の重みの表」を出して、
 *   **以降の7つの手順すべてを、その1つの表の上でやる**という作りになっている。
 *
 * ■ このアプリの背骨 ── 盤は1つ、線は1本
 *   7つの手順は、全部「盤（桁の重み）」と「区切り線」の2つで書ける。
 *   人がやるのは **どれを押すか／どこに線を引くか** だけ。
 *   足し算と10進への変換は機械がやる。**暗算は求めない。**
 *
 *   1ステージ  2進数 → 10進数        盤に写して、押した重みを足す
 *   2ステージ  10進数 → 2進数        残りから引けるものを押す（教材と同じ向き）
 *   3ステージ  先頭と末尾            マスクの段とIPの段に、縦の線を引く
 *   4ステージ  使えるアドレスの範囲   3ステージと同じ盤。答えが範囲になるだけ
 *   5ステージ  台数 → マスク         盤を右（小さい方）から見て、1つ押す
 *   6ステージ  個数 → マスク         5ステージと同じ。基準からの延長ぶん
 *   7ステージ  まとめる（集約）      2進を縦に並べて、同じでなくなる所に線
 *
 * ■ 問題データは持たない
 *   その場で作る。数字は毎回変わる。答えは Python の ipaddress で全件照合している。
 *
 * ■ 教材と1か所だけ変えたところ
 *   6ステージ「必要なサブネット数」。教材は必要な数に 2 を足しているが、これは
 *   サブネットゼロが使えなかった時代の数え方。いまの CCNA では足さない。
 *   （5ステージの「台数に 2 を足す」は、いまも正しい）
 */

/* ───────── 乱数 ───────── */
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[ri(0, arr.length - 1)];
const shuffle = (a) => {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = ri(0, i); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};

/* ───────── IPv4 の基本計算 ─────────
   32ビットの数として扱う。JS のビット演算は符号付きなので >>>0 で必ず符号なしに戻す。 */
const ipToInt = (s) => s.split(".").reduce((a, o) => (a * 256 + Number(o)), 0) >>> 0;
const intToIp = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
const maskInt = (len) => (len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0);
const maskStr = (len) => intToIp(maskInt(len));
const netInt = (ip, len) => (ip & maskInt(len)) >>> 0;
const bcInt = (ip, len) => ((netInt(ip, len) | (~maskInt(len) >>> 0)) >>> 0);
const bin8 = (n) => n.toString(2).padStart(8, "0");
/** 区切りのあるオクテットの番号（0〜3）。/27 なら 3（第4オクテット）。 */
const cutOct = (len) => Math.floor(len / 8);
/** そのオクテットの中の、上から何ビット目までがネットワーク部か。/27 なら 3。 */
const cutBit = (len) => len % 8;

/* ───────── よく出る数 ─────────
   原本4冊・全1650問に実際に出てきた回数（ipcalc/ の集計と同じもの）。 */
const LEN_FREQ = {
  8: 62, 9: 3, 11: 3, 12: 1, 13: 1, 15: 3, 16: 36, 17: 1, 18: 4, 19: 11, 20: 23,
  21: 4, 22: 6, 23: 23, 24: 232, 25: 32, 26: 20, 27: 51, 28: 32, 29: 43, 30: 90,
  31: 3, 32: 101,
};
/* 回数そのままだと /24 だけで3割になって練習にならないので、平方根で重みをゆるめる。
   多い少ないの順番は実データのまま。ease は「5問の中の位置」。前半はやさしい長さにする。 */
const commonLen = (lo, hi, ease, mustCut) => {
  const ok = (n) => n >= lo && n <= hi && (!mustCut || n % 8 !== 0);
  if (ease != null && ease < 0.45) {
    // やさしい問題は「4で割り切れる長さ」。
    // ただし区切りが要るステージ（3ステージ・4ステージ）では **/17 以上**に限る。
    // そうしないと候補が /12 /20 /28 の3つしか無く、
    // 実際にはほとんど出ない /12（原本で1回）が3回に1回出てしまう。
    const from = mustCut ? Math.max(lo, 17) : lo;
    const e = [];
    for (let n = from; n <= hi; n++) if (ok(n) && (n % 4 === 0)) e.push(n);
    if (e.length) return pick(e);
  }
  const es = Object.keys(LEN_FREQ).map(Number).filter(ok);
  if (!es.length) { const all = []; for (let n = lo; n <= hi; n++) if (ok(n)) all.push(n); return pick(all); }
  const w = es.map((n) => Math.sqrt(LEN_FREQ[n]));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < es.length; i++) { r -= w[i]; if (r <= 0) return es[i]; }
  return es[es.length - 1];
};

/** 練習に向いた（私用の）アドレスを1つ。 */
function randomIp() {
  switch (ri(0, 2)) {
    case 0: return `10.${ri(0, 255)}.${ri(0, 255)}.${ri(1, 254)}`;
    case 1: return `172.${ri(16, 31)}.${ri(0, 255)}.${ri(1, 254)}`;
    default: return `192.168.${ri(0, 255)}.${ri(1, 254)}`;
  }
}

/* ───────── 豆知識（教材の「参考」ページから） ───────── */
function tipOf(v) {
  for (const w of [128, 64, 32, 16, 8, 4, 2, 1]) {
    if (v === w - 1 && v > 0) return `下位が全部 1 なら、その上の重み − 1。だから ${w} − 1 = ${v}。`;
  }
  if (v === 255) return "8桁ぜんぶ 1 で 255。これが最大。";
  const M = { 128: 1, 192: 2, 224: 3, 240: 4, 248: 5, 252: 6, 254: 7 };
  if (M[v]) return `${v} は「上から ${M[v]} 個だけ 1」。`;
  return null;
}


/* ───────── 盤が出す答え ─────────
   **画面と検算で同じ関数を使う。**画面側にも同じ計算を書くと、必ずどちらかがずれる。
   人が決めるのは引数だけ（どのオクテット・どこに線・どの重み）。あとは全部ここで出す。 */

/** 3ステージ・4ステージの盤。oct = 何番目のオクテットか（0〜3）、cut = そのオクテットの上から何ビットか（0〜8）。 */
function splitOut(ip, oct, cut, goal) {
  const parts = ip.split(".").map(Number);
  const m = parts.map((p, i) => (i < oct ? 255 : i === oct ? (cut === 0 ? 0 : 256 - Math.pow(2, 8 - cut)) : 0));
  const mi = ipToInt(m.join("."));
  const n = (ipToInt(ip) & mi) >>> 0;
  const b = (n | (~mi >>> 0)) >>> 0;
  return {
    maskOct: m[oct],
    net: intToIp(n),
    bc: intToIp(b),
    out: goal === "range" ? `${intToIp(n + 1)} 〜 ${intToIp(b - 1)}` : `${intToIp(n)} / ${intToIp(b)}`,
  };
}

/** マスクのステージの盤。full = 255 にした数（左から）、bits = そのつぎの並びの 1 と 0。 */
function maskBoardOut(full, bits, goal) {
  const W = [128, 64, 32, 16, 8, 4, 2, 1];
  const bs = W.map((w) => (bits & w ? 1 : 0));
  const cut = bs.lastIndexOf(1) + 1;                 // 線は「いちばん右の 1 のうしろ」
  const len = full * 8 + cut;
  const m = [0, 1, 2, 3].map((i) => (i < full ? 255 : i === full ? (cut === 0 ? 0 : 256 - Math.pow(2, 8 - cut)) : 0));
  const mask = m.join(".");
  return { len, mask, out: goal === "toLen" ? `/${len}` : mask };
}

/** 3ステージ・4ステージの③。押した 1 と 0 から、そのアドレスを出す。
 *  **画面では計算しない。**押した並びを渡すと、ここが住所に直す。 */
function addrWith(ip, oct, byte, fill) {
  const p = ip.split(".").map(Number);
  p[oct] = byte;
  // **線から右は、うしろのオクテットもふくむ。**
  // ここを埋め忘れると、/24 より短い問題は正しく操作しても永久に正解にならない
  for (let i = oct + 1; i < 4; i++) p[i] = fill;
  return p.join(".");
}

/** 線から右をぜんぶ 1 にした値。cut=3 なら 00011111 = 31。 */
const restOnes = (cut) => 255 >> cut;

/** ステージ5のテストの「手順テスト」。3ラウンドぶんの、聞くことと・正解と・外れ。
 *  外れは**別のステージのレシピとの混同**が主力。本番は「これはステージ5だ」と教えてくれない。
 *  順番ちがいは「**まだ材料がなくて実行できない**」型だけ入れる。でたらめは入れない。 */
function stepRounds(ip, len) {
  const oc = cutOct(len), cut = cutBit(len);
  const p = ip.split(".").map(Number);
  const m = maskStr(len).split(".").map(Number);
  const bits = bin8(p[oc]).split("").map(Number);
  const keep = bits.slice(0, cut).reduce((a, c, i) => a + (c ? [128,64,32,16,8,4,2,1][i] : 0), 0);
  const rs = [
    { ask: "まず、何をしますか？",
      ok: "サブネットマスクを左から見て、はじめて 255 でなくなる数を探す",
      ng: ["IPアドレスの、いちばん右の数を 1 と 0 にする",
        "サブネットマスクを 255.255.255.255 から引く",
        `IPアドレスの数から、サブネットマスクの数を引く`],
      todo: "サブネットマスクの、その数を押す", kind: "oct", want: oc },
    { ask: "つぎは、何をしますか？",
      ok: `おなじオクテットの IPアドレスの数（${p[oc]}）を 1 と 0 にする`,
      ng: ["線から右をぜんぶ 0 にする",
        `となりのオクテットの数（${p[oc === 0 ? 1 : oc - 1]}）を 1 と 0 にする`,
        `${p[oc]} に ＋1 する`],
      todo: `${p[oc]} を 1 と 0 にして、8つのマスに入れる`, kind: "bits", want: p[oc] },
    { ask: "つぎは、何をしますか？",
      ok: "線から右をぜんぶ 0 にした数と、ぜんぶ 1 にした数を出す",
      ng: ["線から左をぜんぶ 0 にする",
        "1 と 0 をぜんぶひっくり返す",
        "ぜんぶ 0 にした数に ＋1、ぜんぶ 1 にした数に −1 する"],
      todo: "線から右のマスを、ぜんぶ 0 にする", kind: "fill", want: keep, want2: keep + restOnes(cut) },
  ];
  for (const r of rs) r.opts = shuffle([r.ok].concat(r.ng));
  return rs;
}

/** 押した2つの住所から、そのステージの答えを組み立てる。画面では計算しない。 */
function pairOut(net, bc, goal) {
  return goal === "range"
    ? `${intToIp(ipToInt(net) + 1)} 〜 ${intToIp(ipToInt(bc) - 1)}`
    : `${net} / ${bc}`;
}

/** 5ステージ・6ステージの盤。w = 押した重み。goal="host" ならホスト部、"subnet" なら基準からの延長。 */
function pickOut(w, goal, base) {
  const bits = Math.round(Math.log2(w));
  const len = goal === "host" ? 32 - bits : Math.min(30, base + bits);
  return { bits, len, out: `/${len}（${maskStr(len)}）` };
}

/** 7ステージの盤。oc = 見ているオクテット、cut = そのオクテットの上から何ビットまで同じか。 */
function stackOut(baseIp, oc, cut) {
  const len = oc * 8 + cut;
  const n = (ipToInt(baseIp) & maskInt(len)) >>> 0;
  return { len, out: `${intToIp(n)}/${len}` };
}


/* ───────── まちがいの選択肢 ─────────
   テスト（表なし）の回で使う。でたらめな値は入れない。
   **実際にやりがちな間違い**だけを入れる。そうしないと消去法で当たってしまう。 */
function wrongsOf(q) {
  const A = (ip, len, goal) => splitOut(ip, cutOct(len), cutBit(len), goal).out;
  if (q.station === "S0") {
    const { n, v } = q.board;
    // よくある間違い：1つ隣／2倍・半分をとりちがえる
    // となりの段ととりちがえる、が唯一のまちがい方。近い順に広げて4つそろえる
    const near = [];
    for (const dd of [1, -1, 2, -2, 3, -3, 4, -4]) {
      const x = n + dd;
      if (x >= 0 && x <= 7 && !near.includes(x)) near.push(x);
    }
    return q.goal === "toValue" ? near.map((x) => String(Math.pow(2, x))) : near.map(String);
  }
  if (q.station === "S9") {
    const near = [];
    for (const d of [1, -1, 2, -2, 8, -8]) {
      const n = q.board.len + d;
      if (n >= 8 && n <= 30) { const w = maskStr(n).split(".").map((v) => 255 - Number(v)).join("."); if (!near.includes(w)) near.push(w); }
    }
    near.push(maskStr(q.board.len));   // マスクとの取りちがえ
    return near;
  }
  if (q.station === "S8") {
    const len = q.board.len;
    // よくある間違い：1個ずれる／8の区切りを1つ数えまちがえる
    // 端（/8 や /30 のあたり）でも4つそろうように、近いものから広げて拾う
    const near = [];
    for (const d of [-1, 1, -8, 8, -2, 2, -4, 4, -3, 3]) {
      const n = len + d;
      if (n >= 8 && n <= 30 && !near.includes(n)) near.push(n);
    }
    return q.goal === "toMask" ? near.map((n) => maskStr(n)) : near.map((n) => `/${n}`);
  }
  if (q.station === "S3") {
    const { ip, len } = q.board;
    const n = netInt(ipToInt(ip), len), b = bcInt(ipToInt(ip), len);
    return [
      `${intToIp(n + 1)} / ${intToIp(b - 1)}`,          // 使える範囲と取りちがえた
      `${intToIp(b)} / ${intToIp(n)}`,                  // 先頭と末尾が逆
      len > 9 ? A(ip, len - 1, "both") : null,          // 線を1つ左にずらした
      len < 30 ? A(ip, len + 1, "both") : null,         // 線を1つ右にずらした
    ];
  }
  if (q.station === "S4") {
    const { ip, len } = q.board;
    const n = netInt(ipToInt(ip), len), b = bcInt(ipToInt(ip), len);
    return [
      `${intToIp(n)} 〜 ${intToIp(b)}`,                 // ±1 を忘れた
      `${intToIp(n)} 〜 ${intToIp(b - 1)}`,             // 先頭だけ忘れた
      `${intToIp(n + 1)} 〜 ${intToIp(b)}`,             // 末尾だけ忘れた
      len < 30 ? A(ip, len + 1, "range") : null,        // 線を1つずらした
    ];
  }
  if (q.station === "S5") {
    const len = Number(q.answer.match(/\/(\d+)/)[1]);
    let b2 = 0; while (Math.pow(2, b2) < q.need) b2++;   // 「2を足す」を忘れた
    return [`/${len + 1}（${maskStr(len + 1)}）`, `/${len - 1}（${maskStr(len - 1)}）`,
      `/${32 - b2}（${maskStr(32 - b2)}）`, `/${len + 2}（${maskStr(len + 2)}）`];
  }
  if (q.station === "S6") {
    const len = Number(q.answer.match(/\/(\d+)/)[1]);
    let b2 = 0; while (Math.pow(2, b2) < q.want + 2) b2++;  // 教材どおり「2を足した」場合
    return [`/${Math.min(30, q.base + b2)}（${maskStr(Math.min(30, q.base + b2))}）`,
      `/${len + 1}（${maskStr(len + 1)}）`, `/${len - 1}（${maskStr(len - 1)}）`,
      `/${q.base}（${maskStr(q.base)}）`,
      `/${len + 2}（${maskStr(len + 2)}）`, `/${len + 3}（${maskStr(len + 3)}）`];
  }
  if (q.station === "S7") {
    const [ipS, lenS] = q.answer.split("/");
    const len = Number(lenS), n = ipToInt(ipS);
    return [
      `${ipS}/${len + 1}`,                                            // 1ビット足りない
      `${ipS}/${len - 1}`,                                            // 1ビット多い
      q.board.nets[0],                                                // まとめる前のまま
      `${intToIp((n + Math.pow(2, 32 - len)) >>> 0)}/${len}`,         // 次のまとまり
      `${ipS}/${len + 2}`,                                            // 予備（選択肢を4つにそろえるため）
      len > 8 ? `${ipS}/${len - 2}` : null,
    ];
  }
  return [];
}

/* =========================================================================
   7つのステージ
   ========================================================================= */
const GEN = {};

/* ── 2の◯乗 ────────────────────────────────────────────
   128 64 32 16 8 4 2 1 は、2 を 7回・6回・…・0回かけた数。
   この対応が出てこないと、この先のステージぜんぶで手が止まる。
   練習では表をまるごと見せる（覚えるための時間）。
   テストでは表を出さず、両向きで聞く。 */
GEN.S0 = (ease) => {
  const n = ease != null && ease < 0.45 ? pick([7, 6, 5, 0, 1]) : ri(0, 7);
  const v = Math.pow(2, n);
  const goal = ease != null && ease < 0.45 ? "toValue" : pick(["toValue", "toValue", "toPower"]);
  // 練習は「見て覚える1枚」なので、この問題が出るのはテストだけ
  return {
    station: "S0",
    memorize: true,          // 丸暗記させるステージ。手順は出さない（答えだけでよい）
    given: goal === "toValue" ? [{ k: "", v: `2の${n}乗`, u: 2 }] : [{ k: "", v: String(v) }],
    prompt: goal === "toValue" ? "いくつになりますか？" : "2の何乗ですか？",
    input: "pow", goal,
    board: { n, v },
    answer: goal === "toValue" ? String(v) : String(n),
    steps: [
      { t: "2 を、その回数だけかける", v: n === 0 ? "0回かけたら 1" : Array(n).fill("2").join(" × ") + ` = ${v}` },
      { t: "並びで覚えると速い", v: "128 64 32 16 8 4 2 1" },
      { t: "答え", v: goal === "toValue" ? String(v) : `2の${n}乗` },
    ],
    tip: "1 → 2 → 4 → 8 → 16 → 32 → 64 → 128。となりへ行くたびに2倍。",
  };
};

/* ── 1ステージ 2進数 → 10進数 ─────────────────────────────────
   盤は空から始める。上の2進数を見て、盤に**写す**。
   最初から 0/1 を刷り込むと「枠の中から1を探す」動きになってしまう。 */
GEN.S1 = (ease) => {
  const v = ease != null && ease < 0.45
    ? pick([128, 192, 224, 240, 248, 252, 254, 255, 3, 7, 15, 31, 63, 127])
    : ri(1, 255);
  return {
    station: "S1",
    given: [{ k: "2進数", v: bin8(v) }],
    underline: "1",          // 目を向けてほしい桁
    prompt: "2進数を10進数に直してください",
    input: "sum",
    answer: v,
    steps: [
      { t: "下線の桁を押す", v: bin8(v) },
      { t: "その桁の重みを合計する", v: breakdown(v) },
      { t: "答え", v: String(v) },
    ],
    tip: tipOf(v),
  };
};
function breakdown(v) {
  const w = [128, 64, 32, 16, 8, 4, 2, 1].filter((x) => v & x);
  return w.length ? `${w.join(" + ")} = ${v}` : "0";
}

/* ── 2ステージ 10進数 → 2進数 ─────────────────────────────────
   教材の手順は「大きい重みから、引けるなら 1・引けないなら 0」。
   だから盤も**引き算の向き**にする。押すと残りが減り、残りが 0 になれば完成。
   引けない重みを押すと残りが赤くなる（押せなくはしない。判断は人に残す）。 */
GEN.S2 = (ease) => {
  const v = ease != null && ease < 0.45
    ? pick([128, 192, 224, 240, 248, 252, 254, 255, 31, 63, 127])
    : ri(1, 255);
  return {
    station: "S2",
    given: [{ k: "10進数", v: String(v) }],
    prompt: "10進数を2進数に直してください",
    input: "sub",
    target: v,
    answer: bin8(v),
    steps: [
      { t: "大きい重みから、引けるかどうか見る", v: "128 → 64 → 32 → …" },
      { t: "引けたら 1、引けなければ 0", v: breakdown(v) },
      { t: "並びがそのまま2進数", v: bin8(v) },
    ],
    tip: tipOf(v),
  };
};

/* ── マスクのステージ ────────────────────────────────────────
   /28 と 255.255.255.240 は同じことを言っている。
   その行き来ができないと、3ステージから先はぜんぶ手が止まる。
   向きは2つあるが、**盤は1つ**。盤の上に「/いくつ」と「マスク」の両方が出るので、
   どちらを聞かれても同じ手つきで答えられる。 */
GEN.S8 = (ease) => {
  const len = commonLen(8, 30, ease, false);
  // やさしいうちは「/ → マスク」だけ。慣れたら逆向きも混ぜる
  const goal = ease != null && ease < 0.45 ? "toMask" : pick(["toMask", "toMask", "toLen"]);
  const mask = maskStr(len);
  const full = Math.floor(len / 8), rest = len % 8;
  return {
    station: "S8",
    given: goal === "toMask"
      ? [{ k: "プレフィックス長", v: `/${len}` }]
      : [{ k: "サブネットマスク", v: mask }],
    prompt: goal === "toMask" ? "サブネットマスクに直してください" : "プレフィックス長は？",
    input: "mask", goal,
    board: { len, rest },        // rest = 8 で区切ったときの あまり
    answer: goal === "toMask" ? mask : `/${len}`,
    steps: [
      { t: "/ のうしろの数は、左から並ぶ 1 の数", v: `/${len} なら 1 が ${len} 個` },
      { t: "まず 8 で区切る", v: `${len} ÷ 8 = ${full} あまり ${rest}` },
      { t: rest ? "あまりは、上の桁から 1 にする" : "あまりが無いので、残りは 0", v: mask },
      { t: "答え", v: goal === "toMask" ? mask : `/${len}` },
    ],
    tip: null,
  };
};

/* ── ワイルドカードマスク（別枠）─────────────────────────
   255.255.255.255 から引くだけ。使う場面が違うので、ステージも分けてある。 */
GEN.S9 = (ease) => {
  const len = commonLen(16, 30, ease, false);
  const m = maskStr(len).split(".").map(Number);
  const wc = m.map((v) => 255 - v).join(".");
  return {
    station: "S9",
    given: [{ k: "サブネットマスク", v: maskStr(len) }],
    prompt: "ワイルドカードマスクは？",
    input: "wild", goal: "wild",
    board: { len },
    answer: wc,
    steps: [
      { t: "255 から、それぞれ引く", v: `${maskStr(len)} → ${wc}` },
      { t: "答え", v: wc },
    ],
    tip: "255.255.255.255 から引いた形。0 のところが「見るところ」。",
  };
};

/* ── 3ステージ 先頭と末尾（ネットワークアドレスとブロードキャストアドレス） ──
   人がやるのは2つだけ。
     ① マスクの「255 でも 0 でもない」オクテットを押す
     ② そのオクテットに縦の線を引く（マスクの値が合えば、そこが区切り）
   線から左を合計 → 先頭。線から右を全部 1 にして足す → 末尾。 */
GEN.S3 = (ease) => {
  const len = commonLen(9, 30, ease, true);
  const ip = randomIp();
  const n = ipToInt(ip);
  const net = intToIp(netInt(n, len)), bc = intToIp(bcInt(n, len));
  const oc = cutOct(len), bit = cutBit(len);
  return {
    station: "S3",
    given: [{ k: "IPアドレス", v: ip }, { k: "サブネットマスク", v: maskStr(len) }],
    prompt: "ネットワークアドレスとブロードキャストアドレスは？",
    input: "split", goal: "both",
    board: { ip, len },
    answer: `${net} / ${bc}`,
    steps: [
      { t: "サブネットマスクを左から見て、255 でない数", v: `${maskStr(len).split(".")[oc]}` },
      { t: "その数を 1 と 0 にする", v: `${maskStr(len).split(".")[oc]} → ${bin8(Number(maskStr(len).split(".")[oc]))}` },
      { t: "いちばん右の 1 のうしろに線", v: `上から ${bit} 個ぶん` },
      { t: "IP の同じところで、線から右をぜんぶ 0", v: net },
      { t: "線から右をぜんぶ 1", v: bc },
    ],
    tip: "ネットワークアドレスは、その範囲のいちばん小さい数。ブロードキャストアドレスはいちばん大きい数。",
  };
};

/* ── 4ステージ 使えるアドレスの範囲 ────────────────────────────
   3ステージと同じ盤。先頭＋1 から 末尾−1 まで。 */
GEN.S4 = (ease) => {
  const len = commonLen(9, 30, ease, true);
  const ip = randomIp();
  const n = ipToInt(ip);
  const net = netInt(n, len), bc = bcInt(n, len);
  return {
    station: "S4",
    given: [{ k: "IPアドレス", v: `${ip}/${len}` }],
    prompt: "ホストとして使えるアドレスの範囲は？",
    input: "split", goal: "range",
    board: { ip, len },
    answer: `${intToIp(net + 1)} 〜 ${intToIp(bc - 1)}`,
    steps: [
      { t: "線から右をぜんぶ 0 → ネットワークアドレス（使えない）", v: intToIp(net) },
      { t: "線から右をぜんぶ 1 → ブロードキャストアドレス（使えない）", v: intToIp(bc) },
      { t: "その1つ内側どうしが、使えるところ", v: `${intToIp(net + 1)} 〜 ${intToIp(bc - 1)}` },
    ],
    tip: "ネットワークアドレスとブロードキャストアドレスは機械に付けられない。だから使える数は2つ減る。",
  };
};

/* ── 5ステージ 必要な台数 → サブネットマスク ──────────────────
   教材どおり。必要な台数に 2 を足して（先頭と末尾のぶん）、
   盤を**右（小さい方）から**見て、その数以上になる最初の重みを押す。 */
GEN.S5 = (ease) => {
  const need = ease != null && ease < 0.45
    ? pick([10, 20, 30, 50, 60, 100])
    : pick([12, 24, 25, 30, 47, 50, 60, 100, 120, 200, 250, 300, 500, 531, 600, 1000]);
  const want = need + 2;
  let bits = 0;
  while (Math.pow(2, bits) < want) bits++;
  const len = 32 - bits;
  return {
    station: "S5",
    given: [{ k: "必要なホスト数", v: `${need} 台` }],
    prompt: "この台数が入るサブネットマスクは？",
    input: "pick", goal: "host",
    need, want,
    answer: `/${len}（${maskStr(len)}）`,
    steps: [
      { t: "ネットワークアドレスとブロードキャストアドレスのぶんで ＋2", v: `${need} + 2 = ${want}` },
      { t: `${want} が入る、いちばん小さいところを押す`, v: String(Math.pow(2, bits)) },
      { t: "そこがホスト部の桁数", v: `${bits} 桁` },
      { t: "答え", v: `/${len}（${maskStr(len)}）` },
    ],
    tip: null,
  };
};

/* ── 6ステージ 必要なサブネット数 → サブネットマスク ────────────
   5ステージと同じ手順。基準（クラスのマスク）から、必要なビットぶん延ばす。
   **教材は必要な数に 2 を足しているが、ここでは足さない。**
   2 を足すのはサブネットゼロが使えなかった時代の数え方で、いまの試験では使わない。 */
const CLASS_BASE = { A: 8, B: 16, C: 24 };
GEN.S6 = (ease) => {
  const cls = pick(["B", "B", "C", "A"]);
  const base = CLASS_BASE[cls];
  const want = ease != null && ease < 0.45 ? pick([2, 4, 8, 16]) : pick([3, 5, 6, 10, 12, 19, 20, 30, 60]);
  let bits = 0;
  while (Math.pow(2, bits) < want) bits++;
  const len = Math.min(30, base + bits);
  return {
    station: "S6",
    given: [{ k: "使うアドレス", v: `クラス${cls}（/${base} から）` }, { k: "必要なサブネット数", v: `${want} 個` }],
    prompt: "このサブネット数が作れるサブネットマスクは？",
    input: "pick", goal: "subnet", cls,
    need: want, want, base,
    answer: `/${len}（${maskStr(len)}）`,
    steps: [
      { t: `${want} が作れる、いちばん小さいところを押す`, v: String(Math.pow(2, bits)) },
      { t: "そのぶん、うしろに延ばす", v: `${bits} 桁` },
      { t: `クラス${cls} の /${base} から`, v: `/${base} + ${bits} = /${len}` },
      { t: "答え", v: `/${len}（${maskStr(len)}）` },
    ],
    tip: "教材では必要な数に 2 を足しているが、それは昔の決まり。いまの試験では足さない（台数のほうの 2 は今も足す）。",
  };
};

/* ── 7ステージ まとめる（アドレス集約） ────────────────────────
   2進を縦に並べて、**同じでなくなるところ**に線を引く。線から左が集約したアドレス。 */
GEN.S7 = (ease) => {
  const inLen = ease != null && ease < 0.45 ? 24 : pick([24, 24, 24, 29, 26, 16]);
  // やさしいときは必ず4つ。2段だけだと「縦に並べて見比べる」手つきが伝わらない
  const count = ease != null && ease < 0.45 ? 4 : pick([2, 4, 4, 8]);
  const bits = Math.round(Math.log2(count));
  const outLen = inLen - bits;
  const base = netInt(ipToInt(randomIp()), outLen);
  const step = Math.pow(2, 32 - inLen);
  const nets = [];
  for (let i = 0; i < count; i++) nets.push(`${intToIp((base + i * step) >>> 0)}/${inLen}`);
  // 見るオクテットは「線が入るオクテット」。
  // /24 のように線がオクテットの境目にくるときは、**手前のオクテット**を見る。
  // （そこは8ビットとも同じ。そうしないと「0ビット目まで同じ」になり、盤の上で線が引けない）
  const oc = Math.floor((outLen - 1) / 8);
  return {
    station: "S7",
    given: nets.map((v, i) => ({ k: `${i + 1}つ目`, v })),
    prompt: "この範囲を1つのアドレスにまとめると？",
    input: "stack",
    board: { nets, oc, outLen },
    answer: `${intToIp(base)}/${outLen}`,
    steps: [
      { t: "4つを見くらべて、違っているところ", v: `${oc + 1}つ目` },
      { t: "そこを縦に見て、4つとも同じところまで", v: `上から ${outLen - oc * 8} 桁ぶん同じ` },
      { t: "線から左が、まとめたアドレス", v: `${intToIp(base)}/${outLen}` },
    ],
    tip: null,
  };
};

/* =========================================================================
   ステージの一覧。教材の①〜⑦の順。前が分からないと次は解けない。
   ========================================================================= */
/** ステージの並び。番号は並び順から出す（差し込んでも付け直しの手間が要らない）。
 *  記録は id で持っているので、順番が変わっても前の記録は生きたまま。 */
const STATIONS = [
  // すべての土台。2 を何回かけたか、と 128〜1 の対応。ここが体に入っていないと全部が遅い
  { id: "S0", name: "2の◯乗", ex: "2の7乗 → 128", need: [] },
  { id: "S1", name: "2進数 → 10進数", ex: "10011101 → 157", need: ["S0"] },
  { id: "S2", name: "10進数 → 2進数", ex: "149 → 10010101", need: ["S1"] },
  // /28 と 255.255.255.240 の行き来。ここができないと3ステージから先が丸ごと解けない
  { id: "S8", name: "プレフィックス長 ↔ サブネットマスク", ex: "/28 → 255.255.255.240", need: ["S2"] },
  { id: "S3", name: "ネットワークアドレスとブロードキャストアドレス", ex: "…10.135 / 255.255.255.224 → …128 と …159", need: ["S8"] },
  { id: "S4", name: "使えるアドレスの範囲", ex: "172.16.29.146/22 → …28.1 〜 …31.254", need: ["S3"] },
  { id: "S5", name: "台数 → サブネットマスク", ex: "24台 → /27", need: ["S8"] },
  { id: "S6", name: "サブネット数 → サブネットマスク", ex: "クラスB で10個 → /20", need: ["S5"] },
  { id: "S7", name: "まとめる（集約）", ex: "…168.0/24 〜 …171.0/24 → …168.0/22", need: ["S3"] },
  // 別枠。ACL と OSPF で使う。サブネット計算の流れには混ぜない
  { id: "S9", name: "ワイルドカードマスク", ex: "255.255.255.192 → 0.0.0.63", need: ["S8"] },
];
STATIONS.forEach((s, i) => { s.no = i + 1; });

/** 解き方の短い説明。練習の1枚の冒頭に出す。**読んだらすぐ手が動く長さ**に切りつめる。 */
/** 説明の1枚に出す1行。**言葉で教えるのではなく、覚える表を見せるための一言。** */
/** 説明の1枚に出す1行。**何を覚えると、何が即答できるようになるか。** */
const HOW = {
  S0: "まず、この表を丸暗記します。128 64 32 16 8 4 2 1 の並びは、この先の全部のステージで出てきます。",
  S1: "1 の桁の重みを足すだけです。10011101 なら 128 + 16 + 8 + 4 + 1 = 157。",
  S2: "大きい重みから順に、引けたら 1、引けなければ 0。149 なら 128 が引けて 1、残りは 21。",
  S8: "/ の数を、まず 8 で区切ります。8個そろったオクテットは、全部 1 なので 255。あまりは、次のオクテットで左から 1 が並びます。",
  S3: "線から右をぜんぶ 0 にすると、その範囲のいちばん小さい数。ぜんぶ 1 にすると、いちばん大きい数になります。",
  S4: "ネットワークアドレスとブロードキャストアドレスは、ホストには使えません。その1つ内側どうしが、使える範囲です。新しく覚えることはこれだけです。",
  S5: "プレフィックス長ごとの「使えるホスト数」の階段を丸暗記します。どれも 2の◯乗 − 2 の形です。",
  S6: "1桁のばすごとに、サブネットの数は2倍になります。出発点はクラスで決まります。A は /8、B は /16、C は /24。",
  S7: "2つなら / を 1 減らす、4つなら 2、8つなら 3。確かめたいときは、2進数を縦に並べます。",
  S9: "ワイルドカードマスクは、サブネットマスクを 255 から引いた形です。ACL と OSPF の設定で使います。",
};

/** 説明の1枚のいちばん上。**前のステージで覚えた何を、ここでそのまま使うのか。** */
const LINK = {
  S1: "ステージ1で覚えた 128 64 32 16 8 4 2 1 を、桁の重みとして使います。",
  S2: "前のステージと同じ表を、逆向きに使います。",
  S8: "240 = 11110000 は、前のステージの引き算で作れました。ここでは、その計算をそのまま使います。",
  S3: "前のステージで覚えた 224 = 11100000 を、そのまま使います。2進数に直す手間がここで消えます。",
  S4: "前のステージの答えが、そのまま材料です。",
  S5: "台数に 2 を足すのは、前のステージの両はし（ネットワークアドレスとブロードキャストアドレス）のぶんです。",
  S6: "「必要な数が入る、いちばん小さい 2の◯乗」を探すのは前のステージと同じです。こんどは 2 を足しません。",
  S7: "前のステージでは、のばすたびにサブネットが2倍に増えました。まとめるのはその逆です。",
  S9: "ステージ4で覚えた8つの数に、相方を1つずつ付けます。相方は 255 − その数です。",
};

/** 結果の画面で、はじめてできたときだけ1行。**次にどう生きるか。** */
const NEXT = {
  S0: "つぎのステージでは、この 128 64 32 16 8 4 2 1 が「2進数の桁の重み」として出てきます。",
  S1: "つぎのステージは、これの逆向きです。同じ表で、足すかわりに引きます。",
  S2: "つぎのステージでは、この引き算で 255 や 240 を 1 の並びに直します。同じやり方がそのまま使えます。",
  S8: "ここから先は、問題文が /28 でも 255.255.255.240 でも、同じ問題に見えるようになります。",
  S3: "つぎのステージは、この2つの答えに ＋1 と −1 するだけです。",
  S4: "つぎのステージに出てくる「＋2」の正体はこれです。両はしの2つが使えないので、台数に 2 を足します。",
  S5: "つぎのステージも同じ動きです。必要な数が入る 2の◯乗 を探します。ただしサブネットの数には 2 を足しません。",
  S6: "つぎのステージは、これの逆向きです。まとめると / の数が減ります。",
  S7: "サブネットの計算はここで一周です。ステージ10は、設定で使う別の道具です。",
};

/** ステージ5だけ、表の下に例を1行。ここが「何の役に立つのか」がいちばん見えにくい。 */
const EXLINE = {};


/* 教材に載っている見本。数字は教材のまま。 */
const EXAMPLES = {
  S0: { title: "2 を何回かけた数か", rows: [
    ["2の0乗", "1"],
    ["2の1乗", "2"],
    ["2の2乗", "4"],
    ["2の3乗", "8"],
    ["2の4乗", "16"],
    ["2の5乗", "32"],
    ["2の6乗", "64"],
    ["2の7乗", "128"]] },
  S1: { title: "10011101 を10進数に", rows: [
    ["盤に写す", "1 0 0 1 1 1 0 1"],
    ["1 の桁の重み", "128 ・ 16 ・ 8 ・ 4 ・ 1"],
    ["合計", "128 + 16 + 8 + 4 + 1 = 157"]] },
  S2: { title: "149 を2進数に", rows: [
    ["128 は引ける", "149 − 128 = 21　→ 1"],
    ["64 32 は引けない", "→ 0 0"],
    ["16 は引ける", "21 − 16 = 5　→ 1"],
    ["8 は引けない", "→ 0"],
    ["4 は引ける", "5 − 4 = 1　→ 1"],
    ["2 は引けない", "→ 0"],
    ["1 は引ける", "1 − 1 = 0　→ 1"],
    ["並び", "10010101"]] },
  S3: { title: "192.168.10.135 / 255.255.255.224", rows: [
    ["サブネットマスクの 255 でない数", "いちばん右の 224"],
    ["224 を2進に", "111|00000　→ 上から3ビット"],
    ["135 を2進に", "100|00111"],
    ["線から左を合計", "128　→ 192.168.10.128"],
    ["線から右を全部 1 に", "16+8+4+2+1 = 31"],
    ["足す", "128 + 31 = 159　→ 192.168.10.159"]] },
  S4: { title: "172.16.29.146/22", rows: [
    ["先頭", "172.16.28.0"],
    ["末尾", "172.16.31.255"],
    ["使える範囲", "172.16.28.1 〜 172.16.31.254"]] },
  S5: { title: "1つのサブネットに24台", rows: [
    ["2 を足す", "24 + 2 = 26"],
    ["右から見て 26 以上", "32（2の5乗）"],
    ["ホスト部", "5 ビット"],
    ["答え", "255.255.255.224　/27"]] },
  S6: { title: "クラスB で10個のサブネット", rows: [
    ["右から見て 10 以上", "16（2の4乗）"],
    ["延ばすビット", "4 ビット"],
    ["基準から", "/16 + 4 = /20"],
    ["答え", "255.255.240.0　/20"],
    ["※ 教材との違い", "教材は 10 に 2 を足しているが、いまの試験では足さない"]] },
  S8: { title: "/28 をサブネットマスクに", rows: [
    ["/28 は 1 が 28 個", "左からつめて並べる"],
    ["8 個で 255 が1つ", "28 ÷ 8 = 3 あまり 4"],
    ["255 が3つ", "255.255.255."],
    ["あまり4個は上の桁から", "11110000 = 240"],
    ["答え", "255.255.255.240"]] },
  S9: { title: "255.255.255.192 のワイルドカードマスク", rows: [
    ["255 から引く", "255 − 255 = 0"],
    ["", "255 − 192 = 63"],
    ["答え", "0.0.0.63"]] },
  S7: { title: "172.16.168.0/24 〜 172.16.171.0/24", rows: [
    ["3つ目の数を縦に", "168 = 101010|00"],
    ["", "169 = 101010|01"],
    ["", "170 = 101010|10"],
    ["", "171 = 101010|11"],
    ["同じなのは6ビット目まで", "16 + 6 = 22"],
    ["答え", "172.16.168.0/22"]] },
};

/** 1問つくる。
 *  ease … 「5問の中の位置」（0 が最初、1 が最後）。前半はやさしい数にする
 *  test … 表なしの回。3〜7ステージは答えを打つのが重いので、選ぶ形にする
 *          （本番の CCNA も選択式。まちがいの選択肢はよくある間違いから作る） */
function makeQuestion(stationId, ease, test, goal, steps) {
  const g = GEN[stationId];
  if (!g) throw new Error("unknown station: " + stationId);
  let q = g(ease);
  // 向きを指定されたら、その向きが出るまで作り直す（両向きを並べて見せるとき）
  for (let i = 0; goal && q.goal !== goal && i < 60; i++) q = g(ease);
  // 手順つき（練習の中で使う）。最後は4択で締めるので、選択肢も作る
  if (steps && stationId === "S3") {
    q.steps5 = stepRounds(q.board.ip, q.board.len);
    const w = wrongsOf(q).filter((x) => x && x !== q.answer);
    const out = [String(q.answer)];
    for (const x of shuffle(w)) { if (out.length >= 4) break; if (!out.includes(x)) out.push(x); }
    q.choices = shuffle(out);
  }
  if (test) {
    q.test = true;
    // プレフィックス長↔サブネットマスクは、自分で書く（選ぶと消去法で当たる）
    if (stationId === "S8") return q;
    const w = wrongsOf(q).filter((x) => x && x !== q.answer);
    if (w.length) {
      const out = [String(q.answer)];
      for (const x of shuffle(w)) { if (out.length >= 4) break; if (!out.includes(x)) out.push(x); }
      q.choices = shuffle(out);
    }
  }
  return q;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { STATIONS, EXAMPLES, HOW, LINK, NEXT, EXLINE, GEN, addrWith, pairOut, restOnes, stepRounds, makeQuestion, wrongsOf, splitOut, pickOut, stackOut, maskBoardOut,
    ipToInt, intToIp, maskStr, netInt, bcInt, bin8, cutOct, cutBit, breakdown };
}
