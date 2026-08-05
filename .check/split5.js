// ステージ5・6の盤を、①②③④の順に正しく操作したら正解になるか
const path=require("path"),fs=require("fs");
const R=path.join(__dirname, "..");
const {JSDOM}=require(path.join(R,".check/node_modules/jsdom"));
const {STATIONS,cutOct,cutBit,maskStr,bin8}=require(path.join(R,"gen.js"));
const B=["vendor/react.production.min.js","vendor/react-dom.production.min.js","gen.js","app.js"].map(f=>fs.readFileSync(path.join(R,f),"utf8")).join("\n");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const W8=[128,64,32,16,8,4,2,1];
(async()=>{
  let ng=0, n=0;
  for (const id of ["S3","S4"]) for (let t=0;t<6;t++) {
    const prog={}; for(const s2 of STATIONS) prog[s2.id]={seen:10,correct:10,lit:true,solo:true};
    const d=new JSDOM(fs.readFileSync(path.join(R,"index.html"),"utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
    const w=d.window; w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}}); w.scrollTo=()=>{}; w.navigator.vibrate=()=>{};
    w.Element.prototype.scrollIntoView=function(){}; w.__debug=true;
    w.localStorage.setItem("ipcalc2-progress",JSON.stringify(prog));
    w.eval(B); await wait(120);
    const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
    const click=e=>e&&e.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
    const st=STATIONS.find(x=>x.id===id);
    const tile=$$(".tile").find(x=>x.textContent.includes(st.name));
    click(tile.querySelector(".t-h")); await wait(50);
    click(tile.querySelector(".go")); await wait(100);
    click($$(".gotest button")[0]); await wait(150);   // 練習（盤）へ
    // 練習の前の2問は手順つき。盤を見たいので、そこは通過する
    for (let g = 0; g < 3 && w.__q && w.__q.steps5; g++) {
      const sq = w.__q;
      for (const round of sq.steps5) {
        click($$(".ch").find((c) => c.textContent.trim() === round.ok)); await wait(50);
        if (round.kind === "oct") { click($$("button.oct")[round.want]); await wait(30); }
        else for (let i = 0; i < 8; i++) if (round.want & W8[i]) { click($$(".row8 button.cell")[i]); await wait(12); }
        click($$("button").find((b) => b.textContent.includes("次へ進む"))); await wait(50);
        if (round.kind === "fill") {
          const cur = $$(".row8 button.cell");
          for (let i = 0; i < 8; i++) {
            const on = cur[i].className.includes(" on"), want = !!(round.want2 & W8[i]);
            if (on !== want) { click(cur[i]); await wait(12); }
          }
          click($$("button").find((b) => b.textContent.includes("次へ進む"))); await wait(50);
        }
      }
      click($$(".ch").find((c) => c.textContent.trim() === String(sq.answer))); await wait(30);
      click($$("button").find((b) => b.textContent.includes("これで決定"))); await wait(100);
      click($$("button").find((b) => b.textContent.includes("次へ"))); await wait(100);
    }
    const q=w.__q; n++;
    const len=q.board.len, oc=cutOct(len), cb=cutBit(len);
    click($$("button.oct")[oc]); await wait(40);
    // ②③は機械が出す。①のあと、すぐ④⑤が出るはず
    if ($$(".split.bulk .go").length !== 1) { ng++; console.log(`${id} /${len} → ①のあとに④が出ない（${$$(".split.bulk .go").length}）`); continue; }
    // ④⑤ 行ごとに1回押す
    const bulk = $$(".split.bulk .go");
    if (bulk.length < 2) { /* ④が出たら⑤も出る作りなので、順に押す */ }
    click($$(".split.bulk .go")[0]); await wait(60);
    click($$(".split.bulk .go")[1]); await wait(60);
    const btn=$$("button").find(b=>b.textContent.includes("これで決定"));
    const okBtn = btn && !btn.disabled;
    click(btn); await wait(120);
    const ok=!!$(".dhead.ok");
    if(!ok){ ng++; console.log(`${id} /${len} ip=${q.board.ip} → ${$(".dhead")?$(".dhead").textContent:"判定なし"} 決定=${okBtn}`); }
  }
  console.log(ng? `✗ ${n}問中 ${ng}問 が正解にならない` : `✓ ${n}問すべて、①②③④の順で正解になった`);
})();
