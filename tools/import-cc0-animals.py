# Bake CC0 rigged animals into the game's skinned GLBs.
#
# Cattle and the dog are Quaternius, Ultimate Animated Animal Pack (CC0):
#   https://quaternius.com/packs/ultimateanimatedanimals.html
# The sheep is Quaternius, Farm Animal Pack (CC0):
#   https://quaternius.com/packs/farmanimal.html
#   https://poly.pizza/bundle/Farm-Animal-Pack-1kUvRTPLzT
# That farm pack is llama, pig, pug, sheep, horse, cow, and zebra. It has no hen.
# The hen is the CC0 rigged chicken by Čestmír Dammer:
#   https://opengameart.org/content/chicken-animated
# Its photo texture is not used. Colour is painted vertex colour.
#
# Sources are read from /tmp (not committed). Outputs land in assets/animals/src.
# Facing matches the older herd: +X forward in Blender, which the glTF export
# keeps as +X forward and +Y up.

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT = "/workspace/assets/animals/src"
COW = "/tmp/qpack/Cow.gltf"
DOG = "/tmp/qpack/ShibaInu.gltf"
SHEEP = "/tmp/farm/Sheep.blend"
HEN = "/tmp/chickenV2.blend"


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def armature():
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if len(arms) != 1:
        raise RuntimeError("expected one armature, got %s" % [a.name for a in arms])
    return arms[0]


def drop_helpers(keep):
    for obj in list(mesh_objects()):
        if obj.name not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)


def view3d_override():
    wm = bpy.context.window_manager
    if not wm.windows:
        return None
    window = wm.windows[0]
    area = next((a for a in window.screen.areas if a.type == "VIEW_3D"), None)
    if area is None:
        return None
    region = next((r for r in area.regions if r.type == "WINDOW"), None)
    return {"window": window, "screen": window.screen, "area": area, "region": region}


def in_view(fn):
    override = view3d_override()
    if override:
        with bpy.context.temp_override(**override):
            return fn()
    return fn()


def join_into(host_name, extra_names):
    host = bpy.data.objects[host_name]
    extras = [bpy.data.objects[n] for n in extra_names if n in bpy.data.objects]
    if not extras:
        return host

    def run():
        if bpy.context.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="DESELECT")
        for obj in extras:
            obj.select_set(True)
        host.select_set(True)
        bpy.context.view_layer.objects.active = host
        bpy.ops.object.join()

    in_view(run)
    return bpy.context.view_layer.objects.active


def mute_constraints(arm):
    for pb in arm.pose.bones:
        for con in pb.constraints:
            con.mute = True


def orient(arm, mesh):
    # Head sits on -Y in these files. +90° around Z puts it on +X.
    rot = Matrix.Rotation(math.radians(90.0), 4, "Z")
    arm.matrix_world = rot @ arm.matrix_world
    bpy.context.view_layer.update()

    def run():
        if bpy.context.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="DESELECT")
        arm.select_set(True)
        mesh.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        mesh.select_set(False)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    in_view(run)


def delete_faces_named(obj, names):
    mesh = obj.data
    wanted = set()
    for i, slot in enumerate(obj.material_slots):
        label = slot.name if slot.material is None else slot.material.name
        if any(label.startswith(n) for n in names):
            wanted.add(i)
    if not wanted:
        print("no material", names)
        return 0
    bm = bmesh.new()
    bm.from_mesh(mesh)
    doomed = [face for face in bm.faces if face.material_index in wanted]
    print("delete faces", len(doomed), "of", len(bm.faces), "slots", wanted)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return len(doomed)


def slot_name(obj, index):
    if index < 0 or index >= len(obj.material_slots):
        return ""
    slot = obj.material_slots[index]
    if slot.material:
        return slot.material.name
    return slot.name


def vert_materials(obj):
    mesh = obj.data
    names = [""] * len(mesh.vertices)
    for poly in mesh.polygons:
        label = slot_name(obj, poly.material_index)
        for vi in poly.vertices:
            names[vi] = label
    return names


def bounds_of(obj):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
        mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
    return mn, mx


def noise(x, y, z):
    return abs(math.sin(x * 12.1 + y * 4.7 + z * 8.3) * math.sin(x * 3.3 - z * 6.1 + y * 2.2))


def shade(rgb, normal, light):
    form = max(0.0, min(1.0, normal.z * 0.55 + normal.x * 0.4 + 0.2))
    if light:
        k = 0.96 + 0.06 * form
    else:
        k = 0.55 + 1.05 * form
    r, g, b = (min(1.0, c * k) for c in rgb)
    if not light and normal.z < -0.15:
        r = min(1.0, r + 0.025)
        g = min(1.0, g + 0.012)
    return (r, g, b)


