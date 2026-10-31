// カード(名前と効果の文は text/cards.csv。キーワードの説明は text/keywords.csv)
// 時間の基準: 手札は3サイクルごとに1枚届く。コスト3が「標準」(使っても手札の枚数が変わらない)
//   コスト0 即時(時間を使わず、1枚だけ減る) / 1〜2 速い(手札が減る) / 3 標準 / 4以上 重い(手札がたまる)
// cost: かかるサイクル / tgt: 敵のユニット1つを対象にとる / all: 敵のすべてのユニットが対象
// dmg: {t:'melee'(近接) | 'ranged'(遠隔), n:ダメージ, x:回数}(0.17.0 までの物理と光学)
// block: ブロック / delay: ディレイ / crack: クラック / draw: 引く枚数
// timer: {t:何サイクル後, dmg:{...}} 時限。使った後、t サイクルたつと対象に効果
// parry: JUST(使い終えたサイクルに敵の行動が重なる)なら、その攻撃を無効にして同じダメージを返す
// atomic: アトミック(中断されない)
// (0.29.0〜0.33.0) dot:{n:回数, p:威力} 侵食(0.29 の持続)を与える / selfCrack: 自分にクラック / amp:{t, n} 自機の増幅(この戦闘の間) / selfDmg: 自分にダメージ(本体に直接)
//   / ward:{w, s} 防壁(w サイクルの間、合計 s までのダメージを防ぐ) / exile: 使うと廃棄(この戦闘の間戻らない)
//   (0.35.0) instant: インスタント(discard を使い始めたときに行う) / dotCut:{n, p} 対象の侵食を減らす / needDot: 対象の侵食の回数がこれ未満だと使えない
//   justBreak・justWeak: JUST のとき、その敵の行動をブレイクする・虚弱を与える(虚弱: 敵の攻撃のダメージ−、0未満にならない)
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
  emp:      {cost:3, all:true, dmg:{t:'ranged', n:9}},
  blow:     {cost:6, tgt:true, dmg:{t:'ranged', n:20}},
  // 充電(貯めて消費する)
  capacitor:{cost:1, gain:4},
  arc:      {cost:2, tgt:true, dmg:{t:'melee', n:4}, gain:2},
  coil:     {cost:1, gain:2, draw:1},
  storm:    {cost:4, all:true, spend:{n:3, dmg:{t:'ranged', n:16}}},
  cell:     {cost:1, spend:{n:2, block:7}},
  // 0.31.0: 工房で作られたカード(名前はユーザー)
  dismantle:{cost:4, tgt:true, dmg:{t:'melee', n:15}, scrapBreak:6},
  tempest:  {cost:3, all:true, dmg:{t:'ranged', n:1, x:7}},
  paradox:  {cost:0, tgt:true, selfCrack:3, breakNext:true, exile:true},
  iterate:  {cost:1, tgt:true, dmg:{t:'melee', n:0, x:2}, grow:1},
  triple:   {cost:3, tgt:true, dmg:{t:'melee', n:6, x:3}},
  dispose:  {cost:2, tgt:true, dmg:{t:'melee', n:15}, discard:1, instant:true},
  // 0.35.0: 工房で作られたカード(名前はユーザー)
  crush:    {cost:3, tgt:true, dmg:{t:'melee', n:12}, dot:{n:1, p:4}},
  parallel: {cost:1, block:12, selfDmg:4},
  phack:    {cost:2, tgt:true, dotCut:{n:4, p:0}, dot:{n:0, p:3}, needDot:4, up:{rep:2}},
  careful:  {cost:2, tgt:true, dmg:{t:'melee', n:7}, block:5},
  foresight:{cost:3, tgt:true, justBreak:true, justWeak:1},
  // 0.36.0
  aim:      {cost:2, amp:{t:'ranged', n:1}, up:{amp:{t:'ranged', n:2}}},
  // 敵のノイズ注入で山札に混ざる。何もせず、使うと消える(ショップや学習には出ない)
  noise:    {cost:1, junk:true},
};

// 最初のデッキ(0.21.1 で基本カードだけ+遅延ハック1枚に。方向はカードの入手で決まる)。パーツが加えるカードは別(武装の《電磁投射》1枚が足される。0.35.0 で2枚から1枚)
DATA.startDeck = ['jab','jab','jab','jab','guard','guard','guard','guard','slash','hack'];

