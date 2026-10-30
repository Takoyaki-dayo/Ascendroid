// カード(名前と効果の文は text/cards.csv。キーワードの説明は text/keywords.csv)
// 時間の基準: 手札は3サイクルごとに1枚届く。コスト3が「標準」(使っても手札の枚数が変わらない)
//   コスト0 即時(時間を使わず、1枚だけ減る) / 1〜2 速い(手札が減る) / 3 標準 / 4以上 重い(手札がたまる)
// cost: かかるサイクル / tgt: 敵のユニット1つを対象にとる / all: 敵のすべてのユニットが対象
// dmg: {t:'melee'(近接) | 'ranged'(遠隔), n:ダメージ, x:回数}(0.17.0 までの物理と光学)
// block: ブロック / delay: ディレイ / crack: クラック / draw: 引く枚数
// timer: {t:何サイクル後, dmg:{...}} 時限。使った後、t サイクルたつと対象に効果
// parry: JUST(使い終えたサイクルに敵の行動が重なる)なら、その攻撃を無効にして同じダメージを返す
// atomic: アトミック(中断されない)
// (0.29.0〜0.30.0) dot:{n:回数, p:威力} 持続を与える / ward:{w, s} 防壁(w サイクルの間、合計 s までのダメージを防ぐ) / exile: 使うと廃棄(この戦闘の間戻らない)
//   breakNext: 対象の敵の次の行動をブレイク / discard: 使い終えた後、手札を選んで捨てる枚数 / grow: この戦闘の間、同じカードのダメージ+ / scrapBreak: このカードでユニットを破壊したときのスクラップ
// gain: 充電を得る / spend: 充電をすべて消費し、1につき {dmg:{t, n}} のダメージ、または block のブロック(アーキタイプ「充電」)
window.DATA = window.DATA || {};
DATA.cards = {
  flick:    {cost:0, tgt:true, dmg:{t:'melee', n:2}},
  scan:     {cost:0, tgt:true, crack:1, draw:1},
  jab:      {cost:1, tgt:true, dmg:{t:'melee', n:4}},
  guard:    {cost:1, block:5},
  hack:     {cost:1, tgt:true, delay:3},
  reload:   {cost:1, draw:2},
  timebomb: {cost:1, tgt:true, timer:{t:4, dmg:{t:'ranged', n:12}}},
  rapid:    {cost:2, tgt:true, dmg:{t:'melee', n:2, x:2}},
  crackshot:{cost:2, tgt:true, dmg:{t:'ranged', n:2}, crack:1},
  parry:    {cost:2, block:3, parry:true},
  slash:    {cost:3, tgt:true, dmg:{t:'melee', n:8}},
  wall:     {cost:2, ward:{w:6, s:14}},
  backflow: {cost:3, all:true, delay:6},
  scatter:  {cost:3, all:true, dmg:{t:'ranged', n:4}},
  charge:   {cost:4, tgt:true, atomic:true, dmg:{t:'ranged', n:10}},
  emp:      {cost:4, all:true, dmg:{t:'ranged', n:5}},
  blow:     {cost:6, tgt:true, dmg:{t:'ranged', n:20}},
  // 充電(貯めて消費する)
  capacitor:{cost:1, gain:4},
  arc:      {cost:2, tgt:true, dmg:{t:'melee', n:4}, gain:2},
  coil:     {cost:1, gain:2, draw:1},
  storm:    {cost:4, all:true, spend:{n:3, dmg:{t:'ranged', n:16}}},
  cell:     {cost:1, spend:{block:4}},
  // 0.31.0: 工房で作られたカード(名前はユーザー)
  dismantle:{cost:4, tgt:true, dmg:{t:'melee', n:15}, scrapBreak:6},
  tempest:  {cost:3, all:true, dmg:{t:'ranged', n:1, x:7}},
  paradox:  {cost:0, tgt:true, crack:3, breakNext:true, exile:true},
  iterate:  {cost:1, tgt:true, dmg:{t:'melee', n:0, x:2}, grow:1},
  triple:   {cost:3, tgt:true, dmg:{t:'melee', n:6, x:3}},
  dispose:  {cost:2, tgt:true, dmg:{t:'melee', n:15}, discard:1},
  // 敵のノイズ注入で山札に混ざる。何もせず、使うと消える(ショップや学習には出ない)
  noise:    {cost:1, junk:true},
};

// 最初のデッキ(0.21.1 で基本カードだけ+遅延ハック1枚に。方向はカードの入手で決まる)。パーツが加えるカードは別(武装の《電磁投射》2枚が足される)
DATA.startDeck = ['jab','jab','jab','jab','guard','guard','guard','guard','slash','hack'];

// 珍しいカード(イベントの報酬)
DATA.rareCards = ['blow','parry','emp','scan','tempest','paradox'];
