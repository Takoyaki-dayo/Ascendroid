// カード工房の保存先: GitHub の workbench ブランチの db.json(1ファイルに全部の文書)
// claude.ai の db と同じ形(collection / doc / set / update / delete / add / onSnapshot)で使えるようにする
// db.json は {"cards/jab": {...}, "config/deck": {...}, "requests/xxx": {...}} のように「パス: 文書」を並べたもの
// 書くたびに1コミット。ほかの人(Claude)が先に書いていたら読み直して、同じ変更を当て直す
(function(){
  'use strict';
  const REPO = 'Takoyaki-dayo/ascendroid', BRANCH = 'workbench', FILE = 'db.json';
  const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const TOKEN_KEY = 'asc.gh';
  const POLL = 30000;
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  function merge(a, b){ const r = isObj(a) ? a : {}; for(const [k, v] of Object.entries(b)){ if(isObj(v) && v.__delete__) delete r[k]; else r[k] = isObj(v) && isObj(r[k]) ? merge(r[k], v) : v; } return r; }
  function sortKeys(o){ const r = {}; for(const k of Object.keys(o).sort()) r[k] = o[k]; return r; }
  function b64dec(s){ const bin = atob(String(s).replace(/\s/g, '')); const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  function b64enc(str){ const u = new TextEncoder().encode(str); let bin = ''; for(let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); }
  function err(status, msg){ return Object.assign(new Error(msg || ('GitHub ' + status)), {status}); }

  function make(token, onState){
    let data = {}, sha = null, etag = null, loaded = false, timer = null, queue = Promise.resolve();
    const subs = [];
    const state = s => { try{ onState && onState(s); }catch(_){} };
    const H = () => ({'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'});
    const docSnap = p => ({id: p.split('/').pop(), exists: p in data, data: () => clone(data[p])});
    function emitOne(s){
      if(s.doc) s.fn(docSnap(s.doc));
      else { const pre = s.coll + '/', n = s.coll.split('/').length + 1; s.fn({docs: Object.keys(data).filter(k => k.startsWith(pre) && k.split('/').length === n).map(docSnap)}); }
    }
    function emit(){ for(const s of subs){ try{ emitOne(s); }catch(e){ console.error(e); } } }
    // 読む。変わっていなければ 304 で何も返らない(数に入らない)
    async function pull(force){
      const h = H(); if(etag && !force) h['If-None-Match'] = etag;
      const r = await fetch(`${API}?ref=${BRANCH}`, {headers: h, cache: 'no-store'});
      if(r.status === 304) return false;
      if(r.status === 404){ // まだファイルが無い
        if(!loaded){ data = {}; sha = null; loaded = true; emit(); }
        const b = await fetch(`https://api.github.com/repos/${REPO}`, {headers: H(), cache: 'no-store'});
        if(!b.ok) throw err(b.status);
        return true;
      }
      if(!r.ok) throw err(r.status);
      const j = await r.json(); etag = r.headers.get('ETag'); sha = j.sha;
      const txt = j.content ? b64dec(j.content) : '';
      data = txt.trim() ? JSON.parse(txt) : {}; loaded = true; emit(); return true;
    }
    async function tick(){
      if(document.visibilityState !== 'visible') return;
      try{ await pull(false); state('ok'); }catch(e){ state(e.status ? 'err' : 'off'); }
    }
    function start(){
      if(timer) return;
      timer = setInterval(tick, POLL);
      document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') tick(); });
    }
    // 書く: 手元の写しに変更を当てて PUT。先に誰かが書いていたら(409)読み直して当て直す
    function write(apply, msg){
      const job = queue.then(async () => {
        state('sync');
        for(let tries = 0; tries < 5; tries++){
          if(tries > 0 || !loaded) await pull(true);
          const next = clone(data); apply(next);
          const body = {message: msg, branch: BRANCH, content: b64enc(JSON.stringify(sortKeys(next), null, 1) + '\n')};
          if(sha) body.sha = sha;
          const r = await fetch(API, {method: 'PUT', headers: Object.assign(H(), {'Content-Type': 'application/json'}), body: JSON.stringify(body)});
          if(r.status === 409 || r.status === 422) continue;
          if(!r.ok){ state('err'); throw err(r.status); }
          const j = await r.json(); sha = j.content.sha; etag = null; data = next; emit(); state('ok'); return;
        }
        state('err'); throw err(409, '書き込みがぶつかりました');
      });
      queue = job.catch(() => {});
      return job;
    }
    const label = p => p.replace(/^cards\//, 'カード ').replace(/^requests\//, '依頼 ').replace(/^config\/deck$/, '最初のデッキ');
    function docRef(p){
      return {
        id: p.split('/').pop(),
        set: d => write(n => { n[p] = clone(d); }, '工房: ' + label(p)),
        update: d => write(n => { n[p] = merge(n[p] || {}, clone(d)); }, '工房: ' + label(p)),
        delete: () => write(n => { delete n[p]; }, '工房: ' + label(p) + ' を消す'),
        get: async () => { if(!loaded) await pull(true); return docSnap(p); },
        onSnapshot(fn, onErr){ const s = {doc: p, fn, onErr}; subs.push(s); start(); if(loaded) emitOne(s); return () => { const i = subs.indexOf(s); if(i >= 0) subs.splice(i, 1); }; },
      };
    }
    function collRef(c){
      return {
        doc: id => docRef(c + '/' + id),
        add: async d => { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await docRef(c + '/' + id).set(d); return {id}; },
        onSnapshot(fn, onErr){ const s = {coll: c, fn, onErr}; subs.push(s); start(); if(loaded) emitOne(s); return () => { const i = subs.indexOf(s); if(i >= 0) subs.splice(i, 1); }; },
      };
    }
    return {
      collection: collRef,
      doc: docRef,
      // つながるか確かめる(読めなければ投げる)。成功したら中身も読み込まれる
      check: () => pull(true),
      refresh: tick,
    };
  }
  window.GHDB = {
    make,
    // 端末に保存したトークン。引数があれば保存(null で消す)
    token(v){
      try{
        if(v === undefined) return localStorage.getItem(TOKEN_KEY) || '';
        if(v === null) localStorage.removeItem(TOKEN_KEY); else localStorage.setItem(TOKEN_KEY, v);
      }catch(_){ return ''; }
    },
  };
})();
