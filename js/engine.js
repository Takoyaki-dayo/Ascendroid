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
//   cache(0.39.0): 使ったカードはキャッシュに置き、区切り(リフレッシュ)で捨て札へ。効果で引くとき、捨て札を混ぜても今の周回で使ったカードは戻らない
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
//   recover {n}        立て直し(0.36.0): ブレイク・ユニットの破壊で行動を飛ばしたとき、次の行動までを n サイクル縮める
//   punctual {n}       定刻(0.23.0): ディレイを受けない。ディレイを与えられるたび、代わりに増幅+n(0.35.0: n:0 なら増幅は得ない)
//   pursuit {n}        追跡(0.23.0): こちらが手札を入れ替えるか待機するたび、次の行動が n サイクル早まる(最短1)
//   loot / hoard       見せるだけ。盗んだスクラップ(steal)・飲み込んだカード(eat)は撃破すると戻る
// 開幕(0.45.3): 敵・段階変化(phase)・2段目(phase.next)に open:[行動…] を書くと、その並びに入ったときに1回だけ行い、その後 pat を繰り返す
// 行動の窓(0.45.2): recPre は行動の前 recPre サイクルの隙(1.5倍)、counterAfter:{w, d} は行動の後 w サイクルの反撃
//   cap {n}            耐久試験(0.41.3、案): カードの一撃で受けるダメージは n まで(ブロック・防壁を引いた後)
//   improve {n, haste} 改善(0.41.3、案): ユニットが破壊されるたび、増幅 n と加速 haste を得る
// ユニットの shelter(0.41.3、案): ほかのユニットが1つでも残っている間、ダメージを受けない(あふれたダメージも)
// 汚染のカード(0.41.3): data/cards.js の junk。fade なら区切り(リフレッシュ)で手札から消える(ノイズ)。fade でなければ捨て札へ回り続ける。
//   使うと消える。dump は区切りで手札から消えるとき本体へのダメージ。was を持つカード(破片)は使うと元のカードに戻る

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
// 0.45.1: 狙う部位「ランダム」(p:'rand')。行動の並びを持つときに部位を決め、撃つたびに決め直す(予定には決まった部位が出る)
const rollPat = pat => pat.some(a => a.p === 'rand' || a.rp) ? pat.map(a => a.p === 'rand' || a.rp ? Object.assign({}, a, {p:pick(D.slots).id, rp:true}) : a) : pat;
const isJunk = c => !!(D.cards[c.k] && D.cards[c.k].junk); // 汚染のカード(0.41.3)
const fades = c => !!(D.cards[c.k] && D.cards[c.k].fade);   // 区切りで手札から消える汚染
const cur = e => e.pat[e.idx];
// 開幕(0.45.3): 行動の並びの前に1回だけ行う並び open。並び(通常・段階変化・2段目)ごとに持てる。
// e.pat は「開幕+ループ」をつないだもの、e.lf はループの始まりの番号(最後まで行くと e.lf に戻る)
const setPat = (e, src) => { const op = src.open || []; e.pat = rollPat(op.concat(src.pat || [])); e.lf = op.length; e.idx = 0; };
const nxt = (e, i) => i + 1 < e.pat.length ? i + 1 : (e.lf || 0);
// 次の行動へ。ai:'rand' なら重み wt で選ぶ(同じ行動は3回続けない)。phase なら耐久が at 割を切った後に行動の並びが変わる
// ランダムに選ぶ敵も、先の行動まで決めておく(0.18.3)。e.queue に今の行動(e.idx)の後の並びを QN 個持ち、予定にもそのまま出す
const QN = 8;
function pickMove(e, seq){
  const h = seq || e.hist || [], n = h.length, ok = e.pat.map((m, i) => i >= (e.lf || 0) && moveOk(e, m) && !(n >= 2 && h[n - 1] === i && h[n - 2] === i));
  let tot = 0; e.pat.forEach((m, i) => { if(ok[i]) tot += m.wt || 1; });
  let x = rand() * tot;
  for(let i = 0; i < e.pat.length; i++){ if(!ok[i]) continue; x -= e.pat[i].wt || 1; if(x <= 0) return i; }
  return e.pat.length - 1;
}
// 先の行動の並びを QN 個まで足す(同じ行動が3回続かないよう、これまでの行動と並びを続けて見る)
function fillQueue(e){
  if(e.ai !== 'rand') return;
  e.queue = (e.queue || []).filter(i => moveOk(e, e.pat[i]));
  if(e.idx < (e.lf || 0) - 1){ const rest = []; for(let i = e.idx + 1; i < e.lf; i++) rest.push(i); e.queue = rest.concat(e.queue.filter(i => i >= e.lf)); } // 開幕の残りを先に
  while(e.queue.length < QN) e.queue.push(pickMove(e, [...(e.hist || []), e.idx, ...e.queue]));
}
// 並びを決め直す(行動の並びそのものが変わったとき)
function resetQueue(e){ if(e.ai !== 'rand') return; e.queue = []; if(!e.lf) e.idx = pickMove(e, e.hist || []); fillQueue(e); }
// ブレイク・ユニットの破壊で行動を飛ばす(0.36.0): 飛ばした行動までの残りの時間はそのまま残す(後ろの予定を前に詰めない)
// 立て直し(passive recover {n}): その敵だけ、残りを n サイクル縮める(最短1)
// 連動(0.39.0、行動の link): ブレイクされると次の行動も一緒に飛ばす(飛ばした行動の間隔は残す)
function skipMove(e){
  const left = Math.max(0, e.r), a0 = e.pat[e.idx]; advance(e);
  if(a0 && a0.link){ const l2 = e.r; advance(e); e.r += l2; }
  if(left > 0) e.r = Math.max(1, e.r + left - pasN(e, 'recover'));
}
function advance(e){
  if(e.hist){ e.hist.push(e.idx); if(e.hist.length > 4) e.hist.shift(); }
  if(e.phase && !e.phased && (e.phase.when === 'parts' ? e.uids.every(k => e.units[k].core || e.units[k].broken) : e.hp < e.maxHp * e.phase.at)){ e.phased = true; setPat(e, e.phase); e.hist = []; resetQueue(e); }
  // 2段目の段階変化(0.40.2、phase.next:{at, pat}): 1段目の後、耐久が next.at 割を切ると変わる
  else if(e.phased && !e.phased2 && e.phase && e.phase.next && e.hp < e.maxHp * e.phase.next.at){ e.phased2 = true; setPat(e, e.phase.next); e.hist = []; resetQueue(e); }
  else if(e.ai === 'rand'){ fillQueue(e); e.idx = e.queue.shift(); fillQueue(e); }
  else e.idx = nxt(e, e.idx);
  // 破壊されたユニットの行動は飛ばす
  for(let k = 0; k < e.pat.length && !moveOk(e, e.pat[e.idx]); k++){ if(e.ai === 'rand'){ fillQueue(e); e.idx = e.queue.shift(); fillQueue(e); } else e.idx = nxt(e, e.idx); }
  const a = e.pat[e.idx];
  e.r = gap(e, a.dl); e.seq++; e.chain = 0; e.sh = a.guard ? a.guard.s : 0;
}
// 加速した敵と、統率が効いている敵は、行動の間隔が縮む(最短2)
const cmdN = e => (e.pas || []).reduce((s, p) => s + (p.k === 'command' && e.units[p.unit] && !e.units[p.unit].broken ? p.n : 0), 0);
// 加速・統率で縮んだ間隔。下限はパッシブ floor(0.27.0。無ければ1)。もとの間隔が下限より短ければそのまま
const floorN = e => (e.pas || []).reduce((m, p) => p.k === 'floor' ? Math.max(m, p.n) : m, 1);
const gap = (e, dl) => { const r = (e.haste || 0) + cmdN(e); return r ? Math.max(Math.min(dl, floorN(e)), dl - r) : dl; };
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
// 0.38.0: 部位の強化の段階(run.slotLv)を当てた定義
function partOf(run, slot){ const id = run.parts[slot].id, lv = (run.slotLv || {})[slot] || 0; return D.partDef ? D.partDef(id, lv) : D.parts[id]; }
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
  else { n += fx(st, 'arm', 'ranged'); if(c.cost >= 4) n += fx(st, 'arm', 'heavyRanged'); } // heavyRanged(0.36.0、シャープシューター): 4コスト以上の遠隔+
  // 自機の増幅(0.33.0、カードの amp:{t, n}): この戦闘の間、その種類の攻撃のダメージ+
  if(st.b && st.b.amp) n += st.b.amp[dd.t] || 0;
  return n;
}
function blockOf(st, c){ return c.block + fx(st, 'dur', 'block'); }

