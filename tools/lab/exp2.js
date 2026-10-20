// 実験2: 時間で届く手札(0.6)の中で、強さの曲線・手札の上限・ドローの値段・核の要素を変える
const L = require('./lab.js');
const base = {decide:'free', economy:'clock', curve:'flat'};
const C = {
  'B 基準(平らな曲線・上限7)':      {},
  'B1 強さを時間に比例':            {curve:'lin'},
  'B2 手札の上限5':                 {handMax:5},
  'B3 手札の上限9':                 {handMax:9},
  'B4 JUSTなし':                    {just:false},
  'B5 中断なし':                    {interrupt:false},
  'B6 構え1':                       {overhead:1},
};
const N = +(process.argv[2] || 25);
const f = x => x ? x.taken.toFixed(1) : '-';
const rows = [];
for(const [name, d] of Object.entries(C)){
  const P0 = {...base, ...d}, m = L.calibrate(P0, 30, 12), P = {...P0, dmgMul:m}, r = {name, dmgMul:m};
  for(const k of ['light','mixed','heavy','drawC','drawB','draw3']) r[k] = L.measure(P, k, 'greedy', N, 5);
  r.random = L.measure(P, 'mixed', 'random', N, 5); r.look = L.measure(P, 'mixed', 'look', 8, 5);
  rows.push(r);
  console.log(`${name} | 軽${f(r.light)} 混${f(r.mixed)} 重${f(r.heavy)} | ドロー(安い)${f(r.drawC)} ドロー(前借り)${f(r.drawB)} ドロー(3サイクル)${f(r.draw3)} | ランダム${f(r.random)} 1手${f(r.mixed)} 2手${f(r.look)} | 効く判断 ${(r.mixed.rel * 100).toFixed(0)}% JUST ${r.mixed.justs} 中断 ${r.mixed.intr} 決定/敵行動 ${r.mixed.dpe}`);
}
require('fs').writeFileSync(__dirname + '/exp2.json', JSON.stringify(rows, null, 1));
