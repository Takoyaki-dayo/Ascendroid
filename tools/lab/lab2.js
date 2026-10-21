// 実験モデル2: 敵の行動の複雑さを切り替える
// 土台は 0.6 相当(自由に決める、手札は3サイクルで1枚、3未満は強さが平ら、中断とJUSTあり)
// 敵の行動(move)が持てる属性:
//   d ダメージ / dl 前の行動からの間隔 / ch 溜め技(JUSTで潰れる) / hits 多段(1サイクルおきに d を hits 回)
//   wind {w, poise}  構え: 行動の w サイクル前から、poise 以上の一撃で潰れる
//   guard {w, s}     ガード: 行動の w サイクル前から、s までのダメージを防ぐ(行動で消える)
//   counter {w, d}   反撃の構え: 行動の w サイクル前から、攻撃を受けるたびに d を返す
//   rec              隙: 行動のあと rec サイクルの間、受けるダメージ1.5倍
//   buff, all        強化: 行動のあと攻撃力 +buff(all なら味方全員)
// 敵そのものの属性: react {min, d}(コスト min 以上を使い始めると1サイクル後に撃つ) / sync(同時に撃つと+sync)
//   ai:'rand' と w(重み)で行動を選ぶ(同じ行動は3回続けない) / phase {at, pat}(耐久が at 割を切ると行動が変わる)
// 複雑さの段階 level(simplify で変換):
//   0 今の形(属性は溜め・反応・連携だけ、行動は決まった順) / 1 全部の攻撃に構え / 2 一部の行動だけに構え
//   3 全属性(決まった順) / 4 全属性+分岐+段階変化
'use strict';
function rngFrom(seed){ let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = rngFrom(1);
const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// カード(0.6 相当の平らな曲線): 1→6, 2→8, 3→9, 4→12, 6→18
const CS = {};
for(const c of [1, 2, 3, 4, 6]){ const v = c < 3 ? Math.round(9 * (0.55 + 0.15 * c)) : 3 * c; CS['A' + c] = {c, atk:v}; CS['B' + c] = {c, blk:Math.round(v * 1.1)}; }
CS.D1 = {c:1, dly:3}; CS.D3 = {c:3, dly:4, all:true}; CS.R3 = {c:3, draw:2};
const DECKS = {
  light: ['A1','A1','A1','A1','A1','A1','A2','B1','B1','B1','D1','D1'],
  mixed: ['A1','A1','A2','A3','A3','A4','B1','B1','B3','D1','A6','A2'],
  heavy: ['A3','A3','A4','A4','A6','A6','B3','B3','B4','D3','A3','B1'],
  draw:  ['A1','A1','A1','A1','A1','R3','R3','R3','B1','B1','D1','A2'],
};

// 敵(全属性の形)。単純な段階は simplify で作る
const FOES = {
  drone:  {name:'警備ドローン', hp:40, r:4, ai:'rand', pat:[
    {n:'射撃', d:6, dl:6, w:2}, {n:'連射', d:3, hits:2, dl:5, w:1}]},
  scout:  {name:'斥候', hp:30, r:2, ai:'rand', pat:[
    {n:'刺突', d:3, dl:3, w:2}, {n:'踏み込み', d:7, dl:5, wind:{w:2, poise:6}, rec:2, w:1}]},
  shield: {name:'盾ユニット', hp:55, r:3, pat:[
    {n:'防壁', d:0, dl:5, guard:{w:4, s:14}}, {n:'突進', d:11, dl:5, wind:{w:3, poise:12}, rec:3}, {n:'射撃', d:5, dl:4}],
    phase:{at:0.5, pat:[{n:'突進', d:11, dl:5, wind:{w:3, poise:12}, rec:3}, {n:'防壁', d:0, dl:4, guard:{w:3, s:14}}]}},
  mirror: {name:'反撃機', hp:50, r:5, pat:[
    {n:'反撃の構え', d:8, dl:6, counter:{w:5, d:3}}, {n:'射撃', d:5, dl:5}, {n:'射撃', d:5, dl:5}]},
  exec:   {name:'処刑ユニット', hp:70, r:5, pat:[
    {n:'殴打', d:7, dl:6}, {n:'殴打', d:7, dl:6}, {n:'粉砕砲', d:20, dl:8, ch:true, wind:{w:3, poise:12}, rec:3}],
    phase:{at:0.5, pat:[{n:'殴打', d:7, dl:5}, {n:'粉砕砲', d:20, dl:7, ch:true, wind:{w:3, poise:12}, rec:3}]}},
  turret: {name:'迎撃タレット', hp:45, r:6, react:{min:4, d:6}, pat:[
    {n:'砲撃', d:8, dl:7}, {n:'装甲', d:0, dl:4, guard:{w:4, s:10}}]},
  amp:    {name:'増幅器', hp:35, r:4, ai:'rand', pat:[
    {n:'増幅', d:0, dl:6, buff:2, all:true, w:1}, {n:'射撃', d:4, dl:5, w:2}]},
  link:   {name:'連携ドローン', hp:32, r:6, sync:4, pat:[{n:'連携射撃', d:4, dl:6}]},
  warden: {name:'ウォーデン', hp:160, r:5, react:{min:6, d:8}, pat:[
    {n:'照射', d:7, dl:6}, {n:'照射', d:7, dl:4}, {n:'防壁', d:0, dl:5, guard:{w:4, s:16}}, {n:'消去', d:26, dl:9, ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{n:'照射', d:7, dl:5}, {n:'報復態勢', d:9, dl:6, counter:{w:5, d:3}}, {n:'消去', d:26, dl:8, ch:true, wind:{w:4, poise:15}, rec:3}]}},
};
// 問いを持つ敵: 1体ごとに「正しい答え」が変わるくらい属性を中心に据えた版(P.roster = 'q')
const FOES_Q = {
  drone:  {name:'警備ドローン', hp:40, r:4, ai:'rand', pat:[
    {n:'射撃', d:6, dl:6, w:2}, {n:'連射', d:3, hits:2, dl:5, w:1}]},
  scout:  {name:'斥候', hp:30, r:3, ai:'rand', pat:[
    {n:'乱れ突き', d:3, hits:3, dl:6, w:2}, {n:'踏み込み', d:7, dl:5, wind:{w:2, poise:6}, rec:2, w:1}]},
  shield: {name:'盾ユニット', hp:55, r:4, pat:[
    {n:'突進', d:12, dl:8, guard:{w:8, s:25}, rec:3}],
    phase:{at:0.5, pat:[{n:'突進', d:12, dl:7, guard:{w:7, s:25}, rec:3}, {n:'射撃', d:5, dl:3}]}},
  mirror: {name:'反撃機', hp:50, r:5, pat:[
    {n:'射撃', d:6, dl:6, counter:{w:6, d:4}}]},
  exec:   {name:'処刑ユニット', hp:70, r:5, pat:[
    {n:'殴打', d:7, dl:6}, {n:'殴打', d:7, dl:6}, {n:'粉砕砲', d:24, dl:8, ch:true, wind:{w:4, poise:12}, rec:3}],
    phase:{at:0.5, pat:[{n:'殴打', d:7, dl:5}, {n:'粉砕砲', d:24, dl:7, ch:true, wind:{w:4, poise:12}, rec:3}]}},
  turret: {name:'迎撃タレット', hp:45, r:6, react:{min:3, d:8}, pat:[
    {n:'砲撃', d:8, dl:7}]},
  amp:    {name:'増幅器', hp:32, r:4, ai:'rand', pat:[
    {n:'増幅', d:0, dl:6, buff:3, all:true, w:2}, {n:'射撃', d:4, dl:5, w:1}]},
  link:   {name:'連携ドローン', hp:32, r:6, sync:6, pat:[{n:'連携射撃', d:4, dl:6}]},
  warden: {name:'ウォーデン', hp:160, r:5, react:{min:6, d:8}, pat:[
    {n:'照射', d:7, dl:6}, {n:'防壁', d:7, dl:6, guard:{w:6, s:25}, rec:3}, {n:'消去', d:26, dl:9, ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{n:'照射', d:7, dl:5}, {n:'報復態勢', d:9, dl:6, counter:{w:6, d:4}}, {n:'消去', d:26, dl:8, ch:true, wind:{w:4, poise:15}, rec:3}]}},
};
const ENC = {
  pair:   ['drone', 'drone'],
  chip:   ['scout', 'exec'],
  shield: ['shield', 'drone'],
  mirror: ['mirror', 'scout'],
  amp:    ['amp', 'exec'],
  react:  ['turret', 'link', 'link'],
  boss:   ['warden', 'drone'],
};

// 段階に合わせて敵を単純にする
function simplifyMove(m, level, amp){
  const o = {n:m.n, d:m.d, dl:m.dl};
  if(m.ch) o.ch = true;
  if(level <= 2){ if(m.hits) o.d = m.d * m.hits; }   // 多段は1発にまとめる
  else { for(const k of ['hits','guard','counter','rec','buff','all']) if(m[k] !== undefined) o[k] = m[k]; }
  if(level === 1 && o.d > 0) o.wind = {w:3, poise:12};
  if(level >= 2 && m.wind) o.wind = m.wind;
  if(m.w) o.w = m.w;
  if(amp && level >= 3){ // 属性を強くする: 正しい答えが変わるくらいに
    if(o.counter) o.counter = {w:o.counter.w, d:o.counter.d * 2};
    if(o.guard) o.guard = {w:o.guard.w + 1, s:Math.round(o.guard.s * 1.5)};
    if(o.buff) o.buff = Math.round(o.buff * 1.5);
    if(o.rec) o.rec = o.rec + 1;
  }
  return o;
}
function simplifyPat(pat, level, amp){
  let p = pat.map(m => simplifyMove(m, level, amp));
  if(level <= 2){ // ダメージのない行動は、間隔を次に足して消す
    const q = []; let carry = 0;
    for(const m of p){ if(m.d > 0){ q.push({...m, dl:m.dl + carry}); carry = 0; } else carry += m.dl; }
    if(carry && q.length) q[0] = {...q[0], dl:q[0].dl + carry};
    p = q;
  }
  return p;
}
function foeAt(key, level, amp, roster){
  const F = (roster === 'q' ? FOES_Q : FOES)[key], o = {name:F.name, hp:F.hp, r:F.r, pat:simplifyPat(F.pat, level, amp), ai:'loop'};
  if(F.react) o.react = amp && level >= 3 ? {min:F.react.min - 1, d:Math.round(F.react.d * 1.5)} : F.react;
  if(F.sync) o.sync = F.sync;
  if(level >= 4){ if(F.ai) o.ai = F.ai; if(F.phase) o.phase = {at:F.phase.at, pat:simplifyPat(F.phase.pat, level, amp)}; }
  return o;
}

function newState(deck, enc, P){
  const st = {t:0, hp:60, block:0, hand:[], draw:shuffle(deck.slice()), disc:[], clockIn:3, dmgMul:(P.dmgMul || 1) * (P.encMul && P.encMul[enc] || 1),
    foes: ENC[enc].map((k, i) => { const F = foeAt(k, P.level, P.amp, P.roster); return {i, key:k, hp:F.hp, max:F.hp, F, pat:F.pat, idx:0, r:F.r, alive:true, sh:0, vuln:0, str:0, chain:0, hist:[], reactIn:0, phased:false}; }),
    P, waits:0, justs:0, breaks:0, intr:0, absorbed:0, countered:0, vulnHits:0, taken:0, dealt:0, decisions:0, foeActs:0};
  for(const f of st.foes){ if(f.F.ai === 'rand'){ f.idx = pickRand(f); f.r = f.F.r; } setMove(f); }
  drawN(st, 5, P); return st;
}
const cloneSt = s => ({...s, hand:s.hand.slice(), draw:s.draw.slice(), disc:s.disc.slice(), foes:s.foes.map(f => ({...f, hist:f.hist.slice()}))});
function drawN(st, n, P){ for(let k = 0; k < n; k++){ if(!st.draw.length){ st.draw = shuffle(st.disc); st.disc = []; } if(!st.draw.length) return; const c = st.draw.pop(); if(st.hand.length >= 7) st.disc.push(c); else st.hand.push(c); } }
const cur = f => f.pat[f.idx];
const alive = st => st.foes.filter(f => f.alive);
function pickRand(f){
  const pat = f.pat, h = f.hist, n = h.length;
  const ok = pat.map((m, i) => !(n >= 2 && h[n - 1] === i && h[n - 2] === i));
  let tot = 0; pat.forEach((m, i) => { if(ok[i]) tot += m.w || 1; });
  let x = R() * tot;
  for(let i = 0; i < pat.length; i++){ if(!ok[i]) continue; x -= pat[i].w || 1; if(x <= 0) return i; }
  return pat.length - 1;
}
function setMove(f){ const m = cur(f); f.sh = m.guard ? m.guard.s : 0; }
// 次の行動へ
function advance(f){
  f.hist.push(f.idx); if(f.hist.length > 4) f.hist.shift();
  if(f.F.phase && !f.phased && f.hp < f.max * f.F.phase.at){ f.phased = true; f.pat = f.F.phase.pat; f.idx = 0; f.hist = []; }
  else if(f.F.ai === 'rand') f.idx = pickRand(f);
  else f.idx = (f.idx + 1) % f.pat.length;
  f.r = cur(f).dl; f.chain = 0; setMove(f);
}
const inWin = (f, a) => a && f.r > 0 && f.r <= a.w;
function hitFoe(st, f, atk, P){
  let d = atk; if(f.vuln > 0){ d = Math.round(d * (P && P.amp ? 2 : 1.5)); st.vulnHits++; }
  const m = cur(f);
  if(inWin(f, m.guard) && f.sh > 0){ const a = Math.min(f.sh, d); f.sh -= a; d -= a; st.absorbed += a; }
  if(inWin(f, m.counter)){ const t0 = st.taken; hurtMe(st, m.counter.d); st.countered += st.taken - t0; }
  d = Math.min(f.hp, d); f.hp -= d; st.dealt += d;
  if(f.hp <= 0){ f.alive = false; return; }
  if(inWin(f, m.wind) && atk >= m.wind.poise){ st.breaks++; advance(f); }
}
function hurtMe(st, raw){ raw = Math.round(raw * st.dmgMul); const ab = Math.min(st.block, raw); st.block -= ab; if(raw - ab > 0){ st.hp -= raw - ab; st.taken += raw - ab; return true; } return false; }
function effect(st, C, tgt, P){
  if(C.atk){ const f = st.foes[tgt]; if(f && f.alive) hitFoe(st, f, C.atk, P); }
  if(C.blk){ st.block += C.blk; if(P.blockLife) st.blockExp = st.t + P.blockLife; }
  if(C.draw) drawN(st, C.draw, P);
  if(C.dly){ for(const f of (C.all ? alive(st) : [st.foes[tgt]])) if(f && f.alive) f.r += C.dly; }
}
// 1サイクル進めて、敵の行動を処理する。戻り値: 自分が傷を負ったか
function tick(st, P, finish){
  st.t++;
  for(const f of st.foes) if(f.alive){ f.r--; if(f.vuln > 0) f.vuln--; }
  if(P.blockLife && st.block > 0 && st.t > st.blockExp) st.block = 0;
  if(--st.clockIn <= 0){ st.clockIn = 3; drawN(st, 1, P); }
  if(finish) finish();
  if(!alive(st).length) return false;
  let hurt = false; const acting = [];
  for(const f of st.foes){
    if(!f.alive) continue;
    if(f.reactIn > 0 && --f.reactIn === 0){ if(hurtMe(st, f.F.react.d)) hurt = true; st.foeActs++; }
    if(f.r <= 0) acting.push(f);
  }
  const syncN = acting.filter(f => f.F.sync).length;
  for(const f of acting){
    const m = cur(f);
    if(m.d > 0){ const d = m.d + f.str + (syncN >= 2 && f.F.sync ? f.F.sync : 0); if(hurtMe(st, d)) hurt = true; }
    st.foeActs++;
    if(m.hits && f.chain === 0 && m.hits > 1){ f.chain = m.hits - 1; f.r = 1; f.sh = 0; continue; }
    if(f.chain > 0){ f.chain--; if(f.chain > 0){ f.r = 1; continue; } }
    if(m.rec) f.vuln = m.rec + 1;
    if(m.buff){ for(const g of (m.all ? alive(st) : [f])) g.str += m.buff; }
    advance(f);
  }
  return hurt;
}
function play(st, key, tgt, P){
  const C = CS[key]; st.hand.splice(st.hand.indexOf(key), 1);
  if(C.c >= 1) for(const f of alive(st)) if(f.F.react && C.c >= f.F.react.min && !f.reactIn) f.reactIn = 1;
  let left = C.c, casting = true, interrupted = false;
  while(left > 0){
    left--;
    const fin = (left === 0) ? () => {
      for(const f of st.foes) if(f.alive && f.r <= 0 && cur(f).ch && !f.chain){ st.justs++; advance(f); }
      effect(st, C, tgt, P); casting = false;
    } : null;
    const hurt = tick(st, P, fin);
    if(st.hp <= 0 || !alive(st).length) break;
    if(casting && hurt){ interrupted = true; st.intr++; break; }
  }
  st.disc.push(key);
  return {interrupted};
}
function options(st){
  const tg = alive(st).map(f => f.i), res = [];
  for(const key of [...new Set(st.hand)]){ const C = CS[key]; const needT = C.atk || (C.dly && !C.all); for(const t of needT ? tg : [tg[0]]) res.push([key, t]); }
  if(st.P && st.P.wait) res.push(['W', tg[0]]);
  return res;
}
function runOpt(st, o, P){ st.decisions++; const [k, t] = o; if(k === 'W'){ st.waits++; for(let i = 0; i < (P.waitLen || 1) && st.hp > 0 && alive(st).length; i++) tick(st, P, null); return; } play(st, k, st.foes[t].alive ? t : alive(st)[0].i, P); }
function settle(st, P){ if(!st.hand.length) tick(st, P, null); }
const threat = st => alive(st).reduce((a, f) => a + f.pat.reduce((x, y) => x + (y.d + f.str) * (y.hits || 1), 0) * st.dmgMul / f.pat.reduce((x, y) => x + y.dl, 0), 0);
function score(before, st, lam){
  if(!alive(st).length) return 1e4 - st.t;
  if(st.hp <= 0) return -1e4;
  let nh = 0; for(const f of alive(st)) nh = Math.max(nh, (cur(f).d + f.str) * st.dmgMul);
  const kills = alive(before).length - alive(st).length;
  return (st.dealt - before.dealt) + 6 * kills + 4 * (st.justs - before.justs) + 4 * (st.breaks - before.breaks) - 1.6 * (st.taken - before.taken) + 0.5 * Math.min(st.block, nh) - lam * (st.t - before.t) + 1.0 * st.hand.length;
}
// 固定の手順: 優先順のいちばん上にある手札を、耐久が最も低い敵へ
function autopick(st, order){
  const k = order.find(x => st.hand.includes(x)) || st.hand[0];
  const C = CS[k]; let t = alive(st)[0].i;
  if(C.atk || C.dly){ let m = Infinity; for(const f of alive(st)) if(f.hp < m){ m = f.hp; t = f.i; } }
  return [k, t];
}
function rollout(st, P, order){
  for(let n = 0; n < 400 && st.hp > 0 && alive(st).length; n++){
    settle(st, P); if(st.hp <= 0 || !alive(st).length) break;
    if(!st.hand.length) continue;
    runOpt(st, autopick(st, order), P);
  }
}
function choose(st, P, agent, stats, order){
  const opts = options(st);
  if(agent === 'random') return opts[Math.floor(R() * opts.length)];
  if(agent === 'auto') return autopick(st, order);
  const lam = threat(st);
  let best = -Infinity, bestO = null, outcomes = new Set(), anyJ = false;
  for(const o of opts){
    const s2 = cloneSt(st); const i0 = s2.intr, j0 = s2.justs + s2.breaks; runOpt(s2, o, P);
    outcomes.add(s2.intr > i0 ? 'i' : 'n'); if(s2.justs + s2.breaks > j0) anyJ = true;
    let v = score(st, s2, lam);
    if(agent === 'roll'){ // 固定手順で最後まで打ち切った結果の平均(手順を1手だけ改良する読み)
      v = 0; const K = P.K || 3;
      for(let k = 0; k < K; k++){ const s3 = k ? cloneSt(st) : s2; if(k) runOpt(s3, o, P); rollout(s3, P, order); v += -Math.min(60, s3.taken) - (s3.hp <= 0 ? 20 : 0) - 0.01 * s3.t; }
      v /= K;
    }
    if(agent === 'look' && alive(s2).length && s2.hp > 0){
      settle(s2, P); let b2 = -Infinity;
      for(const o2 of options(s2)){ const s3 = cloneSt(s2); runOpt(s3, o2, P); b2 = Math.max(b2, score(st, s3, lam)); }
      if(b2 > -Infinity) v = b2;
    }
    v += R() * 1e-6;
    if(v > best){ best = v; bestO = o; }
  }
  if(stats){ stats.dp++; if(outcomes.size > 1 || anyJ) stats.relevant++;
    const ch = CS[bestO[0]] || {}; const hasL = st.hand.some(k => CS[k].atk && CS[k].c <= 2), hasH = st.hand.some(k => CS[k].atk && CS[k].c >= 3), hasB = st.hand.some(k => CS[k].blk), hasA = hasL || hasH;
    if(hasL && hasH && ch.atk){ stats.lh++; if(ch.c >= 3) stats.heavy++; }
    if(hasB && hasA){ stats.ba++; if(ch.blk) stats.blk++; }
    if(order){ const a = autopick(st, order); if(a[0] !== bestO[0] || (bestO[0] !== 'W' && alive(st).length > 1 && (CS[a[0]].atk || CS[a[0]].dly) && a[1] !== bestO[1])) stats.off++; } }
  return bestO;
}
function battle(deck, enc, P, agent, order){
  const st = newState(deck, enc, P), stats = {dp:0, relevant:0, off:0, lh:0, heavy:0, ba:0, blk:0};
  for(let n = 0; n < 500 && st.hp > 0 && alive(st).length; n++){
    settle(st, P); if(st.hp <= 0 || !alive(st).length) break;
    if(!st.hand.length) continue;
    runOpt(st, choose(st, P, agent, stats, order), P);
  }
  return {won: st.hp > 0 && !alive(st).length, taken: st.taken, t: st.t, justs: st.justs, breaks: st.breaks, intr: st.intr, decisions: st.decisions,
    absorbed: st.absorbed, countered: st.countered, vulnHits: st.vulnHits, waits: st.waits, lh:stats.lh, heavy:stats.heavy, ba:stats.ba, blk:stats.blk,
    rel: stats.dp ? stats.relevant / stats.dp : 0, off: stats.dp ? stats.off / stats.dp : 0};
}
// encs: 遭遇の一覧(省略で全部)。結果は遭遇ごとと平均
function measure(P, deckName, agent, N, seed, opt = {}){
  R = rngFrom(seed || 7);
  const encs = opt.encs || Object.keys(ENC), per = {}, KS = ['won','t','justs','breaks','intr','decisions','rel','off','absorbed','countered','vulnHits','waits'], out = {taken:0, n:0};
  for(const k of KS) out[k] = 0;
  for(const e of encs) per[e] = {taken:0, won:0, n:0, lh:0, heavy:0, ba:0, blk:0};
  for(let i = 0; i < N; i++) for(const e of encs){
    const r = battle(DECKS[deckName], e, P, agent, opt.order); out.n++;
    for(const k of KS) out[k] += +r[k];
    out.taken += Math.min(60, r.taken); per[e].taken += Math.min(60, r.taken); per[e].won += r.won; per[e].n++; for(const k of ['lh','heavy','ba','blk']) per[e][k] += r[k];
  }
  for(const k of [...KS, 'taken']) out[k] = +(out[k] / out.n).toFixed(3);
  for(const e of encs){ const q = per[e]; q.taken = +(q.taken / q.n).toFixed(2); q.won = +(q.won / q.n).toFixed(2);
    q.heavyRate = q.lh ? +(q.heavy / q.lh).toFixed(3) : null; q.blockRate = q.ba ? +(q.blk / q.ba).toFixed(3) : null; }
  out.per = per;
  return out;
}
function calibrate(P, target, N, agent = 'greedy', order){
  let lo = 0.3, hi = 4;
  for(let k = 0; k < 9; k++){ const m = (lo + hi) / 2; const r = measure({...P, dmgMul:m}, 'mixed', agent, N, 99, {order}); if(r.taken > target) hi = m; else lo = m; }
  return +((lo + hi) / 2).toFixed(3);
}
// 遭遇ごとに難しさを揃える(戻り値: 遭遇→攻撃力の倍率)
function calibrateEnc(P, target, N, agent, order){
  const out = {};
  for(const e of Object.keys(ENC)){
    let lo = 0.15, hi = 4;
    for(let k = 0; k < 9; k++){ const m = (lo + hi) / 2; const r = measure({...P, dmgMul:1, encMul:{[e]:m}}, 'mixed', agent, N, 99, {order, encs:[e]}); if(r.taken > target) hi = m; else lo = m; }
    out[e] = +((lo + hi) / 2).toFixed(3);
  }
  return out;
}
// 最良の固定手順を探す(山登り)
function bestOrder(P, deckName, N, iters, seed, opt = {}){
  const types = [...new Set(DECKS[deckName])];
  const evalO = o => measure(P, deckName, 'auto', N, seed, {...opt, order:o}).taken;
  let best = null, bv = Infinity; const R0 = rngFrom(seed * 7 + 1);
  for(let s = 0; s < 3; s++){
    let o = types.slice(); for(let i = o.length - 1; i > 0; i--){ const j = Math.floor(R0() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    let v = evalO(o);
    for(let it = 0; it < iters; it++){
      const a = Math.floor(R0() * o.length), b = Math.floor(R0() * o.length); if(a === b) continue;
      const o2 = o.slice(); [o2[a], o2[b]] = [o2[b], o2[a]]; const v2 = evalO(o2);
      if(v2 <= v){ o = o2; v = v2; }
    }
    if(v < bv){ bv = v; best = o; }
  }
  return best;
}
module.exports = {measure, calibrate, calibrateEnc, bestOrder, DECKS, ENC, FOES, FOES_Q, foeAt, CS};
