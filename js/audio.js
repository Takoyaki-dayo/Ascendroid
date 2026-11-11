/* Ascendroid の音(0.54.0)。すべて Web Audio で作る(素材のファイルは無い)。決まりは docs/visual-guide.md の「音」。
   方向: 硬く、電子的に。歪ませた矩形波と鋸波、FM の金属音、粗い雑音、短い遅延。丸い鐘や柔らかい正弦波は使わない。
   使い方: SND.play('just') / SND.music('battle') / SND.set({vol, sfx, bgm})。最初の操作(押す・キー)で鳴り始める。
   端末の音量と消音に従う(Web Audio の出力)。画面が隠れている間は止める。 */
(function(root){
'use strict';
const KEY = 'asc.audio';
const cfg = {vol: 0.7, sfx: true, bgm: true};
try{ Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} };
let ctx = null, master, sfxBus, bgmBus, driveIn, echoIn, noiseBuf, crushBuf, wantMusic = null, heat = 0;

function boot(){
  if(ctx) return ctx;
  const AC = root.AudioContext || root.webkitAudioContext; if(!AC) return null;
  ctx = new AC();
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.16; lim.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = cfg.vol; master.connect(lim);
  sfxBus = ctx.createGain(); sfxBus.gain.value = cfg.sfx ? 1 : 0; sfxBus.connect(master);
  bgmBus = ctx.createGain(); bgmBus.gain.value = cfg.bgm ? 0.5 : 0; bgmBus.connect(master);
  // 歪み: 硬い波形整形。ここへ送った音は角が立つ
  const ws = ctx.createWaveShaper(), n = 1024, curve = new Float32Array(n);
  for(let i = 0; i < n; i++){ const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 3.2) * 0.9; }
  ws.curve = curve; ws.oversample = '2x';
  driveIn = ctx.createGain(); driveIn.gain.value = 1; const dOut = ctx.createGain(); dOut.gain.value = 0.55; driveIn.connect(ws); ws.connect(dOut); dOut.connect(sfxBus);
  // 遅延: 短く、高い所を削りながら返る(広い所で跳ね返る機械の音)
  const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), out = ctx.createGain();
  dl.delayTime.value = 0.167; fb.gain.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 2600; out.gain.value = 0.5;
  echoIn = ctx.createGain(); echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(out); out.connect(master);
  // 雑音: ふつうのものと、粗い(標本を保持して段にした)もの
  const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); crushBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const a = noiseBuf.getChannelData(0), c = crushBuf.getChannelData(0); let hold = 0;
  for(let i = 0; i < len; i++){ a[i] = Math.random() * 2 - 1; if(i % 9 === 0) hold = Math.random() * 2 - 1; c[i] = hold; }
  return ctx;
}
function unlock(){ const c = boot(); if(!c) return; if(c.state !== 'running') c.resume(); if(wantMusic !== MU.state) startMusic(wantMusic); }
const now = () => ctx.currentTime;
const dest = o => o.bus === 'bgm' ? bgmBus : o.bus === 'dry' ? sfxBus : driveIn;
function env(g, t, a, d, peak, hold){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); if(hold) g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + (hold || 0) + d); }
function route(node, o){ node.connect(dest(o)); if(o.echo){ const s = ctx.createGain(); s.gain.value = o.echo; node.connect(s); s.connect(echoIn); } }
// 発振器1つ。w: 波形 / f → f2: 高さ(滑らせる)/ d: 長さ / lp: 削る高さ(lp2 へ動かす)
function tone(o){
  if(!ctx) return; const t = (o.t != null ? o.t : now()) + (o.at || 0), d = o.d || 0.1, os = ctx.createOscillator(), g = ctx.createGain();
  os.type = o.w || 'square'; os.frequency.setValueAtTime(o.f, t); if(o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.sl || d)); if(o.det) os.detune.value = o.det;
  env(g, t, o.a || 0.003, d, o.g == null ? 0.2 : o.g, o.h);
  let nd = os;
  if(o.lp){ const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.lp, t); if(o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + d); nd.connect(f); nd = f; }
  nd.connect(g); route(g, o); os.start(t); os.stop(t + (o.a || 0.003) + (o.h || 0) + d + 0.05);
}
// 雑音。crush: 粗い雑音 / type・f(→ f2)・q: フィルタ
function nz(o){
  if(!ctx) return; const t = (o.t != null ? o.t : now()) + (o.at || 0), d = o.d || 0.1, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = o.crush ? crushBuf : noiseBuf; s.loop = true; if(o.rate) s.playbackRate.value = o.rate;
  f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 2000, t); if(o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + d); f.Q.value = o.q || 0.8;
  env(g, t, o.a || 0.002, d, o.g == null ? 0.2 : o.g, o.h);
  s.connect(f); f.connect(g); route(g, o); s.start(t, Math.random() * 1.5); s.stop(t + (o.a || 0.002) + (o.h || 0) + d + 0.05);
}
// FM: 金属の鳴り。r: 変調の比(整数でないと濁る)/ i: 深さ(→ i2)
function fm(o){
  if(!ctx) return; const t = (o.t != null ? o.t : now()) + (o.at || 0), d = o.d || 0.3, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  car.type = o.w || 'sine'; car.frequency.setValueAtTime(o.f, t); if(o.f2) car.frequency.exponentialRampToValueAtTime(o.f2, t + d);
  mod.frequency.setValueAtTime(o.f * (o.r || 1.41), t); if(o.f2) mod.frequency.exponentialRampToValueAtTime(o.f2 * (o.r || 1.41), t + d);
  mg.gain.setValueAtTime(o.f * (o.i == null ? 3 : o.i), t); mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f * (o.i2 == null ? 0.2 : o.i2)), t + d);
  mod.connect(mg); mg.connect(car.frequency); env(g, t, o.a || 0.002, d, o.g == null ? 0.2 : o.g, o.h);
  car.connect(g); route(g, o); car.start(t); mod.start(t); car.stop(t + d + (o.h || 0) + 0.06); mod.stop(t + d + (o.h || 0) + 0.06);
}
const duck = (to, ms) => { if(!ctx) return; const g = bgmBus.gain, t = now(), v = cfg.bgm ? 0.5 : 0; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v * to, t + 0.02); g.linearRampToValueAtTime(v, t + ms / 1000); };
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- 効果音 ---------- */
const FX = {
  ui(){ tone({f: 1480, d: .025, g: .07, bus: 'dry'}); tone({f: 2220, at: .028, d: .03, g: .06, bus: 'dry'}); },
  select(){ tone({w: 'sawtooth', f: 420, f2: 1500, d: .05, g: .1, lp: 3200}); nz({d: .02, f: 5000, type: 'highpass', g: .08, crush: true}); },
  cancel(){ tone({f: 660, f2: 330, d: .06, g: .07, bus: 'dry'}); },
  // 1サイクル進む: 乾いた低い矩形波の刻み
  tick(){ tone({f: 98, d: .035, g: .2, lp: 900}); nz({d: .012, f: 7000, type: 'highpass', g: .07}); },
  // 近接。w は重さ(0〜1)
  melee(w){ w = w || 0; const hv = w > .5;
    nz({d: hv ? .2 : .08, f: hv ? 700 : 1800, f2: hv ? 5200 : 6500, q: 1.4, g: hv ? .3 : .2, crush: true});
    tone({w: 'sawtooth', f: hv ? 620 : 900, f2: hv ? 46 : 110, at: hv ? .07 : .03, d: hv ? .34 : .12, g: hv ? .5 : .3, lp: hv ? 2400 : 3600, lp2: 300});
    tone({w: 'square', f: hv ? 58 : 96, f2: hv ? 30 : 60, at: hv ? .07 : .03, d: hv ? .42 : .14, g: hv ? .6 : .34});
    fm({f: hv ? 310 : 720, r: 2.76, i: 5, d: hv ? .5 : .16, at: hv ? .07 : .03, g: hv ? .16 : .1, echo: hv ? .5 : .2});
    if(hv) nz({at: .08, d: .3, f: 2600, f2: 240, q: .7, g: .3, crush: true, echo: .3}); },
  // 遠隔: 上から落ちる鋸波(光線)と、割れる雑音
  ranged(w){ w = w || 0; const hv = w > .5;
    if(hv){ tone({w: 'sawtooth', f: 90, f2: 1900, d: .16, g: .13, lp: 4000}); }
    const at = hv ? .16 : 0;
    tone({w: 'sawtooth', f: hv ? 3200 : 2600, f2: hv ? 70 : 180, at, d: hv ? .3 : .12, g: hv ? .42 : .26, lp: 6000, lp2: 500, echo: .35});
    fm({f: hv ? 1400 : 1900, f2: hv ? 160 : 400, r: 3.3, i: 6, at, d: hv ? .26 : .1, g: .12});
    nz({at, d: hv ? .26 : .07, type: 'highpass', f: 2400, g: hv ? .3 : .16, crush: true});
    tone({w: 'square', f: hv ? 64 : 110, f2: 34, at, d: hv ? .4 : .12, g: hv ? .55 : .25}); },
  // ブロックを得る: 硬い板が噛み合う。二つの矩形波が半音でぶつかる
  block(){ tone({f: 147, d: .11, g: .3, lp: 1800}); tone({f: 156, d: .11, g: .26, lp: 1800}); fm({f: 392, r: 1.5, i: 4, d: .16, g: .14, echo: .25}); nz({d: .04, f: 1200, g: .2, crush: true}); },
  // ブロックで受けた / 敵の守りに弾かれた
  absorb(){ fm({f: 260, r: 2.1, i: 6, i2: .1, d: .1, g: .22}); nz({d: .035, f: 2400, q: 2, g: .2, crush: true}); tone({f: 80, d: .06, g: .25}); },
  // 被弾: 歪んだ低い矩形波と、警報のような揺れ
  hurt(big){ tone({w: 'square', f: big ? 110 : 150, f2: big ? 38 : 60, d: big ? .4 : .2, g: big ? .7 : .5});
    tone({w: 'sawtooth', f: big ? 220 : 300, f2: 70, d: big ? .3 : .14, g: .3, lp: 2000, det: 30});
    nz({d: big ? .3 : .14, f: 1400, f2: 200, q: .7, g: .4, crush: true});
    if(big){ tone({f: 880, d: .07, g: .12, at: .05, bus: 'dry'}); tone({f: 880, d: .07, g: .1, at: .17, bus: 'dry'}); } },
  // ディレイを与える: 下っていく刻み(段になって落ちる)
  delay(){ [1320, 990, 740, 554, 415].forEach((f, i) => tone({f, at: i * .045, d: .04, g: .13, echo: .5})); nz({d: .25, f: 4000, f2: 500, q: 3, g: .1, crush: true}); },
  foeMove(){ fm({f: 82, r: 1.41, i: 7, i2: 1, d: .3, g: .32}); nz({d: .16, type: 'lowpass', f: 700, g: .2, crush: true}); },
  // 敵の溜め(不安定な行動が近い): 上がっていく鋸波が細かく震える。警報
  charge(){ if(!ctx) return; const t = now(); for(let i = 0; i < 10; i++) tone({w: 'sawtooth', f: 110 + i * 26, t, at: i * .07, d: .06, g: .09 + i * .012, lp: 1800 + i * 300}); fm({f: 55, r: 1.5, i: 9, d: .8, g: .16, a: .4}); },
  // JUST: 鋭い破裂、濁った金属の鳴りが遅延で跳ね返り、底が抜ける
  just(){ duck(.3, 700); nz({d: .03, type: 'highpass', f: 6000, g: .6});
    tone({w: 'sawtooth', f: 147, d: .22, g: .42, lp: 5000, lp2: 600}); tone({w: 'sawtooth', f: 220.5, d: .22, g: .36, lp: 5000, lp2: 600, det: 14}); tone({w: 'square', f: 294, d: .18, g: .2, lp: 4000});
    fm({f: 1245, r: 2.76, i: 7, i2: .3, d: .9, g: .2, echo: .8, bus: 'dry'}); fm({f: 1864, r: 1.41, i: 5, d: .6, at: .02, g: .12, echo: .8, bus: 'dry'});
    tone({w: 'sine', f: 190, f2: 28, at: .01, d: .5, g: .8, bus: 'dry'}); nz({at: .03, d: .5, type: 'highpass', f: 5000, f2: 1500, g: .16, crush: true, echo: .4}); },
  // 敵の行動をブレイク: 硝子の割れる粗い音と、落ちる刻み
  brk(){ duck(.5, 400); nz({d: .16, f: 5200, f2: 900, q: 1.2, g: .4, crush: true, echo: .3}); for(let i = 0; i < 6; i++) tone({f: rnd(1600, 5200), at: rnd(0, .14), d: .025, g: .1, bus: 'dry', echo: .3});
    tone({w: 'sawtooth', f: 320, f2: 60, d: .26, g: .32, lp: 2600}); tone({w: 'sine', f: 140, f2: 36, d: .32, g: .5, bus: 'dry'}); },
  // 自分のカードが止められた: 誤りの音。二つの矩形波がうなる
  interrupt(){ tone({f: 92, d: .05, h: .2, g: .34, lp: 1400}); tone({f: 97.5, d: .05, h: .2, g: .34, lp: 1400}); tone({f: 620, f2: 180, d: .2, g: .12, bus: 'dry'}); nz({d: .1, f: 900, g: .25, crush: true}); },
  unitBreak(){ fm({f: 180, r: 2.76, i: 9, i2: .5, d: .5, g: .3, echo: .4}); tone({w: 'square', f: 90, f2: 30, d: .36, g: .5}); nz({d: .3, f: 3000, f2: 300, q: .8, g: .34, crush: true}); for(let i = 0; i < 5; i++) nz({at: .1 + i * .06, d: .03, f: rnd(1200, 5000), q: 4, g: .14, crush: true}); },
  // 撃破: 底が抜け、歪んだ鋸波が落ち、途切れながら消える
  kill(){ duck(.2, 1400); tone({w: 'sine', f: 120, f2: 22, d: 1.3, g: .9, bus: 'dry'}); tone({w: 'sawtooth', f: 520, f2: 40, d: .7, g: .5, lp: 3600, lp2: 200}); tone({w: 'sawtooth', f: 780, f2: 58, d: .7, g: .3, lp: 3600, lp2: 200, det: 20});
    nz({d: .9, f: 3600, f2: 120, q: .6, g: .5, crush: true, echo: .4}); for(let i = 0; i < 7; i++){ const at = .25 + i * .085; nz({at, d: .04, f: 2000 - i * 200, q: 2, g: .26 - i * .03, crush: true}); tone({f: 196 / (1 + i * .12), at, d: .04, g: .16 - i * .018, lp: 1600}); }
    fm({f: 98, r: 2.76, i: 8, i2: 1, d: 1.6, at: .05, g: .2, echo: .6}); },
  // リフレッシュ: 細かい刻みが駆け上がる(読み込み直す)
  refresh(){ if(!ctx) return; const t = now(); for(let i = 0; i < 12; i++) tone({f: 330 * Math.pow(2, (i * 3 % 12 + Math.floor(i / 4) * 12) / 12), t, at: i * .022, d: .02, g: .08, bus: 'dry'}); nz({d: .28, type: 'highpass', f: 1200, f2: 7000, g: .1, crush: true}); tone({f: 73, d: .1, at: .26, g: .3}); },
  draw(){ nz({d: .03, type: 'highpass', f: 4200, g: .08, crush: true}); tone({f: 990, d: .02, g: .05, bus: 'dry'}); },
  // カードを取り込む・買う: 上がる二音。鋸波の和音
  gain(){ [[147, 0], [220, 0], [294, .1], [440, .1]].forEach(([f, at]) => tone({w: 'sawtooth', f, at, d: .22, g: .16, lp: 3200, lp2: 800, echo: .4})); tone({f: 1175, at: .1, d: .08, g: .07, bus: 'dry', echo: .5}); },
  buy(){ tone({f: 1175, d: .04, g: .09, bus: 'dry'}); tone({f: 1760, at: .05, d: .06, g: .09, bus: 'dry', echo: .4}); nz({d: .05, f: 3000, q: 3, g: .12, crush: true}); },
  remove(){ nz({d: .3, f: 6000, f2: 400, q: 2, g: .2, crush: true}); tone({w: 'sawtooth', f: 440, f2: 55, d: .28, g: .18, lp: 2000}); },
  heal(){ [294, 349, 440].forEach((f, i) => tone({w: 'triangle', f, at: i * .07, d: .2, g: .16, bus: 'dry', echo: .4})); nz({d: .3, type: 'highpass', f: 5000, g: .04}); },
  // 地図: 進む
  step(){ tone({f: 73, f2: 46, d: .14, g: .4}); tone({f: 740, f2: 1480, at: .04, d: .07, g: .08, bus: 'dry', echo: .4}); },
  wipe(){ nz({d: .22, f: 600, f2: 5000, q: 1, g: .12, crush: true}); },
  // 警戒が上がる: 二音の警報 / 下がる: 落ちていく音
  heatUp(){ for(let i = 0; i < 3; i++){ tone({w: 'sawtooth', f: 440, at: i * .22, d: .04, h: .06, g: .16, lp: 2600}); tone({w: 'sawtooth', f: 587, at: i * .22 + .11, d: .04, h: .06, g: .16, lp: 2600}); } tone({f: 55, d: .7, g: .3, a: .2}); },
  heatDown(){ tone({w: 'triangle', f: 660, f2: 165, d: .6, g: .16, bus: 'dry', echo: .4}); nz({d: .6, type: 'lowpass', f: 3000, f2: 300, g: .08}); },
  // 戦闘に入る / 勝つ / 機能停止
  enter(){ tone({w: 'sawtooth', f: 55, f2: 110, d: .3, g: .34, lp: 600, lp2: 3000}); nz({d: .3, f: 300, f2: 4000, q: 1, g: .14, crush: true}); tone({f: 1175, at: .28, d: .05, g: .08, bus: 'dry', echo: .5}); },
  win(){ [[147, 0], [175, .12], [220, .24], [294, .36]].forEach(([f, at]) => { tone({w: 'sawtooth', f, at, d: .3, g: .2, lp: 3600, lp2: 700, echo: .5}); tone({f: f * 2, at, d: .1, g: .07, bus: 'dry'}); }); tone({f: 73, at: .36, d: .5, g: .4}); },
  lose(){ duck(.1, 2500); tone({w: 'sawtooth', f: 220, f2: 30, d: 1.6, g: .4, lp: 2400, lp2: 100}); tone({w: 'sawtooth', f: 233, f2: 31, d: 1.6, g: .34, lp: 2400, lp2: 100}); nz({d: 1.4, f: 2000, f2: 80, q: .7, g: .3, crush: true}); for(let i = 0; i < 5; i++) tone({f: 440 / (i + 1), at: i * .22, d: .05, g: .12, bus: 'dry', echo: .6}); },
  // 独り言・敵のひとことが出る
  say(){ tone({f: 880, d: .02, g: .04, bus: 'dry'}); tone({f: 660, at: .03, d: .02, g: .04, bus: 'dry'}); },
};
const LIST = [['ui', '押す'], ['select', 'カードを選ぶ'], ['tick', '1サイクル進む'], ['melee', '軽い近接', 0], ['melee', '重い近接', 1], ['ranged', '軽い遠隔', 0], ['ranged', '重い遠隔', 1], ['block', 'ブロックを得る'], ['absorb', 'ブロックで受けた'], ['hurt', '被弾', false], ['hurt', '大きな被弾', true],
  ['delay', 'ディレイ'], ['foeMove', '敵の行動'], ['charge', '敵の溜め'], ['just', 'JUST'], ['brk', '敵をブレイク'], ['interrupt', '自分がブレイク'], ['unitBreak', 'ユニット破壊'], ['kill', '撃破'], ['refresh', 'リフレッシュ'], ['draw', 'カードを引く'],
  ['gain', 'カードを取り込む'], ['buy', '買う'], ['remove', 'カードを消す'], ['heal', '回復'], ['step', '地図を進む'], ['wipe', '画面の切り替え'], ['heatUp', '警戒が上がる'], ['heatDown', '警戒が下がる'], ['enter', '戦闘に入る'], ['win', '戦闘に勝つ'], ['lose', '機能停止'], ['say', 'ひとこと']];
