// 0.7〜0.9 の敵(DATA.foes)と放置の代償つきの版(DATA.foesEsc)。実験 turns.js が読む。ゲームの敵は 0.10.0 で放置の代償つきの版に一本化した
// 敵と遭遇
// foes: 敵の種類
//   kind: 見た目 / hp: 耐久 / start: 最初の行動までのサイクル
//   pat: 行動パターン(上から順に繰り返す)
//     n: 行動名 / d: ダメージ(0なら攻撃しない行動) / p: 狙う部位(calc 演算, arm 武装, out 出力, dur 耐久, mob 機動)
//     dl: 1つ前の行動からの間隔(サイクル) / ch: true なら溜め技(JUSTで潰せる)
//     kind:'delay' は自分へのディレイ(v: 量)
//     hits: 多段(1サイクルおきに d を hits 回)
//     wind:{w, poise}  構え: 行動の w サイクル前から、poise 以上の一撃で行動が潰れる
//     guard:{w, s}     ガード: 行動の w サイクル前から、s までのダメージを防ぐ(行動で消える)
//     counter:{w, d}   反撃の構え: 窓の間、殴られるたびに d を撃ち返す
//     rec              隙: 行動の後 rec サイクル、受けるダメージ1.5倍
//     buff, all        強化: 行動の後に攻撃力+buff(all なら味方全員)
//     wt               分岐のときの重み
//   ai:'rand'  行動を重み wt で選ぶ(同じ行動は3回続けない)。次の行動は決まるまで見えない
//   phase:{at, pat}  耐久が at 割を切ると、行動の並びが pat に変わる
//   (放置の代償)armor 装甲を重ねる(消えずに積もり、ダメージを先に受ける) / heal 修復 / mark 照準(こちらが受ける攻撃すべて+mark)
//     noise ノイズを山札に混ぜる / summon 仲間を呼ぶ(敵の種類のキー)
//   react: 反応する。コスト min 以上のカードを使い始めると、1サイクル後に撃つ {min, n, d, p}
//   sync: 連携する。連携を持つ敵が同じサイクルに攻撃すると、それぞれダメージ+sync
//   pool: 倒したときの学習で出るカード候補
// encounters: 遭遇。fam は地図に出る系統、tier 1 は序盤から、2 は部屋3以降。elite / boss は特別な部屋
window.DATA = window.DATA || {};
DATA.foes = {
  drone:    {name:'警備ドローン', kind:'drone', hp:33, start:4, ai:'rand',
    pat:[{n:'射撃', d:7, dl:6, p:'calc', wt:2}, {n:'連射', d:4, hits:2, dl:5, p:'out', wt:1}], pool:['jab','rapid','guard','flick']},
  drone2:   {name:'警備ドローン', kind:'drone', hp:33, start:7, ai:'rand',
    pat:[{n:'射撃', d:7, dl:6, p:'out', wt:2}, {n:'連射', d:4, hits:2, dl:5, p:'mob', wt:1}], pool:['jab','rapid','guard','flick']},
  linkA:    {name:'連携ドローン', kind:'link', hp:28, start:6, sync:4,
    pat:[{n:'連携射撃', d:6, dl:6, p:'arm'}, {n:'陣形', d:0, dl:4, guard:{w:4, s:8}}], pool:['rapid','scan','backflow','hack']},
  linkB:    {name:'連携ドローン', kind:'link', hp:28, start:6, sync:4,
    pat:[{n:'連携射撃', d:6, dl:6, p:'mob'}, {n:'陣形', d:0, dl:4, guard:{w:4, s:8}}], pool:['rapid','scan','backflow','hack']},
  scout:    {name:'斥候ユニット', kind:'scout', hp:24, start:2, ai:'rand',
    pat:[{n:'刺突', d:4, dl:3, p:'out', wt:2}, {n:'乱れ突き', d:3, hits:3, dl:5, p:'mob', wt:1}, {n:'踏み込み', d:8, dl:5, p:'out', wind:{w:2, poise:6}, rec:2, wt:1}],
    pool:['jab','flick','overclock','reload']},
  turret:   {name:'迎撃タレット', kind:'turret', hp:38, start:7, react:{min:4, n:'迎撃', d:6, p:'arm'},
    pat:[{n:'砲撃', d:9, dl:8, p:'dur'}, {n:'装甲展開', d:0, dl:4, guard:{w:4, s:12}}], pool:['wall','parry','emp']},
  exec:     {name:'処刑ユニット', kind:'exec', hp:64, start:5,
    pat:[{n:'殴打', d:8, dl:6, p:'out'}, {n:'殴打', d:8, dl:6, p:'out'}, {n:'粉砕砲', d:22, dl:8, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}],
    phase:{at:0.5, pat:[{n:'殴打', d:8, dl:5, p:'out'}, {n:'粉砕砲', d:22, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}]},
    pool:['slash','blow','crackshot','wall']},
  hacker:   {name:'ハッカー', kind:'hacker', hp:26, start:6,
    pat:[{n:'割り込み', kind:'delay', v:4, dl:7}, {n:'射撃', d:7, dl:5, p:'calc', counter:{w:5, d:3}}], pool:['hack','backflow','overclock','timebomb','scan']},
  heavyExec:{name:'重処刑ユニット', kind:'exec', hp:86, start:5,
    pat:[{n:'殴打', d:9, dl:5, p:'out'}, {n:'薙ぎ払い', d:6, hits:2, dl:6, p:'mob'}, {n:'粉砕砲', d:26, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}],
    phase:{at:0.5, pat:[{n:'過熱', d:0, dl:4, buff:2}, {n:'殴打', d:9, dl:5, p:'out'}, {n:'粉砕砲', d:26, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}]},
    pool:['blow','parry','timebomb','wall']},
  turretE:  {name:'迎撃タレット改', kind:'turret', hp:46, start:6, react:{min:4, n:'迎撃', d:7, p:'arm'},
    pat:[{n:'砲撃', d:10, dl:7, p:'dur'}, {n:'装甲展開', d:0, dl:4, guard:{w:4, s:14}}], pool:['parry','emp','wall','timebomb']},
  warden:   {name:'管理AI ウォーデン', kind:'warden', hp:150, start:5, react:{min:6, n:'排除', d:9, p:'calc'},
    pat:[{n:'照射', d:8, dl:6, p:'calc'}, {n:'照射', d:8, dl:4, p:'arm'}, {n:'防壁', d:0, dl:5, guard:{w:5, s:20}}, {n:'消去プロトコル', d:30, dl:9, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{n:'照射', d:8, dl:5, p:'calc'}, {n:'報復態勢', d:10, dl:6, p:'arm', counter:{w:5, d:4}}, {n:'消去プロトコル', d:30, dl:8, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}]},
    pool:[]},
  escort:   {name:'随伴ドローン', kind:'drone', hp:26, start:3, ai:'rand',
    pat:[{n:'射撃', d:6, dl:5, p:'mob', wt:2}, {n:'増幅', d:0, dl:6, buff:2, all:true, wt:1}], pool:[]},
};

