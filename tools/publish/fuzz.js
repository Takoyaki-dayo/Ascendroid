// 演出の打ち切りの検査(0.50.0): node tools/publish/fuzz.js <mkapp の出力>/index.html <遭遇,...> [乱数の種の数]
// A: ふつうに遊ぶ / B: 演出の最中に手札・入れ替え・待機を連打する。同じ乱数・同じ選び方で、行動ごとの状態が A と B で一致するか、
// B で画面の取り残し(止まった動き・#fx の残り・手札の数・消えた敵)がないかを見る。種ごとに1行ずつ出し、最後に問題をまとめる
const {chromium}=require('playwright');
(async()=>{const file=require('path').resolve(process.argv[2]);const encs=(process.argv[3]||'n_guard').split(',');const seeds=+(process.argv[4]||3);
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:844,height:390}});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' @'+(e.stack||'').split('\n')[1]));
await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
await p.goto('file://'+file);await p.waitForTimeout(800);
let total=0,bad=[];
for(const enc of encs) for(let sd=1;sd<=seeds;sd++){
 const runs={};
 for(const mode of ['A','B']){
  await p.evaluate(([enc,sd])=>{ let a=sd*9973; const rnd=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
   hideOv(); newRun(); onWin = () => { UI.screen = 'done'; }; onLose = () => { UI.screen = 'done'; }; EN.setRandom(rnd); startBattle({type:'battle',enc}); window.__sig=[]; },[enc,sd]);
  await p.waitForTimeout(300);
  const sig=[];let steps=0;
  while(steps<60){
   const st=await p.evaluate(()=>({over:!S.b||S.b.over||UI.screen!=='battle',busy}));
   if(st.over) break;
   const pick=await p.evaluate(()=>{const b=S.b;const i=b.hand.findIndex(c=>!EN.spendShort(b,CARDS[c.k])&&!EN.needShort(b,CARDS[c.k]));return i;});
   await p.evaluate(i=>{ if(i>=0){ if(!(sel&&sel.kind==='card'&&sel.i===i)) onCard(i); if(sel&&sel.kind==='card'&&sel.i===i) onCard(i); } else { const k=rdKind(); if(!(sel&&sel.kind===k)) onRedraw(); if(sel&&sel.kind===k) onRedraw(); else { onWait(); onWait(); } } },pick);
   if(mode==='B'){ const d=Math.floor(Math.random()*350); await p.waitForTimeout(d);
     await p.evaluate(()=>{ if(!busy) return; const els=[...document.querySelectorAll('#hand .card[data-i]')]; const r=Math.random(); const t= r<.8&&els.length? els[Math.floor(Math.random()*els.length)] : r<.9? document.querySelector('#redraw') : document.querySelector('#waitBtn'); if(t) t.click(); });
     if(Math.random()<.3){ await p.waitForTimeout(30); await p.evaluate(()=>{ const els=[...document.querySelectorAll('#hand .card[data-i]')]; if(busy&&els.length) els[0].click(); }); }
   }
   const ok=await p.waitForFunction(()=>!busy,null,{timeout:15000}).then(()=>true).catch(()=>false);
   if(!ok){ bad.push(`${enc}/${sd}/${mode}: busy のまま止まった (step ${steps})`); break; }
   steps++;
   const s=await p.evaluate(()=>{ const b=S.b; return JSON.stringify({t:b.t, me:S.run.body, parts:Object.fromEntries(Object.entries(b.parts||{}).map(([k,v])=>[k,v.cur])), foes:b.foes.map(e=>[e.alive, Object.values(e.units).map(u=>u.hp)]), hand:b.hand.map(c=>c.id), blk:b.block}); });
   sig.push(s);
   if(mode==='B'){ await p.waitForTimeout(900);
     const inv=await p.evaluate(()=>{ const o=[]; if(UI.screen!=='battle'||!S.b||S.b.over) return o; const b=S.b;
       if(cardEls.size!==b.hand.length) o.push('cardEls '+cardEls.size+'≠手札 '+b.hand.length);
       const hc=document.querySelectorAll('#hand .card').length; if(hc!==b.hand.length) o.push('手札の要素 '+hc+'≠'+b.hand.length);
       if(document.body.classList.contains('hs')) o.push('hs が残った');
       const pz=document.getAnimations().filter(a=>a.playState==='paused').length; if(pz) o.push('止まったままの動き '+pz);
       const fx=$('#fx').children.length; if(fx) o.push('#fx に '+fx+' 個残った');
       for(const e of b.foes){ for(const el of document.querySelectorAll(`.foe[data-f="${e.i}"]`)){ const u=el.dataset.u; const live=e.alive&&(!u||!e.units[u]||e.units[u].hp>0); if(live && getComputedStyle(el).opacity==='0') o.push('生きている敵が消えている'+(u?' ('+u+')':'')); } }
       if(!$('#selfBar').hidden && !busy && !(sel)) o.push('自分の帯が出たまま');
       return o; });
     if(inv.length) bad.push(`${enc}/${sd} step${steps}: `+inv.join(' / '));
   }
  }
  runs[mode]=sig; total+=steps;
 }
 const n=Math.min(runs.A.length,runs.B.length); let diff=-1; for(let k=0;k<n;k++) if(runs.A[k]!==runs.B[k]){diff=k;break;}
 if(diff>=0) bad.push(`${enc}/${sd}: 状態が食い違った (行動 ${diff+1}) A=${runs.A[diff]} B=${runs.B[diff]}`);
 else if(runs.A.length!==runs.B.length) bad.push(`${enc}/${sd}: 行動の数が違う A=${runs.A.length} B=${runs.B.length}`);
 console.log(enc+'/'+sd,'A',runs.A.length,'B',runs.B.length,'問題(累計)',bad.length);
}
console.log('行動',total,'問題',bad.length);bad.slice(0,15).forEach(x=>console.log(' -',x.slice(0,300)));console.log('errors',errs.slice(0,5));await b.close()})();
