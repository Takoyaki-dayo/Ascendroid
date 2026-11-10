/* 方向性の見本(案A・案B)で共有する仮の仕組み。本体の js/engine.js ではない。
   規則は本体に似せてあるが、見本を動かすための小さな写しで、数値や順番の正しさは保証しない。
   カード・敵の名前と文は text/*.csv の文をそのまま使っている。 */
(function(){
'use strict';
const clone = o => JSON.parse(JSON.stringify(o));
const SLOTS = [{id:'calc', name:'演算'}, {id:'arm', name:'武装'}, {id:'out', name:'出力'}, {id:'dur', name:'耐久'}, {id:'mob', name:'機動'}];
const SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]));

// text/keywords.csv から、見本に出てくるものだけ
const KW = [
  ['ブロック', '受けるダメージを数値分軽減し、軽減した分減少する。'],
  ['ディレイ', '敵のタイムラインを数値分遅らせる。敵は抵抗1を得る。'],
  ['クラック', '受けるダメージが数値分増加する。'],
  ['アトミック', '発動前に攻撃を受けてもブレイクされない。'],
  ['JUST', '敵の行動発動と同時にカードを発動すること。'],
  ['ブレイク', '行動が止まること。止まった行動は飛ばされ、次の行動に進む。'],
  ['不安定', 'この行動と同じサイクルにカードでダメージを与えると、ブレイクする。'],
  ['体勢', 'このサイクルの間、一度に一定値以上のダメージを受けると、ブレイクする。'],
  ['防壁', 'このサイクルの間、合計で一定値までのダメージを防ぐ。カードで得るときは「サイクル数/量」で書く。'],
  ['隙', '受けるダメージが1.5倍になる。'],
  ['虚弱', '攻撃で与えるダメージが数値分減少する。'],
];

// カード(K-7 の数値に、最初のパーツの補正を足した値)。kind は絵と音の種類
const CARDS = {
  jab:      {name:'打撃', cost:1, tgt:true, dmg:{t:'melee', n:4}, text:'4ダメージを与える。', rar:'starter', kind:'melee'},
  jabS:     {name:'打撃', attr:'強力な', cost:1, tgt:true, dmg:{t:'melee', n:5}, text:'5ダメージを与える。', rar:'common', kind:'melee'},
  guard:    {name:'障壁展開', cost:1, block:5, text:'5ブロックを得る。', rar:'starter', kind:'block'},
  hack:     {name:'妨害回路', cost:1, tgt:true, delay:3, text:'ディレイ3を与える。', rar:'uncommon', kind:'delay'},
  rapid:    {name:'二連撃', cost:2, tgt:true, dmg:{t:'melee', n:5, x:2}, text:'5ダメージを2回与える。', rar:'common', kind:'melee'},
  crackshot:{name:'亀裂弾', cost:2, tgt:true, dmg:{t:'ranged', n:4}, crack:1, text:'4ダメージを与える。クラック1を与える。', rar:'common', kind:'ranged'},
  parry:    {name:'受け流し', cost:2, block:3, parry:true, text:'3ブロックを得る。JUST：攻撃をブレイクし、威力の半分だけダメージを与える。', rar:'rare', kind:'block'},
  careful:  {name:'慎重な一撃', cost:2, tgt:true, dmg:{t:'melee', n:8}, block:6, text:'8ダメージを与える。6ブロックを得る。', rar:'common', kind:'melee'},
  slash:    {name:'スラッシュ', cost:3, tgt:true, dmg:{t:'melee', n:16}, text:'16ダメージを与える。', rar:'starter', kind:'melee'},
  charge:   {name:'電磁投射', cost:4, tgt:true, atomic:true, dmg:{t:'ranged', n:17}, text:'アトミック。17ダメージを与える。', rar:'common', kind:'ranged'},
  foresight:{name:'見切り', cost:3, tgt:true, text:'〈JUST〉敵の行動をブレイク。虚弱1を付与する。', rar:'uncommon', kind:'delay'},
  blow:     {name:'過負荷', cost:6, tgt:true, dmg:{t:'ranged', n:41}, text:'41ダメージを与える。', rar:'rare', kind:'ranged'},
};
const RAR = {starter:'初期', common:'コモン', uncommon:'アンコモン', rare:'レア'};
const mainNum = c => c.dmg ? {v:c.dmg.n + (c.dmg.x > 1 ? '×' + c.dmg.x : ''), t:c.dmg.t} : c.block ? {v:c.block, t:'block'} : c.delay ? {v:c.delay, t:'delay'} : null;

