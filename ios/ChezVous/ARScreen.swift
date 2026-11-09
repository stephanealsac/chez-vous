import SwiftUI
import RealityKit
import ARKit

// Réalité augmentée native : l'œuvre s'accroche au premier mur détecté, à taille réelle.
// Glisser d'un doigt → déplacer sur le mur (sans jamais le quitter). Formats : boutons en bas. Pas de toucher sur le tableau.
struct ARScreen: View {
    let work: Work
    @Binding var size: WorkSize
    @StateObject private var ctl = ARController()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            if ARWorldTrackingConfiguration.isSupported {
                ARViewContainer(ctl: ctl).ignoresSafeArea()
            } else {
                Theme.bg.ignoresSafeArea()
                Text(L("La réalité augmentée n'est pas disponible sur cet appareil.", "Augmented reality isn't available on this device."))
                    .font(Theme.serif(22)).multilineTextAlignment(.center).padding(40)
            }
            if ctl.state == .searching && ctl.floorMode && ctl.floorFound {
                // croix de visée : à poser sur le pied du mur
                ZStack {
                    Circle().stroke(Theme.bg, lineWidth: 4).frame(width: 34, height: 34)
                    Circle().stroke(Theme.ink, lineWidth: 1.5).frame(width: 34, height: 34)
                    Rectangle().fill(Theme.ink).frame(width: 70, height: 1.5)
                }.shadow(color: Theme.bg, radius: 2).allowsHitTesting(false).ignoresSafeArea()
            }
            VStack(spacing: 0) {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 17, weight: .medium))
                            .foregroundStyle(Theme.ink).frame(width: 44, height: 44)
                            .background(Circle().fill(Theme.bg.opacity(0.92)))
                    }.accessibilityLabel(L("Fermer", "Close"))
                    Spacer()
                    if ctl.state == .placed {
                        Button { ctl.restart() } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.counterclockwise").font(.system(size: 14, weight: .medium))
                                Caps(text: L("Replacer", "Re-place"), size: 10, tracking: 2.0)
                            }
                            .foregroundStyle(Theme.ink).padding(.horizontal, 14).frame(height: 44)
                            .background(Capsule().fill(Theme.bg.opacity(0.92)))
                        }.buttonStyle(.plain).transition(.opacity)
                    }
                }.padding(.horizontal, 16).padding(.top, 8)
                Text(hint).font(Theme.serif(30)).foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center).padding(.horizontal, 28).padding(.top, 10)
                    .shadow(color: Theme.bg.opacity(0.95), radius: 10).shadow(color: Theme.bg.opacity(0.8), radius: 20)
                    .animation(.easeInOut(duration: 0.3), value: hint)
                if ctl.state == .placed {
                    Text(ctl.isManual
                         ? L("Visez votre mur : le tableau s'y accrochera dès qu'il sera reconnu.", "Aim at your wall: the piece will hang on it as soon as it is recognized.")
                         : L("L'œuvre apparaît aux dimensions exactes du tableau.\nGlissez-la d'un doigt pour la déplacer.", "The piece appears at the exact size of the real artwork.\nSlide it with one finger to move it."))
                        .font(Theme.serif(18)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)
                        .padding(.horizontal, 28).padding(.top, 4)
                        .shadow(color: Theme.bg.opacity(0.95), radius: 8).shadow(color: Theme.bg.opacity(0.8), radius: 16)
                        .transition(.opacity)
                }
                Spacer()
                VStack(spacing: 12) {
                    if ctl.state == .searching && ctl.floorMode && ctl.floorFound {
                        Button { ctl.placeAtWallFoot() } label: {
                            Caps(text: L("Accrocher ici", "Hang it here"), size: 11, tracking: 2.2, color: Theme.bg)
                                .padding(.horizontal, 26).frame(height: 50).background(Theme.ink)
                        }.buttonStyle(.plain).transition(.opacity)
                    }
                    if ctl.state == .searching && ctl.offerManual {
                        Button { ctl.placeInFront() } label: {
                            Caps(text: L("Mur non trouvé ? Poser devant moi", "No wall found? Place it in front of me"), size: 10, tracking: 2.0, color: Theme.bg)
                                .padding(.horizontal, 18).frame(height: 46).background(Theme.ink)
                        }.buttonStyle(.plain).transition(.opacity)
                    }
                    if work.sizes.count > 1 {
                        HStack(spacing: 8) {
                            ForEach(work.sizes) { s in
                                Button { if s != size { Suivi.envoyer(.format, work, s) }; size = s } label: {
                                    VStack(spacing: 2) {
                                        Text(s.displayLabel).font(Theme.serif(19))
                                        Text(s.canvasText).font(Theme.sans(11))
                                    }
                                    .foregroundStyle(s == size ? Theme.bg : Theme.ink)
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(s == size ? Theme.ink : Theme.bg.opacity(0.92))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    Button { Suivi.envoyer(.achat, work, size); if let u = work.shopURL { openURL(u) } } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(work.displayTitle).font(Theme.serif(21)).foregroundStyle(Theme.ink)
                                Text("\(size.displayLabel) · \(size.canvasText)\(size.framedPrice.map { " · " + Fmt.price($0) } ?? "")")
                                    .font(Theme.sans(12)).foregroundStyle(Theme.inkSoft)
                            }
                            Spacer()
                            Caps(text: L("Acquérir", "Buy"), size: 10, tracking: 2.2, color: Theme.bg)
                                .padding(.horizontal, 16).frame(height: 40).background(Theme.ink)
                        }
                        .padding(.leading, 18).padding(.trailing, 10).padding(.vertical, 10)
                        .background(Theme.bg.opacity(0.95))
                    }.buttonStyle(.plain)
                }.padding(.horizontal, 16).padding(.bottom, 16)
            }
        }
        .statusBarHidden()
        .onAppear { ctl.show(size) }
        .onChange(of: size) { _, s in ctl.show(s) }
        .onDisappear { ctl.stop() }
    }

    private var hint: String {
        switch ctl.state {
        case .searching:
            if ctl.floorMode {
                return ctl.floorFound
                    ? L("Posez la ligne sur le pied du mur, là où il touche le sol", "Line up the mark with the foot of the wall, where it meets the floor")
                    : (ARController.hasLiDAR ? L("Mur trop uni ? Visez le sol devant le mur", "Wall too plain? Aim at the floor in front of it")
                                             : L("Visez le sol, au pied du mur", "Aim at the floor, at the foot of the wall"))
            }
            return L("À moins de 3 m du mur, balayez-le lentement", "Within 10 feet of the wall, sweep it slowly")
        case .placed: return L("Taille réelle", "Actual size")
        }
    }
}

