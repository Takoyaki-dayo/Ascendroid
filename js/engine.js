// Ascendroid のルール(画面を持たない)。index.html と、自動対戦のシミュレータの両方から使う
// 時間の単位はサイクル。手札は RULE.draw サイクルごとに1枚届く
(function(root){
'use strict';
const D = root.DATA;
// freeWait: 手札があっても1サイクル待てる(0.7 から既定で待てる。メニューで切り替え)
const RULE = {draw:3, handStart:5, handMax:7, view:18, freeWait:true};

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
function pickMove(e){
  const h = e.hist || [], n = h.length, ok = e.pat.map((m, i) => !(n >= 2 && h[n - 1] === i && h[n - 2] === i));
  let tot = 0; e.pat.forEach((m, i) => { if(ok[i]) tot += m.wt || 1; });
  let x = rand() * tot;
  for(let i = 0; i < e.pat.length; i++){ if(!ok[i]) continue; x -= e.pat[i].wt || 1; if(x <= 0) return i; }
  return e.pat.length - 1;
}
function advance(e){
  if(e.hist){ e.hist.push(e.idx); if(e.hist.length > 4) e.hist.shift(); }
  if(e.phase && !e.phased && e.hp < e.maxHp * e.phase.at){ e.phased = true; e.pat = e.phase.pat; e.idx = 0; e.hist = []; }
  else if(e.ai === 'rand') e.idx = pickMove(e);
  else e.idx = (e.idx + 1) % e.pat.length;
  const a = e.pat[e.idx];
  e.r = a.dl; e.seq++; e.chain = 0; e.sh = a.guard ? a.guard.s : 0;
}
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
  if(dd.t === 'phys'){ n += fx(st, 'out', 'phys'); if(c.cost <= 2) n += fx(st, 'out', 'quickPhys'); if(c.cost >= 4) n += fx(st, 'out', 'heavyPhys'); }
  else n += fx(st, 'arm', 'opt');
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
    if(e.ai === 'rand') break; // 分岐する敵は、次の行動が決まるまで見えない
    idx = (idx + 1) % e.pat.length; t += e.pat[idx].dl; k++;
  }
  return out;
}
// 次に手札が届くサイクル(今から何サイクル後か)の一覧
function arrivals(b, view){ const out = []; for(let t = b.drawIn; t <= (view || RULE.view); t += RULE.draw) out.push(t); return out; }

