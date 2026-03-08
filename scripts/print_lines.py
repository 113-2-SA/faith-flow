import sys
path='package-lock.json'
with open(path,'r',encoding='utf-8') as f:
    lines=f.readlines()
for i,line in enumerate(lines[-20:], start=len(lines)-19):
    print(i, repr(line))
