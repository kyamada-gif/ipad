/* 自動生成: build.js（app.jsx -> app.js）。手で編集せず app.jsx を直して再ビルド。 */
const { useState, useEffect, useRef, useMemo } = React;
/*
 * IPアドレスの計算（試作2）
 *
 * ■ 背骨 ── 盤は1つ、線は1本
 *   教材PDFは「2進数の桁の重みの表」を1つ出して、7つの手順すべてをその上でやる。
 *   このアプリも同じ。画面の中心にいつも盤がある。
 *   **人がやるのは、どれを押すか／どこに線を引くか だけ。**
 *   足し算と10進への変換は機械がやる。暗算は求めない。
 *
 * ■ 覚えることは3つの状態だけ
 *   ○ まだ　　● できた（5問中4問）　　★ 手が動く（もう一度 4問）
 *
 * ■ 画面
 *   ホーム（7ステージの道）→ 練習（5問）→ 結果
 *   押すボタンはホームに「つづける」1つ。何をやるかはアプリが決める。
 */

const DRILL_QN = 5; // 練習は5問（手を動かして慣れる場）
const TEST_QN = 10; // テストは10問（本番と同じ形で測る場）
const DRILL_N = 4; // 練習：5問中4問で ● できた
const CLEAR_N = 9; // テスト：10問中9問で ★ バッジ
/** その回の問題数と合格ライン。練習は5問中4問、テストは10問中9問。 */
const sizeOf = test => test ? TEST_QN : DRILL_QN;
/** その問題の「材料」。同じものを1回の中で繰り返さないために使う。 */
const keyOf = q => q.given.map(g => g.v).join("|");
/** その回の合格ライン。練習は8割、テストは9割。 */
const needOf = test => test ? CLEAR_N : DRILL_N;
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
const byId = id => STATIONS.find(s => s.id === id);
const isLit = (p, id) => !!(p[id] && p[id].lit);
const isSolo = (p, id) => !!(p[id] && p[id].solo);
const isOpen = (p, st) => st.need.every(n => isLit(p, n));
/** カードを混ぜる。順番で覚えてしまわないように */
const shuffleCards = a => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
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
  onStart
}) {
  const [blocked, setBlocked] = useState(null);
  const [pick, setPick] = useState(null); // いま開いている札
  const doneP = STATIONS.filter(s => isLit(progress, s.id)).length;
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
    const solo = isSolo(progress, s.id),
      lit = isLit(progress, s.id);
    const open = unlock || isOpen(progress, s);
    // テストは、練習でできてから。手順を知らないまま4択をやっても、
    // 4回に1回当たるだけで記録が汚れる
    const canTest = unlock || lit;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id
    }, i > 0 && /*#__PURE__*/React.createElement("div", {
      className: "link"
    }), /*#__PURE__*/React.createElement("div", {
      className: "tile" + (open ? "" : " locked") + (lit ? " lit" : "") + (solo ? " solo" : "") + (pick === s.id ? " pick" : "")
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
    }, s.ex)), /*#__PURE__*/React.createElement("span", {
      className: "slot" + (solo ? " got" : "")
    }, solo ? "🏅" : "")), pick === s.id && open && /*#__PURE__*/React.createElement("div", {
      className: "t-go"
    }, /*#__PURE__*/React.createElement("button", {
      className: "go",
      onClick: () => onStart(s.id, null)
    }, "\u7DF4\u7FD2\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
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
  }, unlock ? "鍵をかけ直す" : "ぜんぶ開く（お試し）"));
}

/* =========================================================================
   練習
   ========================================================================= */
function Play({
  plan,
  onDone,
  onQuit
}) {
  const [queue, setQueue] = useState(plan.queue);
  const [idx, setIdx] = useState(0);
  const [judged, setJudged] = useState(null);
  const [val, setVal] = useState(null); // 盤の状態。盤ごとに形がちがう
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
    if (judged === false && why.current) {
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
    const rs = first ? results.concat([{
      idx,
      station: q.station,
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
    className: "wrap play" + (judged === null ? "" : judged ? " lit-ok" : " lit-ng")
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
  }, Math.min(doneScored + (item.scored ? 1 : 0), scored), "/", scored)), /*#__PURE__*/React.createElement("div", {
    className: "given"
  }, q.given.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "grow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gk"
  }, g.k), /*#__PURE__*/React.createElement("span", {
    className: "gv" + (g.u != null ? " big" : "")
  }, g.u != null || q.underline && !plan.test ? String(g.v).split("").map((c, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    className: g.u != null ? j === g.u ? "u" : "" : c === q.underline ? "u" : ""
  }, c)) : g.v)))), /*#__PURE__*/React.createElement("div", {
    className: "prompt"
  }, q.prompt), plan.test && /*#__PURE__*/React.createElement("div", {
    className: "testnote"
  }, "\u899A\u3048\u305F\u8868\u3092\u601D\u3044\u51FA\u3057\u3066\u7B54\u3048\u307E\u3059"), plan.test ? /*#__PURE__*/React.createElement(TestBoard, board) : q.input === "pow" ? /*#__PURE__*/React.createElement(PowBoard, board) : q.input === "mask" ? /*#__PURE__*/React.createElement(MaskBoard, board) : q.input === "sum" ? /*#__PURE__*/React.createElement(SumBoard, board) : q.input === "sub" ? /*#__PURE__*/React.createElement(SubBoard, board) : q.input === "split" ? /*#__PURE__*/React.createElement(SplitBoard, board) : q.input === "pick" ? /*#__PURE__*/React.createElement(PickBoard, board) : /*#__PURE__*/React.createElement(StackBoard, board), judged === false && /*#__PURE__*/React.createElement("div", {
    className: "why",
    ref: why
  }, /*#__PURE__*/React.createElement("div", {
    className: "why-h"
  }, "\u3053\u3046\u89E3\u304F"), q.steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "step"
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-n"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "step-t"
  }, s.t), /*#__PURE__*/React.createElement("span", {
    className: "step-v"
  }, s.v)))), judged !== null && /*#__PURE__*/React.createElement("div", {
    className: "judge" + (judged ? " ok" : " ng") + (judged ? "" : " shake")
  }, /*#__PURE__*/React.createElement("div", {
    className: "j-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "j-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "j-mark"
  }, judged ? "✓" : "✕"), /*#__PURE__*/React.createElement("span", {
    className: "j-word"
  }, judged ? "正解" : "不正解")), !judged && /*#__PURE__*/React.createElement("div", {
    className: "j-ans"
  }, "\u7B54\u3048\u306F ", /*#__PURE__*/React.createElement("b", null, String(q.answer))), judged && q.tip && /*#__PURE__*/React.createElement("div", {
    className: "j-tip"
  }, "\uD83D\uDCA1 ", q.tip), judged ? /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => next(results)
  }, "\u6B21\u3078") : /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: retry
  }, "\u3082\u3046\u4E00\u5EA6"))));
}

