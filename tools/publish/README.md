# 公開と確認の道具

試遊版とカード工房は claude.ai のアーティファクトとして公開している。作業用のフォルダ(scratchpad など、リポジトリの外)に出力して、そこから公開する。

| ファイル | 使い方 |
| --- | --- |
| mkapp.py | `python3 tools/publish/mkapp.py <出力>`。試遊版の index.html(PWA の部分を外し、スクリプトを ?v=版 付きで読む)と data/・js/ を作る。公開先 https://claude.ai/artifact/1Rb63mCQCjDQrhsg32Kebb |
| stage.sh | `sh tools/publish/stage.sh <出力> <版> <コミット>`。カード工房の index.html・data/・js/・meta.js・play/(工房の中の試遊)を作る。公開先 https://claude.ai/artifact/KVdqupLbN6xmEa1nc7hKgU |
| csvedit.py | text/*.csv(BOM+CRLF)をキーで書き換える: setcol(path, key, 列, 値) / delrow / addrow。書き換えたら `node tools/text.js` |
| play19.js | Playwright で試遊版を自動で遊ぶ。`WEAK=1` で敵を弱くして流れだけ見る |
| wbmock.js | 工房を mock の共有データベースで動かす例(Playwright) |

- 公開し直すときは、試遊版・工房の両方を作り直す(工房の中の試遊も data を使うため)。
- Playwright と Chromium は作業環境に入っている(`require('playwright')`)。
