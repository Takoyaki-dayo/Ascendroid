// カードの属性(0.28.0)。Wildfrost のお守りに近いが、数値を足すのではなくカードの形(ヒットごと・発動・JUST)に反応する
// カードに1つだけ付き、カードの名前の頭に属性の名前が付く(「◯◯された連撃」)。名前と文は text/attrs.csv(名前はユーザーが付ける)
// 属性付きのカードはキー「元のキー@属性のキー」で DATA.cards に登録する(attrCard)。エンジンと画面はふつうのカードとして扱う
//
// 属性の形: {on, fx}
//   on: 'hit' ヒットごと(ダメージが当たるたび。時限・充電の消費のダメージも) / 'cast' 発動したとき / 'just' JUST のとき / 'break' このカードで敵の行動をブレイクしたとき(0.33.0)
//   fx: crack 当たった(狙った)ユニットにクラック / delay 対象の敵にディレイ / gain 充電を得る / block ブロックを得る / draw カードを引く
//       again もう1回当たる(on:'hit' のときだけ。2回目には属性は働かない)
//       dotn・dotp 侵食(持続)の回数・威力を与える / heal 本体の耐久を回復する(0.33.0)
//       all 敵のすべてのユニットにダメージ / exile このカードを廃棄にする(0.35.0)
//   on:'mod' カードそのものを変える(0.35.0): dmgUp ダメージの値(複数回なら1回あたり)+ / atomic アトミックにする
//       mod の文はカードには足さない(数値に入っているため)。atomic だけは文の頭に属性の文を付ける
// 付けられるかは「働くかどうか」だけで決まる(attrOk): ヒットごとはダメージを与えるカードだけ、クラック・ディレイは狙う相手のいるカードだけ、など
// 属性はカード工房の「属性」タブで作り、試遊で試せる。確定したものをここに入れる(0.35.0 から)
window.DATA = window.DATA || {};
DATA.attrs = {
  // 0.35.0: 工房で確定した属性(名前と文は text/attrs.csv)
  gnaw:  {on:'hit', fx:{dotp:1}},
  regen: {on:'cast', fx:{heal:2}},
};
// 手に入れ方: battle 通常の戦闘の報酬で、候補1枚ごとに属性が付く確率 / elite エリートの報酬は必ず付く / shop ショップに並ぶ属性の数と値段
DATA.attrRule = {battle:0.2, elite:1, shop:1, price:40};

DATA.attrSplit = k => { const i = String(k).indexOf('@'); return i < 0 ? [k, null] : [k.slice(0, i), k.slice(i + 1)]; };
// 属性が働くか(付けられるか)
DATA.attrOk = (c, a) => {
  const A = DATA.attrs[a]; if(!A || !c || c.junk || c.attr) return false;
  const f = A.fx || {}, hits = !!(c.dmg || (c.spend && c.spend.dmg) || c.timer), aim = !!(c.tgt || c.all);
  if(A.on === 'hit' && !hits) return false;
  if(A.on === 'break' && !hits && !c.breakNext) return false;
  if(f.again && A.on !== 'hit') return false;
  if(f.exile && c.exile) return false;
  if(f.atomic && c.atomic) return false;
  if(f.dmgUp && !hits) return false;
  if((f.dmgUp || f.atomic) && A.on !== 'mod') return false;
  if((f.crack || f.delay || f.dotn || f.dotp) && A.on !== 'hit' && A.on !== 'break' && !aim) return false;
  return Object.values(f).some(v => v);
};
// 属性の効果の文(text/attrs.csv に文が無ければ数値から作る)
DATA.attrText = a => {
  const A = DATA.attrs[a]; if(!A) return '';
  if(A.text) return A.text.replace(/\{(\w+)\}/g, (m, n) => n in (A.fx || {}) ? A.fx[n] : m);
  const f = A.fx || {}, out = [];
  if(f.crack) out.push(`クラック${f.crack}を与える`);
  if(f.delay) out.push(`ディレイ${f.delay}を与える`);
  if(f.gain) out.push(`充電${f.gain}を得る`);
  if(f.block) out.push(`${f.block}ブロックを得る`);
  if(f.draw) out.push(`カードを${f.draw}枚引く`);
  if(f.again) out.push('もう1回当たる');
  if(f.dotn || f.dotp) out.push(`侵食${f.dotn || 0}/${f.dotp || 0}を与える`);
  if(f.heal) out.push(`耐久を${f.heal}回復する`);
  if(f.exile) out.unshift('廃棄');
  if(f.all) out.push(`敵のすべてのユニットに${f.all}ダメージを与える`);
  if(f.atomic) out.push('アトミック');
  if(f.dmgUp) out.push(`このカードのダメージを${f.dmgUp}増加させる`);
  if(!out.length) return '';
  const head = A.on === 'hit' ? 'ヒットごとに、' : A.on === 'just' ? 'JUST：' : A.on === 'break' ? 'ブレイクしたとき、' : '';
  return head + out.join('。') + '。';
};
// 属性付きのカードの定義を作る。c は元のカード(キャラの数値を当てたもの)
DATA.attrCard = (c, a) => {
  const A = DATA.attrs[a], o = JSON.parse(JSON.stringify(c));
  o.attr = a; o.name = (A && A.name || '') + (c.name || ''); o.attrText = DATA.attrText(a);
  const f = (A && A.fx) || {};
  if(f.exile) o.exile = true;
  if(A && A.on === 'mod'){
    o.attrText = '';
    if(f.dmgUp) for(const d of [o.dmg, o.timer && o.timer.dmg, o.spend && o.spend.dmg]) if(d) d.n += f.dmgUp;
    if(f.atomic){ o.atomic = true; o.text = DATA.attrText(a) + (o.text || ''); }
  }
  return o;
};
// キー k(「元@属性」)のカードを cards に登録する。登録できなければ false
// 0.36.0: 強化したカード(「元+」「元+@属性」)もここで登録する(強化の後に属性)
DATA.regAttrCard = (cards, k) => {
  const [b0, a] = DATA.attrSplit(k), up = b0.endsWith('+'), base = up ? b0.slice(0, -1) : b0;
  if(!cards[base] || cards[base].upgraded) return false;
  if(up) cards[b0] = DATA.upCard(cards[base], base);
  if(!a) return !!cards[k];
  if(!DATA.attrs[a]) return false;
  cards[k] = DATA.attrCard(cards[b0], a);
  return true;
};
// 属性のレア度(0.36.0、工房のレア度)。書いていない属性はコモン。報酬で属性を付けるときは、レア度を引いてからその中で選ぶ
DATA.attrRarity = {gnaw:'common', regen:'uncommon'};
DATA.attrRarityOf = a => DATA.attrRarity[a] || 'common';
