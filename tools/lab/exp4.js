// 実験4: 敵の行動を複雑にすると単調さが減るか(モデルは lab2.js)
// 条件:
//   基本の敵(FOES)を段階 0〜4 で: 0 今の形 / 1 全部の攻撃に構え / 2 一部の行動だけに構え / 3 全属性(決まった順) / 4 全属性+分岐+段階変化
//   問いを持つ敵(FOES_Q: 1体ごとに正しい答えが変わるくらい属性を強く)を段階 0・3・4 で
//   ブロックが4サイクルで消える(blockLife)を、今の形と問いを持つ敵に足したもの
//   1サイクル待てる(wait)を足したもの
// 使い方: node exp4.js [条件の記号をカンマ区切り] [乱数の種]
// 遊び手:
//   固定手順 auto  デッキごとに探した最良の優先順で、考えずに出す(耐久が最も低い敵を狙う)
//   読み roll      各候補を出したあと固定手順で戦闘の最後まで打ち切り、平均の被ダメージで選ぶ
// 難しさ: 遭遇ごとに、混合デッキ+読みの被ダメージが 22 になるよう敵の攻撃力を揃える
// 指標:
//   デッキの差   4デッキ(読み)の被ダメージの最大-最小
//   得意         遭遇ごとに最も被ダメージが少ないデッキ(頭文字: l 軽い / m 混合 / h 重い / d ドロー)と、その種類数
//   相性の強さ   デッキ×遭遇の交互作用の標準偏差。大きいほど「この敵にはこのデッキ」がはっきりする
//   考える価値   固定手順-読み の被ダメージ(混合デッキ)。大きいほど、決まった手順では足りない
//   対応の幅     読みが遭遇ごとにどれだけ違う選び方をするか。重い攻撃を選ぶ率・ブロックを選ぶ率の、遭遇間の最大-最小
//   定石外れ     読みの判断のうち、固定手順と違う手を選んだ割合
//   効く判断     選択肢の間で中断・JUST・構え崩しの結果が変わる判断の割合
const L = require('./lab2.js');
const ENCS = Object.keys(L.ENC), DK = ['light', 'mixed', 'heavy', 'draw'];
const CONDS = [
  ['A', '今の形', {level:0}],
  ['B', '全部に構え', {level:1}],
  ['C', '一部に構え', {level:2}],
  ['D', '全属性・決まった順', {level:3}],
  ['E', '全属性+分岐+段階', {level:4}],
  ['F', '問いの敵から属性を抜く', {level:0, roster:'q'}],
  ['G', '問いの敵・決まった順', {level:3, roster:'q'}],
  ['H', '問いの敵+分岐+段階', {level:4, roster:'q'}],
  ['I', '今の形+ブロック4で消える', {level:0, blockLife:4}],
  ['J', '問いの敵+分岐+段階+ブロック4', {level:4, roster:'q', blockLife:4}],
  ['K', '今の形+待てる', {level:0, wait:true}],
  ['L', '問いの敵+分岐+段階+待てる', {level:4, roster:'q', wait:true}],
  ['M', '今の形+2サイクル待てる', {level:0, wait:true, waitLen:2}],
  ['N', '一部に構え+待てる', {level:2, wait:true}],
];
const SEED = +(process.argv[3] || 5);
const pick = process.argv[2] ? process.argv[2].split(',') : CONDS.map(c => c[0]);
const rows = [], f = x => x.toFixed(1), pct = x => (x * 100).toFixed(0) + '%';
for(const [id, name, cond] of CONDS){
  if(!pick.includes(id)) continue;
  const t0 = Date.now();
  let P = {...cond, dmgMul:1, K:3};
  let o = L.bestOrder({...P, dmgMul:0.7}, 'mixed', 8, 30, 11);
  let em = L.calibrateEnc(P, 22, 5, 'roll', o); P = {...P, encMul:em};
  o = L.bestOrder(P, 'mixed', 10, 45, 11);
  em = L.calibrateEnc(P, 22, 10, 'roll', o); P = {...P, encMul:em, K:4};
  const r = {id, name, cond, encMul:em, order:{}, auto:{}, roll:{}};
  for(const d of DK){
    r.order[d] = d === 'mixed' ? o : L.bestOrder(P, d, 10, 45, 11);
    r.auto[d] = L.measure(P, d, 'auto', 60, SEED, {order:r.order[d]});
    r.roll[d] = L.measure(P, d, 'roll', 24, SEED, {order:r.order[d]});
  }
  // 遭遇ごとの得意デッキと相性
  const x = {}; for(const d of DK){ x[d] = {}; for(const e of ENCS) x[d][e] = r.roll[d].per[e].taken; }
  const gm = DK.reduce((a, d) => a + ENCS.reduce((b, e) => b + x[d][e], 0), 0) / (DK.length * ENCS.length);
  const dm = d => ENCS.reduce((a, e) => a + x[d][e], 0) / ENCS.length, em2 = e => DK.reduce((a, d) => a + x[d][e], 0) / DK.length;
  let ss = 0; for(const d of DK) for(const e of ENCS){ const v = x[d][e] - dm(d) - em2(e) + gm; ss += v * v; }
  r.interaction = +Math.sqrt(ss / (DK.length * ENCS.length)).toFixed(2);
  r.bestDeck = {}; for(const e of ENCS){ let bd = null, bv = Infinity; for(const d of DK) if(x[d][e] < bv){ bv = x[d][e]; bd = d; } r.bestDeck[e] = bd; }
  r.winners = new Set(Object.values(r.bestDeck)).size;
  const tk = DK.map(d => r.roll[d].taken); r.spread = +(Math.max(...tk) - Math.min(...tk)).toFixed(1);
  r.think = +(r.auto.mixed.taken - r.roll.mixed.taken).toFixed(1);
  const per = r.roll.mixed.per, hr = ENCS.map(e => per[e].heavyRate).filter(v => v !== null), br = ENCS.map(e => per[e].blockRate).filter(v => v !== null);
  r.heavyRange = +(Math.max(...hr) - Math.min(...hr)).toFixed(2); r.blockRange = +(Math.max(...br) - Math.min(...br)).toFixed(2);
  rows.push(r);
  const M = r.roll.mixed;
  console.log(`${id} ${name}  (${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
  console.log(`  読み: 軽${f(r.roll.light.taken)} 混${f(M.taken)} 重${f(r.roll.heavy.taken)} ド${f(r.roll.draw.taken)} 差${r.spread} | 得意 ${ENCS.map(e => r.bestDeck[e][0]).join('')} ${r.winners}種 相性${r.interaction}`);
  console.log(`  考える価値${r.think}(固定${f(r.auto.mixed.taken)}) 対応の幅 重い${r.heavyRange} ブロック${r.blockRange} 定石外れ${pct(M.off)} 効く判断${pct(M.rel)}`);
  console.log(`  1戦あたり: 中断${M.intr} JUST${M.justs} 崩し${M.breaks} 防がれた${M.absorbed} 反撃${M.countered} 隙に当てた${M.vulnHits} 待った${M.waits} 判断${M.decisions} 時間${M.t}`);
}
require('fs').writeFileSync(__dirname + `/exp4_${pick.join('')}_${SEED}.json`, JSON.stringify(rows, null, 1));
