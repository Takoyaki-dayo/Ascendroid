// カード工房の「試遊」用に、ゲーム本体(index.html)から play/index.html を作る
//   node tools/sheet/mkplay.js <出力先フォルダ>
// 出力先には play/index.html ができる。data/*.js と js/engine.js は台帳と同じ場所(../)から読む
// 工房で保存したカード(localStorage 'asc.wb' と親ページからの postMessage)を、起動時にゲームのデータへ当てる
const fs = require('fs'), path = require('path');
const out = process.argv[2];
if(!out){ console.error('出力先を指定してください'); process.exit(1); }
const root = path.join(__dirname, '..', '..');
let s = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function rep(a, b){ if(!s.includes(a)) throw new Error('見つからない: ' + a.slice(0, 60)); s = s.replace(a, b); }

// PWA まわりは外す(試遊版はオフライン化しない)
for(const a of ['<link rel="manifest" href="manifest.webmanifest">\n', '<link rel="icon" href="icons/icon-192.png">\n', '<link rel="apple-touch-icon" href="icons/icon-192.png">\n']) rep(a, '');
const i = s.indexOf('<script>\n// オフライン用のサービスワーカー登録');
s = s.slice(0, i) + '</body>\n</html>\n';
// データは台帳と共有
s = s.replace(/<script src="(data|js)\//g, '<script src="../$1/');
rep('<title>', '<title>試遊 ');
// 本体のセーブと混ざらないように
rep('function loadSave(){ try{ const o = JSON.parse(localStorage.getItem(SAVE_KEY)); return o && o.v === 1 && o.run && o.run.map ? o : null; }catch(e){ return null; } }',
  'function loadSave(){ try{ const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if(o && o.run && o.run.deck) o.run.deck = o.run.deck.filter(k => CARDS[k] && !CARDS[k].cut); return o && o.v === 1 && o.run && o.run.map ? o : null; }catch(e){ return null; } }');
s = s.replace(/const SAVE_KEY = '([^']+)'/, "const SAVE_KEY = '$1.wb'");
if(!s.includes(".wb'")) throw new Error('SAVE_KEY が見つからない');
// 削ったカードは報酬・店・デバッグの候補から外す
s = s.split('!CARDS[k].junk').join('!CARDS[k].junk && !CARDS[k].cut');
// 起動前に工房のカードを当てる
const HOOK = `
/* ---------- カード工房の試遊 ---------- */
// 工房のカード {key: card | null(削る)} を CARDS0 に当てる。キャラ別の数値は工房の値で上書きするので消す
let WB_AT = 0;
function wbApply(p){
  if(!p || p.type !== 'asc-cards' || p.at === WB_AT) return false;
  WB_AT = p.at;
  for(const [k, c] of Object.entries(p.cards || {})){
    for(const C of Object.values(CLS)) if(C.cards) delete C.cards[k];
    if(c === null){ if(CARDS0[k]) CARDS0[k].cut = true; continue; }
    CARDS0[k] = JSON.parse(JSON.stringify(c));
  }
  // 属性(0.28.0): 工房の属性 {key: 定義 | null(消す)}。attrTest は「最初のデッキにこの属性付きで入れるカード」
  for(const [k, a] of Object.entries(p.attrs || {})){ if(a === null) delete DATA.attrs[k]; else DATA.attrs[k] = JSON.parse(JSON.stringify(a)); }
  if(Array.isArray(p.startDeck) && p.startDeck.length) DATA.startDeck = p.startDeck.filter(k => CARDS0[k] && !CARDS0[k].cut);
  applyEcon();
  for(const t of p.attrTest || []) if(CARDS[t.card] && DATA.attrs[t.attr] && DATA.attrOk(CARDS[t.card], t.attr)){ const key = t.card + '@' + t.attr; DATA.regAttrCard(CARDS, key); DATA.startDeck.push(key); }
  if(DBG) DBG.deck = DBG.deck.filter(k => CARDS[k] && !CARDS[k].cut);
  return true;
}
try{ wbApply(JSON.parse(localStorage.getItem('asc.wb') || 'null')); }catch(e){}
addEventListener('message', e => { if(e.data && e.data.type === 'asc-cards') wbApply(e.data); });
try{ parent.postMessage({type:'asc-ready'}, '*'); }catch(e){}
`;
rep('dbgLoad(); applyEcon();\nshowTitle();', 'dbgLoad(); applyEcon();' + HOOK + 'showTitle();');
fs.mkdirSync(path.join(out, 'play'), {recursive: true});
fs.writeFileSync(path.join(out, 'play', 'index.html'), s);
console.log('play/index.html', s.length);