// 敵: 多脚戦車型突破機構(data/enemies.js の tank。耐久は戦闘の途中の値にしてある)
const PAT = [
  {n:'掃射', by:'mg', d:3, hits:3, dl:4, p:'calc'},
  {n:'踏みつけ', by:'legs', d:10, dl:5, p:'mob', guard:{w:3, s:10}},
  {n:'掃射', by:'mg', d:3, hits:3, dl:4, p:'out'},
  {n:'徹甲砲', by:'gun', d:24, dl:6, p:'dur', ch:true, wind:{w:4, poise:14}, rec:3, crack:1},
  {n:'装甲展開', by:'core', d:0, dl:4, armor:6},
];
const PHASE = [{n:'装甲展開', by:'core', d:0, dl:4, armor:6}, {n:'突撃', by:'core', d:10, dl:3, p:'dur', ch:true}];

function newState(){
  let id = 1; const mk = k => ({k, id:id++});
  const unit = (name, hp, max, o) => Object.assign({name, hp, max, armor:0, crack:0, vuln:0, broken:false}, o || {});
  return {T:0, over:null, target:'core',
    me:{hp:38, max:50, block:0, crack:0,
      parts:{calc:{cur:3, max:5}, arm:{cur:6, max:6}, out:{cur:4, max:7}, dur:{cur:9, max:9}, mob:{cur:6, max:6}}},
    hand:['jabS', 'guard', 'parry', 'slash', 'charge'].map(mk),
    draw:['jab', 'guard', 'careful', 'jab', 'crackshot', 'guard', 'rapid', 'hack', 'jab'].map(mk), disc:[], cache:[],
    foe:{name:'多脚戦車型突破機構', alive:true, uids:['core', 'gun', 'mg', 'legs'],
      units:{core:unit('車体', 41, 96, {vital:true, core:true, armor:4}), gun:unit('主砲', 30, 48), mg:unit('機銃', 9, 29), legs:unit('脚部', 48, 48)},
      pat:PAT, idx:2, r:2, chain:0, sh:0, str:0, resist:0, seq:7, phased:false}};
}

/* ---------- 敵の予定 ---------- */
const cur = e => e.pat[e.idx];
const moveOk = (e, a) => !a.by || !e.units[a.by] || !e.units[a.by].broken;
const nxtIdx = (e, i) => { let n = (i + 1) % e.pat.length; for(let k = 0; k < e.pat.length && !moveOk(e, e.pat[n]); k++) n = (n + 1) % e.pat.length; return n; };
const inWin = (e, w) => !!w && e.r > 0 && e.r <= w.w;
function advance(e){
  if(!e.phased && e.uids.every(k => e.units[k].core || e.units[k].broken)){ e.phased = true; e.pat = PHASE; e.idx = 0; }
  else e.idx = nxtIdx(e, e.idx);
  const a = cur(e); e.r = a.dl; e.seq++; e.chain = 0; e.sh = a.guard ? a.guard.s : 0;
}
function skipMove(e){ const left = Math.max(0, e.r); advance(e); if(left > 0) e.r = Math.max(1, e.r + left); }
// 今から view サイクル先までの予定。id は同じ行動なら時間が進んでも変わらない
function schedule(st, view){
  const e = st.foe, out = []; if(!e.alive || st.over) return out;
  let t = e.r, idx = e.idx, seq = e.seq, k = 0;
  while(t <= view && k < 12){
    const a = e.pat[idx], hits = a.hits || 1, first = k === 0 && e.chain > 0 ? hits - e.chain : 0;
    for(let j = first; j < hits; j++){ const tt = t + j - first; if(tt > view) break; out.push({id:seq + '.' + j, seq, t:tt, j, hits, head:j === first, last:j === hits - 1, a, k, sh:k === 0 ? e.sh : (a.guard ? a.guard.s : 0)}); }
    t += hits - 1 - first; idx = nxtIdx(e, idx); t += e.pat[idx].dl; seq++; k++;
  }
  return out;
}