/* ── 暗記ドリル（練習）───────────────────────────────────
   **導出ではなく想起。**盤も電卓も出さない。合図を1つ大きく出して、
   同じ集合・同じ並びから選ばせる。場所の記憶が思い出す助けになる。
   1周目は表を見てよい。2周目からは表を畳む。
   間違えたカードは山に戻る。**全部を表なしで即答できたら終わり。** */
function Drill({
  station,
  onDone,
  onHome
}) {
  const cards = CARDS[station];
  const [pile] = useState(() => shuffleCards(cards));
  const [i, setI] = useState(0);
  const [judged, setJudged] = useState(null);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  const card = pile[i];
  // 外れは**その表の中の近いもの**から3つ。でたらめだと消去法で当たってしまう
  const opts = useMemo(() => {
    if (!card) return [];
    const k = cards.findIndex(c => c.q === card.q);
    const near = [];
    // 台数のステージだけ、「−2 を忘れた数」を必ず1つ混ぜる（本番の外れと同じ作り）
    const m = card.a.match(/^(\d+) 台$/);
    if (m) near.push(`${Number(m[1]) + 2} 台`);
    for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
      const c = cards[k + d];
      if (c && c.a !== card.a && !near.includes(c.a)) near.push(c.a);
      if (near.length >= 3) break;
    }
    return shuffleCards([card.a].concat(near.slice(0, 3)));
  }, [card && card.q]);
  const pick = a => {
    if (judged !== null || !card) return;
    setJudged({
      good: a === card.a,
      picked: a
    });
    buzz(a === card.a ? 30 : 60);
  };
  // 自動では進まない。**必ず答え合わせを挟む**（読む間を機械が奪わない）
  const go = () => {
    if (!judged) return;
    if (judged.good) {
      setJudged(null);
      if (i + 1 >= pile.length) onDone();else setI(i + 1);
    } else setJudged(null); // 正解するまで、同じ問題から進まない
  };
  if (!card) return null;
  const done = i; // 正解したぶんだけ進む
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap drill"
  }, /*#__PURE__*/React.createElement("div", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onHome
  }, "\u2715"), /*#__PURE__*/React.createElement("div", {
    className: "pbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pbar-in",
    style: {
      width: done / cards.length * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "pnum"
  }, done, "/", cards.length)), /*#__PURE__*/React.createElement("div", {
    className: "dcard"
  }, card.q), /*#__PURE__*/React.createElement("div", {
    className: "dopts" + (judged && !judged.good ? " shake" : "")
  }, opts.map(a => /*#__PURE__*/React.createElement("button", {
    key: a,
    className: "dopt" + (judged && a === card.a ? " right" : "") + (judged && judged.picked === a && a !== card.a ? " ng" : ""),
    onClick: () => pick(a)
  }, /*#__PURE__*/React.createElement("span", null, a), judged && judged.picked === a && a !== card.a && /*#__PURE__*/React.createElement("i", null, "\u3042\u306A\u305F\u306E\u7B54\u3048")))), judged && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dhead " + (judged.good ? "ok" : "ng")
  }, judged.good ? "✓ 正解" : "✕ 不正解"), /*#__PURE__*/React.createElement("div", {
    className: "dwhy"
  }, card.w), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: go
  }, judged.good ? "次へ" : "もう一度")));
}

/* ── 説明の1枚 ────────────────────────
   ここだけは問題を出さない。**すべての土台なので、まず覚える時間**にする。
   見終わったら、その場から「テストをする」へ行ける。 */
/** チュートリアル1つぶん。**文章で読ませず、手を動かす。**教材の手順を盤で1段ずつたどる。 */
function Tutorial({
  station,
  goal,
  lead
}) {
  const [q, setQ] = useState(() => makeQuestion(station, 0.6, false, goal));
  const [val, setVal] = useState(null);
  const [judged, setJudged] = useState(null);
  const again = () => {
    setQ(makeQuestion(station, 0.6, false, goal));
    setVal(null);
    setJudged(null);
  };
  const answer = out => {
    if (judged === null) {
      const ok = String(out) === String(q.answer);
      setJudged(ok);
      buzz(ok ? 30 : 60);
    }
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
    className: "tut-h"
  }, lead), /*#__PURE__*/React.createElement("div", {
    className: "prompt"
  }, q.prompt), /*#__PURE__*/React.createElement("div", {
    className: "given"
  }, q.given.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "grow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gk"
  }, g.k), /*#__PURE__*/React.createElement("span", {
    className: "gv"
  }, g.v)))), q.input === "pow" ? /*#__PURE__*/React.createElement(PowBoard, board) : q.input === "mask" ? /*#__PURE__*/React.createElement(MaskBoard, board) : q.input === "sum" ? /*#__PURE__*/React.createElement(SumBoard, board) : q.input === "sub" ? /*#__PURE__*/React.createElement(SubBoard, board) : q.input === "split" ? /*#__PURE__*/React.createElement(SplitBoard, board) : q.input === "pick" ? /*#__PURE__*/React.createElement(PickBoard, board) : q.input === "wild" ? /*#__PURE__*/React.createElement(WildBoard, board) : /*#__PURE__*/React.createElement(StackBoard, board), judged !== null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dhead " + (judged ? "ok" : "ng")
  }, judged ? "✓ 正解" : "✕ 不正解"), !judged && /*#__PURE__*/React.createElement("div", {
    className: "dwhy"
  }, "\u7B54\u3048\u306F ", String(q.answer)), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: again
  }, judged ? "べつの数でもう一度" : "もう一度")));
}
function Memo({
  station,
  onDrill,
  onTest,
  onHome
}) {
  const st = byId(station);
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap sheet-p"
  }, /*#__PURE__*/React.createElement("div", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onHome
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "mtitle"
  }, st.no, "\u3000", st.name), LINK[station] && /*#__PURE__*/React.createElement("div", {
    className: "link1"
  }, LINK[station]), /*#__PURE__*/React.createElement("div", {
    className: "how"
  }, HOW[station]), station === "S8" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Tutorial, {
    station: station,
    goal: "toMask",
    lead: "\u2460 \u30D7\u30EC\u30D5\u30A3\u30C3\u30AF\u30B9\u9577 \u2192 \u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF"
  }), /*#__PURE__*/React.createElement(Tutorial, {
    station: station,
    goal: "toLen",
    lead: "\u2461 \u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF \u2192 \u30D7\u30EC\u30D5\u30A3\u30C3\u30AF\u30B9\u9577"
  })) : /*#__PURE__*/React.createElement(Tutorial, {
    station: station
  }), CARDS[station] && /*#__PURE__*/React.createElement("div", {
    className: "dtable"
  }, CARDS[station].map((c, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    className: "dtr"
  }, /*#__PURE__*/React.createElement("span", null, c.q), /*#__PURE__*/React.createElement("b", null, c.a)))), EXLINE[station] && /*#__PURE__*/React.createElement("div", {
    className: "exline"
  }, EXLINE[station]), !CARDS[station] && EXAMPLES[station] && /*#__PURE__*/React.createElement("div", {
    className: "dtable"
  }, EXAMPLES[station].rows.map((r, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    className: "dtr"
  }, /*#__PURE__*/React.createElement("span", null, r[0]), /*#__PURE__*/React.createElement("b", null, r[1])))), /*#__PURE__*/React.createElement("div", {
    className: "gotest two"
  }, /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: onDrill
  }, "\u7DF4\u7FD2\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "next ghost",
    onClick: onTest
  }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B")));
}

