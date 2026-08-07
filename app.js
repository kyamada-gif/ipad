/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */
const { useState, useEffect, useRef } = React;
/*
 * IPアドレスの計算（試作2）
 *
 * ■ 背骨 ── 盤は1つ、線は1本
 *   教材PDFは「桁の重み表」を1つ出して、7つの手順すべてをその上でやる。
 *   このアプリも同じ。画面の中心にいつも盤がある。
 *   **人がやるのは、どれを押すか／どこに線を引くか だけ。**
 *   足し算と10進への変換は機械がやる。暗算は求めない。
 *
 * ■ 覚えることは3つの状態だけ
 *   ○ まだ　　● できた（5問中4問）　　★ 手が動く（もう一度 4問）
 *
 * ■ 画面
 *   ホーム（7ステージの道）→ 練習（5問）→ 結果
 *   トップ画面にステージの札が並ぶ。札を押すと、そのステージの入口が開く。
 */

const DRILL_QN = 5; // 練習は5問（手を動かして慣れる場）
const TEST_QN = 10; // テストは10問（本番と同じ形で測る場）
const FINAL_QN = 15; // 仕上げだけ15問（8つの型を一通り出してから、もう一巡）
const DRILL_N = 4; // 練習：5問中4問で ● できた
/** その回の問題数。仕上げのテストだけ多い。 */
const sizeOf = (test, station) => !test ? DRILL_QN : station === "SF" ? FINAL_QN : TEST_QN;
/** その問題の「材料」。同じものを1回の中で繰り返さないために使う。 */
const keyOf = q => q.given.map(g => g.v).join("|");
/** その回の合格ライン。練習は8割、テストは9割。
 *  **問題数から出す。**前は 9 と直に書いていたので、15問にしたときに 9/15 のままになるところだった
 *  （10問→9問、15問→14問。どちらも「まちがえてよいのは1問」でそろう）。 */
const needOf = (test, station) => test ? Math.ceil(sizeOf(test, station) * 0.9) : DRILL_N;
const KEY = "ipcalc2-progress";
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
};
const save = p => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {}
};

// 選んだモードは覚えておく。開くたびに選び直させない
// お試し用。全部のステージを開けて回れるようにする（記録のランプは正直なまま）
const UKEY = "ipcalc2-unlock";
const loadUnlock = () => {
  try {
    return localStorage.getItem(UKEY) === "1";
  } catch (e) {
    return false;
  }
};
const saveUnlock = u => {
  try {
    localStorage.setItem(UKEY, u ? "1" : "0");
  } catch (e) {}
};

/* ── 書き出し用の記録 ──────────────────────────────────────
   `ipcalc2-progress` は**いまの状態**（開いたか・合格したか・最速）しか持たない。
   seen と correct は練習とテストの合計なので、**そこからテストの点は取り出せない。**
   だからテストを1回終えるごとに、この表に1行足す。**進み具合の表には触らない。** */
const TKEY = "ipcalc2-tests";
const loadTests = () => {
  try {
    return JSON.parse(localStorage.getItem(TKEY)) || [];
  } catch (e) {
    return [];
  }
};
const saveTests = t => {
  try {
    localStorage.setItem(TKEY, JSON.stringify(t));
  } catch (e) {}
};
const TEST_MAX = 300; // 端末の中がいっぱいにならないよう、古いものから捨てる

// 名前とメール。**書き出すときだけ使う。**端末の中に置くだけで、どこへも送らない
const MEKEY = "ipcalc2-me";
const loadMe = () => {
  try {
    return JSON.parse(localStorage.getItem(MEKEY)) || {
      name: "",
      email: ""
    };
  } catch (e) {
    return {
      name: "",
      email: ""
    };
  }
};
const saveMe = m => {
  try {
    localStorage.setItem(MEKEY, JSON.stringify(m));
  } catch (e) {}
};

/** その端末の時計で「2026-08-07T15:40:12+09:00」の形にする。
 *  UTC に直すと、受け取った側が何時にやったのか分からなくなる */
