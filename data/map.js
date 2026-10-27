// 地図と、戦闘以外の部屋(エリア・部屋・道の名前は text/terms.csv、イベントの文は text/events.csv)
// areas(0.19.0): 1周は3エリア。エリアごとに
//   rooms: 部屋数(ボスを除く) / transfers: 乗り換えの場所。[3, 6] は部屋3の後と部屋6の後に隣の道へ移れる
//   last: 最後の部屋(ボスの手前)。全部の道で同じ
//   scale: 敵の強さの倍率。hp は耐久と回復、d は攻撃・ガード・装甲・構えの値
//   tiers: 通常戦に出る遭遇の段。[最初の乗り換えまで, それ以降]
//   boss: ボスの遭遇
//   エリア2・3 の敵は今は仮(エリア1 の敵の強化版)。名前も仮
// lanes: 道の性格。rooms は部屋2〜(最後の1つ前)の中身(部屋1は必ず通常戦、最後は last)
//   battle 通常戦 / elite エリート / rest 整備 / shop ショップ / event イベント
// 生成の決まり(js/engine.js の genMap)
//   エリートは部屋3以降 / エリート・整備・ショップは同じ道で続けて出ない
//   どの道から最初の乗り換えをしても、次の乗り換えまでに整備かショップへ行ける
// transit: エリアの間の中継。heal は本体の回復(最大の割合)。choices はそのエリア固有のイベント(今は仮)
// rewards: スクラップ(お金)の量
// shop: 値段。price はカードのコスト別
// events: イベント。fx の中身
//   body 本体の増減 / scrap スクラップ / card 'rare' で珍しいカード1枚 / repair 損傷を修復
//   part 'random' でパーツの候補を出す / defrag カードを1枚消す
window.DATA = window.DATA || {};
DATA.areas = [
  {id:'a1', rooms:8, transfers:[3, 6], last:'rest', scale:{hp:1, d:1},       tiers:[[1], [1, 2]], boss:'boss'},
  {id:'a2', rooms:8, transfers:[3, 6], last:'rest', scale:{hp:1.1, d:1.05}, tiers:[[1, 2], [2]], boss:'boss2'},
  {id:'a3', rooms:8, transfers:[3, 6], last:'rest', scale:{hp:1.2, d:1.1},   tiers:[[2], [2]],    boss:'boss3'},
];
DATA.lanes = {
  learn:   {rooms:{battle:4, event:1, shop:1}},
  salvage: {rooms:{battle:2, elite:2, rest:1, event:1}},
  supply:  {rooms:{battle:2, elite:1, rest:1, shop:1, event:1}},
};
DATA.transit = [
  {id:'lift',  heal:0.5, choices:[{fx:{repair:true}}, {fx:{card:'rare'}}, {fx:{scrap:40}}]},
  {id:'relay', heal:0.5, choices:[{fx:{part:'random'}}, {fx:{defrag:true}}, {fx:{body:10}}]},
];
DATA.rooms = {
  battle:{}, elite:{}, rest:{}, shop:{}, event:{}, boss:{},
};
DATA.rewards = {scrapStart:20, battle:12, elite:25};
DATA.shop = {price:{0:18, 1:18, 2:26, 3:30, 4:36, 6:44}, defrag:30, repairCost:25, repairBody:12, offers:3};
DATA.events = [
  {id:'terminal',
    choices:[{fx:{body:-6, card:'rare'}}, {fx:{}}]},
  {id:'coolant',
    choices:[{fx:{repair:true, body:6}}, {fx:{scrap:20}}]},
  {id:'wreck',
    choices:[{fx:{part:'random'}}, {fx:{defrag:true}}]},
  {id:'cache',
    choices:[{fx:{body:-4, scrap:30}}, {fx:{scrap:10}}]},
];