/* ---------- 当たり ---------- */
function hurtFoe(st, uid, d, ev){
  const e = st.foe; let u = e.units[uid];
  if(u.broken){ if(!u.core && !e.units.core.broken){ uid = 'core'; u = e.units.core; } else return; }
  const take = Math.min(u.hp, d), over = d - take; u.hp -= take; ev.push({kind:'dmg', unit:uid, n:take});
  if(u.hp <= 0 && !u.broken){
    u.broken = true; u.vuln = 0; u.armor = 0; ev.push({kind:'unitBreak', unit:uid});
    if(e.uids.every(k => !e.units[k].vital || e.units[k].broken)){ e.alive = false; st.over = 'won'; ev.push({kind:'kill'}); return; }
    if(!moveOk(e, cur(e))){ const a = cur(e), seq = e.seq; skipMove(e); ev.push({kind:'cancel', name:a.n, seq}); }
  }
  if(over > 0 && !u.core && e.alive) hurtFoe(st, 'core', over, ev);
}
function hitFoe(st, n, uid, ev){
  const e = st.foe, a = cur(e);
  if(e.units[uid].broken) uid = 'core';
  const u = e.units[uid], onActor = a.by === uid;
  n += u.crack; let d = n;
  if(u.vuln > 0){ d = Math.round(d * 1.5); ev.push({kind:'vulnHit', unit:uid}); }
  if(onActor && inWin(e, a.guard) && e.sh > 0){ const ab = Math.min(e.sh, d); e.sh -= ab; d -= ab; ev.push({kind:'guarded', unit:uid, n:ab}); }
  if(u.armor > 0 && d > 0){ const ab = Math.min(u.armor, d); u.armor -= ab; d -= ab; ev.push({kind:'armored', unit:uid, n:ab}); }
  if(d > 0) hurtFoe(st, uid, d, ev);
  if(e.alive && onActor && cur(e) === a && inWin(e, a.wind) && n >= a.wind.poise){ const seq = e.seq; skipMove(e); ev.push({kind:'break', name:a.n, seq, unit:uid}); }
}
function strike(st, a){
  const me = st.me, e = st.foe, raw = Math.max(0, a.d + e.str) + me.crack;
  if(st.parryNow){ const ev = []; hurtFoe(st, a.by, Math.ceil(raw / 2), ev); return {kind:'parried', raw, ev}; }
  const ab = Math.min(me.block, raw); me.block -= ab;
  const rem = raw - ab, p = me.parts[a.p]; let partLoss = 0, bodyLoss = 0, broke = false;
  if(rem > 0){ if(p.cur > 0){ partLoss = Math.min(p.cur, rem); p.cur -= partLoss; broke = p.cur === 0; } bodyLoss = rem - partLoss; me.hp = Math.max(0, me.hp - bodyLoss); }
  return {kind:'hit', part:a.p, raw, blocked:ab, partLoss, bodyLoss, broke, hurt:rem > 0};
}
function enemyAct(st){
  const e = st.foe, a = cur(e); e.resist = 0;
  const j = e.chain > 0 ? (a.hits || 1) - e.chain : 0;
  const res = a.d > 0 ? strike(st, a) : {kind:'move'};
  Object.assign(res, {name:a.n, by:a.by, a, sid:e.seq + '.' + j, seq:e.seq});
  if(!e.alive) return res;
  if(a.hits > 1 && !e.chain){ e.chain = a.hits - 1; e.r = 1; e.sh = 0; return res; }
  if(e.chain > 0){ e.chain--; if(e.chain > 0){ e.r = 1; return res; } }
  const ap = e.units[a.by];
  if(a.rec && !ap.broken) ap.vuln = a.rec + 1;
  if(a.armor){ ap.armor += a.armor; res.armor = a.armor; }
  if(a.crack){ st.me.crack += a.crack; res.crack = a.crack; }
  advance(e);
  return res;
}