struct ARViewContainer: UIViewRepresentable {
    let ctl: ARController
    func makeUIView(context: Context) -> ARView { ctl.makeView() }
    func updateUIView(_ uiView: ARView, context: Context) {}
}

@MainActor
final class ARController: NSObject, ObservableObject {
    enum State { case searching, placed }
    @Published var state: State = .searching
    @Published var offerManual = false          // après un long moment sans mur : proposer la pose manuelle
    @Published var isManual = false             // œuvre posée « devant moi » en attendant le vrai mur
    @Published var floorMode = false            // mur uni pas reconnu : on passe par le sol (pied du mur)
    @Published var floorFound = false
    /// mur « virtuel » : provisoire (« devant moi », distance devinée) ou exact (posé au pied du mur grâce au sol)
    private var manualPlane: (point: SIMD3<Float>, normal: SIMD3<Float>, exact: Bool)? { didSet { isManual = manualPlane.map { !$0.exact } ?? false } }
    /// Sans LiDAR, un mur uni et blanc est souvent impossible à reconnaître : on propose vite la visée du pied du mur,
    /// le sol (parquet, carrelage, tapis) étant presque toujours reconnu, lui.
    /// Deux expériences : avec LiDAR (iPhone Pro), le mur est reconnu tout de suite, même uni : tout est automatique.
    /// Sans LiDAR, on guide d'emblée par le pied du mur (le mur reste reconnu automatiquement s'il a assez de relief).
    static let hasLiDAR = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
    static let floorDelay: TimeInterval = hasLiDAR ? 10 : 0
    static let manualDelay: TimeInterval = hasLiDAR ? 20 : 25   // dernier recours si même le sol n'est pas trouvé
    private var floorY: Float?
    private var searchStart = Date()

    private var arView: ARView?
    private var anchor: AnchorEntity?
    private var painting: Entity?
    private var wanted: WorkSize?
    private var cache: [String: Entity] = [:]
    private var searchTimer: Timer?

