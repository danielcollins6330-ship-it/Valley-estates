# Headless Blender: static rural buildings for Valley Estates.
# Original geometry, CC0. Game units, Z-up. The verandah faces -Y,
# which becomes +Z after the glTF Y-up export, toward the game camera.
import bpy
import bmesh
import math
import os

OUT = "/workspace/assets/buildings"
os.makedirs(OUT, exist_ok=True)

CREAM = (0.86, 0.78, 0.66, 1)
CREAM_GAP = (0.72, 0.64, 0.52, 1)
STONE = (0.74, 0.66, 0.54, 1)
STONE_DARK = (0.58, 0.5, 0.42, 1)
# These two stay as masks. assets/buildings.js tints grey iron to galvanised
# or a Colorbond colour, and cream shed walls to corrugated iron.
IRON = (0.62, 0.66, 0.68, 1)
IRON_RED = (0.55, 0.2, 0.14, 1)
WOOD = (0.38, 0.26, 0.16, 1)
DOOR = (0.32, 0.18, 0.12, 1)
GLASS = (0.45, 0.58, 0.62, 1)
BRICK = (0.55, 0.28, 0.2, 1)
WOOL = (0.9, 0.88, 0.82, 1)


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials):
        for block in list(coll):
            coll.remove(block)


def link(mesh, name):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def paint(obj, fn):
    me = obj.data
    if me.color_attributes.get("Col"):
        me.color_attributes.remove(me.color_attributes["Col"])
    attr = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    for li, loop in enumerate(me.loops):
        v = me.vertices[loop.vertex_index].co
        attr.data[li].color = fn(v.x, v.y, v.z)
    me.color_attributes.active_color = attr


def solid(color):
    return lambda x, y, z: color


def boards(base, gap, bands=9):
    def fn(x, y, z):
        band = int(max(0, z) * bands) % 2
        return gap if band else base
    return fn


def stone_fn(x, y, z):
    n = 0.5 + 0.5 * math.sin(x * 9.1 + z * 6.4) * math.sin(y * 7.2 + 1.7)
    if n > 0.72:
        return STONE_DARK
    return STONE


SHARED = {"mat": None}

def material(obj):
    if SHARED["mat"] is None:
        mat = bpy.data.materials.new("Bld")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
        bsdf.inputs["Roughness"].default_value = 0.82
        bsdf.inputs["Metallic"].default_value = 0.04
        SHARED["mat"] = mat
    obj.data.materials.append(SHARED["mat"])


