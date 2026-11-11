#!/bin/sh
# カード工房(データ台帳)の公開フォルダを作る: sh tools/publish/stage.sh <出力フォルダ> <版> <コミット>
# 公開は Artifact の file_path=<出力>/index.html、files に data/・js/・meta.js・play/
R=$(cd "$(dirname "$0")/../.." && pwd); S=$1
# 0.41.2: 構文の誤りがあれば作らない
node $R/tools/publish/check.js $R/tools/sheet/index.html $R/index.html $R/js/*.js $R/data/*.js || { echo "構文の誤りがあるので止めました"; exit 1; }
mkdir -p $S/data $S/js
cp $R/tools/sheet/index.html $S/index.html
cp $R/data/attrs.js $R/data/cards.js $R/data/classes.js $R/data/enemies.js $R/data/map.js $R/data/parts.js $R/data/text.js $S/data/
cp $R/js/*.js $S/js/
echo "window.SHEET_META = {version:'$2', commit:'$3'};" > $S/meta.js
node $R/tools/sheet/mkplay.js $S
# 0.54.0: 工房の中の試遊(play/)は、見た目(css/)と同梱の素材(assets/)を自分のフォルダから読む。公開は files に play/css/・play/assets/ も入れる
mkdir -p $S/play/css $S/play/assets
cp -r $R/css/. $S/play/css/
cp -r $R/assets/. $S/play/assets/
# 公開先でデータが古いまま読まれないよう、版を付けて読む(0.37.1)
sed -i -E "s#<script src=\"((data|js)/[A-Za-z0-9_.]+\.js)\"></script>#<script src=\"\1?v=$2\"></script>#" $S/index.html
sed -i -E "s#<script src=\"(\.\./(data|js)/[A-Za-z0-9_.]+\.js)\"></script>#<script src=\"\1?v=$2\"></script>#" $S/play/index.html
sed -i "s#<script src=\"meta.js\"></script>#<script src=\"meta.js?v=$2\"></script>#" $S/index.html
sed -i -E "s#<link rel=\"stylesheet\" href=\"(css/[A-Za-z0-9_.]+\.css)\">#<link rel=\"stylesheet\" href=\"\1?v=$2\">#" $S/play/index.html
