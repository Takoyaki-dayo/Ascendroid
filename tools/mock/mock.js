/* 見本: 戦闘画面の作り直し。案A「解析」/ 案B「警告」を切り替えて、本体の戦闘をそのまま遊べる。
   本体の関数(関数宣言)を後から差し替える形で作っている。本体の index.html は変えない */
(() => {
  'use strict';
  const ls = {get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }};
  const root = document.documentElement;
  root.dataset.theme = ls.get('mock.theme') === 'b' ? 'b' : 'a';
  const TH = () => root.dataset.theme;
  const ENCS = [['n_guard', '警備ドローン'], ['mock_pair', '斥候機 + 警備ドローン'], ['n_def', '迎撃タレット']];
  DATA.encounters.mock_pair = Object.assign({}, DATA.encounters.n_scout, {foes: ['scout', 'drone']});
  let enc = ENCS.some(e => e[0] === ls.get('mock.enc')) ? ls.get('mock.enc') : ENCS[0][0];

  /* ---------- 世界の層: 絵の差し替え ---------- */
  /* 自機の絵は 21×34 ドット(63×102)。演出の基準点もそれに合わせる */
  Object.assign(DROID, {x: 133, y: 219, sx: 160, sy: 187});
  function applySprites(){
    if(!$('#pxbg')){ const d = document.createElement('div'); d.id = 'pxbg'; $('#world').prepend(d); }
    for(const k of ['drone', 'scout', 'turret']) SPR[k] = PXA.foeSvg(k);
    root.style.setProperty('--pxbg', `url(${PXA.bgUrl()})`);
    /* 初めて使う瞬間に絵を作ると一瞬止まるので、先に作っておく */
    for(const k of ['slash', 'spark', 'hurt', 'shield']) PXA.sheet(k);
    for(const p of [null, 'atk', 'hurt']) PXA.droidImg(new Set(), p);
  }
  let pose = null, sig = '';
  function brokenSet(){ const s = new Set(); if(S && S.b && S.b.parts) for(const k in S.b.parts) if(S.b.parts[k].cur <= 0) s.add(k); return s; }
  function drawDroid(force){
    const el = $('#droid'); if(!el) return;
    const dmg = brokenSet(), g = TH() + [...dmg].join() + (pose || '');
    if(!force && g === sig) return; sig = g;
    el.innerHTML = PXA.droidImg(dmg, pose);
  }
  droidArt = (dmg) => PXA.droidImg(dmg || new Set(), null, 'droidart');
  const _renderMe = renderMe;
  renderMe = function(){ _renderMe.apply(this, arguments); drawDroid(); };
  const _cardInner = cardInner;
  cardInner = function(k){ const h = _cardInner.apply(this, arguments); return h.replace(/<span class="cwm">.*?<\/span>/, `<span class="cwm px">${PXA.artImg(cardType(CARDS[k]))}</span>`); };
  afterimage = function(){
    const src = $('#droid img'); if(!src) return; const el = fxEl('after', 103, 168); el.appendChild(src.cloneNode(true));
    el.getBoundingClientRect(); el.style.transform = 'translateX(-15px)'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  };

  /* ---------- 世界の層: 物理の出来事(ドットの格子に乗せる) ---------- */
  const g3 = v => Math.round(v / 3) * 3;
  function sheetFx(kind, x, y, w, h, ms, cls){
    const el = fxEl('pxfx ' + (cls || ''), g3(x - w / 2), g3(y - h / 2), {width: w + 'px', height: h + 'px', backgroundImage: `url(${PXA.sheet(kind)})`, backgroundSize: `${w * 4}px ${h}px`, '--fw': w + 'px', animationDuration: ms + 'ms'});
    setTimeout(() => el.remove(), ms + 40); return el;
  }
  function pxBeam(to, from){
    from = from || {x: DROID.sx + 3, y: DROID.sy};
    const x0 = Math.round(from.x / 3), y0 = Math.round(from.y / 3), x1 = Math.round(to.x / 3), y1 = Math.round(to.y / 3);
    const mx = Math.min(x0, x1) - 2, my = Math.min(y0, y1) - 2, w = Math.abs(x1 - x0) + 5, h = Math.abs(y1 - y0) + 5;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for(let k = 0; k <= n; k++){ const x = Math.round(x0 + (x1 - x0) * k / n) - mx, y = Math.round(y0 + (y1 - y0) * k / n) - my;
      c.fillStyle = PXA.col(11); c.fillRect(x, y - 1, 1, 3); c.fillStyle = PXA.col(20); c.fillRect(x, y, 1, 1); }
    cv.className = 'pxfx pxbeam'; Object.assign(cv.style, {left: mx * 3 + 'px', top: my * 3 + 'px', width: w * 3 + 'px', height: h * 3 + 'px'});
    $('#fx').appendChild(cv); setTimeout(() => cv.remove(), 300);
  }
  function debris(x, y, cols, n, up){
    for(let k = 0; k < n; k++){
      const el = fxEl('pxbit', g3(x + (Math.random() - .5) * 40), g3(y + (Math.random() - .5) * 40)); el.style.background = PXA.col(cols[k % cols.length]);
      const dx = g3((Math.random() - .5) * 60), dy = g3(up ? -20 - Math.random() * 50 : (Math.random() - .5) * 60);
      el.getBoundingClientRect(); el.style.transform = `translate(${dx}px,${dy}px)`; el.style.opacity = '0';
      setTimeout(() => el.remove(), 620);
    }
  }
  shieldFx = function(){ sheetFx('shield', DROID.x + 21, DROID.y - 3, 90, 150, 420, 'pxshield'); };
  const _cardMotion = cardMotion;
  cardMotion = function(k, ti){
    const c = CARDS[k], t = cardType(c), d = $('#droid');
    const pts = c.all ? S.b.foes.filter(e => e.alive).flatMap(e => (GEOM.get(e.i) && GEOM.get(e.i).multi ? EN.liveUids(e) : [null]).map(k2 => unitCenter(e.i, k2)))
      : (c.tgt && ti != null ? [unitCenter(tFoe(ti), tUnit(ti) || EN.defaultUid(S.b.foes[tFoe(ti)]))] : []);
    if(t === 'melee'){ pulse(d, 'lunge', 380); for(const p of pts){ setTimeout(() => { sheetFx('slash', p.x, p.y - 6, 66, 66, 220, 'pxslash'); sheetFx('spark', p.x, p.y - 6, 33, 33, 200); osHit(p); }, 90); } return; }
    if(t === 'ranged'){ pulse(d, 'recoil', 320); for(const p of pts){ pxBeam(p); setTimeout(() => { sheetFx('spark', p.x, p.y, 33, 33, 200); osHit(p); }, 70); } return; }
    if(t === 'block' || t === 'parry'){ shieldFx(); return; }
    _cardMotion.apply(this, arguments);
  };
  const _hitMeFx = hitMeFx;
  hitMeFx = function(r){ _hitMeFx.apply(this, arguments); if(r.hurt){ sheetFx('hurt', DROID.x + 6, DROID.y - 30, 33, 33, 220); if(TH() === 'b') osSlice(); } };
  const _cardFx = cardFx;
  cardFx = function(x){
    _cardFx.apply(this, arguments);
    if(x.kind === 'kill'){ const el = foeEl(x.e), p = foeCenter(x.e); if(el){ el.classList.add('pxdie'); } debris(p.x, p.y, [5, 4, 8, 14, 20], 18, true); }
    if(x.kind === 'unitBreak'){ const p = unitCenter(x.e, x.unit); debris(p.x, p.y, [4, 8, 14], 10, false); }
  };

  /* ---------- OSの層: 案ごとの動き ---------- */
  /* 命中: A は照準の四隅が当たった点へ縮む(読み取りの確定) / B は角ばった照準が一瞬弾ける */
  function osHit(p){ const el = fxEl('oslock', g3(p.x), g3(p.y - 6)); setTimeout(() => el.remove(), 360); }
  /* B: 状態が変わった瞬間に、画面を横に切ってずらす */
  /* 被弾・JUST・中断は世界ごと、予定の書き換え(再走査)はOSの層だけを切る */
  function osSlice(osOnly){ pulse(osOnly ? $('#tl') : $('#shaker'), 'slice', 200); }
  const _justFx = justFx;
  justFx = function(i, tag){
    _justFx.apply(this, arguments);
    const el = fxEl('osjust', NOW, ROWY[i]); setTimeout(() => el.remove(), 620);
    pulse(document.body, 'freeze', TH() === 'a' ? 260 : 180);
    if(TH() === 'b') osSlice();
  };
  const _interruptFx = interruptFx;
  interruptFx = function(){ _interruptFx.apply(this, arguments); const el = fxEl('osbreak', 0, 0); setTimeout(() => el.remove(), 420); if(TH() === 'b') osSlice(); };
  const _rescan = rescan;
  rescan = function(tag){ _rescan.apply(this, arguments); if(TH() === 'b') osSlice(true); };

  /* ---------- 見本のメニュー ---------- */
  function menu(msg){
    let m = $('#mockMenu');
    if(!m){ m = document.createElement('div'); m.id = 'mockMenu'; $('#stage').appendChild(m);
      m.addEventListener('click', ev => { const b = ev.target.closest('button'); if(!b) return; ev.stopPropagation();
        if(b.dataset.th){ setTheme(b.dataset.th); menu(); }
        else if(b.dataset.enc){ enc = b.dataset.enc; ls.set('mock.enc', enc); menu(); }
        else if(b.dataset.mm === 'start'){ m.hidden = true; start(); }
        else if(b.dataset.mm === 'resume'){ m.hidden = true; } }); }
    const live = S && S.b && !S.b.over;
    m.innerHTML = `<div class="mm-box"><div class="mm-h"><b>戦闘画面の見本</b><span>${msg || '案を切り替えると、戦闘はそのまま見た目だけ変わる'}</span></div>
      <div class="mm-th">${[['a', '案A 解析', '明るい施設・静かな細い線・読み取りの動き'], ['b', '案B 警告', '暗い対比・角を切った枠・切り替わる瞬間のグリッチ']].map(([k, n, d]) => `<button type="button" data-th="${k}" class="${TH() === k ? 'on' : ''}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>
      <div class="mm-enc">${ENCS.map(([k, n]) => `<button type="button" data-enc="${k}" class="${enc === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="mm-go">${live ? '<button type="button" data-mm="resume" class="pri">続ける</button>' : ''}<button type="button" data-mm="start" class="${live ? '' : 'pri'}">${live ? 'この敵ではじめから' : 'この敵と戦う'}</button></div></div>`;
    m.hidden = false;
  }
  function setTheme(t){
    root.dataset.theme = t; ls.set('mock.theme', t); applySprites();
    if(S && S.b && UI.screen === 'battle'){ clearCards(); clearMarks(); buildFoes(); renderAll(); }
    drawDroid(true);
  }
  function start(){ newRun(); startBattle({type: 'battle', enc}); drawDroid(true); }
  showMenu = () => menu();
  onWin = () => { menu('撃破'); };
  onLose = () => { menu('大破'); };

  /* 自機の構え: 攻撃(突き・反動)と被弾(被弾・よろめき)の間だけ、絵を構えのコマに替える */
  new MutationObserver(() => { const c = $('#droid').classList, p = c.contains('lunge') || c.contains('recoil') ? 'atk' : c.contains('hit') || c.contains('stagger') ? 'hurt' : null; if(p !== pose){ pose = p; drawDroid(); } }).observe($('#droid'), {attributes: true, attributeFilter: ['class']});
  applySprites(); start(); menu();
  window.MOCK = {setTheme, start, menu, pxBeam, sheetFx, debris};
})();
