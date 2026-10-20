// 部位とパーツ
// slots: 体の部位。id は内部名、fn は画面に出す名前、pt は体の場所
// parts: 付け替えられるパーツ。slot がはまる部位、max が部位耐久、text が効果の説明
//   fx は効果の中身(index.html ではなく js/engine.js が読む)
//     justCrack  JUSTで溜め技を潰すと、その敵にクラック
//     justSwift  JUSTで溜め技を潰すと、スウィフト
//     handMax    手札の上限に足す
//     opt / phys 光学 / 物理の威力に足す
//     quickPhys  コスト2以下の物理に足す
//     heavyPhys  コスト4以上の物理に足す
//     block      ブロックを得るときに足す
//     startBlock / startSwift / startHand  戦闘開始時に得る
//     delayedSwift  自分がディレイされたときに得るスウィフト
//     zeroSwift  コスト0のカードを使うと得るスウィフト
//     cards      デッキに加えるカード(デフラグで消せない)
// startParts: 最初に付いているパーツ
window.DATA = window.DATA || {};
DATA.slots = [
  {id:'calc', fn:'演算', pt:''},
  {id:'arm',  fn:'武装', pt:''},
  {id:'out',  fn:'出力', pt:'腕部'},
  {id:'dur',  fn:'耐久', pt:'基体'},
  {id:'mob',  fn:'機動', pt:'脚部'},
];
DATA.parts = {
  calc_std:  {slot:'calc', name:'〘標準演算核〙',         max:5,  text:'JUSTで溜め技を潰すと、その敵にクラック1。', fx:{justCrack:1}},
  calc_par:  {slot:'calc', name:'〘並列演算核〙',         max:5,  text:'手札の上限+1。', fx:{handMax:1}},
  calc_pre:  {slot:'calc', name:'〘予測演算核〙',         max:4,  text:'JUSTで溜め技を潰すと、スウィフト3。', fx:{justSwift:3}},
  arm_rail:  {slot:'arm',  name:'〘CXR34レールガン〙',     max:6,  text:'光学威力+2。《チャージショット》2枚をデッキに加える。', fx:{opt:2, cards:['charge','charge']}},
  arm_scat:  {slot:'arm',  name:'〘散弾ポッド〙',         max:6,  text:'光学威力+1。《散弾》2枚をデッキに加える。', fx:{opt:1, cards:['scatter','scatter']}},
  arm_time:  {slot:'arm',  name:'〘時限投射機〙',         max:5,  text:'光学威力+1。《時限弾》2枚をデッキに加える。', fx:{opt:1, cards:['timebomb','timebomb']}},
  out_std:   {slot:'out',  name:'〘汎用マニピュレータ〙', max:7,  text:'物理威力+2。', fx:{phys:2}},
  out_heavy: {slot:'out',  name:'〘重機アーム〙',         max:8,  text:'コスト4以上の物理威力+6。', fx:{heavyPhys:6}},
  out_quick: {slot:'out',  name:'〘高速アクチュエータ〙', max:6,  text:'コスト2以下の物理威力+3。', fx:{quickPhys:3}},
  dur_std:   {slot:'dur',  name:'〘標準フレーム〙',       max:9,  text:'ブロックを得るとき、+2。', fx:{block:2}},
  dur_armor: {slot:'dur',  name:'〘装甲フレーム〙',       max:14, text:'この部位の耐久が高い。', fx:{}},
  dur_react: {slot:'dur',  name:'〘反応装甲〙',           max:9,  text:'戦闘開始時、ブロック8。', fx:{startBlock:8}},
  mob_std:   {slot:'mob',  name:'〘デトロイト噴射機構〙', max:6,  text:'戦闘開始時、スウィフト3。自分がディレイされたとき、スウィフト2。', fx:{startSwift:3, delayedSwift:2}},
  mob_feed:  {slot:'mob',  name:'〘給弾リンク〙',         max:6,  text:'戦闘開始時の手札+2。', fx:{startHand:2}},
  mob_dash:  {slot:'mob',  name:'〘瞬発スラスタ〙',       max:5,  text:'コスト0のカードを使うと、スウィフト1。', fx:{zeroSwift:1}},
};
DATA.startParts = {calc:'calc_std', arm:'arm_rail', out:'out_std', dur:'dur_std', mob:'mob_std'};
// 本体耐久の最大値
DATA.bodyMax = 50;
