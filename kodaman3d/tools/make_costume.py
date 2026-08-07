"""
Paint a superhero costume into the base body texture.

WHY TEXTURE AND NOT GEOMETRY. The suit in the reference is skin-tight, which is
exactly what a texture expresses well and what geometry expresses badly. The
measured alternative (Quaternius's ranger boots) costs 9,172 triangles and +2
draw calls for footwear alone, against a budget already projected to land on
decision 14's limit of 8. Painting costs nothing.

METHOD. Every triangle of the body mesh is classified into a costume region from
its BIND-POSE centroid (the model is authored in a T-pose), then that triangle's
UV footprint is rasterised into a region map. The costume is composited onto the
original texture as a TINT, not a fill: the original's luminance is preserved and
re-coloured, so the sculpted muscle shading, the seams and the fabric detail all
survive under the new colours. A flat fill would have thrown that away and read
as a plastic toy.
"""
import json, struct, sys, math
from PIL import Image

SRC = '/Users/calvinyang/game_prototype/kodaman3d/public/models/hero'
GLTF = f'{SRC}/Superhero_Male_FullBody.gltf'
BASE_TEX = f'{SRC}/T_Superhero_Male_Dark.png'
OUT_TEX = f'{SRC}/T_Hero_Suit_BaseColor.png'
OUT_DEBUG = sys.argv[1] if len(sys.argv) > 1 else '/tmp/regions.png'

