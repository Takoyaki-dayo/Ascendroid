// 部位とパーツ(部位の名前は text/terms.csv、パーツの名前と効果の文は text/parts.csv)
// slots: 体の部位。id は内部名、pt は体の場所
// parts: 付け替えられるパーツ。slot がはまる部位、max が部位耐久
//   fx は効果の中身(index.html ではなく js/engine.js が読む)
//     justCrack  JUSTで溜め技を潰すと、その敵にクラック
//     justDelay  JUSTで溜め技を潰すと、その敵にディレイ
//     handMax    手札の上限に足す
//     ranged / melee  遠隔 / 近接の威力に足す
//     quickMelee コスト2以下の近接に足す
//     heavyMelee コスト4以上の近接に足す
//     block      ブロックを得るときに足す
//     startBlock / startHand  戦闘開始時に得る / startDelay 戦闘開始時、敵にディレイ
//     delayedDelay  自分がディレイされたとき、その敵にディレイ
//     zeroDelay  コスト0のカードを使うと、敵にディレイ
//     heavyRanged コスト4以上の遠隔に足す(0.36.0)
//     drawShift  カードの効果で引いたカードのコストを、1枚ごとに半々で+1か−1(0未満にならない。手札にある間だけ。0.36.0)
//     cards      デッキに加えるカード(デフラグで消せない)
// startParts: 最初に付いているパーツ
window.DATA = window.DATA || {};
DATA.slots = [
  {id:'calc', pt:''},
  {id:'arm',  pt:''},
  {id:'out',  pt:'腕部'},
  {id:'dur',  pt:'基体'},
  {id:'mob',  pt:'脚部'},
];
DATA.parts = {
  calc_std:  {slot:'calc', max:5,  fx:{justCrack:1}},
  calc_par:  {slot:'calc', max:5,  fx:{handMax:1}},
  calc_pre:  {slot:'calc', max:4,  fx:{justDelay:2}},
  arm_rail:  {slot:'arm',  max:6,  fx:{ranged:1, cards:['charge']}},
  arm_scat:  {slot:'arm',  max:6,  fx:{ranged:1, cards:['scatter']}},
  arm_time:  {slot:'arm',  max:5,  fx:{ranged:1, cards:['timebomb']}},
  out_std:   {slot:'out',  max:7,  fx:{melee:1}},
  out_heavy: {slot:'out',  max:8,  fx:{heavyMelee:6}},
  out_quick: {slot:'out',  max:6,  fx:{quickMelee:3}},
  dur_std:   {slot:'dur',  max:9,  fx:{block:1}},
  dur_armor: {slot:'dur',  max:14, fx:{}},
  dur_react: {slot:'dur',  max:9,  fx:{startBlock:8}},
  mob_std:   {slot:'mob',  max:6,  fx:{startDelay:2}},
  mob_feed:  {slot:'mob',  max:6,  fx:{startHand:2}},
  mob_dash:  {slot:'mob',  max:5,  fx:{zeroDelay:1}},
  // 0.36.0: 工房で文で作ったパーツ(名前はユーザー)
  arm_sharp: {slot:'arm',  max:6,  fx:{heavyRanged:5}},
  mob_basil: {slot:'mob',  max:6,  fx:{drawShift:1}},
};
DATA.startParts = {calc:'calc_std', arm:'arm_rail', out:'out_std', dur:'dur_std', mob:'mob_std'};
// パーツのレア度(0.36.0): starter 最初のパーツ(鹵獲・イベントに出ない) / common / uncommon / rare。書いていないパーツはコモン
// 鹵獲・イベントでパーツを出すときは、DATA.rarityRule.part の重みでレア度を引いてから、その中で選ぶ
DATA.partRarity = {calc_std:'starter', arm_rail:'starter', out_std:'starter', dur_std:'starter', mob_std:'starter'};
DATA.partRarityOf = id => DATA.partRarity[id] || 'common';
// パーツの強化(0.38.0): 2段階。段階は部位が持つ(run.slotLv。付け替えても段階はそのまま)。鹵獲で「今のパーツを強化」を選ぶと上がる
// パーツの up:[段階1, 段階2] は、その段階で書き換える欄(基本の値からの置き換え。fx は中身ごと置き換え)。文は text/parts.csv の「テキスト(強化1)」「テキスト(強化2)」
// up に書いていない段階は仮の決まり: 耐久+2ずつ(効果は変わらない)
DATA.partMaxLv = 2;
DATA.partDef = (id, lv) => {
  const b = DATA.parts[id]; if(!b || !lv) return b;
  const u = (b.up || [])[lv - 1], o = Object.assign({}, b, {lv});
  if(u) for(const [k, v] of Object.entries(u)) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v;
  else o.max = b.max + 2 * lv;
  o.name = (b.name || '') + '+'.repeat(lv);
  o.text = (u && u.text) || (b.upText || [])[lv - 1] || b.text;
  delete o.up; delete o.upText;
  return o;
};
// 本体耐久の最大値
DATA.bodyMax = 50;
