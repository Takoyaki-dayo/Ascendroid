# 試遊版(アーティファクト)の index.html を作る: python3 tools/publish/mkapp.py <出力フォルダ>
# リポジトリの index.html から PWA 用の head とサービスワーカーの登録を外し、スクリプトを ?v=版 付きで読む
# 出力フォルダに data/*.js と js/engine.js も写す。公開は Artifact の file_path=<出力>/index.html、files に data/・js/
import re, os, sys, shutil
import subprocess
# 0.41.2: 構文の誤りがあれば作らない
_R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if subprocess.call(['node', os.path.join(_R, 'tools/publish/check.js'), os.path.join(_R, 'index.html'), os.path.join(_R, 'js/engine.js')] + [os.path.join(_R, 'data', f) for f in sorted(os.listdir(os.path.join(_R, 'data'))) if f.endswith('.js')]) != 0:
    sys.exit('構文の誤りがあるので止めました')
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = sys.argv[1]
os.makedirs(out + '/data', exist_ok=True); os.makedirs(out + '/js', exist_ok=True)
src = open(R + '/index.html').read()
s = src[src.index('<title>'):]
for pat in ['<meta name="theme-color" content="#0a0f15">\n','<meta name="mobile-web-app-capable" content="yes">\n','<link rel="manifest" href="manifest.webmanifest">\n','<link rel="icon" href="icons/icon-192.png">\n','<link rel="apple-touch-icon" href="icons/icon-192.png">\n','<style>html,body{margin:0}</style>\n']:
    assert pat in s, pat; s = s.replace(pat, '', 1)
s = s.replace('</title>\n', '</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n', 1)
i = s.index('<script>\n// オフライン用のサービスワーカー登録')
s = s[:i].rstrip() + '\n'
# 公開先でデータが古いまま読まれないよう、版を付けて読む(0.37.1)
ver = re.search(r"APP_VERSION = '([^']+)'", s).group(1)
s = re.sub(r'<script src="((?:data|js)/[\w.]+\.js)"></script>', lambda m: '<script src="%s?v=%s"></script>' % (m.group(1), ver), s)
open(out + '/index.html', 'w').write(s)
for f in os.listdir(R + '/data'):
    if f.endswith('.js'): shutil.copy(R + '/data/' + f, out + '/data/' + f)
shutil.copy(R + '/js/engine.js', out + '/js/engine.js')
print('ok', ver)