let last = {};
function play(name, arg){
  if(!ctx || ctx.state !== 'running' || !cfg.sfx || !FX[name]) return;
  const t = performance.now(), gap = name === 'tick' ? 40 : 25; if(last[name] && t - last[name] < gap) return; last[name] = t; // 同じ音を続けて重ねない(連打・打ち切り)
  try{ FX[name](arg); }catch(e){ if(root.SND.debug) throw e; }
}

/* ---------- 曲 ----------
   16分の段を先読みして鳴らす。場面ごとに型(速さ・低音の並び・太鼓)を持つ。D のフリジア(D E♭ F G A B♭ C)。
   battle・elite・boss は四つ打ちと歪んだ低音。map・room・title は遅く、低いうなりとまばらな刻み。 */
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;
const SONGS = {
  battle: {bpm: 112, kick: s => s % 4 === 0 || s % 16 === 14, snare: s => s % 8 === 4, hat: s => s % 2 === 0 ? .5 : 1,
    bass: [38, _, 38, 50, _, 38, 41, _, 38, _, 38, 50, 39, _, 36, _, 38, _, 38, 50, _, 38, 41, _, 43, _, 41, _, 39, 38, 36, _],
    arp: [_, _, 74, _, _, 77, _, _, 81, _, _, 77, _, 74, _, _], arpFrom: 32, pad: [50, 57, 65], drive: 1},
  elite: {bpm: 118, kick: s => s % 4 === 0 || s % 16 === 11, snare: s => s % 8 === 4 || s % 32 === 30, hat: s => 1,
    bass: [38, 38, _, 38, 39, _, 38, _, 41, 38, _, 38, 36, _, 39, _], arp: [74, _, 77, _, 74, _, 81, _, 74, _, 77, _, 75, _, 72, _], arpFrom: 16, pad: [50, 56, 63], drive: 1},
  boss: {bpm: 126, kick: s => s % 4 === 0 || s % 8 === 7, snare: s => s % 8 === 4 || s % 16 === 15, hat: s => 1,
    bass: [38, 38, 50, 38, 39, 38, 51, 38, 36, 36, 48, 36, 41, 39, 38, 36], arp: [86, _, 81, 86, _, 77, 81, _, 87, _, 81, 87, _, 75, 79, _], arpFrom: 0, pad: [50, 53, 57, 63], drive: 1, stab: s => s % 16 === 6 || s % 16 === 13},
  map: {bpm: 84, kick: s => s % 16 === 0 || s % 16 === 10, snare: s => false, hat: s => s % 4 === 2 ? .5 : 0,
    bass: [26, _, _, _, _, _, _, _, _, _, 26, _, _, _, 29, _, 26, _, _, _, _, _, _, _, _, _, 24, _, _, _, 27, _], arp: [_, _, _, 69, _, _, 74, _, _, _, 65, _, _, 72, _, _], arpFrom: 0, pad: [38, 45, 53], drive: 0, soft: 1},
  room: {bpm: 76, kick: s => false, snare: s => false, hat: s => 0,
    bass: [26, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 24, _, _, _, _, _, _, _, 27, _, _, _, _, _, _, _], arp: [_, _, 77, _, _, _, _, 74, _, _, _, 69, _, _, _, _], arpFrom: 0, pad: [38, 45, 51], drive: 0, soft: 1},
  title: {bpm: 70, kick: s => s % 32 === 0, snare: s => false, hat: s => 0,
    bass: [26, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], arp: [_, _, _, _, _, 81, _, _, _, _, _, _, _, 77, _, _], arpFrom: 0, pad: [38, 45, 50, 53], drive: 0, soft: 1},
};
const MU = {state: null, song: null, step: 0, next: 0, tm: null};
function startMusic(state){
  MU.state = state; MU.song = state ? SONGS[state] || SONGS.map : null;
  if(!ctx || !MU.song){ clearInterval(MU.tm); MU.tm = null; return; }
  MU.step = 0; MU.next = now() + 0.08;
  if(!MU.tm) MU.tm = setInterval(pump, 30);
}
function pump(){
  if(!ctx || !MU.song || ctx.state !== 'running' || !cfg.bgm){ if(ctx && MU.song) MU.next = Math.max(MU.next, now() + 0.05); return; }
  const dur = 60 / MU.song.bpm / 4;
  if(MU.next < now() - 0.3) MU.next = now() + 0.05; // 止まっていた間の分は鳴らさない
  while(MU.next < now() + 0.14){ stepAt(MU.song, MU.step, MU.next, dur); MU.next += dur; MU.step = (MU.step + 1) % 128; }
}
function stepAt(S, s, t, dur){
  const B = {bus: 'bgm', t}, hot = S.soft ? 0 : heat;
  if(S.kick(s)){ tone(Object.assign({w: 'sine', f: S.soft ? 90 : 150, f2: 38, d: S.soft ? .3 : .2, g: S.soft ? .5 : .9}, B)); if(!S.soft) tone(Object.assign({w: 'square', f: 60, f2: 40, d: .06, g: .3, lp: 1200}, B)); }
  if(S.snare(s)){ nz(Object.assign({d: .13, f: 1900, q: .8, g: .42, crush: true}, B)); tone(Object.assign({w: 'square', f: 196, f2: 120, d: .06, g: .18}, B)); }
  const h = S.hat(s); if(h) nz(Object.assign({d: h < 1 ? .09 : .03, type: 'highpass', f: 8000, g: (s % 4 === 2 ? .16 : .09) * (1 + hot * .5)}, B));
  const b = S.bass[s % S.bass.length];
  if(b != null){ const f = hz(b), d = S.soft ? dur * 7 : dur * .9;
    tone(Object.assign({w: 'sawtooth', f, d, g: S.soft ? .34 : .4, lp: S.soft ? 260 : 500 + hot * 900, lp2: S.soft ? 120 : 160, q: S.soft ? 1 : 5, a: S.soft ? .08 : .004}, B));
    if(!S.soft) tone(Object.assign({w: 'square', f: f / 2, d, g: .3, lp: 300}, B)); }
  if(s >= S.arpFrom || s >= 64){ const a = S.arp[s % S.arp.length]; if(a != null && (S.soft ? Math.random() < .6 : true)){ const f = hz(a);
    if(S.soft) fm(Object.assign({f, r: 3.01, i: 2.4, i2: .2, d: 1.4, g: .06}, B)); else tone(Object.assign({w: 'square', f, d: dur * 1.6, g: .075 + hot * .04, lp: 2600 + hot * 2400, det: 6}, B)); } }
  if(S.stab && S.stab(s)) for(const m of S.pad) tone(Object.assign({w: 'sawtooth', f: hz(m + 12), d: .12, g: .1, lp: 3000}, B));
  if(s % 32 === 0) for(const m of S.pad){ tone(Object.assign({w: 'sawtooth', f: hz(m), d: dur * 30, a: dur * 4, g: S.soft ? .075 : .05, lp: S.soft ? 520 : 900, det: -9}, B)); tone(Object.assign({w: 'sawtooth', f: hz(m), d: dur * 30, a: dur * 4, g: S.soft ? .075 : .05, lp: S.soft ? 520 : 900, det: 9}, B)); }
  if(S.soft && s % 64 === 40) nz(Object.assign({d: 2.4, a: 1.2, f: 500, f2: 2400, q: 2, g: .05}, B));
}
function music(state){ wantMusic = state || null; if(ctx && ctx.state === 'running' && wantMusic !== MU.state) startMusic(wantMusic); }
function set(o){
  Object.assign(cfg, o); save(); if(!ctx) return;
  master.gain.value = cfg.vol; sfxBus.gain.value = cfg.sfx ? 1 : 0; bgmBus.gain.cancelScheduledValues(now()); bgmBus.gain.value = cfg.bgm ? 0.5 : 0;
}
// 最初の操作で鳴らせるようにする。隠れている間は止める
for(const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) root.addEventListener(ev, unlock, {capture: true, passive: true});
root.document.addEventListener('visibilitychange', () => { if(!ctx) return; if(root.document.hidden) ctx.suspend(); else ctx.resume(); });

root.SND = {play, music, set, cfg, LIST, SONGS: Object.keys(SONGS), heat(v){ heat = Math.max(0, Math.min(1, v || 0)); }, unlock, get ready(){ return !!ctx && ctx.state === 'running'; }};
})(typeof window !== 'undefined' ? window : globalThis);