/* ---------- 行動(カード・待機・リフレッシュ)。出来事の列を返す ---------- */
const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function drawN(st, n){ const got = []; for(let i = 0; i < n; i++){ if(!st.draw.length){ st.draw = shuffle(st.disc); st.disc = []; } if(!st.draw.length) break; const c = st.draw.pop(); st.hand.push(c); got.push(c); } return got; }
function snap(st){
  const e = st.foe, units = {}; for(const k of e.uids){ const u = e.units[k]; units[k] = {hp:u.hp, armor:u.armor, crack:u.crack, vuln:u.vuln, broken:u.broken}; }
  const parts = {}; for(const s of SLOTS) parts[s.id] = st.me.parts[s.id].cur;
  return {T:st.T, me:{hp:st.me.hp, block:st.me.block, crack:st.me.crack, parts}, units, alive:e.alive, str:e.str, resist:e.resist, sched:schedule(st, VIEW),
    piles:{draw:st.draw.length, disc:st.disc.length, cache:st.cache.length}};
}
let VIEW = 17;
const costOf = (st, act) => act.type === 'card' ? CARDS[st.hand[act.i].k].cost : act.type === 'refresh' ? 2 : 1;
function run(st, act){
  const ev = [], e = st.foe, me = st.me, push = o => { o.snap = snap(st); ev.push(o); return o; };
  const cost = costOf(st, act); let card = null, c = null;
  if(act.type === 'card'){ card = st.hand.splice(act.i, 1)[0]; c = CARDS[card.k]; }
  if(act.type === 'refresh'){ st.disc.push(...st.cache, ...st.hand); st.cache = []; st.hand = []; }
  push({type:'start', kind:act.type, card, cost, uid:act.uid});
  let fired = false, cut = false;
  const fire = () => {
    fired = true; const res = []; let just = false; const uid = act.uid && !e.units[act.uid].broken ? act.uid : 'core';
    const acting = e.alive && e.r <= 0, a = cur(e);
    if(acting && a.ch && !e.chain && c.dmg){ // 不安定: 同じサイクルにカードでダメージ → ブレイク
      const seq = e.seq, by = a.by; skipMove(e);
      const cr = me.parts.calc.cur > 0 ? 1 : 0; if(cr && !e.units[by].broken) e.units[by].crack += cr; // 〘標準演算核〙
      res.push({kind:'just', name:a.n, seq, unit:by, crack:cr}); just = true;
    }
    if(c.parry && acting && a.d > 0){ st.parryNow = true; just = true; }
    if(c.block){ me.block += c.block; res.push({kind:'block', n:c.block}); }
    if(c.dmg) for(let i = 0; i < (c.dmg.x || 1) && e.alive; i++) hitFoe(st, c.dmg.n, uid, res);
    if(c.crack && e.alive && !e.units[uid].broken){ e.units[uid].crack += c.crack; res.push({kind:'crack', unit:uid, n:c.crack}); }
    if(c.delay && e.alive){ const v = Math.max(0, c.delay - e.resist); e.r += v; e.resist++; res.push({kind:'delay', n:v}); }
    push({type:'fire', card, c, uid, res, just});
  };
  if(c && cost === 0) fire();
  for(let s = 1; s <= cost && !st.over; s++){
    st.T++; e.r--; for(const k of e.uids) if(e.units[k].vuln > 0) e.units[k].vuln--;
    push({type:'tick', s, of:cost});
    if(s === cost && c) fire();
    if(st.over) break;
    if(e.alive && e.r <= 0){
      const res = enemyAct(st); st.parryNow = false;
      push({type:'foe', res});
      if(me.hp <= 0){ st.over = 'dead'; break; }
      if(st.over) break;
      if(c && !fired && res.hurt && !c.atomic){ cut = true; push({type:'interrupt', card}); break; }
    }
    st.parryNow = false;
  }
  if(card) st.cache.push(card);
  if(act.type === 'refresh' && !st.over){ me.block = 0; const got = drawN(st, 5); push({type:'refresh', got}); }
  if(st.over) push({type:st.over});
  push({type:'end', cut});
  return ev;
}
// 選んだ行動の予想。状態の写しで最後まで回して、結果を読む
function preview(st, act){
  const s2 = clone(st); s2.foe.pat = st.foe.pat; const ev = run(s2, act);
  const sum = {cost:ev[0].cost, fired:false, cutT:null, just:false, justSeq:[], breakSeq:[], cancelSeq:[], hits:[], dmg:{}, block:0, delay:0, kill:false, dead:s2.over === 'dead'};
  let t = 0;
  const foeEv = list => { for(const r of list){
    if(r.kind === 'dmg') sum.dmg[r.unit] = (sum.dmg[r.unit] || 0) + r.n;
    if(r.kind === 'just'){ sum.just = true; sum.justSeq.push(r.seq); }
    if(r.kind === 'break') sum.breakSeq.push(r.seq);
    if(r.kind === 'cancel') sum.cancelSeq.push(r.seq);
    if(r.kind === 'kill') sum.kill = true;
    if(r.kind === 'block') sum.block += r.n;
    if(r.kind === 'delay') sum.delay += r.n;
  } };
  for(const x of ev){
    if(x.type === 'tick') t = x.s;
    if(x.type === 'fire'){ sum.fired = true; foeEv(x.res); }
    if(x.type === 'foe'){ const r = x.res; if(r.kind === 'parried'){ sum.just = true; foeEv(r.ev); } sum.hits.push({t, sid:r.sid, seq:r.seq, kind:r.kind, hurt:!!r.hurt, blocked:r.blocked || 0, part:r.part, partLoss:r.partLoss || 0, bodyLoss:r.bodyLoss || 0, raw:r.raw || 0}); }
    if(x.type === 'interrupt') sum.cutT = t;
  }
  return {ev, after:s2, sum};
}

