// 敵と戦闘の構成
// tag: タイムラインの行に出る記号 / kind: 見た目(drone, exec, hacker, warden) / hp: 耐久 / start: 最初の行動までのサイクル
// pat: 行動パターン(上から順に繰り返す)
//   n: 行動名 / d: ダメージ / p: 狙う部位(calc 演算, arm 武装, out 出力, dur 耐久, mob 機動)
//   dl: 1つ前の行動からの間隔(サイクル) / ch: true なら溜め技(JUSTで潰せる)
//   kind:'delay' は自分へのディレイ(v: 量)
// pool: 倒したときの学習で出るカード候補
window.DATA = window.DATA || {};
DATA.foes = {
  droneA:{name:'警備ドローン', tag:'A', kind:'drone', hp:12, start:3,
    pat:[{n:'射撃', d:3, dl:3, p:'calc'}],
    pool:['jab','rapid','guard','wall','emp']},
  droneB:{name:'警備ドローン', tag:'B', kind:'drone', hp:12, start:4,
    pat:[{n:'射撃', d:3, dl:4, p:'out'}],
    pool:['jab','rapid','guard','wall','emp']},
  exec:  {name:'処刑ユニット', tag:'X', kind:'exec', hp:26, start:3,
    pat:[{n:'殴打', d:4, dl:3, p:'out'}, {n:'殴打', d:4, dl:3, p:'out'}, {n:'粉砕砲', d:12, dl:4, p:'dur', ch:true}],
    pool:['slash','blow','wall','crackshot']},
  hacker:{name:'ハッカー', tag:'H', kind:'hacker', hp:10, start:4,
    pat:[{n:'割り込み', kind:'delay', v:2, dl:4}, {n:'射撃', d:2, dl:3, p:'calc'}],
    pool:['hack','backflow','overclock','crackshot']},
  warden:{name:'管理AI ウォーデン', tag:'W', kind:'warden', hp:44, start:3,
    pat:[{n:'照射', d:4, dl:3, p:'calc'}, {n:'照射', d:4, dl:2, p:'arm'}, {n:'消去プロトコル', d:16, dl:5, p:'dur', ch:true}],
    pool:[]},
  escort:{name:'随伴ドローン', tag:'E', kind:'drone', hp:10, start:2,
    pat:[{n:'射撃', d:2, dl:3, p:'mob'}],
    pool:[]},
};

// 戦闘の構成(今の試作は3戦闘の一本道)
DATA.battles = [
  {area:'エリア1', room:'搬入ゲート', no:2, foes:['droneA','droneB']},
  {area:'エリア1', room:'処理区画',   no:4, foes:['exec','hacker']},
  {area:'エリア1', room:'中枢',       no:6, boss:true, foes:['warden','escort']},
];
// 進行: b0 = 1戦目, learn = 学習, rest = 整備, clear = 踏破
DATA.flow = ['b0','learn','b1','learn','rest','b2','clear'];
