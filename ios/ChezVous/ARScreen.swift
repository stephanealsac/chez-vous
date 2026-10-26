import SwiftUI
import RealityKit
import ARKit

// Réalité augmentée native : l'œuvre s'accroche au premier mur détecté, à taille réelle.
// Toucher le tableau → format suivant ; glisser → déplacer sur le mur ; toucher ailleurs sur le mur → l'y placer.
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
                Text("La réalité augmentée n'est pas disponible sur cet appareil.")
                    .font(Theme.serif(22)).multilineTextAlignment(.center).padding(40)
            }
            VStack(spacing: 0) {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 17, weight: .medium))
                            .foregroundStyle(Theme.ink).frame(width: 44, height: 44)
                            .background(Circle().fill(Theme.bg.opacity(0.92)))
                    }.accessibilityLabel("Fermer")
                    Spacer()
                }.padding(.horizontal, 16).padding(.top, 8)
                Text(hint).font(Theme.serif(30)).foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center).padding(.horizontal, 28).padding(.top, 10)
                    .shadow(color: Theme.bg.opacity(0.95), radius: 10).shadow(color: Theme.bg.opacity(0.8), radius: 20)
                    .animation(.easeInOut(duration: 0.3), value: hint)
                Spacer()
                VStack(spacing: 12) {
                    if ctl.state == .searching && ctl.offerManual {
                        Button { ctl.placeInFront() } label: {
                            Caps(text: "Mur non trouvé ? Poser devant moi", size: 10, tracking: 2.0, color: Theme.bg)
                                .padding(.horizontal, 18).frame(height: 46).background(Theme.ink)
                        }.buttonStyle(.plain).transition(.opacity)
                    }
                    if work.sizes.count > 1 {
                        HStack(spacing: 8) {
                            ForEach(work.sizes) { s in
                                Button { size = s } label: {
                                    VStack(spacing: 2) {
                                        Text(s.label).font(Theme.serif(19))
                                        Text(s.canvasText).font(Theme.sans(11))
                                    }
                                    .foregroundStyle(s == size ? Theme.bg : Theme.ink)
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(s == size ? Theme.ink : Theme.bg.opacity(0.92))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    Button { if let u = work.shopURL { openURL(u) } } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(work.title).font(Theme.serif(21)).foregroundStyle(Theme.ink)
                                Text("\(size.label) · \(size.canvasText)\(size.price_framed.map { " · " + Fmt.eur($0) } ?? "")")
                                    .font(Theme.sans(12)).foregroundStyle(Theme.inkSoft)
                            }
                            Spacer()
                            Caps(text: "Acquérir", size: 10, tracking: 2.2, color: Theme.bg)
                                .padding(.horizontal, 16).frame(height: 40).background(Theme.ink)
                        }
                        .padding(.leading, 18).padding(.trailing, 10).padding(.vertical, 10)
                        .background(Theme.bg.opacity(0.95))
                    }.buttonStyle(.plain)
                }.padding(.horizontal, 16).padding(.bottom, 16)
            }
        }
        .statusBarHidden()
        .onAppear { ctl.onTapPainting = { nextSize() }; ctl.show(size) }
        .onChange(of: size) { _, s in ctl.show(s) }
        .onDisappear { ctl.stop() }
    }

    private var hint: String {
        switch ctl.state {
        case .searching: return ctl.offerManual ? "Visez un mur éclairé, avec un repère" : "Balayez lentement votre mur"
        case .placed where work.sizes.count > 1: return "Touchez le tableau pour changer de format"
        case .placed: return "Glissez pour déplacer l'œuvre"
        }
    }
    private func nextSize() {
        guard let i = work.sizes.firstIndex(of: size), work.sizes.count > 1 else { return }
        size = work.sizes[(i + 1) % work.sizes.count]
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
    @Published var offerManual = false          // après quelques secondes sans mur : proposer la pose manuelle
    var onTapPainting: (() -> Void)?
    private var manualPlane: (point: SIMD3<Float>, normal: SIMD3<Float>)?   // mur « virtuel » quand aucun mur n'est détecté
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
        cfg.planeDetection = [.vertical]
        cfg.environmentTexturing = .automatic
        v.session.run(cfg)
        let coach = ARCoachingOverlayView()
        coach.session = v.session; coach.goal = .verticalPlane; coach.activatesAutomatically = true
        coach.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(coach)
        NSLayoutConstraint.activate([coach.topAnchor.constraint(equalTo: v.topAnchor), coach.bottomAnchor.constraint(equalTo: v.bottomAnchor),
                                     coach.leadingAnchor.constraint(equalTo: v.leadingAnchor), coach.trailingAnchor.constraint(equalTo: v.trailingAnchor)])
        v.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tap(_:))))
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
        manualPlane = (point, normal)
        place(normal: normal, position: point)
    }

    func stop() { searchTimer?.invalidate(); searchTimer = nil; arView?.session.pause() }

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

    private func wallHit(_ p: CGPoint, existing: Bool) -> ARRaycastResult? {
        guard let v = arView else { return nil }
        if existing, let r = v.raycast(from: p, allowing: .existingPlaneInfinite, alignment: .vertical).first { return r }
        return v.raycast(from: p, allowing: .estimatedPlane, alignment: .vertical).first
    }

    /// Repère du tableau : Y = normale du mur (vers soi), −Z = haut du tableau (vers le plafond), X = droite.
    private func wallTransform(_ r: ARRaycastResult) -> Transform {
        let m = r.worldTransform
        return wallTransform(normal: SIMD3<Float>(m.columns.1.x, m.columns.1.y, m.columns.1.z), position: SIMD3<Float>(m.columns.3.x, m.columns.3.y, m.columns.3.z))
    }
    private func wallTransform(normal: SIMD3<Float>, position: SIMD3<Float>) -> Transform {
        var n = normal; n.y = 0                      // un mur est vertical : on ignore l'inclinaison estimée
        n = simd_length(n) < 1e-3 ? SIMD3<Float>(0, 0, 1) : simd_normalize(n)
        let up = SIMD3<Float>(0, 1, 0)
        var down = -(up - simd_dot(up, n) * n)
        if simd_length(down) < 1e-3 { down = SIMD3<Float>(0, 0, 1) }
        let z = simd_normalize(down), x = simd_normalize(simd_cross(n, z))
        let rot = simd_quatf(simd_float3x3(columns: (x, n, z)))
        return Transform(scale: .one, rotation: rot, translation: position)
    }

    private func place(at r: ARRaycastResult) {
        manualPlane = nil
        setAnchor(wallTransform(r))
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
        if state != .placed { state = .placed; searchTimer?.invalidate(); UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    }

    private func tryAutoPlace() {
        guard state == .searching, let v = arView else { return }
        if !offerManual && Date().timeIntervalSince(searchStart) > 6 { offerManual = true }
        let c = CGPoint(x: v.bounds.midX, y: v.bounds.midY)
        if let r = wallHit(c, existing: true) { place(at: r) }
    }

    @objc private func tap(_ g: UITapGestureRecognizer) {
        guard let v = arView else { return }
        let p = g.location(in: v)
        if state == .placed, let hit = v.entity(at: p), let painting, isDescendant(hit, of: painting) {
            onTapPainting?(); UISelectionFeedbackGenerator().selectionChanged(); return
        }
        moveTo(p)
    }

    /// Déplace le tableau vers le point touché : vrai mur si connu, sinon le mur virtuel de la pose manuelle.
    private func moveTo(_ p: CGPoint) {
        if let m = manualPlane, let v = arView, let ray = v.ray(through: p) {
            let d = simd_dot(ray.direction, m.normal)
            guard abs(d) > 1e-4 else { return }
            let t = simd_dot(m.point - ray.origin, m.normal) / d
            if t > 0 { place(normal: m.normal, position: ray.origin + ray.direction * t) }
            return
        }
        if let r = wallHit(p, existing: true) { place(at: r) }
    }

    @objc private func pan(_ g: UIPanGestureRecognizer) {
        guard state == .placed, let v = arView else { return }
        moveTo(g.location(in: v))
    }

    private func isDescendant(_ e: Entity, of root: Entity) -> Bool {
        var cur: Entity? = e
        while let c = cur { if c === root { return true }; cur = c.parent }
        return false
    }
}
