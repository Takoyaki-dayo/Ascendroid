// カード
// cost: かかるサイクル / tgt: 敵1体を対象にとる / all: 敵全員が対象
// dmg: {t:'phys'(物理) | 'opt'(光学), n:ダメージ, x:回数}
// block: ブロック量 / delay: ディレイ量 / swift: スウィフト量 / crack: クラック量
// atomic: アトミック(中断されない) / src: このカードを加えるパーツの部位(デフラグで消せない)
window.DATA = window.DATA || {};
DATA.cards = {
  jab:      {name:'ジャブ',           cost:1, tgt:true, dmg:{t:'phys', n:3}},
  rapid:    {name:'速射',             cost:1, tgt:true, dmg:{t:'phys', n:1, x:2}},
  slash:    {name:'スラッシュ',       cost:2, tgt:true, dmg:{t:'phys', n:7}},
  blow:     {name:'過負荷打撃',       cost:4, tgt:true, dmg:{t:'phys', n:16}},
  charge:   {name:'チャージショット', cost:3, tgt:true, atomic:true, dmg:{t:'opt', n:8}, src:'arm'},
  emp:      {name:'EMPパルス',        cost:3, all:true, dmg:{t:'opt', n:4}},
  crackshot:{name:'亀裂弾',           cost:2, tgt:true, dmg:{t:'opt', n:2}, crack:2},
  guard:    {name:'障壁展開',         cost:1, block:4},
  wall:     {name:'防御姿勢',         cost:2, block:9},
  hack:     {name:'遅延ハック',       cost:1, tgt:true, delay:2},
  backflow: {name:'逆流',             cost:2, all:true, delay:2},
  overclock:{name:'オーバークロック', cost:1, swift:3},
};

// 最初のデッキ
DATA.startDeck = ['jab','jab','jab','slash','slash','blow','guard','guard','guard','hack','hack','charge','charge'];

// キーワードの説明(カードの長押しで出る)
DATA.keywords = {
  'ブロック':'X分だけ部位へのダメージを減らす。全部位にかかり、使い切るまで残る。',
  'ディレイ':'対象の次の行動をXサイクル遅らせる。',
  'スウィフト':'自分だけXサイクル加速する。その間、敵の予定は進まない。',
  'クラック':'受けるダメージ+X。消えずに残る。',
  'アトミック':'被弾しても中断されない。',
};
