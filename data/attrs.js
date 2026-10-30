// カードの属性(0.28.0)。Wildfrost のお守りに近いが、数値を足すのではなくカードの形(ヒットごと・発動・JUST)に反応する
// カードに1つだけ付き、カードの名前の頭に属性の名前が付く(「◯◯された連撃」)。名前と文は text/attrs.csv(名前はユーザーが付ける)
// 属性付きのカードはキー「元のキー@属性のキー」で DATA.cards に登録する(attrCard)。エンジンと画面はふつうのカードとして扱う
//
// 属性の形: {on, fx}
//   on: 'hit' ヒットごと(ダメージが当たるたび。時限・充電の消費のダメージも) / 'cast' 発動したとき / 'just' JUST のとき
//   fx: crack 当たった(狙った)ユニットにクラック / delay 対象の敵にディレイ / gain 充電を得る / block ブロックを得る / draw カードを引く
//       again もう1回当たる(on:'hit' のときだけ。2回目には属性は働かない)
// 付けられるかは「働くかどうか」だけで決まる(attrOk): ヒットごとはダメージを与えるカードだけ、クラック・ディレイは狙う相手のいるカードだけ、など
// 具体的な属性はまだ入れていない(0.28.0 は仕組みだけ)。カード工房の「属性」タブで作り、試遊で試せる
window.DATA = window.DATA || {};
DATA.attrs = {};
// 手に入れ方: battle 通常の戦闘の報酬で、候補1枚ごとに属性が付く確率 / elite エリートの報酬は必ず付く / shop ショップに並ぶ属性の数と値段
DATA.attrRule = {battle:0.2, elite:1, shop:1, price:40};

DATA.attrSplit = k => { const i = String(k).indexOf('@'); return i < 0 ? [k, null] : [k.slice(0, i), k.slice(i + 1)]; };
// 属性が働くか(付けられるか)
DATA.attrOk = (c, a) => {
  const A = DATA.attrs[a]; if(!A || !c || c.junk || c.attr) return false;
  const f = A.fx || {}, hits = !!(c.dmg || (c.spend && c.spend.dmg) || c.timer), aim = !!(c.tgt || c.all);
  if(A.on === 'hit' && !hits) return false;
  if(f.again && A.on !== 'hit') return false;
  if((f.crack || f.delay) && A.on !== 'hit' && !aim) return false;
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
  if(!out.length) return '';
  const head = A.on === 'hit' ? 'ヒットごとに、' : A.on === 'just' ? 'JUST：' : '';
  return head + out.join('。') + '。';
};
// 属性付きのカードの定義を作る。c は元のカード(キャラの数値を当てたもの)
DATA.attrCard = (c, a) => {
  const A = DATA.attrs[a], o = JSON.parse(JSON.stringify(c));
  o.attr = a; o.name = (A && A.name || '') + (c.name || ''); o.attrText = DATA.attrText(a);
  return o;
};
// キー k(「元@属性」)のカードを cards に登録する。登録できなければ false
DATA.regAttrCard = (cards, k) => {
  const [base, a] = DATA.attrSplit(k);
  if(!a) return !!cards[k];
  if(!cards[base] || !DATA.attrs[a]) return false;
  cards[k] = DATA.attrCard(cards[base], a);
  return true;
};
