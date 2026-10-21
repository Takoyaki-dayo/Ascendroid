// セリフ(下スワイプの「内側」の画面に出る独り言)
// 上から順に条件を調べ、最初に当てはまったものを出す。text が配列なら、その中から1つをランダムに選ぶ
// 差し込み: {part} 部位名 / {enemy} 敵の名前 / {move} 技の名前 / {t} 残りサイクル
// 条件:
//   bodyLow    本体が最大の4割未満
//   partBroken 破損した部位がある
//   chargeSoon 9サイクル以内に溜め技が来る
//   vulnNow    隙を見せている敵がいる
//   windNow    構えている(またはもうすぐ構える)敵がいる。{poise} 潰すのに要る一撃
//   handEmpty  手札がない
//   partWorn   前の戦闘の損傷が残っている
//   focus      見えている攻撃が1つの部位に合計10以上集まっている
// どれにも当てはまらなければ、部屋の種類ごとの一言(room)
window.DATA = window.DATA || {};
DATA.lines = {
  speaker: 'K-7',
  rules: [
    {when:'bodyLow',    text:['本体の損耗が大きい。これ以上は通せない。']},
    {when:'partBroken', text:['{part}が沈黙している。……別の手で埋めるしかない。']},
    {when:'vulnNow',    text:['{enemy}に隙。今なら深く入る。']},
    {when:'windNow',    text:['{enemy}が構えた。{poise}以上を叩き込めば崩せる。']},
    {when:'chargeSoon', text:['{enemy}の{move}まで、あと{t}。……合わせられるか。']},
    {when:'handEmpty',  text:['手が尽きた。次が届くまで、耐える。']},
    {when:'partWorn',   text:['{part}に前の戦いの傷が残っている。庇いながら行く。']},
    {when:'focus',      text:['{part}に攻撃が集まっている。']},
  ],
  room: {
    battle: ['搬入口。警備は薄い……はずだ。', '処理区画。ここに運ばれたものは、二度と出てこない。', '配線が脈打っている。塔はまだ生きている。'],
    elite:  ['反応が大きい。正面からは避けたかったが。'],
    boss:   ['中枢。塔の意思が、ここにいる。'],
  },
};
