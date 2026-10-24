// Rendu du GLB avec three.js dans Chromium (éclairage intérieur doux + lumière latérale), plusieurs angles.
// Usage : node render.mjs <glb relatif à site/> <out.png> [angle: front|three-quarter|corner|corner2]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [,, glb, out, angle = 'three-quarter'] = process.argv;
const WALL = process.env.WALL || '#c9cdc9'; const [RW, RH] = (process.env.SIZE || '1200x1600').split('x').map(Number);
const three = fs.readFileSync('node_modules/three/build/three.module.js', 'utf8');
const html = `<!doctype html><html><body style="margin:0;background:#dfe0dc">
<script type="importmap">{"imports":{"three":"./three.module.js","three/addons/":"./jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const W = ${RW}, H = ${RH};
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('${WALL}');
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// mur
const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: '${WALL}', roughness: 0.95 }));
wall.position.z = -0.0005; wall.receiveShadow = true; scene.add(wall);
// lumière : fenêtre à gauche + ambiance
const sun = new THREE.DirectionalLight('#fff4e6', 1.1); sun.position.set(-2.5, 2.2, 2.5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.002;
Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.1, far: 10 });
scene.add(sun);
scene.add(new THREE.HemisphereLight('#e8ecf5', '#8a8070', 0.35));
const loader = new GLTFLoader();
loader.load('${glb}', g => {
  g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g.scene);
  const box = new THREE.Box3().setFromObject(g.scene); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(40, W / H, 0.01, 20);
  const a = '${angle}';
  if (a === 'room') { cam.position.set(c.x + 0.28, c.y - 0.22, 1.55); cam.lookAt(c.x + 0.02, c.y - 0.04, 0); cam.fov = 38; cam.updateProjectionMatrix(); }
  else if (a === 'front') { cam.position.set(c.x, c.y, size.y * 1.9); cam.lookAt(c.x, c.y, 0); }
  else if (a === 'three-quarter') { cam.position.set(c.x - size.x * 1.2, c.y + size.y * 0.15, size.y * 1.3); cam.lookAt(c.x, c.y, 0.02); }
  else if (a === 'corner') { const x = box.max.x, y = box.min.y; cam.position.set(x + 0.10, y - 0.06, 0.22); cam.lookAt(x - 0.05, y + 0.06, 0.02); cam.fov = 45; cam.updateProjectionMatrix(); }
  else if (a === 'corner2') { const x = box.min.x, y = box.max.y; cam.position.set(x - 0.12, y + 0.04, 0.20); cam.lookAt(x + 0.06, y - 0.07, 0.02); cam.fov = 45; cam.updateProjectionMatrix(); }
  renderer.render(scene, cam);
  window.__done = true;
}, undefined, e => { window.__err = String(e); });
</script></body></html>`;
const dir = path.resolve('render-tmp'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), html);
fs.writeFileSync(path.join(dir, 'three.module.js'), three);
fs.copyFileSync('node_modules/three/build/three.core.js', path.join(dir, 'three.core.js'));
fs.cpSync('node_modules/three/examples/jsm', path.join(dir, 'jsm'), { recursive: true });
fs.mkdirSync(path.join(dir, path.dirname(glb)), { recursive: true });
fs.copyFileSync(path.resolve('../site', glb), path.join(dir, glb));
const { createServer } = await import('node:http');
const srv = createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p)) { console.error('404', req.url); res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(8799);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: RW, height: RH } });
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto('http://localhost:8799/');
await page.waitForFunction(() => window.__done || window.__err, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__err); if (err) console.error('erreur', err);
await page.screenshot({ path: out });
await browser.close(); srv.close();
console.log('rendu', out);