def paint(obj, fn):
    mesh = obj.data
    existing = mesh.color_attributes.get("Col")
    if existing:
        mesh.color_attributes.remove(existing)
    attr = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    mesh.color_attributes.active_color = attr
    mats = vert_materials(obj)
    mn, mx = bounds_of(obj)
    for i, v in enumerate(mesh.vertices):
        w = obj.matrix_world @ v.co
        n = (obj.matrix_world.to_3x3() @ v.normal).normalized()
        r, g, b = fn(w, n, mats[i], mn, mx)
        attr.data[i].color = (r, g, b, 1.0)


def clear_uvs(obj):
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])


def one_material(obj):
    mesh = obj.data
    mesh.materials.clear()
    mat = bpy.data.materials.new("Coat")
    mat.use_nodes = True
    principled = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (1, 1, 1, 1)
    principled.inputs["Roughness"].default_value = 0.86
    mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.material_index = 0


def cow_color(w, n, mat, mn, mx):
    span_x = max(1e-4, mx.x - mn.x)
    span_z = max(1e-4, mx.z - mn.z)
    nx = (w.x - mn.x) / span_x
    nz = (w.z - mn.z) / span_z
    if mat.startswith("Eye_Black"):
        return (0.02, 0.018, 0.016)
    if mat.startswith("Eye_White"):
        return (0.96, 0.96, 0.94)
    if mat.startswith("Hooves") or nz < 0.08:
        return shade((0.14, 0.08, 0.045), n, False)
    nose = mat.startswith("Muzzle") and nx > 0.86
    # Whole head in front of the neck, so the white reads as a mask.
    face = nx > 0.60 and nz > 0.36
    if mat.startswith("Horns"):
        return shade((0.93, 0.9, 0.84), n, True)
    if nose:
        return shade((0.93, 0.55, 0.52), n, True)
    if face or mat.startswith("Muzzle"):
        return shade((0.99, 0.99, 0.97), n, True)
    belly = 0.16 < nz < 0.34 and abs(w.y) < (mx.y - mn.y) * 0.22
    speck = noise(w.x, w.y, w.z)
    if belly:
        if speck > 0.62:
            return shade((0.05, 0.04, 0.035), n, False)
        return shade((0.97, 0.97, 0.94), n, True)
    if 0.18 < nz < 0.5 and speck > 0.84:
        return shade((0.96, 0.95, 0.92), n, True)
    return shade((0.045, 0.038, 0.032), n, False)


def dog_color(w, n, mat, mn, mx):
    if mat.startswith("Eyes_Black") or mat.startswith("Eyes_Pupil") or mat.startswith("Black"):
        return (0.03, 0.025, 0.02)
    if mat.startswith("Eyes_White"):
        return (0.93, 0.9, 0.82)
    if mat.startswith("Main_Light"):
        return shade((0.86, 0.58, 0.28), n, True)
    return shade((0.62, 0.2, 0.07), n, False)


def sheep_color(shorn):
    def fn(w, n, mat, mn, mx):
        span_x = max(1e-4, mx.x - mn.x)
        span_z = max(1e-4, mx.z - mn.z)
        nx = (w.x - mn.x) / span_x
        nz = (w.z - mn.z) / span_z
        wool = mat.startswith("White")
        if wool:
            if shorn:
                skin = (0.78, 0.56, 0.48)
                return shade(skin, n, True)
            return shade((0.96, 0.94, 0.88), n, True)
        if nz < 0.28:
            return shade((0.28, 0.16, 0.1), n, False)
        # Teddy-bear face on the black material above the legs.
        eye = nx > 0.78 and 0.55 < nz < 0.82 and abs(w.y) > (mx.y - mn.y) * 0.04 and abs(w.y) < (mx.y - mn.y) * 0.16
        if eye:
            return (0.04, 0.03, 0.025)
        if nx > 0.9 and 0.45 < nz < 0.7:
            return shade((0.42, 0.18, 0.14), n, False)
        return shade((0.72, 0.48, 0.32), n, True)

    return fn


def hen_color(w, n, mat, mn, mx):
    span_x = max(1e-4, mx.x - mn.x)
    span_z = max(1e-4, mx.z - mn.z)
    nx = (w.x - mn.x) / span_x
    nz = (w.z - mn.z) / span_z
    if mat.startswith("Comb"):
        return (0.92, 0.06, 0.05)
    if "Eye" in mat or mat.startswith("Material"):
        return (0.03, 0.025, 0.02)
    if nz < 0.12:
        return shade((0.98, 0.8, 0.18), n, True)
    if nx > 0.78 and 0.48 < nz < 0.78:
        return shade((0.98, 0.74, 0.14), n, True)
    if nx > 0.35 and 0.16 < nz < 0.55:
        return shade((0.98, 0.86, 0.58), n, True)
    return shade((0.96, 0.74, 0.42), n, True)


