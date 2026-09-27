"""
Картинки главной (версия 2.57.0) из макета docs/design/home-mockup.jpg: рама верхней панели, камень уровня,
сердечки, монета, огонь, свиток квеста, свиток карты и пергаментные плашки. Текст с них стирается (inpaint),
фон вокруг становится прозрачным. Масштаб макета — 1.75 пикселя на CSS-пиксель при ширине экрана 393.
Координаты — пиксели макета. Запуск: python3 scripts/build-home-art.py (нужны opencv-python и numpy).
"""
import cv2, numpy as np
import os
ROOT=os.path.join(os.path.dirname(__file__),'..')
SRC=os.path.join(ROOT,'docs','design','home-mockup.jpg')
OUT=os.path.join(ROOT,'src','assets','home','')
PREVIEW=os.environ.get('PREVIEW')  # папка для превью на пурпурном фоне, если нужно посмотреть прозрачность
im=cv2.imread(SRC)  # BGR

# Имена файлов в src/assets/home.
NAMES={'map':'map-scroll','journey':'banner-journey','grammar':'banner-grammar','review':'banner-review','blitz':'banner-blitz'}

def crop(x0,y0,x1,y1): return im[y0:y1,x0:x1].copy()

def erase(img, box, thr=28, dil=2, rad=4, off=(0,0)):
    """Стереть текст внутри box (координаты макета): маска — отличие от медианного фона."""
    x0,y0,x1,y1=[v-o for v,o in zip(box,(off[0],off[1],off[0],off[1]))]
    reg=img[y0:y1,x0:x1]
    bg=cv2.medianBlur(reg,31)
    d=np.linalg.norm(reg.astype(int)-bg.astype(int),axis=2)
    m=(d>thr).astype(np.uint8)*255
    m=cv2.dilate(m,np.ones((3,3),np.uint8),iterations=dil)
    full=np.zeros(img.shape[:2],np.uint8); full[y0:y1,x0:x1]=m
    out=cv2.inpaint(img,full,rad,cv2.INPAINT_TELEA)
    # Пятна на месте букв: внутри области смешиваем с сильно размытой копией.
    blur=cv2.GaussianBlur(out,(0,0),6)
    soft=cv2.GaussianBlur(cv2.dilate(full,np.ones((5,5),np.uint8),iterations=2),(0,0),3)[:,:,None]/255.0
    return (out*(1-soft)+blur*soft).astype(np.uint8)

def erase_box(img, box, off, rad=6):
    x0,y0,x1,y1=[v-o for v,o in zip(box,(off[0],off[1],off[0],off[1]))]
    full=np.zeros(img.shape[:2],np.uint8); full[y0:y1,x0:x1]=255
    return cv2.inpaint(img,full,rad,cv2.INPAINT_TELEA)

def alpha_from_edges(img, seeds, lo=10, hi=10):
    """Прозрачный фон: заливка от краёв с плавающим допуском, контур рамки её останавливает."""
    h,w=img.shape[:2]
    mask=np.zeros((h+2,w+2),np.uint8)
    flags=4|cv2.FLOODFILL_MASK_ONLY|(255<<8)
    for (x,y) in seeds:
        if mask[y+1,x+1]==0:
            cv2.floodFill(img.copy(),mask,(x,y),0,(lo,)*3,(hi,)*3,flags)
    bgm=mask[1:-1,1:-1]
    # мягкий край
    a=255-bgm
    a=cv2.GaussianBlur(a,(3,3),0)
    return np.dstack([img,a])

def edge_seeds(img, step=4):
    h,w=img.shape[:2]
    s=[(x,0) for x in range(0,w,step)]+[(x,h-1) for x in range(0,w,step)]
    s+=[(0,y) for y in range(0,h,step)]+[(w-1,y) for y in range(0,h,step)]
    return s

