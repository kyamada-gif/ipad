// ステージ1の1問目「桁の重み表を、8つとも自分でうめる」が、うめたとおりに通るか。
// 電卓が前の数を引きずって 12864 になるバグを、ここで見つけた。
const path=require("path"),fs=require("fs");
const R=path.join(__dirname,"..");
const {JSDOM}=require(path.join(R,".check/node_modules/jsdom"));
process.chdir(R);
const B=["vendor/react.production.min.js","vendor/react-dom.production.min.js","gen.js","app.js"].map(f=>fs.readFileSync(f,"utf8")).join("\n");
const {STATIONS}=require(path.join(R,"gen.js"));const prog={};for(const s of STATIONS)prog[s.id]={seen:10,correct:10,lit:true,solo:true};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const d=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
const w=d.window;w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.scrollTo=()=>{};w.navigator.vibrate=()=>{};w.Element.prototype.scrollIntoView=function(){};
w.__debug=true;w.localStorage.setItem("ipcalc2-progress",JSON.stringify(prog));w.onerror=m=>console.log("落ちた",String(m).slice(0,70));w.eval(B);await wait(150);
const $$=s=>[...w.document.querySelectorAll(s)],$=s=>w.document.querySelector(s),click=e=>e&&e.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
const t=$$(".tile").find(x=>x.textContent.includes("2の◯乗"));click(t.querySelector(".t-h"));await wait(60);
click(t.querySelectorAll(".go")[1]||t.querySelectorAll(".go")[0]);await wait(180);
if($(".sheet-p")){click($$(".gotest button")[1]||$$(".gotest button")[0]);await wait(180);}
console.log("盤:",w.__q.input);
const V=[128,64,32,16,8,4,2,1];
for(let i=0;i<8;i++){click($$(".row8 button.cell")[i]);await wait(25);
  for(const ch of String(V[i])){click($$(".calc .k").find(x=>x.textContent===ch));await wait(25);}}
console.log("入った値:",$$(".row8 button.cell").map(c=>c.textContent.trim()).join(" "));
const b=$$("button.next")[0];console.log("決定ボタン:",b.textContent,"／押せる:",!b.disabled);
click(b);await wait(150);
const v=($(".dhead")||{textContent:"なし"}).textContent.trim();
console.log(v.includes("正解")&&!v.includes("不")?"✓ 表を8つともうめて、正解になった":"✗ うめたとおりに通らない（"+v+"）");
if(!(v.includes("正解")&&!v.includes("不"))) process.exit(1);
})();
