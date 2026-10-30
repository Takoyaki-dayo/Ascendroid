// 自動生成(tools/text.js が text/*.csv から作る)。直接は編集せず、CSV を直して node tools/text.js
// ゲーム内の文章(カード・キーワード・パーツ・敵・イベント・セリフ・用語)を data の各ファイルに流し込む。data/*.js の後に読む
window.DATA = window.DATA || {};
(function apply(D, T){
  const tm = T.terms;
  for(const A of D.areas || []) if(tm['area.' + A.id]) A.name = tm['area.' + A.id];
  for(const k in D.rooms) if(tm['room.' + k]) D.rooms[k].name = tm['room.' + k];
  for(const s of D.slots) if(tm['slot.' + s.id]) s.fn = tm['slot.' + s.id];
  D.ui = {}; for(const k in tm) if(k.startsWith('ui.')) D.ui[k.slice(3)] = tm[k];
  for(const k in T.cards) if(D.cards[k]) Object.assign(D.cards[k], T.cards[k]);
  D.keywords = {}; D.kwName = {};
  for(const w of T.keywords){ D.keywords[w.name] = w.desc; D.kwName[w.key] = w.name; }
  for(const k in T.parts) if(D.parts[k]) Object.assign(D.parts[k], T.parts[k]);
  for(const k in (T.attrs || {})) if(D.attrs && D.attrs[k]) Object.assign(D.attrs[k], T.attrs[k]);
  for(const [id, n] of Object.entries(T.foes)){
    const [k, where, i] = id.split('.'), f = D.foes[k]; if(!f) continue;
    if(!where) f.name = n;
    else if(where === 'pat' && f.pat[+i]) f.pat[+i].n = n;
    else if(where === 'phase' && f.phase && f.phase.pat[+i]) f.phase.pat[+i].n = n;
    else if(where === 'react' && f.react) f.react.n = n;
    else if(where === 'unit' && f.units && f.units[i]) f.units[i].name = n;
    else if(where === 'passive') (f.pname = f.pname || {})[i] = n; // 番号は passives の何番目か。phase は段階変化の名前
    else if(where === 'say') (f.say = f.say || {})[i] = n; // 敵のひとこと(0.23.0): start / pat:番号 / phase:番号 / anger
    else if(where === 'broke' && f.broke){ const [uid, j] = i.split(':'); if(f.broke[uid] && f.broke[uid][+j]) f.broke[uid][+j].n = n; }
  }
  for(const e of [...(D.events || []), ...(D.transit || [])]){ const t = T.events[e.id]; if(!t) continue; e.title = t.title; e.text = t.text; t.choices.forEach((c, i) => { if(e.choices[i]) Object.assign(e.choices[i], c); }); }
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
  "reload": {
   "name": "再装填",
   "text": "カードを{draw}枚引く。"
  },
  "timebomb": {
   "name": "時限弾",
   "text": "{t}サイクル後、{tdmg}ダメージを与える。"
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
   "name": "電磁投射",
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
   "desc": "受けるダメージを数値分軽減し、軽減した分減少する。"
  },
  {
   "key": "delay",
   "name": "ディレイ",
   "desc": "敵のタイムラインを数値分遅らせる。敵は抵抗1を得る。"
  },
  {
   "key": "resist",
   "name": "抵抗",
   "desc": "受けるディレイが数値分減少する。行動すると消える。"
  },
  {
   "key": "crack",
   "name": "クラック",
   "desc": "受けるダメージが数値分増加する。"
  },
  {
   "key": "dot",
   "name": "持続",
   "desc": "回数/威力で表す。毎サイクル、威力分のダメージを受け、回数が1減少する。0になると消える。ブロックとクラックの影響を受けない。"
  },
  {
   "key": "atomic",
   "name": "アトミック",
   "desc": "発動前に攻撃を受けてもブレイクされない。"
  },
  {
   "key": "just",
   "name": "JUST",
   "desc": "敵の行動発動と同時にカードを発動すること。"
  },
  {
   "key": "charge",
   "name": "充電",
   "desc": "特定の行動で消費される。"
  },
  {
   "key": "unit",
   "name": "ユニット",
   "desc": "敵を構成する単位。耐久と状態はユニットごとに持つ。"
  },
  {
   "key": "vital",
   "name": "急所",
   "desc": "すべて破壊すると、その敵を撃破できるユニット。"
  },
  {
   "key": "chargeMove",
   "name": "不安定",
   "desc": "この行動にJUSTを重ねると、ブレイクする。"
  },
  {
   "key": "vuln",
   "name": "隙",
   "desc": "受けるダメージが1.5倍になる。"
  },
  {
   "key": "wind",
   "name": "体勢",
   "desc": "このサイクルの間、一度に一定値以上のダメージを受けると、ブレイクする。"
  },
  {
   "key": "break",
   "name": "ブレイク",
   "desc": "行動が止まること。止まった行動は飛ばされ、次の行動に進む。"
  },
  {
   "key": "guard",
   "name": "防壁",
   "desc": "このサイクルの間、合計で一定値までのダメージを防ぐ。"
  },
  {
   "key": "counter",
   "name": "反撃",
   "desc": "このサイクルの間、攻撃を受けるたびに一定値のダメージを与える。"
  },
  {
   "key": "str",
   "name": "増幅",
   "desc": "攻撃で与えるダメージが数値分増加する。"
  },
  {
   "key": "haste",
   "name": "加速",
   "desc": "行動のコストが数値分減少する。"
  },
  {
   "key": "zone",
   "name": "射界",
   "desc": "このサイクルの間、カードを発動すると、一定値のダメージを与える。"
  }
 ],
 "parts": {
  "calc_std": {
   "name": "〘標準演算核〙",
   "text": "JUSTでブレイクしたとき、その敵にクラック1を与える。"
  },
  "calc_par": {
   "name": "〘並列演算核〙",
   "text": "手札の上限+1。"
  },
  "calc_pre": {
   "name": "〘予測演算核〙",
   "text": "JUSTでブレイクしたとき、その敵にディレイ2を与える。"
  },
  "arm_rail": {
   "name": "〘CXR34レールガン〙",
   "text": "遠隔ダメージ+1。デッキに《電磁投射》2枚を加える。"
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
   "text": "近接ダメージ+1。"
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
   "text": "得るブロック+1。"
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
   "text": "戦闘開始時、敵にディレイ2を与える。ディレイを受けたとき、その敵にディレイ1を与える。"
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
  "scout": "斥候機 SC-02",
  "scout.pat.0": "刺突",
  "scout.pat.1": "乱れ突き",
  "scout.pat.2": "踏み込み",
  "turret": "迎撃タレット",
  "turret.pat.0": "砲撃",
  "turret.pat.1": "装甲を重ねる",
  "turret.react": "迎撃",
  "exec": "処刑機 EX-07",
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
  "heavyExec": "重処刑機 EX-09",
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
  "hackerE": "電脳戦機 CY-04",
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
  "accel.passive.0": "最短周期",
  "twin": "双腕作業機",
  "twin.unit.core": "胴体",
  "twin.unit.armL": "左腕",
  "twin.unit.armR": "右腕",
  "twin.pat.0": "振り下ろし",
  "twin.pat.1": "掴み打ち",
  "twin.pat.2": "腕で防ぐ",
  "twin.pat.3": "叩きつけ",
  "bomber": "自爆機 BX-01",
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
  "squad.passive.1": "最短周期",
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
  "warden.phase.2": "装甲展開",
  "warden.phase.3": "照準域",
  "warden.phase.4": "報復態勢",
  "warden.phase.5": "消去プロトコル",
  "warden.passive.phase": "非常態勢",
  "scav": "拾い屋",
  "scav.pat.0": "くすねる",
  "scav.pat.1": "くすねる",
  "scav.pat.2": "くすねる",
  "scav.pat.3": "逃げ出す",
  "scav.passive.0": "盗品",
  "scav.say.start": "お、まだ動くのか。",
  "scav.say.pat:0": "いただき。",
  "scav.say.pat:3": "じゃあな。",
  "crusher": "圧縮機",
  "crusher.pat.0": "選別",
  "crusher.pat.1": "圧縮",
  "crusher.pat.2": "プレス",
  "crusher.passive.0": "腹の中",
  "crusher.say.start": "分別を開始します。",
  "crusher.say.pat:1": "可燃ごみ。",
  "clock": "工程管理機",
  "clock.pat.0": "打刻",
  "clock.pat.1": "打刻",
  "clock.pat.2": "打刻",
  "clock.pat.3": "定時処理",
  "clock.passive.0": "定刻",
  "clock.say.start": "定刻です。",
  "clock.say.pat:3": "終業時刻です。",
  "clock.say.anger": "遅延は認められません。",
  "welder": "溶接機",
  "welder.unit.core": "胴体",
  "welder.unit.torch": "溶接腕",
  "welder.unit.clamp": "挟み腕",
  "welder.pat.0": "挟み込み",
  "welder.pat.1": "溶断",
  "welder.pat.2": "再溶接",
  "welder.pat.3": "溶断",
  "welder.say.start": "壊れているな。直してやろう。",
  "welder.say.pat:2": "よし、直った。",
  "hound": "猟犬",
  "hound.unit.h1": "一頭目",
  "hound.unit.h2": "二頭目",
  "hound.pat.0": "噛みつき",
  "hound.pat.1": "噛みつき",
  "hound.pat.2": "食らいつく",
  "hound.pat.3": "食らいつく",
  "hound.passive.0": "追跡",
  "hound.passive.1": "群れ"
 },
 "events": {
  "terminal": {
   "title": "放棄された端末",
   "text": "まだ電源が生きている。",
   "choices": [
    {
     "label": "接続する",
     "sub": "本体を6失う。珍しいカードを1枚得る。警戒が2上がる。"
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
     "sub": "スクラップを40得る。警戒が3上がる。"
    },
    {
     "label": "隙間から探る",
     "sub": "スクラップを10得る。"
    }
   ]
  },
  "lift": {
   "title": "昇降機",
   "text": "次の層へ向かう昇降機。整備用の端末が付いている。",
   "choices": [
    {
     "label": "整備する",
     "sub": "部位の損傷を直す。"
    },
    {
     "label": "記録を読む",
     "sub": "珍しいカードを1枚得る。"
    },
    {
     "label": "部品を売る",
     "sub": "スクラップを40得る。"
    }
   ]
  },
  "relay": {
   "title": "中継区画",
   "text": "上層への中継区画。物資と機材が残されている。",
   "choices": [
    {
     "label": "換装する",
     "sub": "パーツを1つ選んで付け替えられる。"
    },
    {
     "label": "最適化する",
     "sub": "デッキからカードを1枚取り除く。"
    },
    {
     "label": "痕跡を消す",
     "sub": "警戒が4下がる。"
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
     "{enemy}の体勢が浮いた。{poise}以上の一撃でブレイクできる。"
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
  "area.a1": "エリア1",
  "area.a2": "エリア2",
  "area.a3": "エリア3",
  "room.battle": "通常戦",
  "room.elite": "エリート",
  "room.rest": "整備",
  "room.shop": "ショップ",
  "room.event": "イベント",
  "room.duct": "保守通路",
  "room.boss": "ボス",
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
  "ui.mv.charge": "不安定。JUSTを重ねるとブレイクする。",
  "ui.mv.wind": "体勢{w}/{poise}：{w}サイクル前から、一度に{poise}以上のダメージを受けるとブレイクする。",
  "ui.mv.guard": "防壁{w}/{s}：{w}サイクル前から、合計で{s}までのダメージを防ぐ。",
  "ui.mv.counter": "反撃{w}/{cd}：{w}サイクル前から、攻撃を受けるたびに{cd}ダメージを与える。",
  "ui.mv.rec": "隙{rec}：行動の後{rec}サイクル、受けるダメージが1.5倍になる。",
  "ui.mv.buff": "行動の後、増幅{buff}を得る。",
  "ui.mv.buffAll": "行動の後、味方全員が増幅{buff}を得る。",
  "ui.mv.armor": "ブロック{armor}を得る。",
  "ui.mv.heal": "耐久を{heal}回復する。",
  "ui.mv.crack": "こちらにクラック{crack}を与える。こちらが受ける攻撃すべてのダメージ+{crack}。重なる。",
  "ui.mv.noise": "山札に《ノイズ》{noise}枚を混ぜる。",
  "ui.mv.summon": "{name}を呼ぶ。",
  "ui.mv.none": "攻撃はしない。",
  "ui.foe.react": "反応：コスト{min}以上のカードを使い始めると、1サイクル後に{part}に{d}ダメージを与える。",
  "ui.foe.sync": "連携：仲間と同じサイクルに攻撃すると、ダメージ+{sync}。",
  "ui.foe.rand": "これから先の行動は上のとおり。行動は下の中から選ばれ、同じ行動は3回続かない。",
  "ui.foe.phase": "耐久{at}%未満",
  "ui.stname.armor": "ブロック",
  "ui.stname.str": "増幅",
  "ui.stname.crack": "クラック",
  "ui.stname.vuln": "隙",
  "ui.stname.dot": "持続",
  "ui.st.armor": "受けるダメージを{n}まで軽減し、軽減した分減少する。",
  "ui.st.str": "攻撃のダメージ+{n}。",
  "ui.st.crack": "受けるダメージ+{n}。",
  "ui.st.vuln": "あと{n}サイクル、受けるダメージが1.5倍。",
  "ui.st.dot": "あと{n}サイクル、毎サイクル{p}ダメージを受ける。",
  "ui.st.none": "状態の変化はない。",
  "ui.mv.zone": "{at}サイクル後から{len}サイクルの間、こちらのタイムラインに射界を置く。その間にカードが発動すると{part}に{d}ダメージを受ける。",
  "ui.mv.haste": "加速{n}：これ以後、行動のコストが{n}減少する。",
  "ui.mv.steal": "スクラップを{n}盗む。",
  "ui.mv.flee": "戦闘から逃げる。逃げられると、戦闘のスクラップは得られない。",
  "ui.mv.eat": "手札でいちばんコストの高いカードを{n}枚飲み込む。",
  "ui.mv.rebuild": "破壊されたユニットを1つ、耐久{n}で直す。なければ耐久を{h}回復する。",
  "ui.pas.punctual": "ディレイを受けない。ディレイを与えられるたび、代わりに増幅{n}を得る。",
  "ui.pas.pursuit": "こちらが手札を入れ替えるか待機するたび、次の行動が{n}サイクル早まる。",
  "ui.pas.loot": "盗んだスクラップは、撃破すると取り戻せる。",
  "ui.pas.hoard": "飲み込んだカードは、撃破すると捨て札に戻る。",
  "ui.pas.floor": "行動のコストが{n}未満にならない。",
  "ui.attr.none": "この属性を付けられるカードがデッキに無い。",
  "ui.win.fled": "{name}に逃げられた。",
  "ui.win.loot": "取り戻した{n}",
  "ui.stname.haste": "加速",
  "ui.st.haste": "行動のコストが{n}縮んでいる。",
  "ui.stname.resist": "抵抗",
  "ui.st.resist": "次の行動まで、受けるディレイが{n}減る。ディレイを受けるたびに1増え、行動すると0に戻る。",
  "ui.unit.tag.core": "核",
  "ui.unit.tag.vital": "急所",
  "ui.foe.sec.pas": "パッシブ",
  "ui.foe.sec.units": "ユニット",
  "ui.foe.sec.moves": "行動",
  "ui.pas.command": "【{unit}】ユニットが破壊されていない間、すべての行動のコスト-{n}。",
  "ui.pas.frenzy": "ユニットが破壊されるたび、増幅{n}を得る。",
  "ui.pas.react": "コスト{min}以上のカードを使い始めると、1サイクル後に{part}に{d}ダメージを与える。",
  "ui.pas.phase": "耐久が{at}%を切ると、行動が変わる。",
  "ui.pas.broke": "【{unit}】ユニットが破壊されると、行動が変わる。",
  "ui.unit.core": "核。ほかのユニットからあふれたダメージを受ける。",
  "ui.unit.vital": "急所。急所のユニットがすべて破壊されると撃破。",
  "ui.unit.part": "破壊されると、このユニットの行動は飛ばされる。",
  "ui.unit.broken": "破壊",
  "ui.unit.rebuilt": "修復",
  "ui.band.before": "{name}({t}サイクル後)の前の窓。",
  "ui.band.after": "{name}({t}サイクル後)の後の隙。",
  "ui.band.hit": "選んでいるカードは{c}サイクル後に発動する。この帯に重なる。",
  "ui.band.miss": "選んでいるカードは{c}サイクル後に発動する。この帯には重ならない。",
  "ui.zone.now": "この帯の中でカードが発動すると、{part}に{d}ダメージを受ける。",
  "ui.zone.src": "{name}で置かれた。",
  "ui.part.dmg": "損傷",
  "ui.rd.battle": "敵と戦う。勝つとスクラップを得て、カードを1枚学習できる。",
  "ui.rd.elite": "強い敵と戦う。勝つとパーツを鹵獲できる。",
  "ui.rd.rest": "修理かデフラグのどちらかを行う。",
  "ui.rd.shop": "スクラップでカードや修理を買う。",
  "ui.rd.event": "何かが起こる。",
  "ui.rd.boss": "このエリアの主。倒すと踏破。",
  "ui.transit.heal": "本体を{n}回復した。",
  "ui.clear.sub": "すべてのエリアを踏破した。",
  "ui.rd.duct": "点検用の通路。何も起きないが、警戒が下がる。",
  "ui.alert": "警戒度",
  "ui.alert.desc": "工場がこちらに気付いている度合い。区画を進むと上がり、上がるほど敵は強く、報酬は多くなる。段階が上がると、出てくる敵も入れ替わる。",
  "ui.alert.enemy": "敵の耐久+{hp}%・攻撃+{d}%",
  "ui.alert.scrap": "戦闘のスクラップ+{n}%",
  "ui.alert.learn": "学習の候補+1枚",
  "ui.alert.part": "鹵獲の候補+1つ",
  "ui.alert.pool": "{lv}から出てくる敵が入れ替わる",
  "ui.alert.next": "次の段階まで{n}",
  "ui.alert.up": "警戒度が上がった",
  "ui.alert.poolUp": "出てくる敵が入れ替わった",
  "ui.duct.text": "点検用の狭い通路。工場の目がここまでは届かない。",
  "ui.alert.gauge": "警戒"
 },
 "attrs": {}
});
