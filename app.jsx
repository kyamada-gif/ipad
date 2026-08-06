import React, { useState, useEffect, useRef } from "react";

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

const DRILL_QN = 5;     // 練習は5問（手を動かして慣れる場）
const TEST_QN = 10;     // テストは10問（本番と同じ形で測る場）
const FINAL_QN = 15;    // 仕上げだけ15問（8つの型を一通り出してから、もう一巡）
const DRILL_N = 4;      // 練習：5問中4問で ● できた
/** その回の問題数。仕上げのテストだけ多い。 */
const sizeOf = (test, station) => (!test ? DRILL_QN : station === "SF" ? FINAL_QN : TEST_QN);
/** その問題の「材料」。同じものを1回の中で繰り返さないために使う。 */
const keyOf = (q) => q.given.map((g) => g.v).join("|");
/** その回の合格ライン。練習は8割、テストは9割。
 *  **問題数から出す。**前は 9 と直に書いていたので、15問にしたときに 9/15 のままになるところだった
 *  （10問→9問、15問→14問。どちらも「まちがえてよいのは1問」でそろう）。 */
const needOf = (test, station) => (test ? Math.ceil(sizeOf(test, station) * 0.9) : DRILL_N);

const KEY = "ipcalc2-progress";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const save = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} };

// 選んだモードは覚えておく。開くたびに選び直させない
// お試し用。全部のステージを開けて回れるようにする（記録のランプは正直なまま）
const UKEY = "ipcalc2-unlock";
const loadUnlock = () => { try { return localStorage.getItem(UKEY) === "1"; } catch (e) { return false; } };
const saveUnlock = (u) => { try { localStorage.setItem(UKEY, u ? "1" : "0"); } catch (e) {} };

const byId = (id) => STATIONS.find((s) => s.id === id);
const isLit = (p, id) => !!(p[id] && p[id].lit);
const isSolo = (p, id) => !!(p[id] && p[id].solo);
const isOpen = (p, st) => st.need.every((n) => isLit(p, n));
const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const toTop = (y) => { try { window.scrollTo(0, y || 0); } catch (e) {} };
const W8 = [128, 64, 32, 16, 8, 4, 2, 1];

/* =========================================================================
   ホーム ── 7ステージの道
   -------------------------------------------------------------------------
   ステージごとに「練習する」「テストをする」の2つ。**どちらでやるかは、その場で選ぶ。**
   画面ぜんたいの切り替えをやめたのは、いま自分がどちらの世界にいるのかを
   覚えておかないといけなかったから。ボタンが2つ並んでいれば、覚えなくてよい。
   ========================================================================= */
