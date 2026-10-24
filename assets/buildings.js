/* Valley Estates rural buildings. Original CC0 meshes from tools/build-buildings.py. */
(function () {
  const BASE = new URL("./", document.currentScript.src);
  const FILES = ["homestead", "winery", "cellardoor", "valleyvilla", "shed", "machine", "yard"];
  const CHIM = {
    homestead: [0.45, 1.55, -0.35],
    winery: [-0.7, 1.35, -0.2],
    valleyvilla: [1.15, 1.7, -0.4],
  };
  let api = null;
  const cache = {};
  let bytes = 0;

  function readGLB(buffer) {
    const view = new DataView(buffer);
    const jsonLen = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
    const binStart = 20 + jsonLen;
    const binLen = view.getUint32(binStart, true);
    const bin = new Uint8Array(buffer, binStart + 8, binLen);
    return { json, bin };
  }

  function componentCount(type) {
    if (type === "SCALAR") return 1;
    if (type === "VEC2") return 2;
    if (type === "VEC3") return 3;
    if (type === "VEC4") return 4;
    return 1;
  }

  function accessor(json, bin, index) {
    const acc = json.accessors[index];
    const bv = json.bufferViews[acc.bufferView];
    const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const comps = componentCount(acc.type);
    const count = acc.count * comps;
    const width = acc.componentType === 5126 ? 4 : acc.componentType === 5123 ? 2 : acc.componentType === 5125 ? 4 : 1;
    const src = bin.subarray(start, start + count * width);
    const copy = new Uint8Array(src.byteLength);
    copy.set(src);
    if (acc.componentType === 5126) return new Float32Array(copy.buffer);
    if (acc.componentType === 5123) {
      const raw = new Uint16Array(copy.buffer);
      if (!acc.normalized) return raw;
      const out = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw[i] / 65535;
      return out;
    }
    if (acc.componentType === 5125) return new Uint32Array(copy.buffer);
    if (acc.componentType === 5121) {
      const out = new Float32Array(count);
      for (let i = 0; i < count; i++) out[i] = copy[i] / 255;
      return out;
    }
    throw new Error("component " + acc.componentType);
  }

  function geometry(prim, json, bin) {
    const pos = accessor(json, bin, prim.attributes.POSITION);
    const geo = new api.Geo();
    geo.setAttribute("position", new api.Attr(pos, 3));
    if (prim.attributes.NORMAL != null) geo.setAttribute("normal", new api.Attr(accessor(json, bin, prim.attributes.NORMAL), 3));
    else geo.computeVertexNormals();
    if (prim.attributes.COLOR_0 != null) {
      const col = accessor(json, bin, prim.attributes.COLOR_0);
      const verts = pos.length / 3;
      const stride = col.length / verts;
      const rgb = new Float32Array(verts * 3);
      for (let i = 0; i < verts; i++) {
        rgb[i * 3] = col[i * stride];
        rgb[i * 3 + 1] = col[i * stride + 1];
        rgb[i * 3 + 2] = col[i * stride + 2];
      }
      geo.setAttribute("color", new api.Attr(rgb, 3));
    }
    if (prim.indices != null) geo.setIndex(new api.Attr(accessor(json, bin, prim.indices), 1));
    return geo;
  }

  function load(json, bin) {
    const slots = { near: [], far: [] };
    json.nodes.forEach((node) => {
      if (node.mesh == null) return;
      const slot = /far/i.test(node.name || "") ? "far" : "near";
      json.meshes[node.mesh].primitives.forEach((prim) => slots[slot].push(geometry(prim, json, bin)));
    });
    if (!slots.far.length) slots.far = slots.near;
    return slots;
  }

  function clone(type) {
    const src = cache[type];
    if (!src) return null;
    const mat = new api.Mat({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
    const group = new api.Group();
    const add = (geos, shown) => {
      const sub = new api.Group();
      geos.forEach((geo) => {
        const mesh = new api.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        sub.add(mesh);
      });
      sub.visible = shown;
      return sub;
    };
    const near = add(src.near, true);
    const far = add(src.far, false);
    group.add(near, far);
    group.userData.near = near;
    group.userData.far = far;
    group.userData.builtModel = type;
    if (CHIM[type]) group.userData.chim = CHIM[type].slice();
    return group;
  }

  window.VEBuildings = {
    ready: false,
    bytes: 0,
    error: "",
    async boot(next) {
      api = next;
      try {
        for (const type of FILES) {
          const res = await fetch(new URL("buildings/" + type + ".glb", BASE));
          if (!res.ok) throw new Error(type + " " + res.status);
          const buf = await res.arrayBuffer();
          bytes += buf.byteLength;
          const parsed = readGLB(buf);
          cache[type] = load(parsed.json, parsed.bin);
        }
        window.VEBuildings.ready = true;
        window.VEBuildings.bytes = bytes;
      } catch (err) {
        window.VEBuildings.error = String(err && err.message || err);
        console.error("VEBuildings", err);
      }
    },
    has(type) {
      return window.VEBuildings.ready && !!cache[type];
    },
    clone,
  };
})();