function nowIso() {
  const d = new Date(),
    z = -d.getTimezoneOffset();
  const p = n => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` + `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` + `${z < 0 ? "-" : "+"}${p(z / 60)}:${p(z % 60)}`;
}
const byId = id => STATIONS.find(s => s.id === id);
const isLit = (p, id) => !!(p[id] && p[id].lit);
const isSolo = (p, id) => !!(p[id] && p[id].solo);
const isOpen = (p, st) => st.need.every(n => isLit(p, n));
const buzz = ms => {
  try {
    navigator.vibrate && navigator.vibrate(ms);
  } catch (e) {}
};
const toTop = y => {
  try {
    window.scrollTo(0, y || 0);
  } catch (e) {}
};
const W8 = [128, 64, 32, 16, 8, 4, 2, 1];

/* =========================================================================
   ホーム ── 7ステージの道
   -------------------------------------------------------------------------
   ステージごとに「練習する」「テストをする」の2つ。**どちらでやるかは、その場で選ぶ。**
   画面ぜんたいの切り替えをやめたのは、いま自分がどちらの世界にいるのかを
   覚えておかないといけなかったから。ボタンが2つ並んでいれば、覚えなくてよい。
   ========================================================================= */
function Home({
  progress,
  unlock,
  onUnlock,
  onStart,
  onExport
}) {
  const [blocked, setBlocked] = useState(null);
  const [pick, setPick] = useState(null); // いま開いている札
  const [tip, setTip] = useState(null); // コツを開いている札（札の開け閉めとは別）
  const doneT = STATIONS.filter(s => isSolo(progress, s.id)).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("header", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-t"
  }, "IP\u30A2\u30C9\u30EC\u30B9\u306E\u8A08\u7B97"), /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-in",
    style: {
      width: doneT / STATIONS.length * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-n"
  }, "\uD83C\uDFC5 ", doneT, " / ", STATIONS.length)), /*#__PURE__*/React.createElement("div", {
    className: "road"
  }, STATIONS.map((s, i) => {
    // 10個の札がただ並んでいると、どこからが本番の話か分からない。
    // 基礎（1〜4）／試験レベル（5〜9）／仕上げ（10）で区切る
    const g = GROUPS.find(x => x.at === s.id);
    const solo = isSolo(progress, s.id),
      lit = isLit(progress, s.id);
    const open = unlock || isOpen(progress, s);
    // 仕上げだけは練習が無い。説明の1枚を見たら、そのままテストへ
    const hasDrill = s.drill !== false;
    // テストは、練習でできてから。手順を知らないまま4択をやっても、
    // 4回に1回当たるだけで記録が汚れる。
    // **練習が無いステージは、開いた時点でテストに入れる**
    //（そうしないと lit にならないので、永久に開かない）
    const canTest = unlock || lit || !hasDrill;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id
    }, g && /*#__PURE__*/React.createElement("div", {
      className: "gsec"
    }, /*#__PURE__*/React.createElement("div", {
      className: "gname"
    }, g.name, /*#__PURE__*/React.createElement("span", {
      className: "gnum"
    }, "\u30B9\u30C6\u30FC\u30B8 ", g.from, g.to > g.from ? ` 〜 ${g.to}` : "")), /*#__PURE__*/React.createElement("div", {
      className: "gnote"
    }, g.note)), i > 0 && !g && /*#__PURE__*/React.createElement("div", {
      className: "link"
    }), /*#__PURE__*/React.createElement("div", {
      className: "tile" + (open ? "" : " locked") + (lit ? " lit" : "") + (solo ? " solo" : "") + (pick === s.id ? " pick" : "")
    }, /*#__PURE__*/React.createElement("div", {
      className: "t-top"
    }, /*#__PURE__*/React.createElement("button", {
      className: "t-h",
      onClick: () => {
        setPick(pick === s.id ? null : s.id);
        setBlocked(null);
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "lamp"
    }, open ? lit ? "●" : "○" : "🔒"), /*#__PURE__*/React.createElement("span", {
      className: "t-b"
    }, /*#__PURE__*/React.createElement("span", {
      className: "t-name"
    }, s.no, "\u3000", s.name), /*#__PURE__*/React.createElement("span", {
      className: "t-ex"
    }, s.ex))), /*#__PURE__*/React.createElement("span", {
      className: "slot" + (solo ? " got" : "")
    }, solo ? "🏅" : "")), s.tip && open && /*#__PURE__*/React.createElement("button", {
      className: "t-tip" + (tip === s.id ? " on" : ""),
      onClick: () => setTip(tip === s.id ? null : s.id)
    }, /*#__PURE__*/React.createElement("span", null, s.tip.label), /*#__PURE__*/React.createElement("span", {
      className: "t-tip-m"
    }, tip === s.id ? "−" : "＋")), tip === s.id && s.tip && open && /*#__PURE__*/React.createElement(TipBody, {
      tip: s.tip
    }), pick === s.id && open &&
    /*#__PURE__*/
    /* 仕上げは練習が無いので、入口は1つだけ。
       押すと説明の1枚（本番で聞かれる8つの形）が出て、その下がテストへの入口になる */
    React.createElement("div", {
      className: "t-go"
    }, /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: () => onStart(s.id, null)
    }, hasDrill ? "練習をする" : "はじめる"), hasDrill && /*#__PURE__*/React.createElement("button", {
      className: "go" + (canTest ? "" : " off"),
      onClick: () => canTest ? onStart(s.id, true) : setBlocked(blocked === s.id ? null : s.id)
    }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B"))), pick === s.id && !open && /*#__PURE__*/React.createElement("div", {
      className: "blocked"
    }, s.need.map(n => byId(n).name).join(" と "), " \u304C\u3067\u304D\u308B\u3068\u958B\u304D\u307E\u3059"), blocked === s.id && open && /*#__PURE__*/React.createElement("div", {
      className: "blocked"
    }, "\u5148\u306B\u7DF4\u7FD2\u3067\u3067\u304D\u308B\u3068\u3001\u30C6\u30B9\u30C8\u304C\u958B\u304D\u307E\u3059"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, "\u25CB \u307E\u3060\u3000\u3000\u25CF \u7DF4\u7FD2\u304C\u3067\u304D\u305F\u3000\u3000\uD83C\uDFC5 \u30D0\u30C3\u30B8\uFF08\u30C6\u30B9\u30C8\u30679\u5272\uFF09"), /*#__PURE__*/React.createElement("button", {
    className: "unlock" + (unlock ? " on" : ""),
    onClick: () => onUnlock(!unlock)
  }, unlock ? "鍵をかけ直す" : "全部開く（お試し）"), /*#__PURE__*/React.createElement("button", {
    className: "unlock",
    onClick: onExport
  }, "\u5B66\u7FD2\u306E\u8A18\u9332\u3092\u66F8\u304D\u51FA\u3059"));
}

/** 札の中で開く「コツ」の中身。データは gen.js の STATIONS の tip。
 *  **解き方はここに書かない。**教材の手順で解けるようになったうえで、
 *  足し算を省ける形だけを置く。閉じているのが最初の姿。 */
function TipBody({
  tip
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "tipb-b"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tipb-s"
  }, tip.sub), tip.parts.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "tip-p"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tip-h"
  }, p.h), /*#__PURE__*/React.createElement("div", {
    className: "tip-s"
  }, p.b), p.rows.map(([k, v], j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    className: "tip-r"
  }, /*#__PURE__*/React.createElement("b", null, k), /*#__PURE__*/React.createElement("i", {
    className: "tip-a"
  }, "\u2192"), /*#__PURE__*/React.createElement("span", null, v))))));
}

/* =========================================================================
   学習の記録を書き出す
   -------------------------------------------------------------------------
   受け取った側が、ステージの並びも名前も知らないまま読めるようにする。
   だから stations（id・番号・名前）も一緒に入れる。
   ========================================================================= */
/** 書き出す中身。**計算はここ1か所。**画面とファイルで中身が違う、を起こさない。
 *
 *  progress は、端末の中では**触ったステージの分しか無く、まだ出ていない項目はキーごと無い。**
 *  そのまま出すと、受け取る側が「無いのか、0なのか」を毎回考えることになる。
 *  だから**10ステージぶんを、7項目そろえて**出す。無い数は null（0 ではない。
 *  0 だと「0.0秒で解いた」と区別が付かない）。 */
function exportData(me) {
  const p = load();
  const progress = {};
  for (const s of STATIONS) {
    const c = p[s.id] || {};
    const ms = v => typeof v === "number" ? v : null;
    progress[s.id] = {
      seen: c.seen || 0,
      correct: c.correct || 0,
      lit: !!c.lit,
      solo: !!c.solo,
      bestMs: ms(c.bestMs),
      testBestMs: ms(c.testBestMs),
      lastMs: ms(c.lastMs)
    };
  }
  return {
    app: "ipcalc2",
    name: me.name || "",
    email: me.email || "",
    exportedAt: nowIso(),
    stations: STATIONS.map(s => ({
      id: s.id,
      no: s.no,
      name: s.name
    })),
    progress,
    tests: loadTests()
  };
}
function ExportScreen({
  onHome
}) {
  const [me, setMe] = useState(loadMe);
  const [done, setDone] = useState(null); // 何をしたか。押したあとの1行
  const data = exportData(me);
  const text = JSON.stringify(data, null, 2);
  const fname = `ipcalc2_${data.exportedAt.slice(0, 10)}.json`;
  const nTest = data.tests.length;
  const nSolo = STATIONS.filter(s => isSolo(data.progress, s.id)).length;
  const put = (k, v) => {
    const m = {
      ...me,
      [k]: v
    };
    setMe(m);
    saveMe(m);
    setDone(null);
  };

  /** ファイルに保存。端末の中で作って、そのまま渡すだけ（どこへも送らない） */
  const toFile = () => {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], {
        type: "application/json"
      }));
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setDone(`${fname} を保存しました`);
    } catch (e) {
      setDone("この画面では保存できません。下の文字を選んでコピーしてください");
    }
  };
  const toClip = () => {
    try {
      navigator.clipboard.writeText(text).then(() => setDone("コピーしました")).catch(() => setDone("コピーできません。下の文字を選んでコピーしてください"));
    } catch (e) {
      setDone("コピーできません。下の文字を選んでコピーしてください");
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap sheet-p"
  }, /*#__PURE__*/React.createElement("div", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onHome
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "mkind"
  }, "\u5B66\u7FD2\u306E\u8A18\u9332"), /*#__PURE__*/React.createElement("div", {
    className: "mtitle"
  }, "\u8A18\u9332\u3092\u66F8\u304D\u51FA\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "msub2"
  }, "\u3053\u306E\u7AEF\u672B\u306E\u4E2D\u306B\u3042\u308B\u8A18\u9332\u3092\u3001\u30D5\u30A1\u30A4\u30EB1\u3064\u306B\u307E\u3068\u3081\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "rule"
  }), /*#__PURE__*/React.createElement(Sec, {
    label: "\u66F8\u304D\u51FA\u3059\u4E2D\u8EAB"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ex-r"
  }, /*#__PURE__*/React.createElement("i", {
    className: "ex-n"
  }), /*#__PURE__*/React.createElement("span", null, "\u30B9\u30C6\u30FC\u30B8"), /*#__PURE__*/React.createElement("b", null, STATIONS.length)), /*#__PURE__*/React.createElement("div", {
    className: "ex-r"
  }, /*#__PURE__*/React.createElement("i", {
    className: "ex-n"
  }), /*#__PURE__*/React.createElement("span", null, "\u30D0\u30C3\u30B8\u3092\u53D6\u3063\u305F\u6570"), /*#__PURE__*/React.createElement("b", null, nSolo)), /*#__PURE__*/React.createElement("div", {
    className: "ex-r"
  }, /*#__PURE__*/React.createElement("i", {
    className: "ex-n"
  }), /*#__PURE__*/React.createElement("span", null, "\u30C6\u30B9\u30C8\u3092\u53D7\u3051\u305F\u56DE\u6570"), /*#__PURE__*/React.createElement("b", null, nTest)), /*#__PURE__*/React.createElement("div", {
    className: "ex-note"
  }, "\u203B \u30C6\u30B9\u30C8\u306E1\u56DE\u3054\u3068\u306E\u8A18\u9332\u306F\u3001\u3053\u306E\u4ED5\u7D44\u307F\u3092\u5165\u308C\u305F\u3042\u3068\u306B\u53D7\u3051\u305F\u5206\u3060\u3051\u3067\u3059\u3002")), /*#__PURE__*/React.createElement(Sec, {
    label: "\u540D\u524D\u3068\u30E1\u30FC\u30EB"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-b"
  }, "\u5165\u308C\u305F\u5185\u5BB9\u306F\u3053\u306E\u7AEF\u672B\u306E\u4E2D\u3060\u3051\u306B\u6B8B\u308A\u307E\u3059\u3002\u6B21\u306B\u958B\u3044\u305F\u3068\u304D\u306F\u3001\u305D\u306E\u307E\u307E\u51FA\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("label", {
    className: "fld"
  }, /*#__PURE__*/React.createElement("span", null, "\u540D\u524D"), /*#__PURE__*/React.createElement("input", {
    className: "fld-i",
    type: "text",
    value: me.name,
    placeholder: "\u5C71\u7530\u592A\u90CE",
    onChange: e => put("name", e.target.value)
  })), /*#__PURE__*/React.createElement("label", {
    className: "fld"
  }, /*#__PURE__*/React.createElement("span", null, "\u30E1\u30FC\u30EB"), /*#__PURE__*/React.createElement("input", {
    className: "fld-i",
    type: "email",
    value: me.email,
    placeholder: "yamada@example.com",
    onChange: e => put("email", e.target.value)
  }))), /*#__PURE__*/React.createElement(Sec, {
    label: "\u66F8\u304D\u51FA\u3059"
  }, /*#__PURE__*/React.createElement("div", {
    className: "t-go"
  }, /*#__PURE__*/React.createElement("button", {
    className: "go",
    onClick: toFile
  }, "\u30D5\u30A1\u30A4\u30EB\u306B\u4FDD\u5B58"), /*#__PURE__*/React.createElement("button", {
    className: "go",
    onClick: toClip
  }, "\u6587\u5B57\u3092\u30B3\u30D4\u30FC")), done && /*#__PURE__*/React.createElement("div", {
    className: "exp-done"
  }, done), /*#__PURE__*/React.createElement("div", {
    className: "sec-b"
  }, "\u3046\u307E\u304F\u3044\u304B\u306A\u3044\u3068\u304D\u306F\u3001\u4E0B\u306E\u6587\u5B57\u3092\u9078\u3093\u3067\u30B3\u30D4\u30FC\u3057\u3066\u304F\u3060\u3055\u3044\u3002"), /*#__PURE__*/React.createElement("textarea", {
    className: "exp-t",
    readOnly: true,
    value: text
  })));
}

/* =========================================================================
   練習
   ========================================================================= */
/* ── 材料の枠 ────────────────────────────────────────────
   **チュートリアルと練習で同じ物を使う。**別々に書いていたころは、
   並び順が逆で、下線もチュートリアルだけ出ていなかった。
   盤の中に同じ数が並ぶステージ（ステージ5・6）では出さない。二重になって目が往復する。 */
function Given({
  q,
  test
}) {
  // 盤（SplitBoard）の中に同じIPとマスクが並ぶときだけ、二重になるので出さない。
  // **テストと手順つきは盤を使わない。**そこで消すと、問題そのものが画面から消える
  if (q.input === "split" && !test && !q.steps5) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "given"
  }, q.given.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "grow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gk"
  }, g.k), /*#__PURE__*/React.createElement("span", {
    className: "gv" + (g.u != null ? " big" : "") + (String(g.v).length > 24 ? " long" : "")
  }, g.u != null || q.underline && !test ? String(g.v).split("").map((c, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    className: g.u != null ? j === g.u ? "u" : "" : c === q.underline ? "u" : ""
  }, c)) : g.v))));
}
function Play({
  plan,
  onDone,
  onQuit
}) {
  const [queue, setQueue] = useState(plan.queue);
  const [idx, setIdx] = useState(0);
  const [judged, setJudged] = useState(null);
  const [val, setVal] = useState(null); // 盤の状態。盤ごとに形が違う
  const [results, setResults] = useState([]);
  // そのステージが初めてなら、最初に教材の見本を出す。読んだ直後に「これだ」とつながるように
  const [howto, setHowto] = useState(!!plan.first);
  const timer = useRef(null);
  const why = useRef(null);
  const item = queue[idx];
  const q = item.q;
  const scored = queue.filter(x => x.scored).length;
  const doneScored = results.filter(r => r.scored).length;
  const startedAt = useRef(Date.now());
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    setVal(null);
    startedAt.current = Date.now();
    toTop();
  }, [idx]);
  useEffect(() => {
    if (window.__debug) window.__q = q;
  }, [q]);
  useEffect(() => {
    if (judged !== null && why.current) {
      why.current.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    }
  }, [judged]);
  const next = rs => {
    clearTimeout(timer.current);
    if (idx + 1 >= queue.length) {
      onDone(rs);
      return;
    }
    // 盤の中身も必ず消す。消し忘れると、前の答えが残ったまま次の問題が始まる
    setIdx(idx + 1);
    setJudged(null);
    setVal(null);
    startedAt.current = Date.now();
  };

  /** 正解するまで次へ進まない。これは全体で1つの決まり。
      点になるのは**最初の答えだけ**（やり直しで全員が合格にならないように） */
  const retry = () => {
    setJudged(null);
    setVal(null);
  };
  const answer = out => {
    if (judged !== null) return;
    const ok = String(out) === String(q.answer);
    setJudged(ok);
    buzz(ok ? 30 : 60);
    // 採点は、その問題の**最初の答え**だけ
    const first = !results.some(r => r.idx === idx);
    // kind …「どの型の問題か」。仕上げの8種類と、向きが2つあるステージを分けるために残す
    const rs = first ? results.concat([{
      idx,
      station: q.station,
      kind: q.goal || q.input,
      ok,
      ms: Date.now() - startedAt.current,
      scored: item.scored
    }]) : results;
    if (first) setResults(rs);
  };

  /** 正解の画面は、押せばすぐ次へ。待ちたい人は待てばよい（自動送りは残す）。
      押した指がそのまま触れて豆知識を飛ばさないよう、少しの間は効かないようにする。 */

  const board = {
    q,
    value: val,
    onChange: setVal,
    locked: judged !== null,
    onSubmit: answer
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap play"
  }, /*#__PURE__*/React.createElement("div", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: () => onQuit(results)
  }, "\u2715"), /*#__PURE__*/React.createElement("div", {
    className: "pbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pbar-in",
    style: {
      width: doneScored / scored * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "pnum"
  }, Math.min(doneScored + (item.scored ? 1 : 0), scored), "/", scored)), /*#__PURE__*/React.createElement(Given, {
    q: q,
    test: plan.test
  }), /*#__PURE__*/React.createElement("div", {
    className: "prompt"
  }, q.prompt), q.steps5 && !plan.test && /*#__PURE__*/React.createElement("div", {
    className: "testnote"
  }, "\u3053\u3053\u304B\u3089\u306F\u3001\u6B21\u306B\u3084\u308B\u3053\u3068\u3092\u81EA\u5206\u3067\u9078\u3073\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "card" + (judged === null ? "" : judged ? " ok" : " ng"),
    ref: why
  }, q.input === "table" ? /*#__PURE__*/React.createElement(TableBoard, board) : plan.test || q.steps5 || q.input === "final" ? /*#__PURE__*/React.createElement(TestBoard, board) : q.input === "pow" ? /*#__PURE__*/React.createElement(PowBoard, board) : q.input === "mask" ? /*#__PURE__*/React.createElement(MaskBoard, board) : q.input === "sum" ? /*#__PURE__*/React.createElement(SumBoard, board) : q.input === "sub" ? /*#__PURE__*/React.createElement(SubBoard, board) : q.input === "split" ? /*#__PURE__*/React.createElement(SplitBoard, board) : q.input === "pick" ? /*#__PURE__*/React.createElement(PickBoard, board) : /*#__PURE__*/React.createElement(StackBoard, board), judged !== null && /*#__PURE__*/React.createElement("div", {
    className: "verdict"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dhead " + (judged ? "ok" : "ng")
  }, judged ? "✓ 正解" : "✕ 不正解"), !judged && /*#__PURE__*/React.createElement("div", {
    className: "j-ans"
  }, "\u7B54\u3048\u306F ", /*#__PURE__*/React.createElement("b", null, String(q.answer))), judged && q.tip && /*#__PURE__*/React.createElement("div", {
    className: "j-tip"
  }, "\uD83D\uDCA1 ", q.tip), judged === false && !q.memorize && /*#__PURE__*/React.createElement("div", {
    className: "why"
  }, /*#__PURE__*/React.createElement("div", {
    className: "why-h"
  }, "\u3053\u3046\u89E3\u304F"), q.steps.map((st2, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "step"
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-n"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "step-t"
  }, st2.t), /*#__PURE__*/React.createElement("span", {
    className: "step-v"
  }, st2.v)))), judged ? /*#__PURE__*/React.createElement("button", {
    className: "next calm",
    onClick: () => next(results)
  }, idx + 1 >= queue.length ? "結果を見る" : "次へ →") : /*#__PURE__*/React.createElement("button", {
    className: "next retry",
    onClick: retry
  }, "\u3082\u3046\u4E00\u5EA6"))));
}

/* ── 説明の1枚 ────────────────────────
   ここだけは問題を出さない。**すべての土台なので、まず覚える時間**にする。
   見終わったら、その場から「テストをする」へ行ける。

   **かたまりの見せ方は1つだけ。**前は「灰の箱」「赤い縦線」「黄のベタ塗り」「名札なしの文章」
   「上に細い罫」と5通りあって、同じ「ここは1つのかたまりです」を毎回違う顔で言っていた。
   いまは <Sec> の名札1種類だけ。**目立つ帯は、解き方の赤い縦線1つだけ**に減らしてある。 */

/** 段の名札。全ステージで同じ4語（前のステージから／図で見ると／見本／やってみる）。 */
function Sec({
  label,
  note,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "sec-w"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, label), note && /*#__PURE__*/React.createElement("div", {
    className: "sec-n"
  }, note), children);
}

/** 見本の行に 1. 2. … と番号を振る。**手順が何番目か、目で数えなくてよくする。**
 *  名札が空の行（ステージ9の「169 = …」「170 = …」）は、上の行のつづきなので番号を飛ばす。 */
function numbered(rows) {
  let n = 0;
  return rows.map(r => ({
    n: r[0] ? ++n : null,
    k: r[0],
    v: r[1]
  }));
}

/** 文の中の *…* を太字にする。**大事なひと言だけ**を濃くするための印。 */
function Rich({
  t
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, String(t).split("*").map((s, i) => i % 2 ? /*#__PURE__*/React.createElement("b", {
    key: i
  }, s) : s));
}

/** 「図で見ると」の1枚。中身は gen.js の FIGURE。**ここに数字を書かない。**
 *
 *  **表（グリッド）で組む。**前は等幅フォントで中央ぞろえしていただけなので、
 *  名札の幅が行ごとに違うと縦の位置がずれていた（255 が自分のオクテットの真下に来ない）。
 *  いまは列が機械的にそろうので、上下の区切り位置も1本の線になる。
 *
 *  **枠は付けない。**枠があるもの＝押せるもの、という決まりがあるので、
 *  マスの区切りは下地の色だけで見せる（区切り位置の縦線は、枠ではなく1本の線）。 */
function Figure({
  data
}) {
  if (!data) return null;
  const {
    cols,
    cut,
    rows,
    head,
    foot
  } = data;
  // 1つのマスの中で分かれる行（"1111|0000"）が何列目か。無ければ -1
  const splitAt = rows.reduce((a, r) => a >= 0 ? a : (r.cells || []).findIndex(c => String(c).includes("|")), -1);
  // **色は数字ではなく、区切りのどちら側かで決まる。**
  // 「全部 1 にする」の行はホスト部が 11111 になるが、そこは灰のまま。
  // 10進数の行（plain）は色を付けない＝地の文字色のまま
  const side = (r, i) => r.plain ? "" : splitAt >= 0 ? i < splitAt ? "n" : "h" : i < cut ? "n" : "h";
  /* **どのマスも、行と列を自分で言う。**
     一部だけ「2列目から最後まで」と指定して残りを自動に任せると、
     自動の置き場所がそこで飛んで、次の行が1列ずれる（区切りの線がそろわなくなる）。
     一度それで踏んだので、全部を明示する。 */
  const box = [];
  let y = 0;
  // マスの列にまたがる行（見出し・その行の説明・いちばん下の1行）
  const wide = () => ({
    gridRow: ++y,
    gridColumn: `2 / ${cols + 2}`
  });
  if (head) {
    // 区切りが列と列のあいだにあるステージ（ステージ5）では、
    // **見出しも、その列で分ける。**「どこまでがネットワーク部か」が見出しの幅で分かる
    if (cut != null) {
      y++;
      box.push(/*#__PURE__*/React.createElement("div", {
        key: "hl",
        className: "fg-h n",
        style: {
          gridRow: y,
          gridColumn: `2 / ${cut + 2}`
        }
      }, head.l));
      box.push(/*#__PURE__*/React.createElement("div", {
        key: "hr",
        className: "fg-h",
        style: {
          gridRow: y,
          gridColumn: `${cut + 2} / ${cols + 2}`
        }
      }, head.r));
    } else {
      box.push(/*#__PURE__*/React.createElement("div", {
        key: "h",
        className: "fg-h wide",
        style: wide()
      }, /*#__PURE__*/React.createElement("span", {
        className: "fg-hn"
      }, head.l), /*#__PURE__*/React.createElement("span", null, head.r)));
    }
  }
  rows.forEach((r, i) => {
    y++;
    box.push(/*#__PURE__*/React.createElement("div", {
      key: "l" + i,
      className: "fg-lab",
      style: {
        gridRow: y,
        gridColumn: 1
      }
    }, r.lab));
    r.cells.forEach((c, j) => {
      const p = String(c).split("|");
      box.push(/*#__PURE__*/React.createElement("div", {
        key: i + "-" + j,
        style: {
          gridRow: y,
          gridColumn: j + 2
        },
        className: "fg-c " + side(r, j) + (r.small ? " sm" : "") + (splitAt < 0 && j === cut ? " cut" : "")
      }, p.length > 1 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
        className: "fg-n"
      }, p[0]), /*#__PURE__*/React.createElement("span", {
        className: "fg-cut"
      }), /*#__PURE__*/React.createElement("span", {
        className: "fg-o"
      }, p[1])) : c));
    });
    if (r.r) box.push(/*#__PURE__*/React.createElement("div", {
      key: "r" + i,
      className: "fg-r",
      style: {
        gridRow: y,
        gridColumn: cols + 2
      }
    }, r.r));
    if (r.cap) box.push(/*#__PURE__*/React.createElement("div", {
      key: "c" + i,
      className: "fg-cap",
      style: wide()
    }, r.cap));
  });
  if (foot) box.push(/*#__PURE__*/React.createElement("div", {
    key: "f",
    className: "fg-foot",
    style: wide()
  }, foot));
  return /*#__PURE__*/React.createElement(React.Fragment, null, data.intro && /*#__PURE__*/React.createElement("div", {
    className: "sec-b"
  }, /*#__PURE__*/React.createElement(Rich, {
    t: data.intro
  })), /*#__PURE__*/React.createElement("div", {
    className: "figg",
    style: {
      gridTemplateColumns: `auto repeat(${cols}, 1fr) auto`
    }
  }, box), (data.caps || []).map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "sec-b"
  }, /*#__PURE__*/React.createElement(Rich, {
    t: c
  }))));
}

/** チュートリアル1つ分。**文章で読ませず、手を動かす。**教材の手順を盤で1段ずつたどる。
 *  「正解するまでやり直す」の断り書きは、ここではなく「やってみる」の段に1回だけ出す
 *  （前は向きが2つあるステージで2回出ていた）。 */
function Tutorial({
  station,
  goal,
  lead,
  onSolved
}) {
  const [q] = useState(() => makeQuestion(station, 0.2, false, goal));
  const mark = useRef(null);
  const [val, setVal] = useState(null);
  const [judged, setJudged] = useState(null);
  // 正解するまで、同じ問題をやり直す（全体で1つの決まり）
  const again = () => {
    setVal(null);
    setJudged(null);
  };
  const answer = out => {
    if (judged !== null) return;
    const ok = String(out) === String(q.answer);
    setJudged(ok);
    buzz(ok ? 30 : 60);
    if (ok && onSolved) onSolved();
    // 押した直後に、判定が目に入るようにする（スクロールしないと見えないのを防ぐ）
    setTimeout(() => {
      if (!mark.current) return;
      try {
        mark.current.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      } catch (e) {}
    }, 0);
  };
  useEffect(() => {
    if (window.__debug) window.__q = q;
  }, [q]);
  const board = {
    q,
    value: val,
    onChange: setVal,
    locked: judged !== null,
    onSubmit: answer
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "tut"
  }, lead && /*#__PURE__*/React.createElement("div", {
    className: "sec-n"
  }, lead), /*#__PURE__*/React.createElement(Given, {
    q: q
  }), /*#__PURE__*/React.createElement("div", {
    className: "prompt"
  }, q.prompt), /*#__PURE__*/React.createElement("div", {
    className: "card" + (judged === null ? "" : judged ? " ok" : " ng"),
    ref: mark
  }, q.input === "final" ? /*#__PURE__*/React.createElement(TestBoard, board) : q.input === "table" ? /*#__PURE__*/React.createElement(TableBoard, board) : q.input === "pow" ? /*#__PURE__*/React.createElement(PowBoard, board) : q.input === "mask" ? /*#__PURE__*/React.createElement(MaskBoard, board) : q.input === "sum" ? /*#__PURE__*/React.createElement(SumBoard, board) : q.input === "sub" ? /*#__PURE__*/React.createElement(SubBoard, board) : q.input === "split" ? /*#__PURE__*/React.createElement(SplitBoard, board) : q.input === "pick" ? /*#__PURE__*/React.createElement(PickBoard, board) : /*#__PURE__*/React.createElement(StackBoard, board), judged !== null && /*#__PURE__*/React.createElement("div", {
    className: "verdict"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dhead " + (judged ? "ok" : "ng")
  }, judged ? "✓ 正解" : "✕ 不正解"), !judged && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "j-ans"
  }, "\u7B54\u3048\u306F ", /*#__PURE__*/React.createElement("b", null, String(q.answer))), /*#__PURE__*/React.createElement("button", {
    className: "next retry",
    onClick: again
  }, "\u3082\u3046\u4E00\u5EA6")))));
}
function Memo({
  station,
  onDrill,
  onTest,
  onHome
}) {
  const st = byId(station);
  // チュートリアルが解けたら、次にやること（練習をする）を目立たせる
  const [solved, setSolved] = useState(false);
  const [solved2, setSolved2] = useState(false);
  /* 仕上げ（drill: false）だけは、練習そのものを置かない。新しいやり方が無いので、
     「やってみる」も「練習をする」も、テストと同じ問題をやるだけになる。
     この1枚を見たら、下は「テストをする」だけ。 */
  const hasDrill = st.drill !== false;
  const both = !hasDrill || (station === "S8" ? solved && solved2 : solved);
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap sheet-p"
  }, /*#__PURE__*/React.createElement("div", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onHome
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "mkind"
  }, "\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB \u30FB \u30B9\u30C6\u30FC\u30B8 ", st.no, " / ", STATIONS.length), /*#__PURE__*/React.createElement("div", {
    className: "mtitle"
  }, st.name), /*#__PURE__*/React.createElement("div", {
    className: "msub2"
  }, hasDrill ? "1問やって、解き方を覚えます" : "本番で聞かれる形を見てから、テストに入ります"), /*#__PURE__*/React.createElement("div", {
    className: "rule"
  }), /*#__PURE__*/React.createElement(Sec, {
    label: "\u524D\u306E\u30B9\u30C6\u30FC\u30B8\u304B\u3089"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-b"
  }, LINK[station])), /*#__PURE__*/React.createElement("div", {
    className: "way"
  }, /*#__PURE__*/React.createElement("div", {
    className: "way-h"
  }, WAY[station].h), /*#__PURE__*/React.createElement("div", {
    className: "way-b"
  }, /*#__PURE__*/React.createElement(Rich, {
    t: WAY[station].b
  }))), FIGURE[station] && /*#__PURE__*/React.createElement(Sec, {
    label: "\u56F3\u3067\u898B\u308B\u3068"
  }, /*#__PURE__*/React.createElement(Figure, {
    data: FIGURE[station]
  })), /*#__PURE__*/React.createElement(Sec, {
    label: "\u898B\u672C"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ex-t"
  }, EXAMPLES[station].title), station === "S0" ? /*#__PURE__*/React.createElement(WeightTable, null) : numbered(EXAMPLES[station].rows).map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "ex-r"
  }, /*#__PURE__*/React.createElement("i", {
    className: "ex-n"
  }, r.n || ""), /*#__PURE__*/React.createElement("span", null, r.k), /*#__PURE__*/React.createElement("b", null, r.v))), EXAMPLES[station].note && /*#__PURE__*/React.createElement("div", {
    className: "ex-note"
  }, "\u203B ", EXAMPLES[station].note)), hasDrill && /*#__PURE__*/React.createElement(Sec, {
    label: "\u3084\u3063\u3066\u307F\u308B",
    note: "\u6B63\u89E3\u3059\u308B\u307E\u3067\u3001\u540C\u3058\u554F\u984C\u3092\u3084\u308A\u76F4\u3057\u307E\u3059\u3002"
  }, station === "S8" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Tutorial, {
    station: station,
    goal: "toMask",
    lead: "\u2460 \u30D7\u30EC\u30D5\u30A3\u30C3\u30AF\u30B9\u9577 \u2192 \u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF",
    onSolved: () => setSolved(true)
  }), /*#__PURE__*/React.createElement(Tutorial, {
    station: station,
    goal: "toLen",
    lead: "\u2461 \u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF \u2192 \u30D7\u30EC\u30D5\u30A3\u30C3\u30AF\u30B9\u9577",
    onSolved: () => setSolved2(true)
  })) : /*#__PURE__*/React.createElement(Tutorial, {
    station: station,
    onSolved: () => setSolved(true)
  })), /*#__PURE__*/React.createElement("div", {
    className: "gotest" + (hasDrill ? " two" : "")
  }, hasDrill && /*#__PURE__*/React.createElement("button", {
    className: "next" + (both ? "" : " calm"),
    onClick: onDrill
  }, "\u7DF4\u7FD2\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "next" + (hasDrill ? " ghost" : ""),
    onClick: onTest
  }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B")));
}

/** 桁の重み表。教材の「桁の重み表」そのまま。押せない（見るだけ）。 */
function WeightTable({
  blank
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "split wtable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, [7, 6, 5, 4, 3, 2, 1, 0].map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed pw"
  }, n, "\u4E57"))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, [7, 6, 5, 4, 3, 2, 1, 0].map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: blank ? "sp-c blank" : "sp-c fixed big2"
  }, blank ? "" : Math.pow(2, n)))));
}

/* ── 盤 2の◯乗 ─────────────────────────────────────────
   練習では、表をまるごと見せる。**覚えるための時間**なので隠さない。
   押すのは答えの行。押した行だけが色づく。
   テストでは表が出ないので、頭の中でこの並びを思い出すことになる。 */
function PowBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const rows = [7, 6, 5, 4, 3, 2, 1, 0];
  const sel = value;
  const out = sel == null ? "" : q.goal === "toValue" ? String(Math.pow(2, sel)) : String(sel);
  const toPower = q.goal === "toPower";
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead now"
  }, "\u4E0B\u306E\u8868\u304B\u3089\u3001", /*#__PURE__*/React.createElement("b", null, "\u7B54\u3048\u306B\u3042\u305F\u308B\u6570"), "\u30921\u3064\u9078\u3073\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, rows.map(n => toPower ? /*#__PURE__*/React.createElement("button", {
    key: n,
    className: "sp-c" + (sel === n ? " on" : ""),
    onClick: () => !locked && onChange(n)
  }, n, "\u4E57") : /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed"
  }, n, "\u4E57"))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, rows.map(n => toPower ? /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed big2"
  }, Math.pow(2, n)) : /*#__PURE__*/React.createElement("button", {
    key: n,
    className: "sp-c big2" + (sel === n ? " on" : ""),
    onClick: () => !locked && onChange(n)
  }, Math.pow(2, n))))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(out),
    disabled: locked || sel == null
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}
/* ── 盤① 写して足す（1ステージ） ────────────────────────────────
   盤は空から始める。上の2進数を見て写す。押した重みが足されていく。 */
function SumBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const v = value || 0;
  const on = W8.filter(w => v & w);
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead now"
  }, "\u554F\u984C\u3068", /*#__PURE__*/React.createElement("b", null, "\u540C\u3058\u4E26\u3073"), "\u306B\u306A\u308B\u307E\u3067\u3001\u30DE\u30B9\u3092\u62BC\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u6841\u306E\u91CD\u307F\u8868"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, W8.map(x => /*#__PURE__*/React.createElement("span", {
    key: x,
    className: "sp-c fixed"
  }, x))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u9032\u6570"), /*#__PURE__*/React.createElement("div", {
    className: "row8 tight"
  }, W8.map(w => /*#__PURE__*/React.createElement("button", {
    key: w,
    className: "cell" + (v & w ? " on" : ""),
    onClick: () => !locked && onChange(x => (x || 0) & w ? x - w : (x || 0) + w)
  }, /*#__PURE__*/React.createElement("span", {
    className: "c-v"
  }, v & w ? 1 : 0), /*#__PURE__*/React.createElement("span", {
    className: "c-w"
  }, w))))), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-x"
  }, on.length ? on.join(" ＋ ") : "まだ押していません")), /*#__PURE__*/React.createElement("div", {
    className: "bridge"
  }, /*#__PURE__*/React.createElement("span", {
    className: "b-t"
  }, "\u5199\u3057\u305F\u91CD\u307F\u3092\u3001\u5168\u90E8 \u8DB3\u3057\u7B97\u3059\u308B\u3068"), /*#__PURE__*/React.createElement("span", {
    className: "b-a"
  }, "\u2193")), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-n"
  }, "\u5408\u8A08 ", /*#__PURE__*/React.createElement("b", null, v))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(v),
    disabled: locked || !v
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}

/* ── 盤② 残りを減らす（2ステージ） ──────────────────────────────
   教材の手順は「大きい重みから、引けるなら1・引けないなら0」。
   だから足すのではなく**引く**。残りが 0 になれば完成。
   引けない重みも押せるようにしてある ── 押せなくすると、
   「引けるかどうか」の判断を機械がやってしまうから。 */
function SubBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const v = value || 0;
  const rest = q.target - v;
  const on = W8.filter(w => v & w);
  // 押したいちばん右の1つ先が「いま見るところ」。
  // 左から順に見る手つきなので、ある桁を押した時点で、その左は決まったことになる
  let last = -1;
  W8.forEach((w, i) => {
    if (v & w) last = i;
  });
  const here = last + 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rest" + (rest === 0 ? " zero" : rest < 0 ? " over" : "")
  }, "\u6B8B\u308A ", /*#__PURE__*/React.createElement("b", null, rest), rest < 0 && /*#__PURE__*/React.createElement("span", {
    className: "rest-n"
  }, "\u3000\u5F15\u304D\u3059\u304E")), /*#__PURE__*/React.createElement("div", {
    className: "lead now"
  }, /*#__PURE__*/React.createElement("b", null, "\u5DE6\u306E\u30DE\u30B9\u304B\u3089\u9806\u306B"), "\u898B\u307E\u3059\u3002\u6B8B\u308A\u304B\u3089\u5F15\u3051\u308B\u306A\u3089\u30DE\u30B9\u3092\u62BC\u3057\u3066 ", /*#__PURE__*/React.createElement("b", null, "1"), " \u306B\u3001\u5F15\u3051\u306A\u3051\u308C\u3070\u62BC\u3055\u305A\u306B\u6B21\u306E\u6841\u3078\u9032\u307F\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "row8"
  }, W8.map((w, i) => /*#__PURE__*/React.createElement("button", {
    key: w
    // いま見るところ＝押したいちばん右の1つ先。位置を示すだけで、
    // 「引けるかどうか」は言わない（そこは自分で決めるところ）
    ,
    className: "cell" + (v & w ? " on" : "") + (i === here ? " now" : "") + (i > here ? " later" : ""),
    onClick: () => !locked && onChange(x => (x || 0) & w ? x - w : (x || 0) + w)
  }, /*#__PURE__*/React.createElement("span", {
    className: "c-v"
  }, v & w ? 1 : 0), /*#__PURE__*/React.createElement("span", {
    className: "c-w"
  }, w)))), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-x"
  }, on.length ? `${q.target} ${on.map(w => `− ${w}`).join(" ")}` : "まだ押していません")), /*#__PURE__*/React.createElement("div", {
    className: "bridge"
  }, /*#__PURE__*/React.createElement("span", {
    className: "b-t"
  }, "\u5F15\u3051\u305F\u3068\u3053\u308D\u306B ", /*#__PURE__*/React.createElement("b", null, "1"), "\u3001\u5F15\u3051\u306A\u304B\u3063\u305F\u3068\u3053\u308D\u306B ", /*#__PURE__*/React.createElement("b", null, "0"), " \u3092\u7F6E\u304F\u3068"), /*#__PURE__*/React.createElement("span", {
    className: "b-a"
  }, "\u2193")), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-n"
  }, "2\u9032\u6570 ", /*#__PURE__*/React.createElement("b", null, W8.map(w => v & w ? 1 : 0).join("")))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(W8.map(w => v & w ? 1 : 0).join("")),
    disabled: locked || !v
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}

/* ── 盤 桁の重み表をうめる（ステージ1の最初の1問）────────────
   **この表がそらで書けることが、以降全部の前提。**だから最初に1回、自分で書く。
   マスを押して選び、下の数字で入れる。ステージ4の「打ちこむところを押してから」と同じ手つき。 */
function TableBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const st = value || {
    slot: 0,
    cells: [null, null, null, null, null, null, null, null]
  };
  const cells = st.cells,
    slot = st.slot;
  const set = x => !locked && onChange({
    ...st,
    ...x
  });
  const done = cells.every(x => x != null);
  const out = cells.join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead now"
  }, "\u3046\u3081\u308B\u30DE\u30B9\u3092\u62BC\u3057\u3066\u304B\u3089\u3001\u4E0B\u306E\u6570\u5B57\u3067\u5165\u308C\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, [7, 6, 5, 4, 3, 2, 1, 0].map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed pw"
  }, n, "\u4E57"))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "row8 tight"
  }, cells.map((v, i) =>
  /*#__PURE__*/
  /* 破線＝まだ空き。バッジの空き枠と同じ約束 */
  React.createElement("button", {
    key: i,
    className: "cell bare" + (v == null ? " blank" : "") + (slot === i ? " on" : "")
    /* マスを選び直したら電卓も空に。残っていると前の数の続きになる（12864 のように） */,
    onClick: () => set({
      slot: i,
      calc: null
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "c-v"
  }, v == null ? "" : v))))), /*#__PURE__*/React.createElement(Calc, {
    plain: true,
    value: st.calc,
    onChange: c => {
      const t = c ? c.nums.reduce((a, n, i) => i === 0 ? n : a + n, 0) : 0;
      const n2 = cells.slice();
      n2[slot] = t;
      set({
        calc: c,
        cells: n2
      });
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(out),
    disabled: locked || !done
  }, done ? "これで決定" : "8つとも入れてください"));
}

/* ── 盤 マスク（/ の数 ↔ マスク） ─────────────────────────
   /28 は「1 が28個並ぶ」という意味。だから
     ① 8個ずつ 255 にしていく（左から）
     ② 余りを、上の桁から 1 にする
   盤の上に「/いくつ」と「マスク」の両方が出る。
   どちらを聞かれても、同じ手つきで答えられる。 */
function MaskBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const st = value || {
    full: 0,
    bits: 0
  };
  const full = st.full || 0,
    bits = st.bits || 0;
  const set = x => !locked && onChange({
    ...st,
    ...x
  });
  const d = maskBoardOut(full, bits, q.goal); // 計算は gen.js に任せる

  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead " + (full ? "past" : "now")
  }, q.goal === "toMask" ? /*#__PURE__*/React.createElement(React.Fragment, null, "\u2460 \u5DE6\u304B\u3089 ", /*#__PURE__*/React.createElement("b", null, "8 \u305A\u3064"), " \u533A\u5207\u3063\u3066\u3001", /*#__PURE__*/React.createElement("b", null, "1 \u3060\u3051\u3067\u57CB\u307E\u3063\u305F"), "\u30AA\u30AF\u30C6\u30C3\u30C8\u3092 ", /*#__PURE__*/React.createElement("b", null, "255"), " \u306B\u3057\u307E\u3059") : /*#__PURE__*/React.createElement(React.Fragment, null, "\u2460 ", /*#__PURE__*/React.createElement("b", null, "255"), " \u306E\u30AA\u30AF\u30C6\u30C3\u30C8\u3092\u3001\u5DE6\u304B\u3089\u9806\u306B\u62BC\u3057\u307E\u3059")), /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }), [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."), /*#__PURE__*/React.createElement("button", {
    className: "oct" + (i < full ? " on" : ""),
    onClick: () => set({
      full: i < full ? i : i + 1,
      bits: 0
    })
  }, i < full ? 255 : i === full ? d.mask.split(".")[i] : 0)))), q.goal === "toLen" ? /*#__PURE__*/React.createElement("div", {
    className: "dots ticks"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, "1 \u306E\u6570"), [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot plus"
  }, "\uFF0B"), /*#__PURE__*/React.createElement("span", {
    className: "tick" + (i < full || i === full && bits ? " on" : "")
  }, full || bits ? d.ones[i] : "")))) : /*#__PURE__*/React.createElement("div", {
    className: "dots ticks"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, "1\u306E\u6570"), [8, 16, 24, 32].map((t, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: t
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, " "), /*#__PURE__*/React.createElement("span", {
    className: "tick"
  }, t)))), full >= 1 && q.goal === "toMask" && q.board.rest === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "\u2461 \u4F59\u308A\u306F 0\u500B \u306A\u306E\u3067\u3001\u6B8B\u308A\u306E\u30AA\u30AF\u30C6\u30C3\u30C8\u306F ", /*#__PURE__*/React.createElement("b", null, "0 \u306E\u307E\u307E"), "\u3067\u3059") : full >= 1 && full < 4 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead " + (bits ? "past" : "now")
  }, q.goal === "toMask" ? /*#__PURE__*/React.createElement(React.Fragment, null, "\u2461 \u4F59\u308A\u306E ", /*#__PURE__*/React.createElement("b", null, q.board.rest, " \u500B"), " \u3092\u3001\u6B21\u306E\u30AA\u30AF\u30C6\u30C3\u30C8\u306B\u5DE6\u304B\u3089 ", /*#__PURE__*/React.createElement("b", null, "1"), " \u3067\u4E26\u3079\u307E\u3059") : /*#__PURE__*/React.createElement(React.Fragment, null, "\u2461 ", /*#__PURE__*/React.createElement("b", null, "255 \u3067\u306A\u3044\u30AA\u30AF\u30C6\u30C3\u30C8"), "\u3092\u30011 \u3068 0 \u3067\u4F5C\u308A\u307E\u3059")), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, W8.map(w => /*#__PURE__*/React.createElement("button", {
    key: w,
    className: "sp-c" + (bits & w ? " on" : ""),
    onClick: () => set({
      bits: bits & w ? bits - w : bits + w
    })
  }, bits & w ? 1 : 0))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u6841\u306E\u91CD\u307F\u8868"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row w"
  }, W8.map(w => /*#__PURE__*/React.createElement("span", {
    key: w,
    className: "sp-w"
  }, w)))), !!bits && /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-x"
  }, W8.filter(w => bits & w).join(" ＋ "), " \uFF1D ", bits))), q.goal === "toLen" && (full > 0 || !!bits) && /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-n"
  }, "1 \u306E\u6570\u3092\u5168\u90E8\u8DB3\u3059\u3068 ", /*#__PURE__*/React.createElement("b", null, d.len))), /*#__PURE__*/React.createElement("div", {
    className: "derive"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-r" + (q.goal === "toLen" ? " ans" : "")
  }, /*#__PURE__*/React.createElement("span", null, "\u30D7\u30EC\u30D5\u30A3\u30C3\u30AF\u30B9\u9577"), /*#__PURE__*/React.createElement("b", null, "/", d.len)), /*#__PURE__*/React.createElement("div", {
    className: "d-r" + (q.goal === "toMask" ? " ans" : "")
  }, /*#__PURE__*/React.createElement("span", null, "\u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF"), /*#__PURE__*/React.createElement("b", null, d.mask))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(d.out),
    disabled: locked || !full && !bits
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}

/* ── 盤③ 線を引く（3ステージ・4ステージ） ─────────────────────────────
   人が手を動かすのは4つ。**どれも「見て押す」だけ**にしてある。
     ① サブネットマスクを左から見て、255 でも 0 でもないところを押す
     ② その数を、自分で 1 と 0 に直す（ここを機械にやらせない。2ステージでやったことと同じ）
     ③ いちばん右の 1 の後ろに線が出る
     ④ 線から右を **全部 0** にすると、いちばん小さい数
        線から右を **全部 1** にすると、いちばん大きい数
   名前（ネットワークアドレス・ブロードキャストアドレス）は**最後に**出す。
   先に名前を出しても、何のことか分からないまま操作することになる。 */
function SplitBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const {
    ip,
    len
  } = q.board;
  const parts = ip.split(".").map(Number);
  const mask = maskStr(len).split(".").map(Number);
  const st = value || {
    oct: null,
    zero: false,
    one: false
  };
  const oct = st.oct;
  const set = x => !locked && onChange({
    ...st,
    ...x
  });
  const givenMask = q.given.some(g => g.k === "サブネットマスク");

  // ②の 1 と 0 も機械が出す。線は、その並びの「いちばん右の 1 の後ろ」
  const bs = oct == null ? [] : bin8(mask[oct]).split("").map(Number);
  const cut = bs.lastIndexOf(1) + 1;
  // ③の 1 と 0 は機械が出す。**そのかわり、引いていく過程を下に見せる**
  const ipBits = oct == null ? [] : bin8(parts[oct]).split("").map(Number);

  // 計算は gen.js の splitOut に任せる（画面と検算で同じ関数を使う）
  const d = oct != null && cut > 0 ? splitOut(ip, oct, cut, q.goal) : null;
  // 押した 1 と 0 から、そのまま住所にする。計算は gen.js の addrWith / pairOut
  const keep = oct == null ? 0 : ipBits.slice(0, cut).reduce((a2, c, i) => a2 + (c ? W8[i] : 0), 0);
  const myNet = oct == null ? null : addrWith(ip, oct, keep, 0);
  const myBc = oct == null ? null : addrWith(ip, oct, keep + restOnes(cut), 255);
  const out = myNet && myBc ? pairOut(myNet, myBc, q.goal) : "";
  const ready = d && st.zero && st.one;
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, "IP"), parts.map((v, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."), /*#__PURE__*/React.createElement("span", {
    className: "num" + (oct === i ? " on" : "")
  }, v)))), /*#__PURE__*/React.createElement("div", {
    className: "lead " + (oct != null ? "past" : "now")
  }, "\u2460 \u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF\u3092\u5DE6\u304B\u3089\u898B\u3066\u3001", /*#__PURE__*/React.createElement("b", null, "\u521D\u3081\u3066 255 \u3067\u306A\u304F\u306A\u308B\u30AA\u30AF\u30C6\u30C3\u30C8"), "\u3092\u62BC\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, "\u30DE\u30B9\u30AF"), mask.map((m, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."), /*#__PURE__*/React.createElement("button", {
    className: "oct" + (oct === i ? " on" : ""),
    onClick: () => set({
      oct: i,
      bits: 0,
      zero: false,
      one: false
    })
  }, m)))), !givenMask && /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "/", len, " \u2192 ", maskStr(len), "\uFF08\u30B9\u30C6\u30FC\u30B8", byId("S8").no, " \u3067\u3084\u3063\u305F\u3068\u3053\u308D\uFF09"), oct != null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead past"
  }, "\u2461 \u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF\u306E ", /*#__PURE__*/React.createElement("b", null, mask[oct]), " \u3092 1 \u3068 0 \u306B\u3059\u308B\u3068"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u30DE\u30B9\u30AF", /*#__PURE__*/React.createElement("i", null, mask[oct])), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, bs.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "sp-c fixed" + (cut === i + 1 ? " edge" : "")
  }, c))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u6841\u306E\u91CD\u307F\u8868"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row w"
  }, W8.map(w => /*#__PURE__*/React.createElement("span", {
    key: w,
    className: "sp-w"
  }, w)))), oct != null && cut === 0 && /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, "\u3053\u306E\u6570\u306F ", /*#__PURE__*/React.createElement("b", null, "0"), "\uFF08\u5168\u90E8 0\uFF09\u306A\u306E\u3067\u3001\u7DDA\u306F\u3082\u3063\u3068\u5DE6\u306B\u3042\u308A\u307E\u3059\u3002 \u62BC\u3059\u306E\u306F\u3001\u4E0A\u306E\u5217\u3067 ", /*#__PURE__*/React.createElement("b", null, "255 \u3067\u306A\u304F\u306A\u308B \u3044\u3061\u3070\u3093\u5DE6\u306E\u6570"), "\u3067\u3059\u3002"), cut > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead past"
  }, "\u2462 ", /*#__PURE__*/React.createElement("b", null, "\u540C\u3058\u30AA\u30AF\u30C6\u30C3\u30C8"), "\u306E IP\u30A2\u30C9\u30EC\u30B9 ", /*#__PURE__*/React.createElement("b", null, parts[oct]), " \u3092 1 \u3068 0 \u306B\u3059\u308B\u3068"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "IP", /*#__PURE__*/React.createElement("i", null, parts[oct])), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, ipBits.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "sp-c fixed" + (cut === i + 1 ? " edge" : "")
  }, c))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u91CD\u307F"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row w"
  }, W8.map(w => /*#__PURE__*/React.createElement("span", {
    key: w,
    className: "sp-w"
  }, w)))), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-x"
  }, parts[oct], W8.filter((w, i) => ipBits[i]).map(w => ` − ${w}`).join(""), " \uFF1D 0"))), cut > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead " + (st.zero ? "past" : "now")
  }, "\u2463 ", /*#__PURE__*/React.createElement("b", null, "\u4E0A\u306E ", parts[oct], " \u306E\u4E26\u3073"), "\u3067\u3001\u7DDA\u304B\u3089\u53F3\u3092 ", /*#__PURE__*/React.createElement("b", null, "\u5168\u90E8 0"), " \u306B\u3059\u308B"), /*#__PURE__*/React.createElement("div", {
    className: "split bulk"
  }, /*#__PURE__*/React.createElement("button", {
    className: "go" + (st.zero ? " on" : ""),
    onClick: () => set({
      zero: true
    })
  }, "\u5168\u90E8 0"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, ipBits.map((c, i) => i < cut ? /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "sp-c fixed from" + (cut === i + 1 ? " edge" : "")
  }, c) : /*#__PURE__*/React.createElement("span", {
    key: i,
    className: st.zero ? "sp-c fixed done" : "sp-c blank"
  }, st.zero ? 0 : "")))), st.zero && /*#__PURE__*/React.createElement("div", {
    className: "asm"
  }, /*#__PURE__*/React.createElement("span", null, "\u3053\u306E8\u3064 \uFF1D ", /*#__PURE__*/React.createElement("b", null, keep), oct < 3 && /*#__PURE__*/React.createElement(React.Fragment, null, "\u3000\u5F8C\u308D\u306F \u5168\u90E8 ", /*#__PURE__*/React.createElement("b", null, "0"))), /*#__PURE__*/React.createElement("span", {
    className: "asm-a"
  }, myNet))), st.zero && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead " + (st.one ? "past" : "now")
  }, "\u2464 \u540C\u3058\u4E26\u3073\u3067\u3001\u7DDA\u304B\u3089\u53F3\u3092 ", /*#__PURE__*/React.createElement("b", null, "\u5168\u90E8 1"), " \u306B\u3059\u308B"), /*#__PURE__*/React.createElement("div", {
    className: "split bulk"
  }, /*#__PURE__*/React.createElement("button", {
    className: "go" + (st.one ? " on" : ""),
    onClick: () => set({
      one: true
    })
  }, "\u5168\u90E8 1"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, ipBits.map((c, i) => i < cut ? /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "sp-c fixed from" + (cut === i + 1 ? " edge" : "")
  }, c) : /*#__PURE__*/React.createElement("span", {
    key: i,
    className: st.one ? "sp-c fixed done" : "sp-c blank"
  }, st.one ? 1 : "")))), st.one && /*#__PURE__*/React.createElement("div", {
    className: "asm"
  }, /*#__PURE__*/React.createElement("span", null, "\u3053\u306E8\u3064 \uFF1D ", /*#__PURE__*/React.createElement("b", null, keep + restOnes(cut)), oct < 3 && /*#__PURE__*/React.createElement(React.Fragment, null, "\u3000\u5F8C\u308D\u306F \u5168\u90E8 ", /*#__PURE__*/React.createElement("b", null, "255"))), /*#__PURE__*/React.createElement("span", {
    className: "asm-a"
  }, myBc))), (st.zero || st.one) && /*#__PURE__*/React.createElement("div", {
    className: "derive"
  }, st.zero && /*#__PURE__*/React.createElement("div", {
    className: "d-r col"
  }, /*#__PURE__*/React.createElement("span", null, "\u3044\u3061\u3070\u3093\u5C0F\u3055\u3044\u6570 \uFF1D ", /*#__PURE__*/React.createElement("b", null, "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u30A2\u30C9\u30EC\u30B9")), /*#__PURE__*/React.createElement("b", null, myNet)), st.one && /*#__PURE__*/React.createElement("div", {
    className: "d-r col"
  }, /*#__PURE__*/React.createElement("span", null, "\u3044\u3061\u3070\u3093\u5927\u304D\u3044\u6570 \uFF1D ", /*#__PURE__*/React.createElement("b", null, "\u30D6\u30ED\u30FC\u30C9\u30AD\u30E3\u30B9\u30C8\u30A2\u30C9\u30EC\u30B9")), /*#__PURE__*/React.createElement("b", null, myBc)), ready && q.goal === "range" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "d-r col"
  }, /*#__PURE__*/React.createElement("span", null, myNet, " \u306F\u4F7F\u3048\u306A\u3044 \u2192 \uFF0B1"), /*#__PURE__*/React.createElement("b", null, out.split(" 〜 ")[0])), /*#__PURE__*/React.createElement("div", {
    className: "d-r col"
  }, /*#__PURE__*/React.createElement("span", null, myBc, " \u306F\u4F7F\u3048\u306A\u3044 \u2192 \u22121"), /*#__PURE__*/React.createElement("b", null, out.split(" 〜 ")[1])), /*#__PURE__*/React.createElement("div", {
    className: "d-r col ans"
  }, /*#__PURE__*/React.createElement("span", null, "\u7B54\u3048"), /*#__PURE__*/React.createElement("b", null, out))))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(out),
    disabled: locked || !ready
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}

/* ── 盤④ 右から見て1つ押す（5ステージ・6ステージ） ────────────────────
   盤を右（小さい方）から見て、必要な数以上になる最初の重みを押す。
   8桁で足りないときのために、上に延長した段を出してある（教材の「表を延長する」）。 */
const W16 = [32768, 16384, 8192, 4096, 2048, 1024, 512, 256];
/* ── 桁数を、サブネットマスクの形にして見せる ────────────────────
   「ホスト部 5桁」まで出せても、**それが第4オクテットの話なのか第3オクテットの話なのか**が
   見えないと 255.255.255.224 に化けない。ここだけを絵にする。
   破線＝ホスト部（機器の分）。空きは破線、という盤全部の約束と同じ。 */
function MaskFrom({
  len
}) {
  // /32 は「第4オクテットの8桁全部」。cutOct のままだと 5つ目のオクテットを指してしまう
  const oc = Math.min(3, cutOct(len)),
    cb = len - oc * 8;
  const parts = maskStr(len).split(".");
  const on = W8.slice(0, cb);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, "\u5F8C\u308D\u304B\u3089 ", 32 - len, " \u6841\u5206\u304C\u3001\u6A5F\u5668\u306B\u4F7F\u3046\u3068\u3053\u308D\uFF08\u30DB\u30B9\u30C8\u90E8\uFF09\u3067\u3059\u3002\u7DDA\u306F ", /*#__PURE__*/React.createElement("b", null, "\u7B2C", oc + 1, "\u30AA\u30AF\u30C6\u30C3\u30C8"), " \u306B\u5165\u308A\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-head"
  }, "\u7B2C", oc + 1, "\u30AA\u30AF\u30C6\u30C3\u30C8"), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, W8.map((x, j) => /*#__PURE__*/React.createElement("span", {
    key: x,
    className: j < cb ? "sp-c fixed" : "sp-c blank"
  }, j < cb ? 1 : 0)))), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-n"
  }, "\u7B2C", oc + 1, "\u30AA\u30AF\u30C6\u30C3\u30C8 \uFF1D ", on.length ? on.join(" ＋ ") + " ＝ " : "", /*#__PURE__*/React.createElement("b", null, parts[oc]))), /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, parts.map((v, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."), /*#__PURE__*/React.createElement("span", {
    className: "num" + (i === oc ? " on" : "")
  }, v)))));
}
function PickBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const w = value;
  const d = w == null ? null : pickOut(w, q.goal, q.base); // 計算は gen.js に任せる
  const bits = d ? d.bits : null;
  const out = d ? d.out : "";
  const cell = x => /*#__PURE__*/React.createElement("button", {
    key: x,
    className: "cell wide" + (w === x ? " on" : ""),
    onClick: () => !locked && onChange(x)
  }, /*#__PURE__*/React.createElement("span", {
    className: "c-w2" + (String(x).length >= 5 ? " sm" : "")
  }, x));
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, q.goal === "host" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, "\u4E21\u7AEF\u306E2\u3064\uFF08", /*#__PURE__*/React.createElement("b", null, "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u30A2\u30C9\u30EC\u30B9"), "\u3068", /*#__PURE__*/React.createElement("b", null, "\u30D6\u30ED\u30FC\u30C9\u30AD\u30E3\u30B9\u30C8\u30A2\u30C9\u30EC\u30B9"), "\uFF09\u306B\u306F\u6A5F\u5668\u3092\u7F6E\u3051\u307E\u305B\u3093\u3002 \u3072\u3068\u3064\u524D\u306E", /*#__PURE__*/React.createElement("b", null, "\u4F7F\u3048\u308B\u30A2\u30C9\u30EC\u30B9\u306E\u7BC4\u56F2"), "\u3068\u540C\u3058\u8A71\u3067\u3059\u3002 \u3060\u304B\u3089\u3001\u307B\u3057\u3044\u53F0\u6570\u306B\u3001\u305D\u306E2\u3064\u5206\u3092\u8DB3\u3057\u3066\u304B\u3089\u63A2\u3057\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "lead past"
  }, "\u2460 \u4F7F\u3048\u306A\u30442\u3064\u5206\u3092\u8DB3\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-n"
  }, q.need, "\u53F0 \uFF0B 2 \uFF1D ", /*#__PURE__*/React.createElement("b", null, q.want))), /*#__PURE__*/React.createElement("div", {
    className: "lead " + (w != null ? "past" : "now")
  }, "\u2461 ", /*#__PURE__*/React.createElement("b", null, q.want, " \u4EE5\u4E0A"), "\u306E\u30B5\u30D6\u30CD\u30C3\u30C8\u306E\u3046\u3061\u3001\u4E00\u756A\u5C0F\u3055\u3044\u3082\u306E\u3092\u62BC\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, "\u6841\u306E\u91CD\u307F\u8868\u3092\u3001\u5DE6\u3078\u306E\u3070\u3057\u305F\u3060\u3051\u3067\u3059\uFF082\u500D\u305A\u3064\u5897\u3048\u307E\u3059\uFF09")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "\u30AF\u30E9\u30B9", q.cls, "\uFF08/", q.base, " \u304B\u3089\uFF09\uFF0F \u5FC5\u8981\u306A\u30B5\u30D6\u30CD\u30C3\u30C8\u6570 ", /*#__PURE__*/React.createElement("b", null, q.need)), /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, "\u501F\u308A\u305F\u6841\u304C", /*#__PURE__*/React.createElement("b", null, "\u5168\u90E8 0"), " \u306E\u30B5\u30D6\u30CD\u30C3\u30C8\u3068\u3001", /*#__PURE__*/React.createElement("b", null, "\u5168\u90E8 1"), " \u306E\u30B5\u30D6\u30CD\u30C3\u30C8\u306F\u4F7F\u3044\u307E\u305B\u3093\u3002 \u3060\u304B\u3089\u3001\u307B\u3057\u3044\u6570\u306B\u3001\u305D\u306E2\u3064\u5206\u3092\u8DB3\u3057\u3066\u304B\u3089\u63A2\u3057\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "lead past"
  }, "\u2460 \u4F7F\u3048\u306A\u30442\u3064\u5206\u3092\u8DB3\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "o-n"
  }, q.need, "\u500B \uFF0B 2 \uFF1D ", /*#__PURE__*/React.createElement("b", null, q.want))), /*#__PURE__*/React.createElement("div", {
    className: "lead " + (w != null ? "past" : "now")
  }, "\u2461 ", /*#__PURE__*/React.createElement("b", null, q.want, " \u4EE5\u4E0A"), "\u306E\u6570\u306E\u3046\u3061\u3001\u4E00\u756A\u5C0F\u3055\u3044\u3082\u306E\u3092\u62BC\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, "\u6841\u306E\u91CD\u307F\u8868\u3092\u3001\u5DE6\u3078\u306E\u3070\u3057\u305F\u3060\u3051\u3067\u3059\uFF082\u500D\u305A\u3064\u5897\u3048\u307E\u3059\uFF09\u3002\u6570\u304C\u5927\u304D\u3044\u307B\u3069\u3001\u305F\u304F\u3055\u3093\u5206\u3051\u3089\u308C\u307E\u3059")), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, q.goal === "host" && /*#__PURE__*/React.createElement("div", {
    className: "sp-head"
  }, "\u5927\u304D\u3044\u30B5\u30D6\u30CD\u30C3\u30C8\uFF08\u7DDA\u306F\u7B2C3\u30AA\u30AF\u30C6\u30C3\u30C8\uFF09"), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, [15, 14, 13, 12, 11, 10, 9, 8].map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed pw"
  }, n, "\u4E57"))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "row8 tight"
  }, W16.map(cell)), q.goal === "host" && /*#__PURE__*/React.createElement("div", {
    className: "sp-head"
  }, "\u5C0F\u3055\u3044\u30B5\u30D6\u30CD\u30C3\u30C8\uFF08\u7DDA\u306F\u7B2C4\u30AA\u30AF\u30C6\u30C3\u30C8\uFF09"), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, [7, 6, 5, 4, 3, 2, 1, 0].map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed pw"
  }, n, "\u4E57"))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "row8 tight"
  }, W8.map(cell))), w != null && /*#__PURE__*/React.createElement("div", {
    className: "derive"
  }, q.goal === "host" && /*#__PURE__*/React.createElement("div", {
    className: "lead past"
  }, "\u2462 \u9078\u3093\u3060\u30B5\u30D6\u30CD\u30C3\u30C8\u3067\u3001\u4F55\u53F0\u3064\u304B\u3048\u308B\u304B\u3092\u898B\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "\u62BC\u3057\u305F\u3068\u3053\u308D"), /*#__PURE__*/React.createElement("b", null, w)), q.goal === "host" && /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "\u6A5F\u5668\u306B\u4F7F\u3048\u308B"), /*#__PURE__*/React.createElement("b", null, w, " \u2212 2 \uFF1D ", Math.max(0, w - 2), "\u53F0")), /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, q.goal === "host" ? "ホスト部" : "サブネットに使う"), /*#__PURE__*/React.createElement("b", null, bits, " \u6841")), q.goal === "subnet" && /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "/", q.base, " \u304B\u3089 ", bits, " \u6841 \u5EF6\u3070\u3059"), /*#__PURE__*/React.createElement("b", null, "/", q.base, " + ", bits)), q.goal === "host" && /*#__PURE__*/React.createElement(MaskFrom, {
    len: d.len
  }), /*#__PURE__*/React.createElement("div", {
    className: "d-r col ans"
  }, /*#__PURE__*/React.createElement("span", null, "\u7B54\u3048"), /*#__PURE__*/React.createElement("b", null, out))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(out),
    disabled: locked || w == null
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}

/* ── 盤⑤ 縦に並べて線（7ステージ） ──────────────────────────────
   2進を縦に並べ、**同じでなくなるところ**に線を引く。線から左が集約したアドレス。 */
function StackBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const {
    nets
  } = q.board;
  const st = value || {
    oc: null,
    cut: null
  };
  const oc = st.oc,
    cut = st.cut;
  const set = x => !locked && onChange({
    ...st,
    ...x
  });
  const parts = nets.map(n => n.split("/")[0].split(".").map(Number));
  const base = nets[0].split("/")[0];
  const out = oc != null && cut != null ? stackOut(base, oc, cut).out : "";
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead " + (oc != null ? "past" : "now")
  }, "\u2460 ", nets.length, "\u3064\u3092\u898B\u6BD4\u3079\u3066\u3001", /*#__PURE__*/React.createElement("b", null, "\u6570\u304C\u9055\u3063\u3066\u3044\u308B\u30AA\u30AF\u30C6\u30C3\u30C8"), "\u3092\u62BC\u3057\u307E\u3059"), parts.map((ps, r) => /*#__PURE__*/React.createElement("div", {
    key: r,
    className: "dots"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, r + 1, "\u3064\u76EE"), ps.map((v, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."), r === 0 ? /*#__PURE__*/React.createElement("button", {
    className: "oct" + (oc === i ? " on" : ""),
    onClick: () => set({
      oc: i,
      cut: null
    })
  }, v) : /*#__PURE__*/React.createElement("span", {
    className: "num" + (oc === i ? " on" : "")
  }, v))))), oc != null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead " + (cut != null ? "past" : "now")
  }, "\u2461 \u7E26\u306B\u898B\u3066\u3001", /*#__PURE__*/React.createElement("b", null, nets.length, "\u3064\u3068\u3082\u540C\u3058"), "\u3068\u3053\u308D\u307E\u3067\u3092\u62BC\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, parts.map((ps, r) => /*#__PURE__*/React.createElement("div", {
    key: r,
    className: "st-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "st-d"
  }, ps[oc]), bin8(ps[oc]).split("").map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "st-c" + (cut != null && i < cut ? " same" : "") + (cut === i + 1 ? " edge" : ""),
    onClick: () => set({
      cut: i + 1
    })
  }, c))))), cut != null && /*#__PURE__*/React.createElement("div", {
    className: "derive"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "\u540C\u3058\u306A\u306E\u306F"), /*#__PURE__*/React.createElement("b", null, "\u4E0A\u304B\u3089 ", oc * 8 + cut, " \u6841\u5206")), /*#__PURE__*/React.createElement("div", {
    className: "d-r col ans"
  }, /*#__PURE__*/React.createElement("span", null, "\u7B54\u3048"), /*#__PURE__*/React.createElement("b", null, out)))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(out),
    disabled: locked || cut == null
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}

/* =========================================================================
   テスト（表なし）
   -------------------------------------------------------------------------
   教材は「この表は自分で書けるようにしておくこと」と言っている。
   だから2回目は**桁の重み表を出さない。**問いと、自分で計算する場所だけ。

   計算するところは **＋と− だけ**。教材の手順に ×÷ は一度も出てこないし、
   本番に無い道具に慣れても仕方がない。
   **どの重みを足す（引く）かを決めるのが人、足し引きの答えを出すのが機械。**
   この線引きは、表を使う回とまったく同じ。
   ========================================================================= */
function Calc({
  value,
  onChange,
  plain
}) {
  const st = value || {
    nums: [0],
    ops: []
  };
  const total = st.nums.reduce((a, n, i) => i === 0 ? n : st.ops[i - 1] === "−" ? a - n : a + n, 0);
  const expr = st.nums.map((n, i) => i === 0 ? String(n) : ` ${st.ops[i - 1]} ${n}`).join("");
  const digit = d => {
    const nums = st.nums.slice();
    nums[nums.length - 1] = Number(String(nums[nums.length - 1] === 0 ? "" : nums[nums.length - 1]) + d);
    onChange({
      ...st,
      nums
    });
  };
  const op = o => onChange({
    nums: st.nums.concat([0]),
    ops: st.ops.concat([o])
  });
  const back = () => {
    const nums = st.nums.slice(),
      ops = st.ops.slice();
    const last = String(nums[nums.length - 1]);
    if (last !== "0") nums[nums.length - 1] = Number(last.slice(0, -1) || 0);else if (nums.length > 1) {
      nums.pop();
      ops.pop();
    }
    onChange({
      nums,
      ops
    });
  };
  const key = (label, fn, cls) => /*#__PURE__*/React.createElement("button", {
    key: label,
    className: "k" + (cls ? " " + cls : ""),
    onClick: fn
  }, label);
  return /*#__PURE__*/React.createElement("div", {
    className: "calc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "calc-d"
  }, /*#__PURE__*/React.createElement("div", {
    className: "calc-e"
  }, expr), /*#__PURE__*/React.createElement("div", {
    className: "calc-t"
  }, total)), /*#__PURE__*/React.createElement("div", {
    className: "keys"
  }, ["7", "8", "9"].map(d => key(d, () => digit(d))), key("⌫", back, "op"), ["4", "5", "6"].map(d => key(d, () => digit(d))), plain ? /*#__PURE__*/React.createElement("span", null) : key("＋", () => op("＋"), "op"), ["1", "2", "3"].map(d => key(d, () => digit(d))), plain ? /*#__PURE__*/React.createElement("span", null) : key("−", () => op("−"), "op"), key("0", () => digit("0"), "w2"), key("00", () => digit("00")), key("C", () => onChange({
    nums: [0],
    ops: []
  }), "op")));
}

/** テストの答えの入れ方。ステージによって変える。
 *    1ステージ … 計算した数がそのまま答え
 *    2ステージ … 重みの書いていない空の8マス（打ち間違いが起きない）
 *  3〜7ステージ … 選ぶ（本番の CCNA も選択式。全部打たせると1問が重すぎる） */
function TestBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const st = value || {
    calc: null,
    bits: 0,
    pick: null
  };
  const set = patch => onChange({
    ...st,
    ...patch
  });
  const calcTotal = c => c ? c.nums.reduce((a, n, i) => i === 0 ? n : c.ops[i - 1] === "−" ? a - n : a + n, 0) : 0;
  if (q.station === "S0" || q.station === "S1") {
    const v = calcTotal(st.calc);
    return /*#__PURE__*/React.createElement("div", {
      className: "box"
    }, q.station === "S0" && /*#__PURE__*/React.createElement(WeightTable, {
      blank: true
    }), /*#__PURE__*/React.createElement(Calc, {
      plain: q.station === "S0",
      value: st.calc,
      onChange: c => set({
        calc: c
      })
    }), /*#__PURE__*/React.createElement("button", {
      className: "next",
      onClick: () => onSubmit(v),
      disabled: locked || !st.calc
    }, v, " \u3067\u6C7A\u5B9A"));
  }
  if (q.station === "S8") {
    // 選ぶと消去法で当たってしまう。**自分で書く。**
    // サブネットマスクは4つの数、プレフィックス長は1つの数
    const slot = st.slot == null ? 0 : st.slot;
    const parts = st.parts || [null, null, null, null];
    const v = calcTotal(st.calc);
    const toMask = q.goal === "toMask";
    const out = toMask ? parts.join(".") : `/${v}`;
    const done = toMask ? parts.every(x => x != null) : !!st.calc;
    return /*#__PURE__*/React.createElement("div", {
      className: "box"
    }, /*#__PURE__*/React.createElement(WeightTable, null), toMask && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "lead now"
    }, "\u6253\u3061\u3053\u3080\u3068\u3053\u308D\u3092\u62BC\u3057\u3066\u304B\u3089\u3001\u4E0B\u306E\u6570\u5B57\u3067\u5165\u308C\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
      className: "dots"
    }, parts.map((x, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, i > 0 && /*#__PURE__*/React.createElement("span", {
      className: "dot"
    }, "."), /*#__PURE__*/React.createElement("button", {
      className: "oct" + (x == null ? " blank" : "") + (slot === i ? " on" : ""),
      onClick: () => !locked && set({
        slot: i,
        calc: null
      })
    }, x == null ? "_" : x))))), /*#__PURE__*/React.createElement(Calc, {
      value: st.calc,
      onChange: c => {
        const t = c ? c.nums.reduce((a, n, i) => i === 0 ? n : c.ops[i - 1] === "−" ? a - n : a + n, 0) : 0;
        if (!toMask) {
          set({
            calc: c
          });
          return;
        }
        const n2 = parts.slice();
        n2[slot] = t;
        set({
          calc: c,
          parts: n2
        });
      }
    }), /*#__PURE__*/React.createElement("button", {
      className: "next",
      onClick: () => onSubmit(out),
      disabled: locked || !done
    }, toMask ? done ? `${out} で決定` : "4つとも入れてください" : `/${v} で決定`));
  }

  // ステージ5の手順テスト。**次に何をするかを選ばせ、選んだ処理だけをやらせる。**
  // 道具は「選んだ処理をやる場所」だけ。重み表も電卓も出さない
  if (q.steps5) {
    const R = q.steps5,
      r = st.r || 0,
      round = R[r];
    // 手順が終わったら、いつもの4択で締める
    const Done = () => /*#__PURE__*/React.createElement(React.Fragment, null, (st.log || []).map((x, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "donerow"
    }, /*#__PURE__*/React.createElement("span", null, i + 1, "\u3000", x.ask), /*#__PURE__*/React.createElement("b", null, x.did))));
    if (!round) {
      return /*#__PURE__*/React.createElement("div", {
        className: "box"
      }, /*#__PURE__*/React.createElement(Done, null), /*#__PURE__*/React.createElement("div", {
        className: "lead now"
      }, "\u7B54\u3048\u306F\u3069\u308C\u3067\u3059\u304B\u3002"), /*#__PURE__*/React.createElement("div", {
        className: "choices"
      }, (q.choices || [String(q.answer)]).map(c => /*#__PURE__*/React.createElement("button", {
        key: c,
        className: "ch" + (st.pick === c ? " on" : "") + (locked && c === String(q.answer) ? " right" : "") + (locked && st.pick === c && c !== String(q.answer) ? " wrong" : ""),
        onClick: () => !locked && set({
          pick: c
        })
      }, /*#__PURE__*/React.createElement("span", null, c), locked && st.pick === c && c !== String(q.answer) && /*#__PURE__*/React.createElement("i", null, "\u3042\u306A\u305F\u306E\u56DE\u7B54")))), /*#__PURE__*/React.createElement("button", {
        className: "next",
        onClick: () => onSubmit(st.pick),
        disabled: locked || !st.pick
      }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
    }
    const picked = st.picked || null,
      doneAsk = st.doneAsk || false;
    const bits = st.bits || 0,
      sum = W8.reduce((a, w) => a + (bits & w ? w : 0), 0);
    const miss = () => set({
      bad: true
    });
    // そのフェーズだけ、やり直す（問題ごと最初に戻さない）
    const again = () => set(doneAsk ? {
      bad: false,
      oct: null,
      bits: 0,
      step2: false
    } : {
      bad: false,
      picked: null
    });
    const pick = a => {
      if (doneAsk) return;
      if (a === round.ok) set({
        picked: a,
        doneAsk: true,
        bad: false
      });else set({
        picked: a,
        bad: true,
        slip: true
      });
    };
    // 済んだ処理を残す。段を進むたびに覚えておくのはきつい
    const noteOf = () => {
      if (round.kind === "oct") {
        // 線の位置は、この2進数の「いちばん右の 1 の後ろ」。
        // あとの段で思い出さなくていいように、ここに残す
        const mv = Number(maskStr(q.board.len).split(".")[st.oct]);
        return `${mv} → ${bin8(mv)}`;
      }
      if (round.kind === "bits") return `${round.want} → ${W8.map(w => bits & w ? 1 : 0).join("")}`;
      return `全部 0 → ${round.want}　／　全部 1 → ${round.want2}`;
    };
    const nextRound = () => set({
      r: r + 1,
      picked: null,
      doneAsk: false,
      bad: false,
      oct: null,
      bits: 0,
      step2: false,
      log: (st.log || []).concat([{
        ask: round.ok,
        did: noteOf()
      }])
    });
    // その処理ができたか
    const okNow = round.kind === "oct" ? st.oct === round.want : round.kind === "bits" ? sum === round.want : st.step2 ? sum === round.want2 : sum === round.want;
    const doIt = () => {
      if (!okNow) {
        set({
          bad: true,
          slip: true
        });
        return;
      }
      if (round.kind === "fill" && !st.step2) {
        set({
          step2: true,
          bad: false
        });
        return;
      }
      if (r + 1 >= R.length) set({
        r: R.length,
        picked: null,
        doneAsk: false,
        bad: false,
        log: (st.log || []).concat([{
          ask: round.ok,
          did: noteOf()
        }])
      });else nextRound();
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "box"
    }, /*#__PURE__*/React.createElement(Done, null), /*#__PURE__*/React.createElement("div", {
      className: "lead now"
    }, round.ask), /*#__PURE__*/React.createElement("div", {
      className: "choices"
    }, round.opts.map(a => /*#__PURE__*/React.createElement("button", {
      key: a,
      className: "ch" + (picked === a ? a === round.ok ? " right" : " wrong" : ""),
      onClick: () => pick(a)
    }, a))), st.bad && !doneAsk && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "dhead ng"
    }, "\u2715 \u9055\u3044\u307E\u3059"), /*#__PURE__*/React.createElement("button", {
      className: "next retry",
      onClick: again
    }, "\u3082\u3046\u4E00\u5EA6")), doneAsk && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "lead now"
    }, st.step2 ? "つぎは、同じ並びで、全部 1 にする" : round.todo), round.kind === "oct" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "dots"
    }, /*#__PURE__*/React.createElement("span", {
      className: "d-lab"
    }, "IP"), q.board.ip.split(".").map((v, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, i > 0 && /*#__PURE__*/React.createElement("span", {
      className: "dot"
    }, "."), /*#__PURE__*/React.createElement("span", {
      className: "num"
    }, v)))), /*#__PURE__*/React.createElement("div", {
      className: "dots"
    }, /*#__PURE__*/React.createElement("span", {
      className: "d-lab"
    }, "\u30DE\u30B9\u30AF"), maskStr(q.board.len).split(".").map((v, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, i > 0 && /*#__PURE__*/React.createElement("span", {
      className: "dot"
    }, "."), /*#__PURE__*/React.createElement("button", {
      className: "oct" + (st.oct === i ? " on" : ""),
      onClick: () => set({
        oct: i,
        bad: false
      })
    }, v))))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "split"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sp-lab"
    }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
      className: "sp-row"
    }, [7, 6, 5, 4, 3, 2, 1, 0].map(n => /*#__PURE__*/React.createElement("span", {
      key: n,
      className: "sp-c fixed pw"
    }, n, "\u4E57")))), /*#__PURE__*/React.createElement("div", {
      className: "split"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sp-lab"
    }), /*#__PURE__*/React.createElement("div", {
      className: "row8 tight"
    }, W8.map(w => /*#__PURE__*/React.createElement("button", {
      key: w,
      className: "cell bare" + (bits & w ? " on" : ""),
      onClick: () => set({
        bits: bits & w ? bits - w : bits + w,
        bad: false
      })
    }, /*#__PURE__*/React.createElement("span", {
      className: "c-v"
    }, bits & w ? 1 : 0))))), /*#__PURE__*/React.createElement("div", {
      className: "out"
    }, /*#__PURE__*/React.createElement("span", {
      className: "o-n"
    }, "\u3053\u306E8\u3064 \uFF1D ", /*#__PURE__*/React.createElement("b", null, sum)))), st.bad ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "dhead ng"
    }, "\u2715 \u9055\u3044\u307E\u3059"), /*#__PURE__*/React.createElement("button", {
      className: "next retry",
      onClick: again
    }, "\u3082\u3046\u4E00\u5EA6")) : /*#__PURE__*/React.createElement("button", {
      className: "next",
      onClick: doIt
    }, "\u6B21\u3078\u9032\u3080")));
  }
  if (q.station === "S2") {
    const bits = st.bits || 0;
    const W = [128, 64, 32, 16, 8, 4, 2, 1];
    return /*#__PURE__*/React.createElement("div", {
      className: "box"
    }, /*#__PURE__*/React.createElement(Calc, {
      value: st.calc,
      onChange: c => set({
        calc: c
      })
    }), /*#__PURE__*/React.createElement("div", {
      className: "lead now"
    }, "\u5F15\u3051\u305F\u3068\u3053\u308D\u306F ", /*#__PURE__*/React.createElement("b", null, "1"), "\u3001\u5F15\u3051\u306A\u304B\u3063\u305F\u3068\u3053\u308D\u306F ", /*#__PURE__*/React.createElement("b", null, "0"), " \u306B\u3057\u307E\u3059\u3002\u5DE6\u304B\u3089\u9806\u306B\u5165\u308C\u3066\u304F\u3060\u3055\u3044"), /*#__PURE__*/React.createElement("div", {
      className: "row8 answ"
    }, W.map(w => /*#__PURE__*/React.createElement("button", {
      key: w,
      className: "cell bare" + (bits & w ? " on" : ""),
      onClick: () => !locked && set({
        bits: bits & w ? bits - w : bits + w
      })
    }, /*#__PURE__*/React.createElement("span", {
      className: "c-v"
    }, bits & w ? 1 : 0)))), /*#__PURE__*/React.createElement("div", {
      className: "out"
    }, /*#__PURE__*/React.createElement("span", {
      className: "o-n"
    }, "\u3044\u307E ", /*#__PURE__*/React.createElement("b", null, W.map(w => bits & w ? 1 : 0).join("")))), /*#__PURE__*/React.createElement("button", {
      className: "next",
      disabled: locked || !bits,
      onClick: () => onSubmit(W.map(w => bits & w ? 1 : 0).join(""))
    }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "\u899A\u3048\u305F\u8868\uFF08\u898B\u306A\u304C\u3089\u8A08\u7B97\u3057\u307E\u3059\uFF09"), /*#__PURE__*/React.createElement(WeightTable, null), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "\u30E1\u30E2\uFF08\u4F7F\u3063\u3066\u3082\u4F7F\u308F\u306A\u304F\u3066\u3082\u3088\u3044\u3002\u63A1\u70B9\u3057\u307E\u305B\u3093\uFF09"), /*#__PURE__*/React.createElement("textarea", {
    className: "scratch",
    rows: "3",
    placeholder: "\u3053\u3053\u306B\u66F8\u3051\u307E\u3059",
    value: st.note || "",
    onChange: e => !locked && set({
      note: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Calc, {
    value: st.calc,
    onChange: v => !locked && set({
      calc: v
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "choices"
  }, (q.choices || [String(q.answer)]).map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: "ch" + (st.pick === c ? " on" : "")
    // 答え合わせのあとだけ、正解を緑・押した外れを赤にする
    + (locked && c === String(q.answer) ? " right" : "") + (locked && st.pick === c && c !== String(q.answer) ? " wrong" : ""),
    onClick: () => !locked && set({
      pick: c
    })
  }, /*#__PURE__*/React.createElement("span", null, c), locked && st.pick === c && c !== String(q.answer) && /*#__PURE__*/React.createElement("i", null, "\u3042\u306A\u305F\u306E\u56DE\u7B54")))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(st.pick),
    disabled: locked || !st.pick
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
}

/* =========================================================================
   結果
   ========================================================================= */
function Result({
  res,
  plan,
  onHome,
  onAgain,
  onTest
}) {
  const {
    correct,
    total,
    newly,
    newBest,
    bestMs,
    hadBest
  } = res;
  const need = needOf(plan.test, plan.station);
  const cleared = correct >= need;
  const st = byId(plan.station);
  const msg = !cleared ? `あと ${need - correct} 問。` : plan.test ? newly ? "バッジをもらいました。" : "バッジはもう持っています。" : newly ? "覚えました。つぎはテストです。" : "覚えたまま保てています。";
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap result" + (newly ? " flash" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "rtitle"
  }, st.no, "\u3000", st.name), /*#__PURE__*/React.createElement("div", {
    className: "rscore" + (cleared ? " ok" : "")
  }, correct, /*#__PURE__*/React.createElement("span", null, "/", total)), plan.test && cleared && /*#__PURE__*/React.createElement("div", {
    className: "rbadge"
  }, "\uD83C\uDFC5"), /*#__PURE__*/React.createElement("div", {
    className: "rmsg"
  }, msg), newly && NEXT[plan.station] && /*#__PURE__*/React.createElement("div", {
    className: "rnext"
  }, NEXT[plan.station]), !plan.test ? /*#__PURE__*/React.createElement(React.Fragment, null, cleared ? /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: onTest
  }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B") : /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: onAgain
  }, "\u3082\u3046\u4E00\u5EA6 \u7DF4\u7FD2\u3059\u308B"), cleared && /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: onAgain
  }, "\u3082\u3046\u4E00\u5EA6 \u7DF4\u7FD2\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: onHome
  }, "\u30C8\u30C3\u30D7\u753B\u9762\u306B\u623B\u308B")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: cleared ? onHome : onAgain
  }, cleared ? "トップ画面に戻る" : "もう一度"), /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: cleared ? onAgain : onHome
  }, cleared ? "同じステージをもう一度" : "トップ画面に戻る")));
}

/* =========================================================================
   全体
   ========================================================================= */
function App() {
  const [progress, setProgress] = useState(load);
  const [screen, setScreen] = useState("home");
  const [plan, setPlan] = useState(null);
  const [res, setRes] = useState(null);
  const [runId, setRunId] = useState(0);
  const [unlock, setUnlock] = useState(loadUnlock); // お試しで全部開ける
  const [sheetOf, setSheetOf] = useState(null); // いま開いている練習の1枚
  const homeY = useRef(0);
  useEffect(() => {
    toTop(screen === "home" ? homeY.current : 0);
  }, [screen, runId]);
  const start = (station, test) => {
    if (screen === "home") homeY.current = window.scrollY;
    // 練習は、まず説明の1枚から。そこから暗記ドリルかテストへ行く
    if (test == null) {
      setSheetOf(station);
      setScreen("memo");
      return;
    }
    const first = !progress[station]; // そのステージが初めてか
    const queue = [];
    const n = sizeOf(test, station);
    // 仕上げは、8つの型を一通り出してから もう一巡。並び順は毎回まぜる
    const order = station === "SF" ? finalOrder(n) : null;
    // 同じ材料が1回の中で繰り返し出ないようにする（/24 ばかり出ると練習にならない）
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      // 練習は**よく出るやつだけ**を繰り返す（反射で出るようにするため）。
      // テストは本番どおりの出方（前半はやさしく、後半は実際の割合で）
      // ステージ5の練習は、**最後の2問**を手順つきにする（盤で慣れてから、手順を自分で選ぶ）
      const steps = !test && station === "S3" && i >= n - 2;
      const kind = order ? order[i] : test && station === "S0" && i === 0 ? "table" : null;
      const ease = test ? i / (n - 1) : 0;
      let q2 = makeQuestion(station, ease, test, kind, steps);
      for (let k = 0; k < 40 && seen.has(keyOf(q2)); k++) q2 = makeQuestion(station, ease, test, kind, steps);
      seen.add(keyOf(q2));
      queue.push({
        q: q2,
        scored: true
      });
    }
    setPlan({
      station,
      test,
      first,
      queue
    });
    setRes(null);
    setRunId(runId + 1);
    setScreen("play");
  };
  const done = (results, quit) => {
    const next = {
      ...progress
    };
    for (const r of results) {
      const cur = next[r.station] || {
        seen: 0,
        correct: 0,
        lit: false,
        solo: false
      };
      next[r.station] = {
        ...cur,
        seen: cur.seen + 1,
        correct: cur.correct + (r.ok ? 1 : 0)
      };
    }
    const scored = results.filter(r => r.scored);
    const correct = scored.filter(r => r.ok).length;
    const oks = scored.filter(r => r.ok);
    const avgMs = oks.length ? Math.round(oks.reduce((a, r) => a + r.ms, 0) / oks.length) : null;
    let newly = false,
      newBest = false,
      hadBest = false;
    if (!quit) {
      const cur = next[plan.station];
      const need = needOf(plan.test, plan.station);
      if (correct >= need) {
        if (plan.test) {
          newly = !cur.solo;
          next[plan.station] = {
            ...cur,
            lit: true,
            solo: true
          };
        } else {
          newly = !cur.lit;
          next[plan.station] = {
            ...cur,
            lit: true
          };
        }
      }
      if (correct >= need && avgMs != null) {
        // 表ありと表なしでは速さが比べものにならないので、記録は別に持つ
        const k = plan.test ? "testBestMs" : "bestMs";
        const prev = cur[k];
        hadBest = prev != null;
        newBest = prev == null || avgMs < prev;
        next[plan.station] = {
          ...next[plan.station],
          lastMs: avgMs,
          [k]: newBest ? avgMs : prev
        };
      }
    }
    setProgress(next);
    save(next);

    /* **テストを最後までやったときだけ、1行残す。**途中でやめた回は残さない
       （何問中何問だったのかが言えないので、あとから読むと嘘になる）。
       練習は残さない。ここに混ざると、見たいテストの行が埋もれる。 */
    if (!quit && plan.test && scored.length) {
      const byKind = {};
      for (const r of scored) {
        const k = r.kind || "?";
        if (!byKind[k]) byKind[k] = [0, 0];
        byKind[k][0] += r.ok ? 1 : 0;
        byKind[k][1] += 1;
      }
      const rec = {
        at: nowIso(),
        station: plan.station,
        correct,
        total: scored.length,
        passed: correct >= needOf(plan.test, plan.station),
        avgMs,
        byKind
      };
      const t = loadTests().concat([rec]);
      saveTests(t.length > TEST_MAX ? t.slice(t.length - TEST_MAX) : t);
    }
    if (quit) {
      setScreen("home");
      return;
    }
    const k = plan.test ? "testBestMs" : "bestMs";
    setRes({
      correct,
      total: scored.length,
      newly,
      newBest,
      hadBest,
      bestMs: (next[plan.station] || {})[k]
    });
    setScreen("result");
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, CSS), screen === "home" && /*#__PURE__*/React.createElement(Home, {
    progress: progress,
    unlock: unlock,
    onUnlock: u => {
      setUnlock(u);
      saveUnlock(u);
    },
    onStart: start,
    onExport: () => {
      homeY.current = window.scrollY;
      setScreen("export");
    }
  }), screen === "export" && /*#__PURE__*/React.createElement(ExportScreen, {
    onHome: () => setScreen("home")
  }), screen === "memo" && sheetOf && /*#__PURE__*/React.createElement(Memo, {
    key: sheetOf,
    station: sheetOf,
    onDrill: () => start(sheetOf, false),
    onTest: () => start(sheetOf, true),
    onHome: () => setScreen("home")
  }), screen === "play" && plan && /*#__PURE__*/React.createElement(Play, {
    key: runId,
    plan: plan,
    onDone: rs => done(rs, false),
    onQuit: rs => done(rs, true)
  }), screen === "result" && res && /*#__PURE__*/React.createElement(Result, {
    res: res,
    plan: plan,
    onHome: () => setScreen("home"),
    onAgain: () => start(plan.station, plan.test),
    onTest: () => start(plan.station, true)
  }));
}

/* =========================================================================
   見た目（スマホを前提に。押すところは Apple の目安どおり 44px 以上、文字は11px以上）
   ========================================================================= */
const CSS = `
/* ── 決めた値は、全部ここ ────────────────────────────────
   **文字の大きさと色を書いてよいのは、この :root の中だけ。**
   下の本体で px や #hex を直に書くと、ビルドが止まる。
   前は330行に直値が散らばっていて、1か所直すと他がずれていた
   （実際 11.5px / 12.5px / 14.5px の3つが段から外れたまま気づかれずにいた）。 */
:root{
  /* 文字は7段だけ（Apple の目安：小さい字は 11px 以上、押すところは 44px 以上） */
  --f1:11px; --f2:13px; --f3:15px; --f4:17px; --f5:22px; --f6:34px; --f7:44px;
  /* 余白は6きざみだけ */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:22px; --s6:32px;
  /* 地・枠 */
  --bg:#0d1117; --bg1:#161b22; --bg2:#21262d; --bg-tile:#262c36; --line:#30363d;
  /* 文字（薄い → 濃い） */
  --ink3:#484f58; --ink2:#8b949e; --ink:#e6edf3;
  /* 青 ＝ いま選んでいるもの */
  --blue:#58a6ff; --blue-t:#79c0ff; --blue-bg:#132030;
  /* 緑 ＝ 進む・できた */
  --green:#2ea043; --green-s:#238636; --green-t:#56d364; --green-bg:#0f2a16; --green-a:#2ea04355;
  /* 赤 ＝ 違う */
  --red:#f85149; --red-t:#ff7b72; --red-bg:#2a1315;
  /* 黄 ＝ 区切りの線・断り書き */
  --gold:#e3b341; --gold-bg:#241c10; --gold-line:#5c4d20; --gold-a:#e3b34188;
  /* 札の地・押したとき・影 */
  --lit-bg:#121a14; --solo-bg:#1a170f; --sunk:#0f141b; --key-op:#1c222b; --flash:#1d2a1a;
  --white:#fff; --shadow:#000a;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;
  -webkit-tap-highlight-color:transparent}
button{font-family:inherit;border:0;background:none;color:inherit;cursor:pointer}
.wrap{max-width:460px;margin:0 auto;padding:16px 8px calc(32px + env(safe-area-inset-bottom))}

/* ホーム */
.hero{padding:16px 4px 20px}
.hero-t{font-size:var(--f6);font-weight:800}
.bar{height:8px;background:var(--bg2);border-radius:99px;margin-top:16px;overflow:hidden}
.bar-in{height:100%;background:linear-gradient(90deg,var(--green),var(--green-t));border-radius:99px;transition:width .5s}
.hero-n{font-size:var(--f2);color:var(--ink2);margin-top:8px}



.road{margin-bottom:8px}
.link{width:2px;height:16px;background:var(--line);margin:0 auto}
/* トップ画面の区切り。基礎（1〜4）／試験レベル（5〜9）／仕上げ（10）。
   罫は2つめから（いちばん上に引くと、見出しから切り離されて見える） */
.gsec{margin:var(--s5) 0 var(--s3);padding-top:var(--s3);border-top:1px solid var(--line)}
/* いちばん上の区切りだけ罫なし。**.gsec:first-child では効かない**
   （札はどれも1枚ずつ包まれていて、どの区切りも「包みの先頭の子」になる） */
.road > div:first-child > .gsec{margin-top:var(--s2);padding-top:0;border-top:0}
.gname{font-size:var(--f3);font-weight:800;color:var(--ink)}
.gnum{font-size:var(--f1);font-weight:400;color:var(--ink2);margin-left:var(--s2)}
.gnote{font-size:var(--f2);color:var(--ink2);line-height:1.7;margin-top:var(--s1)}
.tile{display:block;width:100%;text-align:left;
  background:var(--bg1);border:1px solid var(--bg-tile);border-radius:12px;padding:12px 14px;transition:.15s}
.tile.lit{border-color:var(--green-a);background:var(--lit-bg)}
.tile.solo{border-color:var(--gold-a);background:var(--solo-bg)}
.tile.locked{opacity:.5}
.lamp{font-size:var(--f4);color:var(--ink3);flex:0 0 auto;width:22px;text-align:center}
.tile.lit .lamp{color:var(--green-t)}
.tile.solo .lamp{color:var(--gold)}
.t-b{flex:1;min-width:0}
.t-name{display:block;font-size:var(--f3);font-weight:700}
.t-ex{display:block;font-size:var(--f1);color:var(--blue-t);margin-top:4px;
  font-family:ui-monospace,Menlo,monospace;word-break:break-all}
.blocked{font-size:var(--f1);color:var(--gold);text-align:center;padding:8px 0}
/* まとまりの最後に置く、押すと開くブロック。**札ではないので、ランプもバッジも置かない。**
   枠があるもの＝押せるもの。開いているかどうかは、右の印（＋ −）で言う。
   閉じているのが最初の姿。開いたままだと、札の列が読めなくなる */
/* コツの中身。**札の中で開く。**前は基礎の最後に1枚のブロックとして浮かせていたが、
   札の列から外れて見えた。いまはバッジの左のボタンを押すと、その札の中で開く */
.tipb-b{margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--bg-tile)}
.tipb-s{font-size:var(--f1);color:var(--ink2);line-height:1.7}
.tip-p{margin-top:var(--s4)}
.tip-h{font-size:var(--f2);font-weight:700;color:var(--ink);line-height:1.6}
.tip-s{font-size:var(--f1);color:var(--ink2);line-height:1.7;margin-top:var(--s1)}
.tip-r{display:flex;align-items:baseline;gap:var(--s2);margin-top:var(--s2)}
.tip-r b{font-size:var(--f3);color:var(--blue-t);font-family:ui-monospace,Menlo,monospace}
.tip-a{font-style:normal;font-size:var(--f1);color:var(--ink3)}
.tip-r span{font-size:var(--f2);color:var(--ink)}
.foot{font-size:var(--f2);color:var(--ink2);line-height:2;margin-top:22px;text-align:center}