/** 桁の重み表。教材の「2進数の桁の重みの表」そのまま。押せない（見るだけ）。 */
function WeightTable() {
  return /*#__PURE__*/React.createElement("div", {
    className: "split wtable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, [7, 6, 5, 4, 3, 2, 1, 0].map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed"
  }, n, "\u4E57"))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, [7, 6, 5, 4, 3, 2, 1, 0].map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "sp-c fixed big2"
  }, Math.pow(2, n)))));
}

/* ── 盤 ワイルドカードマスク ────────────────────────────
   255 から引くだけ。4つの数を、左から順に自分で出す。 */
function WildBoard({
  q,
  value,
  onChange,
  locked,
  onSubmit
}) {
  const m = maskStr(q.board.len).split(".").map(Number);
  const got = value || [null, null, null, null];
  const set = (i, v) => {
    if (locked) return;
    const n = got.slice();
    n[i] = v;
    onChange(n);
  };
  const done = got.every(v => v != null);
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, "\u2460 ", /*#__PURE__*/React.createElement("b", null, "255 \u304B\u3089\u5F15\u304F"), "\u3002\u5DE6\u304B\u3089\u9806\u306B"), m.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "255 \u2212 ", v), /*#__PURE__*/React.createElement("div", {
    className: "sp-row w9"
  }, [0, 1, 3, 7, 15, 31, 63, 127, 255].map(x => /*#__PURE__*/React.createElement("button", {
    key: x,
    className: "sp-c" + (got[i] === x ? " on" : ""),
    onClick: () => set(i, x)
  }, x))))), /*#__PURE__*/React.createElement("div", {
    className: "derive"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-r ans"
  }, /*#__PURE__*/React.createElement("span", null, "\u30EF\u30A4\u30EB\u30C9\u30AB\u30FC\u30C9\u30DE\u30B9\u30AF"), /*#__PURE__*/React.createElement("b", null, done ? got.join(".") : "—"))), /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: () => onSubmit(got.join(".")),
    disabled: locked || !done
  }, "\u3053\u308C\u3067\u6C7A\u5B9A"));
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
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, "\u30DD\u30A4\u30F3\u30C8\u3000\u3068\u306A\u308A\u3078\u884C\u304F\u305F\u3073\u306B ", /*#__PURE__*/React.createElement("b", null, "2\u500D")), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "2\u306E"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, rows.map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    className: "sp-c" + (sel === n ? " on" : ""),
    onClick: () => !locked && onChange(n)
  }, n, "\u4E57"))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, rows.map(n => /*#__PURE__*/React.createElement("button", {
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
    className: "point"
  }, "\u30DD\u30A4\u30F3\u30C8\u3000", /*#__PURE__*/React.createElement("b", null, "\u4E0B\u7DDA\u306E\u6841\u3092\u62BC\u3059"), "\u3002\u62BC\u3057\u305F\u6570\u3092\u5408\u8A08\u3059\u308B\u306810\u9032\u6570\u306B\u76F4\u305B\u308B"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u62BC\u3059"), /*#__PURE__*/React.createElement("div", {
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
  }, on.length ? on.join(" + ") : "まだ押していません")), /*#__PURE__*/React.createElement("div", {
    className: "bridge"
  }, /*#__PURE__*/React.createElement("span", {
    className: "b-t"
  }, "\u62BC\u3057\u305F\u3068\u3053\u308D\u306E\u6570\u3092\u3001\u305C\u3093\u3076\u8DB3\u3059\u3068"), /*#__PURE__*/React.createElement("span", {
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
    className: "point"
  }, "\u30DD\u30A4\u30F3\u30C8\u3000", /*#__PURE__*/React.createElement("b", null, "\u5DE6\u304B\u3089\u9806\u306B"), "\u3002\u6B8B\u308A\u304B\u3089\u5F15\u3051\u308B\u306A\u3089\u62BC\u3059\u3002\u5F15\u3051\u306A\u3051\u308C\u3070\u6B21\u3078"), /*#__PURE__*/React.createElement("div", {
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
  }, on.length ? on.map(w => `−${w}`).join(" ") : "まだ押していません")), /*#__PURE__*/React.createElement("div", {
    className: "bridge"
  }, /*#__PURE__*/React.createElement("span", {
    className: "b-t"
  }, "\u5F15\u3044\u305F\u3068\u3053\u308D\u306B ", /*#__PURE__*/React.createElement("b", null, "1"), "\u3001\u5F15\u304B\u306A\u304B\u3063\u305F\u3068\u3053\u308D\u306B ", /*#__PURE__*/React.createElement("b", null, "0"), " \u3092\u7F6E\u304F\u3068"), /*#__PURE__*/React.createElement("span", {
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

/* ── 盤 マスク（/ の数 ↔ マスク） ─────────────────────────
   /28 は「1 が28個ならぶ」という意味。だから
     ① 8個ずつ 255 にしていく（左から）
     ② あまりを、上の桁から 1 にする
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
  const rest = q.goal === "toMask" ? q.board.len - full * 8 : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, "\u2460 ", /*#__PURE__*/React.createElement("b", null, "8 \u305A\u3064"), " \u533A\u5207\u308B"), /*#__PURE__*/React.createElement("div", {
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
  }, i < full ? 255 : i === full ? d.mask.split(".")[i] : 0)))), /*#__PURE__*/React.createElement("div", {
    className: "dots ticks"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }), [8, 16, 24, 32].map((t, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: t
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, " "), /*#__PURE__*/React.createElement("span", {
    className: "tick"
  }, t)))), full < 4 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, "\u2461 \u306E\u3053\u308A", rest != null && rest > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, " ", /*#__PURE__*/React.createElement("b", null, rest, " \u500B")) : null, "\u306E ", /*#__PURE__*/React.createElement("b", null, "1"), " \u3092\u3001\u5DE6\u304B\u3089\u9806\u306B\u7F6E\u304F"), /*#__PURE__*/React.createElement("div", {
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
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row w"
  }, W8.map(w => /*#__PURE__*/React.createElement("span", {
    key: w,
    className: "sp-w"
  }, w))))), /*#__PURE__*/React.createElement("div", {
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
     ③ いちばん右の 1 のうしろに線が出る
     ④ 線から右を **ぜんぶ 0** にすると、いちばん小さい数
        線から右を **ぜんぶ 1** にすると、いちばん大きい数
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
    bits: 0,
    zero: false,
    one: false
  };
  const oct = st.oct,
    bits = st.bits || 0;
  const set = x => !locked && onChange({
    ...st,
    ...x
  });
  const givenMask = q.given.some(g => g.k === "サブネットマスク");

  // 線は「いちばん右の 1 のうしろ」。自分で作った 1 と 0 から決まる
  const bs = W8.map(w => bits & w ? 1 : 0);
  const cut = bs.lastIndexOf(1) + 1;
  const ipBits = oct == null ? [] : bin8(parts[oct]).split("").map(Number);

  // 計算は gen.js の splitOut に任せる（画面と検算で同じ関数を使う）
  const d = oct != null && cut > 0 ? splitOut(ip, oct, cut, q.goal) : null;
  const out = myNet && myBc ? pairOut(myNet, myBc, q.goal) : "";
  // 押した 1 と 0 から、そのまま住所にする。計算は gen.js の addrWith
  const keep = oct == null ? 0 : ipBits.slice(0, cut).reduce((a2, c, i) => a2 + (c ? W8[i] : 0), 0);
  const myNet = oct == null ? null : addrWith(ip, oct, keep + (st.zb || 0));
  const myBc = oct == null ? null : addrWith(ip, oct, keep + (st.ob || 0));
  const ready = d && st.zero && st.one;
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, "\u2460 \u30B5\u30D6\u30CD\u30C3\u30C8\u30DE\u30B9\u30AF\u3092\u5DE6\u304B\u3089\u898B\u3066\u3001", /*#__PURE__*/React.createElement("b", null, "255 \u3067\u306A\u3044\u6570"), "\u3092\u62BC\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, "\u30B5\u30D6\u30CD\u30C3\u30C8", /*#__PURE__*/React.createElement("br", null), "\u30DE\u30B9\u30AF"), mask.map((m, i) => /*#__PURE__*/React.createElement(React.Fragment, {
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
  }, "/", len, " \u2192 ", maskStr(len), "\uFF08", byId("S8").no, "\u3064\u76EE\u306E\u30B9\u30C6\u30FC\u30B8\u3067\u3084\u3063\u305F\u3068\u3053\u308D\uFF09"), oct != null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, /*#__PURE__*/React.createElement("span", {
    className: "d-lab"
  }, "IP\u30A2\u30C9\u30EC\u30B9"), parts.map((v, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."), /*#__PURE__*/React.createElement("span", {
    className: "num" + (oct === i ? " on" : "")
  }, v)))), /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, "\u2461 ", /*#__PURE__*/React.createElement("b", null, mask[oct]), " \u3092 1 \u3068 0 \u306B\u3059\u308B"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u30B5\u30D6\u30CD\u30C3\u30C8", /*#__PURE__*/React.createElement("i", null, W8.reduce((a, w) => a + (bits & w ? w : 0), 0))), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, W8.map((w, i) => /*#__PURE__*/React.createElement("button", {
    key: w,
    className: "sp-c" + (bits & w ? " on" : "") + (cut === i + 1 ? " edge" : ""),
    onClick: () => set({
      bits: bits & w ? bits - w : bits + w,
      zero: false,
      one: false
    })
  }, bits & w ? 1 : 0))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "IP", /*#__PURE__*/React.createElement("i", null, parts[oct])), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, ipBits.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "sp-c fixed" + (cut === i + 1 ? " edge" : "")
  }, c))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-row w"
  }, W8.map(w => /*#__PURE__*/React.createElement("span", {
    key: w,
    className: "sp-w"
  }, w)))), cut > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, "\u2462 IP\u30A2\u30C9\u30EC\u30B9\u306E ", /*#__PURE__*/React.createElement("b", null, "\u7DDA\u304B\u3089\u53F3"), "\u3092\u3001\u305C\u3093\u3076 0 \u3068 \u305C\u3093\u3076 1 \u306B\u3059\u308B"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u305C\u3093\u3076 0"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, ipBits.map((c, i) => i < cut ? /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "sp-c fixed" + (cut === i + 1 ? " edge" : "")
  }, c) : /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "sp-c" + ((st.zb || 0) & W8[i] ? " on" : ""),
    onClick: () => set({
      zb: (st.zb || 0) ^ W8[i],
      zero: true
    })
  }, (st.zb || 0) & W8[i] ? 1 : 0))), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, "\u305C\u3093\u3076 1"), /*#__PURE__*/React.createElement("div", {
    className: "sp-row"
  }, ipBits.map((c, i) => i < cut ? /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "sp-c fixed" + (cut === i + 1 ? " edge" : "")
  }, c) : /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "sp-c" + ((st.ob || 0) & W8[i] ? " on" : ""),
    onClick: () => set({
      ob: (st.ob || 0) ^ W8[i],
      one: true
    })
  }, (st.ob || 0) & W8[i] ? 1 : 0))))), (st.zero || st.one) && /*#__PURE__*/React.createElement("div", {
    className: "derive"
  }, st.zero && /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "\u305C\u3093\u3076 0 \u306B\u3059\u308B\u3068"), /*#__PURE__*/React.createElement("b", null, myNet)), st.one && /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "\u305C\u3093\u3076 1 \u306B\u3059\u308B\u3068"), /*#__PURE__*/React.createElement("b", null, myBc)), ready && q.goal === "range" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, myNet, " \u306F\u4F7F\u3048\u306A\u3044\u3000\uFF0B1"), /*#__PURE__*/React.createElement("b", null, out.split(" 〜 ")[0])), /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, myBc, " \u306F\u4F7F\u3048\u306A\u3044\u3000\u22121"), /*#__PURE__*/React.createElement("b", null, out.split(" 〜 ")[1])), /*#__PURE__*/React.createElement("div", {
    className: "d-r ans"
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
  const out = myNet && myBc ? pairOut(myNet, myBc, q.goal) : "";
  const cell = x => /*#__PURE__*/React.createElement("button", {
    key: x,
    className: "cell wide" + (w === x ? " on" : ""),
    onClick: () => !locked && onChange(x)
  }, /*#__PURE__*/React.createElement("span", {
    className: "c-w2" + (String(x).length >= 5 ? " sm" : "")
  }, x));
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, q.goal === "host" && /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u30A2\u30C9\u30EC\u30B9\u3068\u30D6\u30ED\u30FC\u30C9\u30AD\u30E3\u30B9\u30C8\u30A2\u30C9\u30EC\u30B9\u306E\u3076\u3093\u3067 \uFF0B2\u3000", /*#__PURE__*/React.createElement("b", null, q.need, " + 2 = ", q.want)), /*#__PURE__*/React.createElement("div", {
    className: "lead"
  }, /*#__PURE__*/React.createElement("b", null, q.want), " \u304C\u5165\u308B\u3001\u3044\u3061\u3070\u3093\u5C0F\u3055\u3044\u3068\u3053\u308D\u3092\u62BC\u3059"), /*#__PURE__*/React.createElement("div", {
    className: "point"
  }, q.goal === "host" ? "下の段は、いつもの 128〜1 の表（アドレスの4つ目）。上の段は、そのひとつ左" : "数が大きいほど、たくさん分けられる"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, q.goal === "host" ? "3つ目" : "上の段"), /*#__PURE__*/React.createElement("div", {
    className: "row8 tight"
  }, W16.map(cell)), /*#__PURE__*/React.createElement("div", {
    className: "sp-lab"
  }, q.goal === "host" ? "4つ目" : "下の段"), /*#__PURE__*/React.createElement("div", {
    className: "row8 tight"
  }, W8.map(cell))), w != null && /*#__PURE__*/React.createElement("div", {
    className: "derive"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "\u62BC\u3057\u305F\u3068\u3053\u308D"), /*#__PURE__*/React.createElement("b", null, w)), /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, q.goal === "host" ? "ホスト部" : "サブネットに使う"), /*#__PURE__*/React.createElement("b", null, bits, " \u6841")), q.goal === "subnet" && /*#__PURE__*/React.createElement("div", {
    className: "d-r"
  }, /*#__PURE__*/React.createElement("span", null, "/", q.base, " \u304B\u3089 ", bits, " \u6841 \u306E\u3070\u3059"), /*#__PURE__*/React.createElement("b", null, "/", q.base, " + ", bits)), /*#__PURE__*/React.createElement("div", {
    className: "d-r ans"
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
    className: "lead"
  }, "\u2460 4\u3064\u3092\u898B\u304F\u3089\u3079\u3066\u3001", /*#__PURE__*/React.createElement("b", null, "\u9055\u3063\u3066\u3044\u308B\u3068\u3053\u308D"), "\u3092\u62BC\u3059"), parts.map((ps, r) => /*#__PURE__*/React.createElement("div", {
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
    className: "lead"
  }, "\u2461 \u7E26\u306B\u898B\u3066\u3001", /*#__PURE__*/React.createElement("b", null, "4\u3064\u3068\u3082\u540C\u3058"), "\u3068\u3053\u308D\u307E\u3067\u62BC\u3059"), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement("span", null, "\u540C\u3058\u306A\u306E\u306F"), /*#__PURE__*/React.createElement("b", null, "\u4E0A\u304B\u3089 ", oc * 8 + cut, " \u6841\u3076\u3093")), /*#__PURE__*/React.createElement("div", {
    className: "d-r ans"
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
   だから2回目は**桁の重みの表を出さない。**問いと、自分で計算する場所だけ。

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
    }, /*#__PURE__*/React.createElement(Calc, {
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
      className: "lead"
    }, "\u6253\u3061\u3053\u3080\u3068\u3053\u308D\u3092\u62BC\u3057\u3066\u304B\u3089\u3001\u6570\u5B57\u3092\u5165\u308C\u308B"), /*#__PURE__*/React.createElement("div", {
      className: "dots"
    }, parts.map((x, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, i > 0 && /*#__PURE__*/React.createElement("span", {
      className: "dot"
    }, "."), /*#__PURE__*/React.createElement("button", {
      className: "oct" + (slot === i ? " on" : ""),
      onClick: () => !locked && set({
        slot: i,
        calc: null
      })
    }, x == null ? "—" : x))))), /*#__PURE__*/React.createElement(Calc, {
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
      className: "row8"
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
    className: "choices"
  }, (q.choices || [String(q.answer)]).map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: "ch" + (st.pick === c ? " on" : "")
    // 答え合わせのあとだけ、正解を緑・押した外れを赤にする
    + (locked && c === String(q.answer) ? " right" : "") + (locked && st.pick === c && c !== String(q.answer) ? " wrong" : ""),
    onClick: () => !locked && set({
      pick: c
    })
  }, c))), /*#__PURE__*/React.createElement("button", {
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
  const need = needOf(plan.test);
  const cleared = correct >= need;
  const st = byId(plan.station);
  const msg = !cleared ? `あと ${need - correct} 問。` : plan.test ? newly ? "バッジをもらいました。" : "バッジはもう持っています。この速さを保ちましょう。" : newly ? "覚えました。つぎはテストです。" : "覚えたまま保てています。";
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
  }, NEXT[plan.station]), !plan.test ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: onTest
  }, "\u30C6\u30B9\u30C8\u3092\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: onAgain
  }, "\u3082\u3046\u4E00\u5EA6 \u7DF4\u7FD2\u3059\u308B"), /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: onHome
  }, "\u30DB\u30FC\u30E0\u3078")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "next",
    onClick: cleared ? onHome : onAgain
  }, cleared ? "つづける" : "もう一度"), /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: cleared ? onAgain : onHome
  }, cleared ? "同じステージをもう一度" : "ホームへ")));
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
    if (test === "drill") {
      setSheetOf(station);
      setScreen("drill");
      return;
    }
    // 覚える表が無いステージは、説明を見た時点で練習ぶんを済みにする（中間の段を作らない）
    if (test && !CARDS[station] && !isLit(progress, station)) {
      const cur = progress[station] || {
        seen: 0,
        correct: 0,
        lit: false,
        solo: false
      };
      const nx = {
        ...progress,
        [station]: {
          ...cur,
          lit: true
        }
      };
      setProgress(nx);
      save(nx);
    }
    const first = !progress[station]; // そのステージが初めてか
    const queue = [];
    const n = sizeOf(test);
    // 同じ材料が1回の中で繰り返し出ないようにする（/24 ばかり出ると練習にならない）
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      // 練習は**よく出るやつだけ**を繰り返す（反射で出るようにするため）。
      // テストは本番どおりの出方（前半はやさしく、後半は実際の割合で）
      let q2 = makeQuestion(station, test ? i / (n - 1) : 0, test);
      for (let k = 0; k < 40 && seen.has(keyOf(q2)); k++) q2 = makeQuestion(station, test ? i / (n - 1) : 0, test);
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
      const need = needOf(plan.test);
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
    onStart: start
  }), screen === "memo" && sheetOf && /*#__PURE__*/React.createElement(Memo, {
    key: sheetOf,
    station: sheetOf,
    onDrill: () => start(sheetOf, false),
    onTest: () => start(sheetOf, true),
    onHome: () => setScreen("home")
  }), screen === "drill" && sheetOf && /*#__PURE__*/React.createElement(Drill, {
    key: sheetOf,
    station: sheetOf,
    onHome: () => setScreen("home"),
    onDone: () => {
      // 表なしで全部言えたら、覚えたことにする
      const cur = progress[sheetOf] || {
        seen: 0,
        correct: 0,
        lit: false,
        solo: false
      };
      const next = {
        ...progress,
        [sheetOf]: {
          ...cur,
          lit: true
        }
      };
      setProgress(next);
      save(next);
      setSheetOf(sheetOf);
      setScreen("memo");
    }
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
*{box-sizing:border-box}
body{margin:0;background:#0d1117;color:#e6edf3;
  font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;
  -webkit-tap-highlight-color:transparent}
button{font-family:inherit;border:0;background:none;color:inherit;cursor:pointer}
.wrap{max-width:460px;margin:0 auto;padding:16px 8px calc(32px + env(safe-area-inset-bottom))}

/* ホーム */
.hero{padding:16px 4px 20px}
.hero-t{font-size:34px;font-weight:800}
.bar{height:8px;background:#21262d;border-radius:99px;margin-top:16px;overflow:hidden}
.bar-in{height:100%;background:linear-gradient(90deg,#2ea043,#56d364);border-radius:99px;transition:width .5s}
.hero-n{font-size:13px;color:#8b949e;margin-top:8px}



.road{margin-bottom:8px}
.link{width:2px;height:16px;background:#30363d;margin:0 auto}
.tile{display:block;width:100%;text-align:left;
  background:#161b22;border:1px solid #262c36;border-radius:12px;padding:12px 14px;transition:.15s}
.tile.lit{border-color:#2ea04355;background:#121a14}
.tile.solo{border-color:#e3b34188;background:#1a170f}
.tile.locked{opacity:.5}
.lamp{font-size:17px;color:#484f58;flex:0 0 auto;width:22px;text-align:center}
.tile.lit .lamp{color:#56d364}
.tile.solo .lamp{color:#e3b341}
.t-b{flex:1;min-width:0}
.t-name{display:block;font-size:15px;font-weight:700}
.t-ex{display:block;font-size:11px;color:#79c0ff;margin-top:4px;
  font-family:ui-monospace,Menlo,monospace;word-break:break-all}
.blocked{font-size:11.5px;color:#e3b341;text-align:center;padding:8px 0}
.foot{font-size:13px;color:#8b949e;line-height:2;margin-top:22px;text-align:center}

/* 練習 */
.play{padding-top:10px}
.topbar{display:flex;align-items:center;gap:10px;margin-bottom:18px}
.x{font-size:22px;color:#8b949e;width:44px;height:44px;flex:0 0 auto;margin-left:-10px}
.pbar{flex:1;height:8px;background:#21262d;border-radius:99px;overflow:hidden}
.pbar-in{height:100%;background:#58a6ff;border-radius:99px;transition:width .35s}
.pnum{font-size:13px;color:#8b949e;font-variant-numeric:tabular-nums}

.given{background:#161b22;border:1.5px solid #30363d;border-radius:12px;padding:4px 14px;margin-bottom:14px}
.grow{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  padding:11px 0;border-bottom:1px solid #21262d}
.grow:last-child{border-bottom:0}
.gk:empty{display:none}
.gk{font-size:13px;color:#8b949e;flex:0 0 auto}
.gv.big{font-size:34px;width:100%;text-align:center;padding:10px 0}
.gv{font-size:22px;font-weight:700;font-family:ui-monospace,Menlo,monospace;
  text-align:right;word-break:break-all}
.prompt{font-size:17px;font-weight:600;line-height:1.6;margin:0 2px 18px}

/* 盤 */
.box{margin-top:2px}
.lead{font-size:13px;color:#8b949e;line-height:1.7;margin:14px 0 8px}
.lead:first-child{margin-top:0}
.lead b{color:#e6edf3;font-size:17px;font-family:ui-monospace,Menlo,monospace}
.row8{display:grid;grid-template-columns:repeat(8,1fr);gap:5px}
.cell{aspect-ratio:1/1.3;border:1.5px solid #30363d;border-radius:9px;background:#161b22;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:44px}
.cell.wide{aspect-ratio:auto;height:46px}
.cell.on{border-color:#58a6ff;background:#132030}
.c-v{font-size:17px;font-weight:800;font-family:ui-monospace,Menlo,monospace;color:#484f58}
.cell.on .c-v{color:#79c0ff}
.c-w{font-size:11px;color:#8b949e}
.cell.on .c-w{color:#79c0ff}
.c-w2{font-size:13px;color:#8b949e;font-family:ui-monospace,Menlo,monospace}
.c-w2.sm{font-size:11px}   /* 32768 などの5桁。幅375pxでもはみ出さないように */
.cell.on .c-w2{color:#79c0ff;font-weight:800}

.out{text-align:center;margin:16px 0 0}
.o-x{display:block;font-size:17px;color:#79c0ff;font-family:ui-monospace,Menlo,monospace;
  min-height:20px;word-break:break-all}
.o-n{display:block;font-size:13px;color:#8b949e;margin-top:8px}
.o-n b{font-size:34px;color:#e6edf3;font-family:ui-monospace,Menlo,monospace;margin-left:6px}

.rest{text-align:center;font-size:15px;color:#8b949e;margin-bottom:14px}
.rest b{font-size:34px;color:#e6edf3;font-family:ui-monospace,Menlo,monospace;margin-left:8px}
.rest.zero b{color:#56d364}
.rest.over b{color:#f85149}
.rest-n{font-size:13px;color:#f85149}

/* 線を引く盤 */
/* 点で区切られた数を、そのまま押す */
.dots{display:flex;align-items:center;gap:2px;margin-bottom:6px}
.ticks{margin-top:-2px;margin-bottom:8px}
.tick{flex:1;text-align:center;font-size:11px;color:#8b949e}
.d-lab{width:44px;flex:none;font-size:11px;color:#8b949e;text-align:right;padding-right:6px}
.row8.tight{gap:3px}
.wtable{margin-bottom:14px}
/* 式と答えのあいだをつなぐ1行 */
.bridge{display:flex;flex-direction:column;align-items:center;gap:2px;margin:8px 0}
.b-t{font-size:13px;color:#8b949e;text-align:center}
.b-a{font-size:13px;color:#8b949e}
.sp-c.big2{font-size:15px;font-weight:800;color:#e6edf3}
/* 練習の1枚。いちばん下に「テストをする」が貼り付く */
.sheet-p{padding-bottom:110px}
.gotest{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#0d1117;
  border-top:1px solid #21262d;padding:10px 14px calc(10px + env(safe-area-inset-bottom))}
.gotest.two{display:flex;gap:8px}
.gotest .next{max-width:432px;margin:0 auto;flex:1}
.next.ghost{background:#161b22;border:1.5px solid #2ea043;color:#56d364}
.how{font-size:15px;line-height:1.7;margin-bottom:4px}
/* 暗記ドリル。合図は1つ、いちばん大きい字で真ん中に */
.drill{padding-bottom:40px}
.link1{font-size:13px;color:#8b949e;line-height:1.7;padding:10px 12px;margin-bottom:12px;
  border-left:3px solid #30363d;background:#161b22;border-radius:0 8px 8px 0}
.exline{font-size:13px;color:#8b949e;line-height:1.7;margin:12px 0 4px}
.rnext{font-size:13px;color:#8b949e;line-height:1.7;margin:14px 0 4px;text-align:left}
.dtable{margin:16px 0 8px}
.dtr{display:flex;justify-content:space-between;gap:12px;padding:9px 4px;font-size:15px;
  font-family:ui-monospace,Menlo,monospace;color:#8b949e;border-bottom:1px solid #21262d}
.dtr b{color:#e6edf3}
.dwhy{text-align:center;font-size:13px;color:#8b949e;margin:8px 0 16px;
  font-family:ui-monospace,Menlo,monospace}
.dcard{font-size:34px;font-weight:800;text-align:center;padding:22px 8px;margin:16px 0;
  font-family:ui-monospace,Menlo,monospace;background:#161b22;border:1.5px solid #30363d;border-radius:16px;
  word-break:break-all}
.dopts{display:grid;grid-template-columns:1fr;gap:8px}
.dopt{display:flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:10px 6px;
  border:1.5px solid #30363d;border-radius:12px;background:#161b22;
  font-size:17px;font-weight:700;font-family:ui-monospace,Menlo,monospace}
.dopt.right{border-color:#2ea043;background:#0f2a16;color:#56d364}
.dopt.ng{border-color:#f85149;color:#ff7b72}
.dopt i{font-style:normal;font-size:11px;font-weight:400;color:#ff7b72}
.tut{border-top:1px solid #21262d;padding-top:14px;margin-top:14px}
.tut-h{font-size:13px;color:#8b949e;margin-bottom:10px}
.rbadge{text-align:center;font-size:44px;margin:6px 0 2px;animation:pop .25s ease-out}
.dhead{text-align:center;font-size:22px;font-weight:800;margin-top:18px}
.dhead.ok{color:#56d364}
.dhead.ng{color:#ff7b72}
.shake{animation:shake .2s}
.mtitle{font-size:22px;font-weight:800;margin:6px 0 6px}
/* 解き方の要点。操作の前に置く言葉は、これ1行だけにする */
.point{font-size:13px;color:#8b949e;margin-bottom:10px}
.point b{color:#e6edf3}
.u{text-decoration:underline;text-decoration-color:#58a6ff;text-decoration-thickness:3px;
  text-underline-offset:4px;color:#79c0ff}
/* いま見るところ／まだ先のところ。押せるかどうかは変えない */
.cell.now{border-color:#58a6ff}
.cell.later{opacity:.45}
.oct{min-height:56px;min-width:56px;flex:1;border:1.5px solid #30363d;border-radius:10px;background:#161b22;
  padding:6px 2px;font-size:22px;font-weight:700;font-family:ui-monospace,Menlo,monospace;color:#8b949e}
/* 押せないものは、枠を持たない。枠があるのに押せないと、押せると思って触ってしまう */
.num{flex:1;text-align:center;font-size:17px;font-weight:700;
  font-family:ui-monospace,Menlo,monospace;color:#8b949e;padding:8px 2px}
.num.on{color:#79c0ff}
.oct.on{border-color:#58a6ff;background:#132030;color:#79c0ff;font-weight:900}
.dot{font-size:22px;font-weight:800;color:#8b949e;padding:0 1px}
.sub{font-size:13px;color:#8b949e;margin:-4px 0 8px}
/* ステージの札。上が名前、下が「練習する」「テストをする」の2つ */
.t-h{display:flex;align-items:center;gap:12px;width:100%;text-align:left;min-height:48px}
.slot{flex:0 0 auto;width:44px;height:44px;border:1.5px dashed #30363d;border-radius:10px;
  display:flex;align-items:center;justify-content:center;font-size:22px}
.slot.got{border-style:solid;border-color:#e3b341;background:#1a170f}
.tile.pick{border-color:#58a6ff}
.t-go{display:flex;gap:8px;margin-top:10px}
.go{flex:1;min-height:44px;padding:10px 6px;border:1px solid #30363d;border-radius:10px;
  background:#0d1117;font-size:15px;font-weight:700;color:#e6edf3}
.go.off{color:#484f58;border-style:dashed}
.unlock{display:block;margin:14px auto 0;padding:10px 16px;min-height:44px;font-size:13px;
  color:#8b949e;border:1px solid #30363d;border-radius:99px}
.unlock.on{border-color:#58a6ff;color:#79c0ff}
.split{display:grid;grid-template-columns:44px 1fr;gap:6px;align-items:center}
/* 行そのものを押す。押せる物の見た目（枠の太さ）は .sp-c とそろえる */
.sp-c.off{color:#484f58}
.sp-c.sp-c.zero{border-color:#58a6ff;color:#79c0ff}
.sp-c.sp-lab i{display:block;font-style:normal;color:#8b949e;font-size:11px;margin-top:2px}
.sp-lab{font-size:11px;color:#8b949e;text-align:right}
.sp-row{display:grid;grid-template-columns:repeat(8,1fr);gap:3px}
.sp-c{height:44px;border:1px solid #30363d;border-radius:7px;background:#161b22;
  font-size:15px;font-family:ui-monospace,Menlo,monospace;color:#484f58;padding:0}
.sp-c.on{border-color:#58a6ff;background:#132030;color:#79c0ff;font-weight:800}
/* 押せないものは、枠も地の色も持たない。枠があるのに押せないと、押せると思って触ってしまう */
.sp-c.fixed{display:flex;align-items:center;justify-content:center;color:#e6edf3;
  border-color:transparent;background:none}
/* 線は「ここまで同じ／ここまでがネットワーク」の意味。だから選んだ桁の**右**に引く */
.sp-c.edge{box-shadow:3px 0 0 #e3b341}
.sp-row.w{grid-template-columns:repeat(8,1fr)}
.sp-row.w9{grid-template-columns:repeat(9,1fr)}
.sp-row.w9 .sp-c{font-size:11px}
.sp-w{font-size:11px;color:#8b949e;text-align:center}

.derive{background:#161b22;border:1px solid #21262d;border-radius:12px;padding:4px 14px;margin-top:16px}
.d-r{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  padding:9px 0;border-bottom:1px solid #21262d}
.d-r:last-child{border-bottom:0}
.d-r span{font-size:13px;color:#8b949e}
.d-r b{font-size:17px;font-family:ui-monospace,Menlo,monospace;text-align:right;word-break:break-all}
.d-r.ans b{font-size:17px;font-weight:800;color:#79c0ff}

/* 縦に並べる盤 */
.stack{display:flex;flex-direction:column;gap:5px}
.st-row{display:grid;grid-template-columns:44px repeat(8,1fr);gap:3px;align-items:center}
.st-d{font-size:13px;color:#8b949e;text-align:right;font-family:ui-monospace,Menlo,monospace}
.st-c{height:44px;border:1px solid #30363d;border-radius:7px;background:#161b22;
  font-size:15px;font-family:ui-monospace,Menlo,monospace;color:#8b949e;padding:0}
.st-c.same{background:#132030;color:#79c0ff;font-weight:800}
.st-c.edge{box-shadow:3px 0 0 #e3b341}

.next{display:block;width:100%;padding:16px;border-radius:12px;background:#238636;
  color:#fff;font-size:17px;font-weight:700;margin-top:16px}
.next:disabled{background:#21262d;color:#8b949e}
.mini{display:block;width:100%;min-height:44px;font-size:13px;color:#8b949e;margin-top:10px}

/* テスト（表なし） */
.testnote{background:#241c10;border:1px solid #5c4d20;border-radius:12px;
  padding:11px 14px;margin-bottom:16px;font-size:13px;color:#e3b341;text-align:center}
.cell.bare{aspect-ratio:1/1.1}
.choices{display:flex;flex-direction:column;gap:9px}
.ch{width:100%;min-height:56px;padding:14px;border:1.5px solid #30363d;border-radius:12px;
  background:#161b22;font-size:17px;font-family:ui-monospace,Menlo,monospace;
  word-break:break-all;transition:.15s}
.ch.on{border-color:#58a6ff;background:#132030;color:#79c0ff;font-weight:800}
.ch.right{border-color:#2ea043;background:#0f2a16;color:#56d364;font-weight:700}
.ch.wrong{border-color:#f85149;background:#2a1315;color:#ff7b72;font-weight:700}

/* 計算するところ。＋と− だけ */
.calc{margin-top:18px}
.calc-d{background:#0f141b;border:1px solid #21262d;border-radius:12px;
  padding:12px 14px;margin-bottom:8px;text-align:right}
.calc-e{font-size:15px;color:#8b949e;font-family:ui-monospace,Menlo,monospace;
  word-break:break-all;min-height:20px;line-height:1.5}
.calc-t{font-size:34px;font-weight:800;font-family:ui-monospace,Menlo,monospace;margin-top:4px}
.keys{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.k{height:52px;border:1px solid #30363d;border-radius:10px;background:#161b22;
  font-size:22px;font-family:ui-monospace,Menlo,monospace}
.k.op{background:#1c222b;color:#79c0ff}
.k.w2{grid-column:span 2}

/* 解き方 */
.why{margin-top:8px;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:14px}
.why-h{font-size:13px;color:#8b949e;margin-bottom:10px}
.step{display:grid;grid-template-columns:20px 1fr;gap:4px 9px;padding:9px 0;border-top:1px solid #21262d}
.step:first-of-type{border-top:0}
.step-n{grid-row:span 2;width:20px;height:20px;border-radius:50%;background:#21262d;
  font-size:11px;display:flex;align-items:center;justify-content:center;color:#8b949e}
.step-t{font-size:12.5px;color:#8b949e;line-height:1.5}
.step-v{font-size:14.5px;font-weight:600;font-family:ui-monospace,Menlo,monospace;
  word-break:break-all;line-height:1.6}
/* 答え合わせの帯（画面のいちばん下に貼り付く） */
.judge{position:fixed;left:0;right:0;bottom:0;z-index:40;border-top:2px solid;
  padding:12px 14px calc(12px + env(safe-area-inset-bottom));animation:up .18s ease-out}
.judge.ok{background:#0f2a16;border-color:#2ea043;cursor:pointer}
.judge.ng{background:#2a1315;border-color:#f85149}
.j-in{max-width:460px;margin:0 auto}
.j-head{display:flex;align-items:center;gap:10px}
.j-mark{font-size:34px;line-height:1;font-weight:800}
.j-word{font-size:17px;font-weight:800}
.judge.ok .j-mark,.judge.ok .j-word{color:#56d364}
.judge.ng .j-mark,.judge.ng .j-word{color:#ff7b72}
.j-ans{font-size:15px;margin-top:6px;color:#e6edf3}
.j-ans b{font-size:17px;font-family:ui-monospace,Menlo,monospace}
.j-tip{font-size:13px;color:#8b949e;margin-top:6px}
.judge .next{margin-top:10px}
/* 帯のぶん、下に余白を空けて盤が隠れないようにする */
.lit-ok,.lit-ng{padding-bottom:180px}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes up{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}

/* 結果 */
.result{text-align:center;padding-top:72px}
.result.flash{animation:flash .4s ease-out}
@keyframes flash{0%{background:#1d2a1a}100%{background:transparent}}
.rtitle{font-size:15px;color:#8b949e;font-weight:600}
.rscore{font-size:44px;font-weight:800;font-family:ui-monospace,Menlo,monospace;
  line-height:1.1;margin-top:10px;color:#484f58}
.rscore.ok{color:#56d364}
.rscore span{font-size:34px;color:#484f58;margin-left:4px}
.rmsg{font-size:15px;line-height:1.9;margin:20px 8px 8px}

/* やり方 */
@keyframes fade{from{opacity:0}to{opacity:1}}

@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.01ms !important;transition-duration:.01ms !important}
}
`;
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