// 敵の行動の説明(text/terms.csv の ui.mv.* の文)
function moveText(a){
  const L = [], part = a.p ? SLOT[a.p].name : '';
  if(a.d > 0) L.push(a.hits > 1 ? `${part}に${a.d}ダメージを${a.hits}回与える。` : `${part}に${a.d}ダメージを与える。`);
  if(a.armor) L.push(`ブロック${a.armor}を得る。`);
  if(a.ch) L.push('不安定。同じサイクルにカードでダメージを与えるとブレイクする。');
  if(a.wind) L.push(`体勢${a.wind.w}/${a.wind.poise}：${a.wind.w}サイクル前から、一度に${a.wind.poise}以上のダメージを受けるとブレイクする。`);
  if(a.guard) L.push(`防壁${a.guard.w}/${a.guard.s}：${a.guard.w}サイクル前から、合計で${a.guard.s}までのダメージを防ぐ。`);
  if(a.rec) L.push(`隙${a.rec}：行動の後${a.rec}サイクル、受けるダメージが1.5倍になる。`);
  if(a.crack) L.push(`こちらにクラック${a.crack}を与える。こちらが受ける攻撃すべてのダメージ+${a.crack}。重なる。`);
  return L;
}

/* ---------- 地図と報酬(見本用の固定の中身) ---------- */
const ROOM = {
  battle:{name:'通常戦', desc:'敵と戦う。勝つとスクラップを得て、カードを1枚学習できる。', heat:0.3},
  elite:{name:'エリート', desc:'強い敵と戦う。勝つとパーツを鹵獲できる。', heat:2.8},
  rest:{name:'整備', desc:'修理かデフラグのどちらかを行う。', heat:-1.2},
  shop:{name:'ショップ', desc:'スクラップでカードや修理を買う。', heat:-1.2},
  event:{name:'イベント', desc:'何かが起こる。', heat:-1.2},
  duct:{name:'保守通路', desc:'点検用の通路。何も起きないが、警戒が下がる。', heat:-3.2},
  boss:{name:'ボス', desc:'このエリアの主。倒すと踏破。', heat:0.8},
};
const MAP = {area:'エリア1', cols:12, transfers:[2, 5, 8], heat:1.6, body:[38, 50], scrap:64, deck:14,
  lanes:[
    ['battle', 'battle', 'event', 'elite', 'battle', 'shop', 'battle', 'event', 'battle', 'elite', 'battle', 'rest'],
    ['battle', 'event', 'battle', 'battle', 'duct', 'battle', 'elite', 'battle', 'shop', 'battle', 'event', 'rest'],
    ['battle', 'battle', 'shop', 'duct', 'event', 'elite', 'battle', 'rest', 'battle', 'battle', 'elite', 'rest'],
  ],
  path:[[1, 0], [1, 1], [1, 2]]}; // 通ってきた区画 [列, 番号]。次は番号3(乗り換えの直後なので3列とも選べる)
