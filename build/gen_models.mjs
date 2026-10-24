#!/usr/bin/env node
/**
 * Génère, pour chaque œuvre × taille du catalogue, un modèle 3D de tableau
 * encadré en caisse américaine :
 *   - models/<slug>-<taille>.usdz  (iPhone / AR Quick Look, ancrage mural)
 *   - models/<slug>-<taille>.glb   (Android Scene Viewer / WebXR / aperçu model-viewer)
 *
 * Usage : node gen_models.mjs <site_dir>
 * Aucune dépendance : géométrie, USDA, GLB et ZIP sont écrits à la main.
 */
import fs from 'node:fs';
import path from 'node:path';

const SITE = process.argv[2] || '../site';
const cat = JSON.parse(fs.readFileSync(path.join(SITE, 'catalogue.json'), 'utf8'));
const F = cat.frame; // bar_width_cm, bar_depth_cm, gap_cm, canvas_depth_cm
const OUT = path.join(SITE, 'models');
fs.mkdirSync(OUT, { recursive: true });

// Orientation du modèle USDZ pour l'ancrage vertical de Quick Look.
// 'lying'   : dos sur le plan XZ (y=0), face vers +Y, haut du tableau vers -Z  (convention Reality Composer)
// 'upright' : debout, face vers +Z, haut vers +Y
const USDZ_ORIENTATION = process.env.USDZ_ORIENTATION || 'lying';

// ---------- géométrie ----------
// Tous les maillages sont construits "debout" : X droite, Y haut, Z vers le spectateur, mur en z=0.
function box(x0, x1, y0, y1, z0, z1, uvFace /* 'front' | null */) {
  // 6 faces, 4 sommets par face, normales par face, uv optionnels sur la face avant
  const P = [], N = [], T = [], I = [];
  const faces = [
    { n: [0, 0, 1], v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], front: true }, // +Z
    { n: [0, 0, -1], v: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },             // -Z
    { n: [1, 0, 0], v: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]] },               // +X
    { n: [-1, 0, 0], v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },             // -X
    { n: [0, 1, 0], v: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]] },               // +Y
    { n: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },             // -Y
  ];
  for (const f of faces) {
    const base = P.length / 3;
    f.v.forEach((p, k) => {
      P.push(...p); N.push(...f.n);
      if (uvFace === 'front' && f.front) {
        // uv glTF (origine en haut à gauche) ; on calcule u,v = position relative sur la face
        const u = (p[0] - x0) / (x1 - x0), v = 1 - (p[1] - y0) / (y1 - y0);
        T.push(u, v);
      } else T.push(0, 0);
    });
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { P, N, T, I };
}
function merge(...ms) {
  const o = { P: [], N: [], T: [], I: [] };
  for (const m of ms) {
    const off = o.P.length / 3;
    o.P.push(...m.P); o.N.push(...m.N); o.T.push(...m.T);
    o.I.push(...m.I.map(i => i + off));
  }
  return o;
}

/** Construit le tableau encadré pour une toile de w×h cm. Retourne {frame, canvas} en mètres. */
function buildPainting(wcm, hcm) {
  const cm = 0.01;
  const w = wcm * cm, h = hcm * cm;
  const bar = F.bar_width_cm * cm, depth = F.bar_depth_cm * cm, gap = F.gap_cm * cm;
  const cd = F.canvas_depth_cm * cm, recess = 0.005; // toile 5 mm en retrait de l'avant du cadre
  const ox = w / 2 + gap + bar, oy = h / 2 + gap + bar; // demi-dimensions extérieures
  const ix = w / 2 + gap, iy = h / 2 + gap;             // demi-dimensions intérieures (jour)
  const frame = merge(
    box(-ox, ox, iy, oy, 0, depth),      // barre haute
    box(-ox, ox, -oy, -iy, 0, depth),    // barre basse
    box(-ox, -ix, -iy, iy, 0, depth),    // barre gauche
    box(ix, ox, -iy, iy, 0, depth),      // barre droite
    box(-ix, ix, -iy, iy, 0, 0.004),     // fond noir du caisson
  );
  const zc0 = depth - recess - cd, zc1 = depth - recess;
  const canvasFront = box(-w / 2, w / 2, -h / 2, h / 2, zc0, zc1, 'front');
  // on sépare la face avant (texturée) des côtés (gris toile)
  const front = { P: canvasFront.P.slice(0, 12), N: canvasFront.N.slice(0, 12), T: canvasFront.T.slice(0, 8), I: [0, 1, 2, 0, 2, 3] };
  const sides = { P: canvasFront.P.slice(12), N: canvasFront.N.slice(12), T: canvasFront.T.slice(8), I: canvasFront.I.slice(6).map(i => i - 4) };
  // étiquette de format : plaque plate sous le cadre (image 11:1), largeur bornée 33–44 cm
  const lw = Math.min(Math.max(2 * ox * 0.8, 0.33), 0.44), lh = lw / 11, lgap = 0.025;
  const label = box(-lw / 2, lw / 2, -oy - lgap - lh, -oy - lgap, 0, 0.003, 'front');
  const labelFront = { P: label.P.slice(0, 12), N: label.N.slice(0, 12), T: label.T.slice(0, 8), I: [0, 1, 2, 0, 2, 3] };
  return { frame, front, sides, label: labelFront, outer: { w: 2 * ox, h: 2 * oy, d: depth } };
}

