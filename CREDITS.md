# Valley Estates v4 — Credits & Licences

All third-party assets below are **CC0 1.0 (public domain)** or MIT — free for commercial use, no attribution required (credited anyway).

## Textures — Poly Haven (CC0 1.0, https://polyhaven.com/license)
Downloaded at 1K (diffuse + OpenGL normal), converted to WebP (diffuse 1024², normals 512²) and embedded as data URIs in `assets/textures.js` (needed so WebGL can use them when opened from `file://`).

| Asset | Used for | Source |
|---|---|---|
| leafy_grass | terrain base grass | https://polyhaven.com/a/leafy_grass (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/leafy_grass/) |
| sparse_grass | terrain dry pasture (hills/summer) | https://polyhaven.com/a/sparse_grass (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/sparse_grass/) |
| withered_grass | hay bales, sawdust | https://polyhaven.com/a/withered_grass (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/withered_grass/) |
| forest_leaves_02 | forest floor | https://polyhaven.com/a/forest_leaves_02 (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_leaves_02/) |
| coast_sand_01 | river/lake banks | https://polyhaven.com/a/coast_sand_01 (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/coast_sand_01/) |
| aerial_rocks_02 | rock tiles + boulders | https://polyhaven.com/a/aerial_rocks_02 (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_rocks_02/) |
| farm_soil | wheat fields, vineyards | https://polyhaven.com/a/farm_soil (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/farm_soil/) |
| gravel | winery courtyard, market, foundations | https://polyhaven.com/a/gravel (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gravel/) |
| corrugated_iron | homestead/cottage/shed roofs, water tanks | https://polyhaven.com/a/corrugated_iron (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/corrugated_iron/) |
| rusty_corrugated_iron | barn roof | https://polyhaven.com/a/rusty_corrugated_iron (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rusty_corrugated_iron/) |
| weathered_plank_siding | weatherboard walls | https://polyhaven.com/a/weathered_plank_siding (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/weathered_plank_siding/) |
| brick_4 | chimney, winery sandstone walls (tinted) | https://polyhaven.com/a/brick_4 (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_4/) |
| clay_roof_tiles | winery terracotta roof | https://polyhaven.com/a/clay_roof_tiles (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/clay_roof_tiles/) |
| eucalyptus_bark | tree trunks, logs | https://polyhaven.com/a/eucalyptus_bark (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/eucalyptus_bark/) |
| red_laterite_soil_stones | quarry, building foundations, dam bank | https://polyhaven.com/a/red_laterite_soil_stones (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/red_laterite_soil_stones/) |
| wood_planks | verandah decks, barrels, crates | https://polyhaven.com/a/wood_planks (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_planks/) |

## Code
| Library | Licence | Source |
|---|---|---|
| three.js r170 (+ EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, BufferGeometryUtils), bundled into `game3d.js` with esbuild | MIT | https://github.com/mrdoob/three.js / https://www.npmjs.com/package/three |

## 3D models
No external 3D models were used. All buildings, trees, crops, fences, barrels, hay bales, Speckle Park cattle, Babydoll sheep and farmhands are modelled procedurally from Three.js primitives in `src/main.js`, textured with the Poly Haven photo textures above where applicable. Procedural (code-generated) textures: leaf canopy, grass blades, water normal map, cow speckle, wool, awning stripes, noise.

## Original work
Game design, code and procedural art: Valley Estates (Daniel Collins / Grok Bot), 2026.
