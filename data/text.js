// 自動生成(tools/text.js が text/*.csv から作る)。直接は編集せず、CSV を直して node tools/text.js
// ゲーム内の文章(カード・キーワード・パーツ・敵・イベント・セリフ・用語)を data の各ファイルに流し込む。data/*.js の後に読む
window.DATA = window.DATA || {};
(function apply(D, T){
  const tm = T.terms;
  if(tm.area) D.area.name = tm.area;
  for(const k in D.rooms) if(tm['room.' + k]) D.rooms[k].name = tm['room.' + k];
  for(const k in D.lanes) if(tm['lane.' + k]) D.lanes[k].name = tm['lane.' + k];
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
  }
  for(const e of D.events || []){ const t = T.events[e.id]; if(!t) continue; e.title = t.title; e.text = t.text; t.choices.forEach((c, i) => { if(e.choices[i]) Object.assign(e.choices[i], c); }); }
  D.lines = {speaker: tm.speaker || '', rules: T.lines.rules, room: T.lines.room};
})(DATA, {
 "cards": {
  "flick": {
   "name": "瞬撃",
   "text": "{dmg}ダメージを与える。"
  },
  "scan": {
   "name": "スキャン",
   "text": "クラック{crack}を与える。カードを{draw}枚引く。"
  },
  "jab": {
   "name": "ジャブ",
   "text": "{dmg}ダメージを与える。"
  },
  "guard": {
   "name": "障壁展開",
   "text": "{block}ブロックを得る。"
  },
  "hack": {
   "name": "遅延ハック",
   "text": "ディレイ{delay}を与える。"
  },
  "overclock": {
   "name": "オーバークロック",
   "text": "スウィフト{swift}を得る。"
  },
  "reload": {
   "name": "再装填",
   "text": "カードを{draw}枚引く。"
  },
  "timebomb": {
   "name": "時限弾",
   "text": "時限{t}：{tdmg}ダメージを与える。"
  },
  "rapid": {
   "name": "速射",
   "text": "{dmg}ダメージを{x}回与える。"
  },
  "crackshot": {
   "name": "亀裂弾",
   "text": "{dmg}ダメージを与える。クラック{crack}を与える。"
  },
  "parry": {
   "name": "受け流し",
   "text": "{block}ブロックを得る。JUST：攻撃を無効にし、同じダメージを返す。"
  },
  "slash": {
   "name": "スラッシュ",
   "text": "{dmg}ダメージを与える。"
  },
  "wall": {
   "name": "防御姿勢",
   "text": "{block}ブロックを得る。"
  },
  "backflow": {
   "name": "逆流",
   "text": "敵全体にディレイ{delay}を与える。"
  },
  "scatter": {
   "name": "散弾",
   "text": "敵全体に{dmg}ダメージを与える。"
  },
  "charge": {
   "name": "チャージショット",
   "text": "アトミック。{dmg}ダメージを与える。"
  },
  "emp": {
   "name": "EMPパルス",
   "text": "敵全体に{dmg}ダメージを与える。"
  },
  "blow": {
   "name": "過負荷打撃",
   "text": "{dmg}ダメージを与える。"
  },
  "noise": {
   "name": "ノイズ",
   "text": "効果なし。使うか捨てると消える。"
  }
 },
 "keywords": [
  {
   "key": "block",
   "name": "ブロック",
   "desc": "部位が受けるダメージを、その値だけ防ぐ。全部位に効き、使い切るまで残る。"
  },
  {
   "key": "delay",
   "name": "ディレイ",
   "desc": "対象の次の行動を、その値のサイクルだけ遅らせる。"
  },
  {
   "key": "swift",
   "name": "スウィフト",
   "desc": "その値のサイクルだけ、自分だけが動ける。その間、敵の行動は進まない。"
  },
  {
   "key": "crack",
   "name": "クラック",
   "desc": "受けるダメージが、その値だけ増える。戦闘の終わりまで消えない。"
  },
  {
   "key": "atomic",
   "name": "アトミック",
   "desc": "使っている途中に攻撃を受けても中断されない。"
  },
  {
   "key": "timer",
   "name": "時限",
   "desc": "使ってから、その値のサイクルが経つと効果が出る。"
  },
  {
   "key": "just",
   "name": "JUST",
   "desc": "カードを使い終えたサイクルに、敵の行動が重なること。溜め技に重なると、その技を潰す。"
  }
 ],
 "parts": {
  "calc_std": {
   "name": "〘標準演算核〙",
   "text": "JUSTで溜め技を潰したとき、その敵にクラック1を与える。"
  },
  "calc_par": {
   "name": "〘並列演算核〙",
   "text": "手札の上限+1。"
  },
  "calc_pre": {
   "name": "〘予測演算核〙",
   "text": "JUSTで溜め技を潰したとき、スウィフト3を得る。"
  },
  "arm_rail": {
   "name": "〘CXR34レールガン〙",
   "text": "光学ダメージ+2。デッキに《チャージショット》2枚を加える。"
  },
  "arm_scat": {
   "name": "〘散弾ポッド〙",
   "text": "光学ダメージ+1。デッキに《散弾》2枚を加える。"
  },
  "arm_time": {
   "name": "〘時限投射機〙",
   "text": "光学ダメージ+1。デッキに《時限弾》2枚を加える。"
  },
  "out_std": {
   "name": "〘汎用マニピュレータ〙",
   "text": "物理ダメージ+2。"
  },
  "out_heavy": {
   "name": "〘重機アーム〙",
   "text": "コスト4以上のカードの物理ダメージ+6。"
  },
  "out_quick": {
   "name": "〘高速アクチュエータ〙",
   "text": "コスト2以下のカードの物理ダメージ+3。"
  },
  "dur_std": {
   "name": "〘標準フレーム〙",
   "text": "得るブロック+2。"
  },
  "dur_armor": {
   "name": "〘装甲フレーム〙",
   "text": "効果なし。"
  },
  "dur_react": {
   "name": "〘反応装甲〙",
   "text": "戦闘開始時、8ブロックを得る。"
  },
  "mob_std": {
   "name": "〘デトロイト噴射機構〙",
   "text": "戦闘開始時、スウィフト3を得る。ディレイを受けたとき、スウィフト2を得る。"
  },
  "mob_feed": {
   "name": "〘給弾リンク〙",
   "text": "戦闘開始時、追加でカードを2枚引く。"
  },
  "mob_dash": {
   "name": "〘瞬発スラスタ〙",
   "text": "コスト0のカードを使うたび、スウィフト1を得る。"
  }
 },
 "foes": {
  "drone": "警備ドローン",
  "drone.pat.0": "射撃",
  "drone.pat.1": "連射",
  "drone.pat.2": "照準",
  "drone2": "警備ドローン",
  "drone2.pat.0": "射撃",
  "drone2.pat.1": "連射",
  "drone2.pat.2": "照準",
  "linkA": "連携ドローン",
  "linkA.pat.0": "連携射撃",
  "linkA.pat.1": "陣形",
  "linkB": "連携ドローン",
  "linkB.pat.0": "連携射撃",
  "linkB.pat.1": "陣形",
  "scout": "斥候ユニット",
  "scout.pat.0": "刺突",
  "scout.pat.1": "乱れ突き",
  "scout.pat.2": "踏み込み",
  "turret": "迎撃タレット",
  "turret.pat.0": "砲撃",
  "turret.pat.1": "装甲を重ねる",
  "turret.react": "迎撃",
  "exec": "処刑ユニット",
  "exec.pat.0": "殴打",
  "exec.pat.1": "充填",
  "exec.pat.2": "粉砕砲",
  "exec.phase.0": "殴打",
  "exec.phase.1": "粉砕砲",
  "hacker": "ハッカー",
  "hacker.pat.0": "割り込み",
  "hacker.pat.1": "射撃",
  "hacker.pat.2": "ノイズ注入",
  "heavyExec": "重処刑ユニット",
  "heavyExec.pat.0": "殴打",
  "heavyExec.pat.1": "薙ぎ払い",
  "heavyExec.pat.2": "粉砕砲",
  "heavyExec.phase.0": "過熱",
  "heavyExec.phase.1": "殴打",
  "heavyExec.phase.2": "粉砕砲",
  "turretE": "迎撃タレット改",
  "turretE.pat.0": "砲撃",
  "turretE.pat.1": "装甲を重ねる",
  "turretE.react": "迎撃",
  "warden": "管理AI ウォーデン",
  "warden.pat.0": "照射",
  "warden.pat.1": "照射",
  "warden.pat.2": "修復",
  "warden.pat.3": "消去プロトコル",
  "warden.phase.0": "照射",
  "warden.phase.1": "増援要請",
  "warden.phase.2": "報復態勢",
  "warden.phase.3": "消去プロトコル",
  "warden.react": "排除",
  "escort": "随伴ドローン",
  "escort.pat.0": "射撃",
  "escort.pat.1": "増幅"
 },
 "events": {
  "terminal": {
   "title": "放棄された端末",
   "text": "まだ電源が生きている。",
   "choices": [
    {
     "label": "接続する",
     "sub": "本体を6失う。珍しいカードを1枚得る。"
    },
    {
     "label": "立ち去る",
     "sub": "何も起きない。"
    }
   ]
  },
  "coolant": {
   "title": "冷却液の漏れ",
   "text": "配管から冷却液が漏れている。",
   "choices": [
    {
     "label": "浴びる",
     "sub": "部位の損傷を直す。本体を6回復する。"
    },
    {
     "label": "回収する",
     "sub": "スクラップを20得る。"
    }
   ]
  },
  "wreck": {
   "title": "同型機の残骸",
   "text": "自分と同じ型番が刻まれている。",
   "choices": [
    {
     "label": "部品を取る",
     "sub": "パーツを1つ選んで付け替えられる。"
    },
    {
     "label": "記録を消す",
     "sub": "デッキからカードを1枚取り除く。"
    }
   ]
  },
  "cache": {
   "title": "封鎖された倉庫",
   "text": "錆びた扉の奥に物資が積まれている。",
   "choices": [
    {
     "label": "こじ開ける",
     "sub": "本体を4失う。スクラップを30得る。"
    },
    {
     "label": "隙間から探る",
     "sub": "スクラップを10得る。"
    }
   ]
  }
 },
 "lines": {
  "rules": [
   {
    "when": "bodyLow",
    "text": [
     "本体の損耗が限界に近い。"
    ]
   },
   {
    "when": "partBroken",
    "text": [
     "{part}、機能停止。"
    ]
   },
   {
    "when": "vulnNow",
    "text": [
     "{enemy}に隙がある。"
    ]
   },
   {
    "when": "windNow",
    "text": [
     "{enemy}が構えた。{poise}以上の一撃で崩せる。"
    ]
   },
   {
    "when": "chargeSoon",
    "text": [
     "{enemy}の{move}まで{t}サイクル。"
    ]
   },
   {
    "when": "handEmpty",
    "text": [
     "手札がない。"
    ]
   },
   {
    "when": "partWorn",
    "text": [
     "{part}の損傷が直っていない。"
    ]
   },
   {
    "when": "focus",
    "text": [
     "{part}に攻撃が集中している。"
    ]
   }
  ],
  "room": {
   "battle": [
    "搬入区画。",
    "処理区画。",
    "配電区画。"
   ],
   "elite": [
    "大型の反応がある。"
   ],
   "boss": [
    "中枢区画。"
   ]
  }
 },
 "terms": {
  "speaker": "K-7",
  "area": "エリア1",
  "room.battle": "通常戦",
  "room.elite": "エリート",
  "room.rest": "整備",
  "room.shop": "ショップ",
  "room.event": "イベント",
  "room.boss": "ボス",
  "lane.learn": "学習",
  "lane.salvage": "鹵獲",
  "lane.supply": "補給",
  "slot.calc": "演算",
  "slot.arm": "武装",
  "slot.out": "出力",
  "slot.dur": "耐久",
  "slot.mob": "機動",
  "ui.repair": "本体を{n}回復する。部位の損傷を直す。",
  "ui.defrag": "デッキからカードを1枚取り除く。"
 }
});
