// 地図と、戦闘以外の部屋(エリア・部屋・道の名前は text/terms.csv、イベントの文は text/events.csv)
// area: 1エリアの部屋数(ボスを除く)。乗り換えは部屋 transferAfter の後に、隣の道へ1回だけ
// lanes: 道の性格。rooms は5部屋の中身(部屋1は必ず通常戦)
//   battle 通常戦 / elite エリート / rest 整備 / shop ショップ / event イベント
// 生成の決まり(js/engine.js の genMap)
//   エリートは部屋3以降 / エリート・整備・ショップは同じ道で続けて出ない
//   どの道から乗り換えても、乗り換えた後に整備かショップへ行ける
// rewards: スクラップ(お金)の量
// shop: 値段。price はカードのコスト別
// events: イベント。fx の中身
//   body 本体の増減 / scrap スクラップ / card 'rare' で珍しいカード1枚 / repair 損傷を修復
//   part 'random' でパーツの候補を出す / defrag カードを1枚消す
window.DATA = window.DATA || {};
DATA.area = {rooms:5, transferAfter:2};
DATA.lanes = {
  learn:   {rooms:{battle:3, event:1, shop:1}},
  salvage: {rooms:{battle:2, elite:1, rest:1, event:1}},
  supply:  {rooms:{battle:2, rest:1, shop:1, event:1}},
};
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
