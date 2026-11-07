// 地図と、戦闘以外の部屋(エリア・部屋・道の名前は text/terms.csv、イベントの文は text/events.csv)
// areas(0.19.0): 1周は3エリア。エリアごとに
//   rooms: 部屋数(ボスを除く) / transfers: 乗り換えの場所。[2, 4, 6] は部屋2・4・6の後に隣の列へ移れる
//   fill: 部屋2〜(最後の1つ前)の中身の合計(3列ぶん)。列ごとの性格(道)は 0.21.0 でなくした
//   last: 最後の部屋(ボスの手前)。全部の道で同じ
//   scale: 敵の強さの倍率。hp は耐久と回復、d は攻撃・ガード・装甲・構えの値
//   pools(0.44.0): 通常戦に出る遭遇の組。区画の深さ(列の番号。0 が最初の区画)が from 以上のうちいちばん後の組から選ぶ。
//     工場がこちらに気付くほど、持ち場の機械から、こちらを追うための機械へ入れ替わっていく(猟犬は追跡の組)
//   boss: ボスの遭遇
//   エリア2・3 の敵は今は仮(エリア1 の敵の強化版)。名前も仮
// 部屋1は必ず通常戦、最後は last。部屋の種類:
//   battle 通常戦 / elite エリート / rest 整備 / shop ショップ / event イベント / duct 保守通路(何も起きないが警戒が下がる)
// 生成の決まり(js/engine.js の genMap)
//   エリートは部屋3以降 / エリート・整備・ショップ・保守通路は同じ列で続けて出ない
//   どの列にも整備かショップが1つ以上 / 同じ縦の並びに同じ特別な部屋は2つまで / どの列も通常戦は2〜4
// transit: エリアの間の中継。heal は本体の回復(最大の割合)。choices はそのエリア固有のイベント(今は仮)
// heat(0.44.0): 警戒。相対値で、ゲージ(−10〜+10)を5段(−2〜+2)で見せる。暴れると上がり、何もしなければ冷める
//   gain: 区画を終えたときに足す量(区画の種類ごと。イベントは選択肢の fx.alert) / cool: 区画ごとに冷める量 / decay: 0 へ寄せる割合(行き過ぎ防止)
//   th: 段の境目(±th[0] で ±1、±th[1] で ±2) / carry: エリアの移り目でゲージに掛ける倍率
//   scrap: 段ごとの戦闘のスクラップの増減 / cards: 段ごとの学習の候補 {n 枚数, r: low コモンが出やすい / high アンコモンが出やすい}
//   rar: low・high のときのレア度の重みの倍率 / parts: 段ごとの鹵獲の候補の増減
//   boost: 警戒版の無い敵が +1・+2 で受ける上乗せ / plus2: 「+」しか無い敵が +2 で受ける上乗せ(どちらも会話Bが作るまでの仮)
// rewards: スクラップ(お金)の量
// shop: 値段。price はカードのコスト別
// events: イベント。fx の中身
//   body 本体の増減 / scrap スクラップ / card 'rare' で珍しいカード1枚 / repair 損傷を修復
//   part 'random' でパーツの候補を出す / defrag カードを1枚消す / alert 警戒のゲージの増減(0.44.0 から相対値の熱)
//   partDamage ランダムな部位を n か所損傷させる / rerollParts すべての部位のパーツをランダムに付け替える(パーツのレア度の重みで。0.36.0)
window.DATA = window.DATA || {};
// 0.42.0: エリアを区画12+ボスに(8から1.5倍)。乗り換えは区画3・6・9の後。整備は択一になったので、配分の整備は増やさない(ボス前の整備と、道の中の1つ)
DATA.areas = [
  {id:'a1', rooms:12, transfers:[3, 6, 9], last:'rest', fill:{battle:14, elite:5, event:5, shop:3, rest:1, duct:2}, scale:{hp:1, d:1}, boss:'boss',
    // 0.44.0: 組は区画の深さで決める(前半 0〜3・中盤 4〜7・後半 8〜11)。前の警戒I・II・III の組を読み替えた(仮。会話Bが見直す)
    pools:[{from:0, enc:['n_guard', 'n_scout', 'n_def', 'n_scav', 'n_crush']},
           {from:4, enc:['n_scan', 'n_swarm', 'n_clock', 'n_weld', 'n_twin', 'n_crush', 'n_guard', 'n_def']},
           {from:8, enc:['n_hound', 'n_proc', 'n_accel', 'n_bomb', 'n_squad', 'n_net', 'n_guard', 'n_def']}]},
  {id:'a2', rooms:12, transfers:[3, 6, 9], last:'rest', fill:{battle:14, elite:5, event:5, shop:3, rest:1, duct:2}, scale:{hp:1, d:1}, boss:'boss2',
    // 0.45.2: クロックポリスの敵が入り始めた(ビルディングクラッシャー・住民生産ライン・不可避のトラム)。トラムは即死級なので区画4から
    pools:[{from:0, enc:['n2_demol', 'n2_fact', 'n_scan', 'n_swarm', 'n_clock', 'n_weld']},
           {from:4, enc:['n2_demol', 'n2_fact', 'n2_tram', 'n_accel', 'n_bomb', 'n_squad', 'n_net']},
           {from:8, enc:['n2_demol', 'n2_fact', 'n2_tram', 'n_hound', 'n_bomb', 'n_squad']}]},
  {id:'a3', rooms:12, transfers:[3, 6, 9], last:'rest', fill:{battle:14, elite:5, event:5, shop:3, rest:1, duct:2}, scale:{hp:1.05, d:1}, boss:'boss3',
    pools:[{from:0, enc:['n_proc', 'n_accel', 'n_bomb', 'n_squad', 'n_net', 'n_clock', 'n_weld']},
           {from:6, enc:['n_hound', 'n_squad', 'n_bomb', 'n_net', 'n_proc']}]},
];
DATA.transit = [
  {id:'lift',  heal:0.5, choices:[{fx:{repair:true}}, {fx:{card:'rare'}}, {fx:{scrap:40}}]},
  {id:'relay', heal:0.5, choices:[{fx:{part:'random'}}, {fx:{defrag:true}}, {fx:{alert:-4}}]},
  // 0.40.3: 解放(工房のイベント)。受け入れると《解放》、拒絶するとボス・カード報酬を2回
  {id:'release', heal:0.5, choices:[{fx:{card:'release'}}, {fx:{bossCards:2}}]},
];
// 中継(transit)は、ボスを倒した後にまだ出ていないものからランダムに1つ出る(0.40.3。前はエリアごとに決まっていた)
DATA.rooms = {
  battle:{}, elite:{}, rest:{}, shop:{}, event:{}, duct:{}, boss:{},
};
DATA.heat = {gain:{battle:1.5, elite:4, boss:2, duct:-2}, cool:1.2, decay:0.04, min:-10, max:10, th:[2, 5], carry:0.5,
  scrap:{'-2':-0.3, '-1':-0.2, '0':0, '1':0.15, '2':0.3},
  cards:{'-2':{n:2, r:'low'}, '-1':{n:3, r:'low'}, '0':{n:3}, '1':{n:3, r:'high'}, '2':{n:4, r:'high'}},
  rar:{low:{common:1.5, uncommon:0.7, rare:0.7}, high:{common:0.7, uncommon:1.5, rare:1}}, parts:{'2':1},
  boost:{'1':{hp:0.1, d:0.05}, '2':{hp:0.2, d:0.1}}, plus2:{hp:0.15, d:0.1}};
// restHeal: 整備で必ず回復する量(0.36.0。部位の損傷も直す) / boss: ボスを倒したときの報酬(回復と、属性付きのレアのカードを cards 枚から1枚。仮の値)
DATA.rewards = {scrapStart:20, battle:12, elite:25, restHeal:15, boss:{heal:15, cards:3}};
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
  // 0.36.0: 工房で文で作ったイベント(タイトル・文はユーザー)
  {id:'plea',
    choices:[{fx:{body:-15, partDamage:1, scrap:25}}, {fx:{}}]},
  {id:'overhaul',
    choices:[{fx:{rerollParts:true}}, {fx:{}}]},
];
