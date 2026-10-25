// カード(名前と効果の文は text/cards.csv。キーワードの説明は text/keywords.csv)
// 時間の基準: 手札は3サイクルごとに1枚届く。コスト3が「標準」(使っても手札の枚数が変わらない)
//   コスト0 即時(時間を使わず、1枚だけ減る) / 1〜2 速い(手札が減る) / 3 標準 / 4以上 重い(手札がたまる)
// cost: かかるサイクル / tgt: 敵1体を対象にとる / all: 敵全員が対象
// dmg: {t:'phys'(物理) | 'opt'(光学), n:ダメージ, x:回数}
// block: ブロック / delay: ディレイ / swift: スウィフト / crack: クラック / draw: 引く枚数
// timer: {t:何サイクル後, dmg:{...}} 時限。使った後、t サイクルたつと対象に効果
// parry: JUST(使い終えたサイクルに敵の行動が重なる)なら、その攻撃を無効にして同じダメージを返す
// atomic: アトミック(中断されない)
// gain: 充電を得る / spend: 充電をすべて消費し、1につき {dmg:{t, n}} のダメージ、または block のブロック(アーキタイプ「充電」)
window.DATA = window.DATA || {};
DATA.cards = {
  flick:    {cost:0, tgt:true, dmg:{t:'phys', n:2}},
  scan:     {cost:0, tgt:true, crack:1, draw:1},
  jab:      {cost:1, tgt:true, dmg:{t:'phys', n:4}},
  guard:    {cost:1, block:5},
  hack:     {cost:1, tgt:true, delay:3},
  overclock:{cost:1, swift:4},
  reload:   {cost:1, draw:2},
  timebomb: {cost:1, tgt:true, timer:{t:4, dmg:{t:'opt', n:12}}},
  rapid:    {cost:2, tgt:true, dmg:{t:'phys', n:2, x:2}},
  crackshot:{cost:2, tgt:true, dmg:{t:'opt', n:2}, crack:2},
  parry:    {cost:2, block:3, parry:true},
  slash:    {cost:3, tgt:true, dmg:{t:'phys', n:8}},
  wall:     {cost:3, block:10},
  backflow: {cost:3, all:true, delay:4},
  scatter:  {cost:3, all:true, dmg:{t:'opt', n:4}},
  charge:   {cost:4, tgt:true, atomic:true, dmg:{t:'opt', n:10}},
  emp:      {cost:4, all:true, dmg:{t:'opt', n:5}},
  blow:     {cost:6, tgt:true, dmg:{t:'phys', n:20}},
  // 充電(貯めて消費する)
  capacitor:{cost:1, gain:4},
  arc:      {cost:2, tgt:true, dmg:{t:'phys', n:4}, gain:2},
  coil:     {cost:0, gain:2, draw:1},
  discharge:{cost:3, tgt:true, spend:{dmg:{t:'opt', n:6}}},
  storm:    {cost:4, all:true, spend:{dmg:{t:'opt', n:3}}},
  cell:     {cost:1, spend:{block:4}},
  // 敵のノイズ注入で山札に混ざる。何もせず、使うと消える(ショップや学習には出ない)
  noise:    {cost:1, junk:true},
};

// 最初のデッキ(パーツが加えるカードは別。武装の《チャージショット》2枚が足される)
DATA.startDeck = ['jab','jab','rapid','slash','slash','guard','guard','wall','hack','reload','scan'];

// 珍しいカード(イベントの報酬)
DATA.rareCards = ['blow','parry','timebomb','emp','overclock','scatter'];
