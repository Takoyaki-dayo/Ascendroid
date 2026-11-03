# CSV(BOM+CRLF)の行をキーで書き換える小道具: setcol(path, key, colIndex, value) / delrow / addrow
import csv, io
def load(p):
    raw=open(p,'rb').read().decode('utf-8-sig')
    rows=list(csv.reader(io.StringIO(raw)))
    return rows
def save(p,rows):
    buf=io.StringIO(); w=csv.writer(buf,lineterminator='\r\n'); w.writerows(rows)
    open(p,'wb').write(('﻿'+buf.getvalue()).encode('utf-8'))
def setcol(p,key,col,val):
    rows=load(p); n=0
    for r in rows:
        if r and r[0]==key: r[col]=val; n+=1
    assert n==1,(p,key,n); save(p,rows)
def delrow(p,key):
    rows=load(p); before=len(rows); rows=[r for r in rows if not(r and r[0]==key)]; assert len(rows)==before-1,(p,key); save(p,rows)
def addrow(p,row,after=None):
    rows=load(p)
    assert not any(r and r[0]==row[0] for r in rows),row[0]
    if after:
        i=[j for j,r in enumerate(rows) if r and r[0]==after][0]; rows.insert(i+1,row)
    else: rows.append(row)
    save(p,rows)