const HEAT = {names:{'-2':'静止', '-1':'冷却', '0':'平熱', '1':'加熱', '2':'過熱'}, th:[2, 5], min:-10, max:10,
  level:g => g <= -5 ? -2 : g <= -2 ? -1 : g < 2 ? 0 : g < 5 ? 1 : 2,
  fx:{'-2':['スクラップ−30%', 'カードの候補2枚'], '-1':['スクラップ−20%', 'コモンが出やすい'], '0':[], '1':['スクラップ+15%', 'アンコモンが出やすい', '敵が「+」で出る'], '2':['スクラップ+30%', 'カードの候補4枚', '敵が「++」で出る']}};
const REWARD = {scrap:21, cards:['careful', 'foresight', 'blow']};

/* ---------- 画面の大きさ: 844×390 を基準に、余った分は縦か横に広げる ---------- */
function fit(stage, box, o){
  o = Object.assign({w:844, h:390, maxW:1040, maxH:540}, o || {});
  const r = box.getBoundingClientRect(), s = Math.min(r.width / o.w, r.height / o.h);
  const W = Math.round(Math.min(o.maxW, r.width / s)), H = Math.round(Math.min(o.maxH, r.height / s));
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  return {W, H, s, portrait:r.height > r.width * 1.1};
}

/* ---------- 押す・長押し・右クリック ---------- */
function press(el, sel, {tap, hold, enter, leave}){
  let tm = null, held = false, tgt = null, sx = 0, sy = 0;
  const pick = e => e.target.closest ? e.target.closest(sel) : null;
  el.addEventListener('pointerdown', e => { const t = pick(e); if(!t || e.button === 2) return; tgt = t; held = false; sx = e.clientX; sy = e.clientY;
    clearTimeout(tm); if(hold) tm = setTimeout(() => { held = true; hold(t, e); }, 420); });
  el.addEventListener('pointermove', e => { if(tm && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)){ clearTimeout(tm); tm = null; } });
  const up = e => { clearTimeout(tm); tm = null; const t = pick(e); if(tgt && t === tgt && !held && e.type === 'pointerup' && tap) tap(t, e); tgt = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => { const t = pick(e); if(t && hold){ e.preventDefault(); clearTimeout(tm); hold(t, e); } });
  if(enter) el.addEventListener('pointerover', e => { if(e.pointerType !== 'mouse') return; const t = pick(e); if(t) enter(t, e); });
  if(leave) el.addEventListener('pointerout', e => { if(e.pointerType !== 'mouse') return; const t = pick(e); if(t && !t.contains(e.relatedTarget)) leave(t, e); });
}