// ---------- USDZ ----------
function crcTable() { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

/** ZIP "stored" avec alignement 64 octets des données (exigence USDZ). files: [{name, data:Buffer}] */
function usdzZip(files) {
  const parts = []; const central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const headerLen = 30 + name.length;
    let pad = (64 - ((offset + headerLen) % 64)) % 64;
    if (pad > 0 && pad < 4) pad += 64; // un champ extra fait au moins 4 octets
    const extra = Buffer.alloc(pad);
    if (pad) { extra.writeUInt16LE(0x1986, 0); extra.writeUInt16LE(pad - 4, 2); }
    const crc = crc32(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); // heure/date fixes
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

const f3 = x => (Math.abs(x) < 1e-9 ? 0 : +x.toFixed(5));
/** Un seul maillage avec trois sous-ensembles de faces (cadre, côtés de toile, face peinte). */
function usdMesh(name, parts, orient) {
  const pts = [], nrm = [], st = [], idx = [];
  const subsets = [];
  let faceStart = 0;
  for (const { m, mat, sub } of parts) {
    const off = pts.length;
    for (let i = 0; i < m.P.length; i += 3) {
      let [x, y, z] = [m.P[i], m.P[i + 1], m.P[i + 2]];
      let [nx, ny, nz] = [m.N[i], m.N[i + 1], m.N[i + 2]];
      if (orient === 'lying') { [y, z] = [z, -y]; [ny, nz] = [nz, -ny]; }
      pts.push(`(${f3(x)}, ${f3(y)}, ${f3(z)})`); nrm.push(`(${f3(nx)}, ${f3(ny)}, ${f3(nz)})`);
    }
    for (let i = 0; i < m.T.length; i += 2) st.push(`(${f3(m.T[i])}, ${f3(1 - m.T[i + 1])})`); // USD : origine en bas à gauche
    idx.push(...m.I.map(i => i + off));
    const nFaces = m.I.length / 3;
    subsets.push({ sub, mat, faces: Array.from({ length: nFaces }, (_, k) => faceStart + k) });
    faceStart += nFaces;
  }
  const counts = new Array(faceStart).fill(3).join(', ');
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
            int[] faceVertexCounts = [${counts}]
            int[] faceVertexIndices = [${idx.join(', ')}]
            rel material:binding = </Root/Materials/FrameMat>
            normal3f[] normals = [${nrm.join(', ')}] (
                interpolation = "vertex"
            )
            point3f[] points = [${pts.join(', ')}]
            float2[] primvars:st = [${st.join(', ')}] (
                interpolation = "vertex"
            )
            uniform token subdivisionScheme = "none"
            uniform token subsetFamily:materialBind:familyType = "partition"${subsetStr}
        }`;
}

function labelMaterial(i) {
  return `
        def Material "LabelMat${i}"
        {
            token outputs:surface.connect = </Root/Materials/LabelMat${i}/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </Root/Materials/LabelMat${i}/Texture.outputs:rgb>
                float inputs:metallic = 0
                float inputs:roughness = 0.95
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
                asset inputs:file = @textures/label${i}.jpg@
                float2 inputs:st.connect = </Root/Materials/LabelMat${i}/uvReader_st.outputs:result>
                token inputs:wrapS = "clamp"
                token inputs:wrapT = "clamp"
                float3 outputs:rgb
            }
        }`;
}

/**
 * formats : [{ p (géométrie), name }], start : index du format visible à l'ouverture,
 * behaviors : bloc USDA des comportements (toucher → format suivant), '' si un seul format.
 */
function buildUSDA(formats, start, title, orient, behaviors) {
  const scenePath = '/Root/Scenes/Scene';
  const prims = formats.map((f, i) => `
            def Xform "${f.name}"
            {
${usdMesh('Painting', [
  { m: f.p.frame, mat: '</Root/Materials/FrameMat>', sub: 'frame' },
  { m: f.p.sides, mat: '</Root/Materials/CanvasSideMat>', sub: 'canvasSides' },
  { m: f.p.front, mat: '</Root/Materials/CanvasMat>', sub: 'canvas' },
], orient).replace(/^/gm, '    ')}
${usdMesh('Label', [{ m: f.p.label, mat: `</Root/Materials/LabelMat${i}>`, sub: 'label' }], orient).replace(/^/gm, '    ')}
            }`).join('');
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
    {
        def Material "FrameMat"
        {
            token outputs:surface.connect = </Root/Materials/FrameMat/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = (0.02, 0.02, 0.02)
                float inputs:metallic = 0
                float inputs:roughness = 0.85
                token outputs:surface
            }
        }
        def Material "CanvasSideMat"
        {
            token outputs:surface.connect = </Root/Materials/CanvasSideMat/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = (0.35, 0.33, 0.30)
                float inputs:metallic = 0
                float inputs:roughness = 0.95
                token outputs:surface
            }
        }
        def Material "CanvasMat"
        {
            token outputs:surface.connect = </Root/Materials/CanvasMat/PreviewSurface.outputs:surface>
            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </Root/Materials/CanvasMat/Texture.outputs:rgb>
                float inputs:metallic = 0
                float inputs:roughness = 0.9
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
        }${formats.map((_, i) => labelMaterial(i)).join('')}
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
${prims}
${behaviors}
        }
    }
}

`;
}