function Home({ progress, unlock, onUnlock, onStart }) {
  const [blocked, setBlocked] = useState(null);
  const [pick, setPick] = useState(null);   // いま開いている札
  const doneT = STATIONS.filter((s) => isSolo(progress, s.id)).length;

  return (
    <div className="wrap">
      <header className="hero">
        <div className="hero-t">IPアドレスの計算</div>
        <div className="bar"><div className="bar-in" style={{ width: (doneT / STATIONS.length) * 100 + "%" }} /></div>
        <div className="hero-n">🏅 {doneT} / {STATIONS.length}</div>
      </header>

      <div className="road">
        {STATIONS.map((s, i) => {
          // 10個の札がただ並んでいると、どこからが本番の話か分からない。
          // 基礎（1〜4）／試験レベル（5〜9）／仕上げ（10）で区切る
          const g = GROUPS.find((x) => x.at === s.id);
          const solo = isSolo(progress, s.id), lit = isLit(progress, s.id);
          const open = unlock || isOpen(progress, s);
          // 仕上げだけは練習が無い。説明の1枚を見たら、そのままテストへ
          const hasDrill = s.drill !== false;
          // テストは、練習でできてから。手順を知らないまま4択をやっても、
          // 4回に1回当たるだけで記録が汚れる。
          // **練習が無いステージは、開いた時点でテストに入れる**
          //（そうしないと lit にならないので、永久に開かない）
          const canTest = unlock || lit || !hasDrill;
          return (
            <div key={s.id}>
              {g && (
                <div className="gsec">
                  <div className="gname">{g.name}
                    <span className="gnum">ステージ {g.from}{g.to > g.from ? ` 〜 ${g.to}` : ""}</span>
                  </div>
                  <div className="gnote">{g.note}</div>
                </div>
              )}
              {/* 札と札をつなぐ縦線。区切りの手前では切る（別のまとまりに入るので） */}
              {i > 0 && !g && <div className="link" />}
              {/* はじめは札だけ。押した札にだけ、2つのボタンが出る。
                  7ステージ分14個のボタンが最初から並んでいると、どこを見ればいいのか分からなくなる */}
              <div className={"tile" + (open ? "" : " locked") + (lit ? " lit" : "") + (solo ? " solo" : "")
                + (pick === s.id ? " pick" : "")}>
                <button className="t-h" onClick={() => { setPick(pick === s.id ? null : s.id); setBlocked(null); }}>
                  <span className="lamp">{open ? (lit ? "●" : "○") : "🔒"}</span>
                  <span className="t-b">
                    <span className="t-name">{s.no}　{s.name}</span>
                    <span className="t-ex">{s.ex}</span>
                  </span>
                  {/* バッジの置き場。テストに合格するまでは空の枠のまま */}
                  <span className={"slot" + (solo ? " got" : "")}>{solo ? "🏅" : ""}</span>
                </button>
                {pick === s.id && open && (
                  /* 仕上げは練習が無いので、入口は1つだけ。
                     押すと説明の1枚（本番で聞かれる8つの形）が出て、その下がテストへの入口になる */
                  <div className="t-go">
                    <button className="go" onClick={() => onStart(s.id, null)}>
                      {hasDrill ? "練習をする" : "はじめる"}
                    </button>
                    {hasDrill && (
                      <button className={"go" + (canTest ? "" : " off")}
                        onClick={() => (canTest ? onStart(s.id, true) : setBlocked(blocked === s.id ? null : s.id))}>
                        テストをする
                      </button>
                    )}
                  </div>
                )}
              </div>
              {pick === s.id && !open && (
                <div className="blocked">{s.need.map((n) => byId(n).name).join(" と ")} ができると開きます</div>
              )}
              {blocked === s.id && open && (
                <div className="blocked">先に練習でできると、テストが開きます</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="foot">○ まだ　　● 練習ができた　　🏅 バッジ（テストで9割）</div>
      {/* お試し。鍵を外しても、できたかどうかの記録はそのまま */}
      <button className={"unlock" + (unlock ? " on" : "")} onClick={() => onUnlock(!unlock)}>
        {unlock ? "鍵をかけ直す" : "全部開く（お試し）"}
      </button>
    </div>
  );
}

/* =========================================================================
   練習
   ========================================================================= */
/* ── 材料の枠 ────────────────────────────────────────────
   **チュートリアルと練習で同じ物を使う。**別々に書いていたころは、
   並び順が逆で、下線もチュートリアルだけ出ていなかった。
   盤の中に同じ数が並ぶステージ（ステージ5・6）では出さない。二重になって目が往復する。 */
function Given({ q, test }) {
  // 盤（SplitBoard）の中に同じIPとマスクが並ぶときだけ、二重になるので出さない。
  // **テストと手順つきは盤を使わない。**そこで消すと、問題そのものが画面から消える
  if (q.input === "split" && !test && !q.steps5) return null;
  return (
    <div className="given">
      {q.given.map((g, i) => (
        <div key={i} className="grow"><span className="gk">{g.k}</span>
          {/* 下線は「ここを見てほしい」の印。
              q.underline … その字だけ（ステージ2の 1）　g.u … 何文字目か（2の◯乗の ◯） */}
          <span className={"gv" + (g.u != null ? " big" : "") + (String(g.v).length > 24 ? " long" : "")}>
            {g.u != null || (q.underline && !test)
              ? String(g.v).split("").map((c, j) => (
                <span key={j} className={g.u != null ? (j === g.u ? "u" : "") : (c === q.underline ? "u" : "")}>{c}</span>))
              : g.v}</span>
        </div>
      ))}
    </div>
  );
}

function Play({ plan, onDone, onQuit }) {
  const [queue, setQueue] = useState(plan.queue);
  const [idx, setIdx] = useState(0);
  const [judged, setJudged] = useState(null);
  const [val, setVal] = useState(null);      // 盤の状態。盤ごとに形が違う
  const [results, setResults] = useState([]);
  // そのステージが初めてなら、最初に教材の見本を出す。読んだ直後に「これだ」とつながるように
  const [howto, setHowto] = useState(!!plan.first);
  const timer = useRef(null);
  const why = useRef(null);

  const item = queue[idx];
  const q = item.q;
  const scored = queue.filter((x) => x.scored).length;
  const doneScored = results.filter((r) => r.scored).length;
  const startedAt = useRef(Date.now());

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { setVal(null); startedAt.current = Date.now(); toTop(); }, [idx]);
  useEffect(() => { if (window.__debug) window.__q = q; }, [q]);
  useEffect(() => {
    if (judged !== null && why.current) {
      why.current.scrollIntoView({ block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [judged]);

  const next = (rs) => {
    clearTimeout(timer.current);
    if (idx + 1 >= queue.length) { onDone(rs); return; }
    // 盤の中身も必ず消す。消し忘れると、前の答えが残ったまま次の問題が始まる
    setIdx(idx + 1); setJudged(null); setVal(null); startedAt.current = Date.now();
  };

  /** 正解するまで次へ進まない。これは全体で1つの決まり。
      点になるのは**最初の答えだけ**（やり直しで全員が合格にならないように） */
  const retry = () => { setJudged(null); setVal(null); };

  const answer = (out) => {
    if (judged !== null) return;
    const ok = String(out) === String(q.answer);
    setJudged(ok); buzz(ok ? 30 : 60);
    // 採点は、その問題の**最初の答え**だけ
    const first = !results.some((r) => r.idx === idx);
    const rs = first
      ? results.concat([{ idx, station: q.station, ok, ms: Date.now() - startedAt.current, scored: item.scored }])
      : results;
    if (first) setResults(rs);
  };

  /** 正解の画面は、押せばすぐ次へ。待ちたい人は待てばよい（自動送りは残す）。
      押した指がそのまま触れて豆知識を飛ばさないよう、少しの間は効かないようにする。 */

  const board = { q, value: val, onChange: setVal, locked: judged !== null, onSubmit: answer };

  return (
    <div className="wrap play">
      <div className="topbar">
        <button className="x" onClick={() => onQuit(results)}>✕</button>
        <div className="pbar"><div className="pbar-in" style={{ width: (doneScored / scored) * 100 + "%" }} /></div>
        <div className="pnum">{Math.min(doneScored + (item.scored ? 1 : 0), scored)}/{scored}</div>
      </div>

      <Given q={q} test={plan.test} />
      <div className="prompt">{q.prompt}</div>


      {/* ── 答え合わせ ──────────────────────────────────
          lpic-reflex と同じ作り。**盤ごと1枚のカードにして、その中で答え合わせをする。**
          枠の色が変わり、外したときはカードごと揺れる。画面の外に出ないよう、
          押した直後にここまで自動で送る。 */}
      {/* 3問目まで盤だったのが、4問目から選ぶ形に変わる。**予告なしだと壊れたように見える** */}
      {q.steps5 && !plan.test && <div className="testnote">ここからは、次にやることを自分で選びます</div>}
      <div className={"card" + (judged === null ? "" : judged ? " ok" : " ng")} ref={why}>
        {q.input === "table" ? <TableBoard {...board} />
          : plan.test || q.steps5 || q.input === "final" ? <TestBoard {...board} />
          : q.input === "pow" ? <PowBoard {...board} />
          : q.input === "mask" ? <MaskBoard {...board} />
          : q.input === "sum" ? <SumBoard {...board} />
          : q.input === "sub" ? <SubBoard {...board} />
          : q.input === "split" ? <SplitBoard {...board} />
          : q.input === "pick" ? <PickBoard {...board} />
          : <StackBoard {...board} />}

        {judged !== null && (
          <div className="verdict">
            <div className={"dhead " + (judged ? "ok" : "ng")}>{judged ? "✓ 正解" : "✕ 不正解"}</div>
            {!judged && <div className="j-ans">答えは <b>{String(q.answer)}</b></div>}
            {judged && q.tip && <div className="j-tip">💡 {q.tip}</div>}
            {/* 丸暗記させるステージでは、手順を出さない。答えだけでよい */}
            {judged === false && !q.memorize && (
              <div className="why">
                <div className="why-h">こう解く</div>
                {q.steps.map((st2, i) => (
                  <div key={i} className="step">
                    <span className="step-n">{i + 1}</span>
                    <span className="step-t">{st2.t}</span>
                    <span className="step-v">{st2.v}</span>
                  </div>
                ))}
              </div>
            )}
            {judged
              ? <button className="next calm" onClick={() => next(results)}>
                  {idx + 1 >= queue.length ? "結果を見る" : "次へ →"}
                </button>
              : <button className="next retry" onClick={retry}>もう一度</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 説明の1枚 ────────────────────────
   ここだけは問題を出さない。**すべての土台なので、まず覚える時間**にする。
   見終わったら、その場から「テストをする」へ行ける。

   **かたまりの見せ方は1つだけ。**前は「灰の箱」「赤い縦線」「黄のベタ塗り」「名札なしの文章」
   「上に細い罫」と5通りあって、同じ「ここは1つのかたまりです」を毎回違う顔で言っていた。
   いまは <Sec> の名札1種類だけ。**目立つ帯は、解き方の赤い縦線1つだけ**に減らしてある。 */

/** 段の名札。全ステージで同じ4語（前のステージから／図で見ると／見本／やってみる）。 */
function Sec({ label, note, children }) {
  return (
    <div className="sec-w">
      <div className="sec">{label}</div>
      {note && <div className="sec-n">{note}</div>}
      {children}
    </div>
  );
}

/** 見本の行に 1. 2. … と番号を振る。**手順が何番目か、目で数えなくてよくする。**
 *  名札が空の行（ステージ9の「169 = …」「170 = …」）は、上の行のつづきなので番号を飛ばす。 */
function numbered(rows) {
  let n = 0;
  return rows.map((r) => ({ n: r[0] ? ++n : null, k: r[0], v: r[1] }));
}

/** 文の中の *…* を太字にする。**大事なひと言だけ**を濃くするための印。 */
function Rich({ t }) {
  return <>{String(t).split("*").map((s, i) => (i % 2 ? <b key={i}>{s}</b> : s))}</>;
}

/** 「図で見ると」の1枚。中身は gen.js の FIGURE。**ここに数字を書かない。**
 *
 *  **表（グリッド）で組む。**前は等幅フォントで中央ぞろえしていただけなので、
 *  名札の幅が行ごとに違うと縦の位置がずれていた（255 が自分のオクテットの真下に来ない）。
 *  いまは列が機械的にそろうので、上下の区切り位置も1本の線になる。
 *
 *  **枠は付けない。**枠があるもの＝押せるもの、という決まりがあるので、
 *  マスの区切りは下地の色だけで見せる（区切り位置の縦線は、枠ではなく1本の線）。 */
function Figure({ data }) {
  if (!data) return null;
  const { cols, cut, rows, head, foot } = data;
  // 1つのマスの中で分かれる行（"1111|0000"）が何列目か。無ければ -1
  const splitAt = rows.reduce((a, r) =>
    a >= 0 ? a : (r.cells || []).findIndex((c) => String(c).includes("|")), -1);
  // **色は数字ではなく、区切りのどちら側かで決まる。**
  // 「全部 1 にする」の行はホスト部が 11111 になるが、そこは灰のまま。
  // 10進数の行（plain）は色を付けない＝地の文字色のまま
  const side = (r, i) => (r.plain ? "" : splitAt >= 0
    ? (i < splitAt ? "n" : "h")
    : (i < cut ? "n" : "h"));
  /* **どのマスも、行と列を自分で言う。**
     一部だけ「2列目から最後まで」と指定して残りを自動に任せると、
     自動の置き場所がそこで飛んで、次の行が1列ずれる（区切りの線がそろわなくなる）。
     一度それで踏んだので、全部を明示する。 */
  const box = [];
  let y = 0;
  // マスの列にまたがる行（見出し・その行の説明・いちばん下の1行）
  const wide = () => ({ gridRow: ++y, gridColumn: `2 / ${cols + 2}` });
  if (head) {
    // 区切りが列と列のあいだにあるステージ（ステージ5）では、
    // **見出しも、その列で分ける。**「どこまでがネットワーク部か」が見出しの幅で分かる
    if (cut != null) {
      y++;
      box.push(<div key="hl" className="fg-h n" style={{ gridRow: y, gridColumn: `2 / ${cut + 2}` }}>{head.l}</div>);
      box.push(<div key="hr" className="fg-h" style={{ gridRow: y, gridColumn: `${cut + 2} / ${cols + 2}` }}>{head.r}</div>);
    } else {
      box.push(<div key="h" className="fg-h wide" style={wide()}>
        <span className="fg-hn">{head.l}</span><span>{head.r}</span></div>);
    }
  }
  rows.forEach((r, i) => {
    y++;
    box.push(<div key={"l" + i} className="fg-lab" style={{ gridRow: y, gridColumn: 1 }}>{r.lab}</div>);
    r.cells.forEach((c, j) => {
      const p = String(c).split("|");
      box.push(
        <div key={i + "-" + j} style={{ gridRow: y, gridColumn: j + 2 }}
          className={"fg-c " + side(r, j)
            + (r.small ? " sm" : "") + (splitAt < 0 && j === cut ? " cut" : "")}>
          {/* 1つのマスの中で分かれるとき（1111|0000）だけ、中に線を1本 */}
          {p.length > 1
            ? <><span className="fg-n">{p[0]}</span><span className="fg-cut" /><span className="fg-o">{p[1]}</span></>
            : c}
        </div>
      );
    });
    if (r.r) box.push(<div key={"r" + i} className="fg-r" style={{ gridRow: y, gridColumn: cols + 2 }}>{r.r}</div>);
    if (r.cap) box.push(<div key={"c" + i} className="fg-cap" style={wide()}>{r.cap}</div>);
  });
  if (foot) box.push(<div key="f" className="fg-foot" style={wide()}>{foot}</div>);
  return (
    <>
      {data.intro && <div className="sec-b"><Rich t={data.intro} /></div>}
      <div className="figg" style={{ gridTemplateColumns: `auto repeat(${cols}, 1fr) auto` }}>{box}</div>
      {(data.caps || []).map((c, i) => <div key={i} className="sec-b"><Rich t={c} /></div>)}
    </>
  );
}

/** チュートリアル1つ分。**文章で読ませず、手を動かす。**教材の手順を盤で1段ずつたどる。
 *  「正解するまでやり直す」の断り書きは、ここではなく「やってみる」の段に1回だけ出す
 *  （前は向きが2つあるステージで2回出ていた）。 */
function Tutorial({ station, goal, lead, onSolved }) {
  const [q] = useState(() => makeQuestion(station, 0.2, false, goal));
  const mark = useRef(null);
  const [val, setVal] = useState(null);
  const [judged, setJudged] = useState(null);
  // 正解するまで、同じ問題をやり直す（全体で1つの決まり）
  const again = () => { setVal(null); setJudged(null); };
  const answer = (out) => {
    if (judged !== null) return;
    const ok = String(out) === String(q.answer);
    setJudged(ok); buzz(ok ? 30 : 60);
    if (ok && onSolved) onSolved();
    // 押した直後に、判定が目に入るようにする（スクロールしないと見えないのを防ぐ）
    setTimeout(() => {
      if (!mark.current) return;
      try {
        mark.current.scrollIntoView({ block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      } catch (e) {}
    }, 0);
  };
  useEffect(() => { if (window.__debug) window.__q = q; }, [q]);
  const board = { q, value: val, onChange: setVal, locked: judged !== null, onSubmit: answer };
  return (
    <div className="tut">
      {lead && <div className="sec-n">{lead}</div>}
      <Given q={q} />
      <div className="prompt">{q.prompt}</div>
      <div className={"card" + (judged === null ? "" : judged ? " ok" : " ng")} ref={mark}>
        {q.input === "final" ? <TestBoard {...board} />
          : q.input === "table" ? <TableBoard {...board} />
          : q.input === "pow" ? <PowBoard {...board} />
          : q.input === "mask" ? <MaskBoard {...board} />
          : q.input === "sum" ? <SumBoard {...board} />
          : q.input === "sub" ? <SubBoard {...board} />
          : q.input === "split" ? <SplitBoard {...board} />
          : q.input === "pick" ? <PickBoard {...board} />
          : <StackBoard {...board} />}
        {judged !== null && (
          <div className="verdict">
            <div className={"dhead " + (judged ? "ok" : "ng")}>{judged ? "✓ 正解" : "✕ 不正解"}</div>
            {!judged && (
              <>
                <div className="j-ans">答えは <b>{String(q.answer)}</b></div>
                <button className="next retry" onClick={again}>もう一度</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Memo({ station, onDrill, onTest, onHome }) {
  const st = byId(station);
  // チュートリアルが解けたら、次にやること（練習をする）を目立たせる
  const [solved, setSolved] = useState(false);
  const [solved2, setSolved2] = useState(false);
  /* 仕上げ（drill: false）だけは、練習そのものを置かない。新しいやり方が無いので、
     「やってみる」も「練習をする」も、テストと同じ問題をやるだけになる。
     この1枚を見たら、下は「テストをする」だけ。 */
  const hasDrill = st.drill !== false;
  const both = !hasDrill || (station === "S8" ? (solved && solved2) : solved);
  return (
    <div className="wrap sheet-p">
      <div className="topbar"><button className="x" onClick={onHome}>✕</button></div>
      {/* 見出しの1かたまり。**いま何をする画面で、10のうちどこか**をここだけで言い切る */}
      <div className="mkind">チュートリアル ・ ステージ {st.no} / {STATIONS.length}</div>
      <div className="mtitle">{st.name}</div>
      <div className="msub2">{hasDrill ? "1問やって、解き方を覚えます" : "本番で聞かれる形を見てから、テストに入ります"}</div>
      {/* 太い罫。ここから下が中身、という区切り */}
      <div className="rule" />

      {/* ── 1 前のステージから ── 覚えた何を、ここでそのまま使うのか。全10ステージに1行 */}
      <Sec label="前のステージから"><div className="sec-b">{LINK[station]}</div></Sec>

      {/* ── 2 解き方 ── **名札を付けない。**赤い縦線と太字の見出しが名札そのもの。
          画面の中で目立つ帯は、ここ1つだけにする */}
      <div className="way">
        <div className="way-h">{WAY[station].h}</div>
        <div className="way-b"><Rich t={WAY[station].b} /></div>
      </div>

      {/* ── 3 図で見ると ── 操作の前に「1 は何なのか」を1枚。中身は gen.js の FIGURE */}
      {FIGURE[station] && <Sec label="図で見ると"><Figure data={FIGURE[station]} /></Sec>}

      {/* ── 4 見本 ── 教材PDFに載っている見本そのまま。数字も教材のまま。
          2の◯乗の表だけは**アプリ全体で同じ横長の形**を使う（練習・テストと別物に見えないように） */}
      <Sec label="見本">
        <div className="ex-t">{EXAMPLES[station].title}</div>
        {station === "S0"
          ? <WeightTable />
          : numbered(EXAMPLES[station].rows).map((r, i) => (
            <div key={i} className="ex-r"><i className="ex-n">{r.n || ""}</i><span>{r.k}</span><b>{r.v}</b></div>
          ))}
        {/* 注記は表の行にしない。手順の1つに見えてしまう */}
        {EXAMPLES[station].note && <div className="ex-note">※ {EXAMPLES[station].note}</div>}
      </Sec>

      {/* ── 5 やってみる ── 読むのではなく、1問を最後まで手で解く。
          断り書きは**この段に1回だけ。**向きが2つあるステージでも2回出さない */}
      {hasDrill && (
        <Sec label="やってみる" note="正解するまで、同じ問題をやり直します。">
          {station === "S8" ? (
            <>
              <Tutorial station={station} goal="toMask" lead="① プレフィックス長 → サブネットマスク"
                onSolved={() => setSolved(true)} />
              <Tutorial station={station} goal="toLen" lead="② サブネットマスク → プレフィックス長"
                onSolved={() => setSolved2(true)} />
            </>
          ) : (
            <Tutorial station={station} onSolved={() => setSolved(true)} />
          )}
        </Sec>
      )}

      {/* 入口は、いつも画面のいちばん下に貼り付いている。
          練習＝よく出るやつを反射で覚える／テスト＝本番と同じ形で演習。
          **緑は「いま進む道」1つだけ。**テストは灰の枠にして、どちらが先かを見た目で言う。
          仕上げは練習が無いので、テストが1つだけ並ぶ（そのときは緑のベタ） */}
      <div className={"gotest" + (hasDrill ? " two" : "")}>
        {hasDrill && <button className={"next" + (both ? "" : " calm")} onClick={onDrill}>練習をする</button>}
        <button className={"next" + (hasDrill ? " ghost" : "")} onClick={onTest}>テストをする</button>
      </div>
    </div>
  );
}

/** 桁の重み表。教材の「桁の重み表」そのまま。押せない（見るだけ）。 */
function WeightTable({ blank }) {
  return (
    <div className="split wtable">
      <div className="sp-lab">2の</div>
      <div className="sp-row">
        {[7, 6, 5, 4, 3, 2, 1, 0].map((n) => <span key={n} className="sp-c fixed pw">{n}乗</span>)}
      </div>
      <div className="sp-lab" />
      <div className="sp-row">
        {/* テストでは下の段を空にする。数は頭から出す。
            枠だけは残す（何も無いと表に見えず、何を思い出すのか分からない）。
            破線＝「空きで、ここに入る」は、バッジの空き枠と同じ約束 */}
        {[7, 6, 5, 4, 3, 2, 1, 0].map((n) => (
          <span key={n} className={blank ? "sp-c blank" : "sp-c fixed big2"}>{blank ? "" : Math.pow(2, n)}</span>
        ))}
      </div>
    </div>
  );
}

/* ── 盤 2の◯乗 ─────────────────────────────────────────
   練習では、表をまるごと見せる。**覚えるための時間**なので隠さない。
   押すのは答えの行。押した行だけが色づく。
   テストでは表が出ないので、頭の中でこの並びを思い出すことになる。 */
function PowBoard({ q, value, onChange, locked, onSubmit }) {
  const rows = [7, 6, 5, 4, 3, 2, 1, 0];
  const sel = value;
  const out = sel == null ? "" : q.goal === "toValue" ? String(Math.pow(2, sel)) : String(sel);
  const toPower = q.goal === "toPower";
  return (
    <div className="box">
      {/* **押す先が答えそのもの**でないと、対応を覚えることにならない。
          「2の7乗は？」なら 128 を押す。「128 は2の何乗？」なら 7乗 を押す */}
      <div className="lead now">下の表から、<b>答えにあたる数</b>を1つ選びます</div>
      <div className="split">
        <div className="sp-lab">2の</div>
        <div className="sp-row">
          {rows.map((n) => (
            toPower
              ? <button key={n} className={"sp-c" + (sel === n ? " on" : "")}
                  onClick={() => !locked && onChange(n)}>{n}乗</button>
              : <span key={n} className="sp-c fixed">{n}乗</span>
          ))}
        </div>
        <div className="sp-lab" />
        <div className="sp-row">
          {rows.map((n) => (
            toPower
              ? <span key={n} className="sp-c fixed big2">{Math.pow(2, n)}</span>
              : <button key={n} className={"sp-c big2" + (sel === n ? " on" : "")}
                  onClick={() => !locked && onChange(n)}>{Math.pow(2, n)}</button>
          ))}
        </div>
      </div>
      <button className="next" onClick={() => onSubmit(out)} disabled={locked || sel == null}>これで決定</button>
    </div>
  );
}
/* ── 盤① 写して足す（1ステージ） ────────────────────────────────
   盤は空から始める。上の2進数を見て写す。押した重みが足されていく。 */
function SumBoard({ q, value, onChange, locked, onSubmit }) {
  const v = value || 0;
  const on = W8.filter((w) => v & w);
  return (
    <div className="box">
      {/* 上の枠に書いてある数を見て、そのまま押す。
          列にそろえた写しを間に置くと、どちらを見ればいいのか迷う */}
      <div className="lead now">問題と<b>同じ並び</b>になるまで、マスを押します</div>
      <div className="split">
        {/* 行に名前を付ける。名前が無いと、上の段と下の段が何なのか分からない */}
        <div className="sp-lab">桁の重み表</div>
        <div className="sp-row">{W8.map((x) => <span key={x} className="sp-c fixed">{x}</span>)}</div>
        <div className="sp-lab">2進数</div>
        <div className="row8 tight">
          {W8.map((w) => (
            <button key={w} className={"cell" + (v & w ? " on" : "")}
              onClick={() => !locked && onChange((x) => ((x || 0) & w ? x - w : (x || 0) + w))}>
              <span className="c-v">{v & w ? 1 : 0}</span><span className="c-w">{w}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="out">
        <span className="o-x">{on.length ? on.join(" ＋ ") : "まだ押していません"}</span>
      </div>
      <div className="bridge">
        <span className="b-t">写した重みを、全部 足し算すると</span>
        <span className="b-a">↓</span>
      </div>
      <div className="out">
        <span className="o-n">合計 <b>{v}</b></span>
      </div>
      {/* 何か押すまでは決定できない。答えは必ず 1 以上なので、合っているかどうかは漏れない */}
      <button className="next" onClick={() => onSubmit(v)} disabled={locked || !v}>これで決定</button>
    </div>
  );
}

/* ── 盤② 残りを減らす（2ステージ） ──────────────────────────────
   教材の手順は「大きい重みから、引けるなら1・引けないなら0」。
   だから足すのではなく**引く**。残りが 0 になれば完成。
   引けない重みも押せるようにしてある ── 押せなくすると、
   「引けるかどうか」の判断を機械がやってしまうから。 */
function SubBoard({ q, value, onChange, locked, onSubmit }) {
  const v = value || 0;
  const rest = q.target - v;
  const on = W8.filter((w) => v & w);
  // 押したいちばん右の1つ先が「いま見るところ」。
  // 左から順に見る手つきなので、ある桁を押した時点で、その左は決まったことになる
  let last = -1;
  W8.forEach((w, i) => { if (v & w) last = i; });
  const here = last + 1;
  return (
    <div className="box">
      <div className={"rest" + (rest === 0 ? " zero" : rest < 0 ? " over" : "")}>
        残り <b>{rest}</b>{rest < 0 && <span className="rest-n">　引きすぎ</span>}
      </div>
      <div className="lead now"><b>左のマスから順に</b>見ます。残りから引けるならマスを押して <b>1</b> に、引けなければ押さずに次の桁へ進みます</div>
      <div className="row8">
        {W8.map((w, i) => (
          <button key={w}
            // いま見るところ＝押したいちばん右の1つ先。位置を示すだけで、
            // 「引けるかどうか」は言わない（そこは自分で決めるところ）
            className={"cell" + (v & w ? " on" : "") + (i === here ? " now" : "") + (i > here ? " later" : "")}
            onClick={() => !locked && onChange((x) => ((x || 0) & w ? x - w : (x || 0) + w))}>
            <span className="c-v">{v & w ? 1 : 0}</span><span className="c-w">{w}</span>
          </button>
        ))}
      </div>
      <div className="out">
        <span className="o-x">
          {on.length ? `${q.target} ${on.map((w) => `− ${w}`).join(" ")}` : "まだ押していません"}
        </span>
      </div>
      {/* 引き算の式と、2進数の並びを**つなぐ**1行。ここが飛ぶと、なぜ2進数になるのか分からない */}
      <div className="bridge">
        <span className="b-t">引けたところに <b>1</b>、引けなかったところに <b>0</b> を置くと</span>
        <span className="b-a">↓</span>
      </div>
      <div className="out">
        <span className="o-n">2進数 <b>{W8.map((w) => (v & w ? 1 : 0)).join("")}</b></span>
      </div>
      {/* 何か押すまでは決定できない。「残りが 0 になるまで」にはしない ──
          それだと合っているかどうかを機械が教えてしまう */}
      <button className="next" onClick={() => onSubmit(W8.map((w) => (v & w ? 1 : 0)).join(""))} disabled={locked || !v}>
        これで決定
      </button>
    </div>
  );
}

/* ── 盤 桁の重み表をうめる（ステージ1の最初の1問）────────────
   **この表がそらで書けることが、以降全部の前提。**だから最初に1回、自分で書く。
   マスを押して選び、下の数字で入れる。ステージ4の「打ちこむところを押してから」と同じ手つき。 */
function TableBoard({ q, value, onChange, locked, onSubmit }) {
  const st = value || { slot: 0, cells: [null, null, null, null, null, null, null, null] };
  const cells = st.cells, slot = st.slot;
  const set = (x) => !locked && onChange({ ...st, ...x });
  const done = cells.every((x) => x != null);
  const out = cells.join(" ");
  return (
    <div className="box">
      <div className="lead now">うめるマスを押してから、下の数字で入れます</div>
      <div className="split">
        <div className="sp-lab">2の</div>
        <div className="sp-row">
          {[7, 6, 5, 4, 3, 2, 1, 0].map((n) => <span key={n} className="sp-c fixed pw">{n}乗</span>)}
        </div>
        <div className="sp-lab" />
        <div className="row8 tight">
          {cells.map((v, i) => (
            /* 破線＝まだ空き。バッジの空き枠と同じ約束 */
            <button key={i} className={"cell bare" + (v == null ? " blank" : "") + (slot === i ? " on" : "")}
              /* マスを選び直したら電卓も空に。残っていると前の数の続きになる（12864 のように） */
              onClick={() => set({ slot: i, calc: null })}>
              <span className="c-v">{v == null ? "" : v}</span>
            </button>
          ))}
        </div>
      </div>
      <Calc plain value={st.calc} onChange={(c) => {
        const t = c ? c.nums.reduce((a, n, i) => (i === 0 ? n : a + n), 0) : 0;
        const n2 = cells.slice(); n2[slot] = t;
        set({ calc: c, cells: n2 });
      }} />
      <button className="next" onClick={() => onSubmit(out)} disabled={locked || !done}>
        {done ? "これで決定" : "8つとも入れてください"}
      </button>
    </div>
  );
}

/* ── 盤 マスク（/ の数 ↔ マスク） ─────────────────────────
   /28 は「1 が28個並ぶ」という意味。だから
     ① 8個ずつ 255 にしていく（左から）
     ② 余りを、上の桁から 1 にする
   盤の上に「/いくつ」と「マスク」の両方が出る。
   どちらを聞かれても、同じ手つきで答えられる。 */
function MaskBoard({ q, value, onChange, locked, onSubmit }) {
  const st = value || { full: 0, bits: 0 };
  const full = st.full || 0, bits = st.bits || 0;
  const set = (x) => !locked && onChange({ ...st, ...x });
  const d = maskBoardOut(full, bits, q.goal);       // 計算は gen.js に任せる

  return (
    <div className="box">
      {/* 8・16・24・32 の目盛りを下に置く。/28 なら 24 と 32 の間 ＝ 255 が3つ、が目で分かる */}
      <div className={"lead " + (full ? "past" : "now")}>
        {/* マスク → / の向きでは、まだ「8ずつ区切る」ものが無い。数えるのは 255 の数 */}
        {/* 「そろったオクテット」では、何がそろったのか分からない。
            説明の1枚（WAY.S8）と同じ「1 だけで埋まった」に合わせる */}
        {q.goal === "toMask" ? <>① 左から <b>8 ずつ</b> 区切って、<b>1 だけで埋まった</b>オクテットを <b>255</b> にします</> : <>① 左から <b>255</b> がいくつ並んでいるかを選びます</>}
      </div>
      <div className="dots">
        <span className="d-lab" />
        {[0, 1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="dot">.</span>}
            <button className={"oct" + (i < full ? " on" : "")}
              onClick={() => set({ full: i < full ? i : i + 1, bits: 0 })}>
              {i < full ? 255 : i === full ? d.mask.split(".")[i] : 0}
            </button>
          </React.Fragment>
        ))}
      </div>
      <div className="dots ticks">
        <span className="d-lab">1の数</span>
        {[8, 16, 24, 32].map((t, i) => (
          <React.Fragment key={t}>
            {i > 0 && <span className="dot"> </span>}
            <span className="tick">{t}</span>
          </React.Fragment>
        ))}
      </div>

      {/* ②は、①を1つでも押してから出す。
          8 で割り切れるときは押すところを出さず、「0 のまま」と言い切る */}
      {full >= 1 && q.goal === "toMask" && q.board.rest === 0 ? (
        <div className="sub">② 余りは 0個 なので、残りのオクテットは <b>0 のまま</b>です</div>
      ) : full >= 1 && full < 4 && (
        <>
          <div className={"lead " + (bits ? "past" : "now")}>
            {q.goal === "toMask"
              ? <>② 余りの <b>{q.board.rest} 個</b> を、次のオクテットに左から <b>1</b> で並べます</>
              : <>② <b>255 でない数</b>の並びを、マスを押して作ります</>}
          </div>
          <div className="split">
            <div className="sp-lab" />
            <div className="sp-row">
              {W8.map((w) => (
                <button key={w} className={"sp-c" + (bits & w ? " on" : "")}
                  onClick={() => set({ bits: bits & w ? bits - w : bits + w })}>
                  {bits & w ? 1 : 0}
                </button>
              ))}
            </div>
            <div className="sp-lab">桁の重み表</div>
            <div className="sp-row w">{W8.map((w) => <span key={w} className="sp-w">{w}</span>)}</div>
          </div>
          {/* ステージ3と同じ形で、足していくようすを見せる（暗算をさせない）。
              **ここは MaskBoard。**押した重みを足すと、そのオクテットの数になる。
              1つも押していないうちは、式にならないので出さない */}
          {!!bits && (
            <div className="out">
              <span className="o-x">
                {W8.filter((w) => bits & w).join(" ＋ ")} ＝ {bits}
              </span>
            </div>
          )}
        </>
      )}

      {/* この2つは同じことを言っている、が見えるように、いつも並べて出す */}
      <div className="derive">
        <div className={"d-r" + (q.goal === "toLen" ? " ans" : "")}><span>プレフィックス長</span><b>/{d.len}</b></div>
        <div className={"d-r" + (q.goal === "toMask" ? " ans" : "")}><span>サブネットマスク</span><b>{d.mask}</b></div>
      </div>
      <button className="next" onClick={() => onSubmit(d.out)} disabled={locked || (!full && !bits)}>これで決定</button>
    </div>
  );
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
function SplitBoard({ q, value, onChange, locked, onSubmit }) {
  const { ip, len } = q.board;
  const parts = ip.split(".").map(Number);
  const mask = maskStr(len).split(".").map(Number);
  const st = value || { oct: null, zero: false, one: false };
  const oct = st.oct;
  const set = (x) => !locked && onChange({ ...st, ...x });
  const givenMask = q.given.some((g) => g.k === "サブネットマスク");

  // ②の 1 と 0 も機械が出す。線は、その並びの「いちばん右の 1 の後ろ」
  const bs = oct == null ? [] : bin8(mask[oct]).split("").map(Number);
  const cut = bs.lastIndexOf(1) + 1;
  // ③の 1 と 0 は機械が出す。**そのかわり、引いていく過程を下に見せる**
  const ipBits = oct == null ? [] : bin8(parts[oct]).split("").map(Number);

  // 計算は gen.js の splitOut に任せる（画面と検算で同じ関数を使う）
  const d = (oct != null && cut > 0) ? splitOut(ip, oct, cut, q.goal) : null;
  // 押した 1 と 0 から、そのまま住所にする。計算は gen.js の addrWith / pairOut
  const keep = oct == null ? 0 : ipBits.slice(0, cut).reduce((a2, c, i) => a2 + (c ? W8[i] : 0), 0);
  const myNet = oct == null ? null : addrWith(ip, oct, keep, 0);
  const myBc = oct == null ? null : addrWith(ip, oct, keep + restOnes(cut), 255);
  const out = (myNet && myBc) ? pairOut(myNet, myBc, q.goal) : "";
  const ready = d && st.zero && st.one;

  return (
    <div className="box">
      {/* 問題の数は、この盤の中で見せる（材料の枠と二重にしない）。
          押すのはサブネットマスクの行だけ。IPアドレスは平らな文字 */}
      <div className="dots">
        <span className="d-lab">IP</span>
        {parts.map((v, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="dot">.</span>}
            <span className={"num" + (oct === i ? " on" : "")}>{v}</span>
          </React.Fragment>
        ))}
      </div>
      <div className={"lead " + (oct != null ? "past" : "now")}>① サブネットマスクを左から見て、<b>初めて 255 でなくなるオクテット</b>を押します</div>
      <div className="dots">
        <span className="d-lab">マスク</span>
        {mask.map((m, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="dot">.</span>}
            <button className={"oct" + (oct === i ? " on" : "")}
              onClick={() => set({ oct: i, bits: 0, zero: false, one: false })}>{m}</button>
          </React.Fragment>
        ))}
      </div>
      {!givenMask && <div className="sub">/{len} → {maskStr(len)}（ステージ{byId("S8").no} でやったところ）</div>}

      {oct != null && (
        <>
          {/* マスクを 1 と 0 にするのは自分。IP の 1 と 0 は、その真下に並べて出す */}
          <div className="lead past">② サブネットマスクの <b>{mask[oct]}</b> を 1 と 0 にすると</div>
          <div className="split">
            <div className="sp-lab">マスク<i>{mask[oct]}</i></div>
            <div className="sp-row">
              {bs.map((c, i) => (
                <span key={i} className={"sp-c fixed" + (cut === i + 1 ? " edge" : "")}>{c}</span>
              ))}
            </div>
            <div className="sp-lab">桁の重み表</div>
            <div className="sp-row w">{W8.map((w) => <span key={w} className="sp-w">{w}</span>)}</div>
          </div>

          {/* ③ IPアドレスの数も、自分で 1 と 0 にする。
              ②と同じ手つきを、数を変えてもう一度やるだけ */}
          {/* **行き止まりにしない。**0 のオクテットを押すと②から先が出ないので、
              何も起きないように見える。押し直せることを言う（押せなくはしない。
              どこが区切りかを見つけるのが、このステージの学習そのもの） */}
          {oct != null && cut === 0 && (
            <div className="point">この数は <b>0</b>（全部 0）なので、線はもっと左にあります。
              押すのは、上の列で <b>255 でなくなる いちばん左の数</b>です。</div>
          )}
          {cut > 0 && (
            <>
              <div className="lead past">
                ③ <b>同じオクテット</b>の IPアドレス <b>{parts[oct]}</b> を 1 と 0 にすると
              </div>
              <div className="split">
                <div className="sp-lab">IP<i>{parts[oct]}</i></div>
                <div className="sp-row">
                  {ipBits.map((c, i) => (
                    <span key={i} className={"sp-c fixed" + (cut === i + 1 ? " edge" : "")}>{c}</span>
                  ))}
                </div>
                {/* 重みは、押すところのすぐ下に。暗算で 112 = 64+32+16 をやらせない */}
                <div className="sp-lab">重み</div>
                <div className="sp-row w">{W8.map((w) => <span key={w} className="sp-w">{w}</span>)}</div>
              </div>
              <div className="out">
                <span className="o-x">
                  {parts[oct]}{W8.filter((w, i) => ipBits[i]).map((w) => ` − ${w}`).join("")} ＝ 0
                </span>
              </div>
            </>
          )}

          {/* ④⑤ 押すのは行ごとに1回。マスごとの判断は無い（線から右は全部同じ値）。
              判断は②③で終わっていて、ここは「何をするか」を決めるだけ */}
          {cut > 0 && (
            <>
              <div className={"lead " + (st.zero ? "past" : "now")}>
                ④ <b>上の {parts[oct]} の並び</b>で、線から右を <b>全部 0</b> にする
              </div>
              <div className="split bulk">
                <button className={"go" + (st.zero ? " on" : "")} onClick={() => set({ zero: true })}>全部 0</button>
                <div className="sp-row">
                  {ipBits.map((c, i) => (
                    i < cut
                      ? <span key={i} className={"sp-c fixed from" + (cut === i + 1 ? " edge" : "")}>{c}</span>
                      : <span key={i} className={st.zero ? "sp-c fixed done" : "sp-c blank"}>{st.zero ? 0 : ""}</span>
                  ))}
                </div>
              </div>
              {/* 並びと住所を、画面でつなぐ（頭の中で組み立てさせない） */}
              {st.zero && (
                <div className="asm">
                  <span>この8つ ＝ <b>{keep}</b>{oct < 3 && <>　後ろは 全部 <b>0</b></>}</span>
                  <span className="asm-a">{myNet}</span>
                </div>
              )}
            </>
          )}

          {st.zero && (
            <>
              <div className={"lead " + (st.one ? "past" : "now")}>
                ⑤ 同じ並びで、線から右を <b>全部 1</b> にする
              </div>
              <div className="split bulk">
                <button className={"go" + (st.one ? " on" : "")} onClick={() => set({ one: true })}>全部 1</button>
                <div className="sp-row">
                  {ipBits.map((c, i) => (
                    i < cut
                      ? <span key={i} className={"sp-c fixed from" + (cut === i + 1 ? " edge" : "")}>{c}</span>
                      : <span key={i} className={st.one ? "sp-c fixed done" : "sp-c blank"}>{st.one ? 1 : ""}</span>
                  ))}
                </div>
              </div>
              {st.one && (
                <div className="asm">
                  <span>この8つ ＝ <b>{keep + restOnes(cut)}</b>{oct < 3 && <>　後ろは 全部 <b>255</b></>}</span>
                  <span className="asm-a">{myBc}</span>
                </div>
              )}
            </>
          )}


          {(st.zero || st.one) && (
            <div className="derive">
              {st.zero && <div className="d-r col"><span>いちばん小さい数 ＝ <b>ネットワークアドレス</b></span><b>{myNet}</b></div>}
              {st.one && <div className="d-r col"><span>いちばん大きい数 ＝ <b>ブロードキャストアドレス</b></span><b>{myBc}</b></div>}
              {/* ＋1／−1 は形で見せる。テストの外れの選択肢に「±1 を忘れた」が入っている */}
              {ready && q.goal === "range" && (
                <>
                  <div className="d-r col"><span>{myNet} は使えない → ＋1</span><b>{out.split(" 〜 ")[0]}</b></div>
                  <div className="d-r col"><span>{myBc} は使えない → −1</span><b>{out.split(" 〜 ")[1]}</b></div>
                  <div className="d-r col ans"><span>答え</span><b>{out}</b></div>
                </>
              )}
            </div>
          )}
        </>
      )}
      <button className="next" onClick={() => onSubmit(out)} disabled={locked || !ready}>これで決定</button>
    </div>
  );
}

/* ── 盤④ 右から見て1つ押す（5ステージ・6ステージ） ────────────────────
   盤を右（小さい方）から見て、必要な数以上になる最初の重みを押す。
   8桁で足りないときのために、上に延長した段を出してある（教材の「表を延長する」）。 */
const W16 = [32768, 16384, 8192, 4096, 2048, 1024, 512, 256];
/* ── 桁数を、サブネットマスクの形にして見せる ────────────────────
   「ホスト部 5桁」まで出せても、**それが第4オクテットの話なのか第3オクテットの話なのか**が
   見えないと 255.255.255.224 に化けない。ここだけを絵にする。
   破線＝ホスト部（機器の分）。空きは破線、という盤全部の約束と同じ。 */
function MaskFrom({ len }) {
  // /32 は「第4オクテットの8桁全部」。cutOct のままだと 5つ目のオクテットを指してしまう
  const oc = Math.min(3, cutOct(len)), cb = len - oc * 8;
  const parts = maskStr(len).split(".");
  const on = W8.slice(0, cb);
  return (
    <>
      <div className="point">後ろから {32 - len} 桁分が、機器に使うところ（ホスト部）です。線は <b>第{oc + 1}オクテット</b> に入ります</div>
      <div className="split">
        <div className="sp-head">第{oc + 1}オクテット</div>
        <div className="sp-lab" />
        <div className="sp-row">
          {W8.map((x, j) => (
            <span key={x} className={j < cb ? "sp-c fixed" : "sp-c blank"}>{j < cb ? 1 : 0}</span>
          ))}
        </div>
      </div>
      <div className="out">
        <span className="o-n">第{oc + 1}オクテット ＝ {on.length ? on.join(" ＋ ") + " ＝ " : ""}<b>{parts[oc]}</b></span>
      </div>
      <div className="dots">
        {parts.map((v, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="dot">.</span>}
            <span className={"num" + (i === oc ? " on" : "")}>{v}</span>
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

function PickBoard({ q, value, onChange, locked, onSubmit }) {
  const w = value;
  const d = w == null ? null : pickOut(w, q.goal, q.base);   // 計算は gen.js に任せる
  const bits = d ? d.bits : null;
  const out = d ? d.out : "";
  const cell = (x) => (
    <button key={x} className={"cell wide" + (w === x ? " on" : "")}
      onClick={() => !locked && onChange(x)}>
      <span className={"c-w2" + (String(x).length >= 5 ? " sm" : "")}>{x}</span>
    </button>
  );
  return (
    <div className="box">
      {/* なぜ ＋2 なのかを、押す前に言っておく。
          ここを言わないと「2 を足す」が呪文になり、数字が変わると再現できない */}
      {q.goal === "host" ? (
        <>
          <div className="point">
            両端の2つ（<b>ネットワークアドレス</b>と<b>ブロードキャストアドレス</b>）には機器を置けません。
            ひとつ前の<b>使えるアドレスの範囲</b>と同じ話です。
            だから、ほしい台数に、その2つ分を足してから探します。
          </div>
          <div className="lead past">① 使えない2つ分を足します</div>
          <div className="out"><span className="o-n">{q.need}台 ＋ 2 ＝ <b>{q.want}</b></span></div>
          <div className={"lead " + (w != null ? "past" : "now")}>
            ② <b>{q.want}</b> が入る、いちばん小さいサブネットを押します
          </div>
          {/* 上の段がどこから来たのかを言う。**覚えた表の続き**だと分かれば、覚えるものは増えない */}
          <div className="point">桁の重み表を、左へのばしただけです（2倍ずつ増えます）</div>
        </>
      ) : (
        <>
          <div className="sub">クラス{q.cls}（/{q.base} から）／ 必要なサブネット数 <b>{q.want}</b></div>
          <div className={"lead " + (w != null ? "past" : "now")}>
            <b>{q.want}</b> が入る、いちばん小さい数を押します
          </div>
          <div className="point">桁の重み表を、左へのばしただけです（2倍ずつ増えます）。数が大きいほど、たくさん分けられます</div>
        </>
      )}
      <div className="split">
        {/* オクテットの名前を出せるのは台数のほうだけ（線は 32 から数えるので位置が決まる）。
            サブネット数のほうは**クラスによって出発点が変わる**ので、同じ段でも
            クラスA なら第2オクテット、B なら第3、C なら第4 と、指す場所が動く。
            前は「第3／第4オクテット」と決め打ちしていて、**クラスC のときしか合っていなかった。**
            段が何なのかは、上の「2の◯乗」がすでに言っているので、名前は出さない。 */}
        {q.goal === "host" && <div className="sp-head">大きいサブネット（線は第3オクテット）</div>}
        <div className="sp-lab">2の</div>
        <div className="sp-row">
          {[15, 14, 13, 12, 11, 10, 9, 8].map((n) => <span key={n} className="sp-c fixed pw">{n}乗</span>)}
        </div>
        <div className="sp-lab" />
        <div className="row8 tight">{W16.map(cell)}</div>
        {q.goal === "host" && <div className="sp-head">小さいサブネット（線は第4オクテット）</div>}
        <div className="sp-lab">2の</div>
        <div className="sp-row">
          {[7, 6, 5, 4, 3, 2, 1, 0].map((n) => <span key={n} className="sp-c fixed pw">{n}乗</span>)}
        </div>
        <div className="sp-lab" />
        <div className="row8 tight">{W8.map(cell)}</div>
      </div>
      {w != null && (
        <div className="derive">
          {q.goal === "host" && <div className="lead past">③ 選んだサブネットで、何台つかえるかを見ます</div>}
          <div className="d-r"><span>押したところ</span><b>{w}</b></div>
          {q.goal === "host" && (
            <div className="d-r"><span>機器に使える</span><b>{w} − 2 ＝ {Math.max(0, w - 2)}台</b></div>
          )}
          <div className="d-r"><span>{q.goal === "host" ? "ホスト部" : "サブネットに使う"}</span><b>{bits} 桁</b></div>
          {q.goal === "subnet" && <div className="d-r"><span>/{q.base} から {bits} 桁 延ばす</span><b>/{q.base} + {bits}</b></div>}
          {/* ここが山場。**桁数のままでは、まだサブネットマスクにならない。**
              後ろから何桁分かを、どのオクテットのどこに線が入るかとして目で見せる */}
          {q.goal === "host" && <MaskFrom len={d.len} />}
          <div className="d-r col ans"><span>答え</span><b>{out}</b></div>
        </div>
      )}
      <button className="next" onClick={() => onSubmit(out)} disabled={locked || w == null}>これで決定</button>
    </div>
  );
}

/* ── 盤⑤ 縦に並べて線（7ステージ） ──────────────────────────────
   2進を縦に並べ、**同じでなくなるところ**に線を引く。線から左が集約したアドレス。 */
function StackBoard({ q, value, onChange, locked, onSubmit }) {
  const { nets } = q.board;
  const st = value || { oc: null, cut: null };
  const oc = st.oc, cut = st.cut;
  const set = (x) => !locked && onChange({ ...st, ...x });
  const parts = nets.map((n) => n.split("/")[0].split(".").map(Number));
  const base = nets[0].split("/")[0];
  const out = (oc != null && cut != null) ? stackOut(base, oc, cut).out : "";

  return (
    <div className="box">
      {/* ①は3ステージの「255 でない数を押す」とまったく同じ手つき。
          いきなり 1 と 0 が縦に並ぶと、その数がどこから来たのか分からなくなる */}
      <div className={"lead " + (oc != null ? "past" : "now")}>① {nets.length}つを見比べて、<b>数が違っているオクテット</b>を押します</div>
      {parts.map((ps, r) => (
        <div key={r} className="dots">
          <span className="d-lab">{r + 1}つ目</span>
          {ps.map((v, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="dot">.</span>}
              {r === 0 ? (
                <button className={"oct" + (oc === i ? " on" : "")}
                  onClick={() => set({ oc: i, cut: null })}>{v}</button>
              ) : (
                <span className={"num" + (oc === i ? " on" : "")}>{v}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      ))}

      {oc != null && (
        <>
          <div className={"lead " + (cut != null ? "past" : "now")}>② 縦に見て、<b>{nets.length}つとも同じ</b>ところまでを押します</div>
          <div className="stack">
            {parts.map((ps, r) => (
              <div key={r} className="st-row">
                <span className="st-d">{ps[oc]}</span>
                {bin8(ps[oc]).split("").map((c, i) => (
                  <button key={i} className={"st-c" + (cut != null && i < cut ? " same" : "") + (cut === i + 1 ? " edge" : "")}
                    onClick={() => set({ cut: i + 1 })}>{c}</button>
                ))}
              </div>
            ))}
          </div>
          {cut != null && (
            <div className="derive">
              <div className="d-r"><span>同じなのは</span><b>上から {oc * 8 + cut} 桁分</b></div>
              <div className="d-r col ans"><span>答え</span><b>{out}</b></div>
            </div>
          )}
        </>
      )}
      <button className="next" onClick={() => onSubmit(out)} disabled={locked || cut == null}>これで決定</button>
    </div>
  );
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
function Calc({ value, onChange, plain }) {
  const st = value || { nums: [0], ops: [] };
  const total = st.nums.reduce((a, n, i) => (i === 0 ? n : st.ops[i - 1] === "−" ? a - n : a + n), 0);
  const expr = st.nums.map((n, i) => (i === 0 ? String(n) : ` ${st.ops[i - 1]} ${n}`)).join("");
  const digit = (d) => {
    const nums = st.nums.slice();
    nums[nums.length - 1] = Number(String(nums[nums.length - 1] === 0 ? "" : nums[nums.length - 1]) + d);
    onChange({ ...st, nums });
  };
  const op = (o) => onChange({ nums: st.nums.concat([0]), ops: st.ops.concat([o]) });
  const back = () => {
    const nums = st.nums.slice(), ops = st.ops.slice();
    const last = String(nums[nums.length - 1]);
    if (last !== "0") nums[nums.length - 1] = Number(last.slice(0, -1) || 0);
    else if (nums.length > 1) { nums.pop(); ops.pop(); }
    onChange({ nums, ops });
  };
  const key = (label, fn, cls) => (
    <button key={label} className={"k" + (cls ? " " + cls : "")} onClick={fn}>{label}</button>
  );
  return (
    <div className="calc">
      <div className="calc-d">
        <div className="calc-e">{expr}</div>
        <div className="calc-t">{total}</div>
      </div>
      <div className="keys">
        {["7", "8", "9"].map((d) => key(d, () => digit(d)))}
        {key("⌫", back, "op")}
        {["4", "5", "6"].map((d) => key(d, () => digit(d)))}
        {/* 足し引きが要らないステージ（2の◯乗）では、＋− を出さない */}
        {plain ? <span /> : key("＋", () => op("＋"), "op")}
        {["1", "2", "3"].map((d) => key(d, () => digit(d)))}
        {plain ? <span /> : key("−", () => op("−"), "op")}
        {key("0", () => digit("0"), "w2")}
        {key("00", () => digit("00"))}
        {key("C", () => onChange({ nums: [0], ops: [] }), "op")}
      </div>
    </div>
  );
}

/** テストの答えの入れ方。ステージによって変える。
 *    1ステージ … 計算した数がそのまま答え
 *    2ステージ … 重みの書いていない空の8マス（打ち間違いが起きない）
 *  3〜7ステージ … 選ぶ（本番の CCNA も選択式。全部打たせると1問が重すぎる） */
function TestBoard({ q, value, onChange, locked, onSubmit }) {
  const st = value || { calc: null, bits: 0, pick: null };
  const set = (patch) => onChange({ ...st, ...patch });
  const calcTotal = (c) => (c ? c.nums.reduce((a, n, i) => (i === 0 ? n : c.ops[i - 1] === "−" ? a - n : a + n), 0) : 0);

  if (q.station === "S0" || q.station === "S1") {
    const v = calcTotal(st.calc);
    return (
      <div className="box">
        {/* 練習と急に形が変わらないよう、表の枠だけは出す。中身は自分で思い出す */}
        {q.station === "S0" && <WeightTable blank />}
        <Calc plain={q.station === "S0"} value={st.calc} onChange={(c) => set({ calc: c })} />
        <button className="next" onClick={() => onSubmit(v)} disabled={locked || !st.calc}>
          {v} で決定
        </button>
      </div>
    );
  }

  if (q.station === "S8") {
    // 選ぶと消去法で当たってしまう。**自分で書く。**
    // サブネットマスクは4つの数、プレフィックス長は1つの数
    const slot = st.slot == null ? 0 : st.slot;
    const parts = st.parts || [null, null, null, null];
    const v = calcTotal(st.calc);
    const toMask = q.goal === "toMask";
    const out = toMask ? parts.join(".") : `/${v}`;
    const done = toMask ? parts.every((x) => x != null) : !!st.calc;
    return (
      <div className="box">
        <WeightTable />
        {toMask && (
          <>
            <div className="lead now">打ちこむところを押してから、下の数字で入れます</div>
            <div className="dots">
              {parts.map((x, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="dot">.</span>}
                  {/* 破線＝まだ空き（ここに数字が入る）。バッジの空き枠と同じ約束 */}
                  <button className={"oct" + (x == null ? " blank" : "") + (slot === i ? " on" : "")}
                    onClick={() => !locked && set({ slot: i, calc: null })}>{x == null ? "_" : x}</button>
                </React.Fragment>
              ))}
            </div>
          </>
        )}
        <Calc value={st.calc} onChange={(c) => {
          const t = c ? c.nums.reduce((a, n, i) => (i === 0 ? n : c.ops[i - 1] === "−" ? a - n : a + n), 0) : 0;
          if (!toMask) { set({ calc: c }); return; }
          const n2 = parts.slice(); n2[slot] = t; set({ calc: c, parts: n2 });
        }} />
        <button className="next" onClick={() => onSubmit(out)} disabled={locked || !done}>
          {toMask ? (done ? `${out} で決定` : "4つとも入れてください") : `/${v} で決定`}
        </button>
      </div>
    );
  }

  // ステージ5の手順テスト。**次に何をするかを選ばせ、選んだ処理だけをやらせる。**
  // 道具は「選んだ処理をやる場所」だけ。重み表も電卓も出さない
  if (q.steps5) {
    const R = q.steps5, r = st.r || 0, round = R[r];
    // 手順が終わったら、いつもの4択で締める
    const Done = () => (
      <>
        {(st.log || []).map((x, i) => (
          <div key={i} className="donerow"><span>{i + 1}　{x.ask}</span><b>{x.did}</b></div>
        ))}
      </>
    );
    if (!round) {
      return (
        <div className="box">
          <Done />
          <div className="lead now">答えはどれですか。</div>
          <div className="choices">
            {(q.choices || [String(q.answer)]).map((c) => (
              <button key={c} className={"ch" + (st.pick === c ? " on" : "")
                + (locked && c === String(q.answer) ? " right" : "")
                + (locked && st.pick === c && c !== String(q.answer) ? " wrong" : "")}
                onClick={() => !locked && set({ pick: c })}>
                <span>{c}</span>
                {locked && st.pick === c && c !== String(q.answer) && <i>あなたの回答</i>}
              </button>
            ))}
          </div>
          <button className="next" onClick={() => onSubmit(st.pick)}
            disabled={locked || !st.pick}>これで決定</button>
        </div>
      );
    }
    const picked = st.picked || null, doneAsk = st.doneAsk || false;
    const bits = st.bits || 0, sum = W8.reduce((a, w) => a + (bits & w ? w : 0), 0);
    const miss = () => set({ bad: true });
    // そのフェーズだけ、やり直す（問題ごと最初に戻さない）
    const again = () => set(doneAsk
      ? { bad: false, oct: null, bits: 0, step2: false }
      : { bad: false, picked: null });
    const pick = (a) => {
      if (doneAsk) return;
      if (a === round.ok) set({ picked: a, doneAsk: true, bad: false });
      else set({ picked: a, bad: true, slip: true });
    };
    // 済んだ処理を残す。段を進むたびに覚えておくのはきつい
    const noteOf = () => {
      if (round.kind === "oct") {
        // 線の位置は、この2進数の「いちばん右の 1 の後ろ」。
        // あとの段で思い出さなくていいように、ここに残す
        const mv = Number(maskStr(q.board.len).split(".")[st.oct]);
        return `${mv} → ${bin8(mv)}`;
      }
      if (round.kind === "bits") return `${round.want} → ${W8.map((w) => (bits & w ? 1 : 0)).join("")}`;
      return `全部 0 → ${round.want}　／　全部 1 → ${round.want2}`;
    };
    const nextRound = () => set({ r: r + 1, picked: null, doneAsk: false, bad: false, oct: null, bits: 0, step2: false,
      log: (st.log || []).concat([{ ask: round.ok, did: noteOf() }]) });
    // その処理ができたか
    const okNow = round.kind === "oct" ? st.oct === round.want
      : round.kind === "bits" ? sum === round.want
        : st.step2 ? sum === round.want2 : sum === round.want;
    const doIt = () => {
      if (!okNow) { set({ bad: true, slip: true }); return; }
      if (round.kind === "fill" && !st.step2) { set({ step2: true, bad: false }); return; }
      if (r + 1 >= R.length) set({ r: R.length, picked: null, doneAsk: false, bad: false,
        log: (st.log || []).concat([{ ask: round.ok, did: noteOf() }]) });
      else nextRound();
    };
    return (
      <div className="box">
        <Done />
        <div className="lead now">{round.ask}</div>
        <div className="choices">
          {round.opts.map((a) => (
            <button key={a} className={"ch" + (picked === a ? (a === round.ok ? " right" : " wrong") : "")}
              onClick={() => pick(a)}>{a}</button>
          ))}
        </div>
        {st.bad && !doneAsk && (
          <>
            <div className="dhead ng">✕ 違います</div>
            <button className="next retry" onClick={again}>もう一度</button>
          </>
        )}
        {doneAsk && (
          <>
            <div className="lead now">{st.step2 ? "つぎは、同じ並びで、全部 1 にする" : round.todo}</div>
            {round.kind === "oct" ? (
              <>
                <div className="dots"><span className="d-lab">IP</span>
                  {q.board.ip.split(".").map((v, i) => (
                    <React.Fragment key={i}>{i > 0 && <span className="dot">.</span>}
                      <span className="num">{v}</span></React.Fragment>))}
                </div>
                <div className="dots"><span className="d-lab">マスク</span>
                  {maskStr(q.board.len).split(".").map((v, i) => (
                    <React.Fragment key={i}>{i > 0 && <span className="dot">.</span>}
                      <button className={"oct" + (st.oct === i ? " on" : "")}
                        onClick={() => set({ oct: i, bad: false })}>{v}</button></React.Fragment>))}
                </div>
              </>
            ) : (
              <>
                {/* 2の◯乗は、押すところの**上**に置く。どの桁を押すのかが見える。
                    **重み（128 64 …）は出さない** ＝ その数を思い出すのは自分の仕事 */}
                <div className="split">
                  <div className="sp-lab">2の</div>
                  <div className="sp-row">
                    {[7, 6, 5, 4, 3, 2, 1, 0].map((n) => <span key={n} className="sp-c fixed pw">{n}乗</span>)}
                  </div>
                </div>
                <div className="split">
                  <div className="sp-lab" />
                  <div className="row8 tight">
                    {W8.map((w) => (
                      <button key={w} className={"cell bare" + (bits & w ? " on" : "")}
                        onClick={() => set({ bits: bits & w ? bits - w : bits + w, bad: false })}>
                        <span className="c-v">{bits & w ? 1 : 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="out"><span className="o-n">この8つ ＝ <b>{sum}</b></span></div>
              </>
            )}
            {st.bad
              ? <>
                  <div className="dhead ng">✕ 違います</div>
                  <button className="next retry" onClick={again}>もう一度</button>
                </>
              : <button className="next" onClick={doIt}>次へ進む</button>}
          </>
        )}
      </div>
    );
  }

  if (q.station === "S2") {
    const bits = st.bits || 0;
    const W = [128, 64, 32, 16, 8, 4, 2, 1];
    return (
      <div className="box">
        {/* 先に電卓で引き算をして、その結果を下のマスに入れる。
            道具（電卓）が上、答えを書くところが下。手を動かす順番と画面の順番をそろえる */}
        <Calc value={st.calc} onChange={(c) => set({ calc: c })} />
        {/* 電卓の続きに見えないよう、間を空けて名前を付ける */}
        <div className="lead now">引けたところは <b>1</b>、引けなかったところは <b>0</b> にします。左から順に入れてください</div>
        {/* 重みは書かない。どの桁がいくつかは、自分の頭から出す */}
        <div className="row8 answ">
          {W.map((w) => (
            <button key={w} className={"cell bare" + (bits & w ? " on" : "")}
              onClick={() => !locked && set({ bits: bits & w ? bits - w : bits + w })}>
              <span className="c-v">{bits & w ? 1 : 0}</span>
            </button>
          ))}
        </div>
        <div className="out"><span className="o-n">いま <b>{W.map((w) => (bits & w ? 1 : 0)).join("")}</b></span></div>
        <button className="next" disabled={locked || !bits}
          onClick={() => onSubmit(W.map((w) => (bits & w ? 1 : 0)).join(""))}>これで決定</button>
      </div>
    );
  }

  return (
    <div className="box">
      {/* 4択の回は、どれも同じ道具立て。**本番の会場にあるものだけ**を置く。
          ・覚えた表 … 本番までに覚えるのは 2の◯乗とその答えの対応だけ。見えるが押せない
          ・メモ … 会場で渡される、書いて消せるボードの代わり。何を書いてもよい
          ・電卓 … 足し引きの答えを出すのは機械、どれを足すかを決めるのは人
          押せば答えが出る道具（0と1を押して入れる8マスなど）は、本番に無いので置かない */}
      <div className="sub">覚えた表（見ながら計算します）</div>
      <WeightTable />
      <div className="sub">メモ（使っても使わなくてもよい。採点しません）</div>
      <textarea className="scratch" rows="3" placeholder="ここに書けます"
        value={st.note || ""} onChange={(e) => !locked && set({ note: e.target.value })} />
      <Calc value={st.calc} onChange={(v) => !locked && set({ calc: v })} />
      <div className="choices">
        {(q.choices || [String(q.answer)]).map((c) => (
          <button key={c}
            className={"ch" + (st.pick === c ? " on" : "")
              // 答え合わせのあとだけ、正解を緑・押した外れを赤にする
              + (locked && c === String(q.answer) ? " right" : "")
              + (locked && st.pick === c && c !== String(q.answer) ? " wrong" : "")}
            onClick={() => !locked && set({ pick: c })}>
            <span>{c}</span>
            {locked && st.pick === c && c !== String(q.answer) && <i>あなたの回答</i>}
          </button>
        ))}
      </div>
      {/* 電卓を出すのは、足し引きが要る回だけ。使わない道具を置くと、押すものが増えて迷う */}
      <button className="next" onClick={() => onSubmit(st.pick)} disabled={locked || !st.pick}>これで決定</button>
    </div>
  );
}

/* =========================================================================
   結果
   ========================================================================= */
function Result({ res, plan, onHome, onAgain, onTest }) {
  const { correct, total, newly, newBest, bestMs, hadBest } = res;
  const need = needOf(plan.test, plan.station);
  const cleared = correct >= need;
  const st = byId(plan.station);
  const msg = !cleared ? `あと ${need - correct} 問。`
    : plan.test ? (newly ? "バッジをもらいました。" : "バッジはもう持っています。")
      : (newly ? "覚えました。つぎはテストです。" : "覚えたまま保てています。");
  return (
    <div className={"wrap result" + (newly ? " flash" : "")}>
      <div className="rtitle">{st.no}　{st.name}</div>
      <div className={"rscore" + (cleared ? " ok" : "")}>{correct}<span>/{total}</span></div>
      {/* テストに合格したら、大きく1つ。祝うのはここだけ（毎問は祝わない） */}
      {plan.test && cleared && <div className="rbadge">🏅</div>}
      <div className="rmsg">{msg}</div>
      {/* 初めてできたときだけ。毎回出すと読まれなくなる */}
      {newly && NEXT[plan.station] && <div className="rnext">{NEXT[plan.station]}</div>}
      {/* 練習ができた直後は、そのままテストに行けるようにする。
          ホームに戻って切り替えを押し直させると、その一手間で足が止まる */}
      {/* 練習のあとは、そのままテストへ行けるようにする。どのステージでも同じ。
          ホームに戻って札を開き直させると、その一手間で足が止まる */}
      {!plan.test ? (
        <>
          {/* **合格していないうちはテストを出さない。**トップでも閉じているので、
              ここだけ素通りできると、決まりがこの1か所で破れる */}
          {cleared
            ? <button className="next" onClick={onTest}>テストをする</button>
            : <button className="next" onClick={onAgain}>もう一度 練習する</button>}
          {cleared && <button className="mini" onClick={onAgain}>もう一度 練習する</button>}
          <button className="mini" onClick={onHome}>トップ画面に戻る</button>
        </>
      ) : (
        <>
          <button className="next" onClick={cleared ? onHome : onAgain}>{cleared ? "トップ画面に戻る" : "もう一度"}</button>
          <button className="mini" onClick={cleared ? onAgain : onHome}>
            {cleared ? "同じステージをもう一度" : "トップ画面に戻る"}
          </button>
        </>
      )}
    </div>
  );
}

/* =========================================================================
   全体
   ========================================================================= */
export default function App() {
  const [progress, setProgress] = useState(load);
  const [screen, setScreen] = useState("home");
  const [plan, setPlan] = useState(null);
  const [res, setRes] = useState(null);
  const [runId, setRunId] = useState(0);
  const [unlock, setUnlock] = useState(loadUnlock); // お試しで全部開ける
  const [sheetOf, setSheetOf] = useState(null);     // いま開いている練習の1枚
  const homeY = useRef(0);

  useEffect(() => { toTop(screen === "home" ? homeY.current : 0); }, [screen, runId]);

  const start = (station, test) => {
    if (screen === "home") homeY.current = window.scrollY;
    // 練習は、まず説明の1枚から。そこから暗記ドリルかテストへ行く
    if (test == null) { setSheetOf(station); setScreen("memo"); return; }
    if (test === "drill") { setSheetOf(station); setScreen("drill"); return; }
    const first = !progress[station];         // そのステージが初めてか
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
      const kind = order ? order[i]
        : (test && station === "S0" && i === 0) ? "table" : null;
      const ease = test ? i / (n - 1) : 0;
      let q2 = makeQuestion(station, ease, test, kind, steps);
      for (let k = 0; k < 40 && seen.has(keyOf(q2)); k++) q2 = makeQuestion(station, ease, test, kind, steps);
      seen.add(keyOf(q2));
      queue.push({ q: q2, scored: true });
    }
    setPlan({ station, test, first, queue });
    setRes(null); setRunId(runId + 1); setScreen("play");
  };

  const done = (results, quit) => {
    const next = { ...progress };
    for (const r of results) {
      const cur = next[r.station] || { seen: 0, correct: 0, lit: false, solo: false };
      next[r.station] = { ...cur, seen: cur.seen + 1, correct: cur.correct + (r.ok ? 1 : 0) };
    }
    const scored = results.filter((r) => r.scored);
    const correct = scored.filter((r) => r.ok).length;
    const oks = scored.filter((r) => r.ok);
    const avgMs = oks.length ? Math.round(oks.reduce((a, r) => a + r.ms, 0) / oks.length) : null;
    let newly = false, newBest = false, hadBest = false;

    if (!quit) {
      const cur = next[plan.station];
      const need = needOf(plan.test, plan.station);
      if (correct >= need) {
        if (plan.test) { newly = !cur.solo; next[plan.station] = { ...cur, lit: true, solo: true }; }
        else { newly = !cur.lit; next[plan.station] = { ...cur, lit: true }; }
      }
      if (correct >= need && avgMs != null) {
        // 表ありと表なしでは速さが比べものにならないので、記録は別に持つ
        const k = plan.test ? "testBestMs" : "bestMs";
        const prev = cur[k];
        hadBest = prev != null;
        newBest = prev == null || avgMs < prev;
        next[plan.station] = { ...next[plan.station], lastMs: avgMs, [k]: newBest ? avgMs : prev };
      }
    }
    setProgress(next); save(next);
    if (quit) { setScreen("home"); return; }
    const k = plan.test ? "testBestMs" : "bestMs";
    setRes({ correct, total: scored.length, newly, newBest, hadBest, bestMs: (next[plan.station] || {})[k] });
    setScreen("result");
  };

  return (
    <>
      <style>{CSS}</style>
      {screen === "home" && (
        <Home progress={progress} unlock={unlock}
          onUnlock={(u) => { setUnlock(u); saveUnlock(u); }} onStart={start} />
      )}
      {screen === "memo" && sheetOf && (
        <Memo key={sheetOf} station={sheetOf}
          onDrill={() => start(sheetOf, false)} onTest={() => start(sheetOf, true)}
          onHome={() => setScreen("home")} />
      )}
      {screen === "play" && plan && (
        <Play key={runId} plan={plan} onDone={(rs) => done(rs, false)} onQuit={(rs) => done(rs, true)} />
      )}
      {screen === "result" && res && (
        <Result res={res} plan={plan} onHome={() => setScreen("home")}
          onAgain={() => start(plan.station, plan.test)} onTest={() => start(plan.station, true)} />
      )}
    </>
  );
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
.t-h{display:flex;align-items:center;gap:12px;width:100%;text-align:left;min-height:48px}
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