COMP_TYPES = {5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
NUM_COMPS = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

d = json.load(open(GLTF))
buffers = [open(f'{SRC}/{b["uri"]}','rb').read() for b in d['buffers']]

def read_accessor(i):
    a = d['accessors'][i]
    bv = d['bufferViews'][a['bufferView']]
    buf = buffers[bv['buffer']]
    fmt, size = COMP_TYPES[a['componentType']]
    n = NUM_COMPS[a['type']]
    stride = bv.get('byteStride') or size * n
    base = bv.get('byteOffset',0) + a.get('byteOffset',0)
    out = []
    for k in range(a['count']):
        off = base + k*stride
        out.append(struct.unpack_from('<'+fmt*n, buf, off))
    return out

# The body is the mesh using the body material; eyes/eyebrows are left alone.
body = None
for m in d['meshes']:
    for p in m['primitives']:
        if d['materials'][p['material']]['name'] == 'MI_Superhero_Male':
            body = p
if body is None:
    sys.exit('body primitive not found')

mat = next(m for m in d['materials'] if m['name']=='MI_Superhero_Male')
uvset = mat['pbrMetallicRoughness']['baseColorTexture'].get('texCoord', 0)
pos = read_accessor(body['attributes']['POSITION'])
uv  = read_accessor(body['attributes'][f'TEXCOORD_{uvset}'])
idx = [i[0] for i in read_accessor(body['indices'])]
print(f'body: {len(pos)} verts, {len(idx)//3} tris, using TEXCOORD_{uvset}')

ys = [p[1] for p in pos]
print(f'bind-pose y range: {min(ys):.3f} .. {max(ys):.3f}')

# ---------------------------------------------------------------- the costume
# Landmarks as fractions of the 1.81 m bind-pose height, so the split points are
# stated in anatomy rather than in magic numbers.
H = max(ys)
BOOT_TOP   = 0.28 * H   # mid-calf
TRUNK_LOW  = 0.47 * H   # upper thigh
TRUNK_HIGH = 0.55 * H   # hip
BELT_LOW   = 0.55 * H
BELT_HIGH  = 0.59 * H
NECK       = 0.86 * H   # collar line: above this stays skin
HAND_X     = 0.76       # |x| beyond this is hand -> bare skin

SUIT   = (0x24, 0x54, 0xd1)   # cobalt blue
TRUNK  = (0xd8, 0x22, 0x1f)   # red trunks + boots
BELT   = (0xE8, 0xB4, 0x22)   # gold belt
SKIN   = None                 # None = leave the original pixels untouched

def region(cx, cy, cz):
    if abs(cx) > HAND_X:            return SKIN     # hands stay bare
    if cy > NECK:                   return SKIN     # head and neck stay bare
    if cy < BOOT_TOP:               return TRUNK    # boots
    if BELT_LOW <= cy < BELT_HIGH:  return BELT
    if TRUNK_LOW <= cy < TRUNK_HIGH:return TRUNK    # trunks
    return SUIT

W = Hgt = 2048
region_map = [[None]*W for _ in range(Hgt)]
# Model-space position behind each painted pixel. This is what lets the emblem
# be tested per PIXEL: a per-triangle test would quantise its outline to the
# mesh's ~12.5k faces and read as a jagged blob on the chest.
pos_map = [[None]*W for _ in range(Hgt)]

def raster(tri_uv, colour, tri_pos):
    """Fill one triangle's UV footprint into region_map. Half-open, +1px bleed."""
    # ⚠️ NO V-FLIP. glTF's UV origin is the TOP-left with v increasing downward,
    # which is already the same convention as image rows, so v maps to the row
    # directly. Flipping it here mirrored the whole atlas: the face came out
    # painted blue and the torso came out bare skin — the exact inverse of the
    # intent, and obvious the moment the texture was looked at rather than
    # trusted. (Three.js flips V at load for its own sampling; that is a
    # renderer concern and does not change how the atlas is authored.)
    pts = [(u*W, v*Hgt) for (u, v) in tri_uv]
    xs = [p[0] for p in pts]; ys_ = [p[1] for p in pts]
    x0 = max(0, int(min(xs))-1); x1 = min(W-1, int(max(xs))+1)
    y0 = max(0, int(min(ys_))-1); y1 = min(Hgt-1, int(max(ys_))+1)
    (ax,ay),(bx,by),(cx_,cy_) = pts
    den = (by-cy_)*(ax-cx_) + (cx_-bx)*(ay-cy_)
    if abs(den) < 1e-12: return
    for py in range(y0, y1+1):
        for px in range(x0, x1+1):
            x = px+0.5; y = py+0.5
            l1 = ((by-cy_)*(x-cx_) + (cx_-bx)*(y-cy_))/den
            l2 = ((cy_-ay)*(x-cx_) + (ax-cx_)*(y-cy_))/den
            l3 = 1-l1-l2
            if l1 >= -0.02 and l2 >= -0.02 and l3 >= -0.02:
                region_map[py][px] = colour
                pa, pb, pc = tri_pos
                pos_map[py][px] = (
                    l1*pa[0] + l2*pb[0] + l3*pc[0],
                    l1*pa[1] + l2*pb[1] + l3*pc[1],
                    l1*pa[2] + l2*pb[2] + l3*pc[2],
                )

for t in range(0, len(idx), 3):
    a, b, c = idx[t], idx[t+1], idx[t+2]
    cx = (pos[a][0]+pos[b][0]+pos[c][0])/3
    cy = (pos[a][1]+pos[b][1]+pos[c][1])/3
    cz = (pos[a][2]+pos[b][2]+pos[c][2])/3
    col = region(cx, cy, cz)
    if col is None: continue
    raster([uv[a], uv[b], uv[c]], col, (pos[a], pos[b], pos[c]))

# ---------------------------------------------------------------- the emblem
# ⚠️ AN ORIGINAL SHAPE, DELIBERATELY. A plain shield/diamond reads as "this
# character has a crest" without reproducing anybody's mark. Locked decisions 5
# and 6 keep this project clear of trademarked designs and names, and an emblem
# is exactly the place that rule would be easiest to break by accident.
EMBLEM_CY   = 0.755 * H     # chest centre
EMBLEM_HALF_W = 0.135       # metres either side of the spine
EMBLEM_TOP  = EMBLEM_CY + 0.105
EMBLEM_BOT  = EMBLEM_CY - 0.135
EMBLEM = (0xE8, 0xB4, 0x22)   # gold, matching the belt

def in_emblem(p):
    x, y, z = p
    if z <= 0.0:                       return False   # front of the chest only
    if not (EMBLEM_BOT <= y <= EMBLEM_TOP): return False
    # A shield: full width at the top, tapering to a point at the bottom.
    t = (y - EMBLEM_BOT) / (EMBLEM_TOP - EMBLEM_BOT)   # 0 at the point, 1 at the top
    half = EMBLEM_HALF_W * (0.15 + 0.85 * (t ** 0.55))
    return abs(x) <= half

emblem_px = 0
for y in range(Hgt):
    for x in range(W):
        if region_map[y][x] is not SUIT: continue
        p = pos_map[y][x]
        if p and in_emblem(p):
            region_map[y][x] = EMBLEM
            emblem_px += 1
print(f'emblem: {emblem_px} px')

# ------------------------------------------------------------- composite pass
base = Image.open(BASE_TEX).convert('RGB')
if base.size != (W, Hgt):
    base = base.resize((W, Hgt), Image.LANCZOS)
src = base.load()
out = Image.new('RGB', (W, Hgt))
dst = out.load()

painted = 0
for y in range(Hgt):
    for x in range(W):
        col = region_map[y][x]
        r, g, b = src[x, y]
        if col is None:
            dst[x, y] = (r, g, b)
            continue
        painted += 1
        # TINT, not fill: keep the original's shading by re-colouring its
        # luminance. 0.5 luma maps to the flat costume colour, so highlights and
        # creases carry through instead of being flattened away.
        lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255.0
        # ⚠️ FLOOR THE LUMINANCE. The base body is authored wearing dark shorts,
        # and preserving that shading faithfully turned the trunks and belt into
        # near-black mud — the tint was doing its job on pixels that should not
        # have been dark in the first place. Clamping keeps the costume colour
        # readable while still carrying the muscle shading everywhere else.
        lum = max(lum, 0.38)
        k = lum / 0.5 if lum < 0.5 else 1.0 + (lum-0.5)*0.9
        dst[x, y] = tuple(min(255, max(0, int(c*k))) for c in col)

out.save(OUT_TEX)
print(f'painted {painted} px ({100*painted/(W*Hgt):.1f}% of the atlas) -> {OUT_TEX}')

# Flat-colour debug view, for checking the regions landed on the right islands.
dbg = Image.new('RGB', (W, Hgt), (24,24,24))
dp = dbg.load()
for y in range(Hgt):
    for x in range(W):
        c = region_map[y][x]
        dp[x, y] = c if c else (60, 60, 60)
dbg.resize((512,512), Image.NEAREST).save(OUT_DEBUG)
print('debug ->', OUT_DEBUG)

# ---------------------------------------------------------------------------
# HOW TO RUN
#
#   python3 -m venv /tmp/venv && /tmp/venv/bin/pip install pillow
#   /tmp/venv/bin/python tools/make_costume.py /tmp/regions.png
#
# Pillow is a BUILD-TIME dependency only. It is deliberately not in
# package.json: nothing at runtime decodes this texture except the browser, and
# the game must not gain a Python dependency to build.
#
# Output: public/models/hero/T_Hero_Suit_BaseColor.png, plus a flat-colour
# region map for checking the classification landed on the right UV islands.
# LOOK AT BOTH. The first run of this script painted the face blue and left the
# torso bare — a V-flip error that every number in the run reported as success.
# ---------------------------------------------------------------------------
