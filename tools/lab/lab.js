// 同時進行戦闘の実験モデル(ゲーム本体とは別の、条件を切り替えられる小さなモデル)
// 決め方 decide: 'free'(行動が終わるたびに1枚) / 'window'(次の敵の行動までを先に組む)
// 補給 economy: 'refill'(使い切ると5枚) / 'clock'(3サイクルで1枚、最大7枚)
// そのほか: overhead(全カードに構えを足す), impactFirst(効果が先・後が隙), interrupt, just
'use strict';
function rngFrom(seed){ let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = rngFrom(1);
const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// カード: 価値曲線 curve で強さを決める。std = コスト3の強さ
function cards(curve){
  const v = c => curve === 'lin' ? 3 * c : curve === 'flat' ? (c < 3 ? 9 * (0.55 + 0.15 * c) : 3 * c) : 3 * c;
  const out = {};
  for(const c of [1, 2, 3, 4, 6]){ out['A' + c] = {c, atk: Math.round(v(c))}; out['B' + c] = {c, blk: Math.round(v(c) * 1.1)}; }
  out.D1 = {c:1, dly:3}; out.D3 = {c:3, dly:4, all:true};
  out.R1 = {c:1, draw:2}; out.Rb = {c:1, draw:2, borrow:true}; out.R3 = {c:3, draw:2};
  return out;
}
const DECKS = {
  light: ['A1','A1','A1','A1','A1','A1','A2','B1','B1','B1','D1','D1'],
  mixed: ['A1','A1','A2','A3','A3','A4','B1','B1','B3','D1','A6','A2'],
  heavy: ['A3','A3','A4','A4','A6','A6','B3','B3','B4','D3','A3','B1'],
  drawC: ['A1','A1','A1','A1','A1','R1','R1','R1','B1','B1','D1','A2'],
  drawB: ['A1','A1','A1','A1','A1','Rb','Rb','Rb','B1','B1','D1','A2'],
  draw3: ['A1','A1','A1','A1','A1','R3','R3','R3','B1','B1','D1','A2'],
};
const ENC = {
  pair:  [{hp:40, r:4, pat:[{d:6, dl:6}]}, {hp:40, r:7, pat:[{d:6, dl:6}]}],
  chip:  [{hp:30, r:2, pat:[{d:3, dl:3}]}, {hp:70, r:5, pat:[{d:7, dl:6}, {d:7, dl:6}, {d:20, dl:8, ch:true}]}],
  boss:  [{hp:150, r:5, pat:[{d:7, dl:6}, {d:7, dl:4}, {d:26, dl:9, ch:true}]}, {hp:30, r:3, pat:[{d:4, dl:5}]}],
};
function newState(deck, enc, P){
  const st = {t:0, hp:60, block:0, hand:[], draw:shuffle(deck.slice()), disc:[], clockIn:3, dmgMul:P.dmgMul || 1,
    foes: ENC[enc].map((f, i) => ({i, hp:Math.round(f.hp * (P.hpMul || 1)), pat:f.pat, idx:0, r:f.r, alive:true})), justs:0, intr:0, taken:0, dealt:0, decisions:0, foeActs:0};
  drawN(st, 5, P); return st;
}
const cloneSt = s => ({...s, hand:s.hand.slice(), draw:s.draw.slice(), disc:s.disc.slice(), foes:s.foes.map(f => ({...f}))});
function drawN(st, n, P){ for(let k = 0; k < n; k++){ if(!st.draw.length){ st.draw = shuffle(st.disc); st.disc = []; } if(!st.draw.length) return; const c = st.draw.pop(); if(P.economy === 'clock' && st.hand.length >= (P.handMax || 7)) st.disc.push(c); else st.hand.push(c); } }
const cur = f => f.pat[f.idx];
const alive = st => st.foes.filter(f => f.alive);
function nextFoe(st){ let m = Infinity; for(const f of st.foes) if(f.alive && f.r < m) m = f.r; return m; }
function effect(st, C, tgt, P){
  if(C.atk){ const f = st.foes[tgt]; if(f && f.alive){ const d = Math.min(f.hp, C.atk); f.hp -= d; st.dealt += d; if(f.hp <= 0) f.alive = false;
    // 構え崩し: 敵が構えている間(行動の windup サイクル前から)に、poise 以上の一撃が入ると、その行動を潰す
    else if(P && P.windup && f.r > 0 && f.r <= P.windup && C.atk >= P.poise){ f.idx = (f.idx + 1) % f.pat.length; f.r = cur(f).dl; st.breaks = (st.breaks || 0) + 1; } } }
  if(C.blk) st.block += C.blk;
  if(C.draw){ drawN(st, C.draw, P); if(C.borrow) st.clockIn += C.draw * (P.D || 3); }
  if(C.dly){ if(C.all){ for(const f of alive(st)) f.r += C.dly; } else { const f = st.foes[tgt]; if(f && f.alive) f.r += C.dly; } }
}
// 1枚を最後まで進める。戻り値: {interrupted}
function play(st, key, tgt, P, CS){
  const C = CS[key], hi = st.hand.indexOf(key); st.hand.splice(hi, 1);
  let left = C.c + (P.overhead || 0), casting = true, interrupted = false;
  if(P.impactFirst){ effect(st, C, tgt, P); casting = false; }
  while(left > 0){
    left--; st.t++;
    for(const f of st.foes) if(f.alive) f.r--;
    if(P.economy === 'clock' && --st.clockIn <= 0){ st.clockIn = P.D || 3; drawN(st, 1, P); }
    if(left === 0 && casting){
      if(P.just !== false) for(const f of st.foes) if(f.alive && f.r <= 0 && cur(f).ch){ f.idx = (f.idx + 1) % f.pat.length; f.r = cur(f).dl; st.justs++; }
      effect(st, C, tgt, P); casting = false;
      if(!alive(st).length) break;
    }
    let hurt = false;
    for(const f of st.foes){
      if(!f.alive || f.r > 0) continue;
      const raw = Math.round(cur(f).d * st.dmgMul), ab = Math.min(st.block, raw); st.block -= ab;
      if(raw - ab > 0){ st.hp -= raw - ab; st.taken += raw - ab; hurt = true; }
      st.foeActs++;
      f.idx = (f.idx + 1) % f.pat.length; f.r = cur(f).dl;
    }
    if(st.hp <= 0) break;
    if(casting && hurt && P.interrupt !== false){ interrupted = true; st.intr++; break; }
  }
  st.disc.push(key);
  return {interrupted};
}
function idle(st, n, P){ // 何もせず待つ
  for(let k = 0; k < n; k++){
    st.t++;
    for(const f of st.foes) if(f.alive) f.r--;
    if(P.economy === 'clock' && --st.clockIn <= 0){ st.clockIn = P.D || 3; drawN(st, 1, P); }
    for(const f of st.foes){ if(!f.alive || f.r > 0) continue; const raw = Math.round(cur(f).d * st.dmgMul), ab = Math.min(st.block, raw); st.block -= ab; if(raw - ab > 0){ st.hp -= raw - ab; st.taken += raw - ab; } st.foeActs++; f.idx = (f.idx + 1) % f.pat.length; f.r = cur(f).dl; }
    if(st.hp <= 0) return;
  }
}
// 候補: free → [ [ [key, tgt] ] ](1枚) / window → 次の敵の行動まで届く並び
function options(st, P, CS){
  const tg = alive(st).map(f => f.i), types = [...new Set(st.hand)];
  if(P.decide === 'window'){
    const s = nextFoe(st), out = [], seen = new Set();
    const rec = (hand, seq, sum) => {
      if(out.length > 400) return;
      if(sum >= s || !hand.length){ if(seq.length){ const k = seq.join(','); if(!seen.has(k)){ seen.add(k); out.push(seq.slice()); } } return; }
      for(const key of [...new Set(hand)]){ const h2 = hand.slice(); h2.splice(h2.indexOf(key), 1); seq.push(key); rec(h2, seq, sum + CS[key].c + (P.overhead || 0)); seq.pop(); }
    };
    rec(st.hand.slice(), [], 0);
    const res = []; for(const seq of out){ const needT = seq.some(k => CS[k].atk || (CS[k].dly && !CS[k].all)); for(const t of needT ? tg : [tg[0]]) res.push(seq.map(k => [k, t])); }
    return res;
  }
  const res = []; for(const key of types){ const C = CS[key]; const needT = C.atk || (C.dly && !C.all); for(const t of needT ? tg : [tg[0]]) res.push([[key, t]]); }
  return res;
}
function runPlan(st, plan, P, CS){
  st.decisions++;
  for(const [k, t] of plan){
    if(!st.hand.includes(k)) break;
    const o = play(st, k, st.foes[t].alive ? t : (alive(st)[0] || {i:t}).i, P, CS);
    if(st.hp <= 0 || !alive(st).length) return;
    if(o.interrupted) break;
  }
}
function settle(st, P){ // 手札がないとき
  if(st.hand.length) return;
  if(P.economy === 'refill') drawN(st, 5, P); else idle(st, 1, P);
}
const threat = st => alive(st).reduce((a, f) => a + f.pat.reduce((x, y) => x + y.d, 0) * st.dmgMul / f.pat.reduce((x, y) => x + y.dl, 0), 0);
function score(before, st, P, lam){
  if(!alive(st).length) return 1e4 - st.t;
  if(st.hp <= 0) return -1e4;
  let nh = 0; for(const f of alive(st)) nh = Math.max(nh, cur(f).d * st.dmgMul);
  const kills = alive(before).length - alive(st).length;
  return (st.dealt - before.dealt) + 6 * kills + 4 * (st.justs - before.justs) - 1.6 * (st.taken - before.taken) + 0.5 * Math.min(st.block, nh) - lam * (st.t - before.t) + (P.economy === 'clock' ? 1.0 * st.hand.length : 0);
}
function choose(st, P, CS, agent, stats){
  const opts = options(st, P, CS);
  if(agent === 'random') return opts[Math.floor(R() * opts.length)];
  const lam = threat(st);
  let best = -Infinity, bestO = null, outcomes = new Set(), anyJust = false;
  for(const o of opts){
    const s2 = cloneSt(st); const i0 = s2.intr, j0 = s2.justs; runPlan(s2, o, P, CS);
    outcomes.add(s2.intr > i0 ? 'i' : 'n'); if(s2.justs > j0) anyJust = true;
    let v = score(st, s2, P, lam);
    if(agent === 'look' && P.decide === 'free' && alive(s2).length && s2.hp > 0){
      settle(s2, P); let b2 = -Infinity;
      for(const o2 of options(s2, P, CS)){ const s3 = cloneSt(s2); runPlan(s3, o2, P, CS); b2 = Math.max(b2, score(st, s3, P, lam)); }
      if(b2 > -Infinity) v = b2;
    }
    v += R() * 1e-6;
    if(v > best){ best = v; bestO = o; }
  }
  if(stats){ stats.dp++; if(outcomes.size > 1 || anyJust) stats.relevant++; }
  return bestO;
}
function battle(deck, enc, P, agent, CS){
  const st = newState(deck, enc, P), stats = {dp:0, relevant:0};
  for(let n = 0; n < 500 && st.hp > 0 && alive(st).length; n++){
    settle(st, P); if(st.hp <= 0 || !alive(st).length) break;
    if(!st.hand.length) continue;
    runPlan(st, choose(st, P, CS, agent, stats), P, CS);
  }
  return {won: st.hp > 0 && !alive(st).length, breaks: st.breaks || 0, taken: st.taken, t: st.t, justs: st.justs, intr: st.intr, decisions: st.decisions, foeActs: st.foeActs, rel: stats.dp ? stats.relevant / stats.dp : 0};
}
function measure(P, deckName, agent, N, seed){
  R = rngFrom(seed || 7); const CS = cards(P.curve || 'lin'); const out = {won:0, taken:0, t:0, justs:0, intr:0, breaks:0, dpe:0, rel:0, n:0};
  for(let i = 0; i < N; i++) for(const enc of Object.keys(ENC)){
    const r = battle(DECKS[deckName], enc, P, agent, CS); out.n++;
    out.breaks += r.breaks; out.won += r.won; out.taken += Math.min(60, r.taken); out.t += r.t; out.justs += r.justs; out.intr += r.intr; out.dpe += r.foeActs ? r.decisions / r.foeActs : 0; out.rel += r.rel;
  }
  for(const k of ['won','taken','t','justs','intr','breaks','dpe','rel']) out[k] = +(out[k] / out.n).toFixed(3);
  return out;
}
// 難しさを揃える: 混ぜたデッキ+1手読みの被ダメージが target になる dmgMul を探す
function calibrate(P, target, N){
  let lo = 0.3, hi = 4;
  for(let k = 0; k < 9; k++){ const m = (lo + hi) / 2; const r = measure({...P, dmgMul:m}, 'mixed', 'greedy', N, 99); if(r.taken > target) hi = m; else lo = m; }
  return +((lo + hi) / 2).toFixed(3);
}
module.exports = {measure, calibrate, DECKS, ENC, cards};
