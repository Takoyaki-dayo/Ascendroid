// 実験6: ブロックの減り方(ゲーム本体のエンジン、0.7 の敵)
// 使い方: node tools/lab/block.js [条件の記号をカンマ区切り] [乱数の種]
// 問い: 「防御姿勢を積めば完封できる」緊張感のなさを、ブロックの減り方でどこまで直せるか。減らしすぎると何が壊れるか
// 遊び手は variety.js と同じ(固定手順 auto / 読み roll)。難しさは揃えない(減り方そのものの重さを見るため)
// 見るもの:
//   亀       防御中心のデッキ(防御姿勢4・障壁3・受け流し+攻撃少し)の損傷。下がらないほど完封できている
//   使われ方 得たブロックのうち、実際に攻撃を防いだ割合
//   中断     読みが中断された回数(ブロックで長いカードを守れているか)
//   定石外れ・効く判断  判断の幅(variety.js と同じ)
'use strict';
const V = require('./variety.js'), E = V.E, D = V.D;
const F = JSON.parse(JSON.stringify(D.foes));
const NORMAL = Object.keys(D.encounters);
V.DECKS.turtle = ['wall','wall','wall','wall','guard','guard','guard','parry','jab','jab','slash','slash'];
const DK = ['mixed', 'light', 'heavy', 'control', 'turtle'];
const CONDS = {
  A:['今(使い切るまで残る)', null],
  B:['次の被弾で余りが消える', {type:'hit'}],
  C:['毎サイクル−1', {type:'lin', v:1}],
  D:['毎サイクル−2', {type:'lin', v:2}],
  E:['毎サイクル×0.8', {type:'mul', v:0.8}],
  F:['得てから4サイクルで消える', {type:'life', v:4}],
  G:['得てから6サイクルで消える', {type:'life', v:6}],
  H:['上限12', {type:'cap', v:12}],
};
const pick = (process.argv[2] || Object.keys(CONDS).join(',')).split(','), SEED = +(process.argv[3] || 5), NR = +(process.argv[4] || 6);
const f = x => (+x).toFixed(1), pct = x => (x * 100).toFixed(0) + '%', rows = [];
for(const id of pick){
  const [name, bd] = CONDS[id]; const t0 = Date.now();
  E.RULE.blockDecay = bd; E.RULE.freeWait = true;
  const r = {id, name, bd, auto:{}, roll:{}, order:{}};
  for(const d of DK){
    r.order[d] = V.bestOrder(F, {}, d, 4, 30, 11);
    r.auto[d] = V.measure(F, {}, d, 'auto', 20, SEED, r.order[d], NORMAL);
    r.roll[d] = V.measure(F, {}, d, 'roll', NR, SEED, r.order[d], NORMAL, 3);
  }
  rows.push(r);
  const M = r.roll.mixed, T = r.roll.turtle;
  console.log(`${id} ${name}  (${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
  console.log(`  読み: ${DK.map(d => d.slice(0, 2) + f(r.roll[d].loss)).join(' ')} | 固定: ${DK.map(d => d.slice(0, 2) + f(r.auto[d].loss)).join(' ')}`);
  console.log(`  亀−混合 ${f(T.loss - M.loss)}(負なら亀が得) 亀の時間${T.T} 混合の時間${M.T}`);
  console.log(`  使われ方 混合${pct(M.blockUsed / Math.max(1, M.blockGain))} 亀${pct(T.blockUsed / Math.max(1, T.blockGain))} | 中断${M.intr} 待った${M.waits} 定石外れ${pct(M.offRate)} 効く判断${pct(M.relRate)} 時間${M.T}`);
}
require('fs').writeFileSync(__dirname + `/block_${pick.join('')}_${SEED}.json`, JSON.stringify(rows, null, 1));
