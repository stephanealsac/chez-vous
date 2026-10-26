#!/usr/bin/env node
/**
 * Génère, pour chaque œuvre × taille du catalogue, le tableau encadré en caisse américaine :
 *   - models/<slug>-<taille>.usdz  (iPhone / AR Quick Look, ancrage mural)
 *   - models/<slug>-<taille>.glb   (Android Scene Viewer / WebXR)
 * Usage : node gen_models.mjs <site_dir>
 * Géométrie : frame_geometry.mjs (profil réel du cadre). Textures : image de la toile, occlusion du fond.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildPainting, FRAME } from './frame_geometry.mjs';

const SITE = process.argv[2] || '../site';
const cat = JSON.parse(fs.readFileSync(path.join(SITE, 'catalogue.json'), 'utf8'));
const F = { ...FRAME, ...cat.frame };
const OUT = path.join(SITE, 'models');
fs.mkdirSync(OUT, { recursive: true });
const USDZ_ORIENTATION = process.env.USDZ_ORIENTATION || 'lying';

// Matières (valeurs partagées USDZ / GLB) : noir neutre satiné (les photos iPhone réchauffent les tons), fond mat, toile mate
const MAT = {
  frame: { color: [0.014, 0.014, 0.014], roughness: 0.62, metallic: 0, specular: 0.12 },
  floor: { color: [0.010, 0.010, 0.010], roughness: 0.92, metallic: 0, specular: 0.08 },
  canvasSide: { color: [0.016, 0.016, 0.016], roughness: 0.82, metallic: 0, specular: 0.12 },
  canvas: { roughness: 0.88, metallic: 0 },
};

// ---------- ZIP USDZ (stored, données alignées sur 64 octets) ----------
function crcTable() { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function usdzZip(files) {
  const parts = []; const central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const headerLen = 30 + name.length;
    let pad = (64 - ((offset + headerLen) % 64)) % 64;
    if (pad > 0 && pad < 4) pad += 64;
    const extra = Buffer.alloc(pad);
    if (pad) { extra.writeUInt16LE(0x1986, 0); extra.writeUInt16LE(pad - 4, 2); }
    const crc = crc32(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(f.data.length, 18); lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(extra.length, 28);
    parts.push(lh, name, extra, f.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(f.data.length, 20); ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += headerLen + extra.length + f.data.length;
  }
  const cdStart = offset; const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(cdStart, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, eocd]);
}

// ---------- USDA ----------
const f3 = x => (Math.abs(x) < 1e-9 ? 0 : +x.toFixed(5));
const c3 = c => `(${c.map(v => +v.toFixed(4)).join(', ')})`;
function usdMesh(name, parts, orient) {
  const pts = [], nrm = [], st = [], st1 = [], idx = [], subsets = [];
  let faceStart = 0;
  for (const { m, mat, sub } of parts) {
    const off = pts.length;
    for (let i = 0; i < m.P.length; i += 3) {
      let [x, y, z] = [m.P[i], m.P[i + 1], m.P[i + 2]];
      let [nx, ny, nz] = [m.N[i], m.N[i + 1], m.N[i + 2]];
      if (orient === 'lying') { [y, z] = [z, -y]; [ny, nz] = [nz, -ny]; }
      pts.push(`(${f3(x)}, ${f3(y)}, ${f3(z)})`); nrm.push(`(${f3(nx)}, ${f3(ny)}, ${f3(nz)})`);
    }
    for (let i = 0; i < m.T.length; i += 2) st.push(`(${f3(m.T[i])}, ${f3(1 - m.T[i + 1])})`);
    const t2 = m.T2 || new Array(m.T.length).fill(0);
    for (let i = 0; i < t2.length; i += 2) st1.push(`(${f3(t2[i])}, ${f3(t2[i + 1])})`);
    idx.push(...m.I.map(i => i + off));
    const nFaces = m.I.length / 3;
    subsets.push({ sub, mat, faces: Array.from({ length: nFaces }, (_, k) => faceStart + k) });
    faceStart += nFaces;
  }
  const subsetStr = subsets.map(s => `
            def GeomSubset "${s.sub}" (
                prepend apiSchemas = ["MaterialBindingAPI"]
            )
            {
                uniform token elementType = "face"
                uniform token familyName = "materialBind"
                int[] indices = [${s.faces.join(', ')}]
                rel material:binding = ${s.mat}
            }`).join('');
  return `
        def Mesh "${name}" (
            prepend apiSchemas = ["MaterialBindingAPI"]
        )
        {
            uniform bool doubleSided = 0
            int[] faceVertexCounts = [${new Array(faceStart).fill(3).join(', ')}]
            int[] faceVertexIndices = [${idx.join(', ')}]
            rel material:binding = </Root/Materials/FrameMat>
            normal3f[] normals = [${nrm.join(', ')}] (
                interpolation = "vertex"
            )
            point3f[] points = [${pts.join(', ')}]
            float2[] primvars:st = [${st.join(', ')}] (
                interpolation = "vertex"
            )
            float2[] primvars:st1 = [${st1.join(', ')}] (
                interpolation = "vertex"
            )
            uniform token subdivisionScheme = "none"
            uniform token subsetFamily:materialBind:familyType = "partition"${subsetStr}
        }`;
}
function usdTexturedMaterial(name, file, { roughness, color, occlusion, specular = 0.3 }) {
  return `
        def Material "${name}"
        {
            token outputs:surface.connect = </Root/Materials/${name}/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                ${occlusion ? `color3f inputs:diffuseColor = ${c3(color)}\n                float inputs:occlusion.connect = </Root/Materials/${name}/Texture.outputs:r>`
                            : `color3f inputs:diffuseColor.connect = </Root/Materials/${name}/Texture.outputs:rgb>`}
                float inputs:metallic = 0
                float inputs:roughness = ${roughness}
                float inputs:specular = ${specular}
                token outputs:surface
            }
            def Shader "uvReader_st"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }
            def Shader "Texture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${file}@
                float2 inputs:st.connect = </Root/Materials/${name}/uvReader_st.outputs:result>
                token inputs:wrapS = "clamp"
                token inputs:wrapT = "clamp"
                ${occlusion ? 'float outputs:r' : 'float3 outputs:rgb'}
            }
        }`;
}
function usdCanvasMaterial() {
  return `
        def Material "CanvasMat"
        {
            token outputs:surface.connect = </Root/Materials/CanvasMat/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </Root/Materials/CanvasMat/Texture.outputs:rgb>
                float inputs:metallic = 0
                float inputs:roughness = ${MAT.canvas.roughness}
                float inputs:specular = 0.25
                token outputs:surface
            }
            def Shader "uvReader_st"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }
            def Shader "Texture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/canvas.jpg@
                float2 inputs:st.connect = </Root/Materials/CanvasMat/uvReader_st.outputs:result>
                token inputs:wrapS = "clamp"
                token inputs:wrapT = "clamp"
                float3 outputs:rgb
            }
        }`;
}
function usdTapeMaterial() {
  return `
        def Material "CanvasSideMat"
        {
            token outputs:surface.connect = </Root/Materials/CanvasSideMat/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </Root/Materials/CanvasSideMat/Cloth.outputs:rgb>
                normal3f inputs:normal.connect = </Root/Materials/CanvasSideMat/Grain.outputs:rgb>
                float inputs:metallic = 0
                float inputs:roughness = ${MAT.canvasSide.roughness}
                float inputs:specular = ${MAT.canvasSide.specular}
                token outputs:surface
            }
            def Shader "uvReader_st1"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }
            def Shader "Cloth"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/tape_color.png@
                float2 inputs:st.connect = </Root/Materials/CanvasSideMat/uvReader_st1.outputs:result>
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float3 outputs:rgb
            }
            def Shader "Grain"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/tape_normal.png@
                float2 inputs:st.connect = </Root/Materials/CanvasSideMat/uvReader_st1.outputs:result>
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float4 inputs:scale = (2, 2, 2, 1)
                float4 inputs:bias = (-1, -1, -1, 0)
                float3 outputs:rgb
            }
        }`;
}
function usdShadowMaterial() {
  return `
        def Material "ShadowMat"
        {
            token outputs:surface.connect = </Root/Materials/ShadowMat/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = (0, 0, 0)
                float inputs:opacity.connect = </Root/Materials/ShadowMat/Texture.outputs:a>
                float inputs:metallic = 0
                float inputs:roughness = 1
                int inputs:useSpecularWorkflow = 1
                color3f inputs:specularColor = (0, 0, 0)
                float inputs:ior = 1
                float inputs:clearcoat = 0
                token outputs:surface
            }
            def Shader "uvReader_st"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }
            def Shader "Texture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/shadow.png@
                float2 inputs:st.connect = </Root/Materials/ShadowMat/uvReader_st.outputs:result>
                token inputs:wrapS = "clamp"
                token inputs:wrapT = "clamp"
                float outputs:a
            }
        }`;
}
function usdPlainMaterial(name, { color, roughness, specular = 0.5 }) {
  return `
        def Material "${name}"
        {
            token outputs:surface.connect = </Root/Materials/${name}/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = ${c3(color)}
                float inputs:metallic = 0
                float inputs:roughness = ${roughness}
                float inputs:specular = ${specular}
                token outputs:surface
            }
        }`;
}
function buildUSDA(p, title, orient) {
  return `#usda 1.0
(
    customLayerData = {
        string creator = "AR Tableaux - Stephane Alsac"
        string title = "${title.replace(/"/g, '\\"')}"
    }
    defaultPrim = "Root"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Root"
{
    def Scope "Materials"
    {${usdPlainMaterial('FrameMat', MAT.frame)}${usdTapeMaterial()}${usdTexturedMaterial('FloorMat', 'textures/floor_ao.png', { roughness: MAT.floor.roughness, color: MAT.floor.color, occlusion: true, specular: MAT.floor.specular })}${usdCanvasMaterial()}${usdShadowMaterial()}
    }
    def Scope "Scenes" (
        kind = "sceneLibrary"
    )
    {
        def Xform "Scene" (
            customData = {
                bool preliminary_collidesWithEnvironment = 0
                string sceneName = "Scene"
            }
            sceneName = "Scene"
            prepend apiSchemas = ["Preliminary_AnchoringAPI"]
        )
        {
            token preliminary:anchoring:type = "plane"
            token preliminary:planeAnchoring:alignment = "vertical"
${usdMesh('Painting', [
  { m: p.frame, mat: '</Root/Materials/FrameMat>', sub: 'frame' },
  { m: p.floor, mat: '</Root/Materials/FloorMat>', sub: 'floor' },
  { m: p.front, mat: '</Root/Materials/CanvasMat>', sub: 'canvas' },
], orient)}
${usdMesh('CanvasSides', [{ m: { ...p.sides, T: p.sides.T2, T2: undefined }, mat: '</Root/Materials/CanvasSideMat>', sub: 'canvasSides' }], orient)}
${p.shadow.I.length ? usdMesh('Shadow', [{ m: p.shadow, mat: '</Root/Materials/ShadowMat>', sub: 'shadow' }], orient) : ''}
        }
    }
}

`;
}

// ---------- GLB ----------
function buildGLB(p, jpg, aoPng, cloth, tape, shadowPng) {
  const bufs = []; const views = []; const accessors = [];
  let byteLength = 0;
  function addView(buf, target) {
    while (byteLength % 4) { bufs.push(Buffer.alloc(1)); byteLength++; }
    views.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, ...(target ? { target } : {}) });
    bufs.push(buf); byteLength += buf.length; return views.length - 1;
  }
  function addAccessor(arr, type, comp, target, minmax) {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const bv = addView(buf, target);
    const n = type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : type === 'VEC4' ? 4 : 3;
    const acc = { bufferView: bv, componentType: comp, count: arr.length / n, type };
    if (minmax) { const min = [], max = []; for (let k = 0; k < n; k++) { min.push(Infinity); max.push(-Infinity); } for (let i = 0; i < arr.length; i += n) for (let k = 0; k < n; k++) { min[k] = Math.min(min[k], arr[i + k]); max[k] = Math.max(max[k], arr[i + k]); } acc.min = min; acc.max = max; }
    accessors.push(acc); return accessors.length - 1;
  }
  const prims = [];
  const mats = [
    { name: 'Frame', pbrMetallicRoughness: { baseColorFactor: [...MAT.frame.color, 1], metallicFactor: 0, roughnessFactor: MAT.frame.roughness } },
    { name: 'Floor', pbrMetallicRoughness: { baseColorFactor: [...MAT.floor.color, 1], metallicFactor: 0, roughnessFactor: MAT.floor.roughness }, occlusionTexture: { index: 1, strength: 1 } },
    { name: 'CanvasSide', pbrMetallicRoughness: { baseColorTexture: { index: 2, texCoord: 0 }, metallicFactor: 0, roughnessFactor: MAT.canvasSide.roughness }, normalTexture: { index: 3, texCoord: 0, scale: 1 } },
    { name: 'Canvas', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: MAT.canvas.roughness } },
  ];
  // GLB (Android / Scene Viewer) : pas d'ombre dessinée — la visionneuse de Google l'affiche en aplat sombre et ajoute déjà la sienne
  [[p.frame, 0, false], [p.floor, 1, true], [p.sides, 2, false], [p.front, 3, true]].forEach(([m, mat, uv]) => {
    if (!m.I.length) return;
    const attr = {
      POSITION: addAccessor(new Float32Array(m.P), 'VEC3', 5126, 34962, true),
      NORMAL: addAccessor(new Float32Array(m.N), 'VEC3', 5126, 34962),
    };
    if (uv) attr.TEXCOORD_0 = addAccessor(new Float32Array(m.T), 'VEC2', 5126, 34962);
    if (m.T2) attr[uv ? 'TEXCOORD_1' : 'TEXCOORD_0'] = addAccessor(new Float32Array(m.T2), 'VEC2', 5126, 34962);
    if (m.TAN) attr.TANGENT = addAccessor(new Float32Array(m.TAN), 'VEC4', 5126, 34962);
    const idx = addAccessor(new Uint16Array(m.I), 'SCALAR', 5123, 34963);
    prims.push({ attributes: attr, indices: idx, material: mat });
  });
  const imgView = addView(jpg), aoView = addView(aoPng), clothView = addView(cloth), tapeView = addView(tape);
  const json = {
    asset: { version: '2.0', generator: 'AR Tableaux - Stephane Alsac' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Painting' }],
    meshes: [{ primitives: prims }], materials: mats,
    textures: [{ source: 0, sampler: 0 }, { source: 1, sampler: 0 }, { source: 2, sampler: 1 }, { source: 3, sampler: 1 }],
    images: [{ bufferView: imgView, mimeType: 'image/jpeg' }, { bufferView: aoView, mimeType: 'image/png' }, { bufferView: clothView, mimeType: 'image/png' }, { bufferView: tapeView, mimeType: 'image/png' }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }, { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    accessors, bufferViews: views, buffers: [{ byteLength }],
  };
  let jb = Buffer.from(JSON.stringify(json)); while (jb.length % 4) jb = Buffer.concat([jb, Buffer.from(' ')]);
  let bin = Buffer.concat(bufs); while (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(1)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
  const ch1 = Buffer.alloc(8); ch1.writeUInt32LE(jb.length, 0); ch1.writeUInt32LE(0x4E4F534A, 4);
  const ch2 = Buffer.alloc(8); ch2.writeUInt32LE(bin.length, 0); ch2.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([header, ch1, jb, ch2, bin]);
}

// ---------- boucle ----------
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));   // on repart propre : seuls les fichiers du catalogue courant sont servis
const cloth = fs.readFileSync(path.join(SITE, 'tape_color.png'));
const tape = fs.readFileSync(path.join(SITE, 'tape_normal.png'));
let n = 0;
for (const w of cat.works) {
  const jpg = fs.readFileSync(path.join(SITE, w.image));
  for (const s of w.sizes) {
    const p = buildPainting(s.w, s.h, F, s.shadow_cm);
    const ao = fs.readFileSync(path.join(SITE, s.ao_img));
    const shadowPng = fs.readFileSync(path.join(SITE, s.shadow_img));
    const usda = Buffer.from(buildUSDA(p, w.title, USDZ_ORIENTATION), 'utf8');
    const usdz = usdzZip([{ name: 'model.usda', data: usda }, { name: 'textures/canvas.jpg', data: jpg }, { name: 'textures/floor_ao.png', data: ao }, { name: 'textures/tape_color.png', data: cloth }, { name: 'textures/tape_normal.png', data: tape }, { name: 'textures/shadow.png', data: shadowPng }]);
    const glb = buildGLB(p, jpg, ao, cloth, tape, shadowPng);
    // nom unique par contenu : les navigateurs gardent les anciens fichiers en cache un an, un nouveau nom force la nouvelle version
    const h = crypto.createHash('sha1').update(usdz).update(glb).digest('hex').slice(0, 8);
    const base = `${w.slug}-${s.slug}-${h}`;
    fs.writeFileSync(path.join(OUT, base + '.usdz'), usdz);
    fs.writeFileSync(path.join(OUT, base + '.glb'), glb);
    s.usdz = `models/${base}.usdz`; s.glb = `models/${base}.glb`;
    s.outer_cm = { w: +(p.outer.w * 100).toFixed(1), h: +(p.outer.h * 100).toFixed(1), d: +(p.outer.d * 100).toFixed(1) };
    n++;
  }
}
for (const w of cat.works) { delete w.crop_note; delete w.image_px; delete w.technique; }
fs.writeFileSync(path.join(SITE, 'catalogue.json'), JSON.stringify(cat, null, 1));
console.log(`${n} modèles générés (usdz + glb), orientation USDZ = ${USDZ_ORIENTATION}`);
