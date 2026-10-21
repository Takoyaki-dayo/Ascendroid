// 敵と遭遇
// foes: 敵の種類
//   kind: 見た目 / hp: 耐久 / start: 最初の行動までのサイクル
//   pat: 行動パターン(上から順に繰り返す)
//     n: 行動名 / d: ダメージ / p: 狙う部位(calc 演算, arm 武装, out 出力, dur 耐久, mob 機動)
//     dl: 1つ前の行動からの間隔(サイクル) / ch: true なら溜め技(JUSTで潰せる)
//     kind:'delay' は自分へのディレイ(v: 量)
//     (実験用、今のデータでは未使用)hits: 多段(1サイクルおきに d を hits 回) / wind:{w, poise} 構え(行動の w サイクル前から poise 以上の一撃で潰れる)
//       guard:{w, s} ガード(行動の w サイクル前から s までのダメージを防ぐ) / counter:{w, d} 反撃の構え(窓の間、殴られるたびに d を返す)
//       rec: 隙(行動の後 rec サイクル、受けるダメージ1.5倍) / buff, all: 強化(行動の後に攻撃力+buff、all なら味方全員) / wt: 分岐のときの重み
//   react: 反応する。コスト min 以上のカードを使い始めると、1サイクル後に撃つ {min, n, d, p}
//   sync: 連携する。連携を持つ敵が同じサイクルに攻撃すると、それぞれダメージ+sync
//   pool: 倒したときの学習で出るカード候補
//   (実験用)ai:'rand' 行動を重み wt で選ぶ(同じ行動は3回続けない。次の行動は決まるまで見えない) / phase:{at, pat} 耐久が at 割を切ると行動の並びが pat に変わる
// encounters: 遭遇。fam は地図に出る系統、tier 1 は序盤から、2 は部屋3以降。elite / boss は特別な部屋
window.DATA = window.DATA || {};
DATA.foes = {
  drone:    {name:'警備ドローン', kind:'drone', hp:33, start:4,
    pat:[{n:'射撃', d:6, dl:6, p:'calc'}], pool:['jab','rapid','guard','flick']},
  drone2:   {name:'警備ドローン', kind:'drone', hp:33, start:7,
    pat:[{n:'射撃', d:6, dl:6, p:'out'}], pool:['jab','rapid','guard','flick']},
  linkA:    {name:'連携ドローン', kind:'link', hp:28, start:6, sync:4,
    pat:[{n:'連携射撃', d:4, dl:6, p:'arm'}], pool:['rapid','scan','backflow','hack']},
  linkB:    {name:'連携ドローン', kind:'link', hp:28, start:6, sync:4,
    pat:[{n:'連携射撃', d:4, dl:6, p:'mob'}], pool:['rapid','scan','backflow','hack']},
  scout:    {name:'斥候ユニット', kind:'scout', hp:24, start:2,
    pat:[{n:'刺突', d:3, dl:3, p:'out'}, {n:'刺突', d:3, dl:3, p:'mob'}], pool:['jab','flick','overclock','reload']},
  turret:   {name:'迎撃タレット', kind:'turret', hp:38, start:7, react:{min:4, n:'迎撃', d:6, p:'arm'},
    pat:[{n:'砲撃', d:8, dl:8, p:'dur'}], pool:['wall','parry','emp']},
  exec:     {name:'処刑ユニット', kind:'exec', hp:64, start:5,
    pat:[{n:'殴打', d:7, dl:6, p:'out'}, {n:'殴打', d:7, dl:6, p:'out'}, {n:'粉砕砲', d:21, dl:8, p:'dur', ch:true}], pool:['slash','blow','crackshot','wall']},
  hacker:   {name:'ハッカー', kind:'hacker', hp:26, start:6,
    pat:[{n:'割り込み', kind:'delay', v:4, dl:7}, {n:'射撃', d:5, dl:5, p:'calc'}], pool:['hack','backflow','overclock','timebomb','scan']},
  heavyExec:{name:'重処刑ユニット', kind:'exec', hp:86, start:5,
    pat:[{n:'殴打', d:8, dl:5, p:'out'}, {n:'薙ぎ払い', d:10, dl:6, p:'mob'}, {n:'粉砕砲', d:24, dl:7, p:'dur', ch:true}], pool:['blow','parry','timebomb','wall']},
  turretE:  {name:'迎撃タレット改', kind:'turret', hp:46, start:6, react:{min:4, n:'迎撃', d:7, p:'arm'},
    pat:[{n:'砲撃', d:9, dl:7, p:'dur'}], pool:['parry','emp','wall','timebomb']},
  warden:   {name:'管理AI ウォーデン', kind:'warden', hp:150, start:5, react:{min:6, n:'排除', d:9, p:'calc'},
    pat:[{n:'照射', d:7, dl:6, p:'calc'}, {n:'照射', d:7, dl:4, p:'arm'}, {n:'消去プロトコル', d:28, dl:9, p:'dur', ch:true}], pool:[]},
  escort:   {name:'随伴ドローン', kind:'drone', hp:26, start:3,
    pat:[{n:'射撃', d:5, dl:5, p:'mob'}], pool:[]},
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
