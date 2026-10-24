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
  // and Woodland Grey. The photo map is fine grain; the shader draws the ribs.
  const IRON_LOOK = {
    homestead: { roof: [0.78, 0.8, 0.76], mix: 0.55, rust: 0.42 },
    valleyvilla: { roof: [0.5, 0.54, 0.44], mix: 0.72, rust: 0.34 },
    winery: { roof: [0.3, 0.31, 0.27], mix: 0.74, rust: 0.4 },
    cellardoor: { roof: [0.5, 0.16, 0.13], mix: 0.7, rust: 0.72 },
    shed: { roof: [0.5, 0.16, 0.13], mix: 0.68, wall: [0.78, 0.8, 0.76], wallMix: 0.5, rust: 0.82 },
    machine: { roof: [0.3, 0.31, 0.27], mix: 0.72, wall: [0.5, 0.54, 0.44], wallMix: 0.66, rust: 0.55 },
    yard: { roof: [0.5, 0.16, 0.13], mix: 0.7, rust: 0.7 },
  };
  // Blender sizes (width, depth, wall height, verandah depth). Verandah faces +Z.
  const DRESS = {
    homestead: { w: 1.9, d: 1.55, h: 0.95, vd: 0.7, tank: [1.25, -0.55], tankR: 0.3, tankH: 0.86 },
    winery: { w: 2.15, d: 1.35, h: 1.0, vd: 0.62, tank: [1.42, 0.35], tankR: 0.26, tankH: 0.72 },
    cellardoor: { w: 2.05, d: 1.15, h: 0.85, vd: 0.7, tank: [1.32, -0.15], tankR: 0.24, tankH: 0.66 },
    valleyvilla: { w: 3.05, d: 1.7, h: 1.15, vd: 0.85, tank: [1.82, 0.45], tankR: 0.3, tankH: 0.8 },
    shed: { w: 1.4, d: 1.05, h: 0.75, vd: 0.45, tank: [0.98, -0.02], tankR: 0.24, tankH: 0.68 },
    machine: { w: 1.5, d: 1.1, h: 0.82, vd: 0.4, tank: [1.02, 0.08], tankR: 0.26, tankH: 0.72 },
    yard: { w: 1.15, d: 0.7, h: 0.7, vd: 0.35, tank: [0.95, 0.15], tankR: 0.2, tankH: 0.58, origin: [-0.55, 0.35] },
  };
  const GUTTER = [0.16, 0.17, 0.18];
  const FASCIA = [0.22, 0.24, 0.25];
  const TIMBER = [0.45, 0.28, 0.16];
  const IRON_GREY = [0.62, 0.66, 0.68];
  const BRICK = [0.48, 0.22, 0.14];

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
      shader.uniforms.tIronN = { value: iron.normalMap || iron.map };
      shader.uniforms.tRust = { value: iron.rust || iron.map };
      shader.uniforms.uRoof = { value: roof };
      shader.uniforms.uWall = { value: wall };
      shader.uniforms.uRoofMix = { value: look.mix };
      shader.uniforms.uWallMix = { value: look.wallMix == null ? 0.4 : look.wallMix };
      shader.uniforms.uWallOn = { value: look.wall ? 1 : 0 };
      shader.uniforms.uRust = { value: look.rust == null ? 0.4 : look.rust };
      shader.vertexShader = "varying vec3 vBldP;varying vec3 vBldN;\n" + shader.vertexShader.replace(
        "#include <project_vertex>",
        "vBldP=transformed;vBldN=objectNormal;\n#include <project_vertex>"
      );
      const head = `uniform sampler2D tIron;uniform sampler2D tIronN;uniform sampler2D tRust;uniform vec3 uRoof;uniform vec3 uWall;uniform float uRoofMix;uniform float uWallMix;uniform float uWallOn;uniform float uRust;varying vec3 vBldP;varying vec3 vBldN;
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
  return uv*3.1;
}
float veHash(float n){return fract(sin(n)*43758.5453);}
vec3 veIronAxes(vec3 p,vec3 n){
  float vertical=1.0-smoothstep(0.28,0.62,abs(n.y));
  float across;float down;
  if(vertical>0.5){across=p.y;down=n.x*p.x+n.z*p.z;}
  else if(abs(n.z)>abs(n.x)){across=p.x;down=p.z;}
  else{across=p.z;down=p.x;}
  return vec3(across,down,vertical);
}
`;
      shader.fragmentShader = head + shader.fragmentShader
        .replace("#include <color_fragment>", `#include <color_fragment>
{
  float mask=veIronMask(vColor);
  if(mask>0.5){
    vec3 n=normalize(vBldN);
    vec3 ax=veIronAxes(vBldP,n);
    float across=ax.x;float down=ax.y;float vertical=ax.z;
    float freq=mix(68.0,52.0,vertical);
    float phase=across*freq;
    float s=sin(phase);
    float peak=smoothstep(-0.15,1.0,s);
    float valley=smoothstep(-0.1,1.0,-s);
    float hi=smoothstep(0.72,0.995,s);
    float sh=smoothstep(0.55,0.995,-s);
    float rib=0.42+peak*0.78-valley*0.34+hi*0.55-sh*0.48;
    vec2 uv=veIronUv(vBldP,n);
    vec3 sampleIron=texture2D(tIron,uv).rgb;
    vec3 sampleRust=texture2D(tRust,uv*0.8).rgb;
    float luma=dot(sampleIron,vec3(0.30,0.59,0.11));
    float roof=veIronRoof(vColor);
    vec3 tint=roof>0.5?uRoof:uWall;
    float amt=roof>0.5?uRoofMix:uWallMix;
    vec3 grain=mix(sampleIron,tint,amt)*(0.82+(sampleIron-vec3(luma))*1.15);
    vec3 painted=grain*rib*(0.93+0.07*sin(across*6.5+down));
    float lane=floor(across*8.0);
    float drip=smoothstep(0.62,0.9,veHash(lane*12.1+3.7));
    float run=smoothstep(0.15,0.9,fract(down*1.35+veHash(lane*4.4)));
    float blot=smoothstep(0.8,0.96,veHash(floor(across*2.4)*9.2+floor(down*2.2)*4.7));
    float rustAmt=clamp((drip*run*0.9+blot*0.45)*uRust,0.0,0.82);
    vec3 rustCol=mix(vec3(0.42,0.16,0.07),sampleRust,0.7);
    painted=mix(painted,rustCol*(0.5+0.5*rib),rustAmt);
    diffuseColor.rgb=painted;
  }
}`)
        .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
