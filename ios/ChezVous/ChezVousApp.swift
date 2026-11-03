import SwiftUI

@main
struct ChezVousApp: App {
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup { RootView() }
            .onChange(of: phase) { _, p in if p == .active { Suivi.demarrer() } }
    }
}

struct RootView: View {
    @AppStorage("tutoSeen") private var tutoSeen = false
    @State private var showTuto = false
    @State private var path: [Work] = []

    var body: some View {
        NavigationStack(path: $path) {
            CatalogueView(onHelp: { showTuto = true })
                .navigationDestination(for: Work.self) { WorkView(work: $0) }
        }
        .tint(Theme.ink)
        .onAppear {
            if !tutoSeen { showTuto = true }
            // captures automatiques (simulateur) : -openWork <slug>
            if let i = CommandLine.arguments.firstIndex(of: "-openWork"), i + 1 < CommandLine.arguments.count,
               let w = Catalogue.shared.works.first(where: { $0.slug == CommandLine.arguments[i + 1] }) { path = [w] }
        }
        .fullScreenCover(isPresented: $showTuto, onDismiss: { tutoSeen = true }) { TutorialView() }
    }
}