    func makeView() -> ARView {
        let v = ARView(frame: .zero)
        let cfg = ARWorldTrackingConfiguration()
        cfg.planeDetection = [.vertical, .horizontal]   // le sol sert de repère quand le mur est trop uni
        cfg.environmentTexturing = .automatic
        v.session.run(cfg)
        let coach = ARCoachingOverlayView()
        coach.session = v.session; coach.goal = .tracking; coach.activatesAutomatically = true
        coach.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(coach)
        NSLayoutConstraint.activate([coach.topAnchor.constraint(equalTo: v.topAnchor), coach.bottomAnchor.constraint(equalTo: v.bottomAnchor),
                                     coach.leadingAnchor.constraint(equalTo: v.leadingAnchor), coach.trailingAnchor.constraint(equalTo: v.trailingAnchor)])
        v.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(pan(_:))))
        arView = v
        searchStart = Date()
        // tant que l'œuvre n'est pas posée : on vise le centre de l'écran et on accroche au premier mur trouvé
        searchTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tryAutoPlace() }
        }
        return v
    }

    /// Pose le tableau droit, face à soi, à 1,5 m, à hauteur des yeux — sans attendre la détection du mur.
    func placeInFront() {
        guard let v = arView, let cam = v.session.currentFrame?.camera.transform else { return }
        let pos = SIMD3<Float>(cam.columns.3.x, cam.columns.3.y, cam.columns.3.z)
        var fwd = -SIMD3<Float>(cam.columns.2.x, 0, cam.columns.2.z)
        if simd_length(fwd) < 1e-3 { fwd = SIMD3<Float>(0, 0, -1) }
        fwd = simd_normalize(fwd)
        let point = pos + fwd * 1.5 - SIMD3<Float>(0, 0.05, 0), normal = -fwd
        manualPlane = (point, normal, false)
        place(normal: normal, position: point)
    }

    /// Pied du mur visé avec la croix : le point du sol sous la croix donne la vraie distance du mur,
    /// donc la vraie taille ; le tableau est accroché à hauteur habituelle, face à soi.
    func placeAtWallFoot() {
        guard let v = arView, let fy = floorY, let cam = v.session.currentFrame?.camera.transform,
              let ray = v.ray(through: CGPoint(x: v.bounds.midX, y: v.bounds.midY)), ray.direction.y < -0.03 else { return }
        let t = (fy - ray.origin.y) / ray.direction.y
        guard t > 0.3, t < 6 else { return }
        let foot = ray.origin + ray.direction * t
        let camPos = SIMD3<Float>(cam.columns.3.x, cam.columns.3.y, cam.columns.3.z)
        var n = camPos - foot; n.y = 0
        guard simd_length(n) > 0.3 else { return }
        n = simd_normalize(n)
        let point = SIMD3<Float>(foot.x, fy + hangHeight, foot.z) + n * 0.01
        manualPlane = (point, n, true)
        place(normal: n, position: point)
    }

    func stop() { searchTimer?.invalidate(); searchTimer = nil; arView?.session.pause() }

    /// « Replacer » : on retire l'œuvre et on recherche le mur, comme à l'ouverture.
    func restart() {
        anchor?.removeFromParent(); anchor = nil; painting = nil
        manualPlane = nil; offerManual = false; floorMode = false; searchStart = Date()
        state = .searching
        UISelectionFeedbackGenerator().selectionChanged()
    }

    func show(_ s: WorkSize) {
        wanted = s
        guard let anchor else { return }
        painting?.removeFromParent()
        if let e = entity(for: s) { anchor.addChild(e); painting = e }
    }

    private func entity(for s: WorkSize) -> Entity? {
        if let e = cache[s.usdz] { return e }
        guard let url = s.modelURL, let loaded = try? Entity.load(contentsOf: url) else { return nil }
        let root = Entity()
        for c in Array(loaded.children) { root.addChild(c) }    // ignore l'ancrage décrit dans le fichier, on ancre nous-mêmes
        root.generateCollisionShapes(recursive: true)
        cache[s.usdz] = root
        return root
    }

    /// Mur réellement détecté sous ce point de l'écran (pas son prolongement imaginaire au milieu de la pièce),
    /// et assez grand pour être un mur (pas un abat-jour, un écran ou un pied de meuble).
    private func wallHit(_ p: CGPoint) -> ARRaycastResult? {
        guard let v = arView else { return nil }
        for r in v.raycast(from: p, allowing: .existingPlaneGeometry, alignment: .vertical) {
            if let plane = r.anchor as? ARPlaneAnchor, plane.classification == .window || plane.classification == .door { continue }
            if let plane = r.anchor as? ARPlaneAnchor, plane.planeExtent.width < 0.35 || plane.planeExtent.height < 0.35 { continue }
            if let plane = r.anchor as? ARPlaneAnchor, [.table, .seat, .floor, .ceiling].contains(plane.classification) { continue }
            // surface vue très en biais (côté d'un meuble, montant de porte) : ce n'est pas le mur qu'on vise
            if let cam = v.session.currentFrame?.camera.transform {
                let m = r.worldTransform
                var n = SIMD3<Float>(m.columns.1.x, 0, m.columns.1.z)
                var toCam = SIMD3<Float>(cam.columns.3.x - m.columns.3.x, 0, cam.columns.3.z - m.columns.3.z)
                if simd_length(n) > 1e-3, simd_length(toCam) > 1e-3 {
                    n = simd_normalize(n); toCam = simd_normalize(toCam)
                    if abs(simd_dot(n, toCam)) < 0.5 { continue }      // plus de 60° de biais
                }
            }
            return r
        }
        return nil
    }

    /// Repère du tableau : Y = normale du mur (vers soi), −Z = haut du tableau (vers le plafond), X = droite.
    private func wallTransform(_ r: ARRaycastResult) -> Transform {
        let m = r.worldTransform
        return wallTransform(normal: SIMD3<Float>(m.columns.1.x, m.columns.1.y, m.columns.1.z), position: SIMD3<Float>(m.columns.3.x, m.columns.3.y, m.columns.3.z))
    }
    private func wallTransform(normal: SIMD3<Float>, position: SIMD3<Float>) -> Transform {
        var n = normal; n.y = 0                      // un mur est vertical : on ignore l'inclinaison estimée
        n = simd_length(n) < 1e-3 ? SIMD3<Float>(0, 0, 1) : simd_normalize(n)
        // sécurité : l'œuvre est toujours tournée vers soi (évite de la voir de dos sur une fausse détection)
        if let cam = arView?.session.currentFrame?.camera.transform {
            let toCam = SIMD3<Float>(cam.columns.3.x, cam.columns.3.y, cam.columns.3.z) - position
            if simd_dot(SIMD3<Float>(toCam.x, 0, toCam.z), n) < 0 { n = -n }
        }
        let up = SIMD3<Float>(0, 1, 0)
        var down = -(up - simd_dot(up, n) * n)
        if simd_length(down) < 1e-3 { down = SIMD3<Float>(0, 0, 1) }
        let z = simd_normalize(down), x = simd_normalize(simd_cross(n, z))
        let rot = simd_quatf(simd_float3x3(columns: (x, n, z)))
        return Transform(scale: .one, rotation: rot, translation: position)
    }

    private func place(at r: ARRaycastResult) {
        if let cam = arView?.session.currentFrame?.camera.transform {
            let p = r.worldTransform.columns.3, c = cam.columns.3
            if simd_distance(SIMD3<Float>(p.x, p.y, p.z), SIMD3<Float>(c.x, c.y, c.z)) > 4 { return }   // trop loin : sans doute une fausse détection
        }
        manualPlane = nil
        // à hauteur d'accrochage (yeux), quel que soit l'endroit du mur visé : on vise souvent trop bas
        var tf = wallTransform(r)
        tf.translation.y = hangY()
        setAnchor(tf)
    }
    /// Centre du tableau à 1,50 m du sol (un peu plus haut pour les très grands formats, bas à 60 cm minimum).
    private var hangHeight: Float {
        let h = Float((wanted?.framed_cm ?? wanted?.outer_cm)?.h ?? 80) / 100
        return max(1.5, h / 2 + 0.6)
    }
    /// Hauteur du centre en coordonnées du monde : depuis le sol s'il est connu, sinon hauteur du téléphone (≈ yeux).
    private func hangY() -> Float {
        updateFloor()
        let camY = (arView?.session.currentFrame?.camera.transform.columns.3.y ?? 0) - 0.05
        // garde-fou : une table basse prise pour le sol donnerait un tableau trop haut
        if let fy = floorY, abs(fy + hangHeight - camY) < 0.7 { return fy + hangHeight }
        return camY
    }
    private func place(normal: SIMD3<Float>, position: SIMD3<Float>) { setAnchor(wallTransform(normal: normal, position: position)) }
    private func setAnchor(_ tf: Transform) {
        guard let v = arView else { return }
        if anchor == nil {
            let a = AnchorEntity(world: .zero)
            v.scene.addAnchor(a); anchor = a
            if let s = wanted { show(s) }
        }
        anchor?.transform = tf
        if state != .placed { state = .placed; UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    }

    private func tryAutoPlace() {
        guard let v = arView, panPlane == nil else { return }
        let c = CGPoint(x: v.bounds.midX, y: v.bounds.midY)
        switch state {
        case .searching:
            updateFloor()
            let t = Date().timeIntervalSince(searchStart)
            if !floorMode && t > Self.floorDelay { floorMode = true }
            if !offerManual && t > Self.manualDelay && !floorFound { offerManual = true }
            if let r = wallHit(c) { place(at: r) }
        case .placed:
            guard let mp = manualPlane, let r = wallHit(c) else { return }
            if mp.exact {
                // posé au pied du mur : on ne bascule que sur ce même mur, reconnu entre-temps (jamais vers un autre)
                let m = r.worldTransform
                let p = SIMD3<Float>(m.columns.3.x, m.columns.3.y, m.columns.3.z)
                var n = SIMD3<Float>(m.columns.1.x, 0, m.columns.1.z)
                guard simd_length(n) > 1e-3 else { return }
                n = simd_normalize(n)
                guard abs(simd_dot(p - mp.point, mp.normal)) < 0.25, abs(simd_dot(n, mp.normal)) > 0.94 else { return }
                // même mur : on garde la hauteur et l'emplacement choisis, on corrige seulement la profondeur et l'angle
                let a = anchor?.transformMatrix(relativeTo: nil)
                let cur = a.map { SIMD3<Float>($0.columns.3.x, $0.columns.3.y, $0.columns.3.z) } ?? mp.point
                let onWall = cur - simd_dot(cur - p, n) * n
                manualPlane = nil
                place(normal: n, position: onWall)
            } else {
                // posée « devant moi » : dès qu'un vrai mur est reconnu au centre de l'écran, l'œuvre s'y accroche
                place(at: r); UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        }
    }

    /// Sol : le plan horizontal le plus bas, nettement sous le téléphone (pas une table ni un lit).
    private func updateFloor() {
        guard let f = arView?.session.currentFrame else { return }
        let camY = f.camera.transform.columns.3.y
        var best: Float?
        for case let p as ARPlaneAnchor in f.anchors where p.alignment == .horizontal {
            if [.table, .seat, .ceiling].contains(p.classification) { continue }
            let y = p.transform.columns.3.y
            if y < camY - 0.7, best == nil || y < best! { best = y }
        }
        if let b = best { floorY = b; if !floorFound { floorFound = true } }
    }

    /// Glisser d'un doigt : le tableau reste sur le plan du mur où il est accroché (jamais de saut vers une fenêtre,
    /// une porte ou un autre mur, jamais dans le vide). Orientation inchangée pendant le geste.
    private var panPlane: (point: SIMD3<Float>, normal: SIMD3<Float>, rotation: simd_quatf, offset: SIMD3<Float>)?
    @objc private func pan(_ g: UIPanGestureRecognizer) {
        guard state == .placed, let v = arView, let a = anchor else { return }
        switch g.state {
        case .began:
            let m = a.transformMatrix(relativeTo: nil)
            let n = simd_normalize(SIMD3<Float>(m.columns.1.x, m.columns.1.y, m.columns.1.z))
            let c = SIMD3<Float>(m.columns.3.x, m.columns.3.y, m.columns.3.z)
            // décalage doigt → centre : le tableau suit le doigt sans sauter sous lui au début du geste
            let start = wallPoint(v, g.location(in: v), point: c, normal: n) ?? c
            panPlane = (c, n, a.orientation(relativeTo: nil), c - start)
        case .changed:
            guard let pl = panPlane, let p = wallPoint(v, g.location(in: v), point: pl.point, normal: pl.normal) else { return }
            a.transform = Transform(scale: .one, rotation: pl.rotation, translation: p + pl.offset)
        default:
            panPlane = nil
        }
    }
    /// Point du plan du mur sous le doigt ; nil si le rayon est presque parallèle au mur, derrière soi ou trop loin.
    private func wallPoint(_ v: ARView, _ s: CGPoint, point: SIMD3<Float>, normal: SIMD3<Float>) -> SIMD3<Float>? {
        guard let ray = v.ray(through: s) else { return nil }
        let d = simd_dot(ray.direction, normal)
        guard abs(d) > 0.05 else { return nil }
        let t = simd_dot(point - ray.origin, normal) / d
        guard t > 0.2, t < 6 else { return nil }
        return ray.origin + ray.direction * t
    }

}
