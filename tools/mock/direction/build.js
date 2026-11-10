// 見本を1つの HTML にまとめる: node tools/mock/direction/build.js [出力先]
// core.js を a.src.html・b.src.html に埋め込み、<出力先>/ascendroid-a.html・ascendroid-b.html を作る(既定は tools/mock/direction/dist)。
// 出力はアーティファクトに公開する形(<html>・<body> を持たない断片)。--page を付けると、ブラウザで直接開ける形にする
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), page = args.includes('--page'), out = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, 'dist'));
const core = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
fs.mkdirSync(out, {recursive:true});
for(const k of ['a', 'b']){
  const src = path.join(__dirname, k + '.src.html'); if(!fs.existsSync(src)) continue;
  let html = fs.readFileSync(src, 'utf8').replace('/*@core*/', () => core);
  if(page) html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>';
  fs.writeFileSync(path.join(out, `ascendroid-${k}.html`), html);
  console.log(`ascendroid-${k}.html ${(html.length / 1024).toFixed(1)}KB`);
}
