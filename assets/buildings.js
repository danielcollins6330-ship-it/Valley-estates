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

  // Vertex colours in the meshes are masks. Grey iron and red iron are roofs
  // (including verandahs). Cream boards on a shed become corrugated walls.
  // Tints are galvanised zinc plus Colorbond-style Pale Eucalypt, Manor Red
  // and Woodland Grey. The Poly Haven corrugated_iron map supplies the grain.
  const IRON_LOOK = {
    homestead: { roof: [0.8, 0.82, 0.8], mix: 0.22 },
    valleyvilla: { roof: [0.5, 0.54, 0.44], mix: 0.78 },
    winery: { roof: [0.3, 0.31, 0.27], mix: 0.84 },
    cellardoor: { roof: [0.5, 0.16, 0.13], mix: 0.8 },
    shed: { roof: [0.5, 0.16, 0.13], mix: 0.8, wall: [0.78, 0.8, 0.78], wallMix: 0.28 },
    machine: { roof: [0.3, 0.31, 0.27], mix: 0.84, wall: [0.5, 0.54, 0.44], wallMix: 0.76 },
    yard: { roof: [0.5, 0.16, 0.13], mix: 0.8 },
  };

  function ironMaterial(type) {
    const look = IRON_LOOK[type] || IRON_LOOK.homestead;
    const Color = api.Color;
    const mat = new api.Mat({ vertexColors: true, roughness: 0.84, metalness: 0.04 });
    const iron = window.VEIron;
    if (!iron || !iron.map || !Color) return mat;
    const roof = new Color(look.roof[0], look.roof[1], look.roof[2]);
    const wall = new Color(look.wall ? look.wall[0] : 0, look.wall ? look.wall[1] : 0, look.wall ? look.wall[2] : 0);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.tIron = { value: iron.map };
      shader.uniforms.tIronN = { value: iron.normalMap };
      shader.uniforms.uRoof = { value: roof };
      shader.uniforms.uWall = { value: wall };
      shader.uniforms.uRoofMix = { value: look.mix };
      shader.uniforms.uWallMix = { value: look.wallMix == null ? 0.4 : look.wallMix };
      shader.uniforms.uWallOn = { value: look.wall ? 1 : 0 };
      shader.vertexShader = "varying vec3 vBldP;varying vec3 vBldN;\n" + shader.vertexShader.replace(
        "#include <project_vertex>",
        "vBldP=transformed;vBldN=objectNormal;\n#include <project_vertex>"
      );
      const head = `uniform sampler2D tIron;uniform sampler2D tIronN;uniform vec3 uRoof;uniform vec3 uWall;uniform float uRoofMix;uniform float uWallMix;uniform float uWallOn;varying vec3 vBldP;varying vec3 vBldN;
float veIronRoof(vec3 c){
  float mx=max(c.r,max(c.g,c.b));
  float mn=min(c.r,min(c.g,c.b));
  float sat=mx-mn;
  float grey=step(0.50,c.r)*step(c.r,0.80)*step(sat,0.14)*step(c.g,c.r+0.12)*step(c.b,c.r+0.14)*step(c.r-0.02,c.b);
  float red=step(0.45,c.r)*step(c.g,0.23)*step(c.b,0.20)*step(0.22,c.r-c.g);
  return clamp(grey+red,0.0,1.0);
}
float veIronWall(vec3 c){
  float mx=max(c.r,max(c.g,c.b));
  float mn=min(c.r,min(c.g,c.b));
  float sat=mx-mn;
  return uWallOn*step(0.12,sat)*step(0.64,c.r)*step(c.r,0.92)*step(0.50,c.g)*step(c.b+0.04,c.r)*(1.0-veIronRoof(c));
}
float veIronMask(vec3 c){return clamp(veIronRoof(c)+veIronWall(c),0.0,1.0);}
vec2 veIronUv(vec3 p,vec3 n){
  vec3 bn=abs(normalize(n));
  vec2 uv=bn.y>=bn.x&&bn.y>=bn.z?p.xz:(bn.x>=bn.z?p.zy:p.xy);
  return uv*1.35;
}
`;
      shader.fragmentShader = head + shader.fragmentShader
        .replace("#include <color_fragment>", `#include <color_fragment>
{
  float mask=veIronMask(vColor);
  if(mask>0.5){
    vec3 n=normalize(vBldN);
    float along=abs(n.y)>0.55?vBldP.x:(abs(n.x)>abs(n.z)?vBldP.z:vBldP.x);
    float rib=0.62+0.46*sin(along*34.0);
    vec3 sampleIron=texture2D(tIron,veIronUv(vBldP,n)).rgb;
    float roof=veIronRoof(vColor);
    vec3 tint=roof>0.5?uRoof:uWall;
    float amt=roof>0.5?uRoofMix:uWallMix;
    diffuseColor.rgb=mix(sampleIron,tint,amt)*rib;
  }
}`)
        .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
metalnessFactor=mix(metalnessFactor,0.62,veIronMask(vColor));`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,0.4,veIronMask(vColor));`)
        .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
{
  float mask=veIronMask(vColor);
  if(mask>0.5){
    vec3 bn=normalize(vBldN);
    float along=abs(bn.y)>0.55?vBldP.x:(abs(bn.x)>abs(bn.z)?vBldP.z:vBldP.x);
    float slope=cos(along*34.0);
    vec3 side=normalize(cross(normal,abs(bn.y)>0.55?vec3(0.0,0.0,1.0):vec3(0.0,1.0,0.0)));
    normal=normalize(normal+side*slope*1.35);
    vec3 tn=texture2D(tIronN,veIronUv(vBldP,bn)).xyz*2.0-1.0;
    vec3 B=normalize(cross(normal,side));
    normal=normalize(side*tn.x*0.45+B*tn.y*0.45+normal*tn.z);
  }
}`);
    };
    mat.customProgramCacheKey = () => "ve-iron-" + type;
    return mat;
  }

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
    const mat = ironMaterial(type);
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