/* 練習 */
.play{padding-top:10px}
.topbar{display:flex;align-items:center;gap:10px;margin-bottom:18px}
.x{font-size:var(--f5);color:var(--ink2);width:44px;height:44px;flex:0 0 auto;margin-left:-10px}
.pbar{flex:1;height:8px;background:var(--bg2);border-radius:99px;overflow:hidden}
.pbar-in{height:100%;background:var(--blue);border-radius:99px;transition:width .35s}
.pnum{font-size:var(--f2);color:var(--ink2);font-variant-numeric:tabular-nums}

.given{background:var(--bg1);border:0;border-radius:12px;padding:4px 14px;margin-bottom:14px}
.grow{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  padding:11px 0;border-bottom:1px solid var(--bg2)}
.grow:last-child{border-bottom:0}
.gk:empty{display:none}
.gk{font-size:var(--f2);color:var(--ink2);flex:0 0 auto}
.gv.big{font-size:var(--f6);width:100%;text-align:center;padding:10px 0}
.gv.long{font-size:var(--f3)}
.gv{font-size:var(--f5);font-weight:700;font-family:ui-monospace,Menlo,monospace;
  text-align:right;word-break:break-all}
.prompt{font-size:var(--f4);font-weight:600;line-height:1.6;margin:0 2px 18px}

