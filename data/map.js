// 地図と、戦闘以外の部屋(エリア・部屋・道の名前は text/terms.csv、イベントの文は text/events.csv)
// areas(0.19.0): 1周は3エリア。エリアごとに
//   rooms: 部屋数(ボスを除く) / transfers: 乗り換えの場所。[2, 4, 6] は部屋2・4・6の後に隣の列へ移れる
//   fill: 部屋2〜(最後の1つ前)の中身の合計(3列ぶん)。列ごとの性格(道)は 0.21.0 でなくした
//   last: 最後の部屋(ボスの手前)。全部の道で同じ
//   scale: 敵の強さの倍率。hp は耐久と回復、d は攻撃・ガード・装甲・構えの値
//   pools(0.23.0、仮): 通常戦に出る遭遇の組。警戒度が at 以上のうちいちばん後の組から選ぶ。
//     工場がこちらに気付くほど、持ち場の機械から、こちらを追うための機械へ入れ替わっていく(猟犬は追跡の組)
//   boss: ボスの遭遇
//   エリア2・3 の敵は今は仮(エリア1 の敵の強化版)。名前も仮
// 部屋1は必ず通常戦、最後は last。部屋の種類:
//   battle 通常戦 / elite エリート / rest 整備 / shop ショップ / event イベント / duct 保守通路(何も起きないが警戒が下がる)
// 生成の決まり(js/engine.js の genMap)
//   エリートは部屋3以降 / エリート・整備・ショップ・保守通路は同じ列で続けて出ない
//   どの列にも整備かショップが1つ以上 / 同じ縦の並びに同じ特別な部屋は2つまで / どの列も通常戦は2〜4
// transit: エリアの間の中継。heal は本体の回復(最大の割合)。choices はそのエリア固有のイベント(今は仮)
// alert(0.20.0): 警戒度。工場が侵入者に気付いていく度合い。1周を通して積み上がり、エリアをまたいでも下がらない
//   ゲージ per 目盛りで1段上がる。段は I〜X(max)。1周でおよそ X、1エリアでおよそ3段の想定
//   gain: 区画を終えたときのゲージの増減(区画の種類ごと)。イベントは選択肢の fx.alert
//   enemy: 段が1上がるごとの敵の倍率の上乗せ(hp 耐久・回復、d 攻撃など)。I が基準
//   scrap: 段が1上がるごとの戦闘の報酬のスクラップの上乗せ
//   learnAt: この段から学習の候補が1枚増える / partAt: この段から鹵獲の候補が1つ増える
// rewards: スクラップ(お金)の量
// shop: 値段。price はカードのコスト別
// events: イベント。fx の中身
//   body 本体の増減 / scrap スクラップ / card 'rare' で珍しいカード1枚 / repair 損傷を修復
//   part 'random' でパーツの候補を出す / defrag カードを1枚消す / alert 警戒のゲージの増減
window.DATA = window.DATA || {};
DATA.areas = [
  {id:'a1', rooms:8, transfers:[2, 4, 6], last:'rest', fill:{battle:8, elite:3, event:3, shop:2, rest:1, duct:1}, scale:{hp:1, d:1}, boss:'boss',
    pools:[{at:1, enc:['n_guard', 'n_scout', 'n_def', 'n_scav', 'n_crush']},
           {at:2, enc:['n_scan', 'n_swarm', 'n_clock', 'n_weld', 'n_twin', 'n_crush']},
           {at:3, enc:['n_hound', 'n_proc', 'n_accel', 'n_bomb', 'n_squad', 'n_net']}]},
  {id:'a2', rooms:8, transfers:[2, 4, 6], last:'rest', fill:{battle:8, elite:3, event:3, shop:2, rest:1, duct:1}, scale:{hp:1, d:1}, boss:'boss2',
    pools:[{at:1, enc:['n_scan', 'n_swarm', 'n_clock', 'n_weld', 'n_twin', 'n_crush']},
           {at:5, enc:['n_proc', 'n_accel', 'n_bomb', 'n_squad', 'n_net', 'n_clock', 'n_weld']},
           {at:6, enc:['n_hound', 'n_proc', 'n_bomb', 'n_squad', 'n_net', 'n_weld']}]},
  {id:'a3', rooms:8, transfers:[2, 4, 6], last:'rest', fill:{battle:8, elite:3, event:3, shop:2, rest:1, duct:1}, scale:{hp:1.05, d:1}, boss:'boss3',
    pools:[{at:1, enc:['n_proc', 'n_accel', 'n_bomb', 'n_squad', 'n_net', 'n_clock', 'n_weld']},
           {at:9, enc:['n_hound', 'n_squad', 'n_bomb', 'n_net', 'n_proc']}]},
];
DATA.transit = [
  {id:'lift',  heal:0.5, choices:[{fx:{repair:true}}, {fx:{card:'rare'}}, {fx:{scrap:40}}]},
  {id:'relay', heal:0.5, choices:[{fx:{part:'random'}}, {fx:{defrag:true}}, {fx:{alert:-4}}]},
];
DATA.rooms = {
  battle:{}, elite:{}, rest:{}, shop:{}, event:{}, duct:{}, boss:{},
};
DATA.alert = {max:10, per:4, gain:{battle:2, elite:3, boss:3, duct:-3}, enemy:{hp:0.02, d:0.015}, scrap:0.1, learnAt:5, partAt:8};
DATA.rewards = {scrapStart:20, battle:12, elite:25};
DATA.shop = {price:{0:18, 1:18, 2:26, 3:30, 4:36, 6:44}, defrag:30, repairCost:25, repairBody:12, offers:3};
DATA.events = [
  {id:'terminal',
    choices:[{fx:{body:-6, card:'rare', alert:2}}, {fx:{}}]},
  {id:'coolant',
    choices:[{fx:{repair:true, body:6}}, {fx:{scrap:20}}]},
  {id:'wreck',
    choices:[{fx:{part:'random'}}, {fx:{defrag:true}}]},
  {id:'cache',
    choices:[{fx:{scrap:40, alert:3}}, {fx:{scrap:10}}]},
];
