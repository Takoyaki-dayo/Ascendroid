// 自動対戦のシミュレータ。js/engine.js と data/*.js をそのまま使う
// 使い方: node tools/sim.js [打ち方 greedy|expert|master|guard|random] [回数] [run]
//   master(0.40.4): 2手先まで読み、これから来る攻撃(受けられない分)を減らす手を選ぶ。いちばん人に近い。guard はその1手先版
//   遭遇ごとに、最初のデッキ・無傷の状態から戦わせて、勝率や被ダメージを出す
//   キャラは環境変数 CLS で選ぶ(data/classes.js のキー。省略時は常時供給の war = data/cards.js の数値そのまま)。例: CLS=k7 node tools/sim.js greedy 40
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = {console}; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
const base = path.join(__dirname, '..');
for(const f of ['data/parts.js','data/cards.js','data/enemies.js','data/map.js','data/classes.js','data/attrs.js','data/text.js','js/engine.js']) vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx, {filename:f});
const E = ctx.ENGINE, D = ctx.DATA;
{ const C = D.classes[process.env.CLS || 'war']; E.RULE.econ = C.econ ? {...C.econ} : null; E.RULE.freeWait = !!C.wait;
  for(const [k, o] of Object.entries(C.cards)) D.classCard(D.cards[k], o); }

