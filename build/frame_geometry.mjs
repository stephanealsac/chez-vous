// Géométrie de la caisse américaine, d'après les photos et cotes de l'atelier.
// Repère "debout" : X droite, Y haut, Z vers le spectateur ; dos du cadre contre le mur en z = 0.
//
// Profil (coupe d'une baguette, u = enfoncement depuis l'arête extérieure, z = profondeur) :
//   paroi extérieure (épaisseur = lèvre avant 1,8 cm, profondeur 4 cm), arêtes avant arrondies,
//   face intérieure de la lèvre jusqu'au fond du caisson, fond du caisson jusqu'à la toile.
//   La toile (châssis 2 cm) est posée au fond, sa face à ~1 cm en retrait de l'arête.

export const FRAME = {
  lip_cm: 1.8,        // largeur de l'arête avant
  add_cm: 4.3,        // ce que le cadre ajoute par côté (lèvre + jour)
  depth_cm: 4.0,      // profondeur totale (mur → arête)
  floor_cm: 1.3,      // hauteur du fond du caisson : 4 − 2,7 de profondeur intérieure
  canvas_depth_cm: 2.3, // châssis 2 cm + toile ; face à 0,4 cm en retrait de l'arête
  canvas_round_cm: 0.25, // arête avant du châssis arrondie : l'image tourne sur l'arrondi
  fillet_outer_cm: 0.15,
  fillet_inner_cm: 0.10,
};

function emptyMesh() { return { P: [], N: [], T: [], I: [] }; }
function addQuad(m, a, b, c, d, na, nb, nc, nd, uvs) {
  const base = m.P.length / 3;
  for (const [p, n] of [[a, na], [b, nb], [c, nc], [d, nd]]) { m.P.push(...p); m.N.push(...n); }
  if (uvs) m.T.push(...uvs); else m.T.push(0, 0, 0, 0, 0, 0, 0, 0);
  // orientation : on veut (b-a)×(c-a) dans le sens de la normale moyenne
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const nm = [na[0] + nb[0] + nc[0] + nd[0], na[1] + nb[1] + nc[1] + nd[1], na[2] + nb[2] + nc[2] + nd[2]];
  const dot = cr[0] * nm[0] + cr[1] * nm[1] + cr[2] * nm[2];
  if (dot >= 0) m.I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  else m.I.push(base, base + 2, base + 1, base, base + 3, base + 2);
}
export function merge(...ms) {
  const o = emptyMesh();
  for (const m of ms) { const off = o.P.length / 3; o.P.push(...m.P); o.N.push(...m.N); o.T.push(...m.T); o.I.push(...m.I.map(i => i + off)); }
  return o;
}

/** Profil de la baguette : liste de {u, z, n:[nu,nz]} (normale 2D, nu > 0 = vers le centre du tableau). */
function profile(F) {
  const cm = 0.01;
  const lip = F.lip_cm * cm, D = F.depth_cm * cm, r1 = F.fillet_outer_cm * cm, r2 = F.fillet_inner_cm * cm;
  const floor = F.floor_cm * cm, gap = (F.add_cm - F.lip_cm) * cm;
  const pts = [];
  const seg = (u, z, n) => pts.push({ u, z, n });
  // paroi extérieure (normale vers l'extérieur = -u), arête sèche au dos
  seg(0, 0, [-1, 0]); seg(0, D - r1, [-1, 0]);
  // congé extérieur : centre (r1, D - r1), de 180° à 90°
  const K = 4;
  for (let k = 1; k < K; k++) { const a = Math.PI - (Math.PI / 2) * (k / K); seg(r1 + r1 * Math.cos(a), D - r1 + r1 * Math.sin(a), [Math.cos(a), Math.sin(a)]); }
  // lèvre avant (normale +z)
  seg(r1, D, [0, 1]); seg(lip - r2, D, [0, 1]);
  // congé intérieur : centre (lip - r2, D - r2), de 90° à 0°
  for (let k = 1; k < K; k++) { const a = (Math.PI / 2) * (1 - k / K); seg(lip - r2 + r2 * Math.cos(a), D - r2 + r2 * Math.sin(a), [Math.cos(a), Math.sin(a)]); }
  // face intérieure de la lèvre (normale +u = vers le centre), jusqu'au fond
  seg(lip, D - r2, [1, 0]); seg(lip, floor, [1, 0]);
  // fond du caisson (normale +z) jusqu'au bord de la toile
  seg(lip, floor, [0, 1]); seg(lip + gap, floor, [0, 1]);
  return pts;
}

