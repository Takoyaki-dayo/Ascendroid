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
    else if(where === 'unit' && f.units && f.units[i]) f.units[i].name = n;
    else if(where === 'passive') (f.pname = f.pname || {})[i] = n; // 番号は passives の何番目か。phase は段階変化の名前
    else if(where === 'broke' && f.broke){ const [uid, j] = i.split(':'); if(f.broke[uid] && f.broke[uid][+j]) f.broke[uid][+j].n = n; }
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
   "text": "ディレイ{delay}を与える。カードを{draw}枚引く。"
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
   "name": "連撃",
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
   "text": "ディレイ{delay}を与える。"
  },
  "scatter": {
   "name": "散弾",
   "text": "敵のすべてのユニットに{dmg}ダメージを与える。"
  },
  "charge": {
   "name": "チャージショット",
   "text": "アトミック。{dmg}ダメージを与える。"
  },
  "emp": {
   "name": "EMPパルス",
   "text": "敵のすべてのユニットに{dmg}ダメージを与える。"
  },
  "blow": {
   "name": "過負荷打撃",
   "text": "{dmg}ダメージを与える。"
  },
  "capacitor": {
   "name": "蓄電",
   "text": "充電{gain}を得る。"
  },
  "arc": {
   "name": "帯電打撃",
   "text": "{dmg}ダメージを与える。充電{gain}を得る。"
  },
  "coil": {
   "name": "補助電源",
   "text": "充電{gain}を得る。カードを{draw}枚引く。"
  },
  "discharge": {
   "name": "放電",
   "text": "充電をすべて消費し、1につき{per}ダメージを与える。"
  },
  "storm": {
   "name": "放電網",
   "text": "充電をすべて消費し、敵のすべてのユニットに1につき{per}ダメージを与える。"
  },
  "cell": {
   "name": "電磁障壁",
   "text": "充電をすべて消費し、1につき{per}ブロックを得る。"
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
  },
  {
   "key": "charge",
   "name": "充電",
   "desc": "自分に貯まる。消費する効果で使う。戦闘の終わりまで残る。"
  },
  {
   "key": "unit",
   "name": "ユニット",
   "desc": "敵を作る単位。耐久と状態はユニットごとに持つ。急所のユニットがすべて破壊されると撃破。"
  },
  {
   "key": "chargeMove",
   "name": "溜め技",
   "desc": "敵の大きな行動。カードを使い終えたサイクルが重なると、JUSTで潰せる。"
  },
  {
   "key": "armor",
   "name": "装甲",
   "desc": "受けるダメージを先に受け、その分だけ減る。時間では消えない。"
  },
  {
   "key": "vuln",
   "name": "隙",
   "desc": "受けるダメージが1.5倍になる。"
  },
  {
   "key": "wind",
   "name": "構え",
   "desc": "敵の行動の前のサイクル。その間に決まった値以上の一撃を与えると、その行動を潰せる。"
  },
  {
   "key": "guard",
   "name": "ガード",
   "desc": "敵の行動の前のサイクル。その間は、決まった値までのダメージを防がれる。"
  },
  {
   "key": "counter",
   "name": "反撃",
   "desc": "敵の行動の前のサイクル。その間に攻撃するたび、ダメージを返される。"
  },
  {
   "key": "str",
   "name": "強化",
   "desc": "攻撃のダメージが、その値だけ増える。"
  },
  {
   "key": "haste",
   "name": "加速",
   "desc": "行動のコストが、その値だけ縮む(最短2)。"
  },
  {
   "key": "zone",
   "name": "危険域",
   "desc": "こちらのタイムラインに置かれる区間。その間にカードを使い終えると攻撃を受ける。"
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
   "text": "JUSTで溜め技を潰したとき、その敵にディレイ3を与える。"
  },
  "arm_rail": {
   "name": "〘CXR34レールガン〙",
   "text": "遠隔ダメージ+2。デッキに《チャージショット》2枚を加える。"
  },
  "arm_scat": {
   "name": "〘散弾ポッド〙",
   "text": "遠隔ダメージ+1。デッキに《散弾》2枚を加える。"
  },
  "arm_time": {
   "name": "〘時限投射機〙",
   "text": "遠隔ダメージ+1。デッキに《時限弾》2枚を加える。"
  },
  "out_std": {
   "name": "〘汎用マニピュレータ〙",
   "text": "近接ダメージ+2。"
  },
  "out_heavy": {
   "name": "〘重機アーム〙",
   "text": "コスト4以上のカードの近接ダメージ+6。"
  },
  "out_quick": {
   "name": "〘高速アクチュエータ〙",
   "text": "コスト2以下のカードの近接ダメージ+3。"
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
   "text": "戦闘開始時、敵にディレイ3を与える。ディレイを受けたとき、その敵にディレイ2を与える。"
  },
  "mob_feed": {
   "name": "〘給弾リンク〙",
   "text": "戦闘開始時、追加でカードを2枚引く。"
  },
  "mob_dash": {
   "name": "〘瞬発スラスタ〙",
   "text": "コスト0のカードを使うたび、敵にディレイ1を与える。"
  }
 },
 "foes": {
  "drone": "警備ドローン",
  "drone.pat.0": "射撃",
  "drone.pat.1": "連射",
  "drone.pat.2": "照準",
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
  "exec.passive.phase": "処刑態勢",
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
  "heavyExec.passive.phase": "暴走",
  "turretE": "迎撃タレット改",
  "turretE.pat.0": "砲撃",
  "turretE.pat.1": "装甲を重ねる",
  "turretE.react": "迎撃",
  "hackerE": "電脳戦ユニット",
  "hackerE.pat.0": "強制割り込み",
  "hackerE.pat.1": "迎撃射撃",
  "hackerE.pat.2": "ノイズ散布",
  "hackerE.pat.3": "過負荷照射",
  "warden": "管理AI ウォーデン",
  "warden.pat.0": "照射",
  "warden.pat.1": "照射",
  "warden.pat.2": "修復",
  "warden.pat.3": "消去プロトコル",
  "warden.react": "排除",
  "scanner": "走査ドローン",
  "scanner.pat.0": "射撃",
  "scanner.pat.1": "走査線",
  "scanner.pat.2": "連射",
  "accel": "暴走機",
  "accel.pat.0": "突進",
  "accel.pat.1": "蹴撃",
  "twin": "双腕作業機",
  "twin.unit.core": "胴体",
  "twin.unit.armL": "左腕",
  "twin.unit.armR": "右腕",
  "twin.pat.0": "振り下ろし",
  "twin.pat.1": "掴み打ち",
  "twin.pat.2": "腕で防ぐ",
  "twin.pat.3": "叩きつけ",
  "bomber": "自爆ユニット",
  "bomber.unit.core": "炉心",
  "bomber.unit.gun": "防衛砲",
  "bomber.pat.0": "防衛射撃",
  "bomber.pat.1": "防衛射撃",
  "bomber.pat.2": "防衛射撃",
  "bomber.pat.3": "防衛射撃",
  "bomber.pat.4": "臨界",
  "squad": "第三警備小隊",
  "squad.unit.lead": "隊長",
  "squad.unit.gunner": "射手",
  "squad.unit.shield": "盾持ち",
  "squad.pat.0": "号令",
  "squad.pat.1": "制圧射撃",
  "squad.pat.2": "盾突撃",
  "squad.pat.3": "制圧射撃",
  "squad.pat.4": "制圧射撃",
  "squad.passive.0": "統率",
  "swarm": "ドローン群",
  "swarm.unit.d1": "子機1",
  "swarm.unit.d2": "子機2",
  "swarm.unit.d3": "子機3",
  "swarm.unit.d4": "子機4",
  "swarm.pat.0": "突撃",
  "swarm.pat.1": "突撃",
  "swarm.pat.2": "突撃",
  "swarm.pat.3": "突撃",
  "swarm.pat.4": "群体照準",
  "swarm.passive.0": "群体",
  "tank": "多脚戦車",
  "tank.unit.core": "車体",
  "tank.unit.gun": "主砲",
  "tank.unit.mg": "機銃",
  "tank.unit.legs": "脚部",
  "tank.pat.0": "掃射",
  "tank.pat.1": "踏みつけ",
  "tank.pat.2": "掃射",
  "tank.pat.3": "徹甲砲",
  "tank.pat.4": "装甲展開",
  "warden.unit.core": "中枢核",
  "warden.unit.eye": "監視砲",
  "warden.phase.0": "照射",
  "warden.phase.1": "狙撃",
  "warden.phase.2": "防壁展開",
  "warden.phase.3": "照準域",
  "warden.phase.4": "報復態勢",
  "warden.phase.5": "消去プロトコル",
  "warden.passive.phase": "非常態勢"
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
  "ui.defrag": "デッキからカードを1枚取り除く。",
  "ui.mv.atk": "{part}に{d}ダメージを与える。",
  "ui.mv.hits": "{part}に{d}ダメージを{hits}回与える。",
  "ui.mv.delay": "こちらにディレイ{v}を与える。",
  "ui.mv.charge": "溜め技。JUSTで潰せる。",
  "ui.mv.wind": "構え{poise}：行動の{w}サイクル前から、{poise}以上の一撃でこの行動を潰せる。",
  "ui.mv.guard": "ガード{s}：行動の{w}サイクル前から、{s}までのダメージを防ぐ。",
  "ui.mv.counter": "反撃{cd}：行動の{w}サイクル前から、攻撃するたびに{cd}ダメージを返してくる。",
  "ui.mv.rec": "隙{rec}：行動の後{rec}サイクル、受けるダメージが1.5倍になる。",
  "ui.mv.buff": "行動の後、攻撃力+{buff}。",
  "ui.mv.buffAll": "行動の後、味方全員の攻撃力+{buff}。",
  "ui.mv.armor": "装甲{armor}を得る。装甲は消えず、ダメージを先に受ける。",
  "ui.mv.heal": "耐久を{heal}回復する。",
  "ui.mv.crack": "こちらにクラック{crack}を与える。こちらが受ける攻撃すべてのダメージ+{crack}。重なる。",
  "ui.mv.noise": "山札に《ノイズ》{noise}枚を混ぜる。",
  "ui.mv.summon": "{name}を呼ぶ。",
  "ui.mv.none": "攻撃はしない。",
  "ui.foe.react": "反応：コスト{min}以上のカードを使い始めると、1サイクル後に{part}に{d}ダメージを与える。",
  "ui.foe.sync": "連携：仲間と同じサイクルに攻撃すると、ダメージ+{sync}。",
  "ui.foe.rand": "これから先の行動は上のとおり。行動は下の中から選ばれ、同じ行動は3回続かない。",
  "ui.foe.phase": "耐久{at}%未満",
  "ui.stname.armor": "装甲",
  "ui.stname.str": "強化",
  "ui.stname.crack": "クラック",
  "ui.stname.vuln": "隙",
  "ui.st.armor": "受けるダメージを先に装甲が受け、その分だけ減る。装甲は時間では消えない。",
  "ui.st.str": "攻撃のダメージ+{n}。",
  "ui.st.crack": "受けるダメージ+{n}。戦闘の終わりまで消えない。",
  "ui.st.vuln": "あと{n}サイクル、受けるダメージが1.5倍。",
  "ui.st.none": "状態の変化はない。",
  "ui.mv.zone": "{at}サイクル後から{len}サイクルの間、こちらのタイムラインに危険域を置く。その間にカードを使い終えると{part}に{d}ダメージを受ける。",
  "ui.mv.haste": "加速{n}：これ以後、行動のコストが{n}縮む(最短2)。",
  "ui.stname.haste": "加速",
  "ui.st.haste": "行動のコストが{n}縮んでいる(最短2)。",
  "ui.pas.command": "【{unit}】ユニットが破壊されていない間、すべての行動のコスト-{n}(最短2)。",
  "ui.pas.frenzy": "ユニットが破壊されるたび、攻撃力+{n}。",
  "ui.pas.react": "コスト{min}以上のカードを使い始めると、1サイクル後に{part}に{d}ダメージを与える。",
  "ui.pas.phase": "耐久が{at}%を切ると、行動が変わる。",
  "ui.pas.broke": "【{unit}】ユニットが破壊されると、行動が変わる。",
  "ui.unit.core": "核。ほかのユニットからあふれたダメージを受ける。",
  "ui.unit.vital": "急所。急所のユニットがすべて破壊されると撃破。",
  "ui.unit.part": "破壊されると、このユニットの行動は飛ばされる。",
  "ui.unit.broken": "破壊",
  "ui.band.before": "{name}({t}サイクル後)の前の窓。",
  "ui.band.after": "{name}({t}サイクル後)の後の隙。",
  "ui.band.hit": "選んでいるカードは{c}サイクル後に使い終わる。この帯に重なる。",
  "ui.band.miss": "選んでいるカードは{c}サイクル後に使い終わる。この帯には重ならない。",
  "ui.zone.now": "この升のサイクルにカードを使い終えると、{part}に{d}ダメージを受ける。",
  "ui.zone.src": "{name}で置かれた。"
 }
});
