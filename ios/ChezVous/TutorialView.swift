import SwiftUI
import AVKit

// Tutoriel vidéo : affiche + bouton lecture (pas de lecture automatique), « Passer » / « Commencer ».
struct TutorialView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer? = Bundle.main.url(forResource: "tuto", withExtension: "mp4", subdirectory: "Catalogue").map { AVPlayer(url: $0) }
    @State private var playing = false
    @State private var ended = false

    var body: some View {
        VStack(spacing: 0) {
            Text("STÉPHANE ALSAC").font(Theme.serifUpright(15)).tracking(3.3).foregroundStyle(Theme.ink).padding(.vertical, 14)
            Rule()
            ZStack {
                if let player {
                    VideoPlayer(player: player).aspectRatio(9 / 16, contentMode: .fit).disabled(!playing)
                }
                if !playing, let path = Bundle.main.path(forResource: "tuto-poster", ofType: "jpg", inDirectory: "Catalogue"),
                   let img = UIImage(contentsOfFile: path) {
                    Image(uiImage: img).resizable().aspectRatio(9 / 16, contentMode: .fit)
                    Button { play() } label: {
                        Image(systemName: "play.fill").font(.system(size: 30)).foregroundStyle(Theme.ink)
                            .frame(width: 88, height: 88).background(Circle().fill(Theme.bg.opacity(0.92)))
                            .overlay(Circle().stroke(Theme.ink, lineWidth: 1))
                    }.accessibilityLabel("Lire le tutoriel")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity).padding(.vertical, 10)
            Rule()
            Button { player?.pause(); dismiss() } label: {
                Caps(text: ended ? "Commencer" : "Passer", size: 11, tracking: 2.75)
                    .padding(.horizontal, 28).frame(height: 48).overlay(Rectangle().stroke(Theme.ink, lineWidth: 1))
            }.buttonStyle(.plain).padding(.vertical, 12)
        }
        .background(Theme.bg.ignoresSafeArea())
        .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification)) { _ in ended = true; playing = false }
    }

    private func play() {
        try? AVAudioSession.sharedInstance().setCategory(.playback)
        player?.seek(to: .zero); player?.play(); playing = true
    }
}
