// 主な画面を決まった大きさで撮る(依頼 6章の5)。
//   node tools/publish/shots.js [index.html の場所] [出す先=docs/shots] [大きさ=844x390,1920x1080]
// 乱数を固定して同じ画面を撮る。撮るための道具なので、画面へは関数を呼んで直に移る(enterRoom・onWin など)。閉じるのに Esc も使う。
// マウスだけで遊べることの確かめは play19.js(クリックと右クリックだけ)のほう。
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const src = path.resolve(process.argv[2] || 'index.html');
const out = path.resolve(process.argv[3] || 'docs/shots');
const sizes = (process.argv[4] || '844x390,1920x1080').split(',').map(s => s.split('x').map(Number));
const SEED = `(() => { let a = 20240607; const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; Math.random = r; window.__rnd = r; })();`;
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for(const [w, h] of sizes){
    const dir = path.join(out, `${w}x${h}`); fs.mkdirSync(dir, {recursive: true});
    const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1, reducedMotion: 'reduce'});
    await ctx.addInitScript(SEED);
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => { if(!/ServiceWorker/.test(e.message)) errs.push(e.message); });
    const shot = async n => { await p.waitForTimeout(450); await p.screenshot({path: path.join(dir, n + '.png')}); };
    const idle = () => p.waitForFunction(() => !busy && !WIPING && !UI.going, null, {timeout: 20000});
    const room = async type => { await p.evaluate(t => { hideOv(); hideOv2(); const n = S.run.map.nodes.flat().find(x => x.type === t); UI.heatChange = null; enterRoom(n); }, type); await p.waitForTimeout(700); };
    await p.goto('file://' + src); await p.waitForTimeout(900);
    await shot('00-title');
    await p.evaluate(() => { hideOv(); newRun(); EN.setRandom(window.__rnd); hideOv(); hideOv2(); showMap(); });
    await p.waitForTimeout(900); await shot('01-map');
    // 戦闘: 小隊(ユニットが複数の相手)で、1枚出してから撮る
    await p.evaluate(() => { const n = S.run.map.nodes.flat().find(x => x.type === 'battle'); EN.encFor(S.run, n); n.enc = 'n_squad'; UI.node = n; startBattle(n); });
    await p.waitForTimeout(1600);
    await p.click('#hand .card[data-i="1"]'); await p.waitForTimeout(250); await p.click('#pvGo'); await idle();
    await p.waitForTimeout(900); await shot('02-battle');
    await p.click('#hand .card[data-i="0"]'); await shot('03-battle-selected');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.click('.eu[data-f], .foe[data-f]', {button: 'right'}); await p.waitForTimeout(500); await shot('04-foe-detail');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.click('#viewBtns [data-arg="self"]'); await shot('05-self-view');
    await p.click('#viewBtns [data-arg="self"]'); await p.waitForTimeout(300);
    await p.click('#viewBtns [data-arg="hand"]'); await shot('06-hand-view');
    await p.click('#viewBtns [data-arg="hand"]'); await p.waitForTimeout(300);
    // 報酬: 勝ったことにして学習の画面へ
    await p.evaluate(() => onWin()); await p.waitForTimeout(900);
    await shot('07-win');
    await p.click('#ov [data-act="afterWin"]'); await p.waitForTimeout(900); await idle(); await shot('08-reward');
    await room('shop'); await shot('09-shop');
    await room('rest'); await shot('10-rest');
    await room('event'); await shot('11-event');
    await room('duct'); await shot('12-duct');
    await p.evaluate(() => { hideOv(); hideOv2(); showMap(); act('menu'); }); await shot('13-menu');
    console.log(`${w}x${h}: ${fs.readdirSync(dir).length}枚 → ${path.relative(process.cwd(), dir)}${errs.length ? '  エラー: ' + errs.slice(0, 4).join(' / ') : ''}`);
    bad += errs.length; await ctx.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
