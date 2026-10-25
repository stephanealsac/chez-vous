import Foundation
import UIKit

// Catalogue embarqué (copie de site/catalogue.json) : l'appli fonctionne sans connexion.
struct Catalogue: Decodable {
    let works: [Work]

    static let shared: Catalogue = {
        guard let url = Bundle.main.url(forResource: "catalogue", withExtension: "json", subdirectory: "Catalogue"),
              let data = try? Data(contentsOf: url),
              let cat = try? JSONDecoder().decode(Catalogue.self, from: data) else { return Catalogue(works: []) }
        return cat
    }()
}

struct Dim: Decodable, Hashable { let w: Double; let h: Double }

struct WorkSize: Decodable, Hashable, Identifiable {
    let label: String
    let slug: String
    let w: Double
    let h: Double
    let price_framed: Int?
    let price_unframed: Int?
    let framed_cm: Dim?
    let outer_cm: Dim
    let usdz: String
    var id: String { slug }

    var canvasText: String { "\(Fmt.cm(w)) × \(Fmt.cm(h)) cm" }
    var framedText: String { let f = framed_cm ?? outer_cm; return "\(Fmt.cm(f.w)) × \(Fmt.cm(f.h)) cm" }
    var modelURL: URL? { Bundle.main.url(forResource: usdz, withExtension: nil, subdirectory: "Catalogue") }
}

struct Work: Decodable, Hashable, Identifiable {
    let id: Int
    let slug: String
    let title: String
    let edition: String?
    let url: String
    let image: String
    let thumb: String
    let sizes: [WorkSize]

    var minPrice: Int? { sizes.compactMap(\.price_framed).min() }
    var shopURL: URL? { URL(string: url) }
    func uiImage(thumb: Bool = false) -> UIImage? {
        guard let path = Bundle.main.path(forResource: thumb ? self.thumb : image, ofType: nil, inDirectory: "Catalogue") else { return nil }
        return UIImage(contentsOfFile: path)
    }
}

enum Fmt {
    static func cm(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
    }
    static func eur(_ n: Int?) -> String {
        guard let n else { return "" }
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = "\u{202F}"; f.usesGroupingSeparator = true
        return (f.string(from: NSNumber(value: n)) ?? "\(n)") + "\u{00A0}€"
    }
}
