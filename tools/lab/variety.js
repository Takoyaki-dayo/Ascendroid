// 実験5: ゲーム本体のエンジンとカードで、敵の複雑さと「待てる」を比べる(実験4の確かめ)
// 使い方: node tools/lab/variety.js [条件の記号をカンマ区切り] [乱数の種]
// 条件:
//   A 今の敵(0.6.0 の敵、enemies_06.js)
//   B 複雑な敵・決まった順(下の FOES_X から分岐と段階変化を抜く)
//   C 複雑な敵+分岐+段階変化(FOES_X のまま)
//   D 今の敵+待てる / E 複雑な敵+分岐+段階+待てる
// 遊び手:
//   固定手順 auto  デッキごとに探した最良の優先順で、考えずに出す(耐久が最も低い敵を狙う)。手札がないときだけ待つ
//   読み roll      各候補を出したあと固定手順で戦闘の最後まで打ち切り、平均の損傷で選ぶ
// 難しさ: 遭遇ごとに、混合デッキ+固定手順の損傷(本体+部位)が 30 になるよう、敵の攻撃力を揃える
// 指標は実験4と同じ(考える価値、定石外れ、効く判断、対応の幅、得意の入れ替わり、相性の強さ)
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = {console}; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
const base = path.join(__dirname, '..', '..');
for(const f of ['data/parts.js','data/cards.js','data/enemies.js','data/map.js','data/lines.js','js/engine.js']) vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx, {filename:f});
const E = ctx.ENGINE, D = ctx.DATA;
// 「今の敵」は 0.6.0 の敵(enemies_06.js)。0.7.0 からゲームの敵は複雑な敵になっている
const BASE = (() => { const c = {}; c.window = c; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(__dirname, 'enemies_06.js'), 'utf8'), c); return JSON.parse(JSON.stringify(c.DATA.foes)); })();

// 複雑な敵: 今の敵と同じ顔ぶれに、行動ごとの属性・分岐・段階変化を足したもの
const FOES_X = JSON.parse(JSON.stringify(BASE));
Object.assign(FOES_X, {
  drone:  {...BASE.drone, ai:'rand', pat:[{n:'射撃', d:6, dl:6, p:'calc', wt:2}, {n:'連射', d:3, hits:2, dl:5, p:'out', wt:1}]},
  drone2: {...BASE.drone2, ai:'rand', pat:[{n:'射撃', d:6, dl:6, p:'out', wt:2}, {n:'連射', d:3, hits:2, dl:5, p:'mob', wt:1}]},
  linkA:  {...BASE.linkA, pat:[{n:'連携射撃', d:4, dl:6, p:'arm'}, {n:'陣形', d:0, dl:4, guard:{w:4, s:8}}]},
  linkB:  {...BASE.linkB, pat:[{n:'連携射撃', d:4, dl:6, p:'mob'}, {n:'陣形', d:0, dl:4, guard:{w:4, s:8}}]},
  scout:  {...BASE.scout, ai:'rand', pat:[{n:'刺突', d:3, dl:3, p:'out', wt:2}, {n:'乱れ突き', d:2, hits:3, dl:5, p:'mob', wt:1}, {n:'踏み込み', d:7, dl:5, p:'out', wind:{w:2, poise:6}, rec:2, wt:1}]},
  turret: {...BASE.turret, pat:[{n:'砲撃', d:8, dl:8, p:'dur'}, {n:'装甲展開', d:0, dl:4, guard:{w:4, s:12}}]},
  exec:   {...BASE.exec, pat:[{n:'殴打', d:7, dl:6, p:'out'}, {n:'殴打', d:7, dl:6, p:'out'}, {n:'粉砕砲', d:21, dl:8, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}],
    phase:{at:0.5, pat:[{n:'殴打', d:7, dl:5, p:'out'}, {n:'粉砕砲', d:21, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}]}},
  hacker: {...BASE.hacker, pat:[{n:'割り込み', kind:'delay', v:4, dl:7}, {n:'射撃', d:5, dl:5, p:'calc', counter:{w:5, d:3}}]},
  heavyExec:{...BASE.heavyExec, pat:[{n:'殴打', d:8, dl:5, p:'out'}, {n:'薙ぎ払い', d:5, hits:2, dl:6, p:'mob'}, {n:'粉砕砲', d:24, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}],
    phase:{at:0.5, pat:[{n:'過熱', d:0, dl:4, buff:2}, {n:'殴打', d:8, dl:5, p:'out'}, {n:'粉砕砲', d:24, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}]}},
  turretE:{...BASE.turretE, pat:[{n:'砲撃', d:9, dl:7, p:'dur'}, {n:'装甲展開', d:0, dl:4, guard:{w:4, s:14}}]},
  warden: {...BASE.warden, pat:[{n:'照射', d:7, dl:6, p:'calc'}, {n:'照射', d:7, dl:4, p:'arm'}, {n:'防壁', d:0, dl:5, guard:{w:5, s:20}}, {n:'消去プロトコル', d:28, dl:9, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{n:'照射', d:7, dl:5, p:'calc'}, {n:'報復態勢', d:9, dl:6, p:'arm', counter:{w:5, d:4}}, {n:'消去プロトコル', d:28, dl:8, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}]}},
  escort: {...BASE.escort, ai:'rand', pat:[{n:'射撃', d:5, dl:5, p:'mob', wt:2}, {n:'増幅', d:0, dl:6, buff:2, all:true, wt:1}]},
});
const strip = F => { const o = JSON.parse(JSON.stringify(F)); for(const k of Object.keys(o)){ delete o[k].ai; delete o[k].phase; } return o; };
const CONDS = {
  A:['今の敵', BASE, false], B:['複雑な敵・決まった順', strip(FOES_X), false], C:['複雑な敵+分岐+段階', FOES_X, false],
  D:['今の敵+待てる', BASE, true], E:['複雑な敵+分岐+段階+待てる', FOES_X, true],
};
const DECKS = {
  mixed:   D.startDeck.slice(),
  light:   ['jab','jab','jab','rapid','rapid','flick','flick','guard','guard','hack','reload','timebomb','scan'],
  heavy:   ['slash','slash','slash','wall','wall','blow','emp','backflow','guard','scan','parry'],
  control: ['hack','hack','backflow','timebomb','timebomb','parry','crackshot','crackshot','jab','guard','scan','overclock'],
};
const ENCS = Object.keys(D.encounters), DK = Object.keys(DECKS);
let R = E.rngFrom(1);

