"""
Портреты персонажей испанской версии (версия 2.62.0) из листа docs/design/portraits-es.jpg: 20 жителей мест,
Летописец, четыре стража и кузнец. Вырезается внутренняя часть каждой рамки, без золотой обводки и таблички
с именем, в пропорциях игрового портрета 14:18, размер 168×216. Запуск: python3 scripts/cut-portraits.py (нужен Pillow).
"""
from PIL import Image
import os
ROOT=os.path.join(os.path.dirname(__file__),'..')
SRC=os.path.join(ROOT,'docs','design','portraits-es.jpg')
OUT=os.path.join(ROOT,'src','assets','portraits','es')
im=Image.open(SRC).convert('RGB')
cols=[(112,290),(318,497),(527,706),(735,913)]
rows=[(76,258),(322,498),(561,743),(809,985),(1049,1222)]
names=[['lola','carmen','javi','paco'],['pilar','manolo','marta','ernesto'],['elena','rafa','gomez','toni'],
       ['sara','ramon','nacho','beatriz'],['isabel','ruiz','leo','vega']]
small_x=[(62,200),(222,355),(375,505),(525,655),(673,802),(823,958)]
small_y=(1293,1432)
small=['cronista','guardian1','guardian2','guardian3','guardian4','smith']
RATIO=14/18
# Сдвиг центра по x для отдельных портретов, если лицо не по центру рамки.
SHIFT={}
boxes={}
for r,(y0,y1) in enumerate(rows):
    for c,(x0,x1) in enumerate(cols): boxes[names[r][c]]=(x0,y0,x1,y1)
for i,(x0,x1) in enumerate(small_x): boxes[small[i]]=(x0,small_y[0],x1,small_y[1])
out={}
for name,(x0,y0,x1,y1) in boxes.items():
    h=y1-y0; w=round(h*RATIO)
    cx=(x0+x1)/2+SHIFT.get(name,0)
    l=max(x0,min(x1-w,round(cx-w/2)))
    crop=im.crop((l,y0,l+w,y1)).resize((168,216),Image.LANCZOS)
    crop.save(os.path.join(OUT,f'{name}.webp'),quality=86)
    out[name]=crop
