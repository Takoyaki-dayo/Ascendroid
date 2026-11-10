// 進行の処理が変わっていないことの検査: node tools/publish/flowcheck.js [基準] [比べる版] [種の数] [--full]
//   基準・比べる版は index.html のあるフォルダ(data/ と js/ も要る)。基準に main と書くと、git の main を一時フォルダに取り出して使う。
//   既定は「main」と「このリポジトリの今の姿」。種の数の既定は 2。
// 同じ乱数(EN.setRandom と Math.random を固定)と同じ選び方で1周を流し、部屋を終えるごと(completeRoomNow の後)と
// 戦闘を始めるごと(startBattle の前)の S.run を並べて、2つの版で一致するかを見る。食い違えば最初の場所を出して 1 で終わる。
//   既定では戦闘は敵を弱くして流す(進行の順番と乱数を見るため)。--full を付けると弱くせずに戦う(負けたらやり直し、3回負けたら弱くする)。
// 選び方は画面の見た目ではなく状態(S・UI)だけで決めるので、画面を作り直しても同じ道を通る。
// 画面に頼るのは次の名前だけ: #ov・#ov2・#ovbox h2・#roomScr(と ._kind)・#mapScr・#titleScr、大域の S・UI・EN・act・onCard・onRedraw・onWait・pickOk・busy・WIPING。
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const args = process.argv.slice(2), full = args.includes('--full'), pos = args.filter(a => !a.startsWith('--'));
const ROOT = path.resolve(__dirname, '..', '..');
function dirOf(spec){
  if(spec === 'main' || /^[0-9a-f]{7,40}$/.test(spec) || spec.startsWith('origin/')){
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'asc-flow-'));
    cp.execSync(`git -C "${ROOT}" archive ${spec} | tar -x -C "${d}"`, {stdio: ['ignore', 'ignore', 'inherit']});
    return d;
  }
  return path.resolve(spec);
}
const baseDir = dirOf(pos[0] || 'main'), newDir = dirOf(pos[1] || ROOT), seeds = +(pos[2] || 2);