// 珍しいカード(イベントの報酬)
// レア度(0.32.0、工房のレア度): starter 初期(報酬・ショップに出ない) / common / uncommon / rare。書いていないカードはコモン
DATA.rarity = {
  jab:'starter', guard:'starter', slash:'starter',
  flick:'common', capacitor:'common', coil:'common', iterate:'common', rapid:'common', crackshot:'common', wall:'common', arc:'common', dispose:'common', parallel:'common', careful:'common', foresight:'common', backflow:'common', storm:'common', scatter:'common', charge:'common',
  hack:'uncommon', reload:'uncommon', timebomb:'uncommon', cell:'uncommon', triple:'uncommon', dismantle:'uncommon', crush:'uncommon', phack:'uncommon', aim:'uncommon',
  scan:'rare', paradox:'rare', parry:'rare', tempest:'rare', blow:'rare', emp:'rare',
};
// 出やすさ(StS にならう): 報酬の1枚ごとにレア度を引いてから、そのレア度の中で選ぶ。rare は run.rareOff(はじめ pity.start)を足した値
//   コモンを1枚出すたびに rareOff が pity.step 増え、レアが出ると pity.start に戻る(StS の救済)。price はショップの値段の倍率
DATA.rarityRule = {battle:{common:60, uncommon:37, rare:3}, elite:{common:50, uncommon:40, rare:10}, shop:{common:54, uncommon:37, rare:9},
  pity:{start:-5, step:1}, price:{common:1, uncommon:1.4, rare:2},
  // 0.36.0: パーツ(鹵獲・イベント)と属性(報酬で付くもの)のレア度の重み。救済は無い(仮の値)
  part:{common:60, uncommon:32, rare:8}, attr:{common:65, uncommon:28, rare:7}};
DATA.rarityOf = k => DATA.rarity[String(k).split('@')[0].replace(/\+$/, '')] || 'common';

// 強化(0.36.0): 整備で1枚選んで強化する。強化したカードのキーは「元のキー+」(属性付きは「元+@属性」)、名前の後ろに「+」
// up: 強化した後に書き換える欄(dmg・amp などの組は中身を足し合わせる)。rep: 同じ効果をくり返す回数(今はパラレルハックの侵食だけ)
// up が無いカードは仮の決まりで強くする: ダメージ・ブロック・時限・充電の消費・防壁の量・侵食の威力を ×1.3(切り上げ、最低+1)。
//   どれも無ければ ディレイ・充電を得る・クラック・引く枚数・戦闘中に増える量・虚弱・増幅 のうち最初の1つを+1。それも無ければ自分へのクラックを−1、それも無ければコスト−1
DATA.upCard = (c, k) => {
  const o = JSON.parse(JSON.stringify(c)), up = c.up;
  delete o.up; o.upgraded = true; o.base = k; o.name = (c.name || '') + '+';
  if(up){ for(const [f, v] of Object.entries(up)) o[f] = v && typeof v === 'object' && !Array.isArray(v) && o[f] && typeof o[f] === 'object' ? Object.assign({}, o[f], v) : v;
    if(o.rep > 1 && o.text && !o.text.includes('{rep}')) o.text += 'これを{rep}回行う。';
    return o; }
  let ch = false;
  const bump = (x, f) => { if(x && x[f] > 0){ x[f] = Math.max(x[f] + 1, Math.ceil(x[f] * 1.3)); ch = true; } };
  bump(o.dmg, 'n'); bump(o, 'block'); if(o.timer) bump(o.timer.dmg, 'n'); if(o.spend){ bump(o.spend.dmg, 'n'); bump(o.spend, 'block'); } bump(o.ward, 's'); bump(o.dot, 'p');
  if(!ch) for(const f of ['delay', 'gain', 'crack', 'draw', 'grow', 'justWeak']) if(o[f] > 0){ o[f]++; ch = true; break; }
  if(!ch && o.amp && o.amp.n > 0){ o.amp.n++; ch = true; }
  if(!ch && o.selfCrack > 0){ o.selfCrack--; ch = true; }
  if(!ch && o.cost > 0){ o.cost--; ch = true; }
  return o;
};
// 強化できるか: ノイズ・強化済み・元のカードが無いものはできない
DATA.canUp = (cards, k) => { const [b] = String(k).split('@'); return !b.endsWith('+') && !!cards[b] && !cards[b].junk; };
DATA.upKey = k => { const i = String(k).indexOf('@'); return i < 0 ? k + '+' : k.slice(0, i) + '+' + k.slice(i); };
DATA.rareCards = Object.keys(DATA.rarity).filter(k => DATA.rarity[k] === 'rare');
