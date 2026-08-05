// 10ステージぶん、チュートリアルの盤が実際に描けるか（例外が出ないか）だけを見る
const path=require("path"),fs=require("fs");
const R=path.join(__dirname, "..");
const {JSDOM}=require(path.join(R,".check/node_modules/jsdom"));
const {STATIONS}=require(path.join(R,"gen.js"));
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
    const okSheet=!!$(".sheet-p")&&!!$(".box");
    // 練習（盤）にも入ってみる
    click($$(".gotest button")[0]); await wait(150);
    const okPlay=!!$(".play")&&!!$(".box");
    // テストにも
    const d2=$$(".dopt").length;
    console.log(`${st.no} ${st.name}  説明:${okSheet?"OK":"NG"} 練習:${okPlay?"OK":"NG"} 例外:${errs.length}`);
    if(!okSheet||!okPlay||errs.length) ng++;
  }
  console.log(ng? `✗ ${ng} ステージで問題` : "✓ 10ステージとも、説明と練習の盤が描けた");
})();