/* 盤 */
.box{margin-top:2px}
/* 盤ごと1枚のカード。答え合わせで枠の色が変わり、外すと揺れる */
.card{border:1.5px solid var(--bg2);border-radius:16px;padding:14px;margin-top:8px;
  transition:border-color .2s,box-shadow .2s}
.card.ok{border-color:var(--green)}
.card.ng{border-color:var(--red);box-shadow:0 0 12px var(--red-bg);animation:shake .2s}
.verdict{border-top:1px solid var(--bg2);margin-top:16px;padding-top:14px}
.lead.now{border-left:3px solid var(--blue);padding-left:9px;color:var(--ink)}
.lead.past{color:var(--ink3)}
.lead{font-size:var(--f2);color:var(--ink2);line-height:1.7;margin:14px 0 8px}
.lead:first-child{margin-top:0}
.lead b{color:var(--ink);font-size:var(--f4);font-family:ui-monospace,Menlo,monospace}
.row8{display:grid;grid-template-columns:repeat(8,1fr);gap:5px}
.cell{aspect-ratio:1/1.3;border:1.5px solid var(--line);border-radius:9px;background:var(--bg1);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:44px}
.cell.wide{aspect-ratio:auto;height:46px}
.cell.on{border-color:var(--blue);background:var(--blue-bg)}
.c-v{font-size:var(--f4);font-weight:800;font-family:ui-monospace,Menlo,monospace;color:var(--ink3)}
.cell.on .c-v{color:var(--blue-t)}
.c-w{font-size:var(--f1);color:var(--ink2)}
.cell.on .c-w{color:var(--blue-t)}
.c-w2{font-size:var(--f2);color:var(--ink2);font-family:ui-monospace,Menlo,monospace}
/* 32768 などの5桁。幅375pxだとマスが約30pxしかなく、11px でもまだ 2px はみ出す。
   文字はこれ以上小さくできない（11px が下限）ので、字間だけ詰める */
