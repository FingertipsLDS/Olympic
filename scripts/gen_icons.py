from PIL import Image, ImageDraw
S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
c1 = (16, 185, 129)   # emerald
c2 = (6, 182, 212)    # cyan
px = img.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * (S - 1))
        px[x, y] = (
            int(c1[0] + (c2[0] - c1[0]) * t),
            int(c1[1] + (c2[1] - c1[1]) * t),
            int(c1[2] + (c2[2] - c1[2]) * t),
            255,
        )
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=110, fill=255)
img.putalpha(mask)
d = ImageDraw.Draw(img)
w = (255, 255, 255, 255)
d.rounded_rectangle([112, 238, 400, 274], radius=18, fill=w)   # bar
d.rounded_rectangle([84, 196, 132, 316], radius=17, fill=w)    # left plates
d.rounded_rectangle([380, 196, 428, 316], radius=17, fill=w)   # right plates
img.resize((512, 512), Image.LANCZOS).save('icons/icon-512.png')
img.resize((512, 512), Image.LANCZOS).save('icons/maskable-512.png')
img.resize((192, 192), Image.LANCZOS).save('icons/icon-192.png')
img.resize((180, 180), Image.LANCZOS).save('icons/apple-touch-icon.png')
print('icons generated OK')
