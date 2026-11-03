#!/bin/sh
# カード工房(データ台帳)の公開フォルダを作る: sh tools/publish/stage.sh <出力フォルダ> <版> <コミット>
# 公開は Artifact の file_path=<出力>/index.html、files に data/・js/・meta.js・play/
R=$(cd "$(dirname "$0")/../.." && pwd); S=$1
mkdir -p $S/data $S/js
cp $R/tools/sheet/index.html $S/index.html
cp $R/data/attrs.js $R/data/cards.js $R/data/classes.js $R/data/enemies.js $R/data/map.js $R/data/parts.js $R/data/text.js $S/data/
cp $R/js/engine.js $S/js/
echo "window.SHEET_META = {version:'$2', commit:'$3'};" > $S/meta.js
node $R/tools/sheet/mkplay.js $S
# 公開先でデータが古いまま読まれないよう、版を付けて読む(0.37.1)
sed -i -E "s#<script src=\"((data|js)/[A-Za-z0-9_.]+\.js)\"></script>#<script src=\"\1?v=$2\"></script>#" $S/index.html
sed -i -E "s#<script src=\"(\.\./(data|js)/[A-Za-z0-9_.]+\.js)\"></script>#<script src=\"\1?v=$2\"></script>#" $S/play/index.html
sed -i "s#<script src=\"meta.js\"></script>#<script src=\"meta.js?v=$2\"></script>#" $S/index.html
