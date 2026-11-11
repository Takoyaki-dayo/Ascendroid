// 試遊版を自動で1周遊ぶ: node tools/publish/play19.js <mkapp の出力>/index.html [スクショの出力先]。WEAK=1 で敵を弱くして流れだけ見る
// 0.54.0: 操作はすべてマウス(クリックと右クリック)で行う。MOTION=1 で「動きを減らす」設定なし(既定はあり)。SIZE=1920x1080 で画面の大きさ(既定 876x390)
// 撮るもの: 地図・戦闘(通常時・カードを選んだとき・敵の詳細)・報酬・ショップ・整備・イベントなど、初めて出た画面
const { chromium } = require('playwright');
(async () => {
  const file = require('path').resolve(process.argv[2]), shots = process.argv[3];
  const b = await chromium.launch();
  const [vw, vh] = (process.env.SIZE || '876x390').split('x').map(Number);
  const p = await (await b.newContext({ viewport: { width: vw, height: vh }, reducedMotion: process.env.MOTION ? 'no-preference' : 'reduce' })).newPage();
  const errs = []; p.on('pageerror', e => { if(!/ServiceWorker/.test(e.message)) errs.push(e.message + ' @' + (e.stack || '').split('\n')[1]); }); p.on('console', m => { if(m.type() === 'error' && !/serviceWorker|sw\.js|ServiceWorker/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto('file://' + file); await p.waitForTimeout(400); await p.evaluate(() => { try{ localStorage.clear(); }catch(e){} }); await p.reload(); await p.waitForTimeout(400); await p.click('[data-act="newGame"]'); await p.waitForTimeout(300); const areaLog = [];
  const vis = sel => p.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.offsetParent !== null; }, sel);
  const has = sel => p.$(sel).then(x => !!x);
  const click = async sel => { await p.click(sel); await p.waitForTimeout(60); };
  let nstep = 0; const log = []; let shot = 0, battles = 0, rooms = [], losses = 0;
  const snap = async name => { if(shots){ await p.screenshot({path: `${shots}/${String(++shot).padStart(2,'0')}-${name}.png`}); } };
  let snapped = new Set();
  for(let step = 0; step < 6000; step++){
    // 画面の切り替え(面が横切る・印が走る)の途中では押さない。動きありのときに、消える途中の画面を押してしまうため
    await p.waitForFunction(() => !WIPING && !UI.going, null, {timeout: 10000}).catch(() => log.push('wipe timeout'));
    if(process.env.WEAK){ await p.evaluate(() => { if(S && S.b && !S.b._weak){ S.b._weak = 1; for(const e of S.b.foes) for(const k of e.uids){ e.units[k].hp = Math.min(e.units[k].hp, 3); } for(const e of S.b.foes){ e.hp = e.uids.reduce((x, k) => x + (e.units[k].vital ? e.units[k].hp : 0), 0); } } }); }
    if(!(await p.evaluate(() => document.querySelector('#ov2').hidden))){ await snap('swap'); await click('[data-act="swapGo"]'); log.push('swapped'); continue; }
    const ov = !(await p.evaluate(() => document.querySelector('#ov').hidden));
    const room = await vis('#roomScr');
    if(ov || room){
      const h2 = await p.evaluate(o => document.querySelector(o ? '#ovbox h2' : '#roomScr h2')?.textContent || '', ov);
      if(!snapped.has(h2.slice(0, 4))){ snapped.add(h2.slice(0, 4)); await snap('ov-' + h2.replace(/\s/g, '')); }
      if(ov && await has('#ovbox [data-act="close"]')){ await click('#ovbox [data-act="close"]'); continue; }
      if(ov && await has('#ovbox [data-act="afterWin"]')){ await click('[data-act="afterWin"]'); continue; }
      if(h2 === '学習'){ await click('#ovbox [data-view="learn"]'); await click('[data-act="learn"]'); continue; }
      if(h2 === '鹵獲'){ await click('#ovbox [data-view="part"]'); await click('[data-act="takePart"]'); log.push('part'); continue; }
      if(h2 === '整備'){ if(await has('[data-arg="repair"]')) await click('[data-arg="repair"]'); else await click('[data-arg="upgrade"]'); await click('[data-act="rest"]'); continue; }
      if(h2 === '強化するカードを選択'){ await click('#ovbox [data-view="up"]'); await click('[data-act="doUp"]'); log.push('up'); continue; }
      if(h2 === 'ショップ'){
        const can = await p.$('#roomScr .sitem .card:not(.off)');
        if(can && !log.includes('bought')){ await can.click(); await click('[data-act="buy"]'); log.push('bought'); continue; }
        await click('[data-act="leave"]'); continue;
      }
      if(h2 === '消去するカードを選択'){ await click('#ovbox [data-view="defrag"]'); await click('[data-act="del"]'); continue; }
      if(h2 === '取り込んだ'){ await click('[data-act="done"]'); continue; }
      if(ov && await has('#ovbox [data-act="done"]')){ await click('#ovbox [data-act="done"]'); continue; }
      if(h2 === '機能停止'){ losses++; if(losses > 3){ log.push('gave up'); break; } await click('[data-act="retry"]'); continue; }
      if(h2.includes('踏破')){ log.push('CLEAR'); break; }
      if(await has('#roomScr [data-act="choose"]')){ await click('#roomScr [data-view="event"]'); await click('[data-act="choose"]'); continue; }
      if(await has('#roomScr [data-act="leave"]')){ await click('#roomScr [data-act="leave"]'); log.push('duct'); continue; }
      log.push('unknown overlay ' + h2); break;
    }
    if(await vis('#mapScr')){
      if(!snapped.has('map' + rooms.length)){ snapped.add('map' + rooms.length); if(rooms.length < 2) await snap('map'); }
      const n = await p.$('#mapScr .mn.reach'); if(!n){ log.push('no reachable node'); break; }
      const arg = await n.getAttribute('data-arg'); await n.click(); await p.waitForTimeout(60);
      const type = await p.evaluate(() => document.querySelector('.minfo b')?.textContent);
      rooms.push((await p.evaluate(() => S.run.area + 1)) + ':' + arg + ':' + type);
      await click('[data-act="go"]'); await p.waitForTimeout(450);
      continue;
    }
    // battle
    const st = await p.evaluate(() => ({busy, hand: S.b ? S.b.hand.length : -1, T: S.b ? S.b.T : 0}));
    if(st.hand < 0){ log.push('no battle state'); break; }
    if(st.busy){ await p.waitForTimeout(100); continue; }
    if(!snapped.has('battle' + battles) && st.T === 0){ snapped.add('battle' + battles); battles++; if(battles <= 2) await snap('battle');
      if(battles === 1){ await p.click('#foes .foe', {button: 'right'}); await p.waitForTimeout(500); await snap('foe-detail'); await click('[data-act="foeClose"]'); await p.waitForTimeout(300); } }
    nstep = (typeof nstep === 'number' ? nstep : 0) + 1;
    if(st.hand > 0 && nstep % 6 === 0 && await vis('#waitBtn')){ await click('#waitBtn'); if(battles <= 3 && !snapped.has('wsel' + battles)){ snapped.add('wsel' + battles); await snap('waitsel'); } await click('#waitBtn'); await p.waitForFunction(() => !busy, null, {timeout: 30000}).catch(() => log.push('timeout')); continue; }
    if(st.hand > 0 && nstep % 9 === 0 && battles <= 6){ await snap('b' + battles + '-t' + st.T); }
    const ci = await p.evaluate(() => { const el = document.querySelector('#hand .card:not(.off)'); return el ? el.dataset.i : null; });
    if(st.hand > 0 && ci != null){
      const cs = `#hand .card[data-i="${ci}"]`;
      await click(cs);
      if(battles <= 2 && !snapped.has('sel' + battles)){ snapped.add('sel' + battles); await p.waitForTimeout(200); await snap('selected'); }
      if(!(await p.evaluate(() => document.querySelector('#ov').hidden))) continue;
      await click(cs);
      // 手札を選ぶ(0.35.0): 使うカード以外を必要な枚数だけ選んで決定
      for(let g = 0; g < 8 && await p.evaluate(() => !!PICK && !busy); g++){
        const i = await p.evaluate(() => PICK.ids.length >= pickNeed() ? -1 : S.b.hand.findIndex(cd => cd.id !== PICK.cid && !PICK.ids.includes(cd.id)));
        if(i < 0){ await click('#chooseBar button'); break; } await click(`#hand .card[data-i="${i}"]`);
      }
    } else { const lab = await p.evaluate(() => document.querySelector('#redraw').getAttribute('aria-label')); const t = lab === 'リフレッシュ' ? '#redraw' : '#waitBtn'; await click(t); await click(t); }
    await p.waitForFunction(() => !busy, null, {timeout: 30000}).catch(() => log.push('timeout'));
  }
  console.log('rooms:', rooms.join(' > '));
  console.log('log:', log.join(', '), 'losses', losses);
  console.log('run:', JSON.stringify(await p.evaluate(() => ({heat: S.run.heat, lv: EN.heatLevel(S.run), body: S.run.body, scrap: S.run.scrap, deck: S.run.deck.length, parts: Object.values(S.run.parts).map(x => x.id)}))));
  console.log('errors:', JSON.stringify(errs.slice(0, 10)));
  await b.close();
})();
