// Meshopt-compress the animal GLBs without quantizing, so skinning stays exact.
// Build dependency, not shipped: npm install meshoptimizer@1.3.0
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const SRC = "/workspace/assets/animals/src";
const OUT = "/workspace/assets/animals";
const NAMES = ["cattle", "sheep", "sheep_shorn", "dog", "chicken", "kangaroo", "cockatoo"];
const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

function readGLB(path) {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString());
  const binOff = 20 + jsonLen;
  const binLen = b.readUInt32LE(binOff);
  return { json, bin: b.slice(binOff + 8, binOff + 8 + binLen) };
}

function writeGLB(path, json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jPad = (4 - (jsonLenSafe(jsonBuf.length))) % 4;
  const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jPad, 0x20)]);
  const bPad = (4 - (bin.length % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(bPad)]);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonChunk.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(out, 20);
  const o = 20 + jsonChunk.length;
  out.writeUInt32LE(binChunk.length, o);
  out.writeUInt32LE(0x004e4942, o + 4);
  binChunk.copy(out, o + 8);
  writeFileSync(path, out);
}

function jsonLenSafe(n) {
  return n % 4;
}

function trianglesMatch(decoded, original) {
  if (decoded.length !== original.length || decoded.length % 6 !== 0) return false;
  const a = new Uint16Array(decoded.buffer, decoded.byteOffset, decoded.length / 2);
  const b = new Uint16Array(original.buffer, original.byteOffset, original.length / 2);
  for (let i = 0; i < a.length; i += 3) {
    const tri = [b[i], b[i + 1], b[i + 2]];
    const got = [a[i], a[i + 1], a[i + 2]];
    const ok = [0, 1, 2].some((shift) => got.every((v, k) => v === tri[(k + shift) % 3]));
    if (!ok) return false;
  }
  return true;
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

let before = 0;
let after = 0;
for (const name of NAMES) {
  const srcPath = `${SRC}/${name}.glb`;
  const { json, bin } = readGLB(srcPath);
  const original = json.bufferViews.map((view) => {
    const start = view.byteOffset || 0;
    return Buffer.from(bin.subarray(start, start + view.byteLength));
  });
  const indexAcc = new Set();
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives) if (prim.indices != null) indexAcc.add(prim.indices);
  }
  const pieces = [];
  let cursor = 0;
  for (let vi = 0; vi < json.bufferViews.length; vi++) {
    const view = json.bufferViews[vi];
    const accs = (json.accessors || []).filter((acc) => acc.bufferView === vi);
    const raw = original[vi];
    if (!accs.length || raw.length === 0) continue;
    const acc = accs[0];
    const tight = COMPS[acc.type] * CSIZE[acc.componentType];
    const stride = view.byteStride || tight;
    const count = Math.floor(raw.length / stride);
    const packed = raw.subarray(0, count * stride);
    const accIndex = json.accessors.indexOf(acc);
    const isIndex = indexAcc.has(accIndex);
    let encoded = null;
    let mode = "ATTRIBUTES";
    if (packed.length !== raw.length) throw new Error(name + " view " + vi + " is not tightly packed");
    if (isIndex && (stride === 2 || stride === 4) && count % 3 === 0) {
      mode = "TRIANGLES";
      encoded = MeshoptEncoder.encodeGltfBuffer(packed, count, stride, mode);
    } else if (stride % 4 === 0 && stride > 0 && stride <= 256 && count > 0) {
      encoded = MeshoptEncoder.encodeGltfBuffer(packed, count, stride, mode);
    }
    if (encoded && encoded.length + 16 < raw.length) {
      view.buffer = 1;
      view.byteOffset = view.byteOffset || 0;
      view.byteLength = raw.length;
      view.extensions = {
        EXT_meshopt_compression: {
          buffer: 0,
          byteOffset: cursor,
          byteLength: encoded.length,
          byteStride: stride,
          count,
          mode,
          filter: "NONE",
        },
      };
      pieces.push(Buffer.from(encoded));
      cursor += encoded.length;
    } else {
      view.buffer = 0;
      view.byteOffset = cursor;
      view.byteLength = raw.length;
      delete view.extensions;
      pieces.push(raw);
      cursor += raw.length;
      const pad = (4 - (cursor % 4)) % 4;
      if (pad) {
        pieces.push(Buffer.alloc(pad));
        cursor += pad;
      }
    }
  }
  const compressed = Buffer.concat(pieces);
  json.buffers = [
    { byteLength: compressed.length },
    { byteLength: bin.length, extensions: { EXT_meshopt_compression: { fallback: true } } },
  ];
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), "EXT_meshopt_compression"])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), "EXT_meshopt_compression"])];
  const outPath = `${OUT}/${name}.glb`;
  writeGLB(outPath, json, compressed);
  const back = readGLB(outPath);
  for (let vi = 0; vi < original.length; vi++) {
    const view = back.json.bufferViews[vi];
    const ext = view.extensions && view.extensions.EXT_meshopt_compression;
    if (!ext) continue;
    const target = new Uint8Array(ext.count * ext.byteStride);
    const src = back.bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength);
    MeshoptDecoder.decodeGltfBuffer(target, ext.count, ext.byteStride, src, ext.mode, ext.filter || "NONE");
    const want = original[vi];
    const same = target.length === want.length && Buffer.from(target).equals(want);
    if (!same && ext.mode === "TRIANGLES" && trianglesMatch(target, want)) continue;
    if (!same) throw new Error(name + " view " + vi + " did not round-trip");
  }
  const srcBytes = statSync(srcPath).size;
  const outBytes = statSync(outPath).size;
  before += srcBytes;
  after += outBytes;
  console.log(name, srcBytes, "->", outBytes);
}
console.log("total", before, "->", after);