// 放置の代償を持つ版(区切りの型=固定ターン・再装填で使う)。ここにある敵は行動の並びを差し替える
DATA.foesEsc = {
  drone:  {pat:[{n:'射撃', d:7, dl:6, p:'calc', wt:2}, {n:'連射', d:4, hits:2, dl:5, p:'out', wt:1}, {n:'照準', d:0, dl:5, mark:1, wt:1}]},
  drone2: {pat:[{n:'射撃', d:7, dl:6, p:'out', wt:2}, {n:'連射', d:4, hits:2, dl:5, p:'mob', wt:1}, {n:'照準', d:0, dl:5, mark:1, wt:1}]},
  linkA:  {pat:[{n:'連携射撃', d:6, dl:6, p:'arm'}, {n:'陣形', d:0, dl:4, armor:5}]},
  linkB:  {pat:[{n:'連携射撃', d:6, dl:6, p:'mob'}, {n:'陣形', d:0, dl:4, armor:5}]},
  turret: {pat:[{n:'砲撃', d:9, dl:8, p:'dur'}, {n:'装甲を重ねる', d:0, dl:4, armor:8}]},
  turretE:{pat:[{n:'砲撃', d:10, dl:7, p:'dur'}, {n:'装甲を重ねる', d:0, dl:4, armor:10}]},
  exec:   {pat:[{n:'殴打', d:8, dl:6, p:'out'}, {n:'充填', d:0, dl:5, buff:3, wind:{w:3, poise:12}}, {n:'粉砕砲', d:22, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}]},
  hacker: {pat:[{n:'割り込み', kind:'delay', v:4, dl:7}, {n:'射撃', d:7, dl:5, p:'calc', counter:{w:5, d:3}}, {n:'ノイズ注入', d:0, dl:5, noise:2}]},
  warden: {pat:[{n:'照射', d:8, dl:6, p:'calc'}, {n:'照射', d:8, dl:4, p:'arm'}, {n:'修復', d:0, dl:5, heal:15, wind:{w:4, poise:15}}, {n:'消去プロトコル', d:30, dl:9, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{n:'照射', d:8, dl:5, p:'calc'}, {n:'増援要請', d:0, dl:5, summon:'escort', wind:{w:4, poise:15}}, {n:'報復態勢', d:10, dl:6, p:'arm', counter:{w:5, d:4}}, {n:'消去プロトコル', d:30, dl:8, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}]}},
};

DATA.encounters = {
  n_guard:{fam:'警備', tier:1, foes:['drone','drone2']},
  n_scout:{fam:'斥候', tier:1, foes:['scout','drone']},
  n_link: {fam:'連携', tier:1, foes:['linkA','linkB']},
  n_net:  {fam:'電脳', tier:2, foes:['hacker','scout']},
  n_def:  {fam:'防衛', tier:2, foes:['turret','drone']},
  n_proc: {fam:'処理', tier:2, foes:['exec']},
  e_proc: {fam:'処理', elite:true, foes:['heavyExec','scout']},
  e_def:  {fam:'防衛', elite:true, foes:['turretE','linkA','linkB']},
  e_net:  {fam:'電脳', elite:true, foes:['exec','hacker']},
  boss:   {fam:'中枢', boss:true, foes:['warden','escort']},
};
