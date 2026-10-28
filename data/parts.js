// 部位とパーツ(部位の名前は text/terms.csv、パーツの名前と効果の文は text/parts.csv)
// slots: 体の部位。id は内部名、pt は体の場所
// parts: 付け替えられるパーツ。slot がはまる部位、max が部位耐久
//   fx は効果の中身(index.html ではなく js/engine.js が読む)
//     justCrack  JUSTで溜め技を潰すと、その敵にクラック
//     justDelay  JUSTで溜め技を潰すと、その敵にディレイ
//     handMax    手札の上限に足す
//     ranged / melee  遠隔 / 近接の威力に足す
//     quickMelee コスト2以下の近接に足す
//     heavyMelee コスト4以上の近接に足す
//     block      ブロックを得るときに足す
//     startBlock / startHand  戦闘開始時に得る / startDelay 戦闘開始時、敵にディレイ
//     delayedDelay  自分がディレイされたとき、その敵にディレイ
//     zeroDelay  コスト0のカードを使うと、敵にディレイ
//     cards      デッキに加えるカード(デフラグで消せない)
// startParts: 最初に付いているパーツ
window.DATA = window.DATA || {};
DATA.slots = [
  {id:'calc', pt:''},
  {id:'arm',  pt:''},
  {id:'out',  pt:'腕部'},
  {id:'dur',  pt:'基体'},
  {id:'mob',  pt:'脚部'},
];
DATA.parts = {
  calc_std:  {slot:'calc', max:5,  fx:{justCrack:1}},
  calc_par:  {slot:'calc', max:5,  fx:{handMax:1}},
  calc_pre:  {slot:'calc', max:4,  fx:{justDelay:2}},
  arm_rail:  {slot:'arm',  max:6,  fx:{ranged:2, cards:['charge','charge']}},
  arm_scat:  {slot:'arm',  max:6,  fx:{ranged:1, cards:['scatter','scatter']}},
  arm_time:  {slot:'arm',  max:5,  fx:{ranged:1, cards:['timebomb','timebomb']}},
  out_std:   {slot:'out',  max:7,  fx:{melee:2}},
  out_heavy: {slot:'out',  max:8,  fx:{heavyMelee:6}},
  out_quick: {slot:'out',  max:6,  fx:{quickMelee:3}},
  dur_std:   {slot:'dur',  max:9,  fx:{block:2}},
  dur_armor: {slot:'dur',  max:14, fx:{}},
  dur_react: {slot:'dur',  max:9,  fx:{startBlock:8}},
  mob_std:   {slot:'mob',  max:6,  fx:{startDelay:2, delayedDelay:1}},
  mob_feed:  {slot:'mob',  max:6,  fx:{startHand:2}},
  mob_dash:  {slot:'mob',  max:5,  fx:{zeroDelay:1}},
};
DATA.startParts = {calc:'calc_std', arm:'arm_rail', out:'out_std', dur:'dur_std', mob:'mob_std'};
// 本体耐久の最大値
DATA.bodyMax = 50;
