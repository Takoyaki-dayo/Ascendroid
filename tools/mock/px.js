/* 見本(見た目の作り直し): 世界の層のドット絵
   低い解像度の盤に図形で描き、左上からの光で自動で陰を付け、外側に輪郭を付けて、3倍に拡大して使う(1ドット = 舞台の3px)。
   色は番号で描き、案(A/B)ごとの色の表で塗る。敵の絵の規格: 30×33 ドット・左向き・足元は下から2ドット目 */
window.PXA = (() => {
  const S = 3;
  /* 色の番号: 1 輪郭 / 2-5 白い装甲(陰→明) / 6-9 黒鉛(陰→明) / 10-12 シアン / 13-15 赤 / 16-17 紫 / 18-19 琥珀 / 20 発光の芯(白) */
  const RAMPS = [[2, 5], [6, 9], [10, 12], [13, 15], [16, 17], [18, 19]];
  const PAL = {
    a: ['', '#0d141c', '#6f7d8a', '#a9b6c1', '#d6dee5', '#f4f7f9', '#1a232d', '#2b3946', '#44566a', '#6a7f93', '#0a8fb5', '#2fd0f5', '#c4f6ff', '#a51f3c', '#f2385a', '#ffc0cb', '#6a45d8', '#b49bff', '#b77a12', '#ffc94d', '#ffffff'],
    b: ['', '#020306', '#5f6c78', '#9eabb7', '#cfd8e0', '#eef3f6', '#131a22', '#222e3a', '#38495a', '#58708a', '#00a7c4', '#3ff0ff', '#d4fdff', '#b0122f', '#ff2a4b', '#ffb7c3', '#7b2cff', '#c99bff', '#c27c00', '#ffcc33', '#ffffff'],
  };
  const grid = (w, h) => ({w, h, a: new Uint8Array(w * h)});
  const at = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h) ? 0 : g.a[y * g.w + x];
  const put = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if(x >= 0 && y >= 0 && x < g.w && y < g.h) g.a[y * g.w + x] = c; };
  const D = {
    r(g, x, y, w, h, c){ for(let j = 0; j < h; j++) for(let i = 0; i < w; i++) put(g, x + i, y + j, c); },
    e(g, cx, cy, rx, ry, c){ for(let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for(let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if(((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) put(g, x, y, c); },
    l(g, x0, y0, x1, y1, c, t){ const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for(let k = 0; k <= n; k++){ const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; if(t > 1) D.r(g, Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t, c); else put(g, x, y, c); } },
    p(g, pts, c){ const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      for(let y = y0; y <= y1; y++){ const yc = y + .5, xs = [];
        for(let k = 0; k < pts.length; k++){ const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length]; if((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax)); }
        xs.sort((a, b) => a - b); for(let k = 0; k + 1 < xs.length; k += 2) for(let x = Math.ceil(xs[k] - .5); x <= Math.floor(xs[k + 1] - .5); x++) put(g, x, y, c); } },
    d(g, list, c){ for(const [x, y] of list) put(g, x, y, c); },
  };
  /* 陰: 素材の色のうち、上か左が空いていれば一段明るく、下か右が空いていれば一段暗く(光は左上から) */
  function bevel(g){
    const src = g.a.slice(), rampOf = c => RAMPS.find(([a, b]) => c >= a && c <= b);
    for(let y = 0; y < g.h; y++) for(let x = 0; x < g.w; x++){
      const c = src[y * g.w + x], r = rampOf(c); if(!r || r[0] === 10 || r[0] === 13 || r[0] === 16) continue;
      const e = (xx, yy) => (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) ? true : src[yy * g.w + xx] === 0 || rampOf(src[yy * g.w + xx]) !== r;
      if(e(x, y - 1) || e(x - 1, y)) g.a[y * g.w + x] = Math.min(r[1], c + 1);
      else if(e(x, y + 1) || e(x + 1, y)) g.a[y * g.w + x] = Math.max(r[0], c - 1);
    }
  }
  function outline(g){ const src = g.a.slice(); for(let y = 0; y < g.h; y++) for(let x = 0; x < g.w; x++){ if(src[y * g.w + x]) continue; const n = (xx, yy) => (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) ? 0 : src[yy * g.w + xx]; if(n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) g.a[y * g.w + x] = 1; } }
  function draw(w, h, prog, opt){ const g = grid(w, h); for(const op of prog) if(op) D[op[0]](g, ...op.slice(1)); if(!opt || opt.bevel !== false) bevel(g); if(opt && opt.post) opt.post(g); if(!opt || opt.outline !== false) outline(g); return g; }
  const cache = new Map();
  function url(key, w, h, prog, opt){
    const th = theme(), k = th + '|' + key; if(cache.has(k)) return cache.get(k);
    const g = draw(w, h, prog, opt), pal = PAL[th], cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'), im = cx.createImageData(w, h);
    for(let i = 0; i < g.a.length; i++){ const c = g.a[i]; if(!c) continue; const hex = pal[c]; im.data[i * 4] = parseInt(hex.slice(1, 3), 16); im.data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16); im.data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16); im.data[i * 4 + 3] = 255; }
    cx.putImageData(im, 0, 0); const u = cv.toDataURL(); cache.set(k, u); return u;
  }
  const theme = () => document.documentElement.dataset.theme === 'b' ? 'b' : 'a';

  /* ---------- 自機 K-7(21×34、右向き)。部位ごとに描き、壊れた部位は黒鉛に落として赤い火花 ---------- */
  function droidProg(dmg, pose){
    const W = id => dmg.has(id) ? 8 : 4, P = [];
    const l = pose === 'atk' ? 1 : pose === 'hurt' ? -1 : 0, ty = pose === 'hurt' || pose === 'idle1' ? 1 : 0, hx = 7 + l, D_ = id => dmg.has(id);
    /* 奥の腕(出力)・奥の脚(機動)は暗く */
    P.push(['l', 6 + l, 9 + ty, 4, 16 + ty, 7, 2]);
    P.push(['l', 8, 19 + ty, pose === 'atk' ? 6 : 7, 31, 7, 2], ['r', pose === 'atk' ? 4 : 5, 32, 4, 2, 7]);
    P.push(['l', 11, 19 + ty, pose === 'atk' ? 14 : 12, 31, D_('mob') ? 8 : 4, 2], ['r', pose === 'atk' ? 13 : 11, 32, 5, 2, D_('mob') ? 8 : 4]);
    P.push(['r', 6, 16 + ty, 8, 3, 7], ['r', 7, 16 + ty, 6, 1, 8]);
    /* 胴(耐久) */
    P.push(['p', [[4 + l, 7 + ty], [15 + l, 7 + ty], [13 + l, 16 + ty], [6 + l, 16 + ty]], W('dur')]);
    P.push(['l', 7 + l, 11 + ty, 12 + l, 11 + ty, D_('dur') ? 6 : 3], ['l', 8 + l, 14 + ty, 11 + l, 14 + ty, D_('dur') ? 6 : 3]);
    P.push(['r', 9 + l, 9 + ty, 2, 1, D_('dur') ? 14 : 11]);
    /* 頭(演算) */
    P.push(['r', 9 + l, 6 + ty, 2, 1, 7]);
    P.push(['r', hx, 1 + ty, 6, 5, W('calc')], ['r', hx + 1, ty, 4, 1, W('calc')]);
    P.push(['r', hx + 2, 2 + ty, 5, 2, D_('calc') ? 14 : 11], ['r', hx + 5, 2 + ty, 1, 1, D_('calc') ? 15 : 12]);
    /* 肩の砲(武装) */
    P.push(['r', 12 + l, 6 + ty, 7, 2, D_('arm') ? 8 : 9], ['r', 13 + l, 5 + ty, 3, 1, D_('arm') ? 8 : 9], ['r', 19 + l, 6 + ty, 1, 1, D_('arm') ? 14 : 11]);
    /* 手前の腕(出力) */
    if(pose === 'atk') P.push(['l', 15, 9 + ty, 18, 12 + ty, W('out') + 1, 2], ['r', 18, 11 + ty, 2, 2, W('out')]);
    else P.push(['l', 14 + l, 9 + ty, 16 + l, 16 + ty, W('out') + 1, 2], ['r', 15 + l, 16 + ty, 2, 2, W('out')]);
    /* 壊れた部位の火花 */
    const sp = {calc: [[hx + 1, 1 + ty]], dur: [[6 + l, 13 + ty], [12 + l, 10 + ty]], out: [[16 + l, 13 + ty]], mob: [[12, 26]], arm: [[16 + l, 6 + ty]]};
    for(const id of dmg) if(sp[id]) P.push(['d', sp[id], 15]);
    return P;
  }
  /* 待機は2コマ(上半身が1ドット沈む)。攻撃・被弾は1コマ */
  function droidImg(dmg, pose, cls){
    const one = p => `<img class="pxs droidpx ${cls || ''}" alt="" src="${url('k7:' + [...dmg].sort().join(',') + ':' + (p || 'idle'), 21, 34, droidProg(dmg, p))}" width="63" height="102">`;
    if(pose || cls) return one(pose);
    return one(null).replace('droidpx ', 'droidpx i0 ') + one('idle1').replace('droidpx ', 'droidpx i1 ');
  }

  /* ---------- 敵(30×33、左向き) ---------- */
  const FOE = {
    /* 警備ドローン: 白い殻・黒鉛の下面・大きな赤い目。羽根は2コマ */
    drone: f => [
      ['r', f ? 6 : 3, 4, f ? 18 : 24, 1, 8], ['r', 14, 3, 2, 3, 7], ['r', 14, 6, 2, 3, 8],
      ['e', 15, 17, 9.5, 8.5, 8], ['p', [[6, 15], [24, 15], [22, 9], [8, 9]], 4], ['e', 15, 13, 8, 5, 4],
      ['r', 7, 18, 16, 1, 6],
      ['e', 10, 18, 3.2, 3.2, 6], ['e', 10, 18, 2.2, 2.2, 14], ['d', [[9, 17]], 15],
      ['l', 11, 25, 9, 30, 7, 1], ['l', 19, 25, 21, 30, 7, 1], ['d', [[9, 30], [21, 30]], 8],
      ['r', 17, 22, 4, 1, 11],
    ],
    /* 斥候機: 細い逆関節の二脚、前に突き出たセンサーの頭、長いアンテナ */
    scout: f => [
      ['l', 18, 9, 22 - f, 1, 8], ['d', [[22 - f, 1]], 14],
      ['l', 16, 18, 20, 24, 7, 2], ['l', 20, 24, 17, 30, 7, 2], ['r', 14, 31, 6, 1, 7],
      ['p', [[10, 9], [22, 8], [24, 13], [20, 18], [12, 18]], 4], ['r', 12, 15, 9, 1, 3],
      ['p', [[3, 11], [11, 9], [12, 15], [4, 15]], 8], ['r', 5, 12, 2, 2, 14], ['d', [[4, 12]], 15],
      ['l', 13, 18, 16, 24, 9, 2], ['l', 16, 24, 12, 30, 9, 2], ['r', 9, 31, 7, 1, 9],
      ['d', [[20, 10], [21, 10]], 11],
    ],
    /* 迎撃タレット: 白い台座、黒鉛の砲塔、2本の砲身、赤いセンサー */
    turret: f => [
      ['p', [[6, 24], [24, 24], [26, 32], [4, 32]], 4], ['r', 7, 27, 16, 1, 2], ['r', 9, 22, 12, 3, 8],
      ['e', 15, 17, 7, 6, 8], ['r', 9, 17, 13, 5, 8], ['r', 17 - f, 13, 5, 2, 4],
      ['r', 1, 15, 10, 2, 7], ['r', 2, 19, 9, 2, 7], ['r', 0, 15, 1, 2, 6], ['r', 1, 19, 1, 2, 6],
      ['r', 13, 15, 3, 2, 14], ['d', [[13, 15]], 15],
      ['d', [[19, 29], [21, 29], [23, 29]], 18],
    ],
  };
  const FOEVB = {x: 0, y: -4, w: 60, h: 66};
  function foeSvg(kind){
    const prog = FOE[kind]; if(!prog) return null;
    const u0 = url('foe:' + kind + ':0', 30, 33, prog(0)), u1 = url('foe:' + kind + ':1', 30, 33, prog(1));
    return `<svg class="pxfoe k-${kind}" viewBox="${FOEVB.x} ${FOEVB.y} ${FOEVB.w} ${FOEVB.h}" aria-hidden="true"><image class="f0" href="${u0}" x="0" y="-4" width="60" height="66" preserveAspectRatio="none"/><image class="f1" href="${u1}" x="0" y="-4" width="60" height="66" preserveAspectRatio="none"/></svg>`;
  }

  /* ---------- カードの絵(29×20)。種類ごとの道具を描く ---------- */
  const ART = {
    melee: [['d', [[20, 16], [23, 14], [25, 11], [26, 8], [26, 5]], 11], ['l', 8, 14, 22, 2, 5, 2], ['l', 9, 15, 23, 3, 3], ['l', 5, 12, 10, 17, 8, 2], ['l', 3, 19, 7, 15, 7, 2]],
    ranged: [['r', 3, 9, 14, 4, 4], ['r', 5, 13, 4, 4, 8], ['r', 17, 10, 3, 2, 8], ['r', 20, 10, 8, 2, 11], ['r', 20, 10, 8, 1, 12], ['d', [[6, 10]], 11]],
    block: [['p', [[6, 3], [16, 1], [16, 18], [6, 16]], 4], ['p', [[13, 3], [23, 1], [23, 18], [13, 16]], 3], ['l', 9, 8, 13, 7, 11], ['l', 16, 7, 20, 6, 11]],
    parry: [['l', 4, 17, 22, 2, 5, 2], ['l', 4, 2, 22, 17, 3, 2], ['r', 12, 8, 3, 3, 11]],
    delay: [['e', 14, 10, 8, 8, 8], ['e', 14, 10, 5, 5, 4], ['r', 13, 6, 2, 5, 7], ['r', 13, 10, 5, 2, 7], ['d', [[14, 1], [22, 10], [14, 19], [6, 10]], 11]],
    timer: [['e', 14, 12, 7, 6, 8], ['r', 9, 6, 10, 3, 4], ['l', 18, 6, 22, 2, 7], ['r', 22, 1, 2, 2, 19], ['r', 13, 11, 3, 2, 14]],
    swift: [['p', [[4, 4], [10, 10], [4, 16], [7, 10]], 11], ['p', [[11, 4], [17, 10], [11, 16], [14, 10]], 10], ['p', [[18, 4], [24, 10], [18, 16], [21, 10]], 12]],
    draw: [['r', 6, 3, 10, 14, 3], ['r', 9, 2, 10, 14, 4], ['r', 12, 1, 10, 14, 5], ['r', 14, 4, 6, 1, 11], ['r', 14, 7, 4, 1, 8]],
    charge: [['r', 8, 4, 12, 14, 8], ['r', 12, 2, 4, 2, 7], ['r', 10, 11, 8, 5, 17], ['r', 10, 8, 8, 2, 16], ['l', 15, 5, 12, 11, 20]],
    crack: [['r', 5, 3, 18, 14, 4], ['l', 13, 3, 11, 9, 14], ['l', 11, 9, 15, 12, 14], ['l', 15, 12, 12, 17, 14], ['l', 15, 12, 21, 13, 13]],
    dot: [['p', [[14, 1], [20, 9], [19, 16], [9, 16], [8, 9], [11, 5], [12, 9]], 18], ['p', [[14, 6], [17, 11], [16, 16], [12, 16], [11, 12]], 19], ['r', 13, 13, 2, 3, 20], ['r', 6, 17, 17, 2, 8]],
    junk: [['p', [[3, 18], [6, 12], [12, 10], [15, 13], [21, 9], [26, 18]], 8], ['r', 8, 6, 7, 4, 3], ['l', 17, 4, 22, 9, 7, 2], ['e', 20, 14, 2.5, 2.5, 4], ['d', [[20, 14]], 7], ['d', [[11, 15], [6, 16]], 18]],
  };
  const artImg = t => ART[t] ? `<img class="pxs cardpx" alt="" src="${url('art:' + t, 29, 20, ART[t])}" width="87" height="60">` : '';

  /* ---------- 背景(281×130)。A: 明るい施設 / B: 暗い通路 ---------- */
  function bgProg(th){
    const P = [];
    if(th === 'a'){
      /* 明るい施設: 白い壁の大きな面、上の照明の帯、床は淡い目地 */
      P.push(['r', 0, 0, 281, 130, 4], ['r', 0, 0, 281, 3, 5], ['r', 0, 3, 281, 1, 20]);
      for(let x = 0; x < 281; x += 47) P.push(['r', x, 4, 1, 70, 3]);
      P.push(['r', 0, 70, 281, 4, 3], ['r', 0, 74, 281, 1, 2], ['r', 0, 75, 281, 55, 3]);
      for(let x = -40; x < 330; x += 40) P.push(['l', x, 75, x + (x - 140) * .7, 130, 4]);
      P.push(['r', 0, 100, 281, 1, 4]);
    } else {
      /* 暗い通路: 黒鉛の壁、奥に一本だけの細い光、床は暗い目地 */
      P.push(['r', 0, 0, 281, 130, 6]);
      for(let x = 0; x < 281; x += 31) P.push(['r', x, 0, 1, 74, 7]);
      P.push(['r', 0, 30, 281, 1, 8], ['r', 0, 70, 281, 4, 7], ['r', 0, 74, 281, 1, 8], ['r', 0, 75, 281, 55, 6]);
      for(let x = -40; x < 330; x += 40) P.push(['l', x, 75, x + (x - 140) * .7, 130, 7]);
      P.push(['r', 0, 100, 281, 1, 7]);
    }
    return P;
  }
  const bgUrl = () => url('bg', 281, 130, bgProg(theme()), {bevel: false, outline: false});
  /* ---------- 物理の出来事の効果(世界の層。ドットの格子に乗せる) ---------- */
  /* 横に並べたコマの帯。f: コマ番号 → 描画命令 */
  function sheet(key, fw, fh, n, f, opt){ const P = []; for(let i = 0; i < n; i++) for(const op of f(i)){ const o = op.slice(); if(o[0] === 'r' || o[0] === 'e') o[1] += i * fw; else if(o[0] === 'l'){ o[1] += i * fw; o[3] += i * fw; } else if(o[0] === 'd') o[1] = o[1].map(([x, y]) => [x + i * fw, y]); else if(o[0] === 'p') o[1] = o[1].map(([x, y]) => [x + i * fw, y]); P.push(o); } return url('sheet:' + key, fw * n, fh, P, Object.assign({bevel: false, outline: false}, opt)); }
  const arc = (cx, cy, r, a0, a1, c, step) => { const pts = []; for(let a = a0; a <= a1; a += step || .18) pts.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]); return ['d', pts, c]; };
  const FX = {
    slash: () => sheet('slash', 22, 22, 4, i => [arc(11, 11, 9, -2.4 + i * .5, -2.4 + i * .5 + 1.6, i < 3 ? 20 : 12, .12), arc(11, 11, 8, -2.4 + i * .5, -2.4 + i * .5 + 1.4, i < 2 ? 12 : 11, .14), i < 3 ? arc(11, 11, 10, -2.2 + i * .5, -2.2 + i * .5 + 1.0, 11, .2) : null].filter(Boolean)),
    spark: () => sheet('spark', 11, 11, 4, i => { const r = 1 + i * 1.4, c = i < 2 ? 20 : i < 3 ? 12 : 11; return [['d', [[5, 5]], i < 2 ? 20 : 11], ['d', [[5, Math.round(5 - r)], [5, Math.round(5 + r)], [Math.round(5 - r), 5], [Math.round(5 + r), 5]], c], i > 0 ? ['d', [[Math.round(5 - r * .7), Math.round(5 - r * .7)], [Math.round(5 + r * .7), Math.round(5 + r * .7)], [Math.round(5 + r * .7), Math.round(5 - r * .7)], [Math.round(5 - r * .7), Math.round(5 + r * .7)]], 11] : null].filter(Boolean); }),
    hurt: () => sheet('hurt', 11, 11, 4, i => { const r = 1 + i * 1.4, c = i < 2 ? 20 : i < 3 ? 15 : 14; return [['d', [[5, 5]], i < 2 ? 20 : 14], ['d', [[5, Math.round(5 - r)], [5, Math.round(5 + r)], [Math.round(5 - r), 5], [Math.round(5 + r), 5]], c], i > 0 ? ['d', [[Math.round(5 - r * .7), Math.round(5 - r * .7)], [Math.round(5 + r * .7), Math.round(5 + r * .7)], [Math.round(5 + r * .7), Math.round(5 - r * .7)], [Math.round(5 - r * .7), Math.round(5 + r * .7)]], 14] : null].filter(Boolean); }),
    shield: () => sheet('shield', 30, 50, 4, i => [arc(15, 25, 13 + i, -1.3, 1.3, i < 2 ? 12 : 11, .09), arc(15, 25, 12 + i, -1.1, 1.1, i < 1 ? 20 : 11, .14)]),
  };
  const col = (i) => PAL[theme()][i];
  return {sheet: k => FX[k](), col, droidImg, foeSvg, artImg, bgUrl, has: k => !!FOE[k], clear: () => cache.clear(), url, draw};
})();
