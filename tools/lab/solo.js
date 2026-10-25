// 敵を常に1体にしたとき(0.15.0)の耐久を探す。K-7・標準デッキ・固定手順の損傷が目安になるよう、敵ごとに耐久の倍率を二分探索
// 使い方: node tools/lab/solo.js [回数]
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const T = require('./turns.js'), E = T.E, D = T.D;
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for(const f of ['cards', 'enemies', 'classes']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../data', f + '.js'), 'utf8'), ctx);
const C = ctx.DATA, K7 = C.classes.k7, N = +(process.argv[2] || 20);
const cards = JSON.parse(JSON.stringify(C.cards)); for(const [k, o] of Object.entries(K7.cards)) C.classCard(cards[k], o);
D.cards = cards; E.RULE.econ = K7.econ; E.RULE.freeWait = !!K7.wait;
const FOES = JSON.parse(JSON.stringify(C.foes)), ENC = C.encounters;
// 目安: 戦闘の長さ(サイクル)と損傷(本体 + 部位)。耐久で長さを、攻撃の倍率で損傷を合わせる
//   序盤の通常戦 24サイクル・損傷7 / 後半の通常戦 28・10 / エリート 40・28 / ボス 60・45
const goal = e => e.boss ? {T:60, loss:45} : e.elite ? {T:40, loss:28} : e.tier === 1 ? {T:24, loss:7} : {T:28, loss:10};
function setFoe(key, hm, dm){
  D.foes = JSON.parse(JSON.stringify(FOES)); const f = D.foes[key], sc = x => Math.max(1, Math.round(x * dm));
  f.hp = Math.round(FOES[key].hp * hm);
  const fix = pat => pat.forEach(a => { if(a.d > 0) a.d = sc(a.d); if(a.counter) a.counter.d = sc(a.counter.d); });
  fix(f.pat); if(f.phase) fix(f.phase.pat); if(f.react) f.react.d = sc(f.react.d);
}
const order = T.bestOrder('std', 3, 20, 11);
const out = {};
for(const [ek, e] of Object.entries(ENC)){
  const key = e.foes[0], g = goal(e); D.encounters = {[ek]: e};
  let hm = 1, dm = 1;
  for(let round = 0; round < 2; round++){
    let lo = 0.4, hi = 6;
    for(let i = 0; i < 7; i++){ const m = (lo + hi) / 2; setFoe(key, m, dm); const r = T.measure('std', 'auto', N, 7, order, 3); if(r.T > g.T) hi = m; else lo = m; }
    hm = (lo + hi) / 2; lo = 0.3; hi = 4;
    for(let i = 0; i < 7; i++){ const m = (lo + hi) / 2; setFoe(key, hm, m); const v = T.measure('std', 'auto', N, 7, order, 3).per[ek]; if(v > g.loss) hi = m; else lo = m; }
    dm = (lo + hi) / 2;
  }
  setFoe(key, hm, dm); const r = T.measure('std', 'auto', N, 9, order, 3);
  out[key] = {hp: Math.round(FOES[key].hp * hm), dmg: +dm.toFixed(2)};
  console.log(`${ek} ${key}: 耐久 ${FOES[key].hp} → ${out[key].hp}、攻撃 ×${dm.toFixed(2)} / 長さ ${r.T.toFixed(0)}(目安 ${g.T}) 損傷 ${r.per[ek].toFixed(1)}(目安 ${g.loss})`);
}
console.log(JSON.stringify(out));