/**
 * Balaye le profil autour du rectangle extérieur (demi-dimensions ox, oy) ; les onglets sont implicites.
 * Retourne {frame, floor} : le fond du caisson est un maillage séparé (texture d'occlusion).
 */
function sweep(pts, ox, oy, floorIdx) {
  const frame = emptyMesh(), floor = emptyMesh();
  // côtés : [direction "vers le centre" en 3D, fonction (u,z) -> segment 3D (deux points extrêmes)]
  const sides = [
    { inward: [0, -1, 0], ends: u => [[-(ox - u), oy - u], [ox - u, oy - u]] },      // haut
    { inward: [0, 1, 0], ends: u => [[ox - u, -(oy - u)], [-(ox - u), -(oy - u)]] },  // bas
    { inward: [1, 0, 0], ends: u => [[-(ox - u), -(oy - u)], [-(ox - u), oy - u]] },  // gauche
    { inward: [-1, 0, 0], ends: u => [[ox - u, oy - u], [ox - u, -(oy - u)]] },       // droite
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a.u === b.u && a.z === b.z) continue; // changement de normale à un angle vif
    const target = i >= floorIdx ? floor : frame;
    for (const s of sides) {
      const [a0, a1] = s.ends(a.u), [b0, b1] = s.ends(b.u);
      const n3 = n => [s.inward[0] * n[0], s.inward[1] * n[0], n[1]];
      const P = (xy, z) => [xy[0], xy[1], z];
      let uvs = null;
      if (target === floor) { // uv du fond : position relative dans le rectangle intérieur (pour l'occlusion)
        const ix = ox - pts[floorIdx].u, iy = oy - pts[floorIdx].u;
        const uv = xy => [(xy[0] + ix) / (2 * ix), 1 - (xy[1] + iy) / (2 * iy)];
        uvs = [...uv(a0), ...uv(a1), ...uv(b1), ...uv(b0)];
      }
      addQuad(target, P(a0, a.z), P(a1, a.z), P(b1, b.z), P(b0, b.z), n3(a.n), n3(a.n), n3(b.n), n3(b.n), uvs);
    }
  }
  return { frame, floor };
}