def action_matches(name, prefix):
    if name == prefix:
        return True
    for sep in ("_", "|"):
        token = prefix + sep
        if not name.startswith(token):
            continue
        rest = name[len(token):]
        if rest.startswith("Animal") or rest.startswith("Armature"):
            return True
    return False


def find_action(prefixes):
    for prefix in prefixes:
        for action in bpy.data.actions:
            if action_matches(action.name, prefix):
                return action
    raise RuntimeError("no action in %s among %s" % (prefixes, [a.name for a in bpy.data.actions]))


def key_pose(arm, mats, action_name, frame_a, frame_b):
    action = bpy.data.actions.new(action_name)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    apply_pose(arm, mats)
    for pb in arm.pose.bones:
        pb.keyframe_insert("location", frame=frame_a)
        pb.keyframe_insert("location", frame=frame_b)
        if pb.rotation_mode == "QUATERNION":
            pb.keyframe_insert("rotation_quaternion", frame=frame_a)
            pb.keyframe_insert("rotation_quaternion", frame=frame_b)
        else:
            pb.keyframe_insert("rotation_euler", frame=frame_a)
            pb.keyframe_insert("rotation_euler", frame=frame_b)
        pb.keyframe_insert("scale", frame=frame_a)
        pb.keyframe_insert("scale", frame=frame_b)
    return action


def capture_pose(arm):
    bpy.context.view_layer.update()
    return {pb.name: pb.matrix.copy() for pb in arm.pose.bones}


def apply_pose(arm, mats):
    for pb in arm.pose.bones:
        if pb.name in mats:
            pb.matrix = mats[pb.name]
    bpy.context.view_layer.update()


def bake_hold(arm, source, name):
    arm.animation_data.action = source
    bpy.context.scene.frame_set(int(source.frame_range[1]))
    bpy.context.view_layer.update()
    mats = capture_pose(arm)
    mute_constraints(arm)
    return key_pose(arm, mats, name, 1, 24)


def bake_graze(arm, source):
    arm.animation_data.action = source
    bpy.context.scene.frame_set(int(source.frame_range[0]) + 8)
    bpy.context.view_layer.update()
    mats = capture_pose(arm)
    mute_constraints(arm)
    apply_pose(arm, mats)
    for bone_name in ("Head", "Neck", "Neck1", "Neck2"):
        pb = arm.pose.bones.get(bone_name)
        if pb is None:
            continue
        pb.rotation_mode = "XYZ"
        pb.rotation_euler.x += math.radians(32 if bone_name == "Head" else 14)
    bpy.context.view_layer.update()
    mats = capture_pose(arm)
    return key_pose(arm, mats, "Graze", 1, 36)


def keep_actions(arm, mapping):
    # mapping: export name -> source action. Lie/Graze may already be new actions.
    mute_constraints(arm)
    renamed = set()
    for export_name, source in mapping.items():
        if source is None:
            continue
        source.name = export_name
        renamed.add(source)
    for action in list(bpy.data.actions):
        if action not in renamed:
            bpy.data.actions.remove(action)
    if arm.animation_data:
        arm.animation_data.action = bpy.data.actions.get("Idle")
        for track in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(track)


def prepare_clips(arm, kind):
    if kind == "sheep":
        idle = find_action(["Idle"])
        walk = find_action(["Walk"])
        run = find_action(["Run"])
        death = find_action(["Death"])
        lie = bake_hold(arm, death, "LieHold")
        graze = bake_graze(arm, idle)
        # bake_* assigns new actions; Idle/Walk/Run still have original names
        keep_actions(arm, {"Idle": idle, "Walk": walk, "Run": run, "Graze": graze, "Lie": lie})
        return
    if kind == "hen":
        idle = find_action(["Idle"])
        walk = find_action(["Walk"])
        peck = find_action(["Pecking1", "Eating"])
        dying = find_action(["Dying", "Death"])
        lie = bake_hold(arm, dying, "LieHold")
        keep_actions(arm, {"Idle": idle, "Walk": walk, "Graze": peck, "Lie": lie})
        return
    idle = find_action(["Idle"])
    walk = find_action(["Walk"])
    eat = find_action(["Eating"])
    death = find_action(["Death"])
    gallop = find_action(["Gallop"])
    lie = bake_hold(arm, death, "LieHold")
    keep_actions(arm, {"Idle": idle, "Walk": walk, "Graze": eat, "Lie": lie, "Run": gallop})