function threat(st){ let s = 0; for(const e of st.b.foes) if(e.alive){ s += e.pat.reduce((a, x) => a + (x.d || 0), 0) / e.pat.reduce((a, x) => a + x.dl, 0); } return s; }
// 持続(0.29.0): まだ入っていない持続のダメージ(回数×威力、耐久まで)
const dotPot = st => st.b.foes.reduce((a, e) => a + (e.alive ? Math.min(e.hp, e.uids.reduce((s, k) => s + (e.units[k].dot && !e.units[k].broken ? e.units[k].dot.n * e.units[k].dot.p : 0), 0)) : 0), 0);
const zero = () => ({dot:0, dmg:0, kills:0, justs:0, bodyLoss:0, partLoss:0, breaks:0, elapsed:0, won:false, dead:false});
function measure(before, after, out){
  const arm = e => e.alive ? e.uids.reduce((s, k) => s + (e.units[k].broken ? 0 : e.units[k].armor || 0), 0) : 0; // 装甲(ブロック)を削るのも進んだことにする(0.40.0)
  const hpB = before.b.foes.reduce((a, e) => a + (e.hp || 0) + arm(e), 0), hpA = after.b.foes.reduce((a, e) => a + (e.hp || 0) + arm(e), 0); // 部位は耐久を持たない
  const partsB = Object.values(before.b.parts).reduce((a, p) => a + p.cur, 0), partsA = Object.values(after.b.parts).reduce((a, p) => a + p.cur, 0);
  return {dot:dotPot(after) - dotPot(before), dmg:hpB - hpA, kills:before.b.foes.filter(e => e.alive).length - after.b.foes.filter(e => e.alive).length, justs:out.justs.length,
    bodyLoss:before.run.body - after.run.body, partLoss:partsB - partsA, breaks:Object.keys(after.b.broken).length - Object.keys(before.b.broken).length,
    elapsed:out.elapsed, won:out.won, dead:out.dead, hand:after.b.hand.length};
}
function score(st, acc, lam){
  if(acc.won) return 1e4 - acc.elapsed;
  if(acc.dead) return -1e4;
  let next = 0; for(const e of st.b.foes) if(e.alive && E.cur(e).d) next = Math.max(next, E.cur(e).d);
  return acc.dmg + 0.7 * acc.dot + 6 * acc.kills + 4 * acc.justs - 1.6 * acc.bodyLoss - 0.8 * acc.partLoss - 5 * acc.breaks + 0.6 * Math.min(st.b.block, next) - lam * acc.elapsed + 1.2 * st.b.hand.length;
}
// 0.40.4: これから来る攻撃の見積もり。H サイクル先までの敵の攻撃の合計を、近いほど重く数える。
//   受けられる分(ブロック・防壁)を引いた残りが「受けるはずのダメージ」。ブレイク・ディレイ・撃破で予定が消えると下がる
function incoming(st, H){
  const b = st.b; let near = 0, far = 0;
  for(const e of b.foes) if(e.alive) for(const u of E.upcoming(e, H)){
    const a = u.a; if(!(a.d > 0)) continue;
    const d = Math.max(0, a.d + E.foeStr(e) + (b.crack || 0)); if(u.t <= 4) near += d; else far += d;
  }
  const guard = (b.block || 0) + (b.wards || []).reduce((s, w) => s + w.s, 0);
  const g1 = Math.min(guard, near), g2 = Math.min(guard - g1, far);
  return {near, far, guarded:g1 + g2, open:(near - g1) + 0.5 * (far - g2)};
}
function score2(st, acc, lam){
  if(acc.won) return 1e4 - acc.elapsed;
  if(acc.dead) return -1e4;
  const inc = incoming(st, 8);
  return acc.dmg + 0.7 * acc.dot + 6 * acc.kills + 4 * acc.justs - 1.6 * acc.bodyLoss - 0.8 * acc.partLoss - 5 * acc.breaks
    + 0.5 * inc.guarded - 0.9 * inc.open - lam * acc.elapsed + 1.2 * st.b.hand.length;
}
function search2(st, depth, acc, lam){
  let best = -Infinity, bestA = null;
  for(const a of E.actions(st)){
    const s2 = E.clone(st); const o = E.doAction(s2, a); const ac = add(acc, measure(st, s2, o));
    let v = (o.won || o.dead || depth === 1) ? score2(s2, ac, lam) : search2(s2, depth - 1, ac, lam).v;
    v += Math.random() * 1e-6;
    if(v > best){ best = v; bestA = a; }
  }
  return {v:best, a:bestA};
}
function add(a, o){ const r = {...a}; for(const k of ['dot','dmg','kills','justs','bodyLoss','partLoss','breaks','elapsed']) r[k] += o[k]; r.won = o.won; r.dead = o.dead; return r; }
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
  // 0.40.4: これから来る攻撃を見て守る・崩す打ち手
  guard: st => search2(st, 1, zero(), threat(st)).a,
  master: st => search2(st, 2, zero(), threat(st)).a,
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
    if(o.won || o.dead) return {...s, won:o.won && !E.fledAll(st), fled:E.fledAll(st) ? 1 : 0, body:run.body - st.run.body, broken:Object.keys(st.b.broken).length, cycles:st.b.T};
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
    console.log(enc.padEnd(8), `win ${(R.filter(r => r.won).length / N * 100).toFixed(0)}%`, ...(R.some(r => r.fled) ? [`fled ${(R.filter(r => r.fled).length / N * 100).toFixed(0)}%`] : []), `body-${avg('body')}`, `brk ${avg('broken')}`, `cyc ${avg('cycles')}`, `wait ${avg('waits')}`, `swap ${avg('swaps')}`, `just ${avg('justs')}`, `intr ${avg('intr')}`, JSON.stringify(plays));
  }
}

