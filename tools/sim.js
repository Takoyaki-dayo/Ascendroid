// 自動対戦のシミュレータ。js/engine.js と data/*.js をそのまま使う
// 使い方: node tools/sim.js [打ち方 greedy|expert|random] [回数]
//   遭遇ごとに、最初のデッキ・無傷の状態から戦わせて、勝率や被ダメージを出す
//   キャラは環境変数 CLS で選ぶ(data/classes.js のキー。省略時は常時供給の war = data/cards.js の数値そのまま)。例: CLS=k7 node tools/sim.js greedy 40
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = {console}; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
const base = path.join(__dirname, '..');
for(const f of ['data/parts.js','data/cards.js','data/enemies.js','data/map.js','data/classes.js','data/text.js','js/engine.js']) vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx, {filename:f});
const E = ctx.ENGINE, D = ctx.DATA;
{ const C = D.classes[process.env.CLS || 'war']; E.RULE.econ = C.econ ? {...C.econ} : null; E.RULE.freeWait = !!C.wait;
  for(const [k, o] of Object.entries(C.cards)) D.classCard(D.cards[k], o); }

function threat(st){ let s = 0; for(const e of st.b.foes) if(e.alive){ s += e.pat.reduce((a, x) => a + (x.d || 0), 0) / e.pat.reduce((a, x) => a + x.dl, 0); } return s; }
const zero = () => ({dmg:0, kills:0, justs:0, bodyLoss:0, partLoss:0, breaks:0, elapsed:0, won:false, dead:false});
function measure(before, after, out){
  const hpB = before.b.foes.reduce((a, e) => a + (e.hp || 0), 0), hpA = after.b.foes.reduce((a, e) => a + (e.hp || 0), 0); // 部位は耐久を持たない
  const partsB = Object.values(before.b.parts).reduce((a, p) => a + p.cur, 0), partsA = Object.values(after.b.parts).reduce((a, p) => a + p.cur, 0);
  return {dmg:hpB - hpA, kills:before.b.foes.filter(e => e.alive).length - after.b.foes.filter(e => e.alive).length, justs:out.justs.length,
    bodyLoss:before.run.body - after.run.body, partLoss:partsB - partsA, breaks:Object.keys(after.b.broken).length - Object.keys(before.b.broken).length,
    elapsed:out.elapsed, won:out.won, dead:out.dead, hand:after.b.hand.length};
}
function score(st, acc, lam){
  if(acc.won) return 1e4 - acc.elapsed;
  if(acc.dead) return -1e4;
  let next = 0; for(const e of st.b.foes) if(e.alive && E.cur(e).d) next = Math.max(next, E.cur(e).d);
  return acc.dmg + 6 * acc.kills + 4 * acc.justs - 1.6 * acc.bodyLoss - 0.8 * acc.partLoss - 5 * acc.breaks + 0.6 * Math.min(st.b.block, next) - lam * acc.elapsed + 1.2 * st.b.hand.length;
}
function add(a, o){ const r = {...a}; for(const k of ['dmg','kills','justs','bodyLoss','partLoss','breaks','elapsed']) r[k] += o[k]; r.won = o.won; r.dead = o.dead; return r; }
function search(st, depth, acc, lam){
  let best = -Infinity, bestA = null;
  const acts = E.actions(st);
  for(const a of acts){
    const s2 = E.clone(st); const o = E.doAction(s2, a); const ac = add(acc, measure(st, s2, o));
    let v = (o.won || o.dead || depth === 1) ? score(s2, ac, lam) : search(s2, depth - 1, ac, lam).v;
    v += Math.random() * 1e-6;
    if(v > best){ best = v; bestA = a; }
  }
  return {v:best, a:bestA};
}
const POL = {
  random: st => { const a = E.actions(st).filter(x => x.type === 'card'); return a.length ? a[Math.floor(Math.random() * a.length)] : E.actions(st).find(x => x.type === 'wait') || E.actions(st)[0]; },
  greedy: st => search(st, 1, zero(), threat(st)).a,
  expert: st => search(st, 2, zero(), threat(st)).a,
};
function fight(run, enc, pol){
  const st = E.newBattle(E.clone(run), enc), s = {waits:0, swaps:0, justs:0, intr:0, plays:{}, burn:0, cycles:0};
  for(let n = 0; n < 300; n++){
    const a = POL[pol](st);
    if(a.type === 'wait') s.waits++; if(a.type === 'swap') s.swaps++;
    if(a.type === 'card'){ const c = D.cards[a.k].cost; s.plays[c] = (s.plays[c] || 0) + 1; }
    const before = st.b.disc.length + st.b.hand.length;
    const o = E.doAction(st, a);
    s.justs += o.justs.length; if(o.interruptedAt !== null) s.intr++;
    if(o.won || o.dead) return {...s, won:o.won, body:run.body - st.run.body, broken:Object.keys(st.b.broken).length, cycles:st.b.T};
  }
  return {...s, won:false, body:run.body - st.run.body, cycles:st.b.T};
}
module.exports = {E, D, POL, fight};
if(require.main === module && process.argv[4] !== 'run'){
  const pol = process.argv[2] || 'greedy', N = +(process.argv[3] || 40);
  const run = E.newRun(1); run.area = +(process.env.AREA || 0); // AREA=1 でエリア2の強さ
  for(const enc of Object.keys(D.encounters)){
    const R = []; for(let i = 0; i < N; i++) R.push(fight(run, enc, pol));
    const avg = k => (R.reduce((a, r) => a + (r[k] || 0), 0) / N).toFixed(1);
    const plays = {}; for(const r of R) for(const [c, n] of Object.entries(r.plays)) plays[c] = (plays[c] || 0) + n;
    console.log(enc.padEnd(8), `win ${(R.filter(r => r.won).length / N * 100).toFixed(0)}%`, `body-${avg('body')}`, `brk ${avg('broken')}`, `cyc ${avg('cycles')}`, `wait ${avg('waits')}`, `swap ${avg('swaps')}`, `just ${avg('justs')}`, `intr ${avg('intr')}`, JSON.stringify(plays));
  }
}

