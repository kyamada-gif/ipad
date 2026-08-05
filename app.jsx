import React, { useState, useEffect, useRef, useMemo } from "react";

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

const DRILL_QN = 5;     // 練習は5問（手を動かして慣れる場）
const TEST_QN = 10;     // テストは10問（本番と同じ形で測る場）
const DRILL_N = 4;      // 練習：5問中4問で ● できた
const CLEAR_N = 9;      // テスト：10問中9問で ★ バッジ
/** その回の問題数と合格ライン。練習は5問中4問、テストは10問中9問。 */
const sizeOf = (test) => (test ? TEST_QN : DRILL_QN);
/** その回の合格ライン。練習は8割、テストは9割。 */
const needOf = (test) => (test ? CLEAR_N : DRILL_N);

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
/** カードを混ぜる。順番で覚えてしまわないように */
const shuffleCards = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
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
  const doneP = STATIONS.filter((s) => isLit(progress, s.id)).length;
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
          const solo = isSolo(progress, s.id), lit = isLit(progress, s.id);
          const open = unlock || isOpen(progress, s);
          // テストは、練習でできてから。手順を知らないまま4択をやっても、
          // 4回に1回当たるだけで記録が汚れる
          const canTest = unlock || lit;
          return (
            <div key={s.id}>
              {i > 0 && <div className="link" />}
              {/* はじめは札だけ。押した札にだけ、2つのボタンが出る。
                  7ステージぶん14個のボタンが最初から並んでいると、どこを見ればいいのか分からなくなる */}
              <div className={"tile" + (open ? "" : " locked") + (lit ? " lit" : "") + (solo ? " solo" : "")
                + (pick === s.id ? " pick" : "")}>
                <button className="t-h" onClick={() => { setPick(pick === s.id ? null : s.id); setBlocked(null); }}>
                  <span className="lamp">{open ? (solo ? "🏅" : lit ? "●" : "○") : "🔒"}</span>
                  <span className="t-b">
                    <span className="t-name">{s.no}　{s.name}</span>
                    <span className="t-ex">{s.ex}</span>
                  </span>
                </button>
                {pick === s.id && open && (
                  <div className="t-go">
                    <button className="go" onClick={() => onStart(s.id, null)}>練習する</button>
                    <button className={"go" + (canTest ? "" : " off")}
                      onClick={() => (canTest ? onStart(s.id, true) : setBlocked(blocked === s.id ? null : s.id))}>
                      テストをする
                    </button>
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
        {unlock ? "鍵をかけ直す" : "ぜんぶ開く（お試し）"}
      </button>
    </div>
  );
}

/* =========================================================================
   練習
   ========================================================================= */
function Play({ plan, onDone, onQuit }) {
  const [queue, setQueue] = useState(plan.queue);
  const [idx, setIdx] = useState(0);
  const [judged, setJudged] = useState(null);
  const [val, setVal] = useState(null);      // 盤の状態。盤ごとに形がちがう
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
    if (judged === false && why.current) {
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
    <div className={"wrap play" + (judged === null ? "" : judged ? " lit-ok" : " lit-ng")}>
      <div className="topbar">
        <button className="x" onClick={() => onQuit(results)}>✕</button>
        <div className="pbar"><div className="pbar-in" style={{ width: (doneScored / scored) * 100 + "%" }} /></div>
        <div className="pnum">{Math.min(doneScored + (item.scored ? 1 : 0), scored)}/{scored}</div>
      </div>

      {/* いちばん上に、**今回あつかう数**をそのままの形で置く。
          盤の中では列ごとにばらけるので、ここが「問いが何を指しているか」の拠りどころになる */}
      <div className="given">
        {q.given.map((g, i) => (
          <div key={i} className="grow"><span className="gk">{g.k}</span>
            {/* 目を向けてほしい桁に下線を引く。表なしの回は引かない（自分で見つけるところ） */}
            {/* 下線は「ここを見てほしい」の印。
                q.underline … その字だけ（1ステージの 1）　g.u … 何文字目か（2の◯乗の ◯） */}
            <span className={"gv" + (g.u != null ? " big" : "")}>
              {g.u != null || (q.underline && !plan.test)
                ? String(g.v).split("").map((c, j) => (
                  <span key={j} className={g.u != null ? (j === g.u ? "u" : "") : (c === q.underline ? "u" : "")}>{c}</span>))
                : g.v}</span>
          </div>
        ))}
      </div>
      <div className="prompt">{q.prompt}</div>

      {plan.test && <div className="testnote">覚えた表を思い出して答えます</div>}

      {plan.test ? <TestBoard {...board} />
        : q.input === "pow" ? <PowBoard {...board} />
        : q.input === "mask" ? <MaskBoard {...board} />
        : q.input === "sum" ? <SumBoard {...board} />
        : q.input === "sub" ? <SubBoard {...board} />
          : q.input === "split" ? <SplitBoard {...board} />
            : q.input === "pick" ? <PickBoard {...board} />
              : <StackBoard {...board} />}

      {judged === false && (
        <div className="why" ref={why}>
          <div className="why-h">こう解く</div>
          {q.steps.map((s, i) => (
            <div key={i} className="step">
              <span className="step-n">{i + 1}</span>
              <span className="step-t">{s.t}</span>
              <span className="step-v">{s.v}</span>
            </div>
          ))}
        </div>
      )}


      {/* ── 答え合わせの帯 ──────────────────────────────────
          いちばん下に貼り付ける。決定ボタンを押した直後、目も指も画面の下にあるので
          必ず目に入る。前は本文の流れの中に出していたので、スマホでは画面の外に落ちていた。
          色だけに頼らず ✓✕ の形も出す（色の見え方は人によって違う）。 */}
      {judged !== null && (
        <div className={"judge" + (judged ? " ok" : " ng") + (judged ? "" : " shake")}>
          <div className="j-in">
            <div className="j-head">
              <span className="j-mark">{judged ? "✓" : "✕"}</span>
              <span className="j-word">{judged ? "正解" : "不正解"}</span>
            </div>
            {!judged && <div className="j-ans">答えは <b>{String(q.answer)}</b></div>}
            {judged && q.tip && <div className="j-tip">💡 {q.tip}</div>}
            {judged ? <button className="next" onClick={() => next(results)}>次へ</button>
              : <button className="next" onClick={retry}>もう一度</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 暗記ドリル（練習）───────────────────────────────────
   **導出ではなく想起。**盤も電卓も出さない。合図を1つ大きく出して、
   同じ集合・同じ並びから選ばせる。場所の記憶が思い出す助けになる。
   1周目は表を見てよい。2周目からは表を畳む。
   間違えたカードは山に戻る。**全部を表なしで即答できたら終わり。** */
function Drill({ station, onDone, onHome }) {
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
    const k = cards.findIndex((c) => c.q === card.q);
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

  const pick = (a) => {
    if (judged !== null || !card) return;
    setJudged({ good: a === card.a, picked: a });
    buzz(a === card.a ? 30 : 60);
  };
  // 自動では進まない。**必ず答え合わせを挟む**（読む間を機械が奪わない）
  const go = () => {
    if (!judged) return;
    if (judged.good) { setJudged(null); if (i + 1 >= pile.length) onDone(); else setI(i + 1); }
    else setJudged(null);   // 正解するまで、同じ問題から進まない
  };

  if (!card) return null;
  const done = i;   // 正解したぶんだけ進む
  return (
    <div className="wrap drill">
      <div className="topbar">
        <button className="x" onClick={onHome}>✕</button>
        <div className="pbar"><div className="pbar-in" style={{ width: (done / cards.length) * 100 + "%" }} /></div>
        <div className="pnum">{done}/{cards.length}</div>
      </div>
      <div className="dcard">{card.q}</div>
      {/* 答え合わせのあとも、選択肢はそのまま残す。
          正解がどれで、自分がどれを押したのかを、同じ場所で見せる */}
      <div className={"dopts" + (judged && !judged.good ? " shake" : "")}>
        {opts.map((a) => (
          <button key={a}
            className={"dopt" + (judged && a === card.a ? " right" : "")
              + (judged && judged.picked === a && a !== card.a ? " ng" : "")}
            onClick={() => pick(a)}>
            <span>{a}</span>
            {judged && judged.picked === a && a !== card.a && <i>あなたの答え</i>}
          </button>
        ))}
      </div>
      {judged && (
        <>
          <div className={"dhead " + (judged.good ? "ok" : "ng")}>{judged.good ? "✓ 正解" : "✕ 不正解"}</div>
          <div className="dwhy">{card.w}</div>
          <button className="next" onClick={go}>{judged.good ? "次へ" : "もう一度"}</button>
        </>
      )}
    </div>
  );
}

/* ── 説明の1枚 ────────────────────────
   ここだけは問題を出さない。**すべての土台なので、まず覚える時間**にする。
   見終わったら、その場から「テストをする」へ行ける。 */
function Memo({ station, onDrill, onTest, onHome }) {
  const st = byId(station);
  // **文章で読ませず、手を動かして覚える。**教材の手順そのものを、盤で1段ずつたどる
  const [q, setQ] = useState(() => makeQuestion(station, 0.6, false));
  const [val, setVal] = useState(null);
  const [judged, setJudged] = useState(null);
  const again = () => { setQ(makeQuestion(station, 0.6, false)); setVal(null); setJudged(null); };
  const answer = (out) => { if (judged === null) { const ok = String(out) === String(q.answer); setJudged(ok); buzz(ok ? 30 : 60); } };
  useEffect(() => { if (window.__debug) window.__q = q; }, [q]);
  const board = { q, value: val, onChange: setVal, locked: judged !== null, onSubmit: answer };
  return (
    <div className="wrap sheet-p">
      <div className="topbar"><button className="x" onClick={onHome}>✕</button></div>
      <div className="mtitle">{st.no}　{st.name}</div>
      {/* 前のステージで覚えた何を、ここでそのまま使うのか。必ず通る場所に1行だけ */}
      {LINK[station] && <div className="link1">{LINK[station]}</div>}

      {/* 言葉は1行だけ。あとは**そのステージで覚えるもの**を見て、そのまま覚える */}
      <div className="how">{HOW[station]}</div>
      {/* ここがチュートリアル。読むのではなく、1問を最後まで手で解く */}
      <div className="prompt">{q.prompt}</div>
      <div className="given">
        {q.given.map((g, i) => (
          <div key={i} className="grow"><span className="gk">{g.k}</span><span className="gv">{g.v}</span></div>
        ))}
      </div>
      {q.input === "pow" ? <PowBoard {...board} />
        : q.input === "mask" ? <MaskBoard {...board} />
        : q.input === "sum" ? <SumBoard {...board} />
        : q.input === "sub" ? <SubBoard {...board} />
        : q.input === "split" ? <SplitBoard {...board} />
        : q.input === "pick" ? <PickBoard {...board} />
        : q.input === "wild" ? <WildBoard {...board} />
        : <StackBoard {...board} />}
      {judged !== null && (
        <>
          <div className={"dhead " + (judged ? "ok" : "ng")}>{judged ? "✓ 正解" : "✕ 不正解"}</div>
          {!judged && <div className="dwhy">答えは {String(q.answer)}</div>}
          <button className="next" onClick={again}>{judged ? "べつの数でもう一度" : "もう一度"}</button>
        </>
      )}

      {CARDS[station] && (
        <div className="dtable">
          {CARDS[station].map((c, j) => (
            <div key={j} className="dtr"><span>{c.q}</span><b>{c.a}</b></div>
          ))}
        </div>
      )}
      {EXLINE[station] && <div className="exline">{EXLINE[station]}</div>}
      {/* 覚える表が無いステージは、解いた跡を1つ見せる（文章を足さずに、例で見せる） */}
      {!CARDS[station] && EXAMPLES[station] && (
        <div className="dtable">
          {EXAMPLES[station].rows.map((r, j) => (
            <div key={j} className="dtr"><span>{r[0]}</span><b>{r[1]}</b></div>
          ))}
        </div>
      )}

      {/* 入口は、いつも画面のいちばん下に貼り付いている。
          練習＝よく出るやつを反射で覚える／テスト＝本番と同じ形で演習 */}
      {/* 覚える表があるステージだけ「覚える」を出す。無いステージに中間の段を作らない */}
      <div className="gotest two">
        <button className="next" onClick={onDrill}>練習をする</button>
        <button className="next ghost" onClick={onTest}>テストをする</button>
      </div>
    </div>
  );
}

/* ── 盤 ワイルドカードマスク ────────────────────────────
   255 から引くだけ。4つの数を、左から順に自分で出す。 */
function WildBoard({ q, value, onChange, locked, onSubmit }) {
  const m = maskStr(q.board.len).split(".").map(Number);
  const got = value || [null, null, null, null];
  const set = (i, v) => { if (locked) return; const n = got.slice(); n[i] = v; onChange(n); };
  const done = got.every((v) => v != null);
  return (
    <div className="box">
      <div className="lead">① <b>255 から引く</b>。左から順に</div>
      {m.map((v, i) => (
        <div key={i} className="split">
          <div className="sp-lab">255 − {v}</div>
          <div className="sp-row w9">
            {[0, 1, 3, 7, 15, 31, 63, 127, 255].map((x) => (
              <button key={x} className={"sp-c" + (got[i] === x ? " on" : "")}
                onClick={() => set(i, x)}>{x}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="derive">
        <div className="d-r ans"><span>ワイルドカードマスク</span><b>{done ? got.join(".") : "—"}</b></div>
      </div>
      <button className="next" onClick={() => onSubmit(got.join("."))} disabled={locked || !done}>これで決定</button>
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
  return (
    <div className="box">
      <div className="point">ポイント　となりへ行くたびに <b>2倍</b></div>
      <div className="split">
        <div className="sp-lab">2の</div>
        <div className="sp-row">
          {rows.map((n) => (
            <button key={n} className={"sp-c" + (sel === n ? " on" : "")}
              onClick={() => !locked && onChange(n)}>{n}乗</button>
          ))}
        </div>
        <div className="sp-lab" />
        <div className="sp-row">
          {rows.map((n) => (
            <button key={n} className={"sp-c big2" + (sel === n ? " on" : "")}
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
      <div className="point">ポイント　<b>下線の桁を押す</b>。押した数を合計すると10進数に直せる</div>
      <div className="split">
        <div className="sp-lab">押す</div>
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
        <span className="o-x">{on.length ? on.join(" + ") : "まだ押していません"}</span>
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
      <div className="point">ポイント　<b>左から順に</b>。残りから引けるなら押す。引けなければ次へ</div>
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
        <span className="o-x">{on.length ? on.map((w) => `−${w}`).join(" ") : "まだ押していません"}</span>
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

/* ── 盤 マスク（/ の数 ↔ マスク） ─────────────────────────
   /28 は「1 が28個ならぶ」という意味。だから
     ① 8個ずつ 255 にしていく（左から）
     ② あまりを、上の桁から 1 にする
   盤の上に「/いくつ」と「マスク」の両方が出る。
   どちらを聞かれても、同じ手つきで答えられる。 */
function MaskBoard({ q, value, onChange, locked, onSubmit }) {
  const st = value || { full: 0, bits: 0 };
  const full = st.full || 0, bits = st.bits || 0;
  const set = (x) => !locked && onChange({ ...st, ...x });
  const d = maskBoardOut(full, bits, q.goal);       // 計算は gen.js に任せる
  const rest = q.goal === "toMask" ? q.board.len - full * 8 : null;

  return (
    <div className="box">
      {/* 8・16・24・32 の目盛りを下に置く。/28 なら 24 と 32 の間 ＝ 255 が3つ、が目で分かる */}
      <div className="lead">① <b>8 ずつ</b> 区切る</div>
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
        <span className="d-lab" />
        {[8, 16, 24, 32].map((t, i) => (
          <React.Fragment key={t}>
            {i > 0 && <span className="dot"> </span>}
            <span className="tick">{t}</span>
          </React.Fragment>
        ))}
      </div>

      {full < 4 && (
        <>
          <div className="lead">② 残り{rest != null && rest > 0 ? <> <b>{rest} 個</b></> : null}を 1 にする</div>
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
            <div className="sp-lab" />
            <div className="sp-row w">{W8.map((w) => <span key={w} className="sp-w">{w}</span>)}</div>
          </div>
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
     ③ いちばん右の 1 のうしろに線が出る
     ④ 線から右を **ぜんぶ 0** にすると、いちばん小さい数
        線から右を **ぜんぶ 1** にすると、いちばん大きい数
   名前（ネットワークアドレス・ブロードキャストアドレス）は**最後に**出す。
   先に名前を出しても、何のことか分からないまま操作することになる。 */
function SplitBoard({ q, value, onChange, locked, onSubmit }) {
  const { ip, len } = q.board;
  const parts = ip.split(".").map(Number);
  const mask = maskStr(len).split(".").map(Number);
  const st = value || { oct: null, bits: 0, zero: false, one: false };
  const oct = st.oct, bits = st.bits || 0;
  const set = (x) => !locked && onChange({ ...st, ...x });
  const givenMask = q.given.some((g) => g.k === "サブネットマスク");

  // 線は「いちばん右の 1 のうしろ」。自分で作った 1 と 0 から決まる
  const bs = W8.map((w) => (bits & w ? 1 : 0));
  const cut = bs.lastIndexOf(1) + 1;
  const ipBits = oct == null ? [] : bin8(parts[oct]).split("").map(Number);

  // 計算は gen.js の splitOut に任せる（画面と検算で同じ関数を使う）
  const d = (oct != null && cut > 0) ? splitOut(ip, oct, cut, q.goal) : null;
  const out = (myNet && myBc) ? pairOut(myNet, myBc, q.goal) : "";
  // 押した 1 と 0 から、そのまま住所にする。計算は gen.js の addrWith
  const keep = oct == null ? 0 : ipBits.slice(0, cut).reduce((a2, c, i) => a2 + (c ? W8[i] : 0), 0);
  const myNet = oct == null ? null : addrWith(ip, oct, keep + (st.zb || 0));
  const myBc = oct == null ? null : addrWith(ip, oct, keep + (st.ob || 0));
  const ready = d && st.zero && st.one;

  return (
    <div className="box">
      {/* はじめに出すのは、見出しと**押せるマスクの行だけ**。
          IP の行は③に進むまで意味を持たないので、そこまで出さない */}
      <div className="lead">① サブネットマスクを左から見て、<b>255 でない数</b>を押す</div>
      <div className="dots">
        <span className="d-lab">サブネット<br />マスク</span>
        {mask.map((m, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="dot">.</span>}
            <button className={"oct" + (oct === i ? " on" : "")}
              onClick={() => set({ oct: i, bits: 0, zero: false, one: false })}>{m}</button>
          </React.Fragment>
        ))}
      </div>
      {!givenMask && <div className="sub">/{len} → {maskStr(len)}（{byId("S8").no}つ目のステージでやったところ）</div>}

      {oct != null && (
        <>
          {/* 255 でないところを見つけたら、IP の同じところも一緒に見る。
              マスクと IP を離して置くと、同じ場所の話だと分からなくなる */}
          <div className="dots">
            <span className="d-lab">IPアドレス</span>
            {parts.map((v, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="dot">.</span>}
                <span className={"num" + (oct === i ? " on" : "")}>{v}</span>
              </React.Fragment>
            ))}
          </div>

          {/* マスクを 1 と 0 にするのは自分。IP の 1 と 0 は、その真下に並べて出す */}
          <div className="lead">② <b>{mask[oct]}</b> を 1 と 0 にする</div>
          <div className="split">
            <div className="sp-lab">サブネット<i>{W8.reduce((a, w) => a + (bits & w ? w : 0), 0)}</i></div>
            <div className="sp-row">
              {W8.map((w, i) => (
                <button key={w} className={"sp-c" + (bits & w ? " on" : "") + (cut === i + 1 ? " edge" : "")}
                  onClick={() => set({ bits: bits & w ? bits - w : bits + w, zero: false, one: false })}>
                  {bits & w ? 1 : 0}
                </button>
              ))}
            </div>
            <div className="sp-lab">IP<i>{parts[oct]}</i></div>
            <div className="sp-row">
              {ipBits.map((c, i) => (
                <span key={i} className={"sp-c fixed" + (cut === i + 1 ? " edge" : "")}>{c}</span>
              ))}
            </div>
            <div className="sp-lab" />
            <div className="sp-row w">{W8.map((w) => <span key={w} className="sp-w">{w}</span>)}</div>
          </div>

          {cut > 0 && (
            <>
              <div className="lead">③ IPアドレスの <b>線から右</b>を、ぜんぶ 0 と ぜんぶ 1 にする</div>
              <div className="split">
                {/* **自分で入力する。**線から左はそのまま、右を自分で 0 と 1 にする。
                    機械が埋めると、そこだけ手が動かないまま通ってしまう */}
                <div className="sp-lab">ぜんぶ 0</div>
                <div className="sp-row">
                  {ipBits.map((c, i) => (
                    i < cut
                      ? <span key={i} className={"sp-c fixed" + (cut === i + 1 ? " edge" : "")}>{c}</span>
                      : <button key={i} className={"sp-c" + ((st.zb || 0) & W8[i] ? " on" : "")}
                          onClick={() => set({ zb: (st.zb || 0) ^ W8[i], zero: true })}>{(st.zb || 0) & W8[i] ? 1 : 0}</button>
                  ))}
                </div>
                <div className="sp-lab">ぜんぶ 1</div>
                <div className="sp-row">
                  {ipBits.map((c, i) => (
                    i < cut
                      ? <span key={i} className={"sp-c fixed" + (cut === i + 1 ? " edge" : "")}>{c}</span>
                      : <button key={i} className={"sp-c" + ((st.ob || 0) & W8[i] ? " on" : "")}
                          onClick={() => set({ ob: (st.ob || 0) ^ W8[i], one: true })}>{(st.ob || 0) & W8[i] ? 1 : 0}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {(st.zero || st.one) && (
            <div className="derive">
              {st.zero && <div className="d-r"><span>ぜんぶ 0 にすると</span><b>{myNet}</b></div>}
              {st.one && <div className="d-r"><span>ぜんぶ 1 にすると</span><b>{myBc}</b></div>}
              {/* ＋1／−1 は形で見せる。テストの外れの選択肢に「±1 を忘れた」が入っている */}
              {ready && q.goal === "range" && (
                <>
                  <div className="d-r"><span>{myNet} は使えない　＋1</span><b>{out.split(" 〜 ")[0]}</b></div>
                  <div className="d-r"><span>{myBc} は使えない　−1</span><b>{out.split(" 〜 ")[1]}</b></div>
                  <div className="d-r ans"><span>答え</span><b>{out}</b></div>
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
function PickBoard({ q, value, onChange, locked, onSubmit }) {
  const w = value;
  const d = w == null ? null : pickOut(w, q.goal, q.base);   // 計算は gen.js に任せる
  const bits = d ? d.bits : null;
  const out = (myNet && myBc) ? pairOut(myNet, myBc, q.goal) : "";
  const cell = (x) => (
    <button key={x} className={"cell wide" + (w === x ? " on" : "")}
      onClick={() => !locked && onChange(x)}>
      <span className={"c-w2" + (String(x).length >= 5 ? " sm" : "")}>{x}</span>
    </button>
  );
  return (
    <div className="box">
      {q.goal === "host" && (
        <div className="lead">ネットワークアドレスとブロードキャストアドレスのぶんで ＋2　<b>{q.need} + 2 = {q.want}</b></div>
      )}
      {/* やり方（右から順に見て…）ではなく、めざす形を1行だけ。
          「入るいちばん小さい箱」は、説明しなくても分かる */}
      <div className="lead"><b>{q.want}</b> が入る、いちばん小さいところを押す</div>
      {/* 縦に2段あるのが何なのかを、名札で言う。
          台数の段は 128〜1 がアドレスの4つ目、256〜32768 が3つ目にあたる。
          サブネットの数の段は場所ではなく「いくつ作れるか」なので、言い方を変える */}
      <div className="point">{q.goal === "host"
        ? "下の段は、いつもの 128〜1 の表（アドレスの4つ目）。上の段は、そのひとつ左"
        : "数が大きいほど、たくさん分けられる"}</div>
      <div className="split">
        <div className="sp-lab">{q.goal === "host" ? "3つ目" : "上の段"}</div>
        <div className="row8 tight">{W16.map(cell)}</div>
        <div className="sp-lab">{q.goal === "host" ? "4つ目" : "下の段"}</div>
        <div className="row8 tight">{W8.map(cell)}</div>
      </div>
      {w != null && (
        <div className="derive">
          <div className="d-r"><span>押したところ</span><b>{w}</b></div>
          <div className="d-r"><span>{q.goal === "host" ? "ホスト部" : "サブネットに使う"}</span><b>{bits} 桁</b></div>
          {q.goal === "subnet" && <div className="d-r"><span>/{q.base} から {bits} 桁 のばす</span><b>/{q.base} + {bits}</b></div>}
          <div className="d-r ans"><span>答え</span><b>{out}</b></div>
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
      <div className="lead">① 4つを見くらべて、<b>違っているところ</b>を押す</div>
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
          <div className="lead">② 縦に見て、<b>4つとも同じ</b>ところまで押す</div>
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
              <div className="d-r"><span>同じなのは</span><b>上から {oc * 8 + cut} 桁ぶん</b></div>
              <div className="d-r ans"><span>答え</span><b>{out}</b></div>
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
   だから2回目は**桁の重みの表を出さない。**問いと、自分で計算する場所だけ。

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
        <Calc plain={q.station === "S0"} value={st.calc} onChange={(c) => set({ calc: c })} />
        <button className="next" onClick={() => onSubmit(v)} disabled={locked || !st.calc}>
          {v} で決定
        </button>
      </div>
    );
  }

  if (q.station === "S2") {
    const bits = st.bits || 0;
    const W = [128, 64, 32, 16, 8, 4, 2, 1];
    return (
      <div className="box">
        {/* 重みは書かない。どの桁がいくつかは、自分の頭から出す */}
        <div className="row8">
          {W.map((w) => (
            <button key={w} className={"cell bare" + (bits & w ? " on" : "")}
              onClick={() => !locked && set({ bits: bits & w ? bits - w : bits + w })}>
              <span className="c-v">{bits & w ? 1 : 0}</span>
            </button>
          ))}
        </div>
        <div className="out"><span className="o-n">いま <b>{W.map((w) => (bits & w ? 1 : 0)).join("")}</b></span></div>
        <Calc value={st.calc} onChange={(c) => set({ calc: c })} />
        <button className="next" disabled={locked || !bits}
          onClick={() => onSubmit(W.map((w) => (bits & w ? 1 : 0)).join(""))}>これで決定</button>
      </div>
    );
  }

  return (
    <div className="box">
      <div className="choices">
        {(q.choices || [String(q.answer)]).map((c) => (
          <button key={c}
            className={"ch" + (st.pick === c ? " on" : "")
              // 答え合わせのあとだけ、正解を緑・押した外れを赤にする
              + (locked && c === String(q.answer) ? " right" : "")
              + (locked && st.pick === c && c !== String(q.answer) ? " wrong" : "")}
            onClick={() => !locked && set({ pick: c })}>{c}</button>
        ))}
      </div>
      {/* 選ぶだけの回に電卓は要らない。使わない道具を置くと、押すものが増えて迷う */}
      <button className="next" onClick={() => onSubmit(st.pick)} disabled={locked || !st.pick}>これで決定</button>
    </div>
  );
}

/* =========================================================================
   結果
   ========================================================================= */
function Result({ res, plan, onHome, onAgain, onTest }) {
  const { correct, total, newly, newBest, bestMs, hadBest } = res;
  const need = needOf(plan.test);
  const cleared = correct >= need;
  const st = byId(plan.station);
  const msg = !cleared ? `あと ${need - correct} 問。`
    : plan.test ? (newly ? "バッジをもらいました。" : "バッジはもう持っています。この速さを保ちましょう。")
      : (newly ? "覚えました。つぎはテストです。" : "覚えたまま保てています。");
  return (
    <div className={"wrap result" + (newly ? " flash" : "")}>
      <div className="rtitle">{st.no}　{st.name}</div>
      <div className={"rscore" + (cleared ? " ok" : "")}>{correct}<span>/{total}</span></div>
      {/* テストに合格したら、大きく1つ。祝うのはここだけ（毎問は祝わない） */}
      {plan.test && cleared && <div className="rbadge">🏅</div>}
      <div className="rmsg">{msg}</div>
      {/* はじめてできたときだけ。毎回出すと読まれなくなる */}
      {newly && NEXT[plan.station] && <div className="rnext">{NEXT[plan.station]}</div>}
      {/* 練習ができた直後は、そのままテストに行けるようにする。
          ホームに戻って切り替えを押し直させると、その一手間で足が止まる */}
      {/* 練習のあとは、そのままテストへ行けるようにする。どのステージでも同じ。
          ホームに戻って札を開き直させると、その一手間で足が止まる */}
      {!plan.test ? (
        <>
          <button className="next" onClick={onTest}>テストをする</button>
          <button className="mini" onClick={onAgain}>もう一度 練習する</button>
          <button className="mini" onClick={onHome}>ホームへ</button>
        </>
      ) : (
        <>
          <button className="next" onClick={cleared ? onHome : onAgain}>{cleared ? "つづける" : "もう一度"}</button>
          <button className="mini" onClick={cleared ? onAgain : onHome}>
            {cleared ? "同じステージをもう一度" : "ホームへ"}
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
    // 覚える表が無いステージは、説明を見た時点で練習ぶんを済みにする（中間の段を作らない）
    if (test && !CARDS[station] && !isLit(progress, station)) {
      const cur = progress[station] || { seen: 0, correct: 0, lit: false, solo: false };
      const nx = { ...progress, [station]: { ...cur, lit: true } };
      setProgress(nx); save(nx);
    }
    const first = !progress[station];         // そのステージが初めてか
    const queue = [];
    const n = sizeOf(test);
    for (let i = 0; i < n; i++) {
      // 練習は**よく出るやつだけ**を繰り返す（反射で出るようにするため）。
      // テストは本番どおりの出方（前半はやさしく、後半は実際の割合で）
      queue.push({ q: makeQuestion(station, test ? i / (n - 1) : 0, test), scored: true });
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
      const need = needOf(plan.test);
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
      {screen === "drill" && sheetOf && (
        <Drill key={sheetOf} station={sheetOf} onHome={() => setScreen("home")}
          onDone={() => {
            // 表なしで全部言えたら、覚えたことにする
            const cur = progress[sheetOf] || { seen: 0, correct: 0, lit: false, solo: false };
            const next = { ...progress, [sheetOf]: { ...cur, lit: true } };
            setProgress(next); save(next);
            setSheetOf(sheetOf); setScreen("memo");
          }} />
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
