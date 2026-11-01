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

/// Langue de l'appli : français si le téléphone est en français, sinon anglais (américain).
enum Lang {
    static let en: Bool = !(Locale.preferredLanguages.first ?? "fr").lowercased().hasPrefix("fr")
}
/// Texte selon la langue : L("français", "English")
func L(_ fr: String, _ en: String) -> String { Lang.en ? en : fr }

struct Dim: Decodable, Hashable { let w: Double; let h: Double }

struct WorkSize: Decodable, Hashable, Identifiable {
    let label: String
    let label_en: String?
    let slug: String
    let w: Double
    let h: Double
    let price_framed: Int?
    let price_unframed: Int?
    let price_framed_usd: Int?
    let price_unframed_usd: Int?
    let framed_cm: Dim?
    let outer_cm: Dim
    let usdz: String
    var id: String { slug }

    var displayLabel: String { Lang.en ? (label_en ?? label) : label }
    var canvasText: String { Fmt.size(w, h) }
    var framedText: String { let f = framed_cm ?? outer_cm; return Fmt.size(f.w, f.h) }
    /// Prix dans la langue de l'appli (euros sur la boutique française, dollars sur la boutique anglaise)
    var framedPrice: Int? { Lang.en ? price_framed_usd : price_framed }
    var unframedPrice: Int? { Lang.en ? price_unframed_usd : price_unframed }
    var modelURL: URL? { Bundle.main.url(forResource: usdz, withExtension: nil, subdirectory: "Catalogue") }
}

struct Work: Decodable, Hashable, Identifiable {
    let id: Int
    let slug: String
    let title: String
    let title_en: String?
    let url_en: String?
    let edition: String?
    let url: String
    let image: String
    let thumb: String
    let sizes: [WorkSize]

    var displayTitle: String { Lang.en ? (title_en ?? title) : title }
    var minPrice: Int? { sizes.compactMap(\.framedPrice).min() }
    var shopURL: URL? { URL(string: Lang.en ? (url_en ?? url) : url) }
    func uiImage(thumb: Bool = false) -> UIImage? {
        guard let path = Bundle.main.path(forResource: thumb ? self.thumb : image, ofType: nil, inDirectory: "Catalogue") else { return nil }
        return UIImage(contentsOfFile: path)
    }
}

enum Fmt {
    static func cm(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
    }
    /// Dimensions : centimètres en français, pouces en anglais américain
    static func size(_ w: Double, _ h: Double) -> String {
        if Lang.en { return "\(inch(w)) × \(inch(h)) in" }
        return "\(cm(w)) × \(cm(h)) cm"
    }
    static func inch(_ cm: Double) -> String {
        let v = (cm / 2.54 * 10).rounded() / 10
        return v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v)
    }
    /// Prix : « 1 820 € » en français, « $2,200 » en anglais
    static func price(_ n: Int?) -> String {
        guard let n else { return "" }
        if Lang.en {
            let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = ","; f.usesGroupingSeparator = true
            return "$" + (f.string(from: NSNumber(value: n)) ?? "\(n)")
        }
        return eur(n)
    }
    static func eur(_ n: Int?) -> String {
        guard let n else { return "" }
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = "\u{202F}"; f.usesGroupingSeparator = true
        return (f.string(from: NSNumber(value: n)) ?? "\(n)") + "\u{00A0}€"
    }
}