.c-w2.sm{font-size:var(--f1);letter-spacing:-.6px}
.cell.on .c-w2{color:var(--blue-t);font-weight:800}

.out{text-align:center;margin:16px 0 0}
.o-x{display:block;font-size:var(--f4);color:var(--blue-t);font-family:ui-monospace,Menlo,monospace;
  min-height:20px;word-break:break-all}
.o-n{display:block;font-size:var(--f2);color:var(--ink2);margin-top:8px}
.o-n b{font-size:var(--f6);color:var(--ink);font-family:ui-monospace,Menlo,monospace;margin-left:6px}

.rest{text-align:center;font-size:var(--f3);color:var(--ink2);margin-bottom:14px}
.rest b{font-size:var(--f6);color:var(--ink);font-family:ui-monospace,Menlo,monospace;margin-left:8px}
.rest.zero b{color:var(--green-t)}
.rest.over b{color:var(--red)}
.rest-n{font-size:var(--f2);color:var(--red)}

/* 線を引く盤 */
/* 点で区切られた数を、そのまま押す */
.dots{display:flex;align-items:center;gap:2px;margin-bottom:6px}
.ticks{margin-top:-2px;margin-bottom:8px}
.tick{flex:1;text-align:center;font-size:var(--f1);color:var(--ink2)}
/* マスク → / の向きの「1 の数」。数えたオクテットの下だけ、青く濃くする。
   ＋ は区切りの点と同じ場所に置く（列がずれると、真上のオクテットと結びつかない） */