def cube(name, sx, sy, sz, loc, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    paint(obj, color if callable(color) else solid(color))
    material(obj)
    return obj


def cyl(name, radius, depth, loc, color, verts=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    paint(obj, color if callable(color) else solid(color))
    material(obj)
    return obj


def grid_mesh(name, xs, ys, z_at, color):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    table = []
    for y in ys:
        row = []
        for x in xs:
            row.append(bm.verts.new((x, y, z_at(x, y))))
        table.append(row)
    for iy in range(len(ys) - 1):
        for ix in range(len(xs) - 1):
            bm.faces.new((table[iy][ix], table[iy][ix + 1], table[iy + 1][ix + 1], table[iy + 1][ix]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(mesh, name)
    paint(obj, color if callable(color) else solid(color))
    material(obj)
    return obj


def samples(a, b, n):
    if n <= 1:
        return [(a + b) / 2]
    return [a + (b - a) * i / (n - 1) for i in range(n)]


def gable(name, w, d, z_eave, rise, color, ribs, detail):
    nx = ribs if detail else 2
    ny = 6 if detail else 2

    def height(x, y):
        edge = abs(y) / (d / 2)
        wave = math.sin((x / w + 0.5) * ribs * math.pi * 2) * (0.016 if detail else 0)
        return z_eave + rise * (1 - edge) + wave

    return grid_mesh(name, samples(-w / 2, w / 2, nx + 1), samples(-d / 2, d / 2, ny + 1), height, color)


def skillion(name, w, y0, y1, z0, z1, color, ribs, detail):
    nx = ribs if detail else 2
    ny = 4 if detail else 2

    def height(x, y):
        t = (y - y0) / (y1 - y0 + 1e-6)
        wave = math.sin((x / w + 0.5) * ribs * math.pi * 2) * (0.014 if detail else 0)
        return z0 + (z1 - z0) * t + wave

    return grid_mesh(name, samples(-w / 2, w / 2, nx + 1), samples(y0, y1, ny + 1), height, color)


def posts(name, points, height, radius, color):
    parts = []
    for i, (x, y) in enumerate(points):
        parts.append(cyl(f"{name}{i}", radius, height, (x, y, height / 2), color, 6))
    return parts


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def house(detail, body, roof_color, wall_color, stone=False):
    """body: w, d, h, verandah depth. Centred, verandah toward -Y."""
    w, d, h, vd = body
    parts = []
    wall_paint = stone_fn if stone else boards(wall_color, CREAM_GAP if wall_color == CREAM else STONE_DARK)
    parts.append(cube("walls", w, d, h, (0, vd * 0.15, h / 2), wall_paint))
    parts.append(cube("deck", w + 0.35, vd, 0.06, (0, -d / 2 - vd / 2 + 0.08, 0.04), WOOD))
    post_y = -d / 2 - vd + 0.18
    xs = [-(w / 2) + 0.12, 0, (w / 2) - 0.12] if not detail else [-(w / 2) + 0.08, -(w / 6), w / 6, (w / 2) - 0.08]
    parts += posts("post", [(x, post_y) for x in xs], h * 0.92, 0.045, WOOD)
    if detail:
        parts.append(gable("roof", w + 0.45, d + 0.35, h * 0.92, h * 0.38, roof_color, 18, True))
        parts.append(skillion("ver", w + 0.7, post_y - 0.18, -d / 2 + 0.05, h * 0.78, h * 0.96, roof_color, 16, True))
        parts.append(cube("door", w * 0.16, 0.06, h * 0.62, (0, -d / 2 + vd * 0.15 - 0.02, h * 0.34), DOOR))
        for wx in (-w * 0.28, w * 0.28):
            parts.append(cube("win", w * 0.16, 0.05, h * 0.28, (wx, -d / 2 + vd * 0.15 - 0.01, h * 0.55), GLASS))
    else:
        parts.append(cube("roof", w + 0.4, d + vd, h * 0.16, (0, -vd * 0.25, h + h * 0.08), roof_color))
    return parts


def build_one(kind):
    reset()
    SHARED["mat"] = None
    if kind == "homestead":
        near = house(True, (1.9, 1.55, 0.95, 0.7), IRON, CREAM, False)
        near.append(cube("chim", 0.28, 0.28, 0.55, (0.45, 0.35, 1.25), BRICK))
        near.append(cyl("pot", 0.1, 0.12, (0.45, 0.35, 1.55), BRICK, 8))
        near.append(cyl("tank", 0.28, 0.7, (1.25, 0.55, 0.4), IRON, 10))
        far = house(False, (1.9, 1.55, 0.95, 0.7), IRON, CREAM, False)
    elif kind == "winery":
        near = house(True, (2.15, 1.35, 1.0, 0.62), IRON, STONE, True)
        near.append(cube("barrels", 0.9, 0.55, 0.42, (0.85, 0.35, 0.24), WOOD))
        near.append(cube("chim", 0.22, 0.22, 0.4, (-0.7, 0.2, 1.25), BRICK))
        far = house(False, (2.15, 1.35, 1.0, 0.62), IRON, STONE, True)
    elif kind == "cellardoor":
        near = house(True, (2.05, 1.15, 0.85, 0.7), IRON, STONE, True)
        near.append(cube("sign", 0.55, 0.04, 0.28, (0.85, -0.95, 0.7), CREAM))
        far = house(False, (2.05, 1.15, 0.85, 0.7), IRON, STONE, True)
    elif kind == "valleyvilla":
        near = house(True, (3.05, 1.7, 1.15, 0.85), IRON, STONE, True)
        near.append(cube("chim", 0.32, 0.32, 0.6, (1.15, 0.4, 1.45), BRICK))
        near.append(cube("wing", 0.7, 0.7, 0.7, (-1.35, 0.55, 0.38), solid(STONE)))
        far = house(False, (3.05, 1.7, 1.15, 0.85), IRON, STONE, True)
    elif kind == "shed":
        near = house(True, (1.4, 1.05, 0.75, 0.45), IRON_RED, CREAM, False)
        near.append(cube("bale", 0.28, 0.22, 0.22, (-0.3, -0.2, 0.16), WOOL))
        far = house(False, (1.4, 1.05, 0.75, 0.45), IRON_RED, CREAM, False)
    elif kind == "machine":
        near = house(True, (1.5, 1.1, 0.82, 0.4), IRON_RED, CREAM, False)
        near.append(cyl("wheel", 0.16, 0.08, (-0.45, -0.7, 0.18), IRON, 8))
        far = house(False, (1.5, 1.1, 0.82, 0.4), IRON_RED, CREAM, False)
    elif kind == "yard":
        near = []
        far = []
        for side, y in ((-1, -1.15), (1, 1.15)):
            near.append(cube(f"rail{side}", 2.4, 0.04, 0.04, (0, y, 0.28), WOOD))
            near.append(cube(f"railb{side}", 2.4, 0.04, 0.04, (0, y, 0.48), WOOD))
            far.append(cube(f"frail{side}", 2.4, 0.05, 0.08, (0, y, 0.36), WOOD))
        for side, x in ((-1, -1.2), (1, 1.2)):
            near.append(cube(f"railx{side}", 0.04, 2.2, 0.04, (x, 0, 0.28), WOOD))
            near.append(cube(f"railxb{side}", 0.04, 2.2, 0.04, (x, 0, 0.48), WOOD))
        near += posts("yp", [(-1.15, -1.15), (1.15, -1.15), (-1.15, 1.15), (1.15, 1.15), (0, -1.15), (0, 1.15)], 0.62, 0.04, WOOD)
        office = house(True, (1.15, 0.7, 0.7, 0.35), IRON_RED, CREAM, False)
        for obj in office:
            obj.location.x -= 0.55
            obj.location.y -= 0.35
        near += office
        near.append(cube("ramp", 0.7, 0.45, 0.08, (0.55, 0.15, 0.08), WOOD))
        far.append(cube("foffice", 1.2, 0.8, 0.7, (-0.55, -0.35, 0.4), CREAM))
        far.append(cube("froof", 1.35, 0.95, 0.1, (-0.55, -0.35, 0.8), IRON_RED))
    else:
        raise SystemExit(kind)
    join(near, "near")
    join(far, "far")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.name in ("near", "far"):
            obj.select_set(True)
    path = os.path.join(OUT, kind + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_colors=True,
        export_materials="EXPORT",
        export_animations=False,
        export_skins=False,
    )
    print("wrote", kind, os.path.getsize(path))


if __name__ == "__main__":
    for kind in ("homestead", "winery", "cellardoor", "valleyvilla", "shed", "machine", "yard"):
        build_one(kind)
