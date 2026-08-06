// 10ステージぶん、チュートリアルの盤が描けるか（例外が出ないか）と、
// **段の骨組みが10ステージで同じか**を見る
const path=require("path"),fs=require("fs");
const R=path.join(__dirname, "..");
const {JSDOM}=require(path.join(R,".check/node_modules/jsdom"));
const {STATIONS,FIGURE}=require(path.join(R,"gen.js"));
const B=["vendor/react.production.min.js","vendor/react-dom.production.min.js","gen.js","app.js"].map(f=>fs.readFileSync(path.join(R,f),"utf8")).join("\n");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let ng=0;
  for (const st of STATIONS) {
    const prog={}; for(const s2 of STATIONS) prog[s2.id]={seen:10,correct:10,lit:true,solo:true};
    const d=new JSDOM(fs.readFileSync(path.join(R,"index.html"),"utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
    const w=d.window; w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}}); w.scrollTo=()=>{}; w.navigator.vibrate=()=>{};
    w.Element.prototype.scrollIntoView=function(){}; w.__debug=true;
    w.localStorage.setItem("ipcalc2-progress",JSON.stringify(prog));
    const errs=[]; w.addEventListener("error",e=>errs.push(String(e.message)));
    w.eval(B); await wait(120);
    const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
    const click=e=>e&&e.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
    const tile=$$(".tile").find(t=>t.textContent.includes(st.name));
    click(tile.querySelector(".t-h")); await wait(60);
    click(tile.querySelector(".go")); await wait(120);
    // 説明の1枚が出ているか。盤（.box）があるのは「やってみる」がある回だけ
    const drill = st.drill !== false;
    const okSheet=!!$(".sheet-p") && (drill ? !!$(".box") : !!$(".way"));

    /* ── 骨組みがステージごとにずれていないか ────────────────────
       前は「灰の箱」「黄のベタ塗り」「名札なしの文章」が混ざり、
       ステージによって段の数も順番も違っていた。**そこを機械で止める。** */
    const why=[];
    const secs=$$(".sec").map(e=>e.textContent);
    const want=["前のステージから"]
      .concat(FIGURE[st.id] ? ["図で見ると"] : [])
      .concat(["見本"])
      .concat(drill ? ["やってみる"] : []);
    if (secs.join(">")!==want.join(">")) why.push(`段の並びが違う（${secs.join(">")}／期待は ${want.join(">")}）`);
    // 目立つ帯（赤い縦線）は1画面に1つだけ
    if ($$(".way").length!==1) why.push(`解き方の帯が ${$$(".way").length} 個`);
    // 名札の下の断り書きは、向きが2つあるステージでも1回だけ。
    // （.sec-w の直下が段の断り書き。①② の見出しは .tut の中なので混ざらない）
    const notes=$$(".sec-w > .sec-n").length;
    if (notes!==(drill?1:0)) why.push(`段の断り書きが ${notes} 回`);
    // 下の入口。練習があれば2つ、無ければ「テストをする」1つだけ
    const go=$$(".gotest button").map(b=>b.textContent);
    const wantGo = drill ? ["練習をする","テストをする"] : ["テストをする"];
    if (go.join("/")!==wantGo.join("/")) why.push(`下の入口が ${go.join("/")}（期待は ${wantGo.join("/")}）`);
    if (drill && $$(".tut").length===0) why.push("やってみるの中身が無い");
    if (!drill && $$(".tut").length) why.push("練習が無いステージに、やってみるが出ている");
    // 作り替える前の見た目が残っていないか
    for (const c of ["link1","how","tut-h","extbl"]) {
      if ($$("."+c).length) why.push(`古い見た目 .${c} が残っている`);
    }
    // 黄のベタ塗りは、形が変わる予告のときだけ。説明の1枚には出さない
    if ($$(".testnote").length) why.push("説明の1枚に黄色いベタ塗りが出ている");

    // 盤にも入ってみる（練習があれば練習、無ければテスト）
    click($$(".gotest button")[0]); await wait(150);
    const okPlay=!!$(".play")&&!!$(".box");
    const label=drill?"練習":"テスト";
    console.log(`${st.no} ${st.name}  説明:${okSheet?"OK":"NG"} 骨組み:${why.length?"NG":"OK"} ${label}:${okPlay?"OK":"NG"} 例外:${errs.length}`);
    for (const m of why) console.log("      ↳ "+m);
    if(!okSheet||!okPlay||errs.length||why.length) ng++;
  }
  console.log(ng? `✗ ${ng} ステージで問題` : "✓ 10ステージとも、盤が描けて、骨組みもそろっている");
})();
