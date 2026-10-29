// Ascendroid のルール(画面を持たない)。index.html と、自動対戦のシミュレータの両方から使う
// 時間の単位はサイクル。手札は RULE.draw サイクルごとに1枚届く
(function(root){
'use strict';
const D = root.DATA;
// freeWait: 手札があっても1サイクル待てる(0.7 から。0.11 からキャラごとに data/classes.js の wait で決まる)
// blockDecay: ブロックの減り方(実験用。null なら使い切るまで残る)
//   {type:'hit'} 敵の攻撃を受けると余りも消える(多段は撃ち終わりで) / {type:'lin', v} 毎サイクル v 減る
//   {type:'mul', v} 毎サイクル v 倍(端数切り捨て) / {type:'life', v} 最後に得てから v サイクルで消える / {type:'cap', v} 持てる上限 v
// econ: 手札の補給の型(実験用。null なら今の「3サイクルごとに1枚届く」)
//   {type:'turn', len, hand, blockReset, eject}  固定のターン: len サイクルごとに区切り。手札を捨てて hand 枚引く
//   {type:'reload', r, hand, heat, blockReset, eject, keep}  再装填: 自分で区切る(手札がなければ区切るしかない)。r(+heat×回数)サイクルかけて hand 枚引く。keep なら手札を残して hand 枚まで引く
//   {type:'mag', r, cap}  弾倉: 3サイクルごとに1枚が弾倉にたまり、区切り(r サイクル)でまとめて手札へ
//   blockReset: 区切りでブロックが消える('start' 区切りの始め / true・'end' 終わり) / eject: 区切りで捨てたカード1枚ごとのブロック
const RULE = {draw:3, handStart:5, handMax:7, view:18, freeWait:true, blockDecay:null, econ:null};
// 敵のユニット(0.17.0 で部位として入れ、0.18.0 でユニットと呼ぶ): 敵は1つ以上のユニット(units)でできている。
//   行動の列は1本で、耐久と状態(クラック・隙・装甲)はユニットごと。カードはユニットを狙う。
//   行動の by はその行動をするユニットで、構え・ガード・反撃はそのユニットを叩いたときだけ効く。
//   ユニットが破壊されるとそのユニットの行動は飛ばされ(予定に入っている行動も消える)、あふれたダメージは核(core)へ。
//   急所(vital)のユニットがすべて破壊されると撃破。units を書かない敵は、耐久 hp の核1つだけを持つ
// パッシブ(0.18.0): 敵ごとの常に働く性質。passives:[{k, ...}]
//   command {unit, n}  統率: unit が破壊されていない間、行動の間隔(コスト)-n(最短2)
//   frenzy {n}         ユニットが破壊されるたび、攻撃力+n
//   punctual {n}       定刻(0.23.0): ディレイを受けない。ディレイを与えられるたび、代わりに増幅+n
//   pursuit {n}        追跡(0.23.0): こちらが手札を入れ替えるか待機するたび、次の行動が n サイクル早まる(最短1)
//   loot / hoard       見せるだけ。盗んだスクラップ(steal)・飲み込んだカード(eat)は撃破すると戻る

/* ---------- 乱数と小道具 ---------- */
function rngFrom(seed){
  let s = seed >>> 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
let rand = Math.random;
function setRandom(fn){ rand = fn || Math.random; }
function shuffle(a, r){ const R = r || rand; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(a, r){ return a[Math.floor((r || rand)() * a.length)]; }
const clone = o => JSON.parse(JSON.stringify(o));
const cur = e => e.pat[e.idx];
// 次の行動へ。ai:'rand' なら重み wt で選ぶ(同じ行動は3回続けない)。phase なら耐久が at 割を切った後に行動の並びが変わる
// ランダムに選ぶ敵も、先の行動まで決めておく(0.18.3)。e.queue に今の行動(e.idx)の後の並びを QN 個持ち、予定にもそのまま出す
const QN = 8;
function pickMove(e, seq){
  const h = seq || e.hist || [], n = h.length, ok = e.pat.map((m, i) => moveOk(e, m) && !(n >= 2 && h[n - 1] === i && h[n - 2] === i));
  let tot = 0; e.pat.forEach((m, i) => { if(ok[i]) tot += m.wt || 1; });
  let x = rand() * tot;
  for(let i = 0; i < e.pat.length; i++){ if(!ok[i]) continue; x -= e.pat[i].wt || 1; if(x <= 0) return i; }
  return e.pat.length - 1;
}
// 先の行動の並びを QN 個まで足す(同じ行動が3回続かないよう、これまでの行動と並びを続けて見る)
function fillQueue(e){
  if(e.ai !== 'rand') return;
  e.queue = (e.queue || []).filter(i => moveOk(e, e.pat[i]));
  while(e.queue.length < QN) e.queue.push(pickMove(e, [...(e.hist || []), e.idx, ...e.queue]));
}
// 並びを決め直す(行動の並びそのものが変わったとき)
function resetQueue(e){ if(e.ai !== 'rand') return; e.queue = []; e.idx = pickMove(e, e.hist || []); fillQueue(e); }
function advance(e){
  if(e.hist){ e.hist.push(e.idx); if(e.hist.length > 4) e.hist.shift(); }
  if(e.phase && !e.phased && e.hp < e.maxHp * e.phase.at){ e.phased = true; e.pat = e.phase.pat; e.idx = 0; e.hist = []; resetQueue(e); }
  else if(e.ai === 'rand'){ fillQueue(e); e.idx = e.queue.shift(); fillQueue(e); }
  else e.idx = (e.idx + 1) % e.pat.length;
  // 破壊されたユニットの行動は飛ばす
  for(let k = 0; k < e.pat.length && !moveOk(e, e.pat[e.idx]); k++){ if(e.ai === 'rand'){ fillQueue(e); e.idx = e.queue.shift(); fillQueue(e); } else e.idx = (e.idx + 1) % e.pat.length; }
  const a = e.pat[e.idx];
  e.r = gap(e, a.dl); e.seq++; e.chain = 0; e.sh = a.guard ? a.guard.s : 0;
}
// 加速した敵と、統率が効いている敵は、行動の間隔が縮む(最短2)
const cmdN = e => (e.pas || []).reduce((s, p) => s + (p.k === 'command' && e.units[p.unit] && !e.units[p.unit].broken ? p.n : 0), 0);
const gap = (e, dl) => { const r = (e.haste || 0) + cmdN(e); return r ? Math.max(Math.min(dl, 2), dl - r) : dl; };
// ユニットの小道具
const coreUid = e => e.uids.find(k => e.units[k].core) || null;
const liveUids = e => e.uids.filter(k => !e.units[k].broken);
// 狙いを決めていないとき: 核、なければ破壊されていない急所、なければ破壊されていないユニット
const defaultUid = e => { const c = coreUid(e); if(c && !e.units[c].broken) return c; return liveUids(e).find(k => e.units[k].vital) || liveUids(e)[0] || e.uids[0]; };
const moveOk = (e, a) => !a.by || !e.units[a.by] || !e.units[a.by].broken;
// 行動しているユニット(行動の by、なければ核)
const actorUid = (e, a) => a && a.by && e.units[a.by] ? a.by : defaultUid(e);
function syncHp(e){ let h = 0, m = 0; for(const k of e.uids){ const p = e.units[k]; if(p.vital){ h += p.hp; m += p.max; } } e.hp = h; e.maxHp = m; }
// 対象の指定: 数字なら敵の番号(ユニットはおまかせ)、'番号.ユニット' ならユニットまで
function parseT(t){ if(t == null) return {i:null, uid:null}; if(typeof t === 'string' && t.includes('.')){ const [i, uid] = t.split('.'); return {i:+i, uid}; } return {i:+t, uid:null}; }
// 行動の前の窓(構え・ガード・反撃の構え)に入っているか
const inWin = (e, w) => !!w && e.r > 0 && e.r <= w.w;

/* ---------- パーツ ---------- */
function partOf(run, slot){ return D.parts[run.parts[slot].id]; }
// 戦闘中: 部位が壊れていれば効果なし
function fx(st, slot, key){
  if(st.b && st.b.parts[slot].cur <= 0) return 0;
  const f = partOf(st.run, slot).fx || {};
  return f[key] || 0;
}
function partCards(run){ const out = []; for(const s of D.slots){ const f = partOf(run, s.id).fx || {}; if(f.cards) out.push(...f.cards); } return out; }
function battleDeck(run){ return run.deck.concat(partCards(run)); }
function partMax(run, slot){ return partOf(run, slot).max; }

/* ---------- カードの数値(パーツ込み) ---------- */
function dmgOf(st, c, d){
  const dd = d || c.dmg;
  let n = dd.n;
  // 攻撃の種類は近接(melee)と遠隔(ranged)。0.17.0 までの物理と光学
  if(dd.t === 'melee'){ n += fx(st, 'out', 'melee'); if(c.cost <= 2) n += fx(st, 'out', 'quickMelee'); if(c.cost >= 4) n += fx(st, 'out', 'heavyMelee'); }
  else n += fx(st, 'arm', 'ranged');
  return n;
}
function blockOf(st, c){ return c.block + fx(st, 'dur', 'block'); }

/* ---------- 山札 ---------- */
// 1枚引く。手札が上限なら、引いたカードは捨て札へ(あふれ)
function drawOne(b){
  if(!b.draw.length){ b.draw = shuffle(b.disc); b.disc = []; }
  if(!b.draw.length) return null;
  const c = b.draw.pop();
  if(b.hand.length >= b.handMax){ b.disc.push(c); return {burn:c}; }
  b.hand.push(c); return {card:c};
}
function drawN(b, n){ let got = 0; for(let i = 0; i < n; i++){ const r = drawOne(b); if(r && r.card) got++; } return got; }

/* ---------- 予定 ---------- */
function upcoming(e, view){
  const V = view || RULE.view, out = []; let t = e.r, idx = e.idx, k = 0;

  while(t <= V && k < 8){
    const a = e.pat[idx];
    // 多段: 残りの撃ちを1サイクルおきに。left はその撃ちの後に残る回数
    const rest = k === 0 && e.chain > 0 ? e.chain - 1 : (a.hits > 1 ? a.hits - 1 : 0);
    out.push({t, a, k, left:rest});
    for(let j = 1; j <= rest && t + j <= V; j++) out.push({t:t + j, a, k, hit:j, left:rest - j});
    t += rest;
    if(e.ai === 'rand'){ // ランダムに選ぶ敵は、決めておいた並びのとおり
      const q = (e.queue || []).filter(i => moveOk(e, e.pat[i])); if(k >= q.length) break; idx = q[k];
    } else {
      idx = (idx + 1) % e.pat.length;
      for(let j = 0; j < e.pat.length && !moveOk(e, e.pat[idx]); j++) idx = (idx + 1) % e.pat.length;
    }
    t += gap(e, e.pat[idx].dl); k++;
  }
  return out;
}
// 次に手札が届くサイクル(今から何サイクル後か)の一覧
function arrivals(b, view){ const out = []; for(let t = b.drawIn; t <= (view || RULE.view); t += RULE.draw) out.push(t); return out; }

/* ---------- 効果 ---------- */
// ユニットにダメージ。破壊されたらそのユニットの行動を止め、あふれた分は核へ。急所がすべて破壊されたら撃破
function hurtFoe(b, e, d, ev, uid){
  uid = uid && e.units[uid] ? uid : defaultUid(e);
  let p = e.units[uid];
  if(p.broken){ const c = coreUid(e); if(c && c !== uid && !e.units[c].broken){ uid = c; p = e.units[c]; } else return; }
  const take = Math.min(p.hp, d), over = d - take;
  p.hp -= take; ev.push({kind:'dmg', e:e.i, unit:uid, n:take});
  if(p.hp <= 0 && !p.broken){
    p.broken = true; p.vuln = 0; ev.push({kind:'unitBreak', e:e.i, unit:uid});
    // パッシブ frenzy: ユニットが破壊されるたび攻撃力+
    for(const ps of e.pas || []) if(ps.k === 'frenzy' && e.alive){ e.str = (e.str || 0) + ps.n; ev.push({kind:'frenzy', e:e.i, n:ps.n}); }
    // broke: このユニットが破壊されると行動の並びが変わる
    const nb = (D.foes[e.key].broke || {})[uid];
    if(nb && e.alive){ e.pat = nb; e.idx = 0; e.hist = []; e.sh = 0; e.chain = 0; resetQueue(e); ev.push({kind:'shift', e:e.i, unit:uid}); }
    else fillQueue(e); // 破壊されたユニットの行動を並びから除いて足す
    // 予定に入っていたこのユニットの行動は消える
    if(e.alive && !moveOk(e, cur(e)) && e.uids.some(k => !e.units[k].broken && e.units[k].vital)){ const nm = cur(e).n; advance(e); ev.push({kind:'cancel', e:e.i, name:nm}); }
  }
  syncHp(e);
  if(e.uids.every(k => !e.units[k].vital || e.units[k].broken)){
    e.alive = false; e.hp = 0; e.reactIn = null; ev.push({kind:'kill', e:e.i});
    // 飲み込んだカードは捨て札に戻る
    if(e.eaten && e.eaten.length){ b.disc.push(...e.eaten); ev.push({kind:'spit', e:e.i, cards:e.eaten.map(c => c.k)}); e.eaten = []; }
    return;
  }
  if(over > 0 && !p.core){ const c = coreUid(e); if(c && !e.units[c].broken) hurtFoe(b, e, over, ev, c); }
}
// カードや時限の一撃。ユニットのクラックを足し、隙なら1.5倍、装甲が先に受ける。
// 行動しているユニットを叩いたときだけ、ガード・反撃の構え・構え(poise 以上で行動が潰れる)が効く
function hitFoe(st, e, n, ev, uid){
  const b = st.b, a = cur(e);
  uid = uid && e.units[uid] && !e.units[uid].broken ? uid : defaultUid(e);
  const p = e.units[uid], onActor = !a.by || a.by === uid || !e.units[a.by];
  n += p.crack || 0;
  let d = n;
  if(p.vuln > 0){ d = Math.round(d * 1.5); b.vulnHits = (b.vulnHits || 0) + 1; ev.push({kind:'vulnHit', e:e.i, unit:uid}); }
  if(onActor && inWin(e, a.guard) && e.sh > 0){ const ab = Math.min(e.sh, d); e.sh -= ab; d -= ab; b.guarded = (b.guarded || 0) + ab; ev.push({kind:'guarded', e:e.i, n:ab}); }
  if(p.armor > 0 && d > 0){ const ab = Math.min(p.armor, d); p.armor -= ab; d -= ab; b.guarded = (b.guarded || 0) + ab; ev.push({kind:'armored', e:e.i, unit:uid, n:ab}); }
  if(onActor && inWin(e, a.counter)){ const res = strike(st, e, {n:a.n, d:a.counter.d, p:a.p || 'dur'}, 0, true); afterHit(b); b.countered = (b.countered || 0) + 1; ev.push({kind:'counter', e:e.i, res}); }
  if(d > 0) hurtFoe(b, e, d, ev, uid);
  if(e.alive && onActor && cur(e) === a && inWin(e, a.wind) && n >= a.wind.poise){ const nm = a.n; advance(e); b.breaks = (b.breaks || 0) + 1; ev.push({kind:'break', e:e.i, name:nm}); }
}
function gainBlock(b, n){
  const bd = RULE.blockDecay;
  b.block += n; b.blockGain = (b.blockGain || 0) + n;
  if(bd && bd.type === 'cap') b.block = Math.min(b.block, bd.v);
  if(bd && bd.type === 'life') b.blockExp = b.T + bd.v;
}
// 攻撃を受けた後(多段は撃ち終わり)。'hit' なら余りのブロックが消える
function afterHit(b){ const bd = RULE.blockDecay; if(bd && bd.type === 'hit') b.block = 0; }
// 1サイクルたったときのブロックの目減り
function decayBlock(b){
  const bd = RULE.blockDecay; if(!bd || !b.block) return;
  if(bd.type === 'lin') b.block = Math.max(0, b.block - bd.v);
  else if(bd.type === 'mul') b.block = Math.floor(b.block * bd.v);
  else if(bd.type === 'life' && b.T >= b.blockExp) b.block = 0;
}
function applyCard(st, k, ti){
  const c = D.cards[k], b = st.b, ev = [];
  const T = parseT(ti);
  // 全体のカードは敵のすべてのユニット。単体は指定のユニット(なければおまかせ)
  const targets = c.all ? b.foes.filter(e => e.alive) : (c.tgt ? [b.foes[T.i]].filter(e => e && e.alive) : []);
  const uidOf = e => !c.all && T.uid && e.units[T.uid] && !e.units[T.uid].broken ? T.uid : defaultUid(e);
  if(c.dmg){
    const n = dmgOf(st, c);
    for(const e of targets) for(const k of (c.all ? liveUids(e) : [uidOf(e)])) for(let h = 0; h < (c.dmg.x || 1); h++){ if(!e.alive || e.units[k].broken) break; hitFoe(st, e, n, ev, k); }
  }
  // 充電: spend は貯めた充電をすべて消費し、1につき dmg / block。gain は充電を得る(消費の後)
  if(c.spend){
    const n = b.charge || 0; b.charge = 0; ev.push({kind:'spend', n});
    if(n > 0 && c.spend.dmg){ const d = dmgOf(st, c, {t:c.spend.dmg.t, n:c.spend.dmg.n * n}); for(const e of targets) for(const k of (c.all ? liveUids(e) : [uidOf(e)])) if(e.alive && !e.units[k].broken) hitFoe(st, e, d, ev, k); }
    if(n > 0 && c.spend.block){ const m = c.spend.block * n + fx(st, 'dur', 'block'); gainBlock(b, m); ev.push({kind:'block', n:m}); }
  }
  if(c.gain){ b.charge = (b.charge || 0) + c.gain; ev.push({kind:'charge', n:c.gain}); }
  if(c.crack) for(const e of targets) if(e.alive){ const k = uidOf(e); e.units[k].crack += c.crack; ev.push({kind:'crack', e:e.i, unit:k, n:c.crack}); }
  if(c.delay) for(const e of targets) if(e.alive){ const v = delayFoe(e, c.delay); ev.push({kind:'delay', e:e.i, n:v, anger:pasN(e, 'punctual')}); }
  if(c.block){ const n = blockOf(st, c); gainBlock(b, n); ev.push({kind:'block', n}); }
  if(c.swift){ b.swift += c.swift; ev.push({kind:'swift', n:c.swift}); }
  if(c.timer && targets[0]){ b.timers.push({id:b.uid++, left:c.timer.t, k, e:targets[0].i, unit:uidOf(targets[0])}); ev.push({kind:'timerSet', e:targets[0].i, t:c.timer.t}); }
  if(c.draw){ const n = drawN(b, c.draw); if(c.borrow) b.drawIn += c.draw * RULE.draw; ev.push({kind:'draw', n, borrow: !!c.borrow}); }
  // 0.17.0: スウィフトはディレイに統一(パーツの効果も敵へのディレイ)
  if(c.cost === 0){ const s = fx(st, 'mob', 'zeroDelay'); if(s) for(const e of b.foes) if(e.alive){ const v = delayFoe(e, s); ev.push({kind:'delay', e:e.i, n:v, anger:pasN(e, 'punctual')}); } }
  return ev;
}
function fireTimer(st, t){
  const b = st.b, c = D.cards[t.k], ev = [];
  let e = b.foes[t.e];
  if(!e || !e.alive) e = b.foes.find(f => f.alive);
  if(e) hitFoe(st, e, dmgOf(st, c, c.timer.dmg), ev, t.unit);
  return ev;
}
// 敵の攻撃1回。extra は連携の上乗せ
function strike(st, e, a, extra, noParry){
  const b = st.b, raw = a.d + (extra || 0) + (b.crack || 0);
  if(b.parryNow && !noParry){ const ev = []; hurtFoe(b, e, raw, ev, actorUid(e, a.by ? a : cur(e))); return {kind:'parried', name:a.n, raw, ev}; }
  const ab = Math.min(b.block, raw); b.block -= ab; b.blockUsed = (b.blockUsed || 0) + ab;
  const rem = raw - ab, p = b.parts[a.p];
  let partLoss = 0, bodyLoss = 0, broke = false;
  if(rem > 0){
    if(p.cur > 0){ partLoss = Math.min(p.cur, rem); p.cur -= partLoss; if(p.cur === 0){ broke = true; b.broken[a.p] = true; } bodyLoss = rem - partLoss; }
    else bodyLoss = rem;
    st.run.body = Math.max(0, st.run.body - bodyLoss);
  }
  return {kind:'hit', name:a.n, part:a.p, raw, extra:extra || 0, blocked:ab, partLoss, bodyLoss, broke, hurt:rem > 0};
}
// ディレイ(0.21.0): 敵は次の行動までにディレイを受けるたび抵抗が1増え、その分だけ次のディレイが減る。行動すると0に戻る(enemyAct)
// 敵の列が1本になってディレイが強すぎたため。重ねがけを止める
// 定刻の敵(passive punctual)はディレイを受けず、代わりに増幅を得る。戦闘開始時のディレイ(free)では何も起きない
const pasN = (e, k) => (e.pas || []).reduce((s, p) => s + (p.k === k ? (p.n || 1) : 0), 0);
function delayFoe(e, v, free){
  const pn = pasN(e, 'punctual');
  if(pn){ if(!free && v > 0){ e.str = (e.str || 0) + pn; e.anger = (e.anger || 0) + 1; } return 0; }
  const a = Math.max(0, v - (e.resist || 0)); e.r += a; if(!free) e.resist = (e.resist || 0) + 1; return a;
}
function enemyAct(st, e, extra){ e.resist = 0;
  const a = cur(e), mv = (e.phased ? 'phase:' : 'pat:') + e.idx;
  const res = a.kind === 'delay' ? {kind:'delay', name:a.n, v:a.v} : a.d > 0 ? strike(st, e, a, (extra || 0) + (e.str || 0)) : {kind:'move', name:a.n};
  res.by = actorUid(e, a); res.mv = mv;
  // 多段: 残りを1サイクルおきに撃つ
  if(a.hits > 1 && !e.chain){ e.chain = a.hits - 1; e.r = 1; e.sh = 0; res.chainLeft = e.chain; return res; }
  if(e.chain > 0){ e.chain--; if(e.chain > 0){ e.r = 1; res.chainLeft = e.chain; return res; } }
  res.chainLeft = 0;
  if(a.d > 0 && res.kind === 'hit') afterHit(st.b);
  const ap = e.units[actorUid(e, a)];
  if(a.rec) ap.vuln = a.rec + 1;
  if(a.buff){ for(const f of (a.all ? st.b.foes.filter(f => f.alive) : [e])) f.str = (f.str || 0) + a.buff; res.buff = a.buff; }
  // 放置の代償になる行動
  const b = st.b;
  if(a.armor){ ap.armor += a.armor; res.armor = a.armor; }                // 装甲を重ねる(行動したユニットに。消えない)
  if(a.heal){ const hp = !ap.broken ? ap : e.units[defaultUid(e)]; const h = Math.min(a.heal, hp.max - hp.hp); hp.hp += h; syncHp(e); res.heal = h; } // 修復(破壊されたユニットは戻らない)
  if(a.haste){ e.haste = (e.haste || 0) + a.haste; res.haste = a.haste; }                // 加速: 以後の間隔が縮む
  if(a.zone){ b.zones.push({id:b.uid++, from:a.zone.at, to:a.zone.at + a.zone.len - 1, d:a.zone.d + (e.str || 0), p:a.zone.p, e:e.i, n:a.n}); res.zone = a.zone; } // 危険域
  const ac = a.crack || a.mark; // こちらにクラック(受ける攻撃すべて+)。mark は 0.14 までの名前(実験の古い敵のデータ用)
  if(ac){ b.crack = (b.crack || 0) + ac; res.crack = ac; }
  if(a.noise){ for(let i = 0; i < a.noise; i++){ const at = Math.floor(rand() * (b.draw.length + 1)); b.draw.splice(at, 0, {k:'noise', id:b.uid++}); } res.noise = a.noise; } // ノイズ注入
  if(a.summon && b.foes.filter(f => f.alive).length < 3){ const nf = makeFoe(a.summon, b.foes.length); b.foes.push(nf); res.summon = nf.i; } // 増援
  // 0.23.0: 盗む(スクラップ。撃破すると戻る) / 飲み込む(手札のいちばんコストの高いカード。撃破すると捨て札に戻る) / 再溶接(破壊されたユニットを直す) / 逃げる
  if(a.steal){ const t = Math.min(st.run.scrap || 0, a.steal); st.run.scrap -= t; e.loot = (e.loot || 0) + t; res.steal = t; }
  if(a.eat){
    res.eat = [];
    for(let n = 0; n < a.eat; n++){
      const hs = b.hand.filter(c => c.k !== 'noise'); if(!hs.length) break;
      const top = Math.max(...hs.map(c => D.cards[c.k].cost)), pk = pick(hs.filter(c => D.cards[c.k].cost === top));
      b.hand.splice(b.hand.indexOf(pk), 1); (e.eaten = e.eaten || []).push(pk); res.eat.push(pk);
    }
  }
  if(a.rebuild){
    const k = e.uids.find(k => e.units[k].broken && !e.units[k].core);
    if(k){ const u = e.units[k]; u.broken = false; u.hp = Math.min(u.max, a.rebuild); u.crack = 0; u.vuln = 0; syncHp(e); fillQueue(e); res.rebuild = k; }
    else { const hp = !ap.broken ? ap : e.units[defaultUid(e)]; const h = Math.min(Math.ceil(a.rebuild / 2), hp.max - hp.hp); hp.hp += h; syncHp(e); res.heal = h; }
  }
  if(a.flee){ e.alive = false; e.fled = true; e.reactIn = null; res.flee = true; return res; }
  advance(e);
  return res;
}

/* ---------- 時間を進める ----------
   カード(k あり)、入れ替え・待機(k なし)のどれも、cost サイクルぶん時間を進める。
   1サイクルごとにイベントを返すので、画面はそれを見て演出し、プレビューは最後まで回して結果だけを見る */
function* spendGen(st, cost, k, ti, noInt){
  const b = st.b, c = k ? D.cards[k] : null, atomic = !c || !!c.atomic, waiting = !c && !!b.waiting;
  b.waiting = false;
  let left = cost;
  const out = {elapsed:0, completeAt:null, interruptedAt:null, justs:[], dead:false, won:false};
  b.cast = {k, left};
  // 反応する敵: 重いカードを使い始めると、1サイクル後に撃つ
  if(c && cost > 0) for(const e of b.foes){
    if(e.alive && e.react && cost >= e.react.min && e.reactIn == null){ e.reactIn = 1; yield {type:'react', e:e.i}; }
  }
  if(cost <= 0){
    if(c){ const ev = applyCard(st, k, ti); yield {type:'card', ev}; }
    b.cast = null; out.completeAt = 0;
    if(st.run.body <= 0) out.dead = true;
    if(!b.foes.some(e => e.alive)) out.won = true;
    return out;
  }
  while(left > 0){
    let real = true;
    if(b.swift > 0 && !waiting){ b.swift--; real = false; }
    left--; b.cast.left = left;
    if(real){
      b.T++; out.elapsed++; b.drawIn--;
      for(const e of b.foes) if(e.alive){ e.r--; if(e.reactIn != null) e.reactIn--; for(const k of e.uids) if(e.units[k].vuln > 0) e.units[k].vuln--; }
      for(const z of b.zones){ z.from--; z.to--; }
      b.zones = b.zones.filter(z => z.to >= 0);
      decayBlock(b);
      for(const t of b.timers) t.left--;
    }
    yield {type:'tick', real};
    if(real){
      // 時限の効果
      const due = b.timers.filter(t => t.left <= 0);
      if(due.length){
        b.timers = b.timers.filter(t => t.left > 0);
        for(const t of due){ const ev = fireTimer(st, t); yield {type:'timer', t, ev}; }
        if(!b.foes.some(e => e.alive)){ b.cast = null; out.won = true; return out; }
      }
      // 手札が届く(型によって、弾倉にたまる / 届かない)
      const ec = econ();
      if(ec.type === 'trickle' || ec.type === 'mag'){
        if(b.drawIn <= 0){
          b.drawIn = RULE.draw;
          if(ec.type === 'mag'){ if(b.mag.length < (ec.cap || 7)){ if(!b.draw.length){ b.draw = shuffle(b.disc); b.disc = []; } if(b.draw.length) b.mag.push(b.draw.pop()); } yield {type:'mag'}; }
          else { const r = drawOne(b); yield {type:'arrive', r}; }
        }
      } else if(ec.type === 'turn'){
        if(--b.turnIn <= 0){ b.turnIn = ec.len; const ev = boundary(st, 'turn'); drawN(b, ec.hand); yield {type:'turn', ev}; }
      }
    }
    if(left === 0){
      out.completeAt = out.elapsed;
      if(c){
        if(real) for(const e of b.foes){
          if(e.alive && e.r <= 0 && cur(e).ch && !e.chain){
            const nm = cur(e).n, jp = actorUid(e, cur(e)); advance(e);
            const cr = fx(st, 'calc', 'justCrack'); e.units[jp].crack += cr;
            const dl = fx(st, 'calc', 'justDelay'); if(dl) delayFoe(e, dl);
            out.justs.push({i:e.i, name:nm}); yield {type:'just', e:e.i, crack:cr, delay:dl};
          }
        }
        if(c.parry && real) b.parryNow = true;
        const ev = applyCard(st, k, ti);
        b.cast = null;
        yield {type:'card', ev};
        if(st.run.body <= 0){ out.dead = true; b.parryNow = false; return out; }
        // 危険域の中で使い終えると被弾
        if(real) for(const z of b.zones.filter(z => z.from <= 0 && z.to >= 0)){
          const zf = b.foes[z.e]; if(!zf || !zf.alive) continue;
          const res = Object.assign(strike(st, zf, {n:z.n, d:z.d, p:z.p}, 0, true), {zone:true}); if(res.kind === 'hit') afterHit(b);
          yield {type:'foe', e:z.e, res};
          if(st.run.body <= 0){ out.dead = true; b.parryNow = false; return out; }
        }
      }
      b.cast = null;
      if(!b.foes.some(e => e.alive)){ b.parryNow = false; out.won = true; return out; }
    }
    // 敵の行動
    const acting = b.foes.filter(e => e.alive && (e.r <= 0 || e.reactIn === 0));
    const syncN = acting.filter(e => e.r <= 0 && e.sync && cur(e).kind !== 'delay').length;
    for(const e of acting){
      const acts = [];
      if(e.reactIn === 0){ e.reactIn = null; acts.push('react'); }
      if(e.r <= 0) acts.push('pat');
      for(const kind of acts){
        if(!e.alive) break;
        let res;
        if(kind === 'react'){ res = Object.assign(strike(st, e, e.react, 0), {react:true}); if(res.kind === 'hit') afterHit(b); }
        else res = enemyAct(st, e, e.sync && syncN >= 2 ? e.sync : 0);
        if(res.kind === 'delay' && b.cast){
          left += res.v; b.cast.left = left; res.applied = true;
          const s = fx(st, 'mob', 'delayedDelay'); if(s){ res.counterDelay = delayFoe(e, s); }
        }
        yield {type:'foe', e:e.i, res};
        if(st.run.body <= 0){ out.dead = true; b.cast = null; b.parryNow = false; return out; }
        if(!b.foes.some(f => f.alive)){ b.cast = null; b.parryNow = false; out.won = true; return out; }
        if(c && b.cast && res.hurt && !atomic && !noInt){ out.interruptedAt = out.elapsed; b.cast = null; yield {type:'interrupt'}; }
      }
    }
    b.parryNow = false;
    if(out.interruptedAt !== null) break;
  }
  b.cast = null;
  return out;
}
function runGen(g){ let r; while(!(r = g.next()).done){} return r.value; }

/* ---------- 戦闘の準備と、行動の候補 ---------- */
// 強化(0.19.0): エリアの倍率で敵の数値を上げた定義を作る。hp(耐久・回復)と d(攻撃・ガード・装甲・構え)
const scaledCache = {};
function scaledFoe(key, sc){
  if(!sc || (sc.hp === 1 && sc.d === 1)) return D.foes[key];
  const id = key + '@' + sc.hp + '/' + sc.d; if(scaledCache[id]) return scaledCache[id];
  // s はガードの量のときだけ(ユニットの絵の大きさの s は変えない)
  const H = ['hp', 'heal', 'rebuild'], DK = ['d', 'armor', 'poise'];
  const walk = (o, pk) => { if(Array.isArray(o)) return o.map(x => walk(x, pk)); if(!o || typeof o !== 'object') return o; const r = {};
    for(const [k, v] of Object.entries(o)){
      if(typeof v === 'number' && v > 0 && H.includes(k)) r[k] = Math.round(v * sc.hp);
      else if(typeof v === 'number' && v > 0 && (DK.includes(k) || (k === 's' && pk === 'guard'))) r[k] = Math.max(1, Math.round(v * sc.d));
      else r[k] = walk(v, k);
    } return r; };
  // 行動の文(n)・パッシブ(k の n は数)は変えない
  const f = walk(D.foes[key], ''); if(D.foes[key].passives) f.passives = D.foes[key].passives;
  return scaledCache[id] = f;
}
function makeFoe(key, i, sc){
  const f = scaledFoe(key, sc);
  const e = {key, i, name:f.name, tag:'ABCDEF'[i], kind:f.kind, pat:f.pat, idx:0, r:f.start, seq:0, alive:true,
    react:f.react || null, sync:f.sync || 0, reactIn:null, ai:f.ai || null, phase:f.phase || null, phased:false, hist:[], chain:0, sh:0, str:0, haste:0, pas:f.passives || []};
  // ユニット。書かなければ耐久 hp の核1つ
  const defs = f.units || {core:{hp:f.hp, vital:true, core:true}};
  e.uids = Object.keys(defs); e.units = {};
  for(const k of e.uids){ const d = defs[k]; e.units[k] = {name:d.name || '', hp:d.hp, max:d.hp, vital:!!d.vital, core:!!d.core, icon:d.icon || k, crack:0, vuln:0, armor:d.armor || 0, broken:false}; }
  syncHp(e);
  if(e.ai === 'rand') resetQueue(e);
  const a = cur(e); e.sh = a.guard ? a.guard.s : 0;
  return e;
}
const econ = () => RULE.econ || {type:'trickle'};
// 区切り: 手札を捨て(排莢)、ブロックを消す。引くのは呼ぶ側
function boundary(st, when){
  const b = st.b, ec = econ(), ev = {kind:'boundary', n:b.hand.length};
  const ej = (ec.eject || 0) * b.hand.filter(c => c.k !== 'noise').length;
  if((when === 'start' && !ec.keep) || when === 'turn'){ for(const c of b.hand) if(c.k !== 'noise') b.disc.push(c); b.hand = []; }
  else if(when === 'start'){ b.hand = b.hand.filter(c => c.k !== 'noise'); } // keep: 手札を残し、足りない分だけ引く(ノイズは消える)
  if(ec.blockReset && (ec.blockReset === when || when === 'turn')) b.block = 0; // 再装填で true/'end' のときは終わりに消す(endAction)
  if(ej) gainBlock(b, ej);
  ev.eject = ej;
  return ev;
}
function newBattle(run, encKey){
  const E = D.encounters[encKey];
  const st = {run, b:null};
  const parts = {};
  for(const s of D.slots){ const mx = partMax(run, s.id); parts[s.id] = {cur: run.parts[s.id].damaged ? Math.ceil(mx / 2) : mx, max:mx}; }
  const foes = [], A = D.areas[run.area || 0], es = E.scale || {hp:1, d:1};
  // 敵の強さ = エリアの倍率 × 遭遇の倍率 × 警戒度の上乗せ
  const lv = alertLevel(run) - 1, ae = AL().enemy || {hp:0, d:0};
  const sc = A ? {hp:+(A.scale.hp * es.hp * (1 + ae.hp * lv)).toFixed(3), d:+(A.scale.d * es.d * (1 + ae.d * lv)).toFixed(3)} : null;
  if(!E.boss && !E.elite) run.lastEnc = encKey;
  for(const key of E.foes) foes.push(makeFoe(key, foes.length, sc));
  let uid = 1;
  const cards = shuffle(battleDeck(run).map(k => ({k, id:uid++})));
  const b = {enc:encKey, T:0, block:0, swift:0, foes, parts, draw:cards, disc:[], hand:[], cast:null, broken:{}, over:false, timers:[], zones:[], drawIn:RULE.draw, handMax:RULE.handMax, uid:1000, parryNow:false, charge:0};
  st.b = b;
  b.handMax += fx(st, 'calc', 'handMax');
  const sb = fx(st, 'dur', 'startBlock'); if(sb) gainBlock(b, sb);
  const sd = fx(st, 'mob', 'startDelay'); if(sd) for(const e of b.foes) delayFoe(e, sd, true); // 戦闘開始時のディレイは抵抗を増やさない
  const ec = econ();
  b.turnIn = ec.type === 'turn' ? ec.len : 0; b.reloads = 0; b.mag = [];
  drawN(b, (ec.hand || RULE.handStart) + fx(st, 'mob', 'startHand'));
  return st;
}
// 今できる行動: カード(対象ごと)、入れ替え(手札があるとき)、待機(手札がないとき)
function actions(st){
  const b = st.b, out = [], seen = new Set();
  b.hand.forEach((cd, i) => {
    const c = D.cards[cd.k];
    // ユニットが2つ以上ある敵は、ユニットごとに狙いを分ける
    const ts = c.tgt ? b.foes.filter(e => e.alive).flatMap(e => liveUids(e).length > 1 ? liveUids(e).map(k => e.i + '.' + k) : [e.i]) : [null];
    for(const t of ts){ const key = cd.k + '|' + t; if(seen.has(key)) continue; seen.add(key); out.push({type:'card', i, k:cd.k, t}); }
  });
  const ec = econ();
  if(ec.type === 'reload' || ec.type === 'mag'){
    if(ec.type === 'reload' || b.mag.length) out.push({type:'reload'});
    if(RULE.freeWait || (ec.type === 'mag' && !b.hand.length)) out.push({type:'wait'});
    return out;
  }
  if(ec.type === 'turn'){ out.push({type:'wait'}); out.push({type:'pass'}); return out; }
  if(b.hand.length) out.push({type:'swap'});
  if(!b.hand.length || RULE.freeWait) out.push({type:'wait'});
  return out;
}
function reloadCost(st){ const ec = econ(); return ec.type === 'mag' ? (ec.r || 1) : (ec.r || 2) + (ec.heat || 0) * st.b.reloads; }
function actionCost(st, a){ return a.type === 'card' ? D.cards[a.k].cost : a.type === 'swap' ? st.b.hand.length : a.type === 'reload' ? reloadCost(st) : a.type === 'pass' ? Math.max(1, st.b.turnIn) : 1; }
// 行動を1つ、手札の出し入れまで含めて準備する。spendGen の前に呼ぶ
// 追跡(passive pursuit): 入れ替え・待機・再装填のたび、敵の次の行動が早まる
function pursue(st){
  const out = [];
  for(const e of st.b.foes){ const n = pasN(e, 'pursuit'); if(!n || !e.alive || e.chain > 0 || e.r <= 1) continue; const v = Math.min(n, e.r - 1); e.r -= v; out.push({e:e.i, n:v}); }
  return out;
}
function beginAction(st, a){
  const b = st.b;
  if(a.type !== 'card'){ const pu = pursue(st); const p = beginAction0(st, a); if(pu.length) p.pursuit = pu; return p; }
  return beginAction0(st, a);
}
function beginAction0(st, a){
  const b = st.b;
  if(a.type === 'card'){ const cd = b.hand.splice(a.i, 1)[0]; return {card:cd, cost:D.cards[cd.k].cost, k:cd.k, t:a.t, n:0}; }
  if(a.type === 'swap'){ const n = b.hand.length; b.disc.push(...b.hand); b.hand = []; return {card:null, cost:n, k:null, t:null, n}; }
  if(a.type === 'reload'){
    const ec = econ(), cost = reloadCost(st);
    if(ec.type === 'mag') return {card:null, cost, k:null, t:null, n:0, mag:true};
    const ev = boundary(st, 'start'); b.reloads++;
    return {card:null, cost, k:null, t:null, n:Math.max(0, (ec.hand || 5) - b.hand.length), reload:true, ev};
  }
  if(a.type === 'pass'){ b.waiting = true; return {card:null, cost:Math.max(1, b.turnIn), k:null, t:null, n:0}; } // 固定ターン: 区切りまで待つ
  b.waiting = true; // 待機はスウィフトを使わない(使うと敵の時間が進まず、待った意味がなくなる)
  return {card:null, cost:1, k:null, t:null, n:0};
}
function endAction(st, p, out){
  const b = st.b;
  if(p.card && p.card.k !== 'noise') b.disc.push(p.card); // ノイズは使うと消える
  if(p.reload && !out.dead && !out.won){ const ec = econ(); if(ec.blockReset === 'end' || ec.blockReset === true) b.block = 0; }
  if(p.mag && !out.dead && !out.won){ while(b.mag.length && b.hand.length < b.handMax) b.hand.push(b.mag.shift()); }
  if(p.n && !out.dead && !out.won) drawN(b, p.n);
}
// まとめて実行(シミュレータ用)
function doAction(st, a, noInt){
  const p = beginAction(st, a);
  const out = runGen(spendGen(st, p.cost, p.k, p.t, noInt));
  endAction(st, p, out);
  return out;
}

// 戦闘の後: 倒した敵(逃げた敵は除く)から盗まれたスクラップを取り戻す。戻した量を返す
function lootBack(st){ let n = 0; for(const e of st.b.foes) if(!e.fled && !e.alive && e.loot){ n += e.loot; e.loot = 0; } st.run.scrap += n; return n; }
const fledAll = st => st.b.foes.some(e => e.fled) && !st.b.foes.some(e => e.alive);

/* ---------- ラン ---------- */
function newRun(seed){
  const parts = {};
  for(const s of D.slots) parts[s.id] = {id:D.startParts[s.id], damaged:false};
  const run = {seed, area:0, alert:0, lastEnc:null, body:D.bodyMax, bodyMax:D.bodyMax, parts, deck:D.startDeck.slice(), scrap:D.rewards.scrapStart, at:null, visited:[], map:null};
  run.map = genMap(seed, 0);
  return run;
}
/* ---------- 警戒度(0.20.0) ----------
   run.alert はゲージ(0〜per×(max-1))。段は I〜X */
const AL = () => D.alert || {max:10, per:4, gain:{}, enemy:{hp:0, d:0}, scrap:0};
function alertLevel(run){ return Math.min(AL().max, 1 + Math.floor((run.alert || 0) / AL().per)); }
function addAlert(run, n){ const cap = AL().per * (AL().max - 1); const before = alertLevel(run); run.alert = Math.max(0, Math.min(cap, (run.alert || 0) + n)); return alertLevel(run) - before; }
// 区画を終えたときの警戒の増減(イベントは選択肢の fx.alert で別に)
function alertGain(type){ return (AL().gain || {})[type] || 0; }
// 通常戦の敵(0.23.0): エリアの pools から、今の警戒度で入る組(at が警戒度以下でいちばん大きい組)を使う。
// 直前と同じ遭遇は避ける。区画ごとに決まった乱数で選ぶ(つづきからでも同じ)
function poolIndex(run, area){ const P = D.areas[area == null ? (run.area || 0) : area].pools, lv = alertLevel(run); let i = 0; P.forEach((p, j) => { if(p.at <= lv) i = j; }); return i; }
function encFor(run, node){
  if(node.enc) return node.enc;
  const A = D.areas[run.area || 0], bi = poolIndex(run);
  const all = A.pools[bi].enc, pool = all.filter(k => k !== run.lastEnc);
  node.enc = pick(pool.length ? pool : all, rngFrom(run.seed + run.area * 131 + node.lane * 17 + node.idx * 7 + 3));
  node.band = bi;
  return node.enc;
}
// 次のエリアへ(0.19.0)。中継の回復はここで。戻り値は回復した量。最後のエリアなら null
function nextArea(run){
  if(run.area + 1 >= D.areas.length) return null;
  const tr = D.transit[run.area] || {heal:0};
  const before = run.body; run.body = Math.min(run.bodyMax, run.body + Math.round(run.bodyMax * (tr.heal || 0)));
  run.area += 1; run.at = null; run.visited = []; run.map = genMap(run.seed + run.area * 7919, run.area);
  return run.body - before;
}

/* ---------- 地図の生成 ---------- */
const SPECIAL = ['elite', 'rest', 'shop', 'duct'];
function reachAfter(lane, n){ return [lane - 1, lane, lane + 1].filter(l => l >= 0 && l < n); }
// 地図(0.21.0): 3列×部屋数。列ごとの性格はなく、エリアの fill を部屋2〜(最後の1つ前)に散らす
function genMap(seed, area){
  const A = D.areas[area || 0], r = rngFrom(seed), L = 3, mid = A.rooms - 2;
  const bag = []; for(const [t, n] of Object.entries(A.fill)) for(let i = 0; i < n; i++) bag.push(t);
  while(bag.length < L * mid) bag.push('battle');
  for(let tries = 0; tries < 2000; tries++){
    const b = shuffle(bag.slice(0, L * mid), r);
    const rows = Array.from({length: L}, (_, l) => ['battle', ...b.slice(l * mid, (l + 1) * mid), A.last]);
    const ok = rows.every(row =>
        row.every((t, i) => t !== 'elite' || i >= 2) &&
        row.every((t, i) => i === 0 || ![...SPECIAL, 'event'].includes(t) || row[i - 1] !== t) &&
        row.slice(1, -1).some(t => t === 'rest' || t === 'shop') &&
        (n => n >= 2 && n <= 4)(row.slice(1, -1).filter(t => t === 'battle').length)) &&
      Array.from({length: mid}, (_, i) => rows.map(row => row[i + 1])).every(col => SPECIAL.every(t => col.filter(x => x === t).length <= 2));
    if(!ok) continue;
    const elites = shuffle(Object.entries(D.encounters).filter(([, e]) => e.elite).map(([k]) => k), r);
    let ei = 0;
    // 通常戦の敵は入ったときに警戒度で決める(encFor)
    const nodes = rows.map((row, l) => row.map((t, i) => {
      const n = {lane:l, idx:i, type:t};
      if(t === 'elite') n.enc = elites[ei++ % elites.length];
      if(t === 'event') n.ev = pick(D.events, r).id;
      return n;
    }));
    return {seed, area:area || 0, nodes, boss:{type:'boss', enc:A.boss}};
  }
  throw new Error('map generation failed');
}
// 今いる場所から進める部屋
function nextNodes(run){
  const m = run.map, at = run.at, A = D.areas[run.area || 0], last = A.rooms - 1;
  if(!at) return m.nodes.map(row => row[0]);
  if(at.boss) return [];
  if(at.idx === last) return [m.boss];
  if(A.transfers.includes(at.idx + 1)) return reachAfter(at.lane, m.nodes.length).map(l => m.nodes[l][at.idx + 1]);
  return [m.nodes[at.lane][at.idx + 1]];
}

const API = {RULE, makeFoe, defaultUid, liveUids, actorUid, parseT, gap, reloadCost, rngFrom, setRandom, shuffle, pick, clone, cur, advance, partOf, fx, partCards, battleDeck, partMax, dmgOf, blockOf,
  drawOne, drawN, upcoming, arrivals, applyCard, enemyAct, spendGen, runGen, newBattle, actions, actionCost, beginAction, endAction, doAction,
  newRun, nextArea, delayFoe, lootBack, fledAll, pasN, genMap, nextNodes, reachAfter, scaledFoe, alertLevel, addAlert, alertGain, encFor, poolIndex};
root.ENGINE = API;
if(typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
