# Headless Blender: rigged, animated animals for Valley Estates.
# Original meshes, CC0. Proportions are real-world metres, Z-up, facing +X.
import bpy
import math
import os
from mathutils import Vector, Euler

OUT = "/workspace/assets/animals/src"
os.makedirs(OUT, exist_ok=True)

def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.metaballs, bpy.data.actions):
        for block in list(coll):
            coll.remove(block)

def mesh_from_balls(name, balls, resolution):
    bpy.ops.object.metaball_add(type="BALL", location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    data = obj.data
    data.resolution = resolution
    data.render_resolution = resolution
    data.threshold = 0.46
    first = True
    for co, radius, size in balls:
        el = data.elements[0] if first else data.elements.new()
        first = False
        el.co = co
        el.radius = radius
        if size is None:
            el.type = "BALL"
        else:
            el.type = "ELLIPSOID"
            el.size_x, el.size_y, el.size_z = size
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    mesh = bpy.context.object
    mesh.name = name
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    faces = len(mesh.data.polygons)
    if faces > 4200:
        mod = mesh.modifiers.new("Dec", "DECIMATE")
        mod.ratio = max(0.2, 3400 / faces)
        bpy.ops.object.modifier_apply(modifier="Dec")
    bpy.ops.object.shade_smooth()
    xs = [v.co.x for v in mesh.data.vertices]
    zs = [v.co.z for v in mesh.data.vertices]
    print(name, "faces", len(mesh.data.polygons), "verts", len(mesh.data.vertices), "x", round(min(xs), 2), round(max(xs), 2), "z", round(min(zs), 2), round(max(zs), 2))
    return mesh

def paint(obj, fn):
    me = obj.data
    attr = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    me.color_attributes.active_color = attr
    for li, loop in enumerate(me.loops):
        v = me.vertices[loop.vertex_index].co
        attr.data[li].color = fn(v.x, v.y, v.z)

def material(obj, rough):
    mat = bpy.data.materials.new(obj.name + "Mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0
    obj.data.materials.append(mat)

def armature(spec):
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "Arm"
    bpy.ops.object.mode_set(mode="EDIT")
    arm.data.edit_bones.remove(arm.data.edit_bones[0])
    made = {}
    for name, head, tail, parent, roll in spec:
        bone = arm.data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = made[parent]
        bone.align_roll(Vector(roll))
        made[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm

def bind(mesh, arm):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # Heat weighting can leave a bone or a vertex with no influence, and the
    # Blender 4.0 glTF exporter then crashes while inserting a neutral bone.
    groups = {g.name: g for g in mesh.vertex_groups}
    for bone in arm.data.bones:
        if bone.name not in groups:
            groups[bone.name] = mesh.vertex_groups.new(name=bone.name)
    used = {name: False for name in groups}
    for vert in mesh.data.vertices:
        total = 0.0
        for g in vert.groups:
            total += g.weight
            if g.weight > 0.001:
                used[mesh.vertex_groups[g.group].name] = True
        if total > 0.001:
            continue
        head_best = None
        best_d = 1e9
        for bone in arm.data.bones:
            d = (vert.co - bone.head_local).length
            if d < best_d:
                best_d = d
                head_best = bone.name
        groups[head_best].add([vert.index], 1.0, "REPLACE")
        used[head_best] = True
    for name, ok in used.items():
        if ok or name not in groups:
            continue
        bone = arm.data.bones.get(name)
        if bone is None:
            continue
        nearest = min(mesh.data.vertices, key=lambda v: (v.co - bone.head_local).length)
        groups[name].add([nearest.index], 0.02, "ADD")

def begin(arm, name):
    if arm.animation_data is None:
        arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.transforms_clear()
    return act

def pose(arm, frame, rots, loc=None):
    if loc and "root" in arm.pose.bones:
        root = arm.pose.bones["root"]
        root.location = loc
        root.keyframe_insert("location", frame=frame)
    for name, rot in rots.items():
        pb = arm.pose.bones[name]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = Euler(rot)
        pb.keyframe_insert("rotation_euler", frame=frame)

def finish(arm, name):
    act = arm.animation_data.action
    act.name = name
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    start = int(act.frame_range[0])
    track.strips.new(name, start, act)
    arm.animation_data.action = None
    bpy.ops.object.mode_set(mode="OBJECT")

def export(path, arm, mesh):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_morph=False,
        export_yup=True,
        export_materials="EXPORT",
        export_colors=True,
    )
    print("wrote", path, os.path.getsize(path))

def quad_bones(hip, chest_x, neck, head, tail, leg_y, fore_x, hind_x, hip_z, knee_z):
    roll_leg = (1, 0, 0)
    roll_pitch = (0, 0, 1)
    return [
        ("root", (0, 0, hip_z), (0.12, 0, hip_z), None, roll_pitch),
        ("spine", (-0.05, 0, hip_z + 0.08), (hind_x - 0.05, 0, hip_z + 0.1), "root", roll_pitch),
        ("chest", (0.05, 0, hip_z + 0.08), (chest_x, 0, hip_z + 0.12), "root", roll_pitch),
        ("neck", neck[0], neck[1], "chest", roll_pitch),
        ("head", head[0], head[1], "neck", roll_pitch),
        ("ear.L", (head[0][0] + 0.02, 0.07, head[0][2] + 0.08), (head[0][0], 0.12, head[0][2] + 0.16), "head", roll_leg),
        ("ear.R", (head[0][0] + 0.02, -0.07, head[0][2] + 0.08), (head[0][0], -0.12, head[0][2] + 0.16), "head", roll_leg),
        ("tail", tail[0], tail[1], "spine", roll_pitch),
        ("leg.FL", (fore_x, leg_y, hip_z), (fore_x, leg_y, knee_z), "chest", roll_leg),
        ("leg.FR", (fore_x, -leg_y, hip_z), (fore_x, -leg_y, knee_z), "chest", roll_leg),
        ("shin.FL", (fore_x, leg_y, knee_z), (fore_x + 0.02, leg_y, 0.02), "leg.FL", roll_leg),
        ("shin.FR", (fore_x, -leg_y, knee_z), (fore_x + 0.02, -leg_y, 0.02), "leg.FR", roll_leg),
        ("leg.BL", (hind_x, leg_y, hip_z), (hind_x, leg_y, knee_z), "spine", roll_leg),
        ("leg.BR", (hind_x, -leg_y, hip_z), (hind_x, -leg_y, knee_z), "spine", roll_leg),
        ("shin.BL", (hind_x, leg_y, knee_z), (hind_x - 0.02, leg_y, 0.02), "leg.BL", roll_leg),
        ("shin.BR", (hind_x, -leg_y, knee_z), (hind_x - 0.02, -leg_y, 0.02), "leg.BR", roll_leg),
    ]

def walk_rots(frame, span, swing, lift):
    # 0 and 0.5 are opposite strides. Diagonal pairs.
    phase = (frame - 1) / span
    def ang(shift):
        t = (phase + shift) % 1
        if t < 0.5:
            return swing * (1 - t * 4) if t < 0.25 else swing * ((t - 0.25) * 4 - 1)
        return -swing * (1 - (t - 0.5) * 4) if t < 0.75 else -swing * (((t - 0.75) * 4) - 1)
    a = ang(0)
    b = ang(0.5)
    bend = lift
    return {
        "leg.FL": (a, 0, 0), "shin.FL": (bend if a < 0 else bend * 0.2, 0, 0),
        "leg.BR": (a, 0, 0), "shin.BR": (bend if a < 0 else bend * 0.2, 0, 0),
        "leg.FR": (b, 0, 0), "shin.FR": (bend if b < 0 else bend * 0.2, 0, 0),
        "leg.BL": (b, 0, 0), "shin.BL": (bend if b < 0 else bend * 0.2, 0, 0),
        "spine": (0.04 * a, 0, 0),
        "tail": (0.25 + 0.2 * a, 0, 0.15 * b),
        "ear.L": (0, 0, 0.15),
        "ear.R": (0, 0, -0.15),
    }

def clip_quad(arm, swing=0.55, lift=0.7):
    begin(arm, "Idle")
    for frame, ear in ((1, 0.05), (16, 0.35), (32, 0.05), (48, 0.05)):
        pose(arm, frame, {
            "spine": (0.03 if frame == 16 else 0, 0, 0),
            "tail": (0.2, 0, 0.25 if frame == 16 else 0),
            "ear.L": (0, 0, ear), "ear.R": (0, 0, -ear),
            "head": (0.05, 0, 0),
        })
    finish(arm, "Idle")
    begin(arm, "Walk")
    for frame in (1, 7, 13, 19, 25):
        pose(arm, frame, walk_rots(frame, 24, swing, lift))
    finish(arm, "Walk")
    begin(arm, "Graze")
    for frame, nod in ((1, 0.95), (20, 1.15), (40, 0.95)):
        pose(arm, frame, {
            "neck": (nod, 0, 0), "head": (0.45, 0, 0),
            "leg.FL": (0.15, 0, 0), "leg.FR": (-0.1, 0, 0),
            "tail": (0.35, 0, 0.1 if frame == 20 else 0),
            "ear.L": (0.2, 0, 0.2), "ear.R": (0.2, 0, -0.2),
        })
    finish(arm, "Graze")
    begin(arm, "Lie")
    pose(arm, 1, {
        "root": (0, 0, 0),
        "leg.FL": (1.2, 0, 0.5), "leg.FR": (1.2, 0, -0.5),
        "leg.BL": (-1.1, 0, 0.45), "leg.BR": (-1.1, 0, -0.45),
        "shin.FL": (0.8, 0, 0), "shin.FR": (0.8, 0, 0),
        "shin.BL": (0.6, 0, 0), "shin.BR": (0.6, 0, 0),
        "neck": (0.4, 0, 0), "head": (0.2, 0, 0),
        "tail": (0.1, 0, 0.4),
    }, loc=(0, 0, -0.22))
    pose(arm, 30, {
        "leg.FL": (1.15, 0, 0.48), "leg.FR": (1.15, 0, -0.48),
        "leg.BL": (-1.05, 0, 0.42), "leg.BR": (-1.05, 0, -0.42),
        "shin.FL": (0.75, 0, 0), "shin.FR": (0.75, 0, 0),
        "neck": (0.35, 0, 0), "tail": (0.15, 0, 0.15),
    }, loc=(0, 0, -0.2))
    finish(arm, "Lie")

def add_bits(mesh, bits):
    objs = [mesh]
    for co, radius, size in bits:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=radius, location=co)
        obj = bpy.context.object
        if size:
            obj.scale = size
            bpy.ops.object.transform_apply(scale=True)
        objs.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.join()
    mesh = bpy.context.object
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()
    return mesh

def build(name, balls, bones, color, resolution, rough, extra=None, bits=None, clips=None):
    only = os.environ.get("VE_ANIMAL")
    if only and name != only:
        return
    reset()
    mesh = mesh_from_balls(name, balls, resolution)
    if bits:
        mesh = add_bits(mesh, bits)
    paint(mesh, color)
    material(mesh, rough)
    arm = armature(bones)
    bind(mesh, arm)
    if clips:
        clips(arm)
    else:
        clip_quad(arm)
    if extra:
        extra(arm)
    export(os.path.join(OUT, name + ".glb"), arm, mesh)

def C(r, g, b):
    return (r, g, b, 1)

def near(x, y, z, cx, cy, cz, r):
    return (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 < r * r

# A few large speckles, not fine noise, so they still read at game scale.
CATTLE_SPOTS = (
    (0.12, 0.22, 0.92, 0.12),
    (-0.22, -0.2, 0.86, 0.11),
    (0.28, -0.18, 0.74, 0.09),
    (-0.08, 0.2, 0.64, 0.09),
    (0.18, 0.16, 1.02, 0.08),
    (-0.32, 0.12, 0.78, 0.08),
)

def cattle_color(x, y, z):
    for ey in (0.1, -0.1):
        if near(x, y, z, 1.0, ey, 1.16, 0.05):
            return C(0.04, 0.03, 0.025)
        # black spectacle patches on the white face
        if near(x, y, z, 0.98, ey, 1.15, 0.055) and abs(y) > 0.04:
            return C(0.07, 0.055, 0.045)
    # grey-pink nose on the white face
    if x > 1.06 and abs(y) < 0.055 and 0.98 < z < 1.14:
        return C(0.45, 0.32, 0.3)
    # polled ears stay black
    if z > 1.16 and abs(y) > 0.09 and x > 0.62:
        return C(0.06, 0.05, 0.045)
    # broad white face, the Speckle Park mark
    if x > 0.7 and z > 0.92 and abs(y) < 0.2:
        return C(0.95, 0.93, 0.9)
    for cx, cy, cz, r in CATTLE_SPOTS:
        if near(x, y, z, cx, cy, cz, r):
            return C(0.94, 0.92, 0.88)
    if z < 0.14:
        return C(0.93, 0.91, 0.86)
    return C(0.05, 0.04, 0.035)

def sheep_color(woolly):
    def fn(x, y, z):
        for ey in (0.055, -0.055):
            if near(x, y, z, 0.52, ey, 0.52, 0.032):
                return C(0.08, 0.06, 0.05)
        if x > 0.54 and abs(y) < 0.035 and 0.4 < z < 0.52:
            return C(0.32, 0.18, 0.14)
        # bare lower legs
        if z < 0.12:
            return C(0.55, 0.4, 0.3) if woolly else C(0.62, 0.44, 0.32)
        if woolly:
            # woolly face, a shade warmer than the fleece so the head reads
            if x > 0.36:
                return C(0.78, 0.66, 0.52)
            if abs(y) > 0.12 and z > 0.5 and x > 0.22:
                return C(0.72, 0.6, 0.48)
            n = 0.93 + 0.03 * math.sin(x * 18 + y * 14 + z * 8)
            return C(n, n - 0.015, n - 0.04)
        # shorn: pale close coat, bare tan face and ears
        if x > 0.32 or (abs(y) > 0.08 and z > 0.42 and x > 0.18):
            return C(0.78, 0.58, 0.44)
        return C(0.9, 0.86, 0.78)
    return fn

def dog_color(x, y, z):
    for ey in (0.045, -0.045):
        if near(x, y, z, 0.62, ey, 0.56, 0.026):
            return C(0.05, 0.04, 0.03)
    if x > 0.66:
        return C(0.1, 0.06, 0.05)
    if z > 0.64 and abs(y) > 0.04:
        return C(0.45, 0.22, 0.12)
    if z > 0.36 and -0.25 < x < 0.38 and abs(y) < 0.08:
        return C(0.14, 0.08, 0.06)
    if z < 0.12:
        return C(0.12, 0.08, 0.06)
    if x > 0.1 and z < 0.42:
        return C(0.86, 0.58, 0.3)
    return C(0.74, 0.34, 0.14)

def hen_color(x, y, z):
    # tall red comb
    if z > 0.34 and x > 0.02 and abs(y) < 0.06:
        return C(0.84, 0.08, 0.06)
    # yellow beak
    if x > 0.18 and 0.22 < z < 0.34 and abs(y) < 0.045:
        return C(0.96, 0.72, 0.08)
    # red wattle
    if 0.12 < x < 0.22 and 0.18 < z < 0.28 and abs(y) < 0.06:
        return C(0.75, 0.1, 0.07)
    for ey in (0.06, -0.06):
        if near(x, y, z, 0.16, ey, 0.3, 0.02):
            return C(0.06, 0.05, 0.04)
    # chestnut wings
    if abs(y) > 0.07 and 0.14 < z < 0.32:
        return C(0.55, 0.28, 0.1)
    # yellow legs
    if z < 0.1:
        return C(0.95, 0.74, 0.14)
    return C(0.72, 0.38, 0.12)

def roo_color(x, y, z):
    for ey in (0.06, -0.06):
        if near(x, y, z, 0.46, ey, 1.12, 0.035):
            return C(0.06, 0.05, 0.04)
    # dark nose
    if x > 0.52 and 0.95 < z < 1.12 and abs(y) < 0.04:
        return C(0.18, 0.12, 0.1)
    # ear backs a little darker
    if z > 1.18:
        return C(0.38, 0.28, 0.2)
    # thick grey-brown tail
    if x < -0.4:
        return C(0.32, 0.24, 0.18)
    # pale belly
    if z < 0.82 and -0.1 < x < 0.28 and abs(y) < 0.14:
        return C(0.82, 0.74, 0.62)
    n = 0.48 + 0.04 * math.sin(x * 8 + z * 6)
    return C(n + 0.1, n + 0.02, n - 0.04)

def bird_color(x, y, z):
    # Sulphur fan sitting on the crown.
    if z > 0.34 and 0.05 < x < 0.26:
        return C(0.98, 0.74, 0.04)
    # Dark eye, then a pale ring so the face has a focal point.
    for ey in (0.045, -0.045):
        if near(x, y, z, 0.2, ey, 0.32, 0.016):
            return C(0.04, 0.035, 0.03)
        if near(x, y, z, 0.2, ey, 0.32, 0.028):
            return C(0.9, 0.88, 0.8)
    # Grey hooked beak, clearly in front of the white face.
    if x > 0.26 and 0.2 < z < 0.36 and abs(y) < 0.07:
        return C(0.32, 0.3, 0.28)
    # Folded wing, a warm white so the wing separates from the body.
    if abs(y) > 0.07 and 0.08 < z < 0.24 and x < 0.12:
        return C(0.96, 0.9, 0.62)
    if z < 0.055:
        return C(0.42, 0.36, 0.3)
    return C(0.98, 0.98, 0.96)

def ball(x, y, z, r, size=None):
    return ((x, y, z), r, size)

def cattle_balls():
    b = []
    b.append(ball(0, 0, 0.95, 0.34, (1.35, 0.85, 0.82)))
    b.append(ball(0.28, 0, 0.92, 0.3, (0.9, 1.05, 0.95)))
    b.append(ball(-0.38, 0, 0.98, 0.32, (0.95, 1.1, 0.8)))
    b.append(ball(0.55, 0, 1.02, 0.16, (0.7, 0.75, 0.7)))
    b.append(ball(0.78, 0, 1.12, 0.16, (1.15, 0.9, 0.75)))
    b.append(ball(0.98, 0, 1.05, 0.1, (1.2, 0.85, 0.6)))
    b.append(ball(0.72, 0.18, 1.26, 0.06, (0.5, 0.32, 0.85)))
    b.append(ball(0.72, -0.18, 1.26, 0.06, (0.5, 0.32, 0.85)))
    b.append(ball(1.02, 0.1, 1.16, 0.042))
    b.append(ball(1.02, -0.1, 1.16, 0.042))
    b.append(ball(1.14, 0, 1.05, 0.05, (0.85, 0.9, 0.6)))
    for side in (0.16, -0.16):
        for x in (0.32, -0.32):
            b.append(ball(x, side, 0.62, 0.11))
            b.append(ball(x, side, 0.34, 0.09))
            b.append(ball(x + 0.02, side, 0.06, 0.075))
    b.append(ball(-0.55, 0, 0.85, 0.06))
    b.append(ball(-0.7, 0, 0.7, 0.05))
    return b

def sheep_balls(woolly):
    b = []
    rad = 0.28 if woolly else 0.16
    b.append(ball(0, 0, 0.42 if woolly else 0.36, rad, (1.15, 1.05, 0.95 if woolly else 0.8)))
    if woolly:
        b.append(ball(0.08, 0.1, 0.48, 0.16))
        b.append(ball(0.08, -0.1, 0.48, 0.16))
        b.append(ball(-0.12, 0, 0.5, 0.18))
    b.append(ball(0.32, 0, 0.48 if woolly else 0.4, 0.12 if woolly else 0.08, (0.8, 1.1, 0.85)))
    b.append(ball(0.48, 0, 0.46, 0.075, (1.15, 0.9, 0.75)))
    b.append(ball(0.52, 0.05, 0.54, 0.028))
    b.append(ball(0.52, -0.05, 0.54, 0.028))
    b.append(ball(0.34, 0.13, 0.58, 0.045, (0.4, 0.32, 0.7)))
    b.append(ball(0.34, -0.13, 0.58, 0.045, (0.4, 0.32, 0.7)))
    for side in (0.1, -0.1):
        for x in (0.12, -0.14):
            b.append(ball(x, side, 0.2, 0.05))
            b.append(ball(x, side, 0.04, 0.04))
    return b

def dog_balls():
    b = [ball(0, 0, 0.42, 0.12, (1.5, 0.7, 0.75))]
    b.append(ball(0.22, 0, 0.44, 0.1, (0.8, 0.75, 0.7)))
    b.append(ball(-0.22, 0, 0.42, 0.1))
    b.append(ball(0.38, 0, 0.5, 0.07))
    b.append(ball(0.52, 0, 0.52, 0.07, (1.2, 0.7, 0.75)))
    b.append(ball(0.66, 0, 0.5, 0.045, (1.4, 0.55, 0.5)))
    b.append(ball(0.62, 0.045, 0.56, 0.022))
    b.append(ball(0.62, -0.045, 0.56, 0.022))
    b.append(ball(0.7, 0, 0.5, 0.03, (1.3, 0.55, 0.5)))
    b.append(ball(0.42, 0.07, 0.74, 0.038, (0.35, 0.4, 2.3)))
    b.append(ball(0.42, -0.07, 0.74, 0.038, (0.35, 0.4, 2.3)))
    for side in (0.07, -0.07):
        for x in (0.16, -0.16):
            b.append(ball(x, side, 0.26, 0.045))
            b.append(ball(x, side, 0.04, 0.038))
    b.append(ball(-0.32, 0, 0.4, 0.03))
    b.append(ball(-0.42, 0.02, 0.48, 0.03))
    return b

def hen_balls():
    b = [ball(0, 0, 0.22, 0.1, (1.25, 0.95, 0.85))]
    b.append(ball(0.12, 0, 0.3, 0.055))
    b.append(ball(0.2, 0, 0.3, 0.025, (1.3, 0.5, 0.4)))
    b.append(ball(0.12, 0, 0.4, 0.032, (0.65, 0.32, 1.35)))
    b.append(ball(0.16, 0, 0.44, 0.024, (0.5, 0.28, 1.15)))
    b.append(ball(0.16, 0, 0.27, 0.018, (0.5, 0.7, 0.45)))
    b.append(ball(0.18, 0.055, 0.28, 0.012))
    b.append(ball(0.18, -0.055, 0.28, 0.012))
    b.append(ball(-0.12, 0, 0.26, 0.045, (0.7, 1.3, 0.45)))
    b.append(ball(0.0, 0.11, 0.24, 0.035, (1.1, 0.2, 0.7)))
    b.append(ball(0.0, -0.11, 0.24, 0.035, (1.1, 0.2, 0.7)))
    for side in (0.04, -0.04):
        b.append(ball(0.02, side, 0.12, 0.02))
        b.append(ball(0.02, side, 0.02, 0.016))
    return b

def roo_balls():
    b = [ball(0.05, 0, 0.85, 0.18, (1.1, 0.75, 0.7))]
    b.append(ball(-0.15, 0, 0.7, 0.2, (0.9, 1.05, 0.85)))
    b.append(ball(-0.28, 0, 0.45, 0.16, (0.8, 0.9, 1.1)))
    b.append(ball(0.22, 0, 0.95, 0.08))
    b.append(ball(0.38, 0, 1.05, 0.09, (1.25, 0.7, 0.7)))
    b.append(ball(0.52, 0, 1.02, 0.05, (1.3, 0.55, 0.45)))
    b.append(ball(0.48, 0.055, 1.08, 0.028))
    b.append(ball(0.48, -0.055, 1.08, 0.028))
    b.append(ball(0.3, 0.09, 1.38, 0.03, (0.32, 0.26, 2.8)))
    b.append(ball(0.3, -0.09, 1.38, 0.03, (0.32, 0.26, 2.8)))
    for side in (0.1, -0.1):
        b.append(ball(-0.12, side, 0.45, 0.08))
        b.append(ball(-0.08, side, 0.22, 0.06))
        b.append(ball(0.0, side, 0.12, 0.07))
        b.append(ball(0.02, side, 0.04, 0.08, (1.6, 0.55, 0.4)))
        b.append(ball(0.18, side, 0.5, 0.035))
    b.append(ball(-0.45, 0, 0.35, 0.07))
    b.append(ball(-0.7, 0, 0.22, 0.05))
    b.append(ball(-0.95, 0, 0.12, 0.035))
    return b

def bird_balls():
    # Sulphur-crested cockatoo. The body is the mass; the crest is a fan
    # wide enough to read from the side, and the beak is a solid hook.
    b = [ball(0.0, 0, 0.17, 0.12, (1.35, 1.05, 1.05))]
    b.append(ball(0.1, 0, 0.26, 0.07))
    b.append(ball(0.16, 0, 0.33, 0.072, (1.05, 1.0, 0.95)))
    b.append(ball(0.32, 0, 0.3, 0.05, (1.65, 0.72, 0.78)))
    b.append(ball(0.3, 0, 0.24, 0.032, (1.4, 0.6, 0.5)))
    # Fat fan on the crown, forward enough to read from the front.
    b.append(ball(0.16, 0.0, 0.46, 0.045))
    b.append(ball(0.18, 0.055, 0.43, 0.04))
    b.append(ball(0.18, -0.055, 0.43, 0.04))
    b.append(ball(0.2, 0.1, 0.39, 0.034))
    b.append(ball(0.2, -0.1, 0.39, 0.034))
    b.append(ball(0.14, 0.0, 0.38, 0.04))
    b.append(ball(0.2, 0.045, 0.33, 0.016))
    b.append(ball(0.2, -0.045, 0.33, 0.016))
    b.append(ball(-0.02, 0.1, 0.17, 0.04, (1.35, 0.28, 0.85)))
    b.append(ball(-0.02, -0.1, 0.17, 0.04, (1.35, 0.28, 0.85)))
    b.append(ball(-0.16, 0, 0.14, 0.028, (1.5, 0.7, 0.4)))
    for side in (0.04, -0.04):
        b.append(ball(0.02, side, 0.07, 0.022))
        b.append(ball(0.04, side, 0.02, 0.02))
    return b

def clip_roo(arm):
    # Rest mesh is already upright. Idle only breathes and flicks the ears
    # so the long ears, belly, and tail stay readable.
    begin(arm, "Idle")
    for frame, ear in ((1, 0.04), (16, 0.22), (32, 0.04), (48, 0.04)):
        pose(arm, frame, {
            "spine": (-0.08, 0, 0),
            "neck": (-0.05, 0, 0),
            "tail": (0.25, 0, 0.12 if frame == 16 else 0.02),
            "ear.L": (-0.08, 0, ear),
            "ear.R": (-0.08, 0, -ear),
            "leg.FL": (0.25, 0, 0.15),
            "leg.FR": (0.25, 0, -0.15),
        })
    finish(arm, "Idle")
    begin(arm, "Walk")
    for frame in (1, 7, 13, 19, 25):
        pose(arm, frame, walk_rots(frame, 24, 0.28, 0.35))
    finish(arm, "Walk")
    begin(arm, "Graze")
    for frame, nod in ((1, 0.55), (20, 0.8), (40, 0.55)):
        pose(arm, frame, {
            "neck": (nod, 0, 0), "head": (0.35, 0, 0),
            "tail": (0.4, 0, 0),
            "ear.L": (0.2, 0, 0.1), "ear.R": (0.2, 0, -0.1),
        })
    finish(arm, "Graze")
    begin(arm, "Lie")
    pose(arm, 1, {
        "spine": (0.35, 0, 0),
        "leg.BL": (0.8, 0, 0.3), "leg.BR": (0.8, 0, -0.3),
        "leg.FL": (1.0, 0, 0.4), "leg.FR": (1.0, 0, -0.4),
        "tail": (0.15, 0, 0.5),
        "neck": (0.2, 0, 0),
    }, loc=(0, 0, -0.12))
    pose(arm, 30, {
        "spine": (0.3, 0, 0),
        "tail": (0.2, 0, 0.2),
    }, loc=(0, 0, -0.1))
    finish(arm, "Lie")
    begin(arm, "Hop")
    keys = [(1, 0.0, 0.55), (8, 0.28, -0.15), (16, 0.0, 0.6)]
    for frame, height, tuck in keys:
        pose(arm, frame, {
            "spine": (-0.35 - height, 0, 0),
            "leg.BL": (tuck, 0, 0.12), "leg.BR": (tuck, 0, -0.12),
            "shin.BL": (0.9 if height < 0.08 else 0.15, 0, 0),
            "shin.BR": (0.9 if height < 0.08 else 0.15, 0, 0),
            "leg.FL": (0.45, 0, 0.2), "leg.FR": (0.45, 0, -0.2),
            "tail": (0.85 - height, 0, 0),
            "ear.L": (-0.25, 0, 0.08), "ear.R": (-0.25, 0, -0.08),
        }, loc=(0, 0, height))
    finish(arm, "Hop")

def dog_run(arm):
    begin(arm, "Run")
    for frame in (1, 5, 9, 13, 17):
        rots = walk_rots(frame, 16, 0.9, 1.05)
        rots["spine"] = (-0.25, 0, 0)
        rots["tail"] = (-0.4, 0, 0.5 if frame in (5, 13) else -0.2)
        pose(arm, frame, rots, loc=(0, 0, 0.04 if frame in (5, 13) else 0))
    finish(arm, "Run")

def main():
    bpy.context.scene.render.fps = 24
    build(
        "cattle",
        cattle_balls(),
        quad_bones(0.9, 0.45, ((0.5, 0, 1.05), (0.7, 0, 1.15)), ((0.72, 0, 1.12), (1.0, 0, 1.08)), ((-0.5, 0, 0.95), (-0.75, 0, 0.7)), 0.18, 0.32, -0.32, 0.78, 0.38),
        cattle_color,
        0.032,
        0.82,
        bits=[
            ((1.0, 0.1, 1.16), 0.045, None),
            ((1.0, -0.1, 1.16), 0.045, None),
            ((1.12, 0, 1.04), 0.055, (0.9, 0.95, 0.65)),
            ((0.74, 0.18, 1.24), 0.055, (0.5, 0.35, 0.9)),
            ((0.74, -0.18, 1.24), 0.055, (0.5, 0.35, 0.9)),
        ],
    )
    build(
        "sheep",
        sheep_balls(True),
        quad_bones(0.4, 0.2, ((0.28, 0, 0.5), (0.4, 0, 0.52)), ((0.4, 0, 0.5), (0.52, 0, 0.48)), ((-0.22, 0, 0.48), (-0.32, 0, 0.4)), 0.1, 0.12, -0.12, 0.32, 0.16),
        sheep_color(True),
        0.03,
        0.95,
        bits=[
            ((0.5, 0.05, 0.54), 0.026, None),
            ((0.5, -0.05, 0.54), 0.026, None),
            ((0.34, 0.11, 0.58), 0.04, (0.5, 0.4, 0.7)),
            ((0.34, -0.11, 0.58), 0.04, (0.5, 0.4, 0.7)),
        ],
    )
    build(
        "sheep_shorn",
        sheep_balls(False),
        quad_bones(0.34, 0.16, ((0.22, 0, 0.4), (0.34, 0, 0.42)), ((0.34, 0, 0.4), (0.48, 0, 0.38)), ((-0.16, 0, 0.38), (-0.26, 0, 0.32)), 0.09, 0.1, -0.12, 0.28, 0.14),
        sheep_color(False),
        0.025,
        0.78,
        bits=[
            ((0.48, 0.045, 0.5), 0.024, None),
            ((0.48, -0.045, 0.5), 0.024, None),
            ((0.55, 0, 0.46), 0.03, (1.1, 0.7, 0.6)),
            ((0.32, 0.1, 0.52), 0.035, (0.45, 0.35, 0.7)),
            ((0.32, -0.1, 0.52), 0.035, (0.45, 0.35, 0.7)),
        ],
    )
    build(
        "dog",
        dog_balls(),
        quad_bones(0.4, 0.28, ((0.32, 0, 0.48), (0.48, 0, 0.54)), ((0.5, 0, 0.52), (0.7, 0, 0.5)), ((-0.28, 0, 0.42), (-0.48, 0, 0.52)), 0.08, 0.16, -0.16, 0.32, 0.16),
        dog_color,
        0.025,
        0.72,
        dog_run,
        bits=[
            ((0.58, 0.045, 0.56), 0.022, None),
            ((0.58, -0.045, 0.56), 0.022, None),
            ((0.7, 0, 0.5), 0.04, (1.35, 0.55, 0.55)),
            ((0.44, 0.07, 0.74), 0.035, (0.4, 0.45, 1.9)),
            ((0.44, -0.07, 0.74), 0.035, (0.4, 0.45, 1.9)),
        ],
    )
    build(
        "chicken",
        hen_balls(),
        quad_bones(0.2, 0.08, ((0.1, 0, 0.28), (0.16, 0, 0.32)), ((0.16, 0, 0.3), (0.24, 0, 0.3)), ((-0.08, 0, 0.24), (-0.16, 0, 0.28)), 0.045, 0.04, -0.02, 0.16, 0.08),
        hen_color,
        0.015,
        0.7,
        bits=[
            ((0.11, 0, 0.42), 0.034, (0.65, 0.35, 1.4)),
            ((0.15, 0, 0.46), 0.022, (0.55, 0.3, 1.15)),
            ((0.24, 0, 0.3), 0.022, (1.6, 0.4, 0.4)),
            ((0.16, 0.055, 0.3), 0.016, None),
            ((0.16, -0.055, 0.3), 0.016, None),
            ((0.16, 0, 0.24), 0.018, (0.55, 0.7, 0.55)),
        ],
    )
    build(
        "kangaroo",
        roo_balls(),
        quad_bones(0.7, 0.25, ((0.2, 0, 0.95), (0.36, 0, 1.08)), ((0.36, 0, 1.05), (0.55, 0, 1.02)), ((-0.4, 0, 0.4), (-1.0, 0, 0.08)), 0.1, 0.16, -0.12, 0.55, 0.25),
        roo_color,
        0.04,
        0.8,
        bits=[
            ((0.42, 0.05, 1.05), 0.03, None),
            ((0.42, -0.05, 1.05), 0.03, None),
            ((0.55, 0, 1.0), 0.055, (1.3, 0.6, 0.55)),
            ((0.3, 0.08, 1.28), 0.03, (0.35, 0.3, 2.6)),
            ((0.3, -0.08, 1.28), 0.03, (0.35, 0.3, 2.6)),
        ],
        clips=clip_roo,
    )
    # Bird uses the same quadruped clip set; wing bones are the front legs, renamed by the flap in Walk.
    build(
        "cockatoo",
        bird_balls(),
        quad_bones(0.2, 0.12, ((0.12, 0, 0.28), (0.18, 0, 0.34)), ((0.18, 0, 0.32), (0.3, 0, 0.3)), ((-0.08, 0, 0.16), (-0.2, 0, 0.12)), 0.09, 0.02, -0.06, 0.18, 0.08),
        bird_color,
        0.012,
        0.78,
    )

if __name__ == "__main__":
    main()
