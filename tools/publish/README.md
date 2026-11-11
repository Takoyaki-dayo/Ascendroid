# 公開と確認の道具

試遊版とカード工房は claude.ai のアーティファクトとして公開している。作業用のフォルダ(scratchpad など、リポジトリの外)に出力して、そこから公開する。

| ファイル | 使い方 |
| --- | --- |
| mkapp.py | `python3 tools/publish/mkapp.py <出力>`。試遊版の index.html(PWA の部分を外し、スクリプトと css を ?v=版 付きで読む)と data/・js/・css/・assets/ を作る(0.54.0 から css/・assets/ も。公開の files にも入れる)。公開先 https://claude.ai/artifact/1Rb63mCQCjDQrhsg32Kebb |
| stage.sh | `sh tools/publish/stage.sh <出力> <版> <コミット>`。カード工房の index.html・data/・js/・meta.js・play/(工房の中の試遊。0.54.0 から play/css/・play/assets/ も)を作る。公開先 https://claude.ai/artifact/KVdqupLbN6xmEa1nc7hKgU |
| check.js | `node tools/publish/check.js <html や js>…`。中に書いたスクリプトの構文を確かめる。stage.sh と mkapp.py は最初にこれを走らせ、誤りがあれば止まる(0.41.2) |
| csvedit.py | text/*.csv(BOM+CRLF)をキーで書き換える: setcol(path, key, 列, 値) / delrow / addrow。書き換えたら `node tools/text.js` |
| play19.js | Playwright で試遊版を自動で遊ぶ(操作はマウスだけ)。`WEAK=1` で敵を弱くして流れだけ見る。`MOTION=1` で「動きを減らす」設定なし(既定はあり)。`SIZE=1920x1080` で画面の大きさ。押せなかったときは、直前の押した記録(押した要素と busy・sel・PICK・QUEUED)と状態を出し、`zz-click-failed.png` を撮って止まる |
| flowcheck.js | `node tools/publish/flowcheck.js [基準] [比べる版] [種の数] [--full]`。進行の処理が変わっていないことの検査(0.54.0)。main の版と今の版で、同じ乱数・同じ選び方で1周を流し、部屋を終えるごと・戦闘を始めるごとの S.run が一致するかを見る。見た目を直したら走らせる |
| shots.js | `node tools/publish/shots.js [index.html] [出す先=docs/shots] [大きさ=844x390,1920x1080]`。乱数を固定して、主な画面(地図・戦闘・カード選択・敵の詳細・自機・手札・勝利・報酬・ショップ・整備・イベント・保守通路・メニュー)をマウス操作で撮る(0.54.0) |
| fuzz.js | `node tools/publish/fuzz.js <mkapp の出力>/index.html <遭遇,...> [種の数]`。演出の打ち切り(0.50.0)の検査。同じ乱数で「ふつうに遊ぶ」と「演出中に連打する」を比べ、行動ごとの状態が一致するか、画面に取り残し(止まった動き・効果の要素・手札の数・消えた敵)がないかを見る。演出やその待ちを足したら走らせる |
| wbmock.js | 工房を mock の共有データベースで動かす例(Playwright) |

- 公開し直すときは、試遊版・工房の両方を作り直す(工房の中の試遊も data を使うため)。
- Playwright と Chromium は作業環境に入っている(`require('playwright')`)。
- 工房の項目を「反映済み(merged)」にするときは、工房の文書の card / foe も本体の姿(工房のページが作る base)に合わせて書き直す。合わせないと、本体と書き方が違う所(自由記述の効果・仕組みの欄・警戒版の名前など)が「本体との違い」として残り、作業中に見える(0.40.1)
