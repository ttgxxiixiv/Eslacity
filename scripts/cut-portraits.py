"""
Портреты персонажей из листов docs/design/portraits-<язык>.jpg: 20 жителей мест, Летописец, четыре стража
и кузнец. Испанский лист — версия 2.62.0, итальянский — 2.82.0. Вырезается внутренняя часть каждой рамки,
без золотой обводки и таблички с именем, в пропорциях игрового портрета 14:18, размер 168×216.
Запуск: python3 scripts/cut-portraits.py [es|it] (без аргумента — оба языка, нужен Pillow).
"""
from PIL import Image
import os, sys
ROOT=os.path.join(os.path.dirname(__file__),'..')
RATIO=14/18
SMALL=['cronista','guardian1','guardian2','guardian3','guardian4','smith']

# Координаты рамок сняты по каждому листу: колонки и строки большой сетки, затем нижний ряд из шести.
SHEETS={
  'es':dict(
    cols=[(112,290),(318,497),(527,706),(735,913)],
    rows=[(76,258),(322,498),(561,743),(809,985),(1049,1222)],
    names=[['lola','carmen','javi','paco'],['pilar','manolo','marta','ernesto'],['elena','rafa','gomez','toni'],
           ['sara','ramon','nacho','beatriz'],['isabel','ruiz','leo','vega']],
    small_x=[(62,200),(222,355),(375,505),(525,655),(673,802),(823,958)],
    small_y=(1293,1432),
  ),
  'it':dict(
    cols=[(98,282),(310,496),(530,716),(748,934)],
    rows=[(56,232),(298,474),(538,712),(778,952),(1018,1192)],
    names=[['giulia','rosa','matteo','salvatore'],['franca','gino','chiara','bruno'],['anna','enzo','ferri','tonino'],
           ['federica','aldo','marco','valentina'],['elisa','conti','luca','rinaldi']],
    small_x=[(52,200),(232,348),(388,500),(530,642),(678,798),(834,978)],
    small_y=(1272,1436),
  ),
}
# Сдвиг центра по x для отдельных портретов, если лицо не по центру рамки.
SHIFT={'es':{},'it':{}}

def cut(lang):
    s=SHEETS[lang]
    im=Image.open(os.path.join(ROOT,'docs','design',f'portraits-{lang}.jpg')).convert('RGB')
    out=os.path.join(ROOT,'src','assets','portraits',lang)
    os.makedirs(out,exist_ok=True)
    boxes={}
    for r,(y0,y1) in enumerate(s['rows']):
        for c,(x0,x1) in enumerate(s['cols']): boxes[s['names'][r][c]]=(x0,y0,x1,y1)
    for i,(x0,x1) in enumerate(s['small_x']): boxes[SMALL[i]]=(x0,s['small_y'][0],x1,s['small_y'][1])
    for name,(x0,y0,x1,y1) in boxes.items():
        h=y1-y0; w=round(h*RATIO)
        if w>x1-x0:
            # Рамка уже нужной пропорции: берём всю ширину и срезаем высоту снизу.
            w=x1-x0; y1=y0+round(w/RATIO)
        cx=(x0+x1)/2+SHIFT[lang].get(name,0)
        l=max(x0,min(x1-w,round(cx-w/2)))
        im.crop((l,y0,l+w,y1)).resize((168,216),Image.LANCZOS).save(os.path.join(out,f'{name}.webp'),quality=86)
    return list(boxes)

for lang in (sys.argv[1:] or list(SHEETS)):
    print(lang,len(cut(lang)))
