// データ一覧の資料(Claude Docs)に載せる表を data/*.js から作る。出力は節ごとの markdown を入れた JSON
// 使い方: node tools/datadoc.js > out.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for(const f of ['parts','cards','enemies','map','lines']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../data', f + '.js'), 'utf8'), ctx);
const D = ctx.DATA, SL = Object.fromEntries(D.slots.map(s => [s.id, s]));
const ver = (fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').match(/APP_VERSION = '([\d.]+)'/) || [])[1];
const out = {};
out.intro = `バージョン ${ver} のゲームの中身をまとめた一覧です。元データはリポジトリの data フォルダ(parts.js / cards.js / enemies.js / map.js / lines.js)にあり、ゲームが変わるたびにここも作り直します。時間の基準は「手札は${3}サイクルごとに1枚届く」(最大7枚、最初は5枚)。`;
const fxCards = Object.values(D.parts).filter(p => p.fx.cards);
out.parts = `## 部位とパーツ\n\n本体耐久は${D.bodyMax}。部位が壊れるとそのパーツの効果が止まり、あふれたダメージは本体に通ります。★が最初に付いているパーツで、ほかはエリートや一部のイベントで付け替えられます。\n\n| 部位 | 場所 | パーツ | 耐久 | 効果 |\n| --- | --- | --- | --- | --- |\n` +
  D.slots.flatMap(s => Object.entries(D.parts).filter(([, p]) => p.slot === s.id).map(([id, p]) => `| ${s.fn} | ${s.pt || '—'} | ${D.startParts[s.id] === id ? '★' : ''}${p.name} | ${p.max} | ${p.text} |`)).join('\n');
const tname = t => t === 'phys' ? '物理' : '光学';
const eff = c => { const s = []; if(c.dmg) s.push(`${c.all ? '敵全員に' : ''}${tname(c.dmg.t)}${c.dmg.n}${c.dmg.x ? '×' + c.dmg.x : ''}`); if(c.timer) s.push(`時限${c.timer.t}: ${tname(c.timer.dmg.t)}${c.timer.dmg.n}`); if(c.crack) s.push('クラック' + c.crack); if(c.delay) s.push(`${c.all ? '敵全員に' : ''}ディレイ${c.delay}`); if(c.block) s.push('ブロック' + c.block); if(c.parry) s.push('ぴったりで攻撃を返す'); if(c.swift) s.push('スウィフト' + c.swift); if(c.draw) s.push(c.draw + '枚引く'); return s.join('、'); };
const zone = c => c === 0 ? '即時' : c < 3 ? '速い' : c === 3 ? '標準' : '重い';
const learn = k => [...new Set(Object.values(D.foes).filter(f => f.pool.includes(k)).map(f => f.name))].join('、');
const cnt = k => D.startDeck.filter(x => x === k).length;
const fromPart = k => fxCards.filter(p => p.fx.cards.includes(k)).map(p => p.name).join('、');
out.cards = `## カード\n\n全部${Object.values(D.cards).filter(c => !c.junk).length}種。最初のデッキは${D.startDeck.length}枚と、武装パーツが加える《チャージショット》2枚。数値はパーツの補正(標準パーツなら物理+2、光学+2、ブロック+2)を足す前の値です。\n\n| カード | コスト | 区分 | 効果 | 備考 | 最初のデッキ | 手に入る場所 |\n| --- | --- | --- | --- | --- | --- | --- |\n` +
  Object.entries(D.cards).filter(([, c]) => !c.junk).sort((a, b) => a[1].cost - b[1].cost).map(([k, c]) => `| ${c.name} | ${c.cost} | ${zone(c.cost)} | ${eff(c)} | ${[c.atomic ? 'アトミック' : '', fromPart(k) ? fromPart(k) + 'が加える' : ''].filter(Boolean).join('、') || '—'} | ${cnt(k) ? cnt(k) + '枚' : '—'} | ${[learn(k) ? '学習: ' + learn(k) : '', D.rareCards.includes(k) ? 'イベント' : '', fromPart(k) ? '' : 'ショップ'].filter(Boolean).join('、')} |`).join('\n');
out.kw = `## キーワード\n\nカードを長押ししたときに出る説明と同じ文です。\n\n| キーワード | 意味 |\n| --- | --- |\n` + Object.entries(D.keywords).map(([k, v]) => `| ${k} | ${v} |`).join('\n');
const attrs = a => [a.hits > 1 ? `${a.hits}回` : '', a.wind ? `構え${a.wind.w}・${a.wind.poise}以上で潰れる` : '', a.guard ? `ガード${a.guard.w}・${a.guard.s}` : '', a.counter ? `反撃の構え${a.counter.w}・${a.counter.d}` : '', a.rec ? `隙${a.rec}` : '', a.buff ? `強化+${a.buff}${a.all ? '(全員)' : ''}` : '', a.armor ? `装甲+${a.armor}` : '', a.heal ? `修復${a.heal}` : '', a.mark ? `照準+${a.mark}` : '', a.noise ? `ノイズ${a.noise}枚` : '', a.summon ? `増援(${D.foes[a.summon].name})` : ''].filter(Boolean).join('、');
const act = a => {
  const at = attrs(a), base = a.kind === 'delay' ? `${a.n}(自分にディレイ${a.v})` : a.d > 0 ? `${a.n} ${a.d}→${SL[a.p].fn}` : a.n;
  return `${a.ch ? '**' : ''}${base}${a.ch ? '(溜め)**' : ''}${at ? `〔${at}〕` : ''}`;
};
const pat = f => f.ai === 'rand' ? 'どれか: ' + f.pat.map(a => `${act(a)}(${a.dl}後、重み${a.wt || 1})`).join(' / ') : f.pat.map((a, i) => (i ? ` →${a.dl}→ ` : '') + act(a)).join('') + ` →${f.pat[0].dl}→ 最初へ`;
const patAll = f => pat(f) + (f.phase ? ` ／ 耐久${Math.round(f.phase.at * 100)}%未満: ${pat({pat:f.phase.pat})}` : '');
const trait = f => [f.react ? `反応: コスト${f.react.min}以上を使い始めると1サイクル後に${f.react.d}→${SL[f.react.p].fn}` : '', f.sync ? `連携: 同じサイクルに攻撃すると+${f.sync}` : ''].filter(Boolean).join('、') || '—';
out.foes = `## 敵\n\n行動は左から順に繰り返します(「どれか」の敵は毎回重みで選びます。同じ行動は3回続けません)。「→6→」は次の行動までのサイクル、「射撃 6→演算」は演算部位への6ダメージ。溜め技はJUSTで潰せます。〔〕は行動の属性: 構え(行動の前のwサイクルに、数字以上の一撃で潰れる)、ガード(前のwサイクル、数字までダメージを防ぐ)、反撃の構え(前のwサイクル、殴られるたびに数字を返す)、隙(行動の後、数字のサイクルだけダメージ1.5倍)、強化(行動の後に攻撃力が上がる)。\n\n| 敵 | 耐久 | 最初の行動まで | 行動パターン | 特性 | 学習で出るカード |\n| --- | --- | --- | --- | --- | --- |\n` +
  Object.entries(D.foes).map(([k, f]) => `| ${f.name}${['drone2','linkB'].includes(k) ? '(別個体)' : ''} | ${f.hp} | ${f.start} | ${patAll(f)} | ${trait(f)} | ${f.pool.map(x => D.cards[x].name).join('、') || '—'} |`).join('\n');
const escRow = ([k, o]) => `| ${D.foes[k].name}${['drone2','linkB'].includes(k) ? '(別個体)' : ''} | ${patAll({...D.foes[k], ...o})} |`;
out.foes += `\n\n### 放置の代償つきの版\n\n補給の型を「固定ターン」「再装填」にしたときに使う行動の並び(デバッグメニューで切り替え)。あわせて敵の攻撃力に倍率がかかり(固定ターン×0.8、再装填2/3/4サイクルで×0.7/0.55/0.45)、コスト2以下のカードの数値はパーツの補正の前に半分になる(強さを時間に比例させる)。〔〕の追加: 装甲(消えずに積もり、ダメージを先に受ける)、修復、照準(こちらが受ける攻撃すべて+数字、重なる)、ノイズ(山札に何もしないカードを混ぜる)、増援(仲間を呼ぶ)。\n\n| 敵 | 行動パターン |\n| --- | --- |\n` + Object.entries(D.foesEsc).map(escRow).join('\n');
const encRow = ([k, e]) => `| ${e.boss ? 'ボス' : e.elite ? 'エリート' : '通常戦'} | ${e.fam} | ${e.boss || e.elite ? '—' : e.tier === 1 ? '部屋1から' : '部屋3から'} | ${e.foes.map(f => D.foes[f].name).join('、')} |`;
out.map = `## 地図と部屋\n\n1エリアは${D.area.rooms}部屋+ボス。入口で3本の道から1本を選び、部屋${D.area.transferAfter}の後に1回だけ隣の道へ乗り換えられます。地図は毎回シード値から作ります。\n\n生成の決まり: 部屋1は必ず通常戦、エリートは部屋3以降、エリート・整備・ショップは同じ道で続けて出ない、どの道から乗り換えても後半に整備かショップがある。\n\n| 道 | 5部屋の中身 |\n| --- | --- |\n` +
  Object.values(D.lanes).map(l => `| ${l.name}の道 | ${Object.entries(l.rooms).map(([t, n]) => `${D.rooms[t].name}${n}`).join('、')} |`).join('\n') +
  `\n\n| 部屋 | 系統 | 出る位置 | 敵 |\n| --- | --- | --- | --- |\n` + Object.entries(D.encounters).map(encRow).join('\n') +
  `\n\n報酬とお店: 最初のスクラップ${D.rewards.scrapStart}、通常戦+${D.rewards.battle}、エリート+${D.rewards.elite}(学習のあとにパーツの付け替え)。ショップはカード${D.shop.offers}枚(コスト0〜1が${D.shop.price[1]}、2が${D.shop.price[2]}、3が${D.shop.price[3]}、4が${D.shop.price[4]}、6が${D.shop.price[6]})、デフラグ${D.shop.defrag}、修理${D.shop.repairCost}(本体+${D.shop.repairBody}・損傷を修復)。整備は修理(本体+15・損傷を修復)かデフラグ。\n\n| イベント | 選択肢1 | 選択肢2 |\n| --- | --- | --- |\n` +
  D.events.map(e => `| ${e.title} | ${e.choices[0].label}: ${e.choices[0].sub} | ${e.choices[1].label}: ${e.choices[1].sub} |`).join('\n');
const cond = {bodyLow:'本体が最大の4割未満', partBroken:'破損した部位がある', chargeSoon:'9サイクル以内に溜め技が来る', vulnNow:'隙を見せている敵がいる', windNow:'構えている(もうすぐ構える)敵がいる', handEmpty:'手札がない', partWorn:'前の戦闘の損傷が残っている', focus:'見えている攻撃が1つの部位に合計10以上'};
out.lines = `## セリフ\n\n下スワイプの内側画面で${D.lines.speaker}が話す独り言です。上から順に条件を調べ、最初に当てはまったものを出します(文が複数あればランダムで1つ)。{part}{enemy}{move}{t}{poise} には部位名、敵の名前、技の名前、残りサイクル、構えを潰すのに要る一撃が入ります。\n\n| 優先 | 条件 | セリフ |\n| --- | --- | --- |\n` +
  D.lines.rules.map((r, i) => `| ${i + 1} | ${cond[r.when]} | ${r.text.join(' / ')} |`).join('\n') + `\n\nどれにも当てはまらないときは、部屋の種類ごとの一言を出します。\n\n| 部屋 | 一言 |\n| --- | --- |\n` + Object.entries(D.lines.room).map(([k, v]) => `| ${D.rooms[k].name} | ${v.join(' / ')} |`).join('\n');
process.stdout.write(JSON.stringify(out));
