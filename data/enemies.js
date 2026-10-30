// 敵と遭遇(敵の名前と行動名は text/enemies.csv。キーは 敵.pat.番号 / 敵.phase.番号 / 敵.react / 敵.unit.ユニット / 敵.passive.番号)
// foes: 敵の種類
//   kind: 見た目(null なら本体の絵なし。ユニットごとの絵だけ) / look:{s, at:[x,y]} 本体の絵の大きさと位置 / hp: 耐久 / start: 最初の行動までのサイクル
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
//   units: ユニット {キー: {hp, vital(急所。すべて破壊されると撃破), core(核。ほかのユニットからあふれたダメージを受ける), icon, armor, at, spr, s}}。
//     書かなければ耐久 hp の核1つ。行動の by はその行動をするユニット(破壊されると飛ばされる。構え・ガード・反撃はそのユニットを叩いたときだけ効く)
//     画面での置き場所(0.18.0): 位置は本体の絵の中心からの [x, y]。at は耐久バーの上端の中央。spr があればユニット自身の絵を at に置き、バーはその下(s は絵の大きさ)
//     pt(0.18.2): 絵を持たないユニットの、本体の絵の中の在りか(絵の viewBox の座標)。印を置いてバーと線で結び、押すとそのユニットを狙う
//   passives: パッシブ [{k, ...}](js/engine.js の先頭に一覧)。反応(react)と段階変化(phase)も画面ではパッシブとして見せる
//   broke: {ユニット: pat} そのユニットが破壊されると行動の並びが変わる
//   haste 加速(これ以後、行動の間隔が縮む。下限はパッシブ floor、無ければ1) / zone:{at, len, d, p} 危険域(at サイクル後から len サイクル、こちらがカードを使い終えると p に d)
//   react: 反応する。コスト min 以上のカードを使い始めると、1サイクル後に撃つ {min, d, p}
//   sync: 連携する。連携を持つ敵が同じサイクルに攻撃すると、それぞれダメージ+sync
//   pool: 倒したときの学習で出るカード候補
//   (0.23.0) steal: スクラップを盗む(撃破すると取り戻す) / eat: 手札のいちばんコストの高いカードを飲み込む(撃破すると捨て札に戻る)
//     rebuild: 破壊されたユニットを1つ、耐久 rebuild で直す(なければ自分を rebuild の半分回復) / flee: 戦闘から逃げる(報酬のスクラップなし)
//   敵のひとこと(0.23.0): text/enemies.csv の 敵.say.start(戦闘の始め)・敵.say.pat:番号(その行動のとき)・敵.say.anger(定刻の敵がディレイを受けたとき)
// encounters: 遭遇。敵は常に1体(0.15.0 から)。fam は系統。どの通常戦がどこで出るかは data/map.js の areas の pools(警戒度ごと)。elite / boss は特別な部屋
window.DATA = window.DATA || {};
DATA.foes = {
  drone:    {kind:'drone', hp:75, start:4, ai:'rand',
    pat:[{d:8, dl:6, p:'calc', wt:2}, {d:4, hits:2, dl:5, p:'out', wt:1}, {d:0, dl:5, crack:1, wt:1}], pool:['jab','rapid','guard','flick','capacitor','discharge']},
  scout:    {kind:'scout', hp:74, start:2, ai:'rand',
    pat:[{d:3, dl:3, p:'out', wt:2}, {d:3, hits:3, dl:5, p:'mob', wt:1}, {d:7, dl:5, p:'out', wind:{w:2, poise:6}, rec:2, wt:1}],
    pool:['jab','flick','reload','coil','arc']},
  turret:   {kind:'turret', hp:66, start:7, react:{min:4, d:4, p:'arm'},
    pat:[{d:7, dl:8, p:'dur'}, {d:0, dl:4, armor:8}], pool:['wall','parry','emp','cell']},
  exec:     {kind:'exec', hp:86, start:5,
    pat:[{d:7, dl:6, p:'out'}, {d:0, dl:5, buff:3, wind:{w:3, poise:12}}, {d:20, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}],
    phase:{at:0.5, pat:[{d:7, dl:5, p:'out'}, {d:20, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}]},
    pool:['slash','blow','crackshot','wall']},
  hacker:   {kind:'hacker', hp:81, start:6,
    pat:[{kind:'delay', v:4, dl:7}, {d:13, dl:5, p:'calc', counter:{w:5, d:5}}, {d:0, dl:5, noise:2}], pool:['hack','backflow','timebomb','scan']},
  heavyExec:{kind:'exec', hp:115, start:5,
    pat:[{d:12, dl:5, p:'out'}, {d:8, hits:2, dl:6, p:'mob'}, {d:34, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}],
    phase:{at:0.5, pat:[{d:0, dl:4, buff:2}, {d:12, dl:5, p:'out'}, {d:34, dl:7, p:'dur', ch:true, wind:{w:3, poise:14}, rec:3}]},
    pool:['blow','parry','timebomb','wall']},
  turretE:  {kind:'turret', hp:90, start:6, react:{min:4, d:8, p:'arm'},
    pat:[{d:12, dl:7, p:'dur'}, {d:0, dl:4, armor:10}], pool:['parry','emp','wall','timebomb','storm']},
  hackerE:  {kind:'hacker', hp:118, start:5,
    pat:[{kind:'delay', v:4, dl:6}, {d:14, dl:5, p:'calc', counter:{w:5, d:6}}, {d:0, dl:5, noise:3}, {d:24, dl:7, p:'calc', ch:true, wind:{w:3, poise:12}, rec:3}],
    pool:['hack','backflow','timebomb','scan']},
  // 0.16.0〜: 危険域・加速。0.17.0〜: ユニットが複数ある敵(行動の列は1本、耐久と状態はユニットごと)
  scanner:  {kind:'drone', hp:75, start:3,
    pat:[{d:4, dl:5, p:'calc'}, {d:0, dl:4, zone:{at:3, len:3, d:5, p:'out'}}, {d:3, hits:2, dl:5, p:'mob'}], pool:['scan','crackshot','timebomb','hack']},
  accel:    {kind:'scout', hp:86, start:6,
    passives:[{k:'floor', n:2}],
    pat:[{d:7, dl:7, p:'out', haste:1}, {d:6, dl:7, p:'mob', haste:1}], pool:['blow','slash','flick']},
  twin:     {kind:'twin', start:4, look:{s:1.2, at:[0, -6]},
    units:{core:{hp:78, vital:true, core:true, icon:'core', at:[0, 56], pt:[30, 32]}, armL:{hp:43, icon:'arm', at:[-104, -14], pt:[8, 34]}, armR:{hp:43, icon:'arm', at:[104, -14], pt:[52, 34]}},
    pat:[{by:'armL', d:7, dl:5, p:'out', wind:{w:2, poise:8}}, {by:'armR', d:4, hits:2, dl:4, p:'arm'}, {by:'armL', d:0, dl:4, guard:{w:3, s:8}}, {by:'armR', d:6, dl:5, p:'dur', rec:2}],
    pool:['parry','slash','rapid','wall']},
  bomber:   {kind:'turret', start:4, look:{s:1.15, at:[0, -4]},
    units:{core:{hp:81, vital:true, core:true, icon:'core', at:[0, 56], pt:[30, 37]}, gun:{hp:29, icon:'gun', at:[-104, -22], pt:[8, 32]}},
    pat:[{by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'mob'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'core', d:51, dl:6, p:'dur', ch:true, wind:{w:6, poise:16}}],
    pool:['blow','timebomb','backflow','parry']},
  // 統率: 隊長が健在な間、行動の間隔-1。隊長を先に落とすと遅くなる
  squad:    {kind:null, start:4,
    units:{lead:{hp:14, vital:true, icon:'lead', spr:'leader', s:.8, at:[96, -22]}, gunner:{hp:13, vital:true, icon:'gun', spr:'trooper', s:.8, at:[-8, -10]}, shield:{hp:16, vital:true, icon:'shield', spr:'shieldman', s:.85, at:[-112, 0], armor:6}},
    passives:[{k:'command', unit:'lead', n:1}, {k:'floor', n:2}],
    pat:[{by:'lead', d:0, dl:5, buff:1}, {by:'gunner', d:6, dl:4, p:'calc'}, {by:'shield', d:7, dl:5, p:'out', guard:{w:3, s:8}}, {by:'gunner', d:6, dl:4, p:'mob'}, {by:'gunner', d:6, dl:4, p:'arm'}],
    pool:['scatter','emp','crackshot','rapid']},
  // 群体: 子機が破壊されるたび、残りの攻撃力+1
  swarm:    {kind:null, start:3,
    units:{d1:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[-118, -22]}, d2:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[-40, 6]}, d3:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[40, -30]}, d4:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[118, -2]}},
    passives:[{k:'frenzy', n:1}],
    pat:[{by:'d1', d:3, dl:2, p:'calc'}, {by:'d2', d:3, dl:2, p:'out'}, {by:'d3', d:3, dl:2, p:'mob'}, {by:'d4', d:3, dl:2, p:'arm'}, {d:0, dl:5, crack:1}],
    pool:['scatter','emp','storm','flick']},
  tank:     {kind:'tank', start:4, look:{s:1.1, at:[0, -8]},
    units:{core:{hp:96, vital:true, core:true, icon:'core', armor:10, at:[0, 56], pt:[31, 31]}, gun:{hp:48, icon:'gun', at:[-124, -34], pt:[-4, 16]}, mg:{hp:29, icon:'gun', at:[110, -50], pt:[49, 8]}, legs:{hp:48, icon:'leg', at:[-118, 24], pt:[9, 50]}},
    pat:[{by:'mg', d:3, hits:3, dl:4, p:'calc'}, {by:'legs', d:10, dl:5, p:'mob', guard:{w:3, s:10}}, {by:'mg', d:3, hits:3, dl:4, p:'out'}, {by:'gun', d:24, dl:6, p:'dur', ch:true, wind:{w:4, poise:14}, rec:3}, {by:'core', d:0, dl:4, armor:6}],
    pool:['blow','emp','storm','wall']},
  // 0.23.0: 警戒度のプールに合わせて足した、性格のはっきりした敵(名前は仮)
  // 拾い屋: スクラップを盗んで逃げる。逃げる行動は不安定(JUSTで止まる)
  scav:     {kind:'scav', hp:46, start:2, passives:[{k:'loot'}],
    pat:[{d:3, dl:3, p:'arm', steal:8}, {d:3, dl:3, p:'mob', steal:8}, {d:3, dl:3, p:'arm', steal:8}, {d:0, dl:4, flee:true, ch:true}],
    pool:['flick','reload','coil','scan']},
  // 圧縮機: 手札のいちばん重いカードを飲み込む。体勢を崩せば止まる。倒すと吐き出す
  crusher:  {kind:'crusher', hp:82, start:4, passives:[{k:'hoard'}],
    pat:[{d:5, dl:4, p:'dur'}, {d:0, dl:5, eat:1, wind:{w:3, poise:10}}, {d:11, dl:5, p:'out', rec:2}],
    pool:['wall','blow','reload','backflow']},
  // 工程管理機: 4サイクルごとに必ず動く。ディレイが効かず、遅らせようとすると怒る(増幅)
  clock:    {kind:'clock', hp:80, start:4, passives:[{k:'punctual', n:1}],
    pat:[{d:5, dl:4, p:'calc'}, {d:5, dl:4, p:'arm'}, {d:5, dl:4, p:'mob'}, {d:16, dl:4, p:'dur', ch:true}],
    pool:['parry','rapid','crackshot']},
  // 溶接機: 壊した腕を直してしまう。直す行動は体勢で止められる
  welder:   {kind:'welder', start:4, look:{s:1.15, at:[0, -6]},
    units:{core:{hp:72, vital:true, core:true, icon:'core', at:[0, 58], pt:[32, 32]}, torch:{hp:26, icon:'arm', at:[-112, -34], pt:[6, 30]}, clamp:{hp:30, icon:'arm', at:[-108, 30], pt:[12, 49]}},
    pat:[{by:'clamp', d:5, dl:4, p:'mob', guard:{w:2, s:6}}, {by:'torch', d:9, dl:5, p:'arm'}, {by:'core', d:0, dl:5, rebuild:20, wind:{w:3, poise:10}}, {by:'torch', d:9, dl:5, p:'out'}],
    pool:['parry','wall','slash','coil']},
  // 猟犬: 2頭の群れ。迷う(入れ替え・待機)と詰めてくる。片方を倒すと残りが逆上する
  hound:    {kind:null, start:3,
    units:{h1:{hp:40, vital:true, icon:'leg', spr:'hound', s:.9, at:[-86, -18]}, h2:{hp:40, vital:true, icon:'leg', spr:'hound', s:.9, at:[84, 8]}},
    passives:[{k:'pursuit', n:1}, {k:'frenzy', n:2}],
    pat:[{by:'h1', d:6, dl:3, p:'mob'}, {by:'h2', d:6, dl:3, p:'out'}, {by:'h1', d:4, hits:3, dl:4, p:'arm'}, {by:'h2', d:4, hits:3, dl:4, p:'dur'}],
    pool:['flick','rapid','emp','storm']},
  warden:   {kind:'warden', start:5, look:{s:1.25, at:[0, -8]},
    units:{core:{hp:170, vital:true, core:true, icon:'core', at:[0, 60], pt:[30, 40]}, eye:{hp:38, icon:'eye', at:[104, -44], pt:[30, 16]}}, react:{min:6, d:10, p:'calc'},
    pat:[{d:10, dl:6, p:'calc'}, {d:10, dl:4, p:'arm'}, {d:0, dl:5, heal:15, wind:{w:4, poise:15}}, {d:34, dl:9, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}],
    phase:{at:0.5, pat:[{d:10, dl:5, p:'calc'}, {by:'eye', d:7, dl:3, p:'mob'}, {d:0, dl:4, armor:15, wind:{w:4, poise:15}}, {by:'eye', d:0, dl:3, zone:{at:2, len:3, d:8, p:'calc'}}, {d:11, dl:5, p:'arm', counter:{w:5, d:4}}, {d:34, dl:7, p:'dur', ch:true, wind:{w:4, poise:15}, rec:3}]},
    pool:[]},
};