/** Tableau encadré pour une toile de w×h cm. Tous les maillages en mètres, repère debout. */
export function buildPainting(wcm, hcm, F = FRAME) {
  const cm = 0.01;
  const w = wcm * cm, h = hcm * cm;
  const add = F.add_cm * cm, D = F.depth_cm * cm, floorZ = F.floor_cm * cm, cd = F.canvas_depth_cm * cm;
  const ox = w / 2 + add, oy = h / 2 + add;
  const pts = profile(F);
  const floorIdx = pts.findIndex((p, i) => i > 0 && p.z === floorZ && pts[i - 1].z === floorZ && p.n[1] === 1) - 1;
  const { frame, floor } = sweep(pts, ox, oy, floorIdx);
  // dos (contre le mur)
  const back = emptyMesh();
  addQuad(back, [-ox, -oy, 0], [ox, -oy, 0], [ox, oy, 0], [-ox, oy, 0], [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]);
  // toile : châssis à arête avant arrondie (rayon rc) ; l'image tourne sur l'arrondi, le galon couvre le chant vertical.
  const z0 = floorZ, z1 = floorZ + cd, rc = (F.canvas_round_cm || 0.4) * cm;
  const imgUV = p => [(p[0] + w / 2) / w, 1 - (p[1] + h / 2) / h];                 // image étalée sur toute la largeur/hauteur
  const grainUV = p => [(p[0] + w / 2) * 100, (h / 2 - p[1]) * 100];               // grain : 1 tuile / cm
  // face plane (en retrait de rc sur chaque bord)
  const front = emptyMesh(); front.T2 = []; front.TAN = [];
  const fq = [[-w / 2 + rc, -h / 2 + rc, z1], [w / 2 - rc, -h / 2 + rc, z1], [w / 2 - rc, h / 2 - rc, z1], [-w / 2 + rc, h / 2 - rc, z1]];
  addQuad(front, ...fq, [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], fq.flatMap(imgUV));
  for (const q of fq) { front.T2.push(...grainUV(q)); front.TAN.push(1, 0, 0, 1); }
  // congé : balayé autour du rectangle de la toile, K segments, normales radiales
  const K = 4;
  const ring = [];
  for (let k = 0; k <= K; k++) { const a = (Math.PI / 2) * (k / K); ring.push({ u: rc - rc * Math.cos(a), z: z1 - rc + rc * Math.sin(a), n: [-Math.cos(a), Math.sin(a)] }); }
  // (u = enfoncement depuis le bord extérieur de la toile ; n = [composante vers l'extérieur (-u) ... ] ; on réutilise sweep avec inward)
  const csides = [
    { inward: [0, -1, 0], ends: u => [[-(w / 2 - u), h / 2 - u], [w / 2 - u, h / 2 - u]], tan: [1, 0] },
    { inward: [0, 1, 0], ends: u => [[w / 2 - u, -(h / 2 - u)], [-(w / 2 - u), -(h / 2 - u)]], tan: [1, 0] },
    { inward: [1, 0, 0], ends: u => [[-(w / 2 - u), -(h / 2 - u)], [-(w / 2 - u), h / 2 - u]], tan: [0, 1] },
    { inward: [-1, 0, 0], ends: u => [[w / 2 - u, h / 2 - u], [w / 2 - u, -(h / 2 - u)]], tan: [0, 1] },
  ];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    for (const sd of csides) {
      const [a0, a1] = sd.ends(a.u), [b0, b1] = sd.ends(b.u);
      // n2d = (-cos a) vers l'extérieur du rectangle = -inward ; (sin a) vers +z
      const n3 = n => [-sd.inward[0] * (-n[0]), -sd.inward[1] * (-n[0]), n[1]];
      const P = (xy, z) => [xy[0], xy[1], z];
      const pts4 = [P(a0, a.z), P(a1, a.z), P(b1, b.z), P(b0, b.z)];
      addQuad(front, ...pts4, n3(a.n), n3(a.n), n3(b.n), n3(b.n), pts4.flatMap(imgUV));
      for (const q of pts4) { front.T2.push(...grainUV(q)); front.TAN.push(sd.tan[0], sd.tan[1], 0, 1); }
    }
  }
  // chants verticaux (galon), du fond jusqu'au départ de l'arrondi
  const sides = emptyMesh(); sides.T2 = []; sides.TAN = [];
  const zs1 = z1 - rc;
  const S = (a, b, c, d, n, tan) => {
    addQuad(sides, a, b, c, d, n, n, n, n);
    for (const p of [a, b, c, d]) { sides.T2.push(((p[0] * tan[0] + p[1] * tan[1]) + (tan[0] ? w / 2 : h / 2)) * 100, (p[2] - z0) * 100); sides.TAN.push(tan[0], tan[1], 0, 1); }
  };
  S([w / 2, -h / 2, z0], [w / 2, -h / 2, zs1], [w / 2, h / 2, zs1], [w / 2, h / 2, z0], [1, 0, 0], [0, 1]);
  S([-w / 2, -h / 2, z0], [-w / 2, h / 2, z0], [-w / 2, h / 2, zs1], [-w / 2, -h / 2, zs1], [-1, 0, 0], [0, 1]);
  S([-w / 2, h / 2, z0], [w / 2, h / 2, z0], [w / 2, h / 2, zs1], [-w / 2, h / 2, zs1], [0, 1, 0], [1, 0]);
  S([-w / 2, -h / 2, z0], [-w / 2, -h / 2, zs1], [w / 2, -h / 2, zs1], [w / 2, -h / 2, z0], [0, -1, 0], [1, 0]);
  return {
    frame: merge(frame, back), floor, front, sides,
    outer: { w: 2 * ox, h: 2 * oy, d: D },
    inner: { w: 2 * (ox - F.lip_cm * cm), h: 2 * (oy - F.lip_cm * cm) },
    canvas: { w, h, z0, z1 },
  };
}