def grow_comb(obj):
    mats = vert_materials(obj)
    comb = [v.co.copy() for i, v in enumerate(obj.data.vertices) if mats[i].startswith("Comb")]
    if len(comb) < 3:
        print("comb verts", len(comb))
        return
    center = sum(comb, Vector()) / len(comb)
    for i, v in enumerate(obj.data.vertices):
        if not mats[i].startswith("Comb"):
            continue
        v.co = center + (v.co - center) * 4.2
    print("grew comb", len(comb), "around", tuple(round(c, 3) for c in center))


def pin_curve(action, data_path, values):
    for index, value in enumerate(values):
        curve = action.fcurves.find(data_path, index=index)
        if curve is None:
            curve = action.fcurves.new(data_path, index=index)
        points = curve.keyframe_points
        while len(points) > 2:
            points.remove(points[-1])
        if len(points) < 2:
            points.add(2 - len(points))
        points[0].co = (1.0, value)
        points[1].co = (max(2.0, action.frame_range[1]), value)
        points[0].interpolation = "LINEAR"
        points[1].interpolation = "LINEAR"
        curve.update()


def straighten_tail(arm):
    # Pose-space X rotation that drops the Shiba curl into a straight tail.
    angle = math.radians(-28.0)
    for action in list(bpy.data.actions):
        for bone in ("Tail1", "Tail2", "Tail3"):
            for curve in list(action.fcurves):
                if curve.data_path == 'pose.bones["%s"].rotation_quaternion' % bone:
                    action.fcurves.remove(curve)
            pin_curve(action, 'pose.bones["%s"].rotation_euler' % bone, (angle, 0.0, 0.0))
            pin_curve(action, 'pose.bones["%s"].location' % bone, (0.0, 0.0, 0.0))
            pin_curve(action, 'pose.bones["%s"].scale' % bone, (1.0, 1.0, 1.0))
        if arm.animation_data:
            arm.animation_data.action = action
        for bone in ("Tail1", "Tail2", "Tail3"):
            pb = arm.pose.bones.get(bone)
            if pb is None:
                continue
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = (angle, 0.0, 0.0)
            pb.location = (0.0, 0.0, 0.0)
            pb.scale = (1.0, 1.0, 1.0)


def deflate_wool(obj):
    mats = vert_materials(obj)
    for i, v in enumerate(obj.data.vertices):
        if not mats[i].startswith("White"):
            continue
        v.co.x *= 0.84
        v.co.y *= 0.84


def export(arm, mesh, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

    def run():
        if bpy.context.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="DESELECT")
        arm.select_set(True)
        mesh.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_nla_strips=False,
        export_skins=True,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
        export_materials="EXPORT",
            export_image_format="NONE",
        )

    in_view(run)
    print("wrote", path, os.path.getsize(path))


def report(obj, label):
    mn, mx = bounds_of(obj)
    size = mx - mn
    print(label, "min", tuple(round(c, 3) for c in mn), "size", tuple(round(c, 3) for c in size), "verts", len(obj.data.vertices))


def finish(kind, arm, mesh, path, shorn=False):
    orient(arm, mesh)
    if kind == "cow":
        delete_faces_named(mesh, ["Horns"])
    if kind == "hen":
        grow_comb(mesh)
    if shorn:
        deflate_wool(mesh)
    paint(mesh, sheep_color(True) if shorn else COLOR[kind])
    one_material(mesh)
    clear_uvs(mesh)
    prepare_clips(arm, "sheep" if kind == "sheep" else kind)
    if kind == "dog":
        straighten_tail(arm)
    report(mesh, path)
    export(arm, mesh, path)


COLOR = {"cow": cow_color, "dog": dog_color, "sheep": sheep_color(False), "hen": hen_color}


def load_gltf(path):
    fresh()
    bpy.ops.import_scene.gltf(filepath=path)
    drop_helpers({"Cow", "ShibaInu"})
    mesh = mesh_objects()[0]
    return armature(), mesh


def load_blend(path, keep, join_extras):
    bpy.ops.wm.open_mainfile(filepath=path)
    drop_helpers(set(keep) | set(join_extras))
    mesh = join_into(keep[0], join_extras)
    return armature(), mesh


def main():
    arm, mesh = load_gltf(COW)
    finish("cow", arm, mesh, os.path.join(OUT, "cattle.glb"))

    arm, mesh = load_gltf(DOG)
    finish("dog", arm, mesh, os.path.join(OUT, "dog.glb"))

    arm, mesh = load_blend(SHEEP, ["Sheep"], [])
    finish("sheep", arm, mesh, os.path.join(OUT, "sheep.glb"))

    arm, mesh = load_blend(SHEEP, ["Sheep"], [])
    finish("sheep", arm, mesh, os.path.join(OUT, "sheep_shorn.glb"), shorn=True)

    arm, mesh = load_blend(HEN, ["Chicken"], ["Eyes"])
    finish("hen", arm, mesh, os.path.join(OUT, "chicken.glb"))


if __name__ == "__main__":
    main()