.tick.on{font-size:var(--f3);font-weight:800;color:var(--blue-t);font-family:ui-monospace,Menlo,monospace}
.dot.plus{font-size:var(--f2);font-weight:400;color:var(--ink3)}
.d-lab{width:44px;flex:none;font-size:var(--f1);color:var(--ink2);text-align:right;padding-right:6px}
.row8.tight{gap:2px}
.row8.answ{margin-bottom:10px}
.wtable{margin-bottom:14px}
/* ── 説明の1枚。段の名札 ─────────────────────────────
   **かたまりの見せ方は、この1種類だけ。**下地も枠も縦線も付けない。
   前は「灰の箱」「黄のベタ塗り」「名札なしの文章」など5通りあって、
   ステージごとに骨組みがちがって見えていた。 */
.sec-w{margin:var(--s5) 0 0}
.sec{font-size:var(--f2);color:var(--ink2);font-weight:700;margin-bottom:var(--s2)}
/* 名札の下の補足。①② の見出しもこれと同じ顔にする（新しい見た目を増やさない） */
.sec-n{font-size:var(--f2);color:var(--ink2);line-height:1.7;margin-bottom:var(--s3)}
.sec-b{font-size:var(--f2);color:var(--ink2);line-height:1.75;margin-bottom:var(--s2)}
.sec-b b{color:var(--ink)}
/* ここから中身、という太い罫（参考にした画面と同じ） */
.rule{height:2px;background:var(--line);margin:var(--s4) 0 var(--s1)}
/* やり方カード。左の縦線が「ここが手順」の印。枠は付けない（押せないので平ら）。
   **名札は付けない。**赤い縦線と太字の見出しが名札そのもの。
   目立つ帯は、1画面にこれ1つだけ */