// 遭遇ごとの攻撃力の倍率をかけた敵を D.foes に置く
function setFoes(F, enc, m){
  const out = JSON.parse(JSON.stringify(F));
  const sc = x => Math.max(1, Math.round(x * m));
  const fixPat = pat => pat.forEach(a => { if(a.d > 0) a.d = sc(a.d); if(a.counter) a.counter.d = sc(a.counter.d); });
  for(const k of D.encounters[enc].foes){ const f = out[k]; fixPat(f.pat); if(f.phase) fixPat(f.phase.pat); if(f.react) f.react.d = sc(f.react.d); }
  D.foes = out;
}
function makeRun(deck){ const run = E.newRun(1); run.map = null; run.deck = deck.slice(); return run; }
const loss = (st, run0) => (run0.body - st.run.body) + Object.values(st.b.parts).reduce((a, p) => a + (p.max - p.cur), 0);
function autoAct(st, order){
  const b = st.b, acts = E.actions(st);
  if(!b.hand.length) return acts.find(a => a.type === 'wait');
  const k = order.find(x => b.hand.some(c => c.k === x)) || b.hand[0].k;
  const c = D.cards[k];
  let t = null;
  if(c.tgt){ let m = Infinity; for(const e of b.foes) if(e.alive && e.hp < m){ m = e.hp; t = e.i; } }
  return acts.find(a => a.type === 'card' && a.k === k && a.t === t) || acts.find(a => a.type === 'card' && a.k === k);
}
function rollout(st, order){
  for(let n = 0; n < 250; n++){ const o = E.doAction(st, autoAct(st, order)); if(o.won || o.dead) return; }
}
const ATK = c => !!(c.dmg || c.timer);
function chooseRoll(st, order, run0, K, stats){
  const acts = E.actions(st);
  let best = -Infinity, bestA = null, outs = new Set(), anyJ = false;
  for(const a of acts){
    if(a.type === 'swap') continue; // 入れ替えは候補から外す(読みが重くなるため。固定手順も使わない)
    let v = 0;
    for(let k = 0; k < K; k++){
      const s2 = E.clone(st); const b0 = s2.b.breaks || 0; const o = E.doAction(s2, a);
      if(k === 0){ outs.add(o.interruptedAt !== null ? 'i' : 'n'); if(o.justs.length || (s2.b.breaks || 0) > b0) anyJ = true; }
      if(!o.won && !o.dead) rollout(s2, order);
      v += -loss(s2, run0) - (s2.run.body <= 0 ? 30 : 0) - 0.01 * s2.b.T;
    }
    v = v / K + R() * 1e-6;
    if(v > best){ best = v; bestA = a; }
  }
  if(stats){
    stats.dp++; if(outs.size > 1 || anyJ) stats.rel++;
    const au = autoAct(st, order); if(au.type !== bestA.type || au.k !== bestA.k || (au.t !== bestA.t && st.b.foes.filter(e => e.alive).length > 1)) stats.off++;
    if(bestA.type === 'wait' && st.b.hand.length) stats.waits++;
    const H = st.b.hand.map(c => D.cards[c.k]);
    const hasL = H.some(c => ATK(c) && c.cost <= 2), hasH = H.some(c => ATK(c) && c.cost >= 3), hasB = H.some(c => c.block), ch = bestA.k ? D.cards[bestA.k] : {};
    if(hasL && hasH && ATK(ch)){ stats.lh++; if(ch.cost >= 3) stats.heavy++; }
    if(hasB && (hasL || hasH)){ stats.ba++; if(ch.block) stats.blk++; }
  }
  return bestA;
}
function battle(F, enc, m, deck, agent, order, K){
  setFoes(F, enc, m);
  const run0 = makeRun(deck), st = E.newBattle(E.clone(run0), enc);
  const stats = {dp:0, rel:0, off:0, waits:0, lh:0, heavy:0, ba:0, blk:0};
  let o = null, intr = 0, justs = 0;
  for(let n = 0; n < 300; n++){
    const a = agent === 'auto' ? autoAct(st, order) : chooseRoll(st, order, run0, K, stats);
    o = E.doAction(st, a); if(o.interruptedAt !== null) intr++; justs += o.justs.length;
    if(o.won || o.dead) break;
  }
  const b = st.b;
  return {loss:Math.min(83, loss(st, run0)), won:!!(o && o.won), T:b.T, intr, justs, breaks:b.breaks || 0, guarded:b.guarded || 0, countered:b.countered || 0, vulnHits:b.vulnHits || 0, ...stats};
}
function measure(F, mult, deckName, agent, N, seed, order, encs, K){
  R = E.rngFrom(seed); E.setRandom(R);
  const per = {}, sum = {};
  for(const e of encs || ENCS){
    per[e] = {};
    for(let i = 0; i < N; i++){ const r = battle(F, e, mult[e] || 1, DECKS[deckName], agent, order, K || 3); for(const [k, v] of Object.entries(r)){ per[e][k] = (per[e][k] || 0) + +v; sum[k] = (sum[k] || 0) + +v; } }
  }
  const n = N * Object.keys(per).length;
  for(const e of Object.keys(per)){ const q = per[e]; q.heavyRate = q.lh ? q.heavy / q.lh : null; q.blockRate = q.ba ? q.blk / q.ba : null; for(const k of ['loss','won','T']) q[k] = +(q[k] / N).toFixed(2); }
  const out = {per}; for(const [k, v] of Object.entries(sum)) out[k] = +(v / n).toFixed(3);
  out.offRate = sum.dp ? +(sum.off / sum.dp).toFixed(3) : 0; out.relRate = sum.dp ? +(sum.rel / sum.dp).toFixed(3) : 0;
  return out;
}
function bestOrder(F, mult, deckName, N, iters, seed){
  const types = [...new Set(DECKS[deckName].concat(E.partCards(makeRun([]))))];
  const ev = o => measure(F, mult, deckName, 'auto', N, seed, o).loss;
  const r = E.rngFrom(seed * 7 + 3); let best = null, bv = Infinity;
  for(let s = 0; s < 3; s++){
    let o = types.slice(); for(let i = o.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    let v = ev(o);
    for(let it = 0; it < iters; it++){ const a = Math.floor(r() * o.length), b = Math.floor(r() * o.length); if(a === b) continue; const o2 = o.slice(); [o2[a], o2[b]] = [o2[b], o2[a]]; const v2 = ev(o2); if(v2 <= v){ o = o2; v = v2; } }
    if(v < bv){ bv = v; best = o; }
  }
  return best;
}
function calibrate(F, order, target, N){
  const mult = {};
  for(const e of ENCS){
    let lo = 0.3, hi = 5;
    for(let k = 0; k < 8; k++){ const m = (lo + hi) / 2; const v = measure(F, {[e]:m}, 'mixed', 'auto', N, 99, order, [e]).loss; if(v > target) hi = m; else lo = m; }
    mult[e] = +((lo + hi) / 2).toFixed(3);
  }
  return mult;
}
module.exports = {E, D, CONDS, DECKS, FOES_X, measure, bestOrder, calibrate, setFoes};

if(require.main === module){
  const pick = (process.argv[2] || 'A,B,C,D,E').split(','), SEED = +(process.argv[3] || 5), NR = +(process.argv[4] || 4);
  const rows = [], f = x => (+x).toFixed(1), pct = x => (x * 100).toFixed(0) + '%';
  for(const id of pick){
    const [name, F, wait] = CONDS[id]; const t0 = Date.now();
    E.RULE.freeWait = false;
    let o = bestOrder(F, {}, 'mixed', 4, 30, 11);
    const mult = calibrate(F, o, 30, 12);
    o = bestOrder(F, mult, 'mixed', 6, 40, 11);
    const r = {id, name, mult, order:{}, auto:{}, roll:{}};
    for(const d of DK){
      r.order[d] = d === 'mixed' ? o : bestOrder(F, mult, d, 6, 40, 11);
      E.RULE.freeWait = false;
      r.auto[d] = measure(F, mult, d, 'auto', 30, SEED, r.order[d]);
      E.RULE.freeWait = wait;
      r.roll[d] = measure(F, mult, d, 'roll', NR, SEED, r.order[d], null, 3);
    }
    E.RULE.freeWait = false;
    const x = {}; for(const d of DK){ x[d] = {}; for(const e of ENCS) x[d][e] = r.roll[d].per[e].loss; }
    const gm = DK.reduce((a, d) => a + ENCS.reduce((b, e) => b + x[d][e], 0), 0) / (DK.length * ENCS.length);
    const dm = d => ENCS.reduce((a, e) => a + x[d][e], 0) / ENCS.length, em = e => DK.reduce((a, d) => a + x[d][e], 0) / DK.length;
    let ss = 0; for(const d of DK) for(const e of ENCS){ const v = x[d][e] - dm(d) - em(e) + gm; ss += v * v; }
    r.interaction = +Math.sqrt(ss / (DK.length * ENCS.length)).toFixed(2);
    r.bestDeck = {}; for(const e of ENCS){ let bd = null, bv = Infinity; for(const d of DK) if(x[d][e] < bv){ bv = x[d][e]; bd = d; } r.bestDeck[e] = bd; }
    r.winners = new Set(Object.values(r.bestDeck)).size;
    const tk = DK.map(d => r.roll[d].loss); r.spread = +(Math.max(...tk) - Math.min(...tk)).toFixed(1);
    r.think = +(r.auto.mixed.loss - r.roll.mixed.loss).toFixed(1);
    const per = r.roll.mixed.per, hr = ENCS.map(e => per[e].heavyRate).filter(v => v !== null), br = ENCS.map(e => per[e].blockRate).filter(v => v !== null);
    r.heavyRange = +(Math.max(...hr) - Math.min(...hr)).toFixed(2); r.blockRange = +(Math.max(...br) - Math.min(...br)).toFixed(2);
    rows.push(r);
    const M = r.roll.mixed;
    console.log(`${id} ${name}  (${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
    console.log(`  読み: ${DK.map(d => d.slice(0, 2) + f(r.roll[d].loss)).join(' ')} 差${r.spread} | 得意 ${ENCS.map(e => r.bestDeck[e][0]).join('')} ${r.winners}種 相性${r.interaction}`);
    console.log(`  固定: ${DK.map(d => d.slice(0, 2) + f(r.auto[d].loss)).join(' ')} | 考える価値${r.think} 対応の幅 重い${r.heavyRange} ブロック${r.blockRange} 定石外れ${pct(M.offRate)} 効く判断${pct(M.relRate)}`);
    console.log(`  1戦あたり: 中断${M.intr} JUST${M.justs} 崩し${M.breaks} 防がれた${M.guarded} 反撃${M.countered} 隙に当てた${M.vulnHits} 待った${M.waits} 判断${M.dp} 時間${M.T}`);
  }
  fs.writeFileSync(path.join(__dirname, `variety_${pick.join('')}_${SEED}.json`), JSON.stringify(rows, null, 1));
}