/* ---------- 山札 ---------- */
// 1枚引く。手札が上限なら、引いたカードは捨て札へ(あふれ)
function drawOne(b){
  if(!b.draw.length){ b.draw = shuffle(b.disc); b.disc = []; }
  if(!b.draw.length) return null;
  const c = b.draw.pop(); delete c.dc; // コストの増減(0.36.0、drawShift)は手札にある間だけ
  if(b.hand.length >= b.handMax){ b.disc.push(c); return {burn:c}; }
  b.hand.push(c); return {card:c};
}
function drawN(b, n){ let got = 0; for(let i = 0; i < n; i++){ const r = drawOne(b); if(r && r.card) got++; } return got; }
// カードの効果で引く(0.36.0): パーツ drawShift があれば、引いたカードのコストを1枚ごとに半々で+1か−1
function drawFx(st, n, ev){
  const b = st.b, m = drawN(b, n), s = fx(st, 'mob', 'drawShift');
  if(s && m) for(const cd of b.hand.slice(-m)){ cd.dc = (rand() < 0.5 ? -s : s); ev.push({kind:'costShift', id:cd.id, n:cd.dc}); }
  return m;
}
// 手札のカードのコスト(drawShift の増減込み。0未満にならない)
const costOf = cd => Math.max(0, D.cards[cd.k].cost + (cd.dc || 0));

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
      idx = nxt(e, idx);
      for(let j = 0; j < e.pat.length && !moveOk(e, e.pat[idx]); j++) idx = nxt(e, idx);
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
  if(p.shelter && e.uids.some(k => k !== uid && !e.units[k].broken)){ ev.push({kind:'immune', e:e.i, unit:uid}); return; } // 0.41.3: 守られている(ほかのユニットが残っている間は無敵)
  const take = Math.min(p.hp, d), over = d - take;
  p.hp -= take; ev.push({kind:'dmg', e:e.i, unit:uid, n:take});
  if(p.hp <= 0 && !p.broken){
    p.broken = true; p.vuln = 0; p.ctrA = null; ev.push({kind:'unitBreak', e:e.i, unit:uid});
    // 持続(0.29.0): 壊れたユニットの持続は核へ移る(回数・威力とも足す)
    if(p.dot){ const c = coreUid(e); if(c && c !== uid && !e.units[c].broken) addDot(e.units[c], p.dot.n, p.dot.p); delete p.dot; }
    // パッシブ frenzy: ユニットが破壊されるたび攻撃力+
    for(const ps of e.pas || []) if(ps.k === 'frenzy' && e.alive){ e.str = (e.str || 0) + ps.n; ev.push({kind:'frenzy', e:e.i, n:ps.n}); }
    for(const ps of e.pas || []) if(ps.k === 'improve' && e.alive){ e.str = (e.str || 0) + (ps.n || 0); e.haste = (e.haste || 0) + (ps.haste || 0); ev.push({kind:'frenzy', e:e.i, n:ps.n || 0}); } // 改善(0.41.3)
    // broke: このユニットが破壊されると行動の並びが変わる
    const nb = (D.foes[e.key].broke || {})[uid];
    if(nb && e.alive){ e.pat = rollPat(nb); e.lf = 0; e.idx = 0; e.hist = []; e.sh = 0; e.chain = 0; resetQueue(e); ev.push({kind:'shift', e:e.i, unit:uid}); }
    else fillQueue(e); // 破壊されたユニットの行動を並びから除いて足す
    // 予定に入っていたこのユニットの行動は消える
    if(e.alive && !moveOk(e, cur(e)) && e.uids.some(k => !e.units[k].broken && e.units[k].vital)){ const nm = cur(e).n; skipMove(e); ev.push({kind:'cancel', e:e.i, name:nm}); }
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
  n += p.crack || 0; b.lastHit = n; // 写す(mimic)用に、こちらの最後の一撃
  let d = n;
  if(p.vuln > 0 || (onActor && a.recPre && inWin(e, {w:a.recPre}))){ d = Math.round(d * 1.5); b.vulnHits = (b.vulnHits || 0) + 1; ev.push({kind:'vulnHit', e:e.i, unit:uid}); } /* 0.45.2: recPre は行動の前の隙 */
  if(onActor && inWin(e, a.guard) && e.sh > 0){ const ab = Math.min(e.sh, d); e.sh -= ab; d -= ab; b.guarded = (b.guarded || 0) + ab; ev.push({kind:'guarded', e:e.i, n:ab}); }
  if(p.armor > 0 && d > 0){ const ab = Math.min(p.armor, d); p.armor -= ab; d -= ab; b.guarded = (b.guarded || 0) + ab; ev.push({kind:'armored', e:e.i, unit:uid, n:ab}); }
  if(onActor && inWin(e, a.counter)){ const res = strike(st, e, {n:a.n, d:a.counter.d, p:a.p || 'dur'}, 0, true); afterHit(b); b.countered = (b.countered || 0) + 1; ev.push({kind:'counter', e:e.i, res}); }
  else if(p.ctrA && p.ctrA.left > 0){ const res = strike(st, e, {n:p.ctrA.n, d:p.ctrA.d, p:p.ctrA.p}, 0, true); afterHit(b); b.countered = (b.countered || 0) + 1; ev.push({kind:'counter', e:e.i, res}); } /* 0.45.2: 行動の後の反撃 */
  const cp = pasN(e, 'cap'); if(cp && d > cp){ ev.push({kind:'capped', e:e.i, n:d - cp}); d = cp; } // 耐久試験(0.41.3)
  if(d > 0) hurtFoe(b, e, d, ev, uid);
  if(e.alive && onActor && cur(e) === a && inWin(e, a.wind) && n >= a.wind.poise){ const nm = a.n; skipMove(e); b.breaks = (b.breaks || 0) + 1; ev.push({kind:'break', e:e.i, name:nm}); }
}
function gainBlock(b, n){
  const bd = RULE.blockDecay;
  if(b.blockBonus && b.T < b.blockBonus.until) n += b.blockBonus.n; // クロック防御(0.40.0)
  n += b.fort || 0;                                                  // 堅固(0.40.0): ブロックを得るたびその分が増える
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
// 属性(0.28.0、data/attrs.js): カードに付いた属性の定義
const attrOf = c => c && c.attr && D.attrs && D.attrs[c.attr] ? D.attrs[c.attr] : null;
// 属性の効果。e・uid は当たった(狙った)敵とユニット(無ければ自分への効果だけ)。n はそのヒットのダメージ(もう1回当たる用)
function attrFx(st, A, e, uid, ev, n){
  const b = st.b, f = A.fx || {}, live = e && e.alive && uid && e.units[uid] && !e.units[uid].broken;
  if(f.crack && live){ e.units[uid].crack += f.crack; ev.push({kind:'crack', e:e.i, unit:uid, n:f.crack}); }
  if(f.delay && e && e.alive){ const v = delayFoe(e, f.delay); ev.push({kind:'delay', e:e.i, n:v, anger:punctGain(e)}); }
  if(f.gain){ b.charge = (b.charge || 0) + f.gain; ev.push({kind:'charge', n:f.gain}); }
  if(f.block){ gainBlock(b, f.block); ev.push({kind:'block', n:f.block}); }
  if(f.draw){ const m = drawFx(st, f.draw, ev); ev.push({kind:'draw', n:m}); }
  if(f.again && live && n != null) hitFoe(st, e, n, ev, uid);
  // 0.33.0: 侵食(持続)を与える / 本体の耐久を回復する
  if((f.dotn || f.dotp) && live){ addDot(e.units[uid], f.dotn || 0, f.dotp || 0); ev.push({kind:'dotAdd', e:e.i, unit:uid, n:f.dotn || 0, p:f.dotp || 0}); }
  if(f.heal){ const r = st.run, v = Math.min(f.heal, r.bodyMax - r.body); r.body += v; ev.push({kind:'heal', n:v}); }
  // 0.35.0: 敵のすべてのユニットにダメージ(all。ヒット。クラック・隙は効くが、パーツ・増幅の補正は無い)。狙った敵ごとに呼ばれるので、その敵だけ
  if(f.all){ for(const t of (e ? [e] : b.foes)) for(const k of liveUids(t)) if(t.alive && !t.units[k].broken) hitFoe(st, t, f.all, ev, k); }
}
// ブレイクしたときの属性(0.33.0、on:'break'): このカード(時限を含む)で敵の行動をブレイクしたとき、その敵ごとに1回
function breakAttr(st, c, ev, extra){
  const A = attrOf(c); if(!A || A.on !== 'break') return;
  const es = new Set([...ev.filter(x => x.kind === 'break').map(x => x.e), ...(extra || [])]);
  for(const i of es){ const e = st.b.foes[i]; if(e) attrFx(st, A, e, e.alive ? defaultUid(e) : null, ev); }
}
// ヒットごとの属性を付けて当てる
function hitA(st, c, e, n, ev, uid){ hitFoe(st, e, n, ev, uid); const A = attrOf(c); if(A && A.on === 'hit') attrFx(st, A, e, uid, ev, n); }
// 持続(0.29.0、名前は仮): ユニットごとに {n:回数, p:威力}。カードで足す(合算)。毎サイクルの終わりに威力分のダメージを与え、回数が1減る。0で消える
// 回数0のユニットに威力だけ足したときは回数1にする。持続のダメージはヒットではない(クラック・隙・ブロック・防壁・反撃・体勢・属性はどれも関係しない)
function addDot(u, n, p){ const fresh = !u.dot || (u.dot.n <= 0 && u.dot.p <= 0), d = u.dot || {n:0, p:0}; d.n += n || 0; d.p += p || 0; if(fresh && d.n > 0 && d.p <= 0) d.p = 1; /* 0.45.1: 侵食の無い相手に回数だけ与えたら威力1 */ if(d.n <= 0 && d.p > 0) d.n = 1; if(d.n > 0) u.dot = d; }
function tickDots(st){
  const b = st.b, ev = [];
  for(const e of b.foes) if(e.alive) for(const k of e.uids.slice()){
    const u = e.units[k]; if(!u.dot || u.broken) continue;
    const d = u.dot; d.n--; if(d.n <= 0) delete u.dot;
    if(d.p > 0){ ev.push({kind:'dot', e:e.i, unit:k, n:d.p}); b.dotDmg = (b.dotDmg || 0) + d.p; b.dotPeak = Math.max(b.dotPeak || 0, d.p); hurtFoe(b, e, d.p, ev, k); }
    if(!e.alive) break;
  }
  if(ev.length) b.dotCyc = (b.dotCyc || 0) + 1;
  return ev;
}
// このカードが敵 e にダメージを与えるか(不安定のブレイク、0.31.0)。時限は撃ったときには当たらない
function cardHitsFoe(b, c, e, ti){
  const dmg = !!c.dmg || !!(c.spend && c.spend.dmg && (c.spend.n ? (b.charge || 0) >= c.spend.n : (b.charge || 0) > 0));
  if(!dmg) return false;
  return !!c.all || (!!c.tgt && parseT(ti).i === e.i);
}
// この戦闘で増えたダメージ(grow)。キーは属性を除いた元のカード
const baseKey = k => String(k).split('@')[0].replace(/\+$/, '');
const growOf = (b, k) => (b && b.grow && k) ? (b.grow[baseKey(k)] || 0) : 0;
// 決まった量の充電を消費するカード(spend.n)は、充電が足りないと使えない
const spendShort = (b, c) => !!(c && c.spend && c.spend.n && (b.charge || 0) < c.spend.n);
// 対象の侵食の回数(needDot)・威力(needDotP、0.36.3)が足りないと使えない。uid が無ければ、どれか1つのユニットが足りていればよい
const dotShort = (b, c, e, uid) => { if(!c || !(c.needDot || c.needDotP)) return false; const ok = k => { const u = e && e.alive && e.units[k]; return !!(u && !u.broken && u.dot && u.dot.n >= (c.needDot || 0) && u.dot.p >= (c.needDotP || 0)); }; return uid ? !ok(uid) : !(e && liveUids(e).some(ok)); };
const needShort = (b, c) => !!(c && (c.needDot || c.needDotP) && !b.foes.some(e => !dotShort(b, c, e)));
function applyCard(st, k, ti){
  const c = D.cards[k], b = st.b, ev = [];
  const T = parseT(ti);
  // 全体のカードは敵のすべてのユニット。単体は指定のユニット(なければおまかせ)
  const targets = c.all ? b.foes.filter(e => e.alive) : (c.tgt ? [b.foes[T.i]].filter(e => e && e.alive) : []);
  const uidOf = e => !c.all && T.uid && e.units[T.uid] && !e.units[T.uid].broken ? T.uid : defaultUid(e);
  const base = baseKey(k), ev0 = ev.length;
  if(c.dmg){
    const n = dmgOf(st, c) + growOf(b, k);
    for(const e of targets) for(const k of (c.all ? liveUids(e) : [uidOf(e)])) for(let h = 0; h < (c.dmg.x || 1); h++){ if(!e.alive || e.units[k].broken) break; hitA(st, c, e, n, ev, k); }
  }
  // 充電: spend は貯めた充電をすべて消費し、1につき dmg / block。gain は充電を得る(消費の後)
  // spend.n(0.28.0): 決まった量 n を消費し、dmg / block はその合計(1あたりではない)。足りなければ使えない(spendShort)
  if(c.spend){
    const fixed = !!c.spend.n, n = fixed ? Math.min(c.spend.n, b.charge || 0) : (b.charge || 0); b.charge = (b.charge || 0) - n; ev.push({kind:'spend', n});
    const mul = fixed ? (n >= c.spend.n ? 1 : 0) : n;
    if(mul > 0 && c.spend.dmg){ const d = dmgOf(st, c, {t:c.spend.dmg.t, n:c.spend.dmg.n * mul}); for(const e of targets) for(const k of (c.all ? liveUids(e) : [uidOf(e)])) if(e.alive && !e.units[k].broken) hitA(st, c, e, d, ev, k); }
    if(mul > 0 && c.spend.block){ const m = c.spend.block * mul + fx(st, 'dur', 'block'); gainBlock(b, m); ev.push({kind:'block', n:m}); }
  }
  // ユニットを破壊したときスクラップ(0.30.0、scrapBreak): このカードのダメージで壊れたユニットの数だけ
  if(c.scrapBreak){ const nb = ev.slice(ev0).filter(x => x.kind === 'unitBreak').length; if(nb){ const v = c.scrapBreak * nb; st.run.scrap = (st.run.scrap || 0) + v; ev.push({kind:'scrapGain', n:v}); } }
  // この戦闘の間、同じカード(属性違いも含む)のダメージが増える(0.30.0、grow)
  if(c.grow){ b.grow = b.grow || {}; b.grow[base] = (b.grow[base] || 0) + c.grow; ev.push({kind:'grow', k:base, n:c.grow}); }
  if(c.gain){ b.charge = (b.charge || 0) + c.gain; ev.push({kind:'charge', n:c.gain}); }
  if(c.crack) for(const e of targets) if(e.alive){ const k = uidOf(e); e.units[k].crack += c.crack; ev.push({kind:'crack', e:e.i, unit:k, n:c.crack}); }
  // 侵食を減らす(0.35.0、dotCut:{n, p})。回数が0以下になると消える
  // rep(0.36.0、パラレルハックの強化): 減らして与えるのを rep 回。2回目からは対象の侵食が needDot・needDotP を満たすときだけ
  for(let r = 0; r < (c.rep || 1); r++){
  if(r > 0 && (c.needDot || c.needDotP) && targets.every(e => dotShort(b, c, e, c.all ? null : uidOf(e)))) break;
  if(c.dotCut) for(const e of targets) if(e.alive) for(const k of (c.all ? liveUids(e) : [uidOf(e)])){ const u = e.units[k]; if(!u.dot) continue; u.dot.n -= c.dotCut.n || 0; u.dot.p = Math.max(0, u.dot.p - (c.dotCut.p || 0)); if(u.dot.n <= 0) delete u.dot; ev.push({kind:'dotCut', e:e.i, unit:k, n:c.dotCut.n || 0, p:c.dotCut.p || 0}); }
  if(c.dot) for(const e of targets) if(e.alive) for(const k of (c.all ? liveUids(e) : [uidOf(e)])){ addDot(e.units[k], c.dot.n, c.dot.p); ev.push({kind:'dotAdd', e:e.i, unit:k, n:c.dot.n || 0, p:c.dot.p || 0}); }
  }
  if(c.delay) for(const e of targets) if(e.alive){ const v = delayFoe(e, c.delay); ev.push({kind:'delay', e:e.i, n:v, anger:punctGain(e)}); }
  if(c.block){ const n = blockOf(st, c); gainBlock(b, n); ev.push({kind:'block', n}); }
  // 防壁(0.30.0、ward:{w, s}): w サイクルの間、合計 s までのダメージを防ぐ
  if(c.ward){ (b.wards = b.wards || []).push({left:c.ward.w, s:c.ward.s, id:b.uid++}); ev.push({kind:'ward', n:c.ward.s, w:c.ward.w}); }
  // 次の敵の行動をブレイクする(0.30.0、breakNext): 対象の敵の次の行動を飛ばす
  if(c.breakNext) for(const e of targets) if(e.alive){ const nm = cur(e).n; skipMove(e); b.breaks = (b.breaks || 0) + 1; ev.push({kind:'break', e:e.i, name:nm}); }
  // 手札を選んで捨てる(0.30.0、discard): カードを使い終えた後、手札から選ぶ(actions が選ぶ行動だけになる)
  if(c.discard && !c.instant) b.chooseNext = {kind:'discard', n:c.discard};
  // 0.40.0: 手札を選んで廃棄する(exileHand) / 選んだ手札のコストを使うまで下げる(shift:{n, d})
  if(c.exileHand) b.chooseNext = {kind:'exile', n:c.exileHand};
  if(c.shift) b.chooseNext = {kind:'shift', n:c.shift.n, d:c.shift.d};
  if(c.blockBonus){ b.blockBonus = {n:c.blockBonus.n, until:b.T + c.blockBonus.t}; ev.push({kind:'blockBonus', n:c.blockBonus.n, t:c.blockBonus.t}); }
  if(c.ampAll){ b.amp = b.amp || {}; for(const t of ['melee', 'ranged']){ b.amp[t] = (b.amp[t] || 0) + c.ampAll; ev.push({kind:'amp', t, n:c.ampAll}); } }
  if(c.fort){ b.fort = (b.fort || 0) + c.fort; ev.push({kind:'fort', n:c.fort}); }
  if(c.refDraw){ b.refDraw = (b.refDraw || 0) + c.refDraw; ev.push({kind:'refDraw', n:c.refDraw}); }
  if(c.swift){ b.swift += c.swift; ev.push({kind:'swift', n:c.swift}); }
  if(c.timer && targets[0]){ b.timers.push({id:b.uid++, left:c.timer.t, k, e:targets[0].i, unit:uidOf(targets[0])}); ev.push({kind:'timerSet', e:targets[0].i, t:c.timer.t}); }
  if(c.draw){ const n = drawFx(st, c.draw, ev); if(c.borrow) b.drawIn += c.draw * RULE.draw; ev.push({kind:'draw', n, borrow: !!c.borrow}); }
  // 0.17.0: スウィフトはディレイに統一(パーツの効果も敵へのディレイ)
  if(c.cost === 0){ const s = fx(st, 'mob', 'zeroDelay'); if(s) for(const e of b.foes) if(e.alive){ const v = delayFoe(e, s); ev.push({kind:'delay', e:e.i, n:v, anger:punctGain(e)}); } }
  // 0.33.0: 自分にクラック(selfCrack) / 自機の増幅(amp:{t, n}) / 自分にダメージ(selfDmg、本体に直接。ブロックでは防げない)
  if(c.selfCrack){ b.crack = (b.crack || 0) + c.selfCrack; ev.push({kind:'selfCrack', n:c.selfCrack}); }
  if(c.amp && c.amp.n){ (b.amp = b.amp || {})[c.amp.t] = (b.amp[c.amp.t] || 0) + c.amp.n; ev.push({kind:'amp', t:c.amp.t, n:c.amp.n}); }
  if(c.selfDmg){ const v = Math.min(c.selfDmg, st.run.body); st.run.body -= v; ev.push({kind:'selfDmg', n:v}); }
  // 発動したときの属性: 全体のカードは敵ごと、単体は狙った敵、狙わないカードは自分への効果だけ
  const A = attrOf(c);
  if(A && A.on === 'cast'){ if(targets.length) for(const e of (c.all ? targets : targets.slice(0, 1))) attrFx(st, A, e, uidOf(e), ev); else attrFx(st, A, null, null, ev); }
  breakAttr(st, c, ev, b.justBroke); b.justBroke = null;
  return ev;
}
function fireTimer(st, t){
  const b = st.b, c = D.cards[t.k], ev = [];
  let e = b.foes[t.e];
  if(!e || !e.alive) e = b.foes.find(f => f.alive);
  if(e) hitA(st, c, e, dmgOf(st, c, c.timer.dmg), ev, e === b.foes[t.e] ? t.unit : defaultUid(e));
  return ev;
}
// 時限の後の不安定のブレイクも含めて、ブレイクしたときの属性を働かせる
function timerBreakAttr(st, t, ev){ const c = D.cards[t.k]; if(c) breakAttr(st, c, ev);
}
// 敵の攻撃1回。extra は連携の上乗せ
// 敵の攻撃の上乗せ: 増幅 − 虚弱(0.35.0)。攻撃の威力は0未満にならない(strike で切る)
const foeStr = e => (e.str || 0) - (e.weak || 0);
/* 行動そのものが足すダメージ(0.45.0 で画面と共有): armorDmg は行動したユニットのブロック armorDmg ごとに+1、mimic はこちらが最後に当てた一撃の分 */
const moveBonus = (b, e, a) => (a.armorDmg ? Math.floor(((e.units[actorUid(e, a)] || {}).armor || 0) / a.armorDmg) : 0) + (a.mimic && b ? b.lastHit || 0 : 0)
  + (a.armorSpend ? Math.floor(((e.units[actorUid(e, a)] || {}).armor || 0) * a.armorSpend) : 0)  /* 0.45.1: 行動したユニットのブロックの armorSpend 割を使って威力に */
  + (a.spend ? a.spend * (e.charge || 0) : 0)                                                      /* 0.45.1: 敵の充電1につき spend */
  + (a.d > 0 ? e.prime || 0 : 0);                                                                 /* 0.45.1: 次の攻撃のダメージ+(prime) */
function strike(st, e, a, extra, noParry){
  const b = st.b, raw = Math.max(0, a.d + (extra || 0)) + (b.crack || 0);
  if(b.parryNow && !noParry){ const ev = []; hurtFoe(b, e, b.parryHalf ? Math.ceil(raw / 2) : raw, ev, actorUid(e, a.by ? a : cur(e))); return {kind:'parried', name:a.n, raw, ev}; }
  // 防壁(0.30.0): 期限付きの守り。古いものから先に受ける。残りをブロックが受ける
  let wd = 0; for(const w of b.wards || []){ const x = Math.min(w.s, raw - wd); w.s -= x; wd += x; if(wd >= raw) break; }
  if(b.wards) b.wards = b.wards.filter(w => w.s > 0);
  const ab = Math.min(b.block, raw - wd); b.block -= ab; b.blockUsed = (b.blockUsed || 0) + ab + wd;
  const rem = raw - wd - ab, p = b.parts[a.p];
  let partLoss = 0, bodyLoss = 0, broke = false;
  if(rem > 0){
    if(p.cur > 0){ partLoss = Math.min(p.cur, rem); p.cur -= partLoss; if(p.cur === 0){ broke = true; b.broken[a.p] = true; } bodyLoss = rem - partLoss; }
    else bodyLoss = rem;
    st.run.body = Math.max(0, st.run.body - bodyLoss);
  }
  return {kind:'hit', name:a.n, part:a.p, raw, extra:extra || 0, blocked:ab + wd, partLoss, bodyLoss, broke, hurt:rem > 0};
}
// ディレイ(0.21.0): 敵は次の行動までにディレイを受けるたび抵抗が1増え、その分だけ次のディレイが減る。行動すると0に戻る(enemyAct)
// 敵の列が1本になってディレイが強すぎたため。重ねがけを止める
// 定刻の敵(passive punctual)はディレイを受けず、代わりに増幅を得る。戦闘開始時のディレイ(free)では何も起きない
const pasN = (e, k) => (e.pas || []).reduce((s, p) => s + (p.k === k ? (p.n || 1) : 0), 0);
// 定刻(0.35.0): ディレイを受けないのは n に関係なく。n は代わりに得る増幅(0 なら得ない。書いていなければ 1)
const hasPunct = e => (e.pas || []).some(p => p.k === 'punctual');
const punctGain = e => (e.pas || []).reduce((s, p) => s + (p.k === 'punctual' ? (p.n == null ? 1 : p.n) : 0), 0);
function delayFoe(e, v, free){
  if(hasPunct(e)){ const pn = punctGain(e); if(!free && v > 0 && pn){ e.str = (e.str || 0) + pn; e.anger = (e.anger || 0) + 1; } return 0; }
  const a = Math.max(0, v - (e.resist || 0)); e.r += a; if(!free) e.resist = (e.resist || 0) + 1; return a;
}
function enemyAct(st, e, extra){ e.resist = 0;
  const a = cur(e), mv = e.idx < (e.lf || 0) ? (e.phased ? 'phaseopen:' : 'open:') + e.idx : (e.phased ? 'phase:' : 'pat:') + (e.idx - (e.lf || 0));
  const res = a.kind === 'delay' ? {kind:'delay', name:a.n, v:a.v} : a.d > 0 ? strike(st, e, a, (extra || 0) + foeStr(e) + moveBonus(st.b, e, a)) : {kind:'move', name:a.n};
  res.by = actorUid(e, a); res.mv = mv;
  // 多段: 残りを1サイクルおきに撃つ
  if(a.hits > 1 && !e.chain){ e.chain = a.hits - 1; e.r = 1; e.sh = 0; res.chainLeft = e.chain; return res; }
  if(e.chain > 0){ e.chain--; if(e.chain > 0){ e.r = 1; res.chainLeft = e.chain; return res; } }
  res.chainLeft = 0;
  // 0.45.1: 撃ち終えたら、使ったブロック(armorSpend)・充電(spend)・次の攻撃の上乗せ(prime)を消す
  if(a.armorSpend){ const u = e.units[actorUid(e, a)]; if(u) u.armor -= Math.floor((u.armor || 0) * a.armorSpend); }
  if(a.spend){ res.spent = e.charge || 0; e.charge = 0; }
  if(a.d > 0 && e.prime){ e.prime = 0; }
  if(a.d > 0 && res.kind === 'hit') afterHit(st.b);
  const ap = e.units[actorUid(e, a)];
  if(a.rec) ap.vuln = a.rec + 1;
  if(a.counterAfter) ap.ctrA = {left:a.counterAfter.w + 1, d:a.counterAfter.d, p:a.p || 'dur', n:a.n}; // 0.45.2: 行動の後 w サイクル、殴られるたび d を返す
  if(a.buff){ for(const f of (a.all ? st.b.foes.filter(f => f.alive) : [e])) f.str = (f.str || 0) + a.buff; res.buff = a.buff; }
  // 放置の代償になる行動
  const b = st.b;
  if(a.gain){ e.charge = (e.charge || 0) + a.gain; res.gain = a.gain; }      // 0.45.1: 敵の充電(spend の攻撃で消費する)
  if(a.prime){ e.prime = (e.prime || 0) + a.prime; res.prime = a.prime; }    // 0.45.1: 次の攻撃のダメージ+
  if(a.fort){ e.fort = (e.fort || 0) + a.fort; res.fort = a.fort; }          // 堅固: 以後、ブロックを得るたびその分が増える
  if(a.armor){ const g = a.armor + (e.fort || 0); ap.armor += g; res.armor = g; }                // 装甲を重ねる(行動したユニットに。消えない)
  if(a.heal){ const hp = !ap.broken ? ap : e.units[defaultUid(e)]; const h = Math.min(a.heal, hp.max - hp.hp); hp.hp += h; syncHp(e); res.heal = h; } // 修復(破壊されたユニットは戻らない)
  if(a.haste){ e.haste = (e.haste || 0) + a.haste; res.haste = a.haste; }                // 加速: 以後の間隔が縮む
  if(a.zone){ b.zones.push({id:b.uid++, from:a.zone.at, to:a.zone.at + a.zone.len - 1, d:Math.max(0, a.zone.d + foeStr(e)), p:a.zone.p, e:e.i, n:a.n}); res.zone = a.zone; } // 危険域
  const ac = a.crack || a.mark; // こちらにクラック(受ける攻撃すべて+)。mark は 0.14 までの名前(実験の古い敵のデータ用)
  if(ac){ b.crack = (b.crack || 0) + ac; res.crack = ac; }
  if(a.noise){ for(let i = 0; i < a.noise; i++){ const at = Math.floor(rand() * (b.draw.length + 1)); b.draw.splice(at, 0, {k:'noise', id:b.uid++}); } res.noise = a.noise; } // ノイズ注入
  // 0.41.3: 崩す(こちらのブロックを shred 失わせる。true なら全て) / 汚染(junk:{k, n, to:'draw'|'hand'|'disc'}) / 割る(手札のカード shatter 枚を《破片》に変える)
  if(a.shred){ const v = a.shred === true ? b.block : Math.min(b.block, a.shred); b.block -= v; res.shred = v; }
  if(a.junk){ const j = a.junk; for(let i = 0; i < (j.n || 1); i++){ const c = {k:j.k, id:b.uid++}; if(j.to === 'hand' && b.hand.length < (b.handMax || 10)) b.hand.push(c); else if(j.to === 'disc' || j.to === 'hand') b.disc.push(c); else b.draw.splice(Math.floor(rand() * (b.draw.length + 1)), 0, c); } res.junk = j; }
  if(a.shatter){ res.shatter = []; for(let n = 0; n < a.shatter; n++){ const hs = b.hand.filter(c => !isJunk(c)); if(!hs.length) break; const pk = pick(hs), i = b.hand.indexOf(pk); b.hand[i] = {k:'shard', id:b.uid++, was:pk}; res.shatter.push(pk); } }
  if(a.summon && b.foes.filter(f => f.alive).length < 3){ const nf = makeFoe(a.summon, b.foes.length); b.foes.push(nf); res.summon = nf.i; } // 増援
  // 0.23.0: 盗む(スクラップ。撃破すると戻る) / 飲み込む(手札のいちばんコストの高いカード。撃破すると捨て札に戻る) / 再溶接(破壊されたユニットを直す) / 逃げる
  if(a.steal){ const t = Math.min(st.run.scrap || 0, a.steal); st.run.scrap -= t; e.loot = (e.loot || 0) + t; res.steal = t; }
  if(a.eat){
    res.eat = [];
    for(let n = 0; n < a.eat; n++){
      const hs = b.hand.filter(c => !isJunk(c)); if(!hs.length) break;
      const top = Math.max(...hs.map(c => D.cards[c.k].cost)), pk = pick(hs.filter(c => D.cards[c.k].cost === top));
      b.hand.splice(b.hand.indexOf(pk), 1); (e.eaten = e.eaten || []).push(pk); res.eat.push(pk);
    }
  }
  if(a.rebuild){
    const k = e.uids.find(k => e.units[k].broken && !e.units[k].core);
    if(k){ const u = e.units[k]; u.broken = false; u.hp = Math.min(u.max, a.rebuild); u.crack = 0; u.vuln = 0; syncHp(e); fillQueue(e); res.rebuild = k; }
    else { const hp = !ap.broken ? ap : e.units[defaultUid(e)]; const h = Math.min(Math.ceil(a.rebuild / 2), hp.max - hp.hp); hp.hp += h; syncHp(e); res.heal = h; }
  }
  if(a.rp){ e.pat = e.pat.slice(); e.pat[e.idx] = Object.assign({}, a, {p:pick(D.slots).id}); } // ランダムの部位を決め直す
  if(a.flee){ e.alive = false; e.fled = true; e.reactIn = null; res.flee = true; return res; }
  advance(e);
  return res;
}

/* ---------- 時間を進める ----------
   カード(k あり)、入れ替え・待機(k なし)のどれも、cost サイクルぶん時間を進める。
   1サイクルごとにイベントを返すので、画面はそれを見て演出し、プレビューは最後まで回して結果だけを見る */
function* spendGen(st, cost, k, ti, noInt){
  const b = st.b, c = k ? D.cards[k] : null, atomic = !c || !!c.atomic || !!b.atomicNow, waiting = !c && !!b.waiting;
  b.waiting = false; b.atomicNow = false;
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
      for(const e of b.foes) if(e.alive){ e.r--; if(e.reactIn != null) e.reactIn--; for(const k of e.uids){ const u = e.units[k]; if(u.vuln > 0) u.vuln--; if(u.ctrA && u.ctrA.left > 0) u.ctrA.left--; } }
      for(const z of b.zones){ z.from--; z.to--; }
      b.zones = b.zones.filter(z => z.to >= 0);
      decayBlock(b);
      for(const t of b.timers) t.left--;
      if(b.wards && b.wards.length){ for(const w of b.wards) w.left--; b.wards = b.wards.filter(w => w.left > 0 && w.s > 0); }
    }
    yield {type:'tick', real};
    if(real){
      // 時限の効果
      const due = b.timers.filter(t => t.left <= 0);
      if(due.length){
        b.timers = b.timers.filter(t => t.left > 0);
        for(const t of due){
          const ev = fireTimer(st, t);
          // 不安定(0.31.0): 時限もカードのダメージなので、この行動と同じサイクルに当たればブレイク
          for(const e of b.foes) if(e.alive && e.r <= 0 && cur(e).ch && !e.chain && ev.some(x => x.kind === 'dmg' && x.e === e.i)){ const nm = cur(e).n; skipMove(e); /* 0.40.4: 連動(link)も飛ばす */ b.breaks = (b.breaks || 0) + 1; ev.push({kind:'break', e:e.i, name:nm}); }
          timerBreakAttr(st, t, ev);
          yield {type:'timer', t, ev};
        }
        if(!b.foes.some(e => e.alive)){ b.cast = null; out.won = true; return out; }
      }
      // 持続(0.29.0): 時限の後、敵の行動の前
      if(b.foes.some(e => e.alive && e.uids.some(k => e.units[k].dot))){
        const ev = tickDots(st); if(ev.length) yield {type:'dot', ev};
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
        // JUST のときの属性(0.28.0): このサイクルに行動する敵それぞれに効く。効果はカードの効果と一緒に出す
        const jev = [], JA = attrOf(c);
        if(real && JA && JA.on === 'just') for(const e of b.foes) if(e.alive && e.r <= 0) attrFx(st, JA, e, actorUid(e, cur(e)), jev);
        // JUST の効果(0.35.0、見切り): このサイクルに行動する敵の行動をブレイクする(justBreak)/ 虚弱を与える(justWeak)
        if(real && (c.justBreak || c.justWeak)) for(const e of b.foes){
          if(!e.alive || e.r > 0 || !(c.all || (c.tgt && parseT(ti).i === e.i))) continue;
          if(c.justWeak){ e.weak = (e.weak || 0) + c.justWeak; jev.push({kind:'weak', e:e.i, n:c.justWeak}); }
          if(c.justBreak){ const nm = cur(e).n; skipMove(e); b.breaks = (b.breaks || 0) + 1; out.justs.push({i:e.i, name:nm}); (b.justBroke = b.justBroke || []).push(e.i); yield {type:'just', e:e.i, crack:0, delay:0}; }
        }
        if(real) for(const e of b.foes){
          // 不安定(0.31.0): カードでダメージを与えるときだけ(防御のカードや持続ではブレイクしない)
          if(e.alive && e.r <= 0 && cur(e).ch && !e.chain && cardHitsFoe(b, c, e, ti)){
            const nm = cur(e).n, jp = actorUid(e, cur(e)); skipMove(e); /* 0.40.4: JUST でも連動(link)の次の行動を飛ばす(前は advance で飛ばしていなかった) */
            const cr = fx(st, 'calc', 'justCrack'); e.units[jp].crack += cr;
            const dl = fx(st, 'calc', 'justDelay'); if(dl) delayFoe(e, dl);
            out.justs.push({i:e.i, name:nm}); (b.justBroke = b.justBroke || []).push(e.i); yield {type:'just', e:e.i, crack:cr, delay:dl};
          }
        }
        if(c.parry && real){ b.parryNow = true; b.parryHalf = !!c.parryHalf; }
        const ev = applyCard(st, k, ti);
        if(jev.length) ev.unshift(...jev);
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
        if(kind === 'react'){ res = Object.assign(strike(st, e, e.react, foeStr(e)), {react:true}); if(res.kind === 'hit') afterHit(b); }
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
// 警戒版(0.44.0 から「+」「++」): 敵のデータの wary:[{at, ...}] の at は警戒の段(1 なら+、2 なら++)。警戒が+1なら「+」、+2なら「++」で出る
//   書いた欄はそのまま置き換える(hp・start・pat・phase・react・units など)。patAdd だけは行動の並びの最後に足す
//   ++ が無い敵は + に DATA.heat.plus2 を上乗せ、警戒版が1つも無い敵は素の形に DATA.heat.boost[段] を上乗せ(会話Bが作るまでの仮)
const waryTier = (key, h) => { const W = D.foes[key] && D.foes[key].wary; if(!W || !(h > 0)) return null; return W.find(w => w.at === h) || (h >= 2 ? W.find(w => w.at === 1) : null) || null; };
function heatBoost(key, h){ if(!(h > 0)) return null; const W = (D.foes[key] && D.foes[key].wary) || [], H = HT();
  if(W.some(w => w.at === h)) return null; if(W.some(w => w.at === 1)) return h >= 2 ? H.plus2 : null; return H.boost[h] || null; }
const waryCache = {};
function waryFoe(key, lv){
  if(!(lv > 0)) return D.foes[key];
  const t = waryTier(key, lv) || {at:lv};
  const id = key + '!' + lv; if(waryCache[id]) return waryCache[id];
  const f = Object.assign({}, D.foes[key]);
  // 0.44.1: 「++」(at:2)は「+」(at:1)を重ねた姿の上に重ねる(工房でも + を基準に編集する)
  const W = D.foes[key].wary || [], p1 = (t.at || 1) >= 2 ? W.find(w => (w.at || 1) === 1) : null;
  for(const [k, v] of (p1 && p1 !== t ? [p1, t] : [t]).flatMap(x => Object.entries(x))){
    if(k === 'at') continue;
    // 0.38.0: 書いた欄は丸ごと置き換える(工房で警戒版を全体の姿で編集し、変わった欄を丸ごと書くため。パッシブも一覧ごと)。patAdd だけは足す(古い書き方)
    if(k === 'patAdd') f.pat = f.pat.concat(v);
    else if(k === 'pat'){ const P = f.pat; f.pat = v.map((a, i) => a.n || !P[i] ? a : Object.assign({n:P[i].n}, a)); } // 名前が無ければ通常の同じ番号の行動の名前
    else f[k] = v;
  }
  delete f.wary; f.waryAt = lv;
  f.name = (D.foes[key].name || '') + '+'.repeat(lv); /* 警戒+1 なら「+」、+2 なら「++」 */
  return waryCache[id] = f;
}
function scaledFoe(key, sc, lv){
  const src = waryFoe(key, lv), wk = src.waryAt ? key + '!' + src.waryAt : key; // 警戒の段ごとに別の形
  if(!sc || (sc.hp === 1 && sc.d === 1)) return src;
  const id = wk + '@' + sc.hp + '/' + sc.d; if(scaledCache[id]) return scaledCache[id];
  // s はガードの量のときだけ(ユニットの絵の大きさの s は変えない)
  const H = ['hp', 'heal', 'rebuild'], DK = ['d', 'armor', 'poise', 'prime'];
  const walk = (o, pk) => { if(Array.isArray(o)) return o.map(x => walk(x, pk)); if(!o || typeof o !== 'object') return o; const r = {};
    for(const [k, v] of Object.entries(o)){
      if(typeof v === 'number' && v > 0 && H.includes(k)) r[k] = Math.round(v * sc.hp);
      else if(typeof v === 'number' && v > 0 && (DK.includes(k) || (k === 's' && pk === 'guard'))) r[k] = Math.max(1, Math.round(v * sc.d));
      else r[k] = walk(v, k);
    } return r; };
  // 行動の文(n)・パッシブ(k の n は数)は変えない
  const f = walk(src, ''); if(src.passives) f.passives = src.passives;
  return scaledCache[id] = f;
}
function makeFoe(key, i, sc, lv){
  const f = scaledFoe(key, sc, lv);
  const e = {key, i, wary:f.waryAt || 0, name:f.name, tag:'ABCDEF'[i], kind:f.kind, pat:null, idx:0, r:f.start, seq:0, alive:true,
    react:f.react || null, sync:f.sync || 0, reactIn:null, ai:f.ai || null, phase:f.phase || null, phased:false, hist:[], chain:0, sh:0, str:0, haste:0, pas:f.passives || []};
  // ユニット。書かなければ耐久 hp の核1つ
  const defs = f.units || {core:{hp:f.hp, vital:true, core:true}};
  e.uids = Object.keys(defs); e.units = {};
  for(const k of e.uids){ const d = defs[k]; e.units[k] = {name:d.name || '', hp:d.hp, max:d.hp, vital:!!d.vital, core:!!d.core, icon:d.icon || k, crack:0, vuln:0, armor:d.armor || 0, broken:false, shelter:!!d.shelter}; }
  syncHp(e);
  setPat(e, f); // 0.45.3: 開幕があれば、その頭から
  if(e.ai === 'rand') resetQueue(e);
  const a = cur(e); e.sh = a.guard ? a.guard.s : 0;
  return e;
}
const econ = () => RULE.econ || {type:'trickle'};
// 区切り: 手札を捨て(排莢)、ブロックを消す。引くのは呼ぶ側
function boundary(st, when){
  const b = st.b, ec = econ(), ev = {kind:'boundary', n:b.hand.length};
  const ej = (ec.eject || 0) * b.hand.filter(c => !isJunk(c)).length;
  // キャッシュ(0.39.0、econ.cache): 区切りまでに使ったカードは、区切りで手札より先に捨て札へ移る
  if(ec.cache && b.cache && (when === 'start' || when === 'turn')){ b.disc.push(...b.cache); b.cache = []; }
  // 汚染(0.41.3): 消えるもの(fade)は消え、dump があれば本体にダメージ
  for(const c of b.hand){ const cd = D.cards[c.k] || {}; if(cd.fade && cd.dump){ st.run.body -= cd.dump; ev.dump = (ev.dump || 0) + cd.dump; } }
  if((when === 'start' && !ec.keep) || when === 'turn'){ for(const c of b.hand) if(!fades(c)) b.disc.push(c); b.hand = []; }
  else if(when === 'start'){ b.hand = b.hand.filter(c => !fades(c)); } // keep: 手札を残し、足りない分だけ引く(ノイズは消える)
  if(ec.blockReset && (ec.blockReset === when || when === 'turn')) b.block = 0; // 再装填で true/'end' のときは終わりに消す(endAction)
  if(ej) gainBlock(b, ej);
  ev.eject = ej;
  return ev;
}
// 属性付きのカード(「元@属性」)を D.cards に登録する。登録できない(属性が無くなった)ものはデッキから外す
function regDeck(run){ if(!D.regAttrCard) return; run.deck = run.deck.filter(k => D.regAttrCard(D.cards, k)); }
function newBattle(run, encKey){
  regDeck(run);
  const E = D.encounters[encKey];
  const st = {run, b:null};
  const parts = {};
  for(const s of D.slots){ const mx = partMax(run, s.id); parts[s.id] = {cur: run.parts[s.id].damaged ? Math.ceil(mx / 2) : mx, max:mx}; }
  const foes = [], A = D.areas[run.area || 0], es = E.scale || {hp:1, d:1};
  // 敵の強さ = エリアの倍率 × 遭遇の倍率。警戒が+1・+2なら「+」「++」の形で出る(作られていなければ仮の上乗せ。heatBoost)
  const h = heatLevel(run);
  if(!E.boss && !E.elite) run.lastEnc = encKey;
  for(const key of E.foes){ const bo = heatBoost(key, h) || {hp:0, d:0};
    const sc = A ? {hp:+(A.scale.hp * es.hp * (1 + bo.hp)).toFixed(3), d:+(A.scale.d * es.d * (1 + bo.d)).toFixed(3)} : null;
    foes.push(makeFoe(key, foes.length, sc, h)); }
  let uid = 1;
  const cards = shuffle(battleDeck(run).map(k => ({k, id:uid++})));
  const b = {enc:encKey, T:0, block:0, swift:0, foes, parts, draw:cards, disc:[], cache:[], hand:[], cast:null, broken:{}, over:false, timers:[], zones:[], drawIn:RULE.draw, handMax:RULE.handMax, uid:1000, parryNow:false, charge:0, exile:[], wards:[], grow:{}, choose:null};
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
  // 手札を選ぶ間(0.30.0): 選ぶ行動だけ
  if(b.choose) return b.hand.map((cd, i) => ({type:'choose', i, k:cd.k}));
  b.hand.forEach((cd, i) => {
    const c = D.cards[cd.k];
    if(spendShort(b, c) || needShort(b, c)) return;
    // ユニットが2つ以上ある敵は、ユニットごとに狙いを分ける
    const ts = c.tgt ? b.foes.filter(e => e.alive).flatMap(e => liveUids(e).length > 1 ? liveUids(e).filter(k => !dotShort(b, c, e, k)).map(k => e.i + '.' + k) : [e.i]) : [null];
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
function actionCost(st, a){ return a.type === 'choose' ? 0 : a.type === 'card' ? (st.b.hand[a.i] ? costOf(st.b.hand[a.i]) : D.cards[a.k].cost) : a.type === 'swap' ? st.b.hand.length : a.type === 'reload' ? reloadCost(st) : a.type === 'pass' ? Math.max(1, st.b.turnIn) : 1; }
// 行動を1つ、手札の出し入れまで含めて準備する。spendGen の前に呼ぶ
// 追跡(passive pursuit): 入れ替え・待機・再装填のたび、敵の次の行動が早まる
function pursue(st){
  const out = [];
  for(const e of st.b.foes){ const n = pasN(e, 'pursuit'); if(!n || !e.alive || e.chain > 0 || e.r <= 1) continue; const v = Math.min(n, e.r - 1); e.r -= v; out.push({e:e.i, n:v}); }
  return out;
}
function beginAction(st, a){
  const b = st.b;
  if(a.type === 'choose') return beginAction0(st, a);
  if(a.type !== 'card'){ const pu = pursue(st); const p = beginAction0(st, a); if(pu.length) p.pursuit = pu; return p; }
  return beginAction0(st, a);
}
function beginAction0(st, a){
  const b = st.b;
  if(a.type === 'card'){
    const cd = b.hand.splice(a.i, 1)[0], c = D.cards[cd.k], p = {card:cd, cost:costOf(cd), k:cd.k, t:a.t, n:0};
    // インスタント(0.35.0): 使い始めたときに手札を選んで捨てる。a.pick は捨てるカードの id(無ければ前から)
    if(c.instant && c.discard){
      const n = Math.min(c.discard, b.hand.length), ids = (a.pick || []).filter(id => b.hand.some(h => h.id === id)).slice(0, n);
      for(const h of b.hand) if(ids.length < n && !ids.includes(h.id)) ids.push(h.id);
      p.discarded = ids.map(id => b.hand.find(h => h.id === id)); b.hand = b.hand.filter(h => !ids.includes(h.id)); (c.discardExile ? (b.exile = b.exile || []) : b.disc).push(...p.discarded);
    }
    // 条件つきアトミック(0.40.0): 充電が足りていれば、その分を消費してアトミックになる
    if(c.condAtomic && b.charge >= c.condAtomic){ b.charge -= c.condAtomic; b.atomicNow = true; }
    return p;
  }
  // 手札を選ぶ(0.30.0): 時間は使わない。discard は捨て札へ、exile は廃棄へ
  if(a.type === 'choose'){
    const ch = b.choose, shift = ch && ch.kind === 'shift', cd = shift ? b.hand[a.i] : b.hand.splice(a.i, 1)[0];
    if(shift){ if(cd) cd.dc = (cd.dc || 0) + ch.d; }
    else if(cd){ (ch && ch.kind === 'exile' ? (b.exile = b.exile || []) : b.disc).push(cd); }
    if(ch){ ch.n--; if(ch.n <= 0 || !b.hand.length) b.choose = null; }
    return {card:null, cost:0, k:null, t:null, n:0, chose:cd || null};
  }
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
  // ノイズは使うと消える。廃棄(0.30.0、exile)のカードはこの戦闘の間、廃棄に置く(山札にも捨て札にも戻らない)
  // キャッシュを持つキャラ(0.39.0)は、使ったカードを捨て札ではなくキャッシュに置く(次の区切りで捨て札へ)
  if(p.card && p.card.was) p.card = p.card.was; // 破片(0.41.3): 使うと元のカードに戻る
  if(p.card && !isJunk(p.card)){ if(D.cards[p.card.k] && D.cards[p.card.k].exile) (b.exile = b.exile || []).push(p.card); else (econ().cache ? (b.cache = b.cache || []) : b.disc).push(p.card); }
  // 手札を選ぶカードは、使い終えたら選ぶ番(手札が無ければ何もしない)
  if(b.chooseNext){ const ch = b.chooseNext; b.chooseNext = null; if(!out.dead && !out.won && b.hand.length) b.choose = {kind:ch.kind, n:Math.min(ch.n, b.hand.length), d:ch.d}; }
  if(p.reload && !out.dead && !out.won){ const ec = econ(); if(ec.blockReset === 'end' || ec.blockReset === true) b.block = 0; }
  if(p.mag && !out.dead && !out.won){ while(b.mag.length && b.hand.length < b.handMax) b.hand.push(b.mag.shift()); }
  if((p.n || (p.reload && b.refDraw)) && !out.dead && !out.won) drawN(b, p.n + (p.reload ? (b.refDraw || 0) : 0)); // 解放: リフレッシュ時に追加で引く
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
  const run = {seed, area:0, heat:0, lastEnc:null, body:D.bodyMax, bodyMax:D.bodyMax, parts, deck:D.startDeck.slice(), scrap:D.rewards.scrapStart, at:null, visited:[], map:null};
  run.map = genMap(seed, 0);
  return run;
}
/* 警戒(0.44.0 で作り直し): 相対値。ゲージ run.heat(−10〜+10)を5段(−2〜+2)で見せる。DATA.heat
   区画を終えるたびに、種類ごとの量(gain)を足し、一定量(cool)冷める。行き過ぎないよう、わずかに0へ寄せる(decay)
   エリアの移り目で carry 倍(半分)。エリアが進むと強くなる役は、エリアごとの敵と、エリアの中の深さで決まる敵の組(pools の from)が持つ */
const HT = () => D.heat || {gain:{}, cool:0, decay:0, min:-10, max:10, th:[2, 5], carry:0.5, scrap:{}, cards:{}, boost:{}, plus2:{hp:0, d:0}};
function heatLevel(run){ const g = run.heat || 0, t = HT().th; return g <= -t[1] ? -2 : g <= -t[0] ? -1 : g < t[0] ? 0 : g < t[1] ? 1 : 2; }
const heatClamp = g => Math.max(HT().min, Math.min(HT().max, g));
// イベントなどで増減(戻り値は段の変化)
function addHeat(run, n){ const b = heatLevel(run); run.heat = heatClamp((run.heat || 0) + n); return heatLevel(run) - b; }
// 区画を終えたとき(戻り値は段の変化)
function roomHeat(run, type){ const H = HT(), b = heatLevel(run); run.heat = heatClamp((run.heat || 0) + ((H.gain || {})[type] || 0) - (H.cool || 0)) * (1 - (H.decay || 0)); return heatLevel(run) - b; }
// 区画の種類ごとの増減の目安(地図の表示用): 足す量 − 冷める量
const heatDelta = type => ((HT().gain || {})[type] || 0) - (HT().cool || 0);
// 段ごとの報酬: スクラップの倍率 / 学習の候補 {n, r}(r: low コモンが出やすい / high アンコモンが出やすい)
const heatScrap = run => 1 + ((HT().scrap || {})[heatLevel(run)] || 0);
const heatCards = run => (HT().cards || {})[heatLevel(run)] || {n:3};
// 通常戦の敵(0.44.0): エリアの pools から、区画の深さ(列の番号 idx)で入る組(from が idx 以下でいちばん後の組)を使う
// 直前と同じ遭遇は避ける。区画ごとに決まった乱数で選ぶ(つづきからでも同じ)
function poolIndex(run, area, idx){ const P = D.areas[area == null ? (run.area || 0) : area].pools; let i = 0; P.forEach((p, j) => { if((p.from || 0) <= (idx || 0)) i = j; }); return i; }
function encFor(run, node){
  if(node.enc) return node.enc;
  const A = D.areas[run.area || 0], bi = poolIndex(run, null, node.idx);
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
  run.area += 1; run.at = null; run.visited = [];
  run.heat = (run.heat || 0) * (HT().carry == null ? 0.5 : HT().carry); /* 0.44.0: 警戒はエリアの移り目で半分に */
  run.map = genMap(run.seed + run.area * 7919, run.area); /* 0.41.0〜0.43.1 はこの行が注釈に呑まれていて、エリアが変わっても地図が作り直されていなかった */
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
        (n => n >= Math.round(mid / 3) && n <= Math.round(mid * 2 / 3))(row.slice(1, -1).filter(t => t === 'battle').length)) &&
      Array.from({length: mid}, (_, i) => rows.map(row => row[i + 1])).every(col => SPECIAL.every(t => col.filter(x => x === t).length <= 2));
    if(!ok) continue;
    const elites = shuffle(Object.entries(D.encounters).filter(([, e]) => e.elite && !e.draft).map(([k]) => k), r); // 0.41.3: draft(工房で相談中の案)は出さない
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
  newRun, nextArea, delayFoe, addDot, tickDots, growOf, waryTier, lootBack, fledAll, pasN, attrOf, costOf, baseKey, spendShort, dotShort, needShort, foeStr, moveBonus, regDeck, genMap, nextNodes, reachAfter, scaledFoe, heatLevel, addHeat, roomHeat, heatDelta, heatScrap, heatCards, heatBoost, encFor, poolIndex};
root.ENGINE = API;
if(typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
