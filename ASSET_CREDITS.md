# Animal model credits

Close-up cattle, sheep, the dog, and the hen use free CC0 meshes. Coat colour is painted vertex colour on top of those meshes. Distant animals, and the Low graphics setting, keep the earlier instanced bodies. The kangaroo and the cockatoo are still the original meshes: the CC0 and CC-BY models found for them were scans and statues, not rigs that would hold up at this poly count.

## Geometry and animation

| File | What it is | Licence |
| --- | --- | --- |
| `assets/animals/src/cattle.glb` | Quaternius cow from the Ultimate Animated Animal Pack, horns removed so it reads polled. Retextured as a Speckle Park: black body, white on the face and head, a white strip along the topline and tail, speckled underline. Shoulders, chest, and legs stay black. Clips: Idle, Walk, Graze (the pack's eating), Lie (held last frame of death), Run (gallop). | CC0. Quaternius, July 2021. https://quaternius.com/packs/ultimateanimatedanimals.html |
| `assets/animals/src/sheep.glb` | Quaternius sheep from the Farm Animal Pack. Painted as a Babydoll Southdown: cream fleece, tan teddy-bear face, dark legs. Clips: Idle, Walk, Run, Graze (idle with the head lowered), Lie. | CC0. Quaternius, June 2018. https://quaternius.com/packs/farmanimal.html and https://poly.pizza/bundle/Farm-Animal-Pack-1kUvRTPLzT |
| `assets/animals/src/sheep_shorn.glb` | The same sheep mesh, fleece pulled in and repainted as skin. Same height as the woolly sheep, with a narrower body. Same clips. | CC0. Same pack as the woolly sheep. |
| `assets/animals/src/dog.glb` | Quaternius Shiba Inu from the Ultimate Animated Animal Pack, repainted red and tan as a kelpie. The curled tail is posed straight. Clips: Idle, Walk, Graze, Lie, Run. | CC0. Same Ultimate Animated Animal Pack. |
| `assets/animals/src/chicken.glb` | Rigged hen by Čestmír Dammer. The Farm Animal Pack has no hen (llama, pig, pug, sheep, horse, cow, zebra). The separate Quaternius chicken on Poly Pizza could not be downloaded. Photo texture is not used. Comb scaled up. Painted buff, with a red comb and yellow beak and legs. Graze is the peck. Clips: Idle, Walk, Graze, Lie. | CC0. https://opengameart.org/content/chicken-animated |
| `assets/animals/src/kangaroo.glb` | Eastern grey kangaroo. Big hind legs, thick tail. Clips: Idle, Walk, Graze, Lie, Hop. | CC0. Original mesh, kept. No suitable CC0 or CC-BY rigged replacement. |
| `assets/animals/src/cockatoo.glb` | Sulphur-crested cockatoo. White body, yellow crest. Walk flaps the wings. Clips: Idle, Walk, Graze, Lie. | CC0. Original mesh, kept. Sketchfab's downloadable cockatoos were high-poly scans or unrigged statues. |

The bundled renderer includes the skinning shader and does not include `AnimationMixer`. `assets/rig.js` samples the glTF clips, blends the previous clip into the next over 0.38 seconds, and writes bone matrices into a bone texture. Each animal starts at a different point in the clip, from its slot seed, so a herd does not step together.

World scale matches the farmhand, about 0.55 units for a 1.7 m person. At that scale the cattle mesh is about 1.4 m tall. The Babydoll stands at about 57% of that height, near 0.8 m, and is widened so the fleece reads chunky beside a cow. The shorn sheep keeps that height with a narrower body. The dog is about 0.52 m, and the hen about 0.40 m.

Each skinned mesh keeps its own bone texture. The matrices are stored in the row order this renderer's `texelFetch` reads. A shared atlas was tried and removed: every animal read the first slot, because the per-draw bone offset never reached the shader. The imported rigs keep the author's bone counts (cattle 42, dog 46, sheep 24, hen 40). The kangaroo and cockatoo stay at 16. The skin shader always fetches four influences per vertex.

Breed colour is vertex colour painted in Blender, with a soft light-from-above so the coats are not flat. One sheep in five uses a darker fleece. The cockatoo crest is still painted sulphur yellow in `assets/rig.js`, because that mesh is the original one. Coat and fleece detail is one triplanar normal sample. The imported meshes are not using their old flat material colours.

## Textures

| File | What it is | Licence |
| --- | --- | --- |
| `assets/animals/coat.webp` | Tileable hair normal, 128×128 WebP. | CC0. Original, painted for this game. |
| `assets/animals/wool.webp` | Tileable wool-clump normal, 128×128 WebP. | CC0. Original, painted for this game. |

Materials stay rough. Cattle have no emissive lift and no environment reflection, so the black coat is not lifted to grey. Other coats keep a small warm emissive. The scene exposure is unchanged. Skinned meshes do not cast shadows. The instanced cattle stay vertex-coloured: a near-black coat, a narrow white topline, white speckles and a white face, with head and legs drawn even from the default camera. There is no coat map.

## Compression and the decoder

Runtime files are the meshopt-compressed glTF binaries in `assets/animals/*.glb` (not the `src/` originals). Positions, normals, weights, and colours are compressed with `EXT_meshopt_compression` and are not quantized, so the decoded vertices match the skeleton. Draco was not available in this Blender build (`libextern_draco.so` is missing). Quantizing meshopt was rejected because it pulled the mesh off the bones.

| File | Licence |
| --- | --- |
| `assets/animals/meshopt_decoder.js` | MIT. Vendored from meshoptimizer 1.3. Copyright 2016–2026 Arseny Kapoulkine. |

The game loads the compressed models, the two WebP normals, the decoder, and `assets/rig.js`. That download is about 1.6 MB (1,601,428 bytes of glTF, plus the two normals and the decoder). The `src/` glTF files stay in the repository for rebuilds and are not fetched at runtime. The building files add about 260 KB.

## Buildings

| File | What it is | Licence |
| --- | --- | --- |
| `assets/buildings/*.glb` | Homestead, winery, cellar door, Valley Villa, shearing shed, machinery shed, and sale yard. Weatherboard or stone, corrugated iron, verandahs, chimneys. Each file has a near mesh and a far mesh. `assets/buildings.js` adds gutters, darker eaves, verandah posts and round corrugated tanks on top. | CC0. Original, Blender 4.0.2, plus procedural detail in `buildings.js`. No third-party geometry. |

`tools/build-buildings.py` rebuilds them. The game loads the files through `assets/buildings.js`. Low graphics, and anything far from the camera, uses the far mesh.

## Rebuild

`tools/import-cc0-animals.py` bakes the Quaternius cow, Shiba, and sheep, and the Dammer hen, into `assets/animals/src`. It reads the source files from `/tmp` (not committed). `tools/build-animals.py` still builds the kangaroo and the cockatoo, and it skips the imported species so a full run does not put the metaball meshes back. `tools/compress-animals.mjs` writes the meshopt binaries. Blender 4.x needs to be on `PATH`. The compressor needs `meshoptimizer@1.3.0` installed for Node (`npm install meshoptimizer@1.3.0`). That package is a build tool. The game only ships the decoder file listed above.
