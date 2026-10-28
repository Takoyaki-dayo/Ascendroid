// ゲーム内の文章を text/*.csv から data/text.js に書き出す
// 使い方: node tools/text.js
// CSV が文章の元(表計算ソフトで直接編集してよい)。data/text.js は自動生成なので直接は編集しない
// 列名が「(参考)」で始まる列は読まない(編集の手がかり用)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'text');

// CSV(ダブルクォート・改行入りのセル・BOM に対応)
function parseCSV(src){
  src = src.replace(/^﻿/, '');
  const rows = []; let row = [], cell = '', i = 0, q = false;
  while(i < src.length){
    const ch = src[i];
    if(q){
      if(ch === '"'){ if(src[i + 1] === '"'){ cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if(ch === '"'){ q = true; i++; continue; }
    if(ch === ','){ row.push(cell); cell = ''; i++; continue; }
    if(ch === '\r'){ i++; continue; }
    if(ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
    cell += ch; i++;
  }
  if(cell !== '' || row.length){ row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.some(c => c.trim() !== '')).map(r => Object.fromEntries(head.map((h, j) => [h.trim(), (r[j] || '').trim()])));
}
const read = f => parseCSV(fs.readFileSync(path.join(DIR, f), 'utf8'));

const T = {cards:{}, keywords:[], parts:{}, foes:{}, events:{}, lines:{rules:[], room:{}}, terms:{}};
for(const r of read('cards.csv')) T.cards[r['キー']] = {name:r['名前'], text:r['テキスト']};
for(const r of read('keywords.csv')) T.keywords.push({key:r['キー'], name:r['名前'], desc:r['説明']});
for(const r of read('parts.csv')) T.parts[r['キー']] = {name:r['名前'], text:r['テキスト']};
for(const r of read('enemies.csv')) T.foes[r['キー']] = r['名前'];
for(const r of read('events.csv')) T.events[r['キー']] = {title:r['タイトル'], text:r['本文'], choices:[1, 2, 3].filter(i => r['選択肢' + i]).map(i => ({label:r['選択肢' + i], sub:r['選択肢' + i + 'の説明']}))};
for(const r of read('lines.csv')){
  const w = r['条件'], t = r['セリフ'];
  if(w.startsWith('room:')){ const k = w.slice(5); (T.lines.room[k] = T.lines.room[k] || []).push(t); continue; }
  let rule = T.lines.rules.find(x => x.when === w);
  if(!rule){ rule = {when:w, text:[]}; T.lines.rules.push(rule); }
  rule.text.push(t);
}
for(const r of read('terms.csv')) T.terms[r['キー']] = r['名前'];

// data/*.js に流し込む処理(生成するファイルにそのまま入る)
function apply(D, T){
  const tm = T.terms;
  for(const A of D.areas || []) if(tm['area.' + A.id]) A.name = tm['area.' + A.id];
  for(const k in D.rooms) if(tm['room.' + k]) D.rooms[k].name = tm['room.' + k];
  for(const s of D.slots) if(tm['slot.' + s.id]) s.fn = tm['slot.' + s.id];
  D.ui = {}; for(const k in tm) if(k.startsWith('ui.')) D.ui[k.slice(3)] = tm[k];
  for(const k in T.cards) if(D.cards[k]) Object.assign(D.cards[k], T.cards[k]);
  D.keywords = {}; D.kwName = {};
  for(const w of T.keywords){ D.keywords[w.name] = w.desc; D.kwName[w.key] = w.name; }
  for(const k in T.parts) if(D.parts[k]) Object.assign(D.parts[k], T.parts[k]);
  for(const [id, n] of Object.entries(T.foes)){
    const [k, where, i] = id.split('.'), f = D.foes[k]; if(!f) continue;
    if(!where) f.name = n;
    else if(where === 'pat' && f.pat[+i]) f.pat[+i].n = n;
    else if(where === 'phase' && f.phase && f.phase.pat[+i]) f.phase.pat[+i].n = n;
    else if(where === 'react' && f.react) f.react.n = n;
    else if(where === 'unit' && f.units && f.units[i]) f.units[i].name = n;
    else if(where === 'passive') (f.pname = f.pname || {})[i] = n; // 番号は passives の何番目か。phase は段階変化の名前
    else if(where === 'broke' && f.broke){ const [uid, j] = i.split(':'); if(f.broke[uid] && f.broke[uid][+j]) f.broke[uid][+j].n = n; }
  }
  for(const e of [...(D.events || []), ...(D.transit || [])]){ const t = T.events[e.id]; if(!t) continue; e.title = t.title; e.text = t.text; t.choices.forEach((c, i) => { if(e.choices[i]) Object.assign(e.choices[i], c); }); }
  D.lines = {speaker: tm.speaker || '', rules: T.lines.rules, room: T.lines.room};
}

const out = `// 自動生成(tools/text.js が text/*.csv から作る)。直接は編集せず、CSV を直して node tools/text.js
// ゲーム内の文章(カード・キーワード・パーツ・敵・イベント・セリフ・用語)を data の各ファイルに流し込む。data/*.js の後に読む
window.DATA = window.DATA || {};
(${apply.toString()})(DATA, ${JSON.stringify(T, null, 1)});
`;
fs.writeFileSync(path.join(ROOT, 'data', 'text.js'), out);
console.log(`data/text.js: カード${Object.keys(T.cards).length} キーワード${T.keywords.length} パーツ${Object.keys(T.parts).length} 敵${Object.keys(T.foes).length} イベント${Object.keys(T.events).length} セリフ${T.lines.rules.length}条件 用語${Object.keys(T.terms).length}`);
