import SwiftUI

struct WorkView: View {
    let work: Work
    @State private var size: WorkSize
    @State private var showAR = false
    @Environment(\.openURL) private var openURL

    init(work: Work) {
        self.work = work
        _size = State(initialValue: work.sizes.first!)
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 0) {
                    if let img = work.uiImage() {
                        Image(uiImage: img).resizable().scaledToFit()
                            .frame(maxHeight: 420)
                            .shadow(color: .black.opacity(0.22), radius: 12, y: 10)
                            .padding(.horizontal, 20).padding(.top, 26).padding(.bottom, 14)
                    }
                    VStack(spacing: 10) {
                        Caps(text: tech, size: 9, tracking: 1.8, color: Theme.inkSoft).multilineTextAlignment(.center)
                        Text(work.title).font(Theme.serif(38)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)
                    }.padding(.horizontal, 20).padding(.bottom, 24)
                    Rule()
                    VStack(alignment: .leading, spacing: 14) {
                        Caps(text: "Choisir la taille", size: 10, tracking: 2.5, color: Theme.inkSoft)
                        ForEach(work.sizes) { s in
                            Button { size = s } label: { SizeRow(size: s, selected: s == size) }.buttonStyle(.plain)
                        }
                        Text(dims).font(Theme.serif(16)).foregroundStyle(Theme.muted)
                            .frame(maxWidth: .infinity).multilineTextAlignment(.center).padding(.top, 4)
                    }.padding(20)
                    Rule()
                }
            }
            VStack(spacing: 6) {
                PrimaryButton(title: "Voir sur mon mur") { showAR = true }
                Button { if let u = work.shopURL { openURL(u) } } label: {
                    Caps(text: "Acquérir ce tirage", size: 9, tracking: 2.25, color: Theme.inkSoft)
                        .padding(.bottom, 3).overlay(alignment: .bottom) { Rule() }
                        .frame(minHeight: 44)
                }.buttonStyle(.plain)
            }
            .padding(.horizontal, 20).padding(.top, 12)
            .background(Theme.bg.overlay(alignment: .top) { Rule() })
        }
        .background(Theme.bg)
        .toolbar { ToolbarItem(placement: .principal) { BrandHeader() } }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .fullScreenCover(isPresented: $showAR) { ARScreen(work: work, size: $size) }
    }

    private var tech: String { "Édition sur Toile" + (work.edition.map { " · \($0) exemplaires signés et numérotés" } ?? "") }
    private var dims: String {
        var t = "Toile \(size.canvasText) · encadrée caisse américaine \(size.framedText)"
        if let p = size.price_framed { t += " · \(Fmt.eur(p)) encadrée" }
        if let p = size.price_unframed { t += ", \(Fmt.eur(p)) toile seule" }
        return t
    }
}

struct SizeRow: View {
    let size: WorkSize; let selected: Bool
    var body: some View {
        HStack(spacing: 10) {
            Text(size.label).font(Theme.serif(24)).foregroundStyle(Theme.ink).frame(width: 118, alignment: .leading)
            Text(size.canvasText).font(Theme.sans(15)).foregroundStyle(Theme.inkSoft).lineLimit(1)
            Spacer(minLength: 4)
            Text(Fmt.eur(size.price_framed)).font(Theme.serifUpright(23)).foregroundStyle(Theme.ink).lineLimit(1)
        }
        .padding(.horizontal, 16).frame(minHeight: 62)
        .background(selected ? Theme.ink.opacity(0.03) : .clear)
        .overlay(Rectangle().stroke(selected ? Theme.ink : Theme.border, lineWidth: 1))
        .contentShape(Rectangle())
    }
}