// ページの中に入れる: 乱数の固定と、状態を見て1手進める関数
function inject(seed, full){
  const mk = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // Math.random: 進行の処理から呼ばれたときだけ種のある列を進める。演出(火花・独り言など)からの呼び出しは別の列にして、演出の量が違っても進行がずれないようにする
  const logic = mk(seed * 7919 + 1), fx = mk(seed * 104729 + 7);
  const LOGIC = /\b(newRun|rollRarity|rarityPick|learnOptions|pickByRarity|withAttr|bossLearn|partOffers|randomParts|showShop|applyEvent|transitId|startTransit|afterWin|afterLearn)\b/;
  Math.random = () => LOGIC.test(new Error().stack || '') ? logic() : fx();
  window.__flow = {seed, full, mk, log: [], n: 0, rooms: 0, losses: 0, weak: !full, shopDone: {}, trace: []};
  window.__flowInit = () => {
    const F = window.__flow; EN.setRandom(F.mk(seed * 31337 + 3));
    const c0 = completeRoomNow; completeRoomNow = function(){ c0.apply(this, arguments); F.log.push('room ' + F.log.length + ' ' + JSON.stringify(S.run)); };
    const s0 = startBattle; startBattle = function(n){ F.log.push('battle ' + (n && n.enc) + ' ' + JSON.stringify(S.run)); return s0.apply(this, arguments); };
  };
  window.__flowStep = () => {
    const F = window.__flow, $ = s => document.querySelector(s), vis = s => { const e = $(s); return !!e && !e.hidden; }, V = v => ({dataset: {view: v}});
    F.n++;
    if(vis('#ov2')){ act('swapGo'); return 'swap'; }
    if(vis('#ov')){
      const h = (($('#ovbox h2') || {}).textContent || '').trim();
      if(h === '戦闘終了'){ act('afterWin'); return 'afterWin'; }
      if(h === '学習'){ const L = UI.learnOpts; if(!L.length || F.n % 5 === 4){ act('skipLearn'); return 'skipLearn'; } const k = L[F.n % L.length]; act('pick', k, V('learn')); act('learn'); return 'learn ' + k; }
      if(h === '鹵獲'){ const L = UI.partOpts; if(!L.length || F.n % 7 === 6){ act('skipPart'); return 'skipPart'; } const k = L[F.n % L.length]; act('pick', k, V('part')); act('takePart'); return 'part ' + k; }
      if(h === '強化するカードを選択'){ const ks = [...new Set(S.run.deck)].filter(k => DATA.canUp(CARDS, k) && DATA.regAttrCard(CARDS, DATA.upKey(k))); if(!ks.length){ act('backUp'); return 'backUp'; } const k = ks[F.n % ks.length]; act('pick', k, V('up')); act('doUp'); return 'up ' + k; }
      if(h === '消去するカードを選択'){ const ks = [...new Set(S.run.deck)]; const k = ks[F.n % ks.length]; act('pick', k, V('defrag')); act('del'); return 'del ' + k; }
      if(h.includes('を付けるカードを選択')){ const ks = [...new Set(S.run.deck)].filter(k => DATA.attrOk(CARDS[k], UI.attachA)); if(!ks.length){ act('backAttach'); return 'backAttach'; } act('pick', ks[0], V('attach')); act('attach'); return 'attach ' + ks[0]; }
      if(h === '機能停止'){ F.losses++; if(F.losses >= 3) F.weak = true; act('retry'); return 'retry'; }
      if(h === '踏破') return 'CLEAR';
      if($('#ovbox [data-act="done"]')){ act('done'); return 'done'; }
      if($('#ov').dataset.closable || $('#ovbox [data-act="close"]')){ act('close'); return 'close'; }
      return 'STUCK ov ' + h;
    }
    if(vis('#roomScr')){
      const kind = $('#roomScr')._kind;
      if(kind === 'rest'){ const id = ['heal', 'upgrade', 'defrag'][F.rooms % 3]; act('pick', id, V('rest')); act('rest'); return 'rest ' + id; }
      if(kind === 'shop'){
        const key = S.run.area + ':' + (UI.node ? UI.node.lane + '-' + UI.node.idx : ''), step = F.shopDone[key] = (F.shopDone[key] || 0) + 1, run = S.run, sh = DATA.shop;
        if(step === 1){ const i = UI.offers.findIndex(k => k && run.scrap >= price(k)); if(i >= 0){ act('pick', 'c' + i, V('shop')); act('buy'); return 'buy c' + i; } }
        if(step === 2 && run.scrap >= sh.repairCost && F.rooms % 2 === 0){ act('pick', 'repair', V('shop')); act('buy'); return 'buy repair'; }
        if(step === 3 && run.scrap >= DATA.attrRule.price){ const i = (UI.attrOffers || []).findIndex(a => a && DATA.attrs[a]); if(i >= 0){ act('pick', 'a' + i, V('shop')); act('buy'); return 'buy a' + i; } }
        if(step === 4 && run.scrap >= sh.defrag && F.rooms % 2 === 1){ act('pick', 'defrag', V('shop')); act('buy'); return 'buy defrag'; }
        if(step < 5) return 'shop pass';
        act('leave'); return 'leave shop';
      }
      if(kind === 'event' || kind === 'transit'){ const ev = findEvent(UI.eventId), i = F.rooms % ev.choices.length; act('pick', String(i), V('event')); act('choose'); return kind + ' ' + UI.eventId + ' ' + i; }
      if(kind === 'duct'){ act('leave'); return 'duct'; }
      return 'STUCK room ' + kind;
    }
    if(UI.screen === 'battle' && S.b && !S.b.over){
      const b = S.b;
      if(F.weak && !b._weak){ b._weak = 1; for(const e of b.foes){ for(const k of e.uids) e.units[k].hp = Math.min(e.units[k].hp, 3); e.hp = e.uids.reduce((x, k) => x + (e.units[k].vital ? e.units[k].hp : 0), 0); } }
      if(b.choose && !PICK) renderAll();
      if(PICK){ const need = pickNeed(); for(const cd of b.hand){ if(PICK.ids.length >= need) break; if(cd.id !== PICK.cid && !PICK.ids.includes(cd.id)) PICK.ids.push(cd.id); } pickOk(); return 'pick'; }
      const i = b.hand.findIndex(c => !EN.spendShort(b, CARDS[c.k]) && !EN.needShort(b, CARDS[c.k]));
      if(i >= 0){ onCard(i); if(sel && sel.kind === 'card' && sel.i === i) onCard(i); return 'card ' + b.T; }
      const k = rdKind(); onRedraw(); if(sel && sel.kind === k) onRedraw(); else { onWait(); onWait(); } return 'redraw';
    }
    if(vis('#titleScr')){ act('newGame'); if(vis('#titleScr')) act('newGame'); return 'newGame'; }
    if(UI.screen === 'map' && vis('#mapScr')){
      const ns = EN.nextNodes(S.run); if(!ns.length) return 'STUCK map';
      const n = ns[(F.rooms * 7 + F.seed) % ns.length], k = n.type === 'boss' ? 'boss' : n.lane + '-' + n.idx; F.rooms++;
      act('node', k); act('go'); return 'go ' + n.type + ' ' + k;
    }
    return 'STUCK ' + UI.screen;
  };
}

