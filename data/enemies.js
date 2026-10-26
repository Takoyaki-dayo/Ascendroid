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
//   (放置の代償。0.10.0 から全キャラ共通の敵に入っている)armor 装甲を重ねる(消えずに積もり、ダメージを先に受ける) / heal 修復 / crack こちらにクラック(受ける攻撃すべて+crack)
//     noise ノイズを山札に混ぜる / summon 仲間を呼ぶ(敵の種類のキー)
//   parts: 部位 {キー: {hp, vital(急所。すべて壊れると撃破), core(核。ほかの部位からあふれたダメージを受ける), icon, armor}}。
//     書かなければ耐久 hp の核1つ。行動の by はその行動をする部位(壊れると飛ばされる。構え・ガード・反撃はその部位を叩いたときだけ効く)
//   broke: {部位: pat} その部位が壊れると行動の並びが変わる
//   haste 加速(これ以後、行動の間隔が縮む。最短2) / zone:{at, len, d, p} 危険域(at サイクル後から len サイクル、こちらがカードを使い終えると p に d)
//   react: 反応する。コスト min 以上のカードを使い始めると、1サイクル後に撃つ {min, d, p}
//   sync: 連携する。連携を持つ敵が同じサイクルに攻撃すると、それぞれダメージ+sync
//   pool: 倒したときの学習で出るカード候補
// encounters: 遭遇。敵は常に1体(0.15.0 から)。fam は系統、tier 1 は序盤から、2 は部屋3以降。elite / boss は特別な部屋
window.DATA = window.DATA || {};
DATA.foes = {
  drone:    {kind:'drone', hp:75, start:4, ai:'rand',
    pat:[{d:8, dl:6, p:'calc', wt:2}, {d:4, hits:2, dl:5, p:'out', wt:1}, {d:0, dl:5, crack:1, wt:1}], pool:['jab','rapid','guard','flick','capacitor','discharge']},
  scout:    {kind:'scout', hp:74, start:2, ai:'rand',
    pat:[{d:3, dl:3, p:'out', wt:2}, {d:3, hits:3, dl:5, p:'mob', wt:1}, {d:7, dl:5, p:'out', wind:{w:2, poise:6}, rec:2, wt:1}],
    pool:['jab','flick','overclock','reload','coil','arc']},
  turret:   {kind:'turret', hp:66, start:7, react:{min:4, d:4, p:'arm'},
    pat:[{d:7, dl:8, p:'dur'}, {d:0, dl:4, armor:8}], pool:['wall','parry','emp','cell']},
  exec:     {kind:'exec', hp:86, start:5,
    pat:[{d:7, dl:6, p:'out'}, {d:0, dl:5, buff:3, wind:{w:3, poise:12}}, {d:20, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}],
    phase:{at:0.5, pat:[{d:7, dl:5, p:'out'}, {d:20, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}]},
    pool:['slash','blow','crackshot','wall']},
  hacker:   {kind:'hacker', hp:81, start:6,
    pat:[{kind:'delay', v:4, dl:7}, {d:13, dl:5, p:'calc', counter:{w:5, d:5}}, {d:0, dl:5, noise:2}], pool:['hack','backflow','overclock','timebomb','scan']},
  heavyExec:{kind:'exec', hp:115, start:5,
    pat:[{d:12, dl:5, p:'out'}, {d:8, hits:2, dl:6, p:'mob'}, {d:34, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}],
    phase:{at:0.5, pat:[{d:0, dl:4, buff:2}, {d:12, dl:5, p:'out'}, {d:34, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}]},
    pool:['blow','parry','timebomb','wall']},
  turretE:  {kind:'turret', hp:90, start:6, react:{min:4, d:8, p:'arm'},
    pat:[{d:12, dl:7, p:'dur'}, {d:0, dl:4, armor:10}], pool:['parry','emp','wall','timebomb','storm']},
  hackerE:  {kind:'hacker', hp:118, start:5,
    pat:[{kind:'delay', v:4, dl:6}, {d:14, dl:5, p:'calc', counter:{w:5, d:6}}, {d:0, dl:5, noise:3}, {d:24, dl:7, p:'calc', ch:true, wind:{w:3, poise:12}, rec:3}],
    pool:['hack','backflow','overclock','timebomb','scan']},
  // 0.16.0〜: 危険域・加速。0.17.0: 部位を持つ敵(行動の列は1本、耐久と状態は部位ごと)
  scanner:  {kind:'drone', hp:75, start:3,
    pat:[{d:4, dl:5, p:'calc'}, {d:0, dl:4, zone:{at:3, len:3, d:5, p:'out'}}, {d:3, hits:2, dl:5, p:'mob'}], pool:['scan','crackshot','timebomb','hack']},
  accel:    {kind:'scout', hp:86, start:6,
    pat:[{d:7, dl:7, p:'out', haste:1}, {d:6, dl:7, p:'mob', haste:1}], pool:['blow','slash','overclock','flick']},
  twin:     {kind:'exec', start:4,
    parts:{core:{hp:78, vital:true, core:true, icon:'core'}, armL:{hp:43, icon:'arm'}, armR:{hp:43, icon:'arm'}},
    pat:[{by:'armL', d:7, dl:5, p:'out', wind:{w:2, poise:8}}, {by:'armR', d:4, hits:2, dl:4, p:'arm'}, {by:'armL', d:0, dl:4, guard:{w:3, s:8}}, {by:'armR', d:6, dl:5, p:'dur', rec:2}],
    pool:['parry','slash','rapid','wall']},
  bomber:   {kind:'turret', start:4,
    parts:{core:{hp:81, vital:true, core:true, icon:'core'}, gun:{hp:29, icon:'gun'}},
    pat:[{by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'mob'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'core', d:51, dl:6, p:'dur', ch:true, wind:{w:6, poise:16}}],
    pool:['blow','timebomb','backflow','parry']},
  squad:    {kind:'link', start:3,
    parts:{lead:{hp:16, vital:true, icon:'lead'}, gunner:{hp:15, vital:true, icon:'gun'}, shield:{hp:19, vital:true, icon:'shield', armor:6}},
    pat:[{by:'lead', d:0, dl:4, buff:1}, {by:'gunner', d:6, dl:3, p:'calc'}, {by:'shield', d:7, dl:4, p:'out', guard:{w:3, s:8}}, {by:'gunner', d:6, dl:3, p:'mob'}, {by:'gunner', d:6, dl:3, p:'arm'}],
    broke:{lead:[{by:'gunner', d:10, dl:3, p:'calc'}, {by:'shield', d:14, dl:3, p:'out'}, {by:'gunner', d:10, dl:4, p:'arm'}, {by:'shield', d:0, dl:5, armor:4}]},
    pool:['scatter','emp','crackshot','rapid']},
  swarm:    {kind:'drone', start:3,
    parts:{d1:{hp:10, vital:true, icon:'drone'}, d2:{hp:10, vital:true, icon:'drone'}, d3:{hp:10, vital:true, icon:'drone'}, d4:{hp:10, vital:true, icon:'drone'}},
    pat:[{by:'d1', d:4, dl:2, p:'calc'}, {by:'d2', d:4, dl:2, p:'out'}, {by:'d3', d:4, dl:2, p:'mob'}, {by:'d4', d:4, dl:2, p:'arm'}, {d:0, dl:5, crack:1}],
    pool:['scatter','emp','storm','flick']},
  tank:     {kind:'exec', start:4,
    parts:{core:{hp:96, vital:true, core:true, icon:'core', armor:10}, gun:{hp:48, icon:'gun'}, mg:{hp:29, icon:'gun'}, legs:{hp:48, icon:'leg'}},
    pat:[{by:'mg', d:3, hits:3, dl:4, p:'calc'}, {by:'legs', d:10, dl:5, p:'mob', guard:{w:3, s:10}}, {by:'mg', d:3, hits:3, dl:4, p:'out'}, {by:'gun', d:24, dl:6, p:'dur', ch:true, wind:{w:4, poise:14}, rec:3}, {by:'core', d:0, dl:4, armor:6}],
    pool:['blow','emp','storm','wall']},
  warden:   {kind:'warden', start:5,
    parts:{core:{hp:170, vital:true, core:true, icon:'core'}, eye:{hp:38, icon:'eye'}}, react:{min:6, d:10, p:'calc'},
    pat:[{d:10, dl:6, p:'calc'}, {d:10, dl:4, p:'arm'}, {d:0, dl:5, heal:15, wind:{w:4, poise:15}}, {d:34, dl:9, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{d:10, dl:5, p:'calc'}, {by:'eye', d:7, dl:3, p:'mob'}, {d:0, dl:4, armor:15, wind:{w:4, poise:15}}, {by:'eye', d:0, dl:3, zone:{at:2, len:3, d:8, p:'calc'}}, {d:11, dl:5, p:'arm', counter:{w:5, d:4}}, {d:34, dl:7, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}]},
    pool:[]},
};

DATA.encounters = {
  n_guard:{fam:'警備', tier:1, foes:['drone']},
  n_scout:{fam:'斥候', tier:1, foes:['scout']},
  n_def:  {fam:'防衛', tier:1, foes:['turret']},
  n_scan: {fam:'走査', tier:1, foes:['scanner']},
  n_swarm:{fam:'群体', tier:1, foes:['swarm']},
  n_net:  {fam:'電脳', tier:2, foes:['hacker']},
  n_proc: {fam:'処理', tier:2, foes:['exec']},
  n_accel:{fam:'暴走', tier:2, foes:['accel']},
  n_twin: {fam:'作業', tier:2, foes:['twin']},
  n_bomb: {fam:'自爆', tier:2, foes:['bomber']},
  n_squad:{fam:'小隊', tier:2, foes:['squad']},
  e_proc: {fam:'処理', elite:true, foes:['heavyExec']},
  e_def:  {fam:'防衛', elite:true, foes:['turretE']},
  e_net:  {fam:'電脳', elite:true, foes:['hackerE']},
  e_tank: {fam:'戦車', elite:true, foes:['tank']},
  boss:   {fam:'中枢', boss:true, foes:['warden']},
};