def save(name,img):
    cv2.imwrite(OUT+NAMES.get(name,name)+'.webp',img,[cv2.IMWRITE_WEBP_QUALITY,92])
    if not PREVIEW: return
    # превью на пурпурном, чтобы видеть прозрачность
    if img.shape[2]==4:
        a=img[:,:,3:4]/255.0; bg=np.zeros_like(img[:,:,:3]); bg[:]=(255,0,255)
        prev=(img[:,:,:3]*a+bg*(1-a)).astype(np.uint8)
    else: prev=img
    cv2.imwrite(os.path.join(PREVIEW,name+'.png'),cv2.resize(prev,None,fx=2,fy=2,interpolation=cv2.INTER_NEAREST))

# 1. Рама верхней панели: левый край, середина, правый край.
y0,y1=90,187
top=np.hstack([crop(13,y0,40,y1),crop(225,y0,285,y1),crop(652,y0,677,y1)])
save('top-frame',alpha_from_edges(top,edge_seeds(top)))
print('top-frame',top.shape)

# 2. Камень уровня без надписи.
st=crop(398,98,471,180)
st=erase(st,(412,110,458,172),thr=30,dil=2,off=(398,98))
save('level-stone',st)

# 3. Сердечки, монета, огонь.
for name,box in {'heart-full':(482,111,515,145),'heart-half':(618,111,652,145),'coin':(39,117,75,153),'flame':(149,115,184,156)}.items():
    c=crop(*box)
    save(name,alpha_from_edges(c,edge_seeds(c,2),lo=14,hi=14))

# 4. Свиток квеста: стереть текст, окно портрета залить синим.
q=crop(7,200,547,428)
# Низ рунного камня над рамкой свитка: заменяем соседним чистым куском рамки.
q[0:22,280:400]=q[0:22,160:280]
q=erase(q,(157,250,456,392),thr=26,dil=2,off=(7,200))
px0,py0,px1,py1=54-7,259-200,140-7,380-200
grad=np.linspace(0,1,py1-py0)[:,None,None]
top_c=np.array([120,90,55]); bot_c=np.array([60,45,30])  # BGR: синий сверху, темнее снизу
q[py0:py1,px0:px1]=(top_c*(1-grad)+bot_c*grad).astype(np.uint8)
save('quest',alpha_from_edges(q,edge_seeds(q),lo=8,hi=8))

# 5. Кнопка карты.
m=crop(550,212,681,426)
save('map',alpha_from_edges(m,edge_seeds(m),lo=8,hi=8))

# 6. Плашки.
j=crop(16,441,672,536)
j=erase(j,(40,452,330,530),thr=26,dil=2,off=(16,441))
save('journey',alpha_from_edges(j,edge_seeds(j),lo=8,hi=8))

g=crop(16,551,672,646)
g=erase(g,(98,570,460,630),thr=26,dil=2,off=(16,551))
g=erase(g,(600,575,645,625),thr=26,dil=2,off=(16,551))
save('grammar',alpha_from_edges(g,edge_seeds(g),lo=8,hi=8))

r=crop(16,655,672,788)
r=erase(r,(44,680,270,760),thr=26,dil=2,off=(16,655))
r=erase_box(r,(574,697,638,750),(16,655),rad=8)
save('review',alpha_from_edges(r,edge_seeds(r),lo=8,hi=8))

b=crop(16,800,672,891)
b=erase(b,(98,815,195,875),thr=26,dil=2,off=(16,800))
b=erase(b,(315,815,645,875),thr=26,dil=2,off=(16,800))
# У блица заливка протекает через край: форма та же, что у плашки урока, берём её маску.
ga=cv2.imread(OUT+'banner-grammar.webp',cv2.IMREAD_UNCHANGED)[:,:,3]
ba=cv2.resize(ga,(b.shape[1],b.shape[0]),interpolation=cv2.INTER_LINEAR)
save('blitz',np.dstack([b,ba]))

# Пустое сердце: правая (тёмная) половина полусердца, отражённая налево.
h=cv2.imread(OUT+'heart-half.webp',cv2.IMREAD_UNCHANGED)
w=h.shape[1]; mid=w//2
e=h.copy(); e[:,:mid]=cv2.flip(h[:,w-mid:],1)
save('heart-empty',e)