/* ---------- 音の土台(Web Audio)。音色そのものは案ごとに作る ---------- */
const AU = {ctx:null, vol:0.8, sfxOn:true,
  init(revSec, revDecay){
    if(this.ctx){ if(this.ctx.state !== 'running') this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.22;
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master); this.bgm = c.createGain(); this.bgm.connect(this.master);
    const len = Math.floor(c.sampleRate * (revSec || 1.6)), ir = c.createBuffer(2, len, c.sampleRate);
    for(let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, revDecay || 2.4); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.rev.connect(this.master);
    const nb = this.nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0); for(let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return c;
  },
  setVol(v){ this.vol = v; if(this.master) this.master.gain.value = v; },
  get now(){ return this.ctx ? this.ctx.currentTime : 0; },
  _env(g, t, a, dur, peak){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  _out(node, wet, dest){ node.connect(dest || this.sfx); if(wet){ const w = this.ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(this.rev); } },
  // 発振器1つ。f2 があれば音の高さを滑らせる
  osc(o){ const c = this.ctx; if(!c || (!this.sfxOn && !o.dest)) return; const t = this.now + (o.at || 0), dur = o.dur || 0.2;
    const os = c.createOscillator(), g = c.createGain(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t);
    if(o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.slide || dur)); if(o.det) os.detune.value = o.det;
    this._env(g, t, o.a || 0.004, dur, o.g == null ? 0.3 : o.g);
    let n = os; if(o.lp){ const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); n = f; }
    n.connect(g); this._out(g, o.wet, o.dest); os.start(t); os.stop(t + dur + 0.05); },
  // 雑音をフィルタに通す
  noise(o){ const c = this.ctx; if(!c || (!this.sfxOn && !o.dest)) return; const t = this.now + (o.at || 0), dur = o.dur || 0.2;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.nb; s.loop = true;
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); if(o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || 1;
    this._env(g, t, o.a || 0.002, dur, o.g == null ? 0.3 : o.g);
    s.connect(f); f.connect(g); this._out(g, o.wet, o.dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); },
  // 倍音が整数比でない音(金属の板・鐘)。ratios は基音に対する比、長いほど低い成分が残る
  metal(o){ const R = o.ratios || [1, 2.76, 5.4, 8.93]; R.forEach((r, i) => this.osc({type:o.type || 'sine', f:o.f * r, at:o.at, dur:(o.dur || 1) / (1 + i * (o.damp == null ? 0.7 : o.damp)), g:(o.g || 0.2) / (1 + i * 0.8), a:o.a || 0.002, wet:o.wet, dest:o.dest, det:o.det})); },
  // FM の鐘
  bell(o){ const c = this.ctx; if(!c || (!this.sfxOn && !o.dest)) return; const t = this.now + (o.at || 0), dur = o.dur || 1.2;
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = o.f; mod.frequency.value = o.f * (o.ratio || 3.5);
    mg.gain.setValueAtTime(o.f * (o.idx == null ? 2 : o.idx), t); mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.5);
    mod.connect(mg); mg.connect(car.frequency); this._env(g, t, o.a || 0.003, dur, o.g == null ? 0.25 : o.g);
    car.connect(g); this._out(g, o.wet, o.dest); car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05); },
};

