// 実験1: 決め方・補給・重なりのルールを変え、デッキの偏りと読みの差を測る
const L = require('./lab.js');
const C = {
  'A 今の0.5(自由・使い切り補充)':      {decide:'free', economy:'refill'},
  'B 今の0.6(自由・時間で届く)':        {decide:'free', economy:'clock', curve:'flat'},
  'C 区切って組む・使い切り補充':       {decide:'window', economy:'refill'},
  'D 区切って組む・時間で届く':         {decide:'window', economy:'clock', curve:'flat'},
  'E 自由・中断なし':                   {decide:'free', economy:'refill', interrupt:false},
  'F 自由・効果が先で後が隙':           {decide:'free', economy:'refill', impactFirst:true},
  'G 自由・構え1':                      {decide:'free', economy:'refill', overhead:1},
  'H 自由・敵にも構え(重い一撃で潰せる)': {decide:'free', economy:'refill', windup:2, poise:10},
  'I 区切って組む・敵にも構え':         {decide:'window', economy:'refill', windup:2, poise:10},
  'J 区切って組む・時間で届く・敵にも構え': {decide:'window', economy:'clock', curve:'flat', windup:2, poise:10},
};
const N = +(process.argv[2] || 25), rows = [];
for(const [name, P0] of Object.entries(C)){
  const m = L.calibrate(P0, 30, 12), P = {...P0, dmgMul:m};
  const r = {name, dmgMul:m};
  for(const d of ['light','mixed','heavy']) r[d] = L.measure(P, d, 'greedy', N, 5);
  r.random = L.measure(P, 'mixed', 'random', N, 5);
  if(P.decide === 'free') r.look = L.measure(P, 'mixed', 'look', Math.max(6, Math.round(N / 3)), 5);
  rows.push(r);
  const f = x => x ? x.taken.toFixed(1) : '-';
  console.log(`${name} | m=${m} | 被ダメ 軽${f(r.light)} 混${f(r.mixed)} 重${f(r.heavy)} | ランダム${f(r.random)} 2手${f(r.look)} | 決定/敵行動 ${r.mixed.dpe} 重なりが効く判断 ${(r.mixed.rel * 100).toFixed(0)}% JUST ${r.mixed.justs} 中断 ${r.mixed.intr} 崩し ${r.mixed.breaks}`);
}
require('fs').writeFileSync(__dirname + '/exp1.json', JSON.stringify(rows, null, 1));
