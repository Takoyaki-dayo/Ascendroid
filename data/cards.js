// カード
// 時間の基準: 手札は3サイクルごとに1枚届く。コスト3が「標準」(使っても手札の枚数が変わらない)
//   コスト0 即時(時間を使わず、1枚だけ減る) / 1〜2 速い(手札が減る) / 3 標準 / 4以上 重い(手札がたまる)
// cost: かかるサイクル / tgt: 敵1体を対象にとる / all: 敵全員が対象
// dmg: {t:'phys'(物理) | 'opt'(光学), n:ダメージ, x:回数}
// block: ブロック / delay: ディレイ / swift: スウィフト / crack: クラック / draw: 引く枚数
// timer: {t:何サイクル後, dmg:{...}} 時限。使った後、t サイクルたつと対象に効果
// parry: ぴったり(敵の行動と同じサイクル)で使い終わると、その攻撃を無効にして同じダメージを返す
// atomic: アトミック(中断されない)
window.DATA = window.DATA || {};
DATA.cards = {
  flick:    {name:'瞬撃',             cost:0, tgt:true, dmg:{t:'phys', n:2}},
  scan:     {name:'スキャン',         cost:0, tgt:true, crack:1, draw:1},
  jab:      {name:'ジャブ',           cost:1, tgt:true, dmg:{t:'phys', n:4}},
  guard:    {name:'障壁展開',         cost:1, block:5},
  hack:     {name:'遅延ハック',       cost:1, tgt:true, delay:3},
  overclock:{name:'オーバークロック', cost:1, swift:4},
  reload:   {name:'再装填',           cost:1, draw:2},
  timebomb: {name:'時限弾',           cost:1, tgt:true, timer:{t:4, dmg:{t:'opt', n:12}}},
  rapid:    {name:'速射',             cost:2, tgt:true, dmg:{t:'phys', n:2, x:2}},
  crackshot:{name:'亀裂弾',           cost:2, tgt:true, dmg:{t:'opt', n:2}, crack:2},
  parry:    {name:'受け流し',         cost:2, block:3, parry:true},
  slash:    {name:'スラッシュ',       cost:3, tgt:true, dmg:{t:'phys', n:8}},
  wall:     {name:'防御姿勢',         cost:3, block:10},
  backflow: {name:'逆流',             cost:3, all:true, delay:4},
  scatter:  {name:'散弾',             cost:3, all:true, dmg:{t:'opt', n:4}},
  charge:   {name:'チャージショット', cost:4, tgt:true, atomic:true, dmg:{t:'opt', n:10}},
  emp:      {name:'EMPパルス',        cost:4, all:true, dmg:{t:'opt', n:5}},
  blow:     {name:'過負荷打撃',       cost:6, tgt:true, dmg:{t:'phys', n:20}},
};

// 最初のデッキ(パーツが加えるカードは別。武装の《チャージショット》2枚が足される)
DATA.startDeck = ['jab','jab','rapid','slash','slash','guard','guard','wall','hack','reload','scan'];

// 珍しいカード(イベントの報酬)
DATA.rareCards = ['blow','parry','timebomb','emp','overclock','scatter'];

// キーワードの説明(カードの長押しで出る)
DATA.keywords = {
  'ブロック':'X分だけ部位へのダメージを減らす。全部位にかかり、使い切るまで残る。',
  'ディレイ':'対象の次の行動をXサイクル遅らせる。',
  'スウィフト':'自分だけXサイクル加速する。その間、敵の予定も手札の到着も進まない。',
  'クラック':'受けるダメージ+X。消えずに残る。',
  'アトミック':'被弾しても中断されない。',
  '時限':'使ってからXサイクル後に効果が出る。',
  'ぴったり':'敵の行動と同じサイクルに使い終わること。',
};
