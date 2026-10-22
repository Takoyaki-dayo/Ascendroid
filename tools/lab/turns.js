// 実験7: 擬似ターン(手札の区切り)の型を、ゲーム本体のエンジンで比べる
// 使い方: node tools/lab/turns.js <条件の記号をカンマ区切り> [乱数の種] [読みの回数] [敵: base|esc]
// 条件の記号は下の CONDS。区切りの型(econ)× 強さの表(curve)× 付け足し(排莢、ブロック消滅、待機)
// 遊び手(variety.js と同じ考え方):
//   固定手順 auto  デッキごとに探した最良の優先順で出す。手札がなければ、区切れるなら区切り、だめなら待つ
//   読み roll      各候補(カード・待機・区切り)を試し、固定手順で戦闘の最後まで打ち切って比べる
// 難しさ: 条件ごとに、標準デッキ+固定手順の損傷が 30 になるよう敵の攻撃力を揃える(全遭遇で同じ倍率)
// デッキ: アーキタイプの試作(標準・クラック・時限・遅延・見切り・加速・要塞)と、値段表の検査用(軽い・重い)
// 指標:
//   アーキタイプの差  7デッキ(読み)の損傷の最大-最小と、いちばん苦しいデッキ
//   亀の得           要塞−標準(負なら防御を固めるほど得 = 緊張感がない)
//   値段表           軽い−重い(0に近いほど、どのコスト帯も一強でない)
//   細々             読みの判断のうち、使える手札が1枚以下だった割合
//   定石外れ・効く判断  判断の幅
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = {console}; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
const base = path.join(__dirname, '..', '..');
for(const f of ['data/parts.js','data/cards.js','data/enemies.js','data/map.js','data/lines.js','js/engine.js']) vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx, {filename:f});
const E = ctx.ENGINE, D = ctx.DATA;
const CARDS0 = JSON.parse(JSON.stringify(D.cards)), FOES0 = JSON.parse(JSON.stringify(D.foes));

// 放置の代償を持つ敵(0.7 の敵を元に、行動を足し替える)
const FOES_ESC = JSON.parse(JSON.stringify(FOES0));
{
  const F = FOES_ESC;
  for(const k of ['drone', 'drone2']) F[k].pat.push({n:'照準', d:0, dl:5, mark:1, wt:1});
  for(const k of ['linkA', 'linkB']) F[k].pat[1] = {n:'陣形', d:0, dl:4, armor:5};
  F.turret.pat[1] = {n:'装甲を重ねる', d:0, dl:4, armor:8};
  F.turretE.pat[1] = {n:'装甲を重ねる', d:0, dl:4, armor:10};
  F.exec.pat = [{n:'殴打', d:8, dl:6, p:'out'}, {n:'充填', d:0, dl:5, buff:3, wind:{w:3, poise:12}}, {n:'粉砕砲', d:22, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}];
  F.hacker.pat = [{n:'割り込み', kind:'delay', v:4, dl:7}, {n:'射撃', d:7, dl:5, p:'calc', counter:{w:5, d:3}}, {n:'ノイズ注入', d:0, dl:5, noise:2}];
  F.warden.pat[2] = {n:'修復', d:0, dl:5, heal:15, wind:{w:4, poise:15}};
  F.warden.phase.pat.splice(1, 0, {n:'増援要請', d:0, dl:5, summon:'escort', wind:{w:4, poise:15}});
}

const DECKS = {
  std:      D.startDeck.slice(),
  crack:    ['crackshot','crackshot','crackshot','scan','scan','rapid','rapid','jab','slash','guard','guard','wall'],
  timer:    ['timebomb','timebomb','timebomb','timebomb','jab','jab','slash','hack','guard','guard','wall','reload'],
  delay:    ['hack','hack','hack','backflow','backflow','jab','jab','slash','slash','guard','wall','scan'],
  counter:  ['parry','parry','parry','slash','slash','jab','jab','guard','wall','hack','scan','overclock'],
  swift:    ['overclock','overclock','overclock','flick','flick','jab','jab','slash','slash','guard','guard','scan'],
  fortress: ['wall','wall','wall','guard','guard','guard','parry','jab','jab','slash','slash','scan'],
  light:    ['jab','jab','jab','jab','rapid','rapid','flick','flick','guard','guard','guard','hack','reload'],
  heavy:    ['slash','slash','slash','slash','wall','wall','blow','blow','emp','backflow','scatter'],
};
const ARCH = ['std', 'crack', 'timer', 'delay', 'counter', 'swift', 'fortress'];
const NAME = {std:'標準', crack:'クラック', timer:'時限', delay:'遅延', counter:'見切り', swift:'加速', fortress:'要塞', light:'軽い', heavy:'重い'};

