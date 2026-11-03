// 工房(tools/sheet)を共有データベースの代わりの mock で動かす例。stage.sh の出力を python3 -m http.server 8765 で配ってから node で実行する。
// MOCK を addInitScript で入れれば、ほかの確認にも使える
const {chromium}=require('playwright');
const MOCK=`(()=>{const store={};const subs=[];
function snapDoc(p){return {id:p.split('/').pop(),exists:p in store,data:()=>store[p]?JSON.parse(JSON.stringify(store[p])):undefined};}
function notify(){for(const s of subs)s();}
function coll(c){return {doc:(id)=>doc(c+'/'+id),add:async(d)=>{const id='r'+Math.random().toString(36).slice(2,8);await doc(c+'/'+id).set(d);return {id};},onSnapshot(fn){const f=()=>fn({docs:Object.keys(store).filter(k=>k.startsWith(c+'/')&&k.split('/').length===c.split('/').length+1).map(snapDoc)});subs.push(f);setTimeout(f,10);return()=>{};}};}
function doc(p){return {id:p.split('/').pop(),async set(d){store[p]=JSON.parse(JSON.stringify(d));setTimeout(notify,5);},async update(d){store[p]=Object.assign(store[p]||{},JSON.parse(JSON.stringify(d)));setTimeout(notify,5);},async delete(){delete store[p];setTimeout(notify,5);},async get(){return snapDoc(p);},onSnapshot(fn){const f=()=>fn(snapDoc(p));subs.push(f);setTimeout(f,10);return()=>{};}};}
window.__store=store;
const db={collection:coll,doc};
if(window===window.top) window.claude={use:async n=>n==='db'?db:null};})();`;
(async()=>{
 const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:860}});
 const errs=[];pg.on('pageerror',e=>errs.push('P:'+e.message));
 pg.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text())});
 await pg.addInitScript(MOCK);
 await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(600);
 await pg.screenshot({path:'wb_list.png'});
 // 既存カード jab を開いて変更
 await pg.click('tr.row[data-key="jab"]').catch(e=>errs.push('nojab '+e.message));
 await pg.waitForTimeout(200);
 await pg.screenshot({path:'wb_side.png'});
 const dn=await pg.$('#w_dn'); if(dn){await dn.fill('6');}
 await pg.waitForTimeout(100);
 await pg.click('#wbReview');await pg.waitForTimeout(300);
 // 新しいカード
 await pg.click('#addBtn');await pg.waitForTimeout(200);
 await pg.fill('#w_name','テスト斬');
 await pg.fill('#w_cost','2').catch(()=>{});
 await pg.waitForTimeout(100);
 await pg.screenshot({path:'wb_new.png'});
 await pg.click('#wbSave');await pg.waitForTimeout(300);
 const st=await pg.evaluate(()=>JSON.stringify(window.__store));
 console.log(st.slice(0,1500));
 await pg.screenshot({path:'wb_after.png'});
 // デッキ
 await pg.click('#deckBtn');await pg.waitForTimeout(200);await pg.screenshot({path:'wb_deck.png'});
 // 試遊
 await pg.click('#playBtn');await pg.waitForTimeout(2500);
 await pg.screenshot({path:'wb_play.png'});
 const fr=pg.frames().find(f=>f.url().includes('play/'));
 if(fr){ const r=await fr.evaluate(()=>({jab:CARDS.jab, keys:Object.keys(CARDS).filter(k=>k[0]==='n'), deck:DATA.startDeck.length}));console.log(JSON.stringify(r));}
 else console.log('noframe');
 console.log('ERR',errs.join('\n'));await b.close();})();
