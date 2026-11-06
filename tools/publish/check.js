// 公開の前の構文の確認(0.41.2): node tools/publish/check.js <html>...。中に書いたスクリプト(<script> のもの)を V8 で読み、構文の誤りがあれば止める
// 0.40.3 の後、1行の関数の途中に // の注釈を入れて残りを消し、工房が開けなくなったことがあったため
const fs = require('fs'), vm = require('vm');
let bad = 0;
for(const f of process.argv.slice(2)){
  const s = fs.readFileSync(f, 'utf8'); let i = 0, n = 0;
  while((i = s.indexOf('<script>', i)) >= 0){
    const j = s.indexOf('</script>', i), code = s.slice(i + 8, j); n++;
    try{ new vm.Script(code, {filename: f + '#' + n}); }
    catch(e){ bad++; const ln = (e.stack || '').split('\n')[0]; console.error(`構文の誤り: ${f} の ${n} 個目のスクリプト: ${e.message} (${ln})`); }
    i = j;
  }
}
for(const f of process.argv.slice(2).filter(f => f.endsWith('.js'))) try{ new vm.Script(fs.readFileSync(f, 'utf8'), {filename:f}); }catch(e){ bad++; console.error(`構文の誤り: ${f}: ${e.message}`); }
if(bad) process.exit(1);