.way{border-left:3px solid var(--red);padding:2px 0 2px var(--s3);margin:var(--s5) 0 0}
.way-h{font-size:var(--f4);font-weight:700;color:var(--ink);line-height:1.4}
.way-b{font-size:var(--f2);color:var(--ink2);line-height:1.75;margin-top:6px}
.way-b b{color:var(--ink)}
/* 覚える表。枠は無し（押せないので平ら）。行の区切りだけで表に見せる。
   題の下線が、そのまま表のいちばん上の罫になる */
.ex-t{font-size:var(--f2);color:var(--ink);font-weight:700;
  padding-bottom:6px;border-bottom:1px solid var(--bg2)}
/* 番号・手順・答えの3列。**表なので、列をそろえる**（前は左右に寄せるだけだった） */
/* 手順と答えの2列は、**どちらも縮められるようにして幅を分け合う**。
   3列目を auto にすると、長い答え（11111111.…11111000 → /29）が縮まず、
   手順のほうが1文字ずつの縦書きになってしまう。 */
.ex-r{display:grid;grid-template-columns:1.4em minmax(0,1fr) minmax(0,1.3fr);
  gap:0 var(--s2);align-items:baseline;
  padding:7px 2px;border-bottom:1px solid var(--bg2)}
.ex-n{font-style:normal;font-size:var(--f1);color:var(--ink3);text-align:right}
.ex-r span{font-size:var(--f2);color:var(--ink2)}
.ex-r b{font-size:var(--f3);color:var(--ink);font-family:ui-monospace,Menlo,monospace;
  text-align:right;word-break:break-all}
/* 注記。表の行にすると手順の1つに見えるので、外に出して薄くする */
.ex-note{font-size:var(--f1);color:var(--ink2);line-height:1.7;margin-top:var(--s2)}
/* 学習の記録を書き出す画面。**ここだけ、打ちこむ場所がある。**
   枠があるもの＝押せるもの／打てるもの、という約束は同じ */
.fld{display:flex;align-items:center;gap:var(--s3);margin-top:var(--s2)}
.fld span{width:56px;flex:0 0 auto;font-size:var(--f2);color:var(--ink2)}
.fld-i{flex:1;min-width:0;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--line);border-radius:10px;background:var(--bg1);
  font-size:var(--f3);color:var(--ink)}
.exp-done{font-size:var(--f2);color:var(--green-t);line-height:1.7;margin-top:var(--s3)}
.exp-t{width:100%;height:110px;margin-top:var(--s2);padding:var(--s3);
  border:1px solid var(--line);border-radius:10px;background:var(--sunk);
  font-size:var(--f1);color:var(--ink2);font-family:ui-monospace,Menlo,monospace}
/* 式と答えのあいだをつなぐ1行 */
.bridge{display:flex;flex-direction:column;align-items:center;gap:2px;margin:8px 0}
.b-t{font-size:var(--f2);color:var(--ink2);text-align:center}
.b-a{font-size:var(--f2);color:var(--ink2)}
.sp-c.big2{font-size:var(--f3);font-weight:800;color:var(--ink)}
/* 練習の1枚。いちばん下に「テストをする」が貼り付く */
.sheet-p{padding-bottom:110px}
/* 帯にせず、ボタンだけ浮かせる。中身は本文と同じ幅・同じ余白にそろえる。
   上に地の色へのぼかしを敷く。**前は影だけで、後ろの盤の字と重なって読めなかった** */
.gotest{position:fixed;left:0;right:0;bottom:0;z-index:30;pointer-events:none;
  max-width:460px;margin:0 auto;
  padding:var(--s6) var(--s2) calc(10px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,transparent,var(--bg) 45%)}
.gotest.two{display:flex;gap:var(--s2)}
.gotest .next{flex:1;min-width:0;pointer-events:auto;margin-top:0;
  box-shadow:0 6px 18px var(--shadow)}