async function runOne(browser, dir, seed){
  const ctx = await browser.newContext({viewport: {width: 844, height: 390}, reducedMotion: 'reduce'});
  await ctx.addInitScript(`(${inject.toString()})(${seed}, ${full})`);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => { if(!/ServiceWorker/.test(e.message)) errs.push(e.message); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + path.join(dir, 'index.html')); await p.waitForTimeout(500);
  await p.evaluate(() => { try{ localStorage.clear(); }catch(e){} __flowInit(); });
  const idle = () => p.waitForFunction(() => !busy && !WIPING && !UI.going, null, {timeout: 30000}).then(() => true).catch(() => false);
  let end = 'steps', steps = 0; const trace = [];
  for(; steps < 9000; steps++){
    if(!(await idle())){ end = 'busy のまま止まった'; break; }
    const r = await p.evaluate(() => __flowStep()); trace.push(r);
    if(r === 'CLEAR'){ end = 'CLEAR'; break; }
    if(r.startsWith('STUCK')){ end = r; break; }
    if(r === 'shop pass') continue;
    await p.waitForTimeout(r.startsWith('go') ? 30 : 5);
  }
  const log = await p.evaluate(() => __flow.log), info = await p.evaluate(() => ({rooms: __flow.rooms, losses: __flow.losses, weak: __flow.weak}));
  await ctx.close();
  return {log, end, steps, errs, trace, info};
}
function firstDiff(a, b){
  const A = JSON.stringify(a), B = JSON.stringify(b); if(A === B) return null;
  if(typeof a !== 'object' || typeof b !== 'object' || !a || !b) return ` ${A} ≠ ${B}`;
  for(const k of new Set([...Object.keys(a), ...Object.keys(b)])){ const d = firstDiff(a[k], b[k]); if(d) return '.' + k + d; }
  return ' ?';
}
(async () => {
  const browser = await chromium.launch(); let bad = 0;
  for(let seed = 1; seed <= seeds; seed++){
    const A = await runOne(browser, baseDir, seed), B = await runOne(browser, newDir, seed);
    let msg = '';
    const n = Math.min(A.log.length, B.log.length); let at = -1;
    for(let i = 0; i < n; i++) if(A.log[i] !== B.log[i]){ at = i; break; }
    if(at >= 0){
      const sp = s => { const i = s.indexOf('{'); return [s.slice(0, i).trim(), JSON.parse(s.slice(i))]; }, [ha, ja] = sp(A.log[at]), [hb, jb] = sp(B.log[at]);
      msg = `食い違い: ${at + 1} 個目(基準「${ha}」/ 比べる版「${hb}」) S.run${ha === hb ? firstDiff(ja, jb) : ' の前に、通った所が違う'}`;
    } else if(A.log.length !== B.log.length) msg = `記録の数が違う: 基準 ${A.log.length} / 比べる版 ${B.log.length}`;
    else if(A.end !== B.end) msg = `終わり方が違う: 基準 ${A.end} / 比べる版 ${B.end}`;
    for(const [nm, R] of [['基準', A], ['比べる版', B]]){ if(R.end !== 'CLEAR') msg += ` / ${nm}が最後まで進まなかった(${R.end}、直前: ${R.trace.slice(-4).join(' > ')})`; if(R.errs.length) msg += ` / ${nm}でエラー: ${R.errs.slice(0, 2).join(' | ')}`; }
    if(msg) bad++;
    console.log(`種 ${seed}: 記録 ${A.log.length}/${B.log.length} 区画 ${A.info.rooms}/${B.info.rooms} 手 ${A.steps}/${B.steps} 負け ${A.info.losses}/${B.info.losses} ${msg ? '✗ ' + msg : '一致'}`);
  }
  console.log(bad ? `問題 ${bad}` : '問題 0');
  await browser.close(); process.exit(bad ? 1 : 0);
})();
