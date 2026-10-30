# カード工房・データ台帳(studio/)

最初のタブ「カード工房」でカードを作り・直し、Claude に添削してもらい、そのまま試遊する。ほかのタブはカード以外(敵・パーツ・キーワード・イベント・遭遇・キャラなど)を一覧にして、数値や文を書き換えた依頼をコメント付きで送る。

- GitHub Pages の `studio/` で公開し、ゲーム本体と同じようにインストールできる(manifest は studio/manifest.webmanifest、サービスワーカーはゲームと共通の ../sw.js)
- 中身はゲームの `../data/*.js` をそのまま読む。版の表示は ../sw.js の VERSION
- 保存先は GitHub の **workbench ブランチの db.json**(studio/gh-db.js)。main には混ぜない(保存のたびに Pages が作り直されないように、また Claude の push とぶつからないように)
  - db.json は「パス: 文書」の並び。`cards/<key>`・`config/deck`・`requests/<id>`
  - 書き込みは GitHub の API(1回の保存 = 1コミット)。先に誰かが書いていたら読み直して同じ変更を当て直す。読むのは30秒ごと(画面が見えている間だけ)
  - つなぐにはユーザーの端末に Fine-grained token(Ascendroid リポジトリだけ・Contents を Read and write)を入れる。トークンは端末の localStorage(asc.gh)にだけある
- claude.ai のアーティファクトとして開いた場合は claude の db を使う(旧版。今は使っていない)
- 試遊は `../index.html?wb=…` を全画面の iframe で開く。ゲームは ?wb= があると localStorage の asc.wb(工房のカード)を当て、セーブを asc.save.wb に分ける

依頼の1件の形(`requests/<id>`):
`{at, kind, key, label, type:'edit'|'new'|'note', changes:[{path, from, to}], obj?(追加のとき), comment, status, thread:[{who:'user'|'claude', text, at}], version?}`
- kind は cards / foes / parts / keywords / events(中継も) / encounters / areas / alert / classes / general(項目によらない相談)
- path はページで見えるオブジェクトの中の位置。カードの `k7.*` は data/classes.js の K-7 の数値、名前や文(name・text・行動の n など)は text/*.csv
- status: open 未対応 / discuss 相談中 / done 反映済み / dropped 見送り(ユーザーが取り下げ)

## Claude が db.json を読み書きする

```
git fetch origin workbench:refs/remotes/origin/workbench
git show origin/workbench:db.json                       # 読むだけ
git worktree add -b workbench ../wb origin/workbench    # 書くとき(初回だけ)。以後は cd ../wb && git pull origin workbench
# ../wb/db.json を書き換える(キーの順はそのまま、JSON.stringify(…, null, 1) と同じ形に)
cd ../wb && git commit -am "添削: …" && git push origin workbench   # 弾かれたら git pull --rebase origin workbench してからもう一度
```

## 依頼を反映する手順(Claude)

1. db.json の `requests/*` から status が open のものを古い順に見る
2. 変更はリポジトリに入れる。数値は data/*.js、名前や文は text/*.csv(node tools/text.js で data/text.js を作り直す)。K-7 の数値は data/classes.js
3. 数値を変えたら自動対戦(CLS=k7 node tools/sim.js greedy 10)で極端に崩れていないか見る
4. コミットして push(ゲームの遊び方が変わるなら版を上げ、README の表も)
5. db.json の依頼を書き換える: 反映したら `status:'done'`・`version`(コミットID)・thread に返事。相談や、決めきれないものは `status:'discuss'` と thread に返事(案や自動対戦の結果)
6. main に push すれば Pages の工房とゲームも新しい data を読む(公開し直しは要らない)

## カード工房

カードのバランスはユーザーが大枠を作り、Claude が添削する。工房のカードは main とは別に workbench ブランチの db.json に入り、「確定」したものを Claude がリポジトリへ反映する。

- 一覧: レア度・コスト・名前・種類・効果(K-7 の数値)・1サイクルあたりの効率(標準パーツ込み)・状態。効率は攻=ダメージ/コスト、守=ブロック/コスト(コスト0は「即時」)。初期カード(ジャブ5.0・障壁6.0)より強いと水色、弱いと赤
- 右の編集: 名前・コスト・レア度・対象・ダメージ(近接/遠隔・値・回数)・クラック・ディレイ・時限・ブロック・引く・充電を得る/消費・アトミック・受け流し。効果文は数値から自動で作る(「自分で書く」に切り替えられる)。メモ欄に狙いを書く
- ボタン: 保存(作業中) / 添削に出す / 確定にする(本体への反映を頼む) / 削る(本体から外す案) / 元に戻す(工房の変更を捨てる)
- 最初のデッキ: カードごとに枚数を増減して保存。武装パーツが加えるカードは別
- 試遊: 工房のカード(削ったものは報酬・店から外す)と最初のデッキを当てたゲームをページの中で開く。本体のセーブとは別に記録する

### 工房の文書の形

- `cards/<key>` `{key, card, rarity, idea, status, thread:[{who:'user'|'claude', text, at}], at}`
  - key は既存カードならそのキー(jab など)、新しいカードは `n` で始まる仮のキー
  - card は data/cards.js と同じ形に name・text を足したもの。**数値は K-7 で効く値**(試遊ではキャラ別の上書き data/classes.js を消して工房の値を使う)
  - rarity: starter 初期 / common コモン / uncommon アンコモン / rare レア / special 特殊
  - status: draft 作業中 / review 添削待ち / reviewed 添削済み / ok 確定(反映待ち) / merged 反映済み / cut 削る
- `config/deck` `{startDeck:[key...], at}`

### 添削する手順(Claude)

1. db.json の `cards/*` から status が review のものを見る
2. 効率・役割の重なり・コストの段(0即時 / 1〜2速い / 3標準 / 4以上重い)・レア度との釣り合い・既存カードとの比較で見る。必要なら試算や自動対戦(tools/sim.js)
3. thread に `{who:'claude', text, at}` を足し、`status:'reviewed'`。数値の案は返事の中に書く(card は書き換えない。直すのはユーザー)

### 確定したカードを反映する手順(Claude)

1. status が ok のものを読む
2. 数値は data/cards.js(K-7 の値が本体の値と違うなら data/classes.js の k7 も)、名前と文は text/cards.csv(node tools/text.js)。新しいカードはユーザーの付けた名前のまま、キーは英語の短い名前に付け直す
3. cut は本体から外す(または報酬に出さない)。最初のデッキは data/cards.js の DATA.startDeck
4. 自動対戦で確かめ、main にコミット・push
5. 工房の文書を `status:'merged'` にし、thread に反映した版を書く(キーを付け直したものは文書を新しいキーへ移す)