/* ---------- 記号(16×16、線で描く。色と太さは案ごとの CSS で決める) ---------- */
const IC = {
  calc:'<rect x="3" y="3" width="10" height="10"/><rect x="6.4" y="6.4" width="3.2" height="3.2" class="f"/>',
  arm:'<path d="M2 6.5h9v3H2zM11 8h3.5M5 9.5v3"/>',
  out:'<path d="M4.5 3.5v5.5l6.5 4"/><circle cx="4.5" cy="3.5" r="1.6" class="f"/>',
  dur:'<path d="M8 1.8l5.2 3v6.4L8 14.2l-5.2-3V4.8z"/>',
  mob:'<path d="M3 13.5l5-5 5 5M3 8l5-5 5 5"/>',
  melee:'<path d="M2.5 13.5l8.5-8.5M8.5 2.5h5v5M4 10l2 2"/>',
  ranged:'<path d="M1.5 8h11M9.5 4.5L13 8l-3.5 3.5"/><path d="M3 4.5v7" />',
  block:'<path d="M8 1.8l5 2v4.4c0 2.9-2 5-5 6-3-1-5-3.1-5-6V3.8z"/>',
  delay:'<path d="M4 2h8l-4 6 4 6H4l4-6z"/>',
  crack:'<path d="M9.5 1.5L5 8h4l-3 6.5"/>',
  vuln:'<path d="M12.5 5A5.5 5.5 0 1 0 13.5 8"/><path d="M8 5v3.5" /><circle cx="8" cy="11" r=".6" class="f"/>',
  core:'<path d="M8 2l6 6-6 6-6-6z"/><path d="M8 5.5l2.5 2.5L8 10.5 5.5 8z" class="f"/>',
  gun:'<path d="M1.5 6.5h10v3h-10zM11.5 5h3v6h-3z"/>',
  mg:'<path d="M2 5h9M2 8h12M2 11h9"/>',
  legs:'<path d="M2 14l3-9 3 4 3-4 3 9"/>',
  battle:'<path d="M3 3l10 10M13 3L3 13M3 3h3M3 3v3M13 3h-3M13 3v3"/>',
  elite:'<path d="M2 12.5l1-8 3 3.5 2-5 2 5 3-3.5 1 8z"/>',
  rest:'<path d="M10.5 2.5a3 3 0 0 0-3.8 3.8L2.5 10.5l3 3 4.2-4.2a3 3 0 0 0 3.8-3.8l-2 2-1.5-1.5z"/>',
  shop:'<path d="M8 1.8l5.2 3v6.4L8 14.2l-5.2-3V4.8z"/><circle cx="8" cy="8" r="2"/>',
  event:'<path d="M5.5 6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="8" cy="12.8" r=".7" class="f"/>',
  duct:'<path d="M2 4h12M4 8h8M6 12h4"/>',
  boss:'<path d="M1.5 8c2-3.5 4.2-5 6.5-5s4.5 1.5 6.5 5c-2 3.5-4.2 5-6.5 5s-4.5-1.5-6.5-5z"/><circle cx="8" cy="8" r="2" class="f"/>',
  deck:'<rect x="3" y="4.5" width="8" height="10" rx="1"/><path d="M5.5 2h7.5v10"/>',
  disc:'<rect x="3.5" y="3" width="9" height="11" rx="1"/><path d="M6 6.5l4 4M10 6.5l-4 4"/>',
  cache:'<rect x="2.5" y="5" width="11" height="8" rx="1"/><path d="M5 5V3h6v2M5.5 9h5"/>',
  refresh:'<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/>',
  wait:'<path d="M5.5 3.5v9M10.5 3.5v9"/>',
  menu:'<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
  scrap:'<path d="M8 1.8l5.2 3v6.4L8 14.2l-5.2-3V4.8z"/><path d="M6 6h4v4H6z"/>',
  hp:'<path d="M2 8h3l1.5-4 3 8L11 8h3"/>',
  play:'<path d="M5 3l8 5-8 5z" class="f"/>',
  sound:'<path d="M2.5 6v4h2.5l3.5 3V3L5 6zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9"/>',
  x:'<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
};
const ic = (k, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 16 16" aria-hidden="true">${IC[k] || ''}</svg>`;

window.MOCK = {IC, ic, SLOTS, SLOT, KW, CARDS, RAR, mainNum, newState, schedule, run, preview, costOf, moveText, ROOM, MAP, HEAT, REWARD, fit, press, AU, clone,
  get VIEW(){ return VIEW; }, set VIEW(v){ VIEW = v; }};
})();
