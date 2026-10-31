// データ一覧の資料(Claude Docs)に載せる表を data/*.js から作る。出力は節ごとの markdown を入れた JSON
// 使い方: node tools/datadoc.js > out.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for(const f of ['parts','cards','enemies','map','classes','attrs','text']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../data', f + '.js'), 'utf8'), ctx);
const D = ctx.DATA, SL = Object.fromEntries(D.slots.map(s => [s.id, s]));
const ver = (fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').match(/APP_VERSION = '([\d.]+)'/) || [])[1];
const out = {};
const K = D.classes[D.defaultClass];
out.intro = `バージョン ${ver} のゲームの中身をまとめた一覧です。数値などの元データはリポジトリの data フォルダ、名前や説明などの文章は text フォルダの CSV にあり、ゲームが変わるたびにここも作り直します。敵は全キャラ共通で、キャラごとに変わるのは手札の補給の型・待機の有無・カードの数値です(下の「キャラ」の節)。最初のキャラは${K.name}(補給は「リフレッシュ」: 手札は自動では届かず、好きなときに${K.econ.r}サイクル使って手札を全部捨てて${K.econ.hand}枚引く。リフレッシュ中もブロックは残り、新しい手札が来ると消える。待機なし)。`;
const withCls = (c, o) => o ? D.classCard(JSON.parse(JSON.stringify(c)), o) : c;
const fxCards = Object.values(D.parts).filter(p => p.fx.cards);
out.parts = `## 部位とパーツ\n\n本体耐久は${D.bodyMax}。部位が壊れるとそのパーツの効果が止まり、あふれたダメージは本体に通ります。★が最初に付いているパーツで、ほかはエリートや一部のイベントで付け替えられます。\n\n| 部位 | 場所 | パーツ | 耐久 | 効果 |\n| --- | --- | --- | --- | --- |\n` +
  D.slots.flatMap(s => Object.entries(D.parts).filter(([, p]) => p.slot === s.id).map(([id, p]) => `| ${s.fn} | ${s.pt || '—'} | ${D.startParts[s.id] === id ? '★' : ''}${p.name} | ${p.max} | ${p.text} |`)).join('\n');
const tname = t => t === 'melee' ? '近接' : '遠隔';
// カードの文(text/cards.csv の型)に、パーツの補正の前の数値を入れる
const eff = c => { const v = {dmg: c.dmg ? c.dmg.n : '', x: c.dmg && c.dmg.x || '', block: c.block ?? '', delay: c.delay || '', swift: c.swift || '', crack: c.crack || '', draw: c.draw || '', t: c.timer ? c.timer.t : '', tdmg: c.timer ? c.timer.dmg.n : '', gain: c.gain || '', per: c.spend ? (c.spend.dmg ? c.spend.dmg.n : c.spend.block) : '', sn: c.spend && c.spend.n || '', sv: c.spend && c.spend.n ? (c.spend.dmg ? c.spend.dmg.n : c.spend.block) : '', dn: c.dot ? c.dot.n : '', dp: c.dot ? c.dot.p : '', ww: c.ward ? c.ward.w : '', ws: c.ward ? c.ward.s : '', discard: c.discard || '', grow: c.grow || '', scrap: c.scrapBreak || '', sc: c.selfCrack || '', amp: c.amp ? c.amp.n : '', sd: c.selfDmg || '', cn: c.dotCut ? c.dotCut.n || 0 : '', cp: c.dotCut ? c.dotCut.p || 0 : '', wk: c.justWeak || ''}; return (c.text || '').replace(/\{(\w+)\}/g, (m, n) => n in v ? v[n] : m).replace(/\n/g, ' '); };
const RN = {starter:'初期', common:'コモン', uncommon:'アンコモン', rare:'レア'};
const zone = c => c === 0 ? '即時' : c < 3 ? '速い' : c === 3 ? '標準' : '重い';
const learn = k => [...new Set(Object.values(D.foes).filter(f => (f.pool || []).includes(k)).map(f => f.name))].join('、');
const cnt = k => D.startDeck.filter(x => x === k).length;
const fromPart = k => fxCards.filter(p => p.fx.cards.includes(k)).map(p => p.name).join('、');
out.cards = `## カード\n\n全部${Object.values(D.cards).filter(c => !c.junk).length}種。最初のデッキは${D.startDeck.length}枚と、武装パーツが加える《電磁投射》2枚。種類は近接か遠隔(0.17.0 までの物理と光学)。数値はパーツの補正(標準パーツなら近接+1、遠隔+1、ブロック+1)を足す前の値です。「効果」は${K.name}での数値、「基準」は data/cards.js の値(常時供給のキャラはこのまま)。報酬とショップはカード1枚ごとにレア度を引いてから選びます(通常戦 コモン60・アンコモン37・レア3、エリート 50・40・10、ショップ 54・37・9。報酬のレアはコモンを出すたびに1ずつ出やすくなり、レアが出ると戻る)。初期のカードは報酬に出ません。\n\n| カード | コスト | 区分 | 種類 | 効果 | 基準 | 備考 | レア度 | 最初のデッキ | 手に入る場所 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n` +
  Object.entries(D.cards).filter(([, c]) => !c.junk).sort((a, b) => a[1].cost - b[1].cost).map(([k, c]) => `| ${c.name} | ${c.cost} | ${zone(c.cost)} | ${c.dmg ? tname(c.dmg.t) : c.timer ? tname(c.timer.dmg.t) : c.spend && c.spend.dmg ? tname(c.spend.dmg.t) : '—'} | ${eff(withCls(c, K.cards[k]))} | ${eff(withCls(c, K.cards[k])) !== eff(c) ? eff(c) : '同じ'} | ${[fromPart(k) ? fromPart(k) + 'が加える' : ''].filter(Boolean).join('、') || '—'} | ${RN[D.rarityOf(k)]} | ${cnt(k) ? cnt(k) + '枚' : '—'} | ${D.rarityOf(k) === 'starter' ? '—' : [fromPart(k) ? '' : '学習' + (learn(k) ? '(' + learn(k) + 'でわずかに出やすい)' : ''), D.rareCards.includes(k) ? 'イベント' : '', fromPart(k) ? '' : 'ショップ'].filter(Boolean).join('、')} |`).join('\n');
out.kw = `## キーワード\n\nカードを長押ししたときや、説明の文の中のキーワードを押したときに出る文です。カードの文に出てくるものは色が付きます。\n\n| キーワード | 意味 |\n| --- | --- |\n` + Object.entries(D.keywords).map(([k, v]) => `| ${k} | ${v} |`).join('\n');
const attrs = a => [a.steal ? `スクラップを${a.steal}盗む` : '', a.eat ? `手札のいちばん重いカードを${a.eat}枚飲み込む` : '', a.rebuild ? `破壊されたユニットを耐久${a.rebuild}で直す` : '', a.flee ? '逃げる' : '', a.hits > 1 ? `${a.hits}回` : '', a.wind ? `体勢${a.wind.w}/${a.wind.poise}` : '', a.guard ? `防壁${a.guard.w}/${a.guard.s}` : '', a.counter ? `反撃${a.counter.w}/${a.counter.d}` : '', a.rec ? `隙${a.rec}` : '', a.buff ? `増幅+${a.buff}${a.all ? '(全員)' : ''}` : '', a.armor ? `ブロック+${a.armor}` : '', a.heal ? `修復${a.heal}` : '', a.crack ? `こちらにクラック+${a.crack}` : '', a.noise ? `ノイズ${a.noise}枚` : '', a.haste ? `加速${a.haste}` : '', a.zone ? `射界(${a.zone.at}後から${a.zone.len}サイクル、${a.zone.d}→${SL[a.zone.p].fn})` : '', a.summon ? `増援(${D.foes[a.summon].name})` : ''].filter(Boolean).join('、');
// ユニットが複数ある敵: 耐久はユニットごと(急所・核)
const hpText = f => f.units ? Object.values(f.units).map(p => `${p.name} ${p.hp}${p.core ? '(核)' : p.vital ? '(急所)' : ''}${p.armor ? `・ブロック${p.armor}` : ''}`).join('、') : f.hp;
let CURF = null;
const act = a => {
  const at = attrs(a), base = a.kind === 'delay' ? `${a.n}(自分にディレイ${a.v})` : a.d > 0 ? `${a.n} ${a.d}→${SL[a.p].fn}` : a.n;
  const who = a.by && CURF && CURF.units && CURF.units[a.by] ? `[${CURF.units[a.by].name}]` : '';
  return `${who}${a.ch ? '**' : ''}${base}${a.ch ? '(不安定)**' : ''}${at ? `〔${at}〕` : ''}`;
};
const pat = f => f.ai === 'rand' ? 'どれか: ' + f.pat.map(a => `${act(a)}(${a.dl}後、重み${a.wt || 1})`).join(' / ') : f.pat.map((a, i) => (i ? ` →${a.dl}→ ` : '') + act(a)).join('') + ` →${f.pat[0].dl}→ 最初へ`;
const patAll = f => (CURF = f, '') + pat(f) + Object.entries(f.broke || {}).map(([k, pt]) => ` ／ ${f.units[k].name}が破壊されると: ${pat({pat:pt})}`).join('') + (f.phase ? ` ／ 耐久${Math.round(f.phase.at * 100)}%未満: ${pat({pat:f.phase.pat})}` : '');
// パッシブ: 名前(text/enemies.csv の 敵.passive.*)と、文(text/terms.csv の ui.pas.*)。画面と同じく反応・段階変化も含める
const fillT = (k, v) => (D.ui['pas.' + k] || '').replace(/\{(\w+)\}/g, (m, n) => n in v ? v[n] : m);
const trait = f => { const nm = f.pname || {}, out = [];
  (f.passives || []).forEach((p, j) => out.push(`${nm[j] || ''}: ${p.k === 'command' ? fillT('command', {unit: f.units[p.unit].name, n: p.n}) : p.k === 'frenzy' ? fillT('frenzy', {n: p.n}) : fillT(p.k, {n: p.n || 1})}`));
  if(f.react) out.push(`${nm.react || f.react.n}: ${fillT('react', {min: f.react.min, part: SL[f.react.p].fn, d: f.react.d})}`);
  if(f.phase) out.push(`${nm.phase || ''}: ${fillT('phase', {at: Math.round(f.phase.at * 100)})}`);
  if(f.sync) out.push(`連携: 同じサイクルに攻撃すると+${f.sync}`);
  return out.join(' ／ ') || '—'; };
out.foes = `## 敵\n\n行動は左から順に繰り返します(「どれか」の敵は重みで選び、先の行動まで決めておいてタイムラインに出します。同じ行動は3回続けません)。「→6→」は次の行動までのサイクル、「射撃 6→演算」は演算部位への6ダメージ。不安定な行動は、同じサイクルにカードでダメージを与えるとブレイクできます(JUSTか時限)。〔〕は行動の属性: 体勢w/数字(行動の前のwサイクルに、一度に数字以上のダメージを受けるとブレイク)、防壁w/数字(前のwサイクル、数字までダメージを防ぐ)、反撃w/数字(前のwサイクル、攻撃を受けるたびに数字を返す)、隙(行動の後、数字のサイクルだけダメージ1.5倍)、増幅(行動の後に攻撃のダメージが上がる)、ブロック(敵のブロックは消えずに積もる)、修復、こちらにクラック(こちらが受ける攻撃すべて+数字、重なる)、ノイズ(山札に何もしないカードを混ぜる)、加速(これ以後、行動のコストが数字だけ縮む。下限は敵のパッシブ)、射界(こちらのタイムラインに区間を置き、その間にカードが発動すると被弾)。敵は1つ以上のユニットでできていて、耐久と状態(クラック・隙・ブロック)はユニットごと。カードでユニットを狙えます。[ ]はその行動をするユニットで、体勢・防壁・反撃はそのユニットを叩いたときだけ効きます。ユニットが破壊されるとそのユニットの行動は飛ばされ、あふれたダメージは核へ。急所のユニットがすべて破壊されると撃破です。パッシブは敵ごとの常に働く性質です。敵の強さは全キャラ共通です。\n\n| 敵 | 耐久 | 最初の行動まで | 行動パターン | パッシブ | 学習でわずかに出やすいカード |\n| --- | --- | --- | --- | --- | --- |\n` +
  Object.entries(D.foes).filter(([, f]) => f.hp || f.units).map(([k, f]) => `| ${f.name}${['drone2','linkB'].includes(k) ? '(別個体)' : ''} | ${hpText(f)} | ${f.start} | ${patAll(f)} | ${trait(f)} | ${f.pool.map(x => D.cards[x].name).join('、') || '—'} |`).join('\n');
const baseNum = (c, o) => o.dmg != null ? c.dmg.n : o.block != null ? c.block : o.timer != null ? c.timer.dmg.n : c.spend.dmg ? c.spend.dmg.n : c.spend.block;
const sysText = c => !c.econ ? '3サイクルごとに手札が1枚届く' : c.econ.type === 'reload' ? `自動では引かない。好きなときに${c.econ.r}サイクル使って手札を全部捨て${c.econ.hand}枚引く(${c.econ.blockReset === 'start' ? '始めにブロックをすべて失う' : 'ブロックはリフレッシュ中も残り、新しい手札が来ると消える'})` : `${c.econ.len}サイクルごとに手札を捨てて${c.econ.hand}枚引く(ブロックも消える)`;
out.classes = `## キャラ\n\n敵・タイムライン・部位は全キャラ共通。キャラごとに手札の補給の型とカードの数値を変え、難しさはカードの数値で揃えます(敵は変えない)。数値は「標準デッキを決まった手順で使ったときの損傷が、常時供給のキャラと同じくらい」になるよう探した値(tools/lab/k7tune.js)。待機は手札があっても1サイクル待てるボタン。仮のキャラはデバッグメニューで選べます。\n\n| キャラ | 補給 | 補給の決まり | 待機 | カードの数値(基準から変えたもの) |\n| --- | --- | --- | --- | --- |\n` +
  Object.values(D.classes).map(c => `| ${c.name} | ${c.sys} | ${sysText(c)} | ${c.econ && c.econ.type === 'turn' ? 'あり(区切りまで待つも)' : c.wait ? 'あり' : 'なし'} | ${Object.entries(c.cards).filter(([k, o]) => JSON.stringify(withCls(D.cards[k], o)) !== JSON.stringify(D.cards[k])).map(([k, o]) => `${D.cards[k].name} ${o.dmg ?? o.block ?? o.timer ?? o.per}(${baseNum(D.cards[k], o)})`).join('、') || '基準のまま'} |`).join('\n');
// 通常戦の出る所(0.23.0): エリアごとの警戒度の組。「エリア1 I〜, II〜」の形
const where = k => D.areas.map((A, i) => { const ps = A.pools.filter(p => p.enc.includes(k)); return ps.length ? `エリア${i + 1} ${ps.map(p => ROMAN[p.at - 1] + '〜').join('・')}` : ''; }).filter(Boolean).join(' ／ ') || '—';
const encRow = ([k, e]) => `| ${e.boss ? 'ボス' : e.elite ? 'エリート' : '通常戦'} | ${e.fam} | ${e.boss ? 'エリア' + (D.areas.findIndex(A => A.boss === k) + 1) + (e.scale ? `(さらに耐久×${e.scale.hp}・攻撃×${e.scale.d})` : '') : e.elite ? '—' : where(k)} | ${e.foes.map(f => D.foes[f].name).join('、')} |`;
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
const poolText = A => A.pools.map(p => `${ROMAN[p.at - 1]}〜: ${p.enc.map(k => D.encounters[k].foes.map(f => D.foes[f].name).join('・')).join('、')}`).join(' ／ ');
out.map = `## 地図と部屋\n\n1周は${D.areas.length}エリア。1エリアは${D.areas[0].rooms}部屋+ボスで、入口で3本の列から1本を選び、部屋${D.areas[0].transfers.join('・')}の後に隣の列へ乗り換えられます。ボスの手前の部屋はどの列も${D.rooms[D.areas[0].last].name}。地図は毎回シード値から作ります。部屋に入るたび・地図に戻るたびに自動で保存し、タイトルの「つづきから」で再開します(戦闘の途中でやめると、その戦闘のはじめから)。\n\n生成の決まり: 列ごとの性格(道)はなく、エリアの中身を部屋2〜7に散らす。部屋1は必ず通常戦、エリートは部屋3以降、エリート・整備・ショップ・保守通路・イベントは同じ列で続けて出ない、どの列にも整備かショップがある、同じ縦の並びに同じ特別な部屋は2つまで、どの列も部屋2〜7の通常戦は2〜4。\n\n| エリア | 名前 | 敵の強さ(耐久・攻撃の倍率) | 通常戦の敵(警戒度ごとの組) | ボス |\n| --- | --- | --- | --- | --- |\n` +
  D.areas.map((A, i) => `| ${i + 1} | ${A.name}(仮) | ×${A.scale.hp} ・ ×${A.scale.d} | ${poolText(A)} | ${D.encounters[A.boss].foes.map(f => D.foes[f].name).join('、')} |`).join('\n') +
  `\n\nエリア2・3 の敵とボスは仮(エリア1 の敵を倍率で強くしたもの)。\n\n部屋2〜${D.areas[0].rooms - 1}の中身(3列の合計): ${Object.entries(D.areas[0].fill).map(([t, n]) => `${D.rooms[t].name}${n}`).join('、')}。` +
  `\n\n| 部屋 | 系統 | 出る所 | 敵 |\n| --- | --- | --- | --- |\n` + Object.entries(D.encounters).map(encRow).join('\n') +
  `\n\n報酬とお店: 最初のスクラップ${D.rewards.scrapStart}、通常戦+${D.rewards.battle}、エリート+${D.rewards.elite}(学習のあとにパーツの付け替え)。ショップはカード${D.shop.offers}枚(コスト0〜1が${D.shop.price[1]}、2が${D.shop.price[2]}、3が${D.shop.price[3]}、4が${D.shop.price[4]}、6が${D.shop.price[6]})、デフラグ${D.shop.defrag}、修理${D.shop.repairCost}(本体+${D.shop.repairBody}・損傷を修復)。整備は修理(本体+15・損傷を修復)かデフラグ。\n\n| イベント | 選択肢 |\n| --- | --- |\n` +
  D.events.map(e => `| ${e.title} | ${e.choices.map(c => `${c.label}: ${c.sub}`).join(' ／ ')} |`).join('\n') +
  `\n\nエリアの間の中継: 本体を最大の${Math.round(D.transit[0].heal * 100)}%回復し、そのエリア固有のイベント(今は仮)。\n\n| 中継 | 選択肢 |\n| --- | --- |\n` +
  D.transit.map((e, i) => `| エリア${i + 1}→${i + 2}: ${e.title} | ${e.choices.map(c => `${c.label}: ${c.sub}`).join(' ／ ')} |`).join('\n') +
  `\n\n### 警戒度\n\n工場がこちらに気付いている度合い。1周を通して積み上がり、エリアをまたいでも下がらない。ゲージが${D.alert.per}目盛りたまるごとに1段上がり、段は I〜${ROMAN[D.alert.max - 1]}(1周でおよそ ${ROMAN[D.alert.max - 1]}、1エリアでおよそ3段の想定)。区画を終えたときにゲージが増減する: ${Object.entries(D.alert.gain).map(([k, v]) => `${D.rooms[k].name}${v > 0 ? '+' : '−'}${Math.abs(v)}`).join('、')}、イベントは選択肢しだい。通常戦の敵は区画に入ったときに決め、エリアの組のうち、今の警戒度で入るいちばん後の組から出る(持ち場の機械から、こちらを追う機械へ入れ替わっていく。組は仮)。\n\n| 段が1上がるごと | 決まった段から |\n| --- | --- |\n| 敵の耐久+${+(D.alert.enemy.hp * 100).toFixed(1)}%・攻撃+${+(D.alert.enemy.d * 100).toFixed(1)}%、戦闘のスクラップ+${Math.round(D.alert.scrap * 100)}% | ${ROMAN[D.alert.learnAt - 1]}から学習の候補+1枚、${ROMAN[D.alert.partAt - 1]}から鹵獲の候補+1つ |`;
const cond = {bodyLow:'本体が最大の4割未満', partBroken:'破損した部位がある', chargeSoon:'9サイクル以内に不安定な行動が来る', vulnNow:'隙を見せている敵がいる', windNow:'体勢の窓にいる(もうすぐ入る)敵がいる', handEmpty:'手札がない', partWorn:'前の戦闘の損傷が残っている', focus:'見えている攻撃が1つの部位に合計10以上'};
out.lines = `## セリフ\n\n下スワイプの内側画面で${D.lines.speaker}が話す独り言です。上から順に条件を調べ、最初に当てはまったものを出します(文が複数あればランダムで1つ)。{part}{enemy}{move}{t}{poise} には部位名、敵の名前、技の名前、残りサイクル、ブレイクに要る一撃が入ります。\n\n| 優先 | 条件 | セリフ |\n| --- | --- | --- |\n` +
  D.lines.rules.map((r, i) => `| ${i + 1} | ${cond[r.when]} | ${r.text.join(' / ')} |`).join('\n') + `\n\nどれにも当てはまらないときは、部屋の種類ごとの一言を出します。\n\n| 部屋 | 一言 |\n| --- | --- |\n` + Object.entries(D.lines.room).map(([k, v]) => `| ${D.rooms[k].name} | ${v.join(' / ')} |`).join('\n');
process.stdout.write(JSON.stringify(out));