DATA.encounters = {
  n_guard:{fam:'警備', foes:['drone']},
  n_scout:{fam:'斥候', foes:['scout']},
  n_def:  {fam:'防衛', foes:['turret']},
  n_scan: {fam:'走査', foes:['scanner']},
  n_swarm:{fam:'群体', foes:['swarm']},
  n_net:  {fam:'電脳', foes:['hacker']},
  n_proc: {fam:'処理', foes:['exec']},
  n_accel:{fam:'暴走', foes:['accel']},
  n_twin: {fam:'作業', foes:['twin']},
  n_bomb: {fam:'自爆', foes:['bomber']},
  n_squad:{fam:'小隊', foes:['squad']},
  n_scav: {fam:'屑拾い', foes:['scav']},
  n_crush:{fam:'廃棄', foes:['crusher']},
  n_clock:{fam:'工程', foes:['clock']},
  n_weld: {fam:'修繕', foes:['welder']},
  n_hound:{fam:'追跡', foes:['hound']},
  e_proc: {fam:'処理', elite:true, foes:['heavyExec']},
  e_def:  {fam:'防衛', elite:true, foes:['turretE']},
  e_net:  {fam:'電脳', elite:true, foes:['hackerE']},
  e_tank: {fam:'戦車', elite:true, foes:['tank']},
  boss:   {fam:'中枢', boss:true, foes:['warden']},
  // エリア2・3 のボスは仮(エリアの倍率に boss の倍率を重ねる)
  boss2:  {fam:'戦車', boss:true, foes:['tank'], scale:{hp:1.4, d:1.05}},
  boss3:  {fam:'中枢', boss:true, foes:['warden'], scale:{hp:1.05, d:1}},
};
