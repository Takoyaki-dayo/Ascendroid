// 地図と、戦闘以外の部屋
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
DATA.area = {name:'エリア1', rooms:5, transferAfter:2};
DATA.lanes = {
  learn:   {name:'学習', rooms:{battle:3, event:1, shop:1}},
  salvage: {name:'鹵獲', rooms:{battle:2, elite:1, rest:1, event:1}},
  supply:  {name:'補給', rooms:{battle:2, rest:1, shop:1, event:1}},
};
DATA.rooms = {
  battle:{name:'通常戦'}, elite:{name:'エリート'}, rest:{name:'整備'}, shop:{name:'ショップ'}, event:{name:'イベント'}, boss:{name:'ボス'},
};
DATA.rewards = {scrapStart:20, battle:12, elite:25};
DATA.shop = {price:{0:18, 1:18, 2:26, 3:30, 4:36, 6:44}, defrag:30, repairCost:25, repairBody:12, offers:3};
DATA.events = [
  {id:'terminal', title:'放棄された端末', text:'まだ電源が生きている。',
    choices:[{label:'接続する', sub:'本体−6・珍しいカードを1枚', fx:{body:-6, card:'rare'}}, {label:'立ち去る', sub:'何もしない', fx:{}}]},
  {id:'coolant', title:'冷却液の漏れ', text:'配管から冷却液が滴っている。',
    choices:[{label:'浴びる', sub:'損傷を修復・本体+6', fx:{repair:true, body:6}}, {label:'回収する', sub:'スクラップ+20', fx:{scrap:20}}]},
  {id:'wreck', title:'同型機の残骸', text:'自分と同じ型番が刻まれている。',
    choices:[{label:'部品を取る', sub:'パーツの候補を見る', fx:{part:'random'}}, {label:'記録を消す', sub:'カードを1枚消去', fx:{defrag:true}}]},
  {id:'cache', title:'封鎖された倉庫', text:'錆びた扉の奥に、何かが積まれている。',
    choices:[{label:'こじ開ける', sub:'本体−4・スクラップ+30', fx:{body:-4, scrap:30}}, {label:'隙間から探る', sub:'スクラップ+10', fx:{scrap:10}}]},
];
