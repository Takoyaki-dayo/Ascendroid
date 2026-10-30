# カード工房・データ台帳(共同作業のページ)

最初のタブ「カード工房」でカードを作り・直し、Claude に添削してもらい、そのまま試遊する。ほかのタブはカード以外(敵・パーツ・キーワード・イベント・遭遇・キャラなど)を一覧にして、数値や文を書き換えた依頼をコメント付きで送る。
claude.ai のアーティファクトとして公開している: https://claude.ai/artifact/KVdqupLbN6xmEa1nc7hKgU

- 中身は data/*.js をそのまま読み込んで表示する(このフォルダの index.html と、公開時に一緒に載せる data/*.js・meta.js)
- 依頼はページの共有データベースのコレクション `requests` に入る。1件の形:
  `{at, kind, key, label, type:'edit'|'new'|'note', changes:[{path, from, to}], obj?(追加のとき), comment, status, thread:[{who:'user'|'claude', text, at}], version?}`
  - kind は cards / foes / parts / keywords / events(中継も) / encounters / areas / alert / classes / general(項目によらない相談)
  - path はページで見えるオブジェクトの中の位置。カードの `k7.*` は data/classes.js の K-7 の数値、名前や文(name・text・行動の n など)は text/*.csv
  - status: open 未対応 / discuss 相談中 / done 反映済み / dropped 見送り(ユーザーが取り下げ)

## 依頼を反映する手順(Claude)

まとめて相談(type:'batch')の形: `{at, kind:'batch', label, type:'batch', cards:[{key, name, isNew, changes}], items:[{kind, key, label, type, changes, obj?, comment}], refs:[依頼のid], comment, status, thread}`。refs の依頼もこの相談の中で答え、反映したらそれぞれの依頼の status も更新する。cards の中身は工房の `cards/<key>`(添削待ち)を読む。items は1件ずつの依頼と同じ形。返事は batch の thread に1つにまとめて書き、全体の相談(comment)にも答える


1. ArtifactData の list で `requests` を読み、status が open のものを古い順に見る
2. 変更はリポジトリに入れる。数値は data/*.js、名前や文は text/*.csv(node tools/text.js で data/text.js を作り直す)。K-7 の数値は data/classes.js
3. 数値を変えたら自動対戦(CLS=k7 node tools/sim.js greedy 10)で極端に崩れていないか見る
4. コミットして push(ゲームの遊び方が変わるなら版を上げ、README の表も)
5. 依頼の文書を update: 反映したら `status:'done'`・`version`(コミットID)・thread に返事。相談や、決めきれないものは `status:'discuss'` と thread に返事(案や自動対戦の結果)
6. ページを公開し直す(同じ file_path。meta.js は版とコミットIDを書いて作り直す)。試遊版も更新する

正はページの依頼を通した変更。CSV や data を直接直した場合も、公開し直せばページの表示はそれに揃う。

## カード工房

カードのバランスはユーザーが大枠を作り、Claude が添削する。工房のカードはリポジトリとは別にページのデータベースに入り、「確定」したものを Claude がリポジトリへ反映する。

- 一覧: レア度・コスト・名前・種類・効果(K-7 の数値)・1サイクルあたりの効率(標準パーツ込み)・状態。効率は攻=ダメージ/コスト、守=ブロック/コスト(コスト0は「即時」)。初期カード(ジャブ5.0・障壁6.0)より強いと水色、弱いと赤
- 右の編集: 名前・コスト・レア度・対象・ダメージ(近接/遠隔・値・回数)・クラック・ディレイ・時限・ブロック・引く・充電を得る/消費・アトミック・受け流し。効果文は数値から自動で作る(「自分で書く」に切り替えられる)。メモ欄に狙いを書く
- ボタン: 保存(作業中) / 添削に出す / 確定にする(本体への反映を頼む) / 削る(本体から外す案) / 元に戻す(工房の変更を捨てる)
- まとめて相談(いちばん上の見出しの横。どのタブでも出る): 押すと右に「まとめて相談」の欄が開き、送るものの一覧(工房の未保存・作業中のカード、カード以外の送っていない変更)と全体への相談の欄が出る。送り済みで対応待ちの依頼と添削待ちのカード(ほかのまとめて相談に入っていないもの)も「一緒に相談する」として並ぶ。「まとめて送る」で、カードは添削待ちにし、全部を1件の依頼(type:'batch')にして送る(送り済みの依頼は refs に id で入る)。送っていない編集は端末(localStorage の asc.sheet.unsent)にも保存し、ページを読み込み直しても消えない。変更が無くても相談だけ送れる。カード以外の編集は別の項目やタブに移っても取っておき、一覧に「未送信」と出す
- 最初のデッキ: カードごとに枚数を増減して保存。武装パーツが加えるカードは別
- 試遊: 工房のカード(削ったものは報酬・店から外す)と最初のデッキを当てたゲームをページの中で開く。本体のセーブとは別に記録する

### データベースの形

- `cards/<key>` `{key, card, rarity, idea, status, thread:[{who:'user'|'claude', text, at}], at}`
  - key は既存カードならそのキー(jab など)、新しいカードは `n` で始まる仮のキー
  - card は data/cards.js と同じ形に name・text を足したもの。**数値は K-7 で効く値**(キャラ別の上書き data/classes.js は試遊では消して工房の値を使う)
  - rarity: starter 初期 / common コモン / uncommon アンコモン / rare レア / special 特殊
  - status: draft 作業中 / review 添削待ち / reviewed 添削済み / ok 確定(反映待ち) / merged 反映済み / cut 削る
- `config/deck` `{startDeck:[key...], at}`

### 添削する手順(Claude)

1. ArtifactData の list で `cards` を読み、status が review のものを見る
2. 効率・役割の重なり・コストの段(0即時 / 1〜2速い / 3標準 / 4以上重い)・レア度との釣り合い・既存カードとの比較で見る。必要なら試算や自動対戦(tools/sim.js)
3. update で thread に返事を足し、`status:'reviewed'`。数値の案は返事の中に書く(card は書き換えない。直すのはユーザー)

### 確定したカードを反映する手順(Claude)

1. status が ok のものを読む
2. 数値は data/cards.js(K-7 の値が本体の値と違うなら data/classes.js の k7 も)、名前と文は text/cards.csv(node tools/text.js)。新しいカードはユーザーの付けた名前のまま、キーは英語の短い名前に付け直す
3. cut は本体から外す(または報酬に出さない)。最初のデッキは data/cards.js の DATA.startDeck
4. 自動対戦で確かめ、コミット・push・ページの公開し直し
5. 工房の文書を `status:'merged'` にし、thread に反映した版を書く(キーを付け直したものは文書を新しいキーへ移す)

### 試遊版を作る

`node tools/sheet/mkplay.js <公開用フォルダ>` で `play/index.html` ができる(ゲームの index.html から PWA を外し、data と js は `../` から読む)。公開時は `js/engine.js` も一緒に載せる。
