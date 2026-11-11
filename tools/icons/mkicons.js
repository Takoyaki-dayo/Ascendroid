// アイコンを作り直す: node tools/icons/mkicons.js  (tools/icons/icon.svg → icons/icon-192.png・icon-512.png・maskable-512.png)
// maskable は、端末が丸や角丸に切り抜いても絵が欠けないよう、絵を 78% に縮めて余白を足す
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const root = path.join(__dirname, '..', '..'), svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
  const b = await chromium.launch();
  for(const [name, size, pad] of [['icon-192', 192, 1], ['icon-512', 512, 1], ['maskable-512', 512, .78]]){
    const p = await (await b.newContext({viewport: {width: size, height: size}, deviceScaleFactor: 1})).newPage();
    await p.setContent(`<body style="margin:0;background:#070605;display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${size * pad}px;height:${size * pad}px">${svg}</div></body>`);
    await p.screenshot({path: path.join(root, 'icons', name + '.png')});
  }
  await b.close(); console.log('ok');
})();
