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
//   敵のひとこと(0.23.0): text/enemies.csv の 敵.say.start(戦闘の始め)・敵.say.pat:番号(その行動のとき)・敵.say.anger(定刻の敵がディレイを受けたとき)・敵.say.phase(段階変化したとき、0.33.0)。同じキーを並べると複数(どれか1つ)
//   wary(0.30.0): 警戒版 [{at, ...}]。警戒度が at 以上の遭遇では、書いた欄で置き換えた形で出る(いちばん高い at を1つ)
//     書いた欄は丸ごと置き換える(0.38.0 から passives も一覧ごと)。patAdd だけは行動の並びの最後に足す(古い書き方)。警戒版を持つ敵は警戒度の数値の上乗せを受けない
//     工房の敵のページでは、上の「警戒版」の切り替えで全体の姿のまま編集でき、変わった欄だけがここに入る。例: wary:[{at:5, passives:[{k:'punctual', n:1}]}]
// encounters: 遭遇。敵は常に1体(0.15.0 から)。fam は系統。どの通常戦がどこで出るかは data/map.js の areas の pools(警戒度ごと)。elite / boss は特別な部屋
window.DATA = window.DATA || {};
DATA.foes = {
  // 0.39.0: 狙ってから撃つ。照準は不安定で、ブレイクすると次の大きい射撃も飛ぶ(link)
  drone:    {kind:'drone', hp:75, start:4,
    pat:[{d:6, dl:2, p:'calc'}, {d:0, dl:4, ch:true, link:true, buff:1}, {d:18, dl:3, p:'calc'}], pool:['rapid','guard','flick','capacitor','careful','foresight','aim'],
    wary:[{at:3, pat:[{d:6, dl:2, p:'calc'}, {d:0, dl:3, ch:true, link:true, buff:6}, {d:18, dl:3, p:'calc'}]}]},
  // 0.39.0: 速くて脆いが、崩しても立ち直りが早い(立て直し2)
  scout:    {kind:'scout', hp:60, start:2, ai:'rand', passives:[{k:'recover', n:2}],
    pat:[{d:3, dl:3, p:'out', wt:2}, {d:3, hits:3, dl:5, p:'mob', wt:1}, {d:7, dl:5, p:'out', wind:{w:2, poise:6}, rec:2, wt:1}],
    pool:['jab','flick','reload','coil','arc']},
  turret:   {kind:'turret', hp:66, start:5, react:{min:4, d:4, p:'arm'},
    pat:[{d:7, dl:2, p:'dur'}, {d:0, dl:4, armor:8}], pool:['wall','parry','emp','cell'],
    // 0.40.0: 警戒III〜 堅固(ブロックを得るたび、その分が増える)と、ブロックが威力になる装甲投射
    wary:[{at:3, pat:[{d:7, dl:2, p:'dur'}, {d:0, dl:4, armor:8, fort:3}, {d:10, dl:1, p:'calc', armorDmg:3}]}]},
  exec:     {kind:'exec', hp:86, start:5,
    pat:[{d:7, dl:6, p:'out'}, {d:0, dl:5, buff:3, wind:{w:3, poise:12}}],
    phase:{at:0.5, pat:[{d:7, dl:5, p:'out'}, {d:20, dl:7, p:'dur', ch:true, wind:{w:3, poise:12}, rec:3}]},
    pool:['slash','blow','crackshot','wall']},
  hacker:   {kind:'hacker', hp:81, start:4,
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
    pat:[{d:4, dl:5, p:'calc'}, {d:0, dl:4, zone:{at:3, len:2, d:5, p:'out'}}, {d:0, dl:4, zone:{at:3, len:2, d:5, p:'out'}}, {d:3, hits:2, dl:5, p:'mob'}], pool:['scan','crackshot','timebomb','hack']},
  accel:    {kind:'scout', hp:86, start:6,
    passives:[{k:'floor', n:2}],
    pat:[{d:7, dl:7, p:'out', haste:1}, {d:6, dl:7, p:'mob', haste:1}, {d:10, dl:4, p:'dur'}], pool:['blow','slash','flick']},
  twin:     {kind:'twin', start:4, look:{s:1.2, at:[0, -6]},
    units:{core:{hp:78, vital:true, core:true, icon:'core', at:[0, 56], pt:[30, 32]}, armL:{hp:43, icon:'arm', at:[-104, -14], pt:[8, 34]}, armR:{hp:43, icon:'arm', at:[104, -14], pt:[52, 34]}},
    pat:[{by:'armL', d:7, dl:5, p:'out', wind:{w:2, poise:8}}, {by:'armR', d:4, hits:2, dl:4, p:'arm'}, {by:'armL', d:0, dl:4, guard:{w:3, s:8}}, {by:'armR', d:6, dl:5, p:'dur', rec:2}],
    pool:['parry','slash','rapid','wall']},
  bomber:   {kind:'turret', start:4, look:{s:1.15, at:[0, -4]},
    units:{core:{hp:50, vital:true, core:true, icon:'core', at:[0, 56], pt:[30, 37]}, gun:{hp:29, icon:'gun', at:[-104, -22], pt:[8, 32]}},
    pat:[{by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'mob'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'core', d:51, dl:6, p:'dur', ch:true, wind:{w:6, poise:16}}],
    // 0.40.0: 警戒VIII〜 炉心が硬くなり、臨界は不安定でなくなる(止める手段は体勢16と、その前に倒すこと)
    wary:[{at:8, units:{core:{hp:60, vital:true, core:true, icon:'core', at:[0, 56], pt:[30, 37]}, gun:{hp:29, icon:'gun', at:[-104, -22], pt:[8, 32]}},
      pat:[{by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'gun', d:5, dl:4, p:'mob'}, {by:'gun', d:5, dl:4, p:'arm'}, {by:'core', d:51, dl:6, p:'dur', wind:{w:6, poise:16}}]}],
    pool:['blow','timebomb','backflow','parry']},
  // 統率: 隊長が健在な間、行動の間隔-1。隊長を先に落とすと遅くなる
  squad:    {kind:null, start:2,
    units:{lead:{hp:25, vital:true, icon:'lead', spr:'leader', s:.8, at:[96, -22]}, gunner:{hp:16, vital:true, icon:'gun', spr:'trooper', s:.8, at:[-8, -10]}, shield:{hp:31, vital:true, icon:'shield', spr:'shieldman', s:.85, at:[-112, 0], armor:6}},
    passives:[{k:'command', unit:'lead', n:1}, {k:'floor', n:2}],
    pat:[{by:'lead', d:0, dl:5, buff:1}, {by:'shield', d:7, dl:4, p:'out', guard:{w:3, s:8}, armor:8}, {by:'gunner', d:2, dl:3, p:'calc'}, {by:'gunner', d:2, dl:3, p:'mob'}, {by:'gunner', d:2, dl:3, p:'arm'}],
    pool:['scatter','crackshot','rapid','iterate','timebomb']},
  // 群体: 子機が破壊されるたび、残りの攻撃力+1
  swarm:    {kind:null, start:3,
    units:{d1:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[-118, -22]}, d2:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[-40, 6]}, d3:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[40, -30]}, d4:{hp:12, vital:true, icon:'drone', spr:'drone', s:.6, at:[118, -2]}},
    passives:[{k:'frenzy', n:1}],
    pat:[{by:'d1', d:3, dl:2, p:'calc'}, {by:'d2', d:3, dl:2, p:'out'}, {by:'d3', d:3, dl:2, p:'mob'}, {by:'d4', d:3, dl:2, p:'arm'}, {d:0, dl:5, crack:1}],
    pool:['scatter','emp','storm','flick']},
  tank:     {kind:'tank', start:4, look:{s:1.1, at:[0, -8]},
    units:{core:{hp:96, vital:true, core:true, icon:'core', armor:10, at:[0, 56], pt:[31, 31]}, gun:{hp:48, icon:'gun', at:[-124, -34], pt:[-4, 16]}, mg:{hp:29, icon:'gun', at:[110, -50], pt:[49, 8]}, legs:{hp:48, icon:'leg', at:[-118, 24], pt:[9, 50]}},
    pat:[{by:'mg', d:3, hits:3, dl:4, p:'calc'}, {by:'legs', d:10, dl:5, p:'mob', guard:{w:3, s:10}}, {by:'mg', d:3, hits:3, dl:4, p:'out'}, {by:'gun', d:24, dl:6, p:'dur', ch:true, wind:{w:4, poise:14}, rec:3, crack:1}, {by:'core', d:0, dl:4, armor:6}],
    // 0.40.0: 車体以外の部位がすべて壊れると、最後の突撃に変わる(when:'parts')
    phase:{when:'parts', pat:[{by:'core', d:0, dl:4, armor:6}, {d:10, dl:3, p:'dur', ch:true}]},
    pool:['blow','emp','storm','wall','careful','dispose','crush']},
  // 0.23.0: 警戒度のプールに合わせて足した、性格のはっきりした敵(名前は仮)
  // 拾い屋: スクラップを盗んで逃げる。逃げる行動は不安定(JUSTで止まる)
  scav:     {kind:'scav', hp:46, start:2, passives:[{k:'loot'}],
    pat:[{d:3, dl:3, p:'arm', steal:8}, {d:3, dl:3, p:'mob', steal:8}, {d:3, dl:3, p:'arm', steal:8}, {d:0, dl:4, flee:true, ch:true}],
    pool:['flick','reload','coil','scan']},
  // 圧縮機: 手札のいちばん重いカードを飲み込む。体勢を崩せば止まる。倒すと吐き出す
  crusher:  {kind:'crusher', hp:82, start:4, passives:[{k:'hoard'}],
    pat:[{d:6, dl:4, p:'dur'}, {d:0, dl:5, eat:1, buff:2, wind:{w:3, poise:10}}, {d:11, dl:5, p:'out', rec:2}],
    wary:[{at:5, pat:[{d:8, dl:4, p:'dur'}, {d:0, dl:5, eat:1, buff:4, wind:{w:3, poise:10}}, {d:11, dl:5, p:'out', rec:2}]}],
    pool:['wall','blow','reload','backflow','iterate']},
  // 工程管理機(名前はタイムキーピング): 4サイクルごとに必ず動く。ディレイが効かない。警戒V以上では遅らせようとすると怒る(増幅。0.35.0)
  clock:    {kind:'clock', hp:80, start:4, passives:[{k:'punctual', n:0}], wary:[{at:5, passives:[{k:'punctual', n:1}], pname:{0:'定刻遵守'}, pat:[{d:8, dl:4, p:'calc'}, {d:8, dl:4, p:'arm'}, {d:8, dl:4, p:'mob'}, {d:16, dl:4, p:'dur', ch:true}]}],
    pat:[{d:5, dl:4, p:'calc'}, {d:5, dl:4, p:'arm'}, {d:5, dl:4, p:'mob'}, {d:16, dl:4, p:'dur', ch:true}],
    pool:['parry','rapid','crackshot']},
  // 溶接機: 壊した腕を直してしまう。直す行動は体勢で止められる
  welder:   {kind:'welder', start:4, look:{s:1.15, at:[0, -6]},
    units:{core:{hp:72, vital:true, core:true, icon:'core', at:[0, 58], pt:[32, 32]}, torch:{hp:26, icon:'arm', at:[-112, -34], pt:[6, 30]}, clamp:{hp:30, icon:'arm', at:[-108, 30], pt:[12, 49]}},
    pat:[{by:'clamp', d:5, dl:4, p:'mob', guard:{w:2, s:6}}, {by:'torch', d:9, dl:5, p:'arm'}, {by:'core', d:0, dl:5, rebuild:20, wind:{w:2, poise:15}}, {by:'torch', d:9, dl:5, p:'out'}],
    pool:['parry','wall','slash','coil']},
  // 猟犬: 2頭の群れ。迷う(入れ替え・待機)と詰めてくる。片方を倒すと残りが逆上する
  hound:    {kind:null, start:3,
    units:{h1:{hp:40, vital:true, icon:'leg', spr:'hound', s:.9, at:[-86, -18]}, h2:{hp:40, vital:true, icon:'leg', spr:'hound', s:.9, at:[84, 8]}},
    passives:[{k:'pursuit', n:1}, {k:'frenzy', n:2}],
    pat:[{by:'h1', d:6, dl:3, p:'mob'}, {by:'h2', d:6, dl:3, p:'out'}, {by:'h1', d:4, hits:3, dl:4, p:'arm'}, {by:'h2', d:4, hits:3, dl:4, p:'dur'}],
    pool:['flick','rapid','emp','storm']},
  warden:   {kind:'warden', start:5, look:{s:1.25, at:[0, -8]},
    units:{core:{hp:170, vital:true, core:true, icon:'core', at:[0, 60], pt:[30, 40]}, eye:{hp:38, icon:'eye', at:[104, -44], pt:[30, 16]}}, react:{min:6, d:10, p:'calc'},
    // 0.40.0: 殴り合いのボスに。大技の消去プロトコルは止められない(不安定でも体勢でもない)ので、ブロックで受ける。前半は放っておくと増幅が積もり、後半は加速する
    pat:[{d:10, dl:6, p:'calc'}, {d:10, dl:4, p:'arm'}, {d:0, dl:4, buff:1, heal:8, wind:{w:4, poise:15}}, {d:24, dl:9, p:'dur', rec:3}],
    phase:{at:0.5, pat:[{d:10, dl:5, p:'calc'}, {by:'eye', d:7, dl:3, p:'mob'}, {d:0, dl:4, armor:15, haste:1, wind:{w:4, poise:15}}, {by:'eye', d:0, dl:3, zone:{at:2, len:3, d:8, p:'calc'}}, {d:11, dl:5, p:'arm', counter:{w:5, d:4}}, {d:26, dl:7, p:'dur', rec:3}]},
    pool:[]},
  // ---------- 0.41.3: エリア2・3 の敵の案(工房で相談中。名前は仮。encounters の draft:true で、どこにも出ない) ----------
  // エリア2 クロックポリス(機械が作る街): 街の設備と、街を作る機械。ボスは監視塔の尖兵
  // 信号機: 赤の間は防壁で固く、青で連打、黄の後に隙。叩く時間を選ぶ敵
  signal:   {kind:'clock', hp:105, start:3,
    pat:[{d:0, dl:4, guard:{w:4, s:30}}, {d:4, hits:3, dl:4, p:'mob'}, {d:13, dl:3, p:'out', rec:3}],
    pool:['rapid','parry','crackshot','careful']},
  // 解体機: こちらのブロックを全て崩してから大振り。ブロックを貯めず、崩された後に張るか、大振りを崩す
  demolisher:{kind:'crusher', hp:120, start:4,
    pat:[{d:11, dl:4, p:'arm'}, {d:0, dl:4, shred:true, free:['こちらのブロックを全て失わせる。']}, {d:22, dl:3, p:'dur', wind:{w:2, poise:16}, rec:2}],
    pool:['blow','wall','parry','crush']},
  // 製造ライン: 作業人形を作り直し続ける。人形を払い続けるか、本体を急いで落とすか
  factory:  {kind:'welder', start:3, look:{s:1.15, at:[0, -6]},
    units:{core:{hp:100, vital:true, core:true, icon:'core', at:[0, 58], pt:[32, 32]}, w1:{hp:22, icon:'lead', spr:'trooper', s:.7, at:[-122, -14]}, w2:{hp:22, icon:'lead', spr:'trooper', s:.7, at:[122, -14]}, w3:{hp:22, icon:'lead', spr:'trooper', s:.7, at:[0, -84]}},
    pat:[{by:'w1', d:7, dl:3, p:'arm'}, {by:'w2', d:7, dl:3, p:'out'}, {by:'w3', d:7, dl:3, p:'mob'}, {by:'core', d:0, dl:4, rebuild:22, wind:{w:3, poise:14}}, {by:'core', d:11, dl:4, p:'dur'}],
    pool:['scatter','storm','slash','iterate']},
  // 監視カメラ網: カメラがこちらにクラックを重ね続ける(消えない)。先にカメラを潰すか、押し切るか
  camnet:   {kind:'drone', start:3,
    units:{core:{hp:85, vital:true, core:true, icon:'core', at:[0, 56], pt:[30, 36]}, cam1:{hp:18, icon:'eye', at:[-110, -30], pt:[6, 14]}, cam2:{hp:18, icon:'eye', at:[110, -30], pt:[54, 14]}},
    pat:[{by:'cam1', d:0, dl:3, crack:1}, {by:'core', d:8, dl:3, p:'calc'}, {by:'cam2', d:0, dl:3, crack:1}, {by:'core', d:6, hits:2, dl:4, p:'arm'}],
    pool:['flick','scatter','aim','scan']},
  // 路面電車: 定刻どおりに走る(ディレイが効かない)。線路(射界)を敷き、止められない通過で轢く。受けるか、それまでに削り切るか
  tram:     {kind:'tank', hp:105, start:6, look:{s:1.1, at:[0, -8]}, passives:[{k:'punctual', n:0}],
    pat:[{d:0, dl:3, zone:{at:2, len:2, d:8, p:'mob'}}, {d:14, dl:5, p:'dur'}, {d:6, dl:4, p:'out'}],
    pool:['wall','steel','blow','clockguard']},
  // エリート 起重機: 吊り荷の影(射界)の後に落とす(不安定・体勢16)。吊り具を壊せば落とせなくなる
  crane:    {kind:'tank', start:4, look:{s:1.15, at:[0, -8]},
    units:{core:{hp:130, vital:true, core:true, icon:'core', at:[0, 56], pt:[31, 31]}, boom:{hp:55, icon:'arm', at:[-124, -34], pt:[-4, 16]}, hook:{hp:45, icon:'gun', at:[110, -50], pt:[49, 8]}},
    pat:[{by:'boom', d:13, dl:4, p:'arm'}, {by:'hook', d:0, dl:3, zone:{at:3, len:2, d:14, p:'dur'}}, {by:'hook', d:34, dl:5, p:'dur', ch:true, wind:{w:4, poise:16}}, {by:'core', d:0, dl:4, armor:10}],
    phase:{when:'parts', pat:[{by:'core', d:12, dl:3, p:'out'}, {by:'core', d:0, dl:3, armor:10}]},
    pool:['blow','emp','storm','crush','steel']},
  // エリート 鎮圧機: 盾で受け、《重り》を山札に混ぜて手を遅くする(尖兵の汚染の予告)
  riot:     {kind:'exec', start:4, look:{s:1.1, at:[0, -6]},
    units:{core:{hp:135, vital:true, core:true, icon:'core', at:[0, 58], pt:[30, 36]}, shield:{hp:50, icon:'shield', armor:8, at:[-116, -10], pt:[8, 34]}},
    pat:[{by:'shield', d:9, dl:4, p:'out', guard:{w:3, s:14}}, {by:'core', d:0, dl:4, junk:{k:'weight', n:2, to:'draw'}, free:['山札に《重り》を2枚混ぜる。']}, {by:'core', d:13, dl:4, p:'calc', counter:{w:4, d:4}}, {by:'core', d:5, hits:3, dl:5, p:'mob', rec:2}],
    pool:['parry','wall','iterate','backflow']},
  // ボス 監視塔の尖兵: 鎌・ハルバード・大剣の3人。それぞれ別の汚染をする。倒す順番で、どの汚染を先に止めるかを選ぶ。仲間が倒れると残りが強くなる
  //   鎌: 《傷》を手札に(リフレッシュで手札にあると本体にダメージ) / ハルバード: 《重り》を山札に(消えずに回り続ける) / 大剣: 手札のカードを《破片》に割る(使うと元に戻る)
  vanguard: {kind:null, start:3,
    units:{scythe:{hp:55, vital:true, icon:'arm', spr:'trooper', s:.9, at:[-118, -10]}, halberd:{hp:70, vital:true, icon:'shield', spr:'shieldman', s:.9, at:[0, -24]}, great:{hp:90, vital:true, icon:'lead', spr:'leader', s:.95, at:[118, -6]}},
    passives:[{k:'frenzy', n:2}],
    pat:[{by:'scythe', d:5, hits:2, dl:3, p:'mob'}, {by:'halberd', d:11, dl:4, p:'arm', counter:{w:4, d:4}},
         {by:'scythe', d:0, dl:3, junk:{k:'gash', n:2, to:'hand'}, free:['手札に《傷》を2枚加える。']},
         {by:'great', d:22, dl:5, p:'dur', ch:true, wind:{w:3, poise:15}, rec:2},
         {by:'halberd', d:0, dl:3, junk:{k:'weight', n:2, to:'draw'}, free:['山札に《重り》を2枚混ぜる。']},
         {by:'great', d:0, dl:4, shatter:1, armor:8, free:['手札のカード1枚を《破片》に変える。']}],
    pool:[]},
  // エリア3 計画設計部門: 試作・検証・改良の機械。ボスはウィザード
  // 試作機: 行動がランダムで振れ幅が大きい。大技は不安定で、外すと長い隙
  prototype:{kind:'exec', hp:115, start:4, ai:'rand',
    pat:[{d:9, dl:3, p:'out', wt:2}, {d:20, dl:6, p:'dur', ch:true, rec:4, wt:1}, {d:5, hits:3, dl:4, p:'mob', wt:2}, {d:0, dl:3, buff:2, heal:10, wt:1}],
    pool:['blow','parry','timebomb','foresight']},
  // 負荷試験機: 一撃で受けるダメージに上限がある(耐久試験9)。大振りより手数
  stresser: {kind:'turret', hp:130, start:4, passives:[{k:'cap', n:10}],
    pat:[{d:8, dl:3, p:'arm'}, {d:8, dl:3, p:'calc'}, {d:0, dl:4, armor:12}, {d:16, dl:4, p:'dur', wind:{w:2, poise:10}}],
    pool:['rapid','scatter','storm','iterate']},
  // 組立治具: 本体はクランプが残っている間は無敵。クランプを直す行動は体勢で止まる(ウィザードの予告)
  jig:      {kind:'welder', start:4, look:{s:1.15, at:[0, -6]},
    units:{core:{hp:80, vital:true, core:true, shelter:true, icon:'core', at:[0, 58], pt:[32, 32]}, c1:{hp:22, icon:'arm', at:[-112, -34], pt:[6, 30]}, c2:{hp:22, icon:'arm', at:[-108, 30], pt:[12, 49]}},
    passives:[{k:'free', text:'【本体】ほかのユニットが残っている間、ダメージを受けない。'}],
    pat:[{by:'c1', d:6, dl:3, p:'arm'}, {by:'c2', d:6, dl:3, p:'mob'}, {by:'c1', d:5, dl:4, p:'out'}, {by:'core', d:14, dl:4, p:'dur'}, {by:'core', d:0, dl:4, rebuild:12, wind:{w:3, poise:12}}],
    pool:['slash','blow','crush','emp']},
  // 作図機: 射界を重ねて引き、だんだん速くなる。カードを撃ち終えるサイクルを選ぶ敵
  drafter:  {kind:'drone', hp:105, start:3, passives:[{k:'floor', n:2}],
    pat:[{d:0, dl:3, zone:{at:2, len:3, d:6, p:'calc'}}, {d:7, dl:3, p:'out'}, {d:0, dl:3, zone:{at:1, len:2, d:6, p:'arm'}}, {d:12, dl:4, p:'dur', haste:1}],
    pool:['flick','reload','foresight','hack']},
  // 複製機: 直前にこちらが当てた一撃を写して撃ち返す。大きい一撃の直後はブロックか、写しを崩す
  mimic:    {kind:'hacker', hp:145, start:4,
    pat:[{d:8, dl:4, p:'calc'}, {d:6, dl:4, p:'dur', mimic:true, wind:{w:2, poise:12}, free:['直前にこちらが当てた一撃のダメージを、この攻撃に足す。']}, {d:0, dl:3, armor:8}, {d:10, dl:4, p:'arm'}],
    pool:['parry','backflow','wall','scan']},
  // エリート 実証機: 耐久が減るたびに改良型・完成型へ換装する(段階変化2つ)
  demo:     {kind:'exec', hp:150, start:4, look:{s:1.15, at:[0, -6]},
    pat:[{d:10, dl:4, p:'out'}, {d:8, hits:2, dl:4, p:'mob'}, {d:0, dl:3, armor:10}],
    phase:{at:0.66, pat:[{d:12, dl:3, p:'out'}, {d:26, dl:5, p:'dur', ch:true, wind:{w:3, poise:15}, rec:2}, {d:0, dl:3, buff:2}],
      next:{at:0.33, pat:[{d:6, hits:3, dl:4, p:'calc'}, {d:12, dl:3, p:'arm', haste:1}, {d:26, dl:5, p:'dur', rec:3}]}},
    pool:['blow','timebomb','steel','careful']},
  // エリート 量産試験機: 2機。片方が壊れると、残りが改善する(増幅4・加速1)。そろえて落とす
  massprod: {kind:null, start:3,
    units:{a:{hp:75, vital:true, icon:'core', spr:'trooper', s:1, at:[-90, -10]}, b:{hp:75, vital:true, icon:'core', spr:'trooper', s:1, at:[90, -10]}},
    passives:[{k:'improve', n:3, haste:1}],
    pat:[{by:'a', d:9, dl:3, p:'out'}, {by:'b', d:9, dl:3, p:'arm'}, {by:'a', d:5, hits:2, dl:4, p:'mob'}, {by:'b', d:14, dl:4, p:'dur', wind:{w:2, poise:12}}],
    pool:['scatter','storm','rapid','timebomb']},
  // ボス ウィザード: 本体は無力で、ほかのユニット(設計した武装)が残っている間は無敵。武装が壊れるたびに改善(増幅3・加速1)。
  //   修理アームは壊れた武装を直す(体勢で止まる)。武装が全部壊れると、本体は武装を作り直そうとする(体勢18)
  wizard:   {kind:'warden', start:4, look:{s:1.25, at:[0, -8]},
    units:{core:{hp:90, vital:true, core:true, shelter:true, icon:'core', at:[0, 60], pt:[30, 40]}, cannon:{hp:34, icon:'gun', at:[-124, -34], pt:[4, 16]}, blade:{hp:34, icon:'arm', at:[124, -34], pt:[56, 16]}, arm:{hp:28, icon:'arm', at:[-118, 30], pt:[8, 50]}, thruster:{hp:28, icon:'leg', at:[118, 30], pt:[52, 50]}},
    passives:[{k:'improve', n:3, haste:1}, {k:'floor', n:2}, {k:'free', text:'【本体】ほかのユニットが残っている間、ダメージを受けない。'}],
    pat:[{by:'cannon', d:10, dl:4, p:'calc'}, {by:'blade', d:4, hits:3, dl:4, p:'mob'}, {by:'arm', d:0, dl:3, rebuild:12, wind:{w:3, poise:12}}, {by:'thruster', d:8, dl:3, p:'mob'},
         {by:'cannon', d:20, dl:5, p:'dur', ch:true, wind:{w:3, poise:16}, rec:2}, {by:'blade', d:8, dl:3, p:'arm', counter:{w:3, d:4}}],
    phase:{when:'parts', pat:[{by:'core', d:0, dl:5, rebuild:25, wind:{w:4, poise:16}}, {by:'core', d:8, dl:3, p:'out'}]},
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
  // 0.41.3: エリア2・3 の敵の案(draft: 工房で相談中。地図にもエリートにも出ない。自動対戦では測れる)
  d2_signal:{fam:'信号', draft:true, foes:['signal']},
  d2_demol: {fam:'解体', draft:true, foes:['demolisher']},
  d2_fact:  {fam:'製造', draft:true, foes:['factory']},
  d2_cam:   {fam:'監視', draft:true, foes:['camnet']},
  d2_tram:  {fam:'軌道', draft:true, foes:['tram']},
  d2e_crane:{fam:'重機', draft:true, elite:true, foes:['crane']},
  d2e_riot: {fam:'鎮圧', draft:true, elite:true, foes:['riot']},
  d2_boss:  {fam:'尖兵', draft:true, boss:true, foes:['vanguard']},
  d3_proto: {fam:'試作', draft:true, foes:['prototype']},
  d3_stress:{fam:'試験', draft:true, foes:['stresser']},
  d3_jig:   {fam:'組立', draft:true, foes:['jig']},
  d3_draft: {fam:'作図', draft:true, foes:['drafter']},
  d3_mimic: {fam:'複製', draft:true, foes:['mimic']},
  d3e_demo: {fam:'実証', draft:true, elite:true, foes:['demo']},
  d3e_mass: {fam:'量産', draft:true, elite:true, foes:['massprod']},
  d3_boss:  {fam:'設計', draft:true, boss:true, foes:['wizard']},
};