// ラン全体(0.40.4 で作り直し)。RUN=naive で前の雑な遊び方(道はランダム、学習は敵の候補から必ず1枚、イベントは最初の選択肢)
// smart(既定): 人が遊ぶのに近づける
//   道: 本体が減っていれば整備を選び、エリートを避ける。元気ならエリートも取る
//   学習: 遊ぶ画面と同じく、レア度を引いて3枚出し、レア度の高いものを取る。デッキが厚くてコモンしか無ければ取らない
//   整備: 回復と修理(画面と同じ)のあと、強化を1枚 / ショップ: スクラップが足りればデフラグで打撃を1枚抜く
//   イベント: 本体が減っていれば本体を失う選択肢を避ける / ボス: 回復と、属性付きのレアのカードを1枚 / 中継: まだ出ていないものからランダム
const RV = {common:1, uncommon:2, rare:3};
const offerPool = () => Object.keys(D.cards).filter(k => !D.cards[k].junk && !D.cards[k].attr && !D.cards[k].upgraded && !D.cards[k].cut && !['charge', 'scatter'].includes(k) && !['starter', 'special'].includes(D.rarityOf(k)));
function rollRarity(R, kind){ const w = D.rarityRule[kind] || D.rarityRule.battle, t = Object.values(w).reduce((a, b) => a + b, 0); let x = R() * t; for(const [r, v] of Object.entries(w)){ if((x -= v) < 0) return r; } return 'common'; }
function offers(R, kind, near, n){
  const all = offerPool(), out = [];
  for(let i = 0; i < n; i++){ const r = rollRarity(R, kind), nr = near.filter(k => all.includes(k) && D.rarityOf(k) === r && !out.includes(k)), ar = all.filter(k => D.rarityOf(k) === r && !out.includes(k));
    const pool = nr.length && R() < 0.6 ? nr : ar.length ? ar : all.filter(k => !out.includes(k)); if(pool.length) out.push(pool[Math.floor(R() * pool.length)]); }
  return out;
}
function cardVal(run, k){ const c = D.cards[k]; if(!c) return 0; const same = run.deck.filter(x => E.baseKey(x) === k).length; return RV[D.rarityOf(k)] + (c.dmg || c.timer ? 0.3 : 0) - 0.6 * same; }
function learn(run, R, kind, near){
  const os = offers(R, kind, near, 3).sort((a, b) => cardVal(run, b) - cardVal(run, a)); const k = os[0];
  if(k && (run.deck.length < 14 || D.rarityOf(k) !== 'common')) run.deck.push(k);
}
function upgradeOne(run){
  const ks = [...new Set(run.deck)].filter(k => D.canUp(D.cards, k) && D.regAttrCard(D.cards, D.upKey(k)));
  if(!ks.length) return; ks.sort((a, b) => (RV[D.rarityOf(b)] || 0) - (RV[D.rarityOf(a)] || 0)); const k = ks[0];
  run.deck[run.deck.indexOf(k)] = D.upKey(k);
}
function pickNode(run, nx, R){
  const hp = run.body / run.bodyMax, sc = n => (n.type === 'rest' ? (hp < 0.6 ? 5 : 0) : n.type === 'elite' ? (hp > 0.7 ? 2 : -4) : n.type === 'shop' ? (run.scrap >= D.shop.defrag ? 1 : -1) : n.type === 'battle' ? 1 : 0.5) + R() * 0.5;
  return nx.slice().sort((a, b) => sc(b) - sc(a))[0];
}
function playRun(pol, seed){
  const naive = process.env.RUN === 'naive';
  const run = E.newRun(seed), R = E.rngFrom(seed + 1), log = [];
  for(let guard = 0; guard < 100; guard++){
    const nx = E.nextNodes(run); if(!nx.length) break;
    const n = naive ? nx[Math.floor(R() * nx.length)] : pickNode(run, nx, R);
    if(n.type === 'battle') E.encFor(run, n);
    if(n.enc){
      const body0 = run.body, st = E.newBattle(run, n.enc);
      let o = null;
      for(let k = 0; k < 400; k++){ o = E.doAction(st, POL[pol](st)); if(o.won || o.dead) break; }
      // 集計(0.40.4): 遭遇ごとの回数・負け・被ダメージ・かかったサイクル(ランの中で、その時のデッキと本体で)
      { const T = playRun.stats = playRun.stats || {}, k = n.enc + '@a' + (run.area + 1), x = T[k] = T[k] || {n:0, lost:0, loss:0, cyc:0, bodyIn:0};
        x.n++; x.bodyIn += body0; x.cyc += st.b.T; if(!o || !o.won) x.lost++; else x.loss += body0 - st.run.body; }
      if(!o || !o.won) return {clear:false, at:'a' + (run.area + 1) + ':' + n.type, rooms:log.length, body:0, log};
      for(const s of D.slots) run.parts[s.id].damaged = !!st.b.broken[s.id];
      E.lootBack(st); if(!E.fledAll(st)) run.scrap += Math.round((n.type === 'elite' ? D.rewards.elite : n.type === 'battle' ? D.rewards.battle : 0) * (1 + D.alert.scrap * (E.alertLevel(run) - 1)));
      const pool = [...new Set(D.encounters[n.enc].foes.flatMap(f => D.foes[f].pool))];
      if(naive){ if(pool.length) run.deck.push(pool[Math.floor(R() * pool.length)]); }
      else if(n.type === 'boss'){ run.body = Math.min(run.bodyMax, run.body + D.rewards.boss.heal); const rs = offerPool().filter(k => D.rarityOf(k) === 'rare'); if(rs.length) run.deck.push(rs[Math.floor(R() * rs.length)]); }
      else learn(run, R, n.type === 'elite' ? 'elite' : 'battle', pool);
    } else if(n.type === 'rest'){ run.body = Math.min(run.bodyMax, run.body + D.rewards.restHeal); for(const s of D.slots) run.parts[s.id].damaged = false; if(!naive) upgradeOne(run); }
    else if(n.type === 'shop' && !naive){ const i = run.deck.indexOf('jab'); if(run.scrap >= D.shop.defrag && i >= 0){ run.scrap -= D.shop.defrag; run.deck.splice(i, 1); } }
    else if(n.type === 'event'){
      const ev = D.events.find(e => e.id === n.ev), hp = run.body / run.bodyMax;
      const ch = naive ? ev.choices[0] : ev.choices.find(c => !(c.fx.body < 0 && hp < 0.6) && !(c.fx.partDamage && hp < 0.6)) || ev.choices[ev.choices.length - 1];
      const fx = ch.fx;
      if(fx.alert) E.addAlert(run, fx.alert); if(fx.body) run.body = Math.max(1, Math.min(run.bodyMax, run.body + fx.body)); if(fx.repair) for(const s of D.slots) run.parts[s.id].damaged = false;
      if(fx.card){ const rs = offerPool().filter(k => D.rarityOf(k) === 'rare'); run.deck.push(naive ? D.rareCards[0] : rs[Math.floor(R() * rs.length)]); }
      if(fx.scrap) run.scrap += fx.scrap;
      if(fx.defrag && !naive){ const i = run.deck.indexOf('jab'); if(i >= 0) run.deck.splice(i, 1); }
    }
    E.addAlert(run, E.alertGain(n.type));
    log.push(n.type + ':' + run.body + ':' + E.alertLevel(run));
    run.at = n.type === 'boss' ? {boss:true} : {lane:n.lane, idx:n.idx};
    if(n.type === 'boss'){
      (playRun.alertAt = playRun.alertAt || []).push(E.alertLevel(run));
      if(E.nextArea(run) === null) return {clear:true, body:run.body, log};
      // 中継: naive はエリアの番号のもの(前の形)。smart はまだ出ていないものからランダムに選び、選択肢を考える
      const used = run.transitUsed = run.transitUsed || [], left = D.transit.filter(t => !used.includes(t.id)), tr = naive ? D.transit[run.area - 1] : left[Math.floor(R() * left.length)] || D.transit[0];
      used.push(tr.id);
      const dmg = D.slots.some(s => run.parts[s.id].damaged);
      const fx = naive ? tr.choices[0].fx : (tr.choices.find(c => c.fx.card === 'release') || (dmg && tr.choices.find(c => c.fx.repair)) || tr.choices.find(c => c.fx.defrag) || tr.choices.find(c => c.fx.card) || tr.choices[0]).fx;
      if(fx.repair) for(const s of D.slots) run.parts[s.id].damaged = false;
      if(fx.card){ const rs = offerPool().filter(k => D.rarityOf(k) === 'rare'); run.deck.push(fx.card === 'rare' ? rs[Math.floor(R() * rs.length)] : fx.card); }
      if(fx.defrag){ const i = run.deck.indexOf('jab'); if(i >= 0) run.deck.splice(i, 1); }
      if(fx.scrap) run.scrap += fx.scrap;
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
