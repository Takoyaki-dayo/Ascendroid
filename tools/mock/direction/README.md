# 方向性の見本(見た目と音の作り直し・依頼の7章の1)

ゲーム本体は変えていない。2つの方向を触って比べるための見本で、仕組みは仮(`core.js` は本体の `js/engine.js` の小さな写しで、正しさは保証しない)。

- 案A「白熱」: 時間は距離、脅威は熱。自機と敵のあいだの線路がタイムライン。音は鋼と蒸気 — https://claude.ai/artifact/U7YuY5skCvGs221WgGJRTU
- 案B「定刻」: 塔の運行表に K-7 が書き込む。五本の線が五つの部位。音は鐘と歯車 — https://claude.ai/artifact/5ae1bNDMePAwRRvD6gXafL

どちらも上の「見本」の切り替えで 戦闘・地図・報酬・音 を見られる。右上のメニューに考え方と操作。

## ファイル

- `core.js` 共有の仮の仕組み(戦闘の規則の写し・カードと敵・地図と報酬の固定の中身・記号・音の土台)
- `a.src.html` / `b.src.html` 案ごとの画面・演出・音色
- `build.js` `core.js` を埋め込んで1つの HTML にする
  - `node tools/mock/direction/build.js <出力先>` アーティファクトに公開する形
  - `node tools/mock/direction/build.js <出力先> --page` ブラウザで直接開ける形

カード・敵の名前と文は `text/*.csv` のものをそのまま使っている。字体は見本では Google Fonts から読んでいる(本番は同梱する)。
