// キャラ(クラス)ごとの違い
// 敵・タイムライン・部位などは全キャラ共通。キャラごとに変えるのは、手札の補給の型と、カードの数値(いずれはカードの集合そのもの)
// econ: 手札の補給の型(js/engine.js の RULE.econ)。null は「3サイクルごとに1枚届く」
//   reload: 自動では引かず、好きなときに r サイクル使って手札を全部捨て hand 枚引く。blockReset:'start' なら始めにブロックをすべて失う
//   turn: len サイクルごとに区切り、手札を捨てて hand 枚引く。ブロックも消える
// wait: true なら手札があっても1サイクル待機できる(右下の下段のボタン)
// cards: そのキャラでのカードの数値(data/cards.js の値を置き換える。パーツの補正の前の値)
//   dmg: ダメージ / block: ブロック / timer: 時限のダメージ / per: 充電1あたりの値(spend)
//   難しさは敵を変えずにここで揃える(tools/lab/k7tune.js: 標準デッキ+固定手順の損傷が常時供給と同じになるよう探した)
window.DATA = window.DATA || {};
DATA.classes = {
  // 既定のキャラ。リフレッシュ2・5枚。コスト2以下は時間に比例する強さ(常時供給の約0.78倍)、コスト3以上は約1.55倍
  k7: {name:'K-7', sys:'リフレッシュ', econ:{type:'reload', r:2, hand:5, blockReset:'end'}, wait:false,
    cards:{flick:{dmg:3}, jab:{dmg:3}, guard:{block:4}, timebomb:{timer:9}, rapid:{dmg:4}, crackshot:{dmg:3}, parry:{block:2},
      slash:{dmg:15}, scatter:{dmg:5}, charge:{dmg:16}, emp:{dmg:8}, blow:{dmg:40},
      arc:{dmg:5}, cell:{per:3}}},
  // 仮: 戦時規格の機体の候補(0.8 までの K-7 と同じ補給と数値)
  war: {name:'戦時規格(仮)', sys:'常時供給', econ:null, wait:true, cards:{}},
  // 仮: 固定ターンの機体の候補。コスト2以下は約0.75倍、コスト3以上は約1.5倍
  turn: {name:'固定ターン(仮)', sys:'固定ターン', econ:{type:'turn', len:6, hand:5, blockReset:true}, wait:true,
    cards:{flick:{dmg:2}, jab:{dmg:3}, guard:{block:4}, timebomb:{timer:9}, rapid:{dmg:2}, crackshot:{dmg:2}, parry:{block:2},
      slash:{dmg:12}, scatter:{dmg:6}, charge:{dmg:15}, emp:{dmg:8}, blow:{dmg:30},
      arc:{dmg:3}, cell:{per:3}}},
};
DATA.defaultClass = 'k7';
// カード c(のコピー)にキャラの数値 o を当てる。index.html・tools/sim.js・tools/datadoc.js が使う
DATA.classCard = (c, o) => {
  if(!o) return c;
  if(o.dmg != null && c.dmg) c.dmg.n = o.dmg;
  if(o.block != null && c.block != null) c.block = o.block;
  if(o.timer != null && c.timer) c.timer.dmg.n = o.timer;
  if(o.per != null && c.spend){ if(c.spend.dmg) c.spend.dmg.n = o.per; if(c.spend.block != null) c.spend.block = o.per; }
  return c;
};