// ---------- GLB ----------
function buildGLB(p, jpg) {
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
    const n = type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : 3;
    const acc = { bufferView: bv, componentType: comp, count: arr.length / n, type };
    if (minmax) { const min = [], max = []; for (let k = 0; k < n; k++) { min.push(Infinity); max.push(-Infinity); } for (let i = 0; i < arr.length; i += n) for (let k = 0; k < n; k++) { min[k] = Math.min(min[k], arr[i + k]); max[k] = Math.max(max[k], arr[i + k]); } acc.min = min; acc.max = max; }
    accessors.push(acc); return accessors.length - 1;
  }
  const prims = [];
  const mats = [
    { name: 'Frame', pbrMetallicRoughness: { baseColorFactor: [0.02, 0.02, 0.02, 1], metallicFactor: 0, roughnessFactor: 0.85 } },
    { name: 'CanvasSide', pbrMetallicRoughness: { baseColorFactor: [0.35, 0.33, 0.30, 1], metallicFactor: 0, roughnessFactor: 0.95 } },
    { name: 'Canvas', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.9 } },
  ];
  [[p.frame, 0, false], [p.sides, 1, false], [p.front, 2, true]].forEach(([m, mat, uv]) => {
    const attr = {
      POSITION: addAccessor(new Float32Array(m.P), 'VEC3', 5126, 34962, true),
      NORMAL: addAccessor(new Float32Array(m.N), 'VEC3', 5126, 34962),
    };
    if (uv) attr.TEXCOORD_0 = addAccessor(new Float32Array(m.T), 'VEC2', 5126, 34962);
    const idx = addAccessor(new Uint16Array(m.I), 'SCALAR', 5123, 34963);
    prims.push({ attributes: attr, indices: idx, material: mat });
  });
  const imgView = addView(jpg);
  const json = {
    asset: { version: '2.0', generator: 'AR Tableaux - Stephane Alsac' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Painting' }],
    meshes: [{ primitives: prims }], materials: mats,
    textures: [{ source: 0, sampler: 0 }], images: [{ bufferView: imgView, mimeType: 'image/jpeg' }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    accessors, bufferViews: views, buffers: [{ byteLength }],
  };
  let jb = Buffer.from(JSON.stringify(json)); while (jb.length % 4) jb = Buffer.concat([jb, Buffer.from(' ')]);
  let bin = Buffer.concat(bufs); while (bin.length % 4) bin = Buffer.concat([bin, Buffer.alloc(1)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
  const ch1 = Buffer.alloc(8); ch1.writeUInt32LE(jb.length, 0); ch1.writeUInt32LE(0x4E4F534A, 4);
  const ch2 = Buffer.alloc(8); ch2.writeUInt32LE(bin.length, 0); ch2.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([header, ch1, jb, ch2, bin]);
}

// ---------- comportements : toucher le format i → cacher i, montrer i+1 ----------
function buildBehaviors(formats, start) {
  if (formats.length < 2) return '';
  const S = '/Root/Scenes/Scene';
  const others = formats.filter((_, i) => i !== start);
  const onLoad = `
                def Preliminary_Behavior "OnLoad"
                {
                    rel triggers = [ <${S}/Behaviors/OnLoad/Near>, <${S}/Behaviors/OnLoad/Trigger> ]
                    rel actions = [ <${S}/Behaviors/OnLoad/Group> ]
                    uniform bool exclusive = 0

                    def Preliminary_Trigger "Near"
                    {
                        uniform token info:id = "ProximityToCamera"
                        uniform double distance = 100
                        rel affectedObjects = [ <${S}/${formats[start].name}> ]
                    }

                    def Preliminary_Trigger "Trigger"
                    {
                        uniform token info:id = "SceneTransition"
                        uniform token type = "enter"
                    }

                    def Preliminary_Action "Group"
                    {
                        uniform token info:id = "Group"
                        uniform token type = "parallel"
                        uniform bool loops = 0
                        uniform uint performCount = 1
                        uniform token multiplePerformOperation = "ignore"
                        rel actions = [ ${others.map(o => `<${S}/Behaviors/OnLoad/Group/Hide${o.name}>`).join(', ')} ]
${others.map(o => `
                        def Preliminary_Action "Hide${o.name}"
                        {
                            uniform token info:id = "Visibility"
                            uniform token type = "hide"
                            rel affectedObjects = [ <${S}/${o.name}> ]
                            double duration = 0
                            uniform token easeType = "none"
                            uniform token motionType = "pop"
                            uniform double moveDistance = 0
                            uniform token multiplePerformOperation = "ignore"
                        }`).join('')}
                    }
                }`;
  return `
            def Scope "Behaviors"
            {${onLoad}${formats.map((f, i) => {
    const next = formats[(i + 1) % formats.length];
    return `
                def Preliminary_Behavior "Tap${i}"
                {
                    rel triggers = [ <${S}/Behaviors/Tap${i}/Trigger> ]
                    rel actions = [ <${S}/Behaviors/Tap${i}/Group> ]
                    uniform bool exclusive = 0

                    def Preliminary_Trigger "Trigger"
                    {
                        uniform token info:id = "TapGesture"
                        rel affectedObjects = [ <${S}/${f.name}> ]
                    }

                    def Preliminary_Action "Group"
                    {
                        uniform token info:id = "Group"
                        uniform token type = "parallel"
                        uniform bool loops = 0
                        uniform uint performCount = 1
                        uniform token multiplePerformOperation = "ignore"
                        rel actions = [ <${S}/Behaviors/Tap${i}/Group/Hide>, <${S}/Behaviors/Tap${i}/Group/Show> ]

                        def Preliminary_Action "Hide"
                        {
                            uniform token info:id = "Visibility"
                            uniform token type = "hide"
                            rel affectedObjects = [ <${S}/${f.name}> ]
                            double duration = 0.2
                            uniform token easeType = "inout"
                            uniform token motionType = "pop"
                            uniform double moveDistance = 0
                            uniform token style = "basic"
                            uniform token multiplePerformOperation = "ignore"
                        }
                        def Preliminary_Action "Show"
                        {
                            uniform token info:id = "Visibility"
                            uniform token type = "show"
                            rel affectedObjects = [ <${S}/${next.name}> ]
                            double duration = 0.25
                            uniform token easeType = "inout"
                            uniform token motionType = "pop"
                            uniform double moveDistance = 0
                            uniform token style = "basic"
                            uniform token multiplePerformOperation = "ignore"
                        }
                    }
                }`; }).join('')}
            }`;
}

// ---------- boucle ----------
let n = 0;
for (const w of cat.works) {
  const jpg = fs.readFileSync(path.join(SITE, w.image));
  const formats = w.sizes.map((s, i) => ({ p: buildPainting(s.w, s.h), name: `Format${i}`, size: s }));
  const labels = w.sizes.map(s => fs.readFileSync(path.join(SITE, s.label_img)));
  w.sizes.forEach((s, i) => {
    const base = `${w.slug}-${s.slug}`;
    const usda = Buffer.from(buildUSDA(formats, i, w.title, USDZ_ORIENTATION, buildBehaviors(formats, i)), 'utf8');
    const files = [{ name: 'model.usda', data: usda }, { name: 'textures/canvas.jpg', data: jpg }];
    labels.forEach((l, k) => files.push({ name: `textures/label${k}.jpg`, data: l }));
    fs.writeFileSync(path.join(OUT, base + '.usdz'), usdzZip(files));
    fs.writeFileSync(path.join(OUT, base + '.glb'), buildGLB(formats[i].p, jpg));
    s.usdz = `models/${base}.usdz`; s.glb = `models/${base}.glb`;
    s.outer_cm = { w: +(formats[i].p.outer.w * 100).toFixed(1), h: +(formats[i].p.outer.h * 100).toFixed(1), d: +(formats[i].p.outer.d * 100).toFixed(1) };
    n++;
  });
}
for (const w of cat.works) { delete w.crop_note; delete w.image_px; delete w.technique; }
fs.writeFileSync(path.join(SITE, 'catalogue.json'), JSON.stringify(cat, null, 1));
console.log(`${n} modèles générés (usdz + glb), orientation USDZ = ${USDZ_ORIENTATION}`);
