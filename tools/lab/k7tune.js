// 既定のキャラ(リフレッシュ2・5枚)のカードの数値を探す。敵は全キャラ共通(放置の代償つき、倍率1)
// 目標: 標準デッキ+固定手順の損傷が、常時供給(今のカードそのまま)と同じになること
// low: コスト2以下の数値に掛ける倍率 / all: 全カードの数値に掛ける倍率(パーツの補正の前)
'use strict';
const T = require('./turns.js'), E = T.E, D = T.D;
function setCards(low, all){
  const out = JSON.parse(JSON.stringify(T.CARDS0));
  for(const c of Object.values(out)){
    if(c.junk) continue;
    const f = (c.cost < 3 ? low : 1) * all, sc = x => Math.max(1, Math.round(x * f));
    if(c.dmg) c.dmg.n = sc(c.dmg.n); if(c.block) c.block = sc(c.block); if(c.timer) c.timer.dmg.n = sc(c.timer.dmg.n);
  }
  D.cards = out;
}
const SEED = +(process.argv[2] || 5);
function lossOf(econ, low, all, deck, agent, N){
  E.RULE.econ = econ; E.RULE.freeWait = true; setCards(low, all); T.setFoes(T.FOES_ESC, 1);
  const o = T.bestOrder(deck, 3, 20, 11);
  return T.measure(deck, agent, N, SEED, o, 3);
}
const base = lossOf(null, 1, 1, 'std', 'auto', 30);
console.log('常時供給・今のカード: 固定手順', base.loss.toFixed(1));
const K7 = process.argv[4] === 'turn' ? {type:'turn', len:6, hand:5, blockReset:true} : {type:'reload', r:2, hand:5, blockReset:'start'};
const GRID = JSON.parse(process.argv[3] || '[[0.5,1.6],[0.5,1.7],[0.5,1.8],[0.5,2.0],[0.55,1.6],[0.55,1.7],[0.6,1.6],[0.6,1.7]]');
for(const [low, all] of GRID){
  const r = lossOf(K7, low, all, 'std', 'auto', 30);
  const L = lossOf(K7, low, all, 'light', 'auto', 15), H = lossOf(K7, low, all, 'heavy', 'auto', 15);
  console.log(`low×${low} all×${all}: 標準 ${r.loss.toFixed(1)} | 軽い ${L.loss.toFixed(1)} 重い ${H.loss.toFixed(1)}(差 ${(L.loss - H.loss).toFixed(1)})`);
}