metalnessFactor=mix(metalnessFactor,0.46,veIronMask(vColor));`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,0.48,veIronMask(vColor));`)
        .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
{
  float mask=veIronMask(vColor);
  if(mask>0.5){
    vec3 bn=normalize(vBldN);
    vec3 ax=veIronAxes(vBldP,bn);
    float across=ax.x;float vertical=ax.z;
    float phase=across*mix(68.0,52.0,vertical);
    float slope=cos(phase);
    vec3 axis=vertical>0.5?vec3(0.0,1.0,0.0):(abs(bn.z)>abs(bn.x)?vec3(1.0,0.0,0.0):vec3(0.0,0.0,1.0));
    vec3 side=axis-bn*dot(axis,bn);
    float sl=dot(side,side);
    if(sl>1e-4)normal=normalize(normal+side*(slope*2.6/sqrt(sl)));
    vec3 tn=texture2D(tIronN,veIronUv(vBldP,bn)).xyz*2.0-1.0;
    vec3 B=normalize(cross(normal,sl>1e-4?normalize(side):vec3(0.0,1.0,0.0)));
    normal=normalize((sl>1e-4?normalize(side):vec3(1.0,0.0,0.0))*tn.x*0.7+B*tn.y*0.7+normal*tn.z);
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

  function painted(positions, rgb) {
    const geo = new api.Geo();
    geo.setAttribute("position", new api.Attr(new Float32Array(positions), 3));
    const col = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      col[i] = rgb[0];
      col[i + 1] = rgb[1];
      col[i + 2] = rgb[2];
    }
    geo.setAttribute("color", new api.Attr(col, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function boxPositions(sx, sy, sz) {
    const x = sx / 2;
    const y = sy / 2;
    const z = sz / 2;
    const f = (a, b, c, d) => a.concat(b, c, a, c, d);
    const p = [];
    const v = (px, py, pz) => [px, py, pz];
    const corners = [
      v(-x, -y, -z), v(x, -y, -z), v(x, y, -z), v(-x, y, -z),
      v(-x, -y, z), v(x, -y, z), v(x, y, z), v(-x, y, z),
    ];
    const quads = [[0, 1, 2, 3], [5, 4, 7, 6], [3, 2, 6, 7], [4, 5, 1, 0], [1, 5, 6, 2], [4, 0, 3, 7]];
    quads.forEach((q) => {
      f(corners[q[0]], corners[q[1]], corners[q[2]], corners[q[3]]).forEach((n) => p.push(n));
    });
    return p;
  }

  function cylPositions(radius, height, seg) {
    const p = [];
    const y0 = -height / 2;
    const y1 = height / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const x0 = Math.cos(a0) * radius;
      const z0 = Math.sin(a0) * radius;
      const x1 = Math.cos(a1) * radius;
      const z1 = Math.sin(a1) * radius;
      p.push(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y1, z0);
      p.push(0, y1, 0, x0, y1, z0, x1, y1, z1);
      p.push(0, y0, 0, x1, y0, z1, x0, y0, z0);
    }
    return p;
  }

  function conePositions(radius, height, seg) {
    const p = [];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const x0 = Math.cos(a0) * radius;
      const z0 = Math.sin(a0) * radius;
      const x1 = Math.cos(a1) * radius;
      const z1 = Math.sin(a1) * radius;
      p.push(x0, 0, z0, x1, 0, z1, 0, height, 0);
      p.push(0, 0, 0, x1, 0, z1, x0, 0, z0);
    }
    return p;
  }

  function addPart(group, mat, positions, x, y, z, rgb) {
    const mesh = new api.Mesh(painted(positions, rgb), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  function dress(group, mat, type) {
    const body = DRESS[type];
    if (!body) return;
    const ox = body.origin ? body.origin[0] : 0;
    const oz = body.origin ? body.origin[1] : 0;
    const halfZ = (body.d + 0.35) / 2;
    const eaveY = body.h * 0.92;
    const roofW = body.w + 0.45;
    const frontZ = oz + body.d / 2 + body.vd;
    const frontY = body.h * 0.78;
    const verW = body.w + 0.7;
    addPart(group, mat, boxPositions(roofW + 0.08, 0.09, 0.07), ox, eaveY - 0.02, oz - halfZ, FASCIA);
    addPart(group, mat, boxPositions(roofW + 0.04, 0.06, 0.08), ox, eaveY - 0.09, oz - halfZ - 0.03, GUTTER);
    addPart(group, mat, boxPositions(verW, 0.08, 0.065), ox, frontY - 0.01, frontZ, FASCIA);
    addPart(group, mat, boxPositions(verW + 0.06, 0.055, 0.08), ox, frontY - 0.08, frontZ + 0.04, GUTTER);
    addPart(group, mat, boxPositions(body.w * 0.86, 0.05, 0.05), ox, body.h * 0.5, frontZ - 0.12, TIMBER);
    const pipeH = Math.max(0.35, frontY - 0.1);
    addPart(group, mat, cylPositions(0.032, pipeH, 8), ox + verW * 0.42, pipeH / 2, frontZ + 0.04, GUTTER);
    addPart(group, mat, cylPositions(0.032, pipeH, 8), ox - verW * 0.42, pipeH / 2, frontZ + 0.04, GUTTER);
    const postH = body.h * 0.9;
    const postZ = oz + body.d / 2 + body.vd - 0.16;
    [-body.w / 2 + 0.08, -body.w / 6, body.w / 6, body.w / 2 - 0.08].forEach((x) => {
      addPart(group, mat, cylPositions(0.05, postH, 6), ox + x, postH / 2, postZ, TIMBER);
    });
    const tx = ox + body.tank[0];
    const tz = oz + body.tank[1];
    addPart(group, mat, cylPositions(body.tankR * 1.08, 0.06, 20), tx, 0.04, tz, [0.34, 0.33, 0.3]);
    addPart(group, mat, cylPositions(body.tankR, body.tankH, 28), tx, body.tankH / 2 + 0.05, tz, IRON_GREY);
    addPart(group, mat, conePositions(body.tankR * 1.05, body.tankR * 0.42, 24), tx, body.tankH + 0.05, tz, IRON_GREY);
    addPart(group, mat, boxPositions(0.07, 0.05, 0.1), tx, body.tankH * 0.32, tz + body.tankR + 0.04, [0.14, 0.15, 0.16]);
    const chim = CHIM[type];
    if (chim) addPart(group, mat, boxPositions(0.36, 0.08, 0.36), chim[0], chim[1] - 0.04, chim[2], BRICK);
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
    dress(group, mat, type);
    return group;
  }

  window.VEBuildings = {
    ready: false,
    bytes: 0,
    error: "",
    async boot(next) {
      api = next;
      const mark = (type) => {
        if (window.VELoad) VELoad.settle("glb:" + type);
      };
      for (const type of FILES) if (window.VELoad) VELoad.track("glb:" + type);
      try {
        for (const type of FILES) {
          try {
            const res = await fetch(new URL("buildings/" + type + ".glb", BASE));
            if (!res.ok) throw new Error(type + " " + res.status);
            const buf = await res.arrayBuffer();
            bytes += buf.byteLength;
            const parsed = readGLB(buf);
            cache[type] = load(parsed.json, parsed.bin);
          } finally {
            mark(type);
          }
        }
        window.VEBuildings.ready = true;
        window.VEBuildings.bytes = bytes;
      } catch (err) {
        for (const type of FILES) mark(type);
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
