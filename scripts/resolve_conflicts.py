import re
import sys
paths=[r"c:\Users\johan\OneDrive\文件\GitHub\faith-flow\package-lock.json",
       r"c:\Users\johan\OneDrive\文件\GitHub\faith-flow\node_modules\.package-lock.json"]
for path in paths:
    print("Cleaning",path)
    with open(path,'r',encoding='utf-8') as f:
        lines=f.readlines()
    cleaned=[]
    for line in lines:
        if line.startswith('<<<<<<<') or line.startswith('=======') or line.startswith('>>>>>>>'):
            continue
        cleaned.append(line)
    with open(path,'w',encoding='utf-8') as f:
        f.writelines(cleaned)
print('Done cleaning')
