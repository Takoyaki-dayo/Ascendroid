// 敵と遭遇(敵の名前と行動名は text/enemies.csv。キーは 敵.pat.番号 / 敵.phase.番号 / 敵.react)
// foes: 敵の種類
//   kind: 見た目 / hp: 耐久 / start: 最初の行動までのサイクル
//   pat: 行動パターン(上から順に繰り返す)
//     d: ダメージ(0なら攻撃しない行動) / p: 狙う部位(calc 演算, arm 武装, out 出力, dur 耐久, mob 機動)
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
//   (放置の代償。0.10.0 から全キャラ共通の敵に入っている)armor 装甲を重ねる(消えずに積もり、ダメージを先に受ける) / heal 修復 / mark 照準(こちらが受ける攻撃すべて+mark)
//     noise ノイズを山札に混ぜる / summon 仲間を呼ぶ(敵の種類のキー)
//   react: 反応する。コスト min 以上のカードを使い始めると、1サイクル後に撃つ {min, d, p}
//   sync: 連携する。連携を持つ敵が同じサイクルに攻撃すると、それぞれダメージ+sync
//   pool: 倒したときの学習で出るカード候補
// encounters: 遭遇。fam は地図に出る系統、tier 1 は序盤から、2 は部屋3以降。elite / boss は特別な部屋
window.DATA = window.DATA || {};
DATA.foes = {
  drone:    {kind:'drone', hp:33, start:4, ai:'rand',
    pat:[{d:7, dl:6, p:'calc', wt:2}, {d:4, hits:2, dl:5, p:'out', wt:1}, {d:0, dl:5, mark:1, wt:1}], pool:['jab','rapid','guard','flick']},
  drone2:   {kind:'drone', hp:33, start:7, ai:'rand',
    pat:[{d:7, dl:6, p:'out', wt:2}, {d:4, hits:2, dl:5, p:'mob', wt:1}, {d:0, dl:5, mark:1, wt:1}], pool:['jab','rapid','guard','flick']},
  linkA:    {kind:'link', hp:28, start:6, sync:4,
    pat:[{d:6, dl:6, p:'arm'}, {d:0, dl:4, armor:5}], pool:['rapid','scan','backflow','hack','capacitor','discharge']},
  linkB:    {kind:'link', hp:28, start:6, sync:4,
    pat:[{d:6, dl:6, p:'mob'}, {d:0, dl:4, armor:5}], pool:['rapid','scan','backflow','hack','capacitor','discharge']},
  scout:    {kind:'scout', hp:24, start:2, ai:'rand',
    pat:[{d:4, dl:3, p:'out', wt:2}, {d:3, hits:3, dl:5, p:'mob', wt:1}, {d:8, dl:5, p:'out', wind:{w:2, poise:6}, rec:2, wt:1}],
    pool:['jab','flick','overclock','reload','coil','arc']},
  turret:   {kind:'turret', hp:38, start:7, react:{min:4, d:6, p:'arm'},
    pat:[{d:9, dl:8, p:'dur'}, {d:0, dl:4, armor:8}], pool:['wall','parry','emp','cell']},
  exec:     {kind:'exec', hp:64, start:5,
    pat:[{d:8, dl:6, p:'out'}, {d:0, dl:5, buff:3, wind:{w:3, poise:12}}, {d:22, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}],
    phase:{at:0.5, pat:[{d:8, dl:5, p:'out'}, {d:22, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}]},
    pool:['slash','blow','crackshot','wall']},
  hacker:   {kind:'hacker', hp:26, start:6,
    pat:[{kind:'delay', v:4, dl:7}, {d:7, dl:5, p:'calc', counter:{w:5, d:3}}, {d:0, dl:5, noise:2}], pool:['hack','backflow','overclock','timebomb','scan']},
  heavyExec:{kind:'exec', hp:86, start:5,
    pat:[{d:9, dl:5, p:'out'}, {d:6, hits:2, dl:6, p:'mob'}, {d:26, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}],
    phase:{at:0.5, pat:[{d:0, dl:4, buff:2}, {d:9, dl:5, p:'out'}, {d:26, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}]},
    pool:['blow','parry','timebomb','wall']},
  turretE:  {kind:'turret', hp:46, start:6, react:{min:4, d:7, p:'arm'},
    pat:[{d:10, dl:7, p:'dur'}, {d:0, dl:4, armor:10}], pool:['parry','emp','wall','timebomb','storm']},
  warden:   {kind:'warden', hp:150, start:5, react:{min:6, d:9, p:'calc'},
    pat:[{d:8, dl:6, p:'calc'}, {d:8, dl:4, p:'arm'}, {d:0, dl:5, heal:15, wind:{w:4, poise:15}}, {d:30, dl:9, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{d:8, dl:5, p:'calc'}, {d:0, dl:5, summon:'escort', wind:{w:4, poise:15}}, {d:10, dl:6, p:'arm', counter:{w:5, d:4}}, {d:30, dl:8, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}]},
    pool:[]},
  escort:   {kind:'drone', hp:26, start:3, ai:'rand',
    pat:[{d:6, dl:5, p:'mob', wt:2}, {d:0, dl:6, buff:2, all:true, wt:1}], pool:[]},
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
