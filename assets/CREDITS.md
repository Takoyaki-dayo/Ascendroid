# 同梱している素材の出どころとライセンス

リポジトリに同梱している、外から持ってきた素材の一覧。CDN からは何も読まない(オフラインで動く)。

| 素材 | ファイル | 作者 | ライセンス | 出どころ |
| --- | --- | --- | --- | --- |
| 字体 Big Shoulders Display(可変ウェイト 100〜900、ラテン文字の部分) | `assets/fonts/BigShouldersDisplay-latin.woff2` | The Big Shoulders Project Authors(Patric King / XO Type Co) | SIL Open Font License 1.1(全文は `assets/fonts/OFL.txt`) | Google Fonts が配っている woff2(`fonts.gstatic.com/s/bigshouldersdisplay/v24/`)。元は https://github.com/xotypeco/big_shoulders |

## 自分で作ったもの(外の素材ではない)

- 絵(自機・敵・カードの記号・地図の記号・背景): `index.html` と `css/app.css` の中の SVG と CSS。形は 0.53.0 までの線画を元に、色を当て直した。
- アイコン: `tools/icons/icon.svg` から `node tools/icons/mkicons.js` で `icons/*.png` を作る。
- 音(効果音と曲): `js/audio.js` が Web Audio でその場で作る。録音や音源のファイルは無い。
- ライブラリ: 使っていない(`vendor/` は無い)。

日本語の字体は同梱していない。端末のゴシック体(Hiragino Kaku Gothic / Noto Sans JP / Yu Gothic など)で表示する。
