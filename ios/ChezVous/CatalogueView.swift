import SwiftUI

struct BrandHeader: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("STÉPHANE ALSAC").font(Theme.serifUpright(15)).tracking(3.3).foregroundStyle(Theme.ink)
            Caps(text: "Chez vous", size: 9, tracking: 2.25, color: Theme.muted)
        }
    }
}

struct CatalogueView: View {
    let onHelp: () -> Void
    private let works = Catalogue.shared.works
    private let cols = [GridItem(.flexible(), spacing: 0), GridItem(.flexible(), spacing: 0)]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Text("ÉDITIONS SUR TOILE").font(Theme.serifUpright(22)).tracking(5.5)
                    .foregroundStyle(Theme.ink).padding(.vertical, 34)
                Rule()
                LazyVGrid(columns: cols, spacing: 0) {
                    ForEach(works) { w in
                        NavigationLink(value: w) { WorkCard(work: w) }.buttonStyle(.plain)
                    }
                }
                Text("Éditions limitées, signées et numérotées.")
                    .font(Theme.serif(16)).foregroundStyle(Theme.muted).padding(.vertical, 30)
            }
        }
        .background(Theme.bg)
        .toolbar {
            ToolbarItem(placement: .principal) { BrandHeader() }
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: onHelp) {
                    Text("?").font(Theme.serif(20)).frame(width: 32, height: 32)
                        .overlay(Rectangle().stroke(Theme.border, lineWidth: 1))
                }.accessibilityLabel("Revoir le tutoriel")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}

struct WorkCard: View {
    let work: Work
    var body: some View {
        VStack(spacing: 0) {
            Color.clear.aspectRatio(1, contentMode: .fit)
                .overlay {
                    if let img = work.uiImage(thumb: true) {
                        Image(uiImage: img).resizable().scaledToFill()
                    } else { Theme.bg2 }
                }
                .clipped()
            Text(work.title).font(Theme.serif(21)).foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center).lineLimit(2).padding(.top, 12)
            Text(meta).font(Theme.serif(15)).foregroundStyle(Theme.muted).padding(.top, 2)
        }
        .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 18)
        .overlay(alignment: .trailing) { Rectangle().fill(Theme.border).frame(width: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 1) }
        .contentShape(Rectangle())
    }
    private var meta: String {
        let f = work.sizes.count > 1 ? "\(work.sizes.count) formats" : work.sizes.first?.canvasText ?? ""
        if let p = work.minPrice { return "\(f) · dès \(Fmt.eur(p))" }
        return f
    }
}