// 強さの表: コスト1〜2のカード(とコスト0)の数値に掛ける。flat は今のまま、prop は時間にほぼ比例
const CURVES = {flat:1, mid:0.75, prop:0.5};
function setCurve(name){
  const f = CURVES[name]; const out = JSON.parse(JSON.stringify(CARDS0));
  for(const c of Object.values(out)){
    if(c.junk || c.cost >= 3) continue;
    const sc = x => Math.max(1, Math.round(x * f));
    if(c.dmg) c.dmg.n = sc(c.dmg.n);
    if(c.block) c.block = sc(c.block);
    if(c.timer) c.timer.dmg.n = sc(c.timer.dmg.n);
  }
  D.cards = out;
}
function setFoes(F, m){
  const out = JSON.parse(JSON.stringify(F)); const sc = x => Math.max(1, Math.round(x * m));
  const fix = pat => pat.forEach(a => { if(a.d > 0) a.d = sc(a.d); if(a.counter) a.counter.d = sc(a.counter.d); });
  for(const f of Object.values(out)){ fix(f.pat); if(f.phase) fix(f.phase.pat); if(f.react) f.react.d = sc(f.react.d); }
  D.foes = out;
}

// 区切りの型(econ)と付け足し
const ECON = {
  T:  {name:'今(3サイクルで1枚届く)', econ:null},
  A6: {name:'固定ターン6・5枚', econ:{type:'turn', len:6, hand:5, blockReset:true}},
  A9: {name:'固定ターン9・5枚', econ:{type:'turn', len:9, hand:5, blockReset:true}},
  A6k:{name:'固定ターン6・5枚・ブロック残る', econ:{type:'turn', len:6, hand:5, blockReset:false}},
  B2: {name:'再装填2・5枚・始めにブロック消える', econ:{type:'reload', r:2, hand:5, blockReset:'start'}},
  B4: {name:'再装填4・5枚・始めにブロック消える', econ:{type:'reload', r:4, hand:5, blockReset:'start'}},
  B2k:{name:'再装填2・5枚・ブロック残る', econ:{type:'reload', r:2, hand:5, blockReset:false}},
  B2e:{name:'再装填2・5枚・始めに消える・排莢2', econ:{type:'reload', r:2, hand:5, blockReset:'start', eject:2}},
  C:  {name:'熱(再装填1+回数)・5枚・始めに消える', econ:{type:'reload', r:1, heat:1, hand:5, blockReset:'start'}},
  D:  {name:'弾倉(区切り1)', econ:{type:'mag', r:1, cap:7}},
  // 2回目: 良かった型の詰め
  A7: {name:'固定ターン7・5枚', econ:{type:'turn', len:7, hand:5, blockReset:true}},
  A8: {name:'固定ターン8・5枚', econ:{type:'turn', len:8, hand:5, blockReset:true}},
  A6h4:{name:'固定ターン6・4枚', econ:{type:'turn', len:6, hand:4, blockReset:true}},
  A8h6:{name:'固定ターン8・6枚', econ:{type:'turn', len:8, hand:6, blockReset:true}},
  B3: {name:'再装填3・5枚・始めに消える', econ:{type:'reload', r:3, hand:5, blockReset:'start'}},
  B3h4:{name:'再装填3・4枚・始めに消える', econ:{type:'reload', r:3, hand:4, blockReset:'start'}},
  B3h6:{name:'再装填3・6枚・始めに消える', econ:{type:'reload', r:3, hand:6, blockReset:'start'}},
  B3end:{name:'再装填3・5枚・終わりに消える', econ:{type:'reload', r:3, hand:5, blockReset:'end'}},
  B4h6:{name:'再装填4・6枚・始めに消える', econ:{type:'reload', r:4, hand:6, blockReset:'start'}},
  B3keep:{name:'再装填3・5枚まで補充(残す)・終わりに消える', econ:{type:'reload', r:3, hand:5, blockReset:'end', keep:true}},
  B4keep:{name:'再装填4・5枚まで補充(残す)・始めに消える', econ:{type:'reload', r:4, hand:5, blockReset:'start', keep:true}},
  C2: {name:'熱(再装填2+回数)・5枚・始めに消える', econ:{type:'reload', r:2, heat:1, hand:5, blockReset:'start'}},
};
const LOSS = (st, run0) => (run0.body - st.run.body) + Object.values(st.b.parts).reduce((a, p) => a + (p.max - p.cur), 0);
let R = E.rngFrom(1);
function makeRun(deck){ const run = E.newRun(1); run.map = null; run.deck = deck.slice(); return run; }
const playable = b => b.hand.filter(c => c.k !== 'noise');
function autoAct(st, order){
  const b = st.b, acts = E.actions(st), hand = playable(b);
  if(!hand.length){ return acts.find(a => a.type === 'reload') || acts.find(a => a.type === 'wait') || acts.find(a => a.type === 'card'); }
  const k = order.find(x => hand.some(c => c.k === x)) || hand[0].k, c = D.cards[k];
  let t = null;
  if(c.tgt){ let m = Infinity; for(const e of b.foes) if(e.alive && e.hp < m){ m = e.hp; t = e.i; } }
  return acts.find(a => a.type === 'card' && a.k === k && a.t === t) || acts.find(a => a.type === 'card' && a.k === k);
}
function rollout(st, order){ for(let n = 0; n < 300; n++){ const o = E.doAction(st, autoAct(st, order)); if(o.won || o.dead) return; } }
function chooseRoll(st, order, run0, K, stats){
  const acts = E.actions(st).filter(a => a.type !== 'swap' && !(a.type === 'card' && a.k === 'noise' && playable(st.b).length));
  let best = -Infinity, bestA = null, outs = new Set(), anyJ = false;
  for(const a of acts){
    let v = 0;
    for(let k = 0; k < K; k++){
      const s2 = E.clone(st); const b0 = s2.b.breaks || 0; const o = E.doAction(s2, a);
      if(k === 0){ outs.add(o.interruptedAt !== null ? 'i' : 'n'); if(o.justs.length || (s2.b.breaks || 0) > b0) anyJ = true; }
      if(!o.won && !o.dead) rollout(s2, order);
      v += -LOSS(s2, run0) - (s2.run.body <= 0 ? 30 : 0) - 0.01 * s2.b.T;
    }
    v = v / K + R() * 1e-6;
    if(v > best){ best = v; bestA = a; }
  }
  if(stats){
    const hand = playable(st.b);
    stats.dp++; if(outs.size > 1 || anyJ) stats.rel++;
    stats.hand += hand.length; if(hand.length <= 1) stats.starve++;
    stats.kinds += new Set(hand.map(c => c.k)).size;
    const au = autoAct(st, order); if(au.type !== bestA.type || au.k !== bestA.k || (au.t !== bestA.t && st.b.foes.filter(e => e.alive).length > 1)) stats.off++;
    if(bestA.type === 'wait' && hand.length) stats.waits++;
    if(bestA.type === 'reload'){ stats.reloads++; if(hand.length) stats.early++; }
  }
  return bestA;
}
function battle(enc, deck, agent, order, K){
  const run0 = makeRun(deck), st = E.newBattle(E.clone(run0), enc);
  const stats = {dp:0, rel:0, off:0, waits:0, reloads:0, early:0, hand:0, starve:0, kinds:0};
  let o = null, intr = 0, justs = 0;
  for(let n = 0; n < 400; n++){
    const a = agent === 'auto' ? autoAct(st, order) : chooseRoll(st, order, run0, K, stats);
    o = E.doAction(st, a); if(o.interruptedAt !== null) intr++; justs += o.justs.length;
    if(o.won || o.dead) break;
  }
  const b = st.b;
  return {loss:Math.min(83, LOSS(st, run0)), won:!!(o && o.won), T:b.T, intr, justs, breaks:b.breaks || 0, ...stats};
}
const ENCS = Object.keys(D.encounters);
function measure(deckName, agent, N, seed, order, K){
  R = E.rngFrom(seed); E.setRandom(R);
  const sum = {}, per = {};
  for(const e of ENCS){ per[e] = 0; for(let i = 0; i < N; i++){ const r = battle(e, DECKS[deckName], agent, order, K || 3); per[e] += r.loss / N; for(const [k, v] of Object.entries(r)) sum[k] = (sum[k] || 0) + +v; } }
  const n = N * ENCS.length, out = {per};
  for(const [k, v] of Object.entries(sum)) out[k] = +(v / n).toFixed(3);
  out.offRate = sum.dp ? sum.off / sum.dp : 0; out.relRate = sum.dp ? sum.rel / sum.dp : 0; out.starveRate = sum.dp ? sum.starve / sum.dp : 0;
  out.avgHand = sum.dp ? sum.hand / sum.dp : 0; out.avgKinds = sum.dp ? sum.kinds / sum.dp : 0;
  return out;
}
function bestOrder(deckName, N, iters, seed){
  const types = [...new Set(DECKS[deckName].concat(E.partCards(makeRun([]))))];
  const ev = o => measure(deckName, 'auto', N, seed, o).loss;
  const r = E.rngFrom(seed * 7 + 3); let best = null, bv = Infinity;
  for(let s = 0; s < 2; s++){
    let o = types.slice(); for(let i = o.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    let v = ev(o);
    for(let it = 0; it < iters; it++){ const a = Math.floor(r() * o.length), b = Math.floor(r() * o.length); if(a === b) continue; const o2 = o.slice(); [o2[a], o2[b]] = [o2[b], o2[a]]; const v2 = ev(o2); if(v2 <= v){ o = o2; v = v2; } }
    if(v < bv){ bv = v; best = o; }
  }
  return best;
}
// 条件を1つ回す。cond = {econ, curve, wait, foes}
function runCond(cond, SEED, NR){
  E.RULE.econ = cond.econ; E.RULE.freeWait = cond.wait; setCurve(cond.curve);
  const F = cond.foes === 'esc' ? FOES_ESC : FOES0;
  setFoes(F, 1);
  let o = bestOrder('std', 3, 20, 11);
  let lo = 0.3, hi = 4;
  for(let k = 0; k < 8; k++){ const m = (lo + hi) / 2; setFoes(F, m); const v = measure('std', 'auto', 4, 99, o).loss; if(v > 30) hi = m; else lo = m; }
  const mult = +((lo + hi) / 2).toFixed(3); setFoes(F, mult);
  const r = {cond, mult, auto:{}, roll:{}, order:{}};
  for(const d of Object.keys(DECKS)){
    r.order[d] = bestOrder(d, 3, 25, 11);
    r.auto[d] = measure(d, 'auto', 10, SEED, r.order[d]);
    r.roll[d] = measure(d, 'roll', NR, SEED, r.order[d], 3);
  }
  const al = ARCH.map(d => r.roll[d].loss);
  r.archSpread = Math.max(...al) - Math.min(...al);
  r.archWorst = ARCH[al.indexOf(Math.max(...al))];
  r.archMean = al.reduce((a, b) => a + b, 0) / al.length;
  r.turtle = r.roll.fortress.loss - r.roll.std.loss;
  r.price = r.roll.light.loss - r.roll.heavy.loss;
  const S = r.roll.std;
  r.starve = ARCH.reduce((a, d) => a + r.roll[d].starveRate, 0) / ARCH.length;
  r.off = ARCH.reduce((a, d) => a + r.roll[d].offRate, 0) / ARCH.length;
  r.rel = ARCH.reduce((a, d) => a + r.roll[d].relRate, 0) / ARCH.length;
  r.think = ARCH.reduce((a, d) => a + r.auto[d].loss - r.roll[d].loss, 0) / ARCH.length;
  r.avgHand = ARCH.reduce((a, d) => a + r.roll[d].avgHand, 0) / ARCH.length;
  r.T = S.T; r.intr = S.intr; r.justs = S.justs; r.reloads = S.reloads; r.early = S.early; r.waits = S.waits;
  return r;
}
module.exports = {E, D, DECKS, ARCH, NAME, ECON, CURVES, FOES_ESC, FOES0, runCond, setCurve, setFoes};

if(require.main === module){
  const ids = (process.argv[2] || 'T-flat-w').split(','), SEED = +(process.argv[3] || 5), NR = +(process.argv[4] || 4), FO = process.argv[5] || 'base';
  const rows = [], f = x => (+x).toFixed(1), pct = x => (x * 100).toFixed(0) + '%';
  // 記号: <区切りの型>-<強さの表>-<w 待てる | n 待てない>
  for(const id of ids){
    const [ek, cv, wv] = id.split('-'); const t0 = Date.now();
    const cond = {econ: ECON[ek].econ, curve: cv, wait: wv !== 'n', foes: FO};
    const r = runCond(cond, SEED, NR); r.id = id; r.name = `${ECON[ek].name} / ${cv} / ${cond.wait ? '待てる' : '待てない'} / 敵${FO}`;
    rows.push(r);
    console.log(`${id} ${r.name}  敵×${r.mult}  (${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
    console.log(`  読み: ${Object.keys(DECKS).map(d => NAME[d] + f(r.roll[d].loss)).join(' ')}`);
    console.log(`  アーキタイプの差${f(r.archSpread)}(苦しい: ${NAME[r.archWorst]}) 平均${f(r.archMean)} 亀の得${f(r.turtle)} 値段表(軽−重)${f(r.price)}`);
    console.log(`  細々${pct(r.starve)} 手札${f(r.avgHand)} 定石外れ${pct(r.off)} 効く判断${pct(r.rel)} 考える価値${f(r.think)} | 時間${f(r.T)} 中断${f(r.intr)} JUST${f(r.justs)} 区切り${f(r.reloads)}(手札を残して${f(r.early)}) 待った${f(r.waits)}`);
  }
  fs.writeFileSync(path.join(__dirname, `turns_${ids.join('_')}_${FO}_${SEED}.json`.replace(/[^\w.-]/g, '')), JSON.stringify(rows.map(r => ({...r, roll:Object.fromEntries(Object.entries(r.roll).map(([k, v]) => [k, {...v, per:undefined}])), auto:Object.fromEntries(Object.entries(r.auto).map(([k, v]) => [k, {...v, per:undefined}]))})), null, 1));
}
