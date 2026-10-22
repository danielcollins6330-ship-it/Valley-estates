# Animal model credits

Close-up animals are original rigged meshes built for this game. Distant animals, and the Low graphics setting, keep the earlier instanced bodies.

## Geometry and animation

| File | What it is | Licence |
| --- | --- | --- |
| `assets/animals/src/cattle.glb` | Speckle Park beef cow. Polled, stocky, deep body, short neck. 16 bones. Clips: Idle, Walk, Graze, Lie. | CC0. Original mesh, Blender 4.0.2 metaballs, automatic weights. No third-party geometry. |
| `assets/animals/src/sheep.glb` | Babydoll Southdown in dense fleece. Short legs, small ears, woolly face. Clips: Idle, Walk, Graze, Lie. | CC0. Original, same pipeline. |
| `assets/animals/src/sheep_shorn.glb` | The same breed after shearing. Close coat, legs and face showing. Same clips. | CC0. Original, same pipeline. |
| `assets/animals/src/dog.glb` | Red-and-tan kelpie. Pricked ears, dark saddle. Clips: Idle, Walk, Graze, Lie, Run. | CC0. Original, same pipeline. |
| `assets/animals/src/chicken.glb` | Yard hen. Clips: Idle, Walk, Graze, Lie. Graze is the peck. | CC0. Original, same pipeline. |
| `assets/animals/src/kangaroo.glb` | Eastern grey kangaroo. Big hind legs, thick tail. Clips: Idle, Walk, Graze, Lie, Hop. | CC0. Original, same pipeline. |
| `assets/animals/src/cockatoo.glb` | Sulphur-crested cockatoo. White body, yellow crest. Walk flaps the wings. Clips: Idle, Walk, Graze, Lie. | CC0. Original, same pipeline. |

The bundled renderer includes the skinning shader and does not include `AnimationMixer`. `assets/rig.js` samples the glTF clips, blends the previous clip into the next over 0.38 seconds, and writes bone matrices into a bone texture. Each animal starts at a different point in the clip, from its slot seed, so a herd does not step together.

World scale matches the farmhand, about 0.55 units for a 1.7 m person. At that scale the cattle mesh is 1.40 m at the shoulder, the woolly sheep about 0.55 m, and the shorn sheep about 0.48 m.

Each skinned mesh keeps its own bone texture. The matrices are stored in the row order this renderer's `texelFetch` reads. A shared atlas was tried and removed: every animal read the first slot, because the per-draw bone offset never reached the shader. The skeletons stay at 16 bones. The skin shader always fetches four influences per vertex, so a smaller skeleton would not make each vertex cheaper.

Breed colour is vertex colour on the mesh. Cattle are forced to a black body, a white face, and a few white speckles, so the coat stays black in the scene sun. One sheep in five uses a black fleece variant. The cockatoo crest is painted sulphur yellow and the hen comb is painted red, because those colours were not in the exported vertices. Coat and fleece detail is one triplanar normal sample, because the meshes have no texture coordinates.

## Textures

| File | What it is | Licence |
| --- | --- | --- |
| `assets/animals/coat.webp` | Tileable hair normal, 128×128 WebP. | CC0. Original, painted for this game. |
| `assets/animals/wool.webp` | Tileable wool-clump normal, 128×128 WebP. | CC0. Original, painted for this game. |

Materials stay rough. Cattle have no emissive lift and almost no environment reflection, so the black coat is not lifted to grey. Other coats keep a small warm emissive. The scene exposure is unchanged. Skinned meshes do not cast shadows. The painted cattle speckles are still in the instanced bodies: near-black and off-white, multiplied by the coat noise.

## Compression and the decoder

Runtime files are the meshopt-compressed glTF binaries in `assets/animals/*.glb` (not the `src/` originals). Positions, normals, weights, and colours are compressed with `EXT_meshopt_compression` and are not quantized, so the decoded vertices match the skeleton. Draco was not available in this Blender build (`libextern_draco.so` is missing). Quantizing meshopt was rejected because it pulled the mesh off the bones.

| File | Licence |
| --- | --- |
| `assets/animals/meshopt_decoder.js` | MIT. Vendored from meshoptimizer 1.3. Copyright 2016–2026 Arseny Kapoulkine. |

The game loads the compressed models, the two WebP normals, the decoder, and `assets/rig.js`. That download is about 741 KB (759,104 bytes of glTF, plus the two normals and the decoder), under the 4 MB budget. The `src/` glTF files stay in the repository for rebuilds and are not fetched at runtime. The building files add about 260 KB.

## Buildings

| File | What it is | Licence |
| --- | --- | --- |
| `assets/buildings/*.glb` | Homestead, winery, cellar door, Valley Villa, shearing shed, machinery shed, and sale yard. Weatherboard or stone, corrugated iron, verandahs. Each file has a near mesh and a far mesh. | CC0. Original, Blender 4.0.2. No third-party geometry. |

`tools/build-buildings.py` rebuilds them. The game loads the files through `assets/buildings.js`. Low graphics, and anything far from the camera, uses the far mesh.

## Rebuild

`tools/build-animals.py` is the headless Blender export. `tools/compress-animals.mjs` writes the meshopt binaries. Blender 4.x needs to be on `PATH`. The compressor needs `meshoptimizer@1.3.0` installed for Node (`npm install meshoptimizer@1.3.0`). That package is a build tool. The game only ships the decoder file listed above.
