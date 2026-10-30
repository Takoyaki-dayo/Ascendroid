// 持続(0.29.0)の2つの方針を比べる。K-7・最初のデッキの一部を試作カードに替えて、通常戦を自動で戦わせる
//   node tools/lab/dotlab.js [回数] [打ち方 greedy|expert]
// A: 回数が貴重(威力を盛る) / B: 威力が貴重(回数を盛る)。カードの数値は仮(工房の試作カードと同じ)
process.env.CLS = 'k7';
const {E, D, POL} = require('../sim.js');
const N = +(process.argv[2] || 6), pol = process.argv[3] || 'greedy';
const T = {
  A1:{cost:1, tgt:true, dot:{n:1, p:2}}, A2:{cost:2, tgt:true, dot:{n:1, p:5}}, A3:{cost:1, tgt:true, dot:{n:3, p:0}},
  B1:{cost:1, tgt:true, dot:{n:3, p:1}}, B2:{cost:2, tgt:true, dot:{n:8, p:1}}, B3:{cost:2, tgt:true, dot:{n:0, p:3}},
};
for(const [k, c] of Object.entries(T)) D.cards[k] = Object.assign({name:k}, c);
const base = D.startDeck.slice();
const swap = (out, inn) => { const d = base.slice(); for(const k of out){ const i = d.indexOf(k); d.splice(i, 1); } return d.concat(inn); };
const V = {
  base: base,
  A4: swap(['jab', 'jab', 'slash', 'hack'], ['A1', 'A1', 'A2', 'A3']),
  B4: swap(['jab', 'jab', 'slash', 'hack'], ['B1', 'B1', 'B2', 'B3']),
  A6: swap(['jab', 'jab', 'jab', 'jab', 'slash', 'hack'], ['A1', 'A1', 'A1', 'A2', 'A2', 'A3']),
  B6: swap(['jab', 'jab', 'jab', 'jab', 'slash', 'hack'], ['B1', 'B1', 'B1', 'B2', 'B2', 'B3']),
};
const encs = Object.keys(D.encounters).filter(k => k.startsWith('n_'));
console.log(`K-7 / ${pol} / 通常戦${encs.length}種 × ${N}回`);
console.log('デッキ   勝率  サイクル  被ダメ  持続の割合  持続が効いていた割合  威力の最大(平均)');
for(const [name, deck] of Object.entries(V)){
  let w = 0, cyc = 0, body = 0, dd = 0, hp = 0, dc = 0, pk = 0, n = 0;
  for(const enc of encs) for(let i = 0; i < N; i++){
    const run = E.newRun(100 + i); run.deck = deck.slice();
    const st0 = E.newBattle(E.clone(run), enc); const hp0 = st0.b.foes.reduce((a, e) => a + e.hp, 0);
    // 戦闘の中身(持続のダメージなど)を見るため、sim.js の fight と同じ処理をここで回す
    const st = E.newBattle(E.clone(run), enc);
    const P = POL[pol];
    let o = null; for(let k = 0; k < 300; k++){ o = E.doAction(st, P(st)); if(o.won || o.dead) break; }
    n++; if(o && o.won) w++; cyc += st.b.T; body += run.body - st.run.body; dd += st.b.dotDmg || 0; hp += hp0 - st.b.foes.reduce((a, e) => a + (e.hp || 0), 0); dc += (st.b.dotCyc || 0) / Math.max(1, st.b.T); pk += st.b.dotPeak || 0;
  }
  console.log(name.padEnd(6), `${(w / n * 100).toFixed(0)}%`.padStart(5), (cyc / n).toFixed(1).padStart(8), (body / n).toFixed(1).padStart(7), `${(dd / Math.max(1, hp) * 100).toFixed(0)}%`.padStart(10), `${(dc / n * 100).toFixed(0)}%`.padStart(18), (pk / n).toFixed(1).padStart(14));
}
