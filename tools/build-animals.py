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
    bpy.ops.object.shade_smooth()
    return mesh

def build(name, balls, bones, color, resolution, rough, extra=None, bits=None):
    reset()
    mesh = mesh_from_balls(name, balls, resolution)
    if bits:
        mesh = add_bits(mesh, bits)
    paint(mesh, color)
    material(mesh, rough)
    arm = armature(bones)
    bind(mesh, arm)
    clip_quad(arm)
    if extra:
        extra(arm)
    export(os.path.join(OUT, name + ".glb"), arm, mesh)

def C(r, g, b):
    return (r, g, b, 1)

def near(x, y, z, cx, cy, cz, r):
    return (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 < r * r

def cattle_color(x, y, z):
    for ey in (0.09, -0.09):
        if near(x, y, z, 1.02, ey, 1.16, 0.045):
            return C(0.04, 0.03, 0.025)
        # black eye patches on the white face
        if near(x, y, z, 0.98, ey, 1.15, 0.07) and abs(y) > 0.04:
            return C(0.07, 0.06, 0.05)
    if x > 1.08 and abs(y) < 0.06 and z > 1.0 and z < 1.14:
        return C(0.1, 0.07, 0.06)
    # polled ears stay black
    if z > 1.18 and abs(y) > 0.08 and x > 0.7:
        return C(0.06, 0.05, 0.045)
    white = x > 0.82 and z > 0.98 and abs(y) < 0.16
    h = abs(math.sin(x * 12.3 + y * 4.1 + z * 7.7) * math.sin(x * 3.1 - y * 9.2 + 2.2))
    if h > 0.62 and z > 0.4 and z < 1.15 and abs(y) > 0.06 and x < 0.9:
        white = True
    if z < 0.16 and h > 0.35:
        white = True
    if white:
        return C(0.94, 0.92, 0.88)
    return C(0.06, 0.05, 0.045)

def sheep_color(woolly):
    def fn(x, y, z):
        for ey in (0.05, -0.05):
            if near(x, y, z, 0.52, ey, 0.54, 0.028):
                return C(0.08, 0.06, 0.05)
        if x > 0.54 and abs(y) < 0.03 and z > 0.42 and z < 0.52:
            return C(0.28, 0.16, 0.13)
        if z < 0.1:
            return C(0.42, 0.32, 0.24)
        if woolly:
            if x > 0.4:
                return C(0.8, 0.7, 0.58)
            n = 0.94 + 0.04 * math.sin(x * 22 + y * 17 + z * 9)
            return C(n, n - 0.02, n - 0.05)
        if x > 0.36 or z < 0.24:
            return C(0.8, 0.64, 0.52)
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
    if z > 0.46 and -0.15 < x < 0.4 and abs(y) < 0.09:
        return C(0.16, 0.09, 0.07)
    if z < 0.12:
        return C(0.12, 0.08, 0.06)
    if x > 0.1 and z < 0.42:
        return C(0.86, 0.58, 0.3)
    return C(0.74, 0.34, 0.14)

def hen_color(x, y, z):
    if z > 0.35 and x > 0.06 and abs(y) < 0.05:
        return C(0.82, 0.08, 0.06)
    if x > 0.2 and 0.24 < z < 0.34 and abs(y) < 0.04:
        return C(0.95, 0.7, 0.1)
    if 0.12 < x < 0.2 and 0.22 < z < 0.3 and abs(y) < 0.05:
        return C(0.72, 0.1, 0.08)
    for ey in (0.055, -0.055):
        if near(x, y, z, 0.18, ey, 0.28, 0.016):
            return C(0.08, 0.06, 0.05)
    if abs(y) > 0.08 and 0.16 < z < 0.32:
        return C(0.58, 0.34, 0.14)
    if z < 0.08:
        return C(0.92, 0.72, 0.16)
    return C(0.76, 0.46, 0.16)

def roo_color(x, y, z):
    for ey in (0.055, -0.055):
        if near(x, y, z, 0.48, ey, 1.08, 0.03):
            return C(0.06, 0.05, 0.04)
    if z > 1.2:
        return C(0.4, 0.3, 0.22)
    if x < -0.45:
        return C(0.3, 0.22, 0.16)
    if z < 0.75 and -0.05 < x < 0.3 and abs(y) < 0.12:
        return C(0.78, 0.7, 0.58)
    n = 0.46 + 0.05 * math.sin(x * 9 + z * 7)
    return C(n + 0.08, n, n - 0.05)

def bird_color(x, y, z):
    if z > 0.27 and x < 0.14:
        return C(0.98, 0.78, 0.08)
    if x > 0.16 and z < 0.26:
        return C(0.28, 0.26, 0.24)
    for ey in (0.04, -0.04):
        if near(x, y, z, 0.12, ey, 0.22, 0.018):
            return C(0.06, 0.06, 0.06)
    if abs(y) > 0.1:
        return C(0.9, 0.9, 0.88)
    return C(0.97, 0.97, 0.95)

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
    b.append(ball(0.78, 0.16, 1.22, 0.055, (0.55, 0.35, 0.7)))
    b.append(ball(0.78, -0.16, 1.22, 0.055, (0.55, 0.35, 0.7)))
    b.append(ball(1.04, 0.09, 1.16, 0.038))
    b.append(ball(1.04, -0.09, 1.16, 0.038))
    b.append(ball(1.12, 0, 1.06, 0.045, (0.7, 0.85, 0.55)))
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
    b.append(ball(0.36, 0.1, 0.58, 0.04, (0.45, 0.35, 0.55)))
    b.append(ball(0.36, -0.1, 0.58, 0.04, (0.45, 0.35, 0.55)))
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
    b.append(ball(0.46, 0.07, 0.68, 0.04, (0.4, 0.45, 1.7)))
    b.append(ball(0.46, -0.07, 0.68, 0.04, (0.4, 0.45, 1.7)))
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
    b.append(ball(0.13, 0, 0.38, 0.028, (0.7, 0.35, 1.15)))
    b.append(ball(0.17, 0, 0.4, 0.02, (0.55, 0.3, 0.9)))
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
    b.append(ball(0.32, 0.08, 1.32, 0.028, (0.35, 0.28, 2.4)))
    b.append(ball(0.32, -0.08, 1.32, 0.028, (0.35, 0.28, 2.4)))
    for side in (0.1, -0.1):
        b.append(ball(-0.12, side, 0.45, 0.08))
        b.append(ball(-0.08, side, 0.22, 0.06))
        b.append(ball(0.02, side, 0.04, 0.08, (1.6, 0.55, 0.4)))
        b.append(ball(0.18, side, 0.5, 0.035))
    b.append(ball(-0.45, 0, 0.35, 0.07))
    b.append(ball(-0.7, 0, 0.22, 0.05))
    b.append(ball(-0.95, 0, 0.12, 0.035))
    return b

def bird_balls():
    b = [ball(0, 0, 0.16, 0.07, (1.3, 0.85, 0.8))]
    b.append(ball(0.1, 0, 0.2, 0.045))
    b.append(ball(0.18, 0, 0.2, 0.02, (1.2, 0.45, 0.4)))
    b.append(ball(0.06, 0, 0.32, 0.02, (0.45, 0.4, 1.8)))
    b.append(ball(0.05, 0.025, 0.33, 0.016, (0.4, 0.3, 1.5)))
    b.append(ball(0.05, -0.025, 0.33, 0.016, (0.4, 0.3, 1.5)))
    b.append(ball(0.12, 0.04, 0.22, 0.016))
    b.append(ball(0.12, -0.04, 0.22, 0.016))
    b.append(ball(0.0, 0.15, 0.16, 0.028, (1.8, 0.14, 0.85)))
    b.append(ball(0.0, -0.15, 0.16, 0.028, (1.8, 0.14, 0.85)))
    b.append(ball(-0.1, 0, 0.14, 0.015, (1.5, 0.4, 0.2)))
    for side in (0.03, -0.03):
        b.append(ball(0.02, side, 0.02, 0.014))
    return b

def dog_run(arm):
    begin(arm, "Run")
    for frame in (1, 5, 9, 13, 17):
        rots = walk_rots(frame, 16, 0.9, 1.05)
        rots["spine"] = (-0.25, 0, 0)
        rots["tail"] = (-0.4, 0, 0.5 if frame in (5, 13) else -0.2)
        pose(arm, frame, rots, loc=(0, 0, 0.04 if frame in (5, 13) else 0))
    finish(arm, "Run")

def roo_hop(arm):
    begin(arm, "Hop")
    keys = [(1, 0, 0.2), (8, 0.35, -0.4), (16, 0, 0.25)]
    for frame, height, tuck in keys:
        pose(arm, frame, {
            "leg.BL": (tuck, 0, 0.1), "leg.BR": (tuck, 0, -0.1),
            "shin.BL": (0.8 if height < 0.1 else 0.2, 0, 0),
            "shin.BR": (0.8 if height < 0.1 else 0.2, 0, 0),
            "spine": (-0.3 - height, 0, 0),
            "tail": (0.9 - height * 1.5, 0, 0),
            "ear.L": (-0.2, 0, 0.1), "ear.R": (-0.2, 0, -0.1),
            "leg.FL": (0.4, 0, 0), "leg.FR": (0.4, 0, 0),
        }, loc=(0, 0, height))
    finish(arm, "Hop")

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
            ((1.0, 0.085, 1.13), 0.04, None),
            ((1.0, -0.085, 1.13), 0.04, None),
            ((1.1, 0, 1.05), 0.05, (0.8, 0.9, 0.6)),
            ((0.8, 0.16, 1.2), 0.05, (0.6, 0.4, 0.85)),
            ((0.8, -0.16, 1.2), 0.05, (0.6, 0.4, 0.85)),
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
            ((0.12, 0, 0.38), 0.03, (0.7, 0.4, 1.2)),
            ((0.16, 0, 0.41), 0.02, (0.6, 0.35, 1.0)),
            ((0.22, 0, 0.3), 0.02, (1.4, 0.45, 0.4)),
            ((0.16, 0.05, 0.3), 0.014, None),
            ((0.16, -0.05, 0.3), 0.014, None),
            ((0.15, 0, 0.25), 0.016, (0.6, 0.8, 0.5)),
        ],
    )
    build(
        "kangaroo",
        roo_balls(),
        quad_bones(0.7, 0.25, ((0.2, 0, 0.95), (0.36, 0, 1.08)), ((0.36, 0, 1.05), (0.55, 0, 1.02)), ((-0.4, 0, 0.4), (-1.0, 0, 0.08)), 0.1, 0.16, -0.12, 0.55, 0.25),
        roo_color,
        0.04,
        0.8,
        roo_hop,
        bits=[
            ((0.42, 0.05, 1.05), 0.03, None),
            ((0.42, -0.05, 1.05), 0.03, None),
            ((0.55, 0, 1.0), 0.055, (1.3, 0.6, 0.55)),
            ((0.3, 0.08, 1.28), 0.03, (0.35, 0.3, 2.6)),
            ((0.3, -0.08, 1.28), 0.03, (0.35, 0.3, 2.6)),
        ],
    )
    # Bird uses the same quadruped clip set; wing bones are the front legs, renamed by the flap in Walk.
    build(
        "cockatoo",
        bird_balls(),
        quad_bones(0.16, 0.06, ((0.08, 0, 0.2), (0.14, 0, 0.24)), ((0.14, 0, 0.22), (0.22, 0, 0.2)), ((-0.08, 0, 0.16), (-0.18, 0, 0.14)), 0.1, 0.02, -0.02, 0.14, 0.08),
        bird_color,
        0.012,
        0.55,
        bits=[
            ((0.04, 0, 0.3), 0.028, (0.45, 0.4, 1.8)),
            ((0.03, 0.025, 0.34), 0.02, (0.4, 0.35, 1.6)),
            ((0.03, -0.025, 0.34), 0.02, (0.4, 0.35, 1.6)),
            ((0.18, 0, 0.2), 0.02, (1.3, 0.4, 0.45)),
            ((0.12, 0.04, 0.22), 0.014, None),
            ((0.12, -0.04, 0.22), 0.014, None),
        ],
    )

if __name__ == "__main__":
    main()