/* **緑は「いま進む道」1つだけ。**テストは灰の枠にして、どちらが先かを見た目で言う */
.next.ghost{background:var(--bg1);border:1.5px solid var(--line);color:var(--ink)}
.rnext{font-size:var(--f2);color:var(--ink2);line-height:1.7;margin:14px 0 4px;text-align:left}
/* 「図で見ると」の表。ネットワーク部＝青、ホスト部＝灰、区切り位置＝黄の縦線。
   **表（グリッド）で組むので、列が機械的にそろう。**
   前は等幅フォントで中央ぞろえしていただけで、名札の幅が行ごとに違うと
   255 が自分のオクテットの真下に来ず、区切り位置も行ごとに左右へずれていた。
   **枠は付けない**（枠があるもの＝押せるもの、という決まり）。マスの区切りは下地の色だけ。 */
.figg{display:grid;align-items:center;margin:var(--s3) 0 var(--s2);
  font-family:ui-monospace,Menlo,monospace}
/* 見出し。区切りが列と列のあいだにあるステージでは、見出しもその列で分ける
   （「どこまでがネットワーク部か」が、見出しの幅そのもので分かる） */
.fg-h{font-size:var(--f1);color:var(--ink2);text-align:center;padding-bottom:var(--s1)}
.fg-h.n{color:var(--blue-t)}
.fg-h.wide{display:flex;justify-content:space-between}
.fg-hn{color:var(--blue-t)}
.fg-lab{font-size:var(--f1);color:var(--ink2);text-align:right;
  padding-right:var(--s2);white-space:nowrap}
.fg-c{font-size:var(--f2);text-align:center;padding:5px 1px;white-space:nowrap}
.fg-c.n{color:var(--blue-t);background:var(--blue-bg)}
.fg-c.h{color:var(--ink2);background:var(--bg1)}
.fg-c.sm{font-size:var(--f1);color:var(--ink2)}
/* 区切り位置。枠ではなく1本の線。同じ列に入るので、行をまたいで縦に1本つながる */
.fg-c.cut{box-shadow:inset 2px 0 0 var(--gold)}
.fg-cut{display:inline-block;width:2px;height:13px;background:var(--gold);
  vertical-align:-2px;margin:0 1px}
.fg-n{color:var(--blue-t)}
.fg-o{color:var(--ink2)}
/* 右の一言。**中身が無くても消さない。**display:none にすると
   そのマスが表から抜けて、次の行が1列ずれる（区切りの縦線がそろわなくなる） */
.fg-r{font-size:var(--f1);color:var(--ink2);padding-left:var(--s2);white-space:nowrap}
.fg-cap{font-size:var(--f1);color:var(--ink2);padding:2px 0 var(--s2)}
.fg-foot{font-size:var(--f1);color:var(--gold);padding-top:var(--s1)}
/* 罫は、向きが2つあるステージで ① と ② を分けるときだけ。
   1つしか無いときに罫を引くと、上の名札から切り離されて見える */
.tut + .tut{border-top:1px solid var(--bg2);padding-top:var(--s5);margin-top:var(--s5)}
.rbadge{text-align:center;font-size:var(--f7);margin:6px 0 2px;animation:pop .25s ease-out}
/* 済んだ処理。何をして何が出たかを残す */
.scratch{width:100%;margin-top:10px;padding:10px 12px;border:1.5px dashed var(--line);border-radius:12px;
  background:none;color:var(--ink);font-size:var(--f3);font-family:ui-monospace,Menlo,monospace;resize:vertical}
.scratch::placeholder{color:var(--ink3)}
.donerow{display:flex;flex-direction:column;gap:2px;padding:8px 10px;margin-bottom:6px;
  border-left:3px solid var(--bg2);font-size:var(--f2);color:var(--ink2)}
.donerow b{color:var(--ink);font-family:ui-monospace,Menlo,monospace}
.dhead{text-align:center;font-size:var(--f5);font-weight:800;margin-top:18px}
.dhead.ok{color:var(--green-t)}
.dhead.ng{color:var(--red-t)}
/* 見出しの1かたまり。**青いピルをやめた。**枠のあるものは押せるもの、という決まりに反していたし、
   「チュートリアル」だけが画面でいちばん目立つ理由が無かった。
   いまは「いま何をする画面で、10のうちどこか」を灰の1行で言う */
.mkind{font-size:var(--f2);color:var(--ink2);font-weight:700}
.mtitle{font-size:var(--f5);font-weight:800;margin:6px 0 var(--s1);line-height:1.35}
.msub2{font-size:var(--f2);color:var(--ink2)}
/* 解き方の要点。操作の前に置く言葉は、これ1行だけにする */
.point{font-size:var(--f2);color:var(--ink2);margin-bottom:10px}
.point b{color:var(--ink)}
.u{text-decoration:underline;text-decoration-color:var(--blue);text-decoration-thickness:3px;
  text-underline-offset:4px;color:var(--blue-t)}
/* いま見るところ／まだ先のところ。押せるかどうかは変えない */
.cell.now{border-color:var(--blue)}
.cell.later{opacity:.45}
.oct{min-height:56px;min-width:56px;flex:1;border:1.5px solid var(--line);border-radius:10px;background:var(--bg1);
  padding:6px 2px;font-size:var(--f5);font-weight:700;font-family:ui-monospace,Menlo,monospace;color:var(--ink2)}
/* 押せないものは、枠を持たない。枠があるのに押せないと、押せると思って触ってしまう */
.num{flex:1;text-align:center;font-size:var(--f4);font-weight:700;
  font-family:ui-monospace,Menlo,monospace;color:var(--ink2);padding:8px 2px}
.num.on{color:var(--blue-t);background:var(--blue-bg);border-radius:8px}
.oct.on{border-color:var(--blue);background:var(--blue-bg);color:var(--blue-t);font-weight:900}
/* まだ数字が入っていない枠は破線。入ると実線に変わる */
.oct.blank{border-style:dashed;background:none;color:var(--ink3)}
.dot{font-size:var(--f5);font-weight:800;color:var(--ink2);padding:0 1px}
.sub{font-size:var(--f2);color:var(--ink2);margin:-4px 0 8px}
/* ステージの札。上が名前、下が「練習する」「テストをする」の2つ */
/* 札の上の段。名前の押しどころ ／ コツ ／ バッジ。**押しどころは入れ子にしない** */
.t-top{display:flex;align-items:center;gap:12px}
.t-h{display:flex;align-items:center;gap:12px;flex:1;min-width:0;text-align:left;min-height:48px}
/* 計算を楽にする方法。**名前の下の行に、札の中で置く。**
   バッジの左に並べると、9文字ぶんの幅を取って名前が潰れる。
   枠があるもの＝押せるもの。札の名前より弱くするため、細字の灰にする */
.t-tip{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);
  width:100%;min-height:44px;margin-top:var(--s3);padding:0 var(--s3);text-align:left;
  border:1px solid var(--line);border-radius:10px;font-size:var(--f2);color:var(--ink2)}
.t-tip.on{border-color:var(--blue);background:var(--blue-bg);color:var(--blue-t)}
.t-tip-m{font-size:var(--f3);flex:0 0 auto}
.slot{flex:0 0 auto;width:44px;height:44px;border:1.5px dashed var(--line);border-radius:10px;
  display:flex;align-items:center;justify-content:center;font-size:var(--f5)}
.slot.got{border-style:solid;border-color:var(--gold);background:var(--solo-bg)}
.tile.pick{border-color:var(--blue)}
.t-go{display:flex;gap:8px;margin-top:10px}
.go{flex:1;min-height:44px;padding:10px 6px;border:1px solid var(--line);border-radius:10px;
  background:var(--bg);font-size:var(--f3);font-weight:700;color:var(--ink)}
.go.off{color:var(--ink3);border-style:dashed}
.unlock{display:block;margin:14px auto 0;padding:10px 16px;min-height:44px;font-size:var(--f2);
  color:var(--ink2);border:1px solid var(--line);border-radius:99px}
.unlock.on{border-color:var(--blue);color:var(--blue-t)}
.split{display:grid;grid-template-columns:44px 1fr;gap:6px;align-items:center}
/* 行そのものを押す。押せる物の見た目（枠の太さ）は .sp-c とそろえる */
.sp-c.blank{border-style:dashed;background:none}
/* 「7乗」は3文字。マスからはみ出さないように小さく＋はみ出しを切る */
.sp-c.pw{font-size:var(--f1);min-width:0;overflow:hidden}
.sp-row,.row8{min-width:0}
.sp-row>*,.row8>*{min-width:0}
.sp-c.done{color:var(--blue-t)}
/* 線から左は、③の並びをそのまま持ってきたもの。同じ地の色で目をつなぐ */
.sp-c.from{background:var(--blue-bg);border-radius:7px}
/* 行ごと押す段。行頭のボタン分、左を広くとる */
/* 並びと住所をつなぐ行 */
.asm{display:flex;flex-direction:column;align-items:center;gap:2px;margin:6px 0 14px;
  font-size:var(--f2);color:var(--ink2)}
.asm b{color:var(--ink)}
.asm-a{font-size:var(--f4);font-weight:800;color:var(--blue-t);font-family:ui-monospace,Menlo,monospace}
.split.bulk{grid-template-columns:64px 1fr}
.split.bulk .go{min-height:44px;font-size:var(--f2);padding:6px 4px}
.split.bulk .go.on{border-color:var(--blue);background:var(--blue-bg);color:var(--blue-t)}
/* 名前と数を同じ行に置くと折り返して崩れるので、縦に積む */
.d-r.col{display:block}
.d-r.col b{display:block;margin-top:2px;text-align:left}
.sp-c.off{color:var(--ink3)}
.sp-c.sp-c.zero{border-color:var(--blue);color:var(--blue-t)}
.sp-c.sp-lab i{display:block;font-style:normal;color:var(--ink2);font-size:var(--f1);margin-top:2px}
.sp-lab{font-size:var(--f1);color:var(--ink2);text-align:right}
/* 段の名前。名札の枠（44px）には「第4オクテット」が入らないので、段の上に置く */
.sp-head{grid-column:1/-1;font-size:var(--f1);color:var(--ink2);margin-top:2px}
.sp-row{display:grid;grid-template-columns:repeat(8,1fr);gap:3px}
.sp-c{height:44px;border:1px solid var(--line);border-radius:7px;background:var(--bg1);
  font-size:var(--f3);font-family:ui-monospace,Menlo,monospace;color:var(--ink3);padding:0}
.sp-c.on{border-color:var(--blue);background:var(--blue-bg);color:var(--blue-t);font-weight:800}
/* 押せないものは、枠も地の色も持たない。枠があるのに押せないと、押せると思って触ってしまう */
.sp-c.fixed{display:flex;align-items:center;justify-content:center;color:var(--ink);
  border-color:transparent;background:none}
/* 線は「ここまで同じ／ここまでがネットワーク」の意味。だから選んだ桁の**右**に引く。
   丸い枠に影を付けるとカッコのように曲がって見えるので、まっすぐな棒を1本置く */
.sp-c,.st-c{position:relative}
.sp-c.edge::after,.st-c.edge::after{content:"";position:absolute;right:-3px;top:2px;bottom:2px;
  width:2px;background:var(--gold);border-radius:1px}
.sp-row.w{grid-template-columns:repeat(8,1fr)}
.sp-w{font-size:var(--f1);color:var(--ink2);text-align:center}

.derive{background:var(--bg1);border:0;border-radius:12px;padding:4px 14px;margin-top:16px}
.d-r{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  padding:9px 0;border-bottom:1px solid var(--bg2)}
.d-r:last-child{border-bottom:0}
.d-r span{font-size:var(--f2);color:var(--ink2)}
.d-r b{font-size:var(--f4);font-family:ui-monospace,Menlo,monospace;text-align:right;word-break:break-all}
.d-r.ans b{font-size:var(--f4);font-weight:800;color:var(--blue-t)}

/* 縦に並べる盤 */
.stack{display:flex;flex-direction:column;gap:5px}
.st-row{display:grid;grid-template-columns:44px repeat(8,1fr);gap:3px;align-items:center}
.st-d{font-size:var(--f2);color:var(--ink2);text-align:right;font-family:ui-monospace,Menlo,monospace}
.st-c{height:44px;border:1px solid var(--line);border-radius:7px;background:var(--bg1);
  font-size:var(--f3);font-family:ui-monospace,Menlo,monospace;color:var(--ink2);padding:0}
.st-c.same{background:var(--blue-bg);color:var(--blue-t);font-weight:800}


.next{display:block;width:100%;padding:16px;border-radius:12px;background:var(--green-s);
  color:var(--white);font-size:var(--f4);font-weight:700;margin-top:16px}
.next:disabled{background:var(--bg2);color:var(--ink2)}
/* 答え合わせのボタン。正解＝落ち着いた緑／不正解＝青の「もう一度」 */
.next.calm{background:var(--green-bg);border:1px solid var(--green);color:var(--green-t)}
.next.retry{background:var(--blue-bg);border:1px solid var(--blue);color:var(--blue-t)}
.mini{display:block;width:100%;min-height:44px;font-size:var(--f2);color:var(--ink2);margin-top:10px}

/* テスト（表なし） */
.testnote{background:var(--gold-bg);border:1px solid var(--gold-line);border-radius:12px;
  padding:11px 14px;margin-bottom:16px;font-size:var(--f2);color:var(--gold);text-align:center}
.cell.bare{aspect-ratio:1/1.1}
.choices{display:flex;flex-direction:column;gap:9px}
.ch i{font-style:normal;font-size:var(--f1);font-weight:400;color:var(--red-t);margin-left:10px}
.ch{display:flex;align-items:center;justify-content:center;width:100%;min-height:56px;padding:14px;border:1.5px solid var(--line);border-radius:12px;
  background:var(--bg1);font-size:var(--f4);font-family:ui-monospace,Menlo,monospace;
  word-break:break-all;transition:.15s}
.ch.on{border-color:var(--blue);background:var(--blue-bg);color:var(--blue-t);font-weight:800}
.ch.right{border-color:var(--green);background:var(--green-bg);color:var(--green-t);font-weight:700}
.ch.wrong{border-color:var(--red);background:var(--red-bg);color:var(--red-t);font-weight:700}

/* 計算するところ。＋と− だけ */
.calc{margin-bottom:20px;margin-top:18px}
.calc-d{background:var(--sunk);border:0;border-radius:12px;
  padding:12px 14px;margin-bottom:8px;text-align:right}
.calc-e{font-size:var(--f3);color:var(--ink2);font-family:ui-monospace,Menlo,monospace;
  word-break:break-all;min-height:20px;line-height:1.5}
.calc-t{font-size:var(--f6);font-weight:800;font-family:ui-monospace,Menlo,monospace;margin-top:4px}
.keys{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.k{height:52px;border:1px solid var(--line);border-radius:10px;background:var(--bg1);
  font-size:var(--f5);font-family:ui-monospace,Menlo,monospace}
.k.op{background:var(--key-op);color:var(--blue-t)}
.k.w2{grid-column:span 2}

/* 解き方 */
.why{margin-top:8px;background:var(--bg1);border:0;border-radius:12px;padding:14px}
.why-h{font-size:var(--f2);color:var(--ink2);margin-bottom:10px}
.step{display:grid;grid-template-columns:20px 1fr;gap:4px 9px;padding:9px 0;border-top:1px solid var(--bg2)}
.step:first-of-type{border-top:0}
.step-n{grid-row:span 2;width:20px;height:20px;border-radius:50%;background:var(--bg2);
  font-size:var(--f1);display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.step-t{font-size:var(--f2);color:var(--ink2);line-height:1.5}
.step-v{font-size:var(--f3);font-weight:600;font-family:ui-monospace,Menlo,monospace;
  word-break:break-all;line-height:1.6}
/* 答え合わせの帯（画面のいちばん下に貼り付く） */
.j-ans b{font-size:var(--f4);font-family:ui-monospace,Menlo,monospace}
.j-tip{font-size:var(--f2);color:var(--ink2);margin-top:6px}
/* 帯の分、下に余白を空けて盤が隠れないようにする */

@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes up{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}

/* 結果 */
.result{text-align:center;padding-top:72px}
.result.flash{animation:flash .4s ease-out}
@keyframes flash{0%{background:var(--flash)}100%{background:transparent}}
.rtitle{font-size:var(--f3);color:var(--ink2);font-weight:600}
.rscore{font-size:var(--f7);font-weight:800;font-family:ui-monospace,Menlo,monospace;
  line-height:1.1;margin-top:10px;color:var(--ink3)}
.rscore.ok{color:var(--green-t)}
.rscore span{font-size:var(--f6);color:var(--ink3);margin-left:4px}
.rmsg{font-size:var(--f3);line-height:1.9;margin:20px 8px 8px}

/* やり方 */
@keyframes fade{from{opacity:0}to{opacity:1}}

@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.01ms !important;transition-duration:.01ms !important}
}
`;
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
