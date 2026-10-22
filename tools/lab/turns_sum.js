// turns.js の結果(turns_*.json)を、条件ごとに乱数の種を平均して表にする
// 使い方: node tools/lab/turns_sum.js [敵: base|esc]
'use strict';
const fs = require('fs'), path = require('path');
const FO = process.argv[2] || 'base';
const files = fs.readdirSync(__dirname).filter(f => /^turns_.*\.json$/.test(f) && f.includes(`_${FO}_`));
const by = {};
for(const f of files) for(const r of JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'))) (by[r.id] = by[r.id] || []).push(r);
const avg = (rs, fn) => rs.reduce((a, r) => a + fn(r), 0) / rs.length;
const DK = ['std','crack','timer','delay','counter','swift','fortress','light','heavy'];
const rows = Object.entries(by).map(([id, rs]) => {
  const o = {id, name:rs[0].name, n:rs.length};
  for(const k of ['archSpread','archMean','turtle','price','starve','off','rel','think','avgHand','T','intr','justs','reloads','early','waits','mult']) o[k] = avg(rs, r => r[k]);
  o.deck = Object.fromEntries(DK.map(d => [d, avg(rs, r => r.roll[d].loss)]));
  const al = DK.slice(0, 7).map(d => o.deck[d]); o.archSpread2 = Math.max(...al) - Math.min(...al);
  return o;
});
const f = x => x.toFixed(1), p = x => (x * 100).toFixed(0) + '%';
console.log('条件 | 種 | 平均 | 差 | 亀の得 | 軽−重 | 細々 | 手札 | 定石外れ | 効く判断 | 考える価値 | 時間 | 中断 | JUST | 区切り(残して) | 待った | ' + DK.join(' '));
for(const o of rows.sort((a, b) => a.id.localeCompare(b.id))) console.log([o.id, o.n, f(o.archMean), f(o.archSpread2), f(o.turtle), f(o.price), p(o.starve), f(o.avgHand), p(o.off), p(o.rel), f(o.think), f(o.T), f(o.intr), f(o.justs), f(o.reloads) + '(' + f(o.early || 0) + ')', f(o.waits), DK.map(d => f(o.deck[d])).join(' ')].join(' | '));
