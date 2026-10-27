# データ台帳(共同作業のページ)

カード・敵・パーツ・キーワード・イベント・遭遇・キャラを一覧にして、数値や文を書き換えた依頼をコメント付きで送るページ。
claude.ai のアーティファクトとして公開している: https://claude.ai/artifact/KVdqupLbN6xmEa1nc7hKgU

- 中身は data/*.js をそのまま読み込んで表示する(このフォルダの index.html と、公開時に一緒に載せる data/*.js・meta.js)
- 依頼はページの共有データベースのコレクション `requests` に入る。1件の形:
  `{at, kind, key, label, type:'edit'|'new'|'note', changes:[{path, from, to}], obj?(追加のとき), comment, status, thread:[{who:'user'|'claude', text, at}], version?}`
  - kind は cards / foes / parts / keywords / events(中継も) / encounters / areas / classes / general(項目によらない相談)
  - path はページで見えるオブジェクトの中の位置。カードの `k7.*` は data/classes.js の K-7 の数値、名前や文(name・text・行動の n など)は text/*.csv
  - status: open 未対応 / discuss 相談中 / done 反映済み / dropped 見送り(ユーザーが取り下げ)

## 依頼を反映する手順(Claude)

1. ArtifactData の list で `requests` を読み、status が open のものを古い順に見る
2. 変更はリポジトリに入れる。数値は data/*.js、名前や文は text/*.csv(node tools/text.js で data/text.js を作り直す)。K-7 の数値は data/classes.js
3. 数値を変えたら自動対戦(CLS=k7 node tools/sim.js greedy 10)で極端に崩れていないか見る
4. コミットして push(ゲームの遊び方が変わるなら版を上げ、README の表も)
5. 依頼の文書を update: 反映したら `status:'done'`・`version`(コミットID)・thread に返事。相談や、決めきれないものは `status:'discuss'` と thread に返事(案や自動対戦の結果)
6. ページを公開し直す(同じ file_path。meta.js は版とコミットIDを書いて作り直す)。試遊版も更新する

正はページの依頼を通した変更。CSV や data を直接直した場合も、公開し直せばページの表示はそれに揃う。
