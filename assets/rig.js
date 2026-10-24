// Skinned herd. The game's Three build has the skinning shader but not
// AnimationMixer, so clips are sampled here and written into a bone texture.
(function () {
  const BASE = new URL("./", document.currentScript.src);
  // World units match the farmhand: about 0.55 units for a 1.7 m person.
  // Scales put the imported mesh height on a real body (cattle about 1.4 m).
  const KINDS = {
    cattle: { file: "cattle.glb", scale: 0.1, rough: 0.9, fur: "coat", repeat: 5.5, amt: 0.08 },
    // Height is about 57% of the cattle mesh. Width is scaled up so the
    // Babydoll reads chunky beside a cow instead of as a small dog.
    sheep: { file: "sheep.glb", scale: 0.0605, broad: 1.32, long: 1.08, rough: 0.96, fur: "wool", repeat: 8, amt: 0.4 },
    sheep_shorn: { file: "sheep_shorn.glb", scale: 0.0605, broad: 1.12, long: 1.02, rough: 0.72, fur: "coat", repeat: 7, amt: 0.12 },
    dog: { file: "dog.glb", scale: 0.0543, rough: 0.72, fur: "coat", repeat: 7, amt: 0.16 },
    chicken: { file: "chicken.glb", scale: 0.0102, rough: 0.62, fur: "coat", repeat: 5, amt: 0.1 },
    kangaroo: { file: "kangaroo.glb", scale: 0.469, rough: 0.76, fur: "coat", repeat: 6.5, amt: 0.36 },
    cockatoo: { file: "cockatoo.glb", scale: 0.674, rough: 0.82, fur: "coat", repeat: 3.5, amt: 0.04 },
  };
  const POSE_CLIP = { walk: "Walk", graze: "Graze", idle: "Idle", lie: "Lie", run: "Run", hop: "Hop" };
  const POSE_RATE = { walk: 1, graze: 0.42, idle: 0.32, lie: 0.22, run: 1.45, hop: 1.2 };
  const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

  let api = null;
  let decoder = null;
  const models = {};
  const slots = new Map();
  const tex = { coat: null, wool: null };
  let bytes = 0;

  // Each mesh keeps its own bone texture. A shared atlas was tried: every
  // animal sampled slot 0 because the per-draw offset never reached the shader.
  // DataTexture.flipY is false in this Three build, so texelFetch y=0 is the
  // first row of the array. The skin shader reads that row (y = j / size).
  // Flipping the row here sent every joint to a different bone and stretched
  // the cow, dog, and sheep into thin limb skeletons.
  function packBone(data, size, bone, elements) {
    const j = bone * 4;
    const x = j % size;
    const y = (j / size) | 0;
    const o = (y * size + x) * 4;
    if (elements) data.set(elements, o);
    else data[o] = data[o + 5] = data[o + 10] = data[o + 15] = 1;
  }

  function slerp(ax, ay, az, aw, bx, by, bz, bw, t) {
    let cos = ax * bx + ay * by + az * bz + aw * bw;
    if (cos < 0) {
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
      cos = -cos;
    }
    if (cos > 0.9995) {
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const z = az + (bz - az) * t;
      const w = aw + (bw - aw) * t;
      const l = Math.hypot(x, y, z, w) || 1;
      return [x / l, y / l, z / l, w / l];
    }
    const th = Math.acos(Math.min(1, cos));
    const s = Math.sin(th);
    const w1 = Math.sin((1 - t) * th) / s;
    const w2 = Math.sin(t * th) / s;
    return [ax * w1 + bx * w2, ay * w1 + by * w2, az * w1 + bz * w2, aw * w1 + bw * w2];
  }

  function viewBytes(json, bin, viewIndex) {
    const view = json.bufferViews[viewIndex];
    const ext = view.extensions && view.extensions.EXT_meshopt_compression;
    if (ext) {
      const target = new Uint8Array(ext.count * ext.byteStride);
      decoder.decodeGltfBuffer(
        target,
        ext.count,
        ext.byteStride,
        bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength),
        ext.mode,
        ext.filter || "NONE"
      );
      return { data: target, stride: ext.byteStride };
    }
    const start = view.byteOffset || 0;
    return { data: bin.subarray(start, start + view.byteLength), stride: view.byteStride || 0 };
  }

  function readAccessor(json, views, index) {
    const acc = json.accessors[index];
    const view = views[acc.bufferView];
    const comps = COMPS[acc.type];
    const size = CSIZE[acc.componentType];
    const stride = view.stride || comps * size;
    const start = acc.byteOffset || 0;
    const dv = new DataView(view.data.buffer, view.data.byteOffset, view.data.byteLength);
    const out = new Float32Array(acc.count * comps);
    for (let i = 0; i < acc.count; i++) {
      const o = start + i * stride;
      for (let c = 0; c < comps; c++) {
        const p = o + c * size;
        let v = 0;
        if (acc.componentType === 5126) v = dv.getFloat32(p, true);
        else if (acc.componentType === 5123) v = dv.getUint16(p, true);
        else if (acc.componentType === 5121) v = dv.getUint8(p);
        else if (acc.componentType === 5122) v = dv.getInt16(p, true);
        else if (acc.componentType === 5120) v = dv.getInt8(p);
        else v = dv.getUint32(p, true);
        if (acc.normalized) {
          if (acc.componentType === 5121 || acc.componentType === 5123) v /= acc.componentType === 5121 ? 255 : 65535;
          else if (acc.componentType === 5120) v = Math.max(v / 127, -1);
          else if (acc.componentType === 5122) v = Math.max(v / 32767, -1);
        }
        out[i * comps + c] = v;
      }
    }
    return { array: out, count: acc.count, comps, componentType: acc.componentType, normalized: !!acc.normalized };
  }

  function readIndices(json, views, index) {
    const acc = json.accessors[index];
    const view = views[acc.bufferView];
    const size = CSIZE[acc.componentType];
    const stride = view.stride || size;
    const start = acc.byteOffset || 0;
    const dv = new DataView(view.data.buffer, view.data.byteOffset, view.data.byteLength);
    const out = acc.componentType === 5125 ? new Uint32Array(acc.count) : new Uint16Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
      const p = start + i * stride;
      out[i] = acc.componentType === 5125 ? dv.getUint32(p, true) : acc.componentType === 5123 ? dv.getUint16(p, true) : dv.getUint8(p);
    }
    return out;
  }

  function parseGLB(buffer) {
    const bytesIn = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const jsonLen = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytesIn.subarray(20, 20 + jsonLen)));
    const binOff = 20 + jsonLen;
    const binLen = view.getUint32(binOff, true);
    const bin = bytesIn.subarray(binOff + 8, binOff + 8 + binLen);
    const views = json.bufferViews.map((_, i) => viewBytes(json, bin, i));
    const nodes = json.nodes.map((node) => ({
      name: node.name || "",
      t: node.translation ? node.translation.slice() : [0, 0, 0],
      r: node.rotation ? node.rotation.slice() : [0, 0, 0, 1],
      s: node.scale ? node.scale.slice() : [1, 1, 1],
      children: node.children || [],
      mesh: node.mesh,
      skin: node.skin,
    }));
    const parent = nodes.map(() => -1);
    nodes.forEach((node, i) => node.children.forEach((c) => {
      parent[c] = i;
    }));
    const order = [];
    const visit = (i) => {
      order.push(i);
      nodes[i].children.forEach(visit);
    };
    nodes.forEach((_, i) => {
      if (parent[i] < 0) visit(i);
    });
    const meshNode = nodes.findIndex((node) => node.mesh !== undefined);
    const prim = json.meshes[nodes[meshNode].mesh].primitives[0];
    const pos = readAccessor(json, views, prim.attributes.POSITION);
    const nrm = readAccessor(json, views, prim.attributes.NORMAL);
    const colIn = readAccessor(json, views, prim.attributes.COLOR_0);
    const jointsIn = readAccessor(json, views, prim.attributes.JOINTS_0);
    const weights = readAccessor(json, views, prim.attributes.WEIGHTS_0);
    const indices = readIndices(json, views, prim.indices);
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      col[i * 3] = colIn.array[i * colIn.comps];
      col[i * 3 + 1] = colIn.array[i * colIn.comps + 1];
      col[i * 3 + 2] = colIn.array[i * colIn.comps + 2];
    }
    const joints = new Float32Array(pos.count * 4);
    joints.set(jointsIn.array);
    const skin = json.skins[nodes[meshNode].skin];
    const ibms = readAccessor(json, views, skin.inverseBindMatrices).array;
    const clips = {};
    for (const anim of json.animations || []) {
      let t0 = Infinity;
      let t1 = 0;
      const channels = anim.channels.map((ch) => {
        const sampler = anim.samplers[ch.sampler];
        const times = readAccessor(json, views, sampler.input).array;
        const values = readAccessor(json, views, sampler.output).array;
        t0 = Math.min(t0, times[0]);
        t1 = Math.max(t1, times[times.length - 1]);
        return { node: ch.target.node, path: ch.target.path, times, values, comps: COMPS[json.accessors[sampler.output].type] };
      });
      clips[anim.name] = { channels, span: Math.max(0.05, t1 - t0), t0 };
    }
    let minY = Infinity;
    for (let i = 1; i < pos.array.length; i += 3) minY = Math.min(minY, pos.array[i]);
    return {
      nodes, parent, order, meshNode, clips, minY,
      joints: skin.joints,
      pos: pos.array, nrm: nrm.array, col, jointsAttr: joints, weights: weights.array, indices, ibms,
    };
  }

  function geoFrom(pos, nrm, col, joints, weights, indices) {
    const geo = new api.Geo();
    geo.setAttribute("position", new api.Attr(pos, 3));
    geo.setAttribute("normal", new api.Attr(nrm, 3));
    geo.setAttribute("color", new api.Attr(col, 3));
    geo.setAttribute("skinIndex", new api.Attr(joints, 4));
    geo.setAttribute("skinWeight", new api.Attr(weights, 4));
    geo.setIndex(new api.Attr(indices, 1));
    return geo;
  }

  function paint(col, pos, fn) {
    const out = new Float32Array(col);
    for (let i = 0; i < pos.length; i += 3) fn(out, pos[i], pos[i + 1], pos[i + 2], i);
    return out;
  }

  function variantsFor(kind, parsed) {
    const base = { main: geoFrom(parsed.pos, parsed.nrm, parsed.col, parsed.jointsAttr, parsed.weights, parsed.indices) };
    if (kind === "cattle") {
      let minY = Infinity;
      let maxY = -Infinity;
      const pos = parsed.pos;
      for (let i = 1; i < pos.length; i += 3) {
        minY = Math.min(minY, pos[i]);
        maxY = Math.max(maxY, pos[i]);
      }
      const spanY = maxY - minY || 1;
      for (let s = 0; s < 4; s++) {
        const col = paint(parsed.col, pos, (out, x, y, z, i) => {
          const lum = out[i] * 0.3 + out[i + 1] * 0.59 + out[i + 2] * 0.11;
          const ny = (y - minY) / spanY;
          const h = Math.abs(Math.sin(x * 3.1 + z * 6.4 + s * 2.7) * Math.sin(y * 2.2 + s * 1.3));
          // The default camera looks down on the back, so the topline stays wide and white.
          if (ny > 0.58 && Math.abs(z) < 0.48) {
            out[i] = 0.98;
            out[i + 1] = 0.97;
            out[i + 2] = 0.93;
            return;
          }
          if (lum < 0.55 && ny > 0.2 && ny < 0.62 && Math.abs(z) < 0.62 && h > 0.52) {
            out[i] = 0.97;
            out[i + 1] = 0.96;
            out[i + 2] = 0.92;
            return;
          }
          if (lum < 0.45 && lum > 0.12) {
            out[i] = 0.04;
            out[i + 1] = 0.035;
            out[i + 2] = 0.03;
          }
        });
        base["s" + s] = geoFrom(parsed.pos, parsed.nrm, col, parsed.jointsAttr, parsed.weights, parsed.indices);
      }
    }
    if (kind === "cockatoo") {
      base.main = geoFrom(parsed.pos, parsed.nrm, paint(parsed.col, parsed.pos, (out, x, y, z, i) => {
        const crest = y > 0.36 && x > 0.02 && x < 0.24 && Math.abs(z) < 0.12;
        const eye = Math.hypot(x - 0.22, Math.abs(z) - 0.045, y - 0.35) < 0.016;
        const ring = Math.hypot(x - 0.22, Math.abs(z) - 0.045, y - 0.35) < 0.028;
        if (crest) {
          out[i] = 0.98;
          out[i + 1] = 0.74;
          out[i + 2] = 0.04;
        } else if (eye) {
          out[i] = 0.04;
          out[i + 1] = 0.035;
          out[i + 2] = 0.03;
        } else if (ring) {
          out[i] = 0.9;
          out[i + 1] = 0.88;
          out[i + 2] = 0.8;
        } else if (x > 0.22 && y > 0.22 && y < 0.38 && Math.abs(z) < 0.07) {
          out[i] = 0.32;
          out[i + 1] = 0.3;
          out[i + 2] = 0.28;
        }
      }), parsed.jointsAttr, parsed.weights, parsed.indices);
    }
    if (kind === "sheep" || kind === "sheep_shorn") {
      let minX = Infinity;
      let maxX = -Infinity;
      const pos = parsed.pos;
      for (let i = 0; i < pos.length; i += 3) {
        minX = Math.min(minX, pos[i]);
        maxX = Math.max(maxX, pos[i]);
      }
      const faceAt = minX + (maxX - minX) * 0.72;
      const col = paint(parsed.col, pos, (out, x, _y, _z, i) => {
        const m = x > faceAt ? 0.62 : 0.2;
        out[i] *= m;
        out[i + 1] *= m;
        out[i + 2] *= m;
      });
      base.black = geoFrom(parsed.pos, parsed.nrm, col, parsed.jointsAttr, parsed.weights, parsed.indices);
    }
    return base;
  }

  function furMaterial(kind) {
    const spec = KINDS[kind];
    const mat = new api.Mat({
      vertexColors: true,
      roughness: spec.rough,
      metalness: 0,
      envMapIntensity: 0.42,
    });
    const cattle = kind === "cattle";
    mat.emissive = new api.Color(cattle ? 0 : 0.012, cattle ? 0 : 0.01, cattle ? 0 : 0.008);
    mat.envMapIntensity = cattle ? 0.01 : kind === "sheep" ? 0.22 : kind === "cockatoo" ? 0.05 : 0.42;
    mat.color = new api.Color(1, 0.985, 0.96);
    if (kind === "sheep") mat.color.setRGB(1, 0.985, 0.95);
    if (kind === "sheep_shorn") mat.color.setRGB(1, 0.96, 0.9);
    const map = spec.fur === "wool" ? tex.wool : tex.coat;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.tFur = { value: map };
      shader.uniforms.uFurScale = { value: spec.repeat };
      shader.uniforms.uFurAmt = { value: spec.amt };
      shader.vertexShader = "varying vec3 vFurP;varying vec3 vFurN;\n" + shader.vertexShader.replace(
        "#include <project_vertex>",
        "vFurP=transformed;vFurN=objectNormal;\n#include <project_vertex>"
      );
      shader.fragmentShader = "uniform sampler2D tFur;uniform float uFurScale;uniform float uFurAmt;varying vec3 vFurP;varying vec3 vFurN;\n" + shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
{
  vec3 bn = abs(normalize(vFurN));
  vec3 n = normalize(vFurN);
  vec2 uv = bn.y >= bn.x && bn.y >= bn.z ? vFurP.xz : (bn.x >= bn.z ? vFurP.zy : vFurP.xy);
  vec3 tn = texture2D(tFur, uv * uFurScale).xyz * 2.0 - 1.0;
  vec3 N = normalize(normal);
  vec3 T = normalize(cross(N, vec3(0.0, 1.0, 0.0)));
  if (dot(T, T) < 1e-4) T = normalize(cross(N, vec3(1.0, 0.0, 0.0)));
  vec3 B = normalize(cross(N, T));
  normal = normalize(T * tn.x * uFurAmt + B * tn.y * uFurAmt + N * tn.z);
}`
      );
    };
    mat.customProgramCacheKey = () => "ve-fur-" + kind;
    return mat;
  }

  function prepare(kind, parsed) {
    const n = parsed.nodes.length;
    const model = {
      kind,
      scale: KINDS[kind].scale,
      minY: parsed.minY,
      clips: parsed.clips,
      joints: parsed.joints,
      parent: parsed.parent,
      order: parsed.order,
      nodes: parsed.nodes,
      geos: variantsFor(kind, parsed),
      mat: furMaterial(kind),
      restT: new Float32Array(n * 3),
      restR: new Float32Array(n * 4),
      restS: new Float32Array(n * 3),
      worlds: parsed.nodes.map(() => new api.Mat4()),
      ibms: parsed.joints.map((_, i) => new api.Mat4().fromArray(parsed.ibms, i * 16)),
      invMesh: new api.Mat4(),
      local: new api.Mat4(),
      bone: new api.Mat4(),
      v: new api.Vec3(),
      q: new api.Quat(),
      sv: new api.Vec3(),
    };
    parsed.nodes.forEach((node, i) => {
      model.restT.set(node.t, i * 3);
      model.restR.set(node.r, i * 4);
      model.restS.set(node.s, i * 3);
    });
    const ident = new api.Mat4();
    model.worlds.forEach((m) => m.copy(ident));
    composeRest(model);
    model.invMesh.copy(model.worlds[parsed.meshNode]).invert();
    return model;
  }

  function composeRest(model) {
    const T = model.restT;
    const R = model.restR;
    const S = model.restS;
    for (const i of model.order) {
      model.v.set(T[i * 3], T[i * 3 + 1], T[i * 3 + 2]);
      model.q.set(R[i * 4], R[i * 4 + 1], R[i * 4 + 2], R[i * 4 + 3]);
      model.sv.set(S[i * 3], S[i * 3 + 1], S[i * 3 + 2]);
      model.local.compose(model.v, model.q, model.sv);
      const p = model.parent[i];
      if (p < 0) model.worlds[i].copy(model.local);
      else model.worlds[i].multiplyMatrices(model.worlds[p], model.local);
    }
  }

  function sampleClip(model, clip, time, T, R, S) {
    T.set(model.restT);
    R.set(model.restR);
    S.set(model.restS);
    if (!clip) return;
    const span = clip.span;
    const tt = clip.t0 + (((time % span) + span) % span);
    for (const ch of clip.channels) {
      const times = ch.times;
      let lo = 0;
      let hi = times.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= tt) lo = mid;
        else hi = mid;
      }
      const j = Math.min(lo + 1, times.length - 1);
      const denom = times[j] - times[lo] || 1;
      const f = j === lo ? 0 : (tt - times[lo]) / denom;
      const a = lo * ch.comps;
      const b = j * ch.comps;
      if (ch.path === "rotation") {
        const q = slerp(ch.values[a], ch.values[a + 1], ch.values[a + 2], ch.values[a + 3], ch.values[b], ch.values[b + 1], ch.values[b + 2], ch.values[b + 3], f);
        R.set(q, ch.node * 4);
      } else if (ch.path === "translation") {
        const o = ch.node * 3;
        T[o] = ch.values[a] * (1 - f) + ch.values[b] * f;
        T[o + 1] = ch.values[a + 1] * (1 - f) + ch.values[b + 1] * f;
        T[o + 2] = ch.values[a + 2] * (1 - f) + ch.values[b + 2] * f;
      } else {
        const o = ch.node * 3;
        S[o] = ch.values[a] * (1 - f) + ch.values[b] * f;
        S[o + 1] = ch.values[a + 1] * (1 - f) + ch.values[b + 1] * f;
        S[o + 2] = ch.values[a + 2] * (1 - f) + ch.values[b + 2] * f;
      }
    }
  }

  function blendLocals(model, pose, from, blend, time, rate, fromRate, offset, buf) {
    const clip = model.clips[POSE_CLIP[pose]] || model.clips.Idle || model.clips.Walk;
    const fromClip = model.clips[POSE_CLIP[from]] || clip;
    sampleClip(model, clip, time * rate + offset, buf.T, buf.R, buf.S);
    if (blend >= 0.999) return;
    sampleClip(model, fromClip, time * fromRate + offset, buf.T2, buf.R2, buf.S2);
    const n = model.nodes.length;
    const k = blend;
    for (let i = 0; i < n; i++) {
      buf.T[i * 3] = buf.T2[i * 3] * (1 - k) + buf.T[i * 3] * k;
      buf.T[i * 3 + 1] = buf.T2[i * 3 + 1] * (1 - k) + buf.T[i * 3 + 1] * k;
      buf.T[i * 3 + 2] = buf.T2[i * 3 + 2] * (1 - k) + buf.T[i * 3 + 2] * k;
      buf.S[i * 3] = buf.S2[i * 3] * (1 - k) + buf.S[i * 3] * k;
      buf.S[i * 3 + 1] = buf.S2[i * 3 + 1] * (1 - k) + buf.S[i * 3 + 1] * k;
      buf.S[i * 3 + 2] = buf.S2[i * 3 + 2] * (1 - k) + buf.S[i * 3 + 2] * k;
      const q = slerp(
        buf.R2[i * 4], buf.R2[i * 4 + 1], buf.R2[i * 4 + 2], buf.R2[i * 4 + 3],
        buf.R[i * 4], buf.R[i * 4 + 1], buf.R[i * 4 + 2], buf.R[i * 4 + 3],
        k
      );
      buf.R.set(q, i * 4);
    }
  }

  function writeBones(mesh) {
    const model = mesh.userData.model;
    const anim = mesh.userData.anim;
    const buf = mesh.userData.buf;
    blendLocals(model, anim.pose, anim.from, anim.blend, performance.now() / 1000, anim.rate, anim.fromRate, anim.offset, buf);
    for (const i of model.order) {
      model.v.set(buf.T[i * 3], buf.T[i * 3 + 1], buf.T[i * 3 + 2]);
      model.q.set(buf.R[i * 4], buf.R[i * 4 + 1], buf.R[i * 4 + 2], buf.R[i * 4 + 3]);
      model.sv.set(buf.S[i * 3], buf.S[i * 3 + 1], buf.S[i * 3 + 2]);
      model.local.compose(model.v, model.q, model.sv);
      const p = model.parent[i];
      if (p < 0) model.worlds[i].copy(model.local);
      else model.worlds[i].multiplyMatrices(model.worlds[p], model.local);
    }
    const tex = mesh.skeleton.boneTexture;
    const data = tex.image.data;
    const size = tex.image.width;
    model.joints.forEach((node, i) => {
      model.bone.multiplyMatrices(model.worlds[node], model.ibms[i]);
      model.bone.premultiply(model.invMesh);
      packBone(data, size, i, model.bone.elements);
    });
    tex.needsUpdate = true;
  }

  function makeSlot(kind, variant) {
    const model = models[kind];
    const geo = model.geos[variant] || model.geos.main;
    const mesh = new api.Mesh(geo, model.mat);
    mesh.isSkinnedMesh = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.bindMatrix = new api.Mat4();
    mesh.bindMatrixInverse = new api.Mat4();
    const bones = model.joints.length;
    const size = Math.max(4, Math.ceil(Math.sqrt(bones * 4) / 4) * 4);
    const data = new Float32Array(size * size * 4);
    for (let i = 0; i < bones; i++) packBone(data, size, i, null);
    const boneTexture = new api.DataTex(data, size, size, api.RGBA, api.FloatType);
    boneTexture.flipY = false;
    boneTexture.magFilter = boneTexture.minFilter = api.Nearest;
    boneTexture.wrapS = boneTexture.wrapT = api.Clamp;
    boneTexture.colorSpace = api.noCS;
    boneTexture.generateMipmaps = false;
    boneTexture.needsUpdate = true;
    const n = model.nodes.length;
    mesh.userData.model = model;
    mesh.userData.anim = { pose: "idle", from: "idle", blend: 1, rate: 0.3, fromRate: 0.3, offset: 0, last: 0 };
    mesh.userData.buf = {
      T: new Float32Array(n * 3), R: new Float32Array(n * 4), S: new Float32Array(n * 3),
      T2: new Float32Array(n * 3), R2: new Float32Array(n * 4), S2: new Float32Array(n * 3),
    };
    mesh.skeleton = {
      boneTexture,
      computeBoneTexture() {},
      update() {},
    };
    const group = new api.Group();
    group.add(mesh);
    const broad = model.kind === "sheep" || model.kind === "sheep_shorn" ? KINDS[kind].broad : 1;
    const long = model.kind === "sheep" || model.kind === "sheep_shorn" ? KINDS[kind].long : 1;
    group.scale.set(model.scale * long, model.scale, model.scale * broad);
    group.userData.role = kind === "sheep_shorn" ? "sheep" : kind;
    return { group, mesh, kind, variant, model };
  }

  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function imageTexture(img) {
    const map = new api.Tex(img);
    map.wrapS = map.wrapT = api.Repeat;
    map.colorSpace = api.noCS;
    map.needsUpdate = true;
    return map;
  }

  async function boot(next) {
    api = next;
    try {
      const mod = await import(new URL("animals/meshopt_decoder.js", BASE));
      decoder = mod.MeshoptDecoder;
      await decoder.ready;
      const coatUrl = new URL("animals/coat.webp", BASE).href;
      const woolUrl = new URL("animals/wool.webp", BASE).href;
      const [coatImg, woolImg] = await Promise.all([loadImage(coatUrl), loadImage(woolUrl)]);
      if (!coatImg || !woolImg) throw new Error("fur texture missing");
      tex.coat = imageTexture(coatImg);
      tex.wool = imageTexture(woolImg);
      await Promise.all(Object.keys(KINDS).map(async (kind) => {
        const res = await fetch(new URL("animals/" + KINDS[kind].file, BASE));
        const buf = await res.arrayBuffer();
        bytes += buf.byteLength;
        models[kind] = prepare(kind, parseGLB(buf));
      }));
      window.VERig.ready = true;
      window.VERig.bytes = bytes;
    } catch (err) {
      window.VERig.error = String(err && err.message || err);
      console.error("VERig", err);
    }
  }

  window.VERig = {
    ready: false,
    bytes: 0,
    error: "",
    boot,
    place(parent, key, species, x, y, z, yaw, pose, opts) {
      if (!window.VERig.ready || !models[species]) return;
      const opt = opts || {};
      const seed = opt.seed | 0;
      const variant = species === "cattle" ? "s" + (Math.abs(seed) % 4) : opt.black ? "black" : "main";
      let slot = slots.get(key);
      if (!slot || slot.kind !== species || slot.variant !== variant) {
        if (slot && slot.group.parent) slot.group.parent.remove(slot.group);
        slot = makeSlot(species, variant);
        slot.mesh.userData.anim.offset = Math.abs(seed) * 0.73 + 0.2;
        slots.set(key, slot);
      }
      if (slot.group.parent !== parent) parent.add(slot.group);
      const anim = slot.mesh.userData.anim;
      const now = performance.now() / 1000;
      const dt = anim.last ? Math.min(0.05, now - anim.last) : 0.016;
      anim.last = now;
      const nextPose = POSE_CLIP[pose] ? pose : "idle";
      if (anim.pose !== nextPose) {
        anim.from = anim.pose;
        anim.fromRate = anim.rate;
        anim.pose = nextPose;
        anim.blend = 0;
      }
      anim.rate = opt.rate || POSE_RATE[nextPose] || 1;
      anim.blend = Math.min(1, anim.blend + dt / 0.38);
      writeBones(slot.mesh);
      slot.group.visible = true;
      slot.group.position.set(x, y - slot.model.minY * slot.model.scale, z);
      slot.group.rotation.y = yaw;
      slot.mesh.castShadow = false;
    },
    hide(key) {
      const slot = slots.get(key);
      if (!slot) return;
      slot.group.visible = false;
    },
  };
})();
