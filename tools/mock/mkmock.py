# 見本(戦闘画面の作り直し)を作る: python3 tools/mock/mkmock.py <出力フォルダ>
# 試遊版と同じく mkapp.py で作り、そこに tools/mock の px.js・mock.js・mock.css を埋め込む。本体の index.html は変えない
import os, sys, subprocess
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = sys.argv[1]
if subprocess.call(['python3', os.path.join(R, 'tools/publish/mkapp.py'), out]) != 0: sys.exit(1)
if subprocess.call(['node', os.path.join(R, 'tools/publish/check.js'), os.path.join(R, 'tools/mock/px.js'), os.path.join(R, 'tools/mock/mock.js')]) != 0: sys.exit('構文の誤りがあるので止めました')
M = lambda f: open(os.path.join(R, 'tools/mock', f), encoding='utf-8').read()
p = os.path.join(out, 'index.html'); s = open(p, encoding='utf-8').read()
s = s.replace('<title>Ascendroid</title>', '<title>戦闘画面の見本</title>', 1)
font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira:wght@400;500;600;700&family=Oxanium:wght@500;600;700&display=swap">\n'
i = s.index('<style>'); s = s[:i] + font + s[i:]
s = s.rstrip() + '\n<style>\n' + M('mock.css') + '\n</style>\n<script>\n' + M('px.js') + '\n</script>\n<script>\n' + M('mock.js') + '\n</script>\n'
open(p, 'w', encoding='utf-8').write(s)
print('ok', out)