/* ---------- 効果 ---------- */
function hurtFoe(b, e, d, ev){
  e.hp -= d; ev.push({kind:'dmg', e:e.i, n:d});
  if(e.hp <= 0){ e.hp = 0; e.alive = false; e.reactIn = null; ev.push({kind:'kill', e:e.i}); }
}
// カードや時限の一撃。隙なら1.5倍、ガード中は防がれ、反撃の構えなら撃ち返され、構え中に poise 以上なら行動が潰れる
function hitFoe(st, e, n, ev){
  const b = st.b, a = cur(e);
  let d = n;
  if(e.vuln > 0){ d = Math.round(d * 1.5); b.vulnHits = (b.vulnHits || 0) + 1; ev.push({kind:'vulnHit', e:e.i}); }
  if(inWin(e, a.guard) && e.sh > 0){ const ab = Math.min(e.sh, d); e.sh -= ab; d -= ab; b.guarded = (b.guarded || 0) + ab; ev.push({kind:'guarded', e:e.i, n:ab}); }
  if(inWin(e, a.counter)){ const res = strike(st, e, {n:a.n, d:a.counter.d, p:a.p || 'dur'}, 0, true); b.countered = (b.countered || 0) + 1; ev.push({kind:'counter', e:e.i, res}); }
  if(d > 0) hurtFoe(b, e, d, ev);
  if(e.alive && inWin(e, a.wind) && n >= a.wind.poise){ const nm = a.n; advance(e); b.breaks = (b.breaks || 0) + 1; ev.push({kind:'break', e:e.i, name:nm}); }
}
function applyCard(st, k, ti){
  const c = D.cards[k], b = st.b, ev = [];
  const targets = c.all ? b.foes.filter(e => e.alive) : (c.tgt ? [b.foes[ti]].filter(e => e && e.alive) : []);
  if(c.dmg){
    const n = dmgOf(st, c);
    for(const e of targets) for(let h = 0; h < (c.dmg.x || 1); h++){ if(!e.alive) break; hitFoe(st, e, n + e.crack, ev); }
  }
  if(c.crack) for(const e of targets) if(e.alive){ e.crack += c.crack; ev.push({kind:'crack', e:e.i, n:c.crack}); }
  if(c.delay) for(const e of targets) if(e.alive){ e.r += c.delay; ev.push({kind:'delay', e:e.i, n:c.delay}); }
  if(c.block){ const n = blockOf(st, c); b.block += n; ev.push({kind:'block', n}); }
  if(c.swift){ b.swift += c.swift; ev.push({kind:'swift', n:c.swift}); }
  if(c.timer && targets[0]){ b.timers.push({id:b.uid++, left:c.timer.t, k, e:targets[0].i}); ev.push({kind:'timerSet', e:targets[0].i, t:c.timer.t}); }
  if(c.draw){ const n = drawN(b, c.draw); if(c.borrow) b.drawIn += c.draw * RULE.draw; ev.push({kind:'draw', n, borrow: !!c.borrow}); }
  if(c.cost === 0){ const s = fx(st, 'mob', 'zeroSwift'); if(s){ b.swift += s; ev.push({kind:'swift', n:s}); } }
  return ev;
}
function fireTimer(st, t){
  const b = st.b, c = D.cards[t.k], ev = [];
  let e = b.foes[t.e];
  if(!e || !e.alive) e = b.foes.find(f => f.alive);
  if(e) hitFoe(st, e, dmgOf(st, c, c.timer.dmg) + e.crack, ev);
  return ev;
}
// 敵の攻撃1回。extra は連携の上乗せ
function strike(st, e, a, extra, noParry){
  const b = st.b, raw = a.d + (extra || 0);
  if(b.parryNow && !noParry){ const ev = []; hurtFoe(b, e, raw, ev); return {kind:'parried', name:a.n, raw, ev}; }
  const ab = Math.min(b.block, raw); b.block -= ab;
  const rem = raw - ab, p = b.parts[a.p];
  let partLoss = 0, bodyLoss = 0, broke = false;
  if(rem > 0){
    if(p.cur > 0){ partLoss = Math.min(p.cur, rem); p.cur -= partLoss; if(p.cur === 0){ broke = true; b.broken[a.p] = true; } bodyLoss = rem - partLoss; }
    else bodyLoss = rem;
    st.run.body = Math.max(0, st.run.body - bodyLoss);
  }
  return {kind:'hit', name:a.n, part:a.p, raw, extra:extra || 0, blocked:ab, partLoss, bodyLoss, broke, hurt:rem > 0};
}
function enemyAct(st, e, extra){
  const a = cur(e);
  const res = a.kind === 'delay' ? {kind:'delay', name:a.n, v:a.v} : a.d > 0 ? strike(st, e, a, (extra || 0) + (e.str || 0)) : {kind:'move', name:a.n};
  // 多段: 残りを1サイクルおきに撃つ
  if(a.hits > 1 && !e.chain){ e.chain = a.hits - 1; e.r = 1; e.sh = 0; res.chainLeft = e.chain; return res; }
  if(e.chain > 0){ e.chain--; if(e.chain > 0){ e.r = 1; res.chainLeft = e.chain; return res; } }
  res.chainLeft = 0;
  if(a.rec) e.vuln = a.rec + 1;
  if(a.buff){ for(const f of (a.all ? st.b.foes.filter(f => f.alive) : [e])) f.str = (f.str || 0) + a.buff; res.buff = a.buff; }
  advance(e);
  return res;
}

/* ---------- 時間を進める ----------
   カード(k あり)、入れ替え・待機(k なし)のどれも、cost サイクルぶん時間を進める。
   1サイクルごとにイベントを返すので、画面はそれを見て演出し、プレビューは最後まで回して結果だけを見る */
