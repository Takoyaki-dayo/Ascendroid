// 実験3: 敵にも「構え」を持たせ、重い一撃で潰せるようにしたとき(時間で届く手札の上で)
const L = require('./lab.js');
const base = {decide:'free', economy:'clock', curve:'flat'};
const C = {'構えなし':{}, '構え2・9以上で潰す':{windup:2, poise:9}, '構え3・9以上':{windup:3, poise:9}, '構え3・12以上':{windup:3, poise:12}, '構え4・12以上':{windup:4, poise:12}};
const f = x => x.taken.toFixed(1), rows = [];
for(const [name, d] of Object.entries(C)){
  const P0 = {...base, ...d}, m = L.calibrate(P0, 30, 12), P = {...P0, dmgMul:m}, r = {name};
  for(const k of ['light','mixed','heavy']) r[k] = L.measure(P, k, 'greedy', 25, 5);
  r.random = L.measure(P, 'mixed', 'random', 25, 5); r.look = L.measure(P, 'mixed', 'look', 8, 5);
  rows.push(r);
  console.log(`${name} | 軽${f(r.light)} 混${f(r.mixed)} 重${f(r.heavy)} | ランダム${f(r.random)} 1手${f(r.mixed)} 2手${f(r.look)} | 効く判断 ${(r.mixed.rel*100).toFixed(0)}% 崩し(混/重) ${r.mixed.breaks}/${r.heavy.breaks} 中断 ${r.mixed.intr}`);
}
require('fs').writeFileSync(__dirname + '/exp3.json', JSON.stringify(rows, null, 1));