// ラン全体: 道はランダム、学習はランダムに1枚、整備は修理、イベントは最初の選択肢、パーツは取る
function playRun(pol, seed){
  const run = E.newRun(seed), R = E.rngFrom(seed + 1), log = [];
  for(let guard = 0; guard < 100; guard++){
    const nx = E.nextNodes(run); if(!nx.length) break;
    const n = nx[Math.floor(R() * nx.length)];
    if(n.type === 'battle') E.encFor(run, n);
    if(n.enc){
      const st = E.newBattle(run, n.enc);
      let o = null;
      for(let k = 0; k < 400; k++){ o = E.doAction(st, POL[pol](st)); if(o.won || o.dead) break; }
      if(!o || !o.won) return {clear:false, at:'a' + (run.area + 1) + ':' + n.type, rooms:log.length, body:0, log};
      for(const s of D.slots) run.parts[s.id].damaged = !!st.b.broken[s.id];
      run.scrap += Math.round((n.type === 'elite' ? D.rewards.elite : n.type === 'battle' ? D.rewards.battle : 0) * (1 + D.alert.scrap * (E.alertLevel(run) - 1)));
      const pool = [...new Set(D.encounters[n.enc].foes.flatMap(f => D.foes[f].pool))];
      if(pool.length) run.deck.push(pool[Math.floor(R() * pool.length)]);
    } else if(n.type === 'rest'){ run.body = Math.min(run.bodyMax, run.body + 15); for(const s of D.slots) run.parts[s.id].damaged = false; }
    else if(n.type === 'event'){ const fx = D.events.find(e => e.id === n.ev).choices[0].fx; if(fx.alert) E.addAlert(run, fx.alert); if(fx.body) run.body = Math.max(1, Math.min(run.bodyMax, run.body + fx.body)); if(fx.repair) for(const s of D.slots) run.parts[s.id].damaged = false; if(fx.card) run.deck.push(D.rareCards[0]); }
    E.addAlert(run, E.alertGain(n.type));
    log.push(n.type + ':' + run.body + ':' + E.alertLevel(run));
    run.at = n.type === 'boss' ? {boss:true} : {lane:n.lane, idx:n.idx};
    if(n.type === 'boss'){
      (playRun.alertAt = playRun.alertAt || []).push(E.alertLevel(run));
      const tr = D.transit[run.area]; if(E.nextArea(run) === null) return {clear:true, body:run.body, log};
      // 中継: 最初の選択肢(損傷を直す・パーツ)
      const fx = tr.choices[0].fx; if(fx.repair) for(const s of D.slots) run.parts[s.id].damaged = false;
    }
  }
  return {clear:false, log};
}
module.exports.playRun = playRun;
if(require.main === module && process.argv[4] === 'run'){
  const pol = process.argv[2] || 'greedy', N = +(process.argv[3] || 40); let c = 0, where = {};
  for(let i = 0; i < N; i++){ const r = playRun(pol, 1000 + i); if(r.clear) c++; else where[r.at] = (where[r.at] || 0) + 1; }
  console.log(`run ${pol}: clear ${(c / N * 100).toFixed(0)}%`, JSON.stringify(where));
}