function* spendGen(st, cost, k, ti, noInt){
  const b = st.b, c = k ? D.cards[k] : null, atomic = !c || !!c.atomic;
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
    if(b.swift > 0){ b.swift--; real = false; }
    left--; b.cast.left = left;
    if(real){
      b.T++; out.elapsed++; b.drawIn--;
      for(const e of b.foes) if(e.alive){ e.r--; if(e.reactIn != null) e.reactIn--; if(e.vuln > 0) e.vuln--; }
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
      // 手札が届く
      if(b.drawIn <= 0){ b.drawIn = RULE.draw; const r = drawOne(b); yield {type:'arrive', r}; }
    }
    if(left === 0){
      out.completeAt = out.elapsed;
      if(c){
        if(real) for(const e of b.foes){
          if(e.alive && e.r <= 0 && cur(e).ch && !e.chain){
            const nm = cur(e).n; advance(e);
            const cr = fx(st, 'calc', 'justCrack'); e.crack += cr;
            const sw = fx(st, 'calc', 'justSwift'); b.swift += sw;
            out.justs.push({i:e.i, name:nm}); yield {type:'just', e:e.i, crack:cr, swift:sw};
          }
        }
        if(c.parry && real) b.parryNow = true;
        const ev = applyCard(st, k, ti);
        b.cast = null;
        yield {type:'card', ev};
        if(st.run.body <= 0){ out.dead = true; b.parryNow = false; return out; }
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
        if(kind === 'react') res = Object.assign(strike(st, e, e.react, 0), {react:true});
        else res = enemyAct(st, e, e.sync && syncN >= 2 ? e.sync : 0);
        if(res.kind === 'delay' && b.cast){
          left += res.v; b.cast.left = left; res.applied = true;
          const s = fx(st, 'mob', 'delayedSwift'); if(s){ b.swift += s; res.swift = s; }
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
function newBattle(run, encKey){
  const E = D.encounters[encKey];
  const st = {run, b:null};
  const parts = {};
  for(const s of D.slots){ const mx = partMax(run, s.id); parts[s.id] = {cur: run.parts[s.id].damaged ? Math.ceil(mx / 2) : mx, max:mx}; }
  const foes = E.foes.map((key, i) => {
    const f = D.foes[key];
    return {key, i, name:f.name, tag:'ABC'[i], kind:f.kind, hp:f.hp, maxHp:f.hp, pat:f.pat, idx:0, r:f.start, seq:0, alive:true, crack:0,
      react:f.react || null, sync:f.sync || 0, reactIn:null, ai:f.ai || null, phase:f.phase || null, phased:false, hist:[], chain:0, sh:0, vuln:0, str:0};
  });
  for(const e of foes){ if(e.ai === 'rand') e.idx = pickMove(e); const a = cur(e); e.sh = a.guard ? a.guard.s : 0; }
  let uid = 1;
  const cards = shuffle(battleDeck(run).map(k => ({k, id:uid++})));
  const b = {enc:encKey, T:0, block:0, swift:0, foes, parts, draw:cards, disc:[], hand:[], cast:null, broken:{}, over:false, timers:[], drawIn:RULE.draw, handMax:RULE.handMax, uid:1000, parryNow:false};
  st.b = b;
  b.handMax += fx(st, 'calc', 'handMax');
  b.block += fx(st, 'dur', 'startBlock');
  b.swift += fx(st, 'mob', 'startSwift');
  drawN(b, RULE.handStart + fx(st, 'mob', 'startHand'));
  return st;
}
// 今できる行動: カード(対象ごと)、入れ替え(手札があるとき)、待機(手札がないとき)
function actions(st){
  const b = st.b, out = [], seen = new Set();
  b.hand.forEach((cd, i) => {
    const c = D.cards[cd.k];
    const ts = c.tgt ? b.foes.filter(e => e.alive).map(e => e.i) : [null];
    for(const t of ts){ const key = cd.k + '|' + t; if(seen.has(key)) continue; seen.add(key); out.push({type:'card', i, k:cd.k, t}); }
  });
  if(b.hand.length) out.push({type:'swap'});
  if(!b.hand.length || RULE.freeWait) out.push({type:'wait'});
  return out;
}
function actionCost(st, a){ return a.type === 'card' ? D.cards[a.k].cost : a.type === 'swap' ? st.b.hand.length : 1; }
// 行動を1つ、手札の出し入れまで含めて準備する。spendGen の前に呼ぶ
function beginAction(st, a){
  const b = st.b;
  if(a.type === 'card'){ const cd = b.hand.splice(a.i, 1)[0]; return {card:cd, cost:D.cards[cd.k].cost, k:cd.k, t:a.t, n:0}; }
  if(a.type === 'swap'){ const n = b.hand.length; b.disc.push(...b.hand); b.hand = []; return {card:null, cost:n, k:null, t:null, n}; }
  return {card:null, cost:1, k:null, t:null, n:0};
}
function endAction(st, p, out){
  const b = st.b;
  if(p.card) b.disc.push(p.card);
  if(p.n && !out.dead && !out.won) drawN(b, p.n);
}
// まとめて実行(シミュレータ用)
function doAction(st, a, noInt){
  const p = beginAction(st, a);
  const out = runGen(spendGen(st, p.cost, p.k, p.t, noInt));
  endAction(st, p, out);
  return out;
}

/* ---------- ラン ---------- */
function newRun(seed){
  const parts = {};
  for(const s of D.slots) parts[s.id] = {id:D.startParts[s.id], damaged:false};
  const run = {seed, body:D.bodyMax, bodyMax:D.bodyMax, parts, deck:D.startDeck.slice(), scrap:D.rewards.scrapStart, at:null, visited:[], map:null};
  run.map = genMap(seed);
  return run;
}

/* ---------- 地図の生成 ---------- */
const SPECIAL = ['elite', 'rest', 'shop'];
function genLane(key, r){
  const L = D.lanes[key], pool = [];
  for(const [t, n] of Object.entries(L.rooms)) for(let i = 0; i < n; i++) pool.push(t);
  pool.splice(pool.indexOf('battle'), 1);
  for(let tries = 0; tries < 60; tries++){
    const rooms = ['battle', ...shuffle(pool.slice(), r)];
    const eliteOk = rooms.every((t, i) => t !== 'elite' || i >= 2);
    const noRepeat = rooms.every((t, i) => i === 0 || !SPECIAL.includes(t) || rooms[i - 1] !== t);
    if(eliteOk && noRepeat) return rooms;
  }
  return null;
}
function reachAfter(lane, n){ return [lane - 1, lane, lane + 1].filter(l => l >= 0 && l < n); }
function genMap(seed){
  const r = rngFrom(seed), keys = Object.keys(D.lanes), T = D.area.transferAfter;
  for(let tries = 0; tries < 300; tries++){
    const lanes = shuffle(keys.slice(), r).slice(0, 3);
    const rooms = lanes.map(k => genLane(k, r));
    if(rooms.some(x => !x)) continue;
    // どの道から乗り換えても、その後に整備かショップがある
    const ok = lanes.every((_, l) => reachAfter(l, lanes.length).some(l2 => rooms[l2].slice(T).some(t => t === 'rest' || t === 'shop')));
    if(!ok) continue;
    const encs = Object.entries(D.encounters);
    const norm1 = encs.filter(([, e]) => !e.elite && !e.boss && e.tier === 1).map(([k]) => k);
    const norm2 = encs.filter(([, e]) => !e.elite && !e.boss).map(([k]) => k);
    const elites = shuffle(encs.filter(([, e]) => e.elite).map(([k]) => k), r);
    const nodes = rooms.map((row, l) => {
      let prev = null;
      return row.map((t, i) => {
        const n = {lane:l, idx:i, type:t};
        if(t === 'battle'){ const pool = (i < T ? norm1 : norm2).filter(k => k !== prev); n.enc = pick(pool, r); prev = n.enc; }
        if(t === 'elite') n.enc = elites.pop();
        if(t === 'event') n.ev = pick(D.events, r).id;
        return n;
      });
    });
    return {seed, lanes, nodes, boss:{type:'boss', enc:Object.keys(D.encounters).find(k => D.encounters[k].boss)}};
  }
  throw new Error('map generation failed');
}
// 今いる場所から進める部屋
function nextNodes(run){
  const m = run.map, at = run.at, T = D.area.transferAfter, last = D.area.rooms - 1;
  if(!at) return m.nodes.map(row => row[0]);
  if(at.boss) return [];
  if(at.idx === last) return [m.boss];
  if(at.idx === T - 1) return reachAfter(at.lane, m.nodes.length).map(l => m.nodes[l][at.idx + 1]);
  return [m.nodes[at.lane][at.idx + 1]];
}

const API = {RULE, rngFrom, setRandom, shuffle, pick, clone, cur, advance, partOf, fx, partCards, battleDeck, partMax, dmgOf, blockOf,
  drawOne, drawN, upcoming, arrivals, applyCard, enemyAct, spendGen, runGen, newBattle, actions, actionCost, beginAction, endAction, doAction,
  newRun, genMap, nextNodes, reachAfter};
root.ENGINE = API;
if(typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
