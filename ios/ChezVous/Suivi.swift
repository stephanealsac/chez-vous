import Foundation

/// Suivi anonyme vers le CRM (même table que les QR du catalogue) : aucune donnée personnelle,
/// aucun identifiant d'appareil, rien n'est gardé sur le téléphone. Envoi « au mieux » : hors ligne, rien n'est envoyé.
enum Suivi {
    private static let url = URL(string: "https://gmghhnfvjjazagilzctz.supabase.co/rest/v1/rpc/app_relais_evenement")!
    private static let cle = "sb_publishable_6x0JuqEp2lSa4ufaC-fw6A_-jciiYCO"
    private static let session = URLSession(configuration: .ephemeral)

    enum Evenement: String { case vue, essai_ar, format, achat }

    static func envoyer(_ e: Evenement, _ work: Work, _ size: WorkSize?) {
        var r = URLRequest(url: url, timeoutInterval: 10)
        r.httpMethod = "POST"
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue(cle, forHTTPHeaderField: "apikey")
        r.setValue("Bearer \(cle)", forHTTPHeaderField: "Authorization")
        let corps: [String: Any] = ["p_origine": "app-ios", "p_evenement": e.rawValue, "p_tableau": work.slug,
                                    "p_format": size?.slug ?? NSNull(), "p_langue": Lang.en ? "en" : "fr"]
        r.httpBody = try? JSONSerialization.data(withJSONObject: corps)
        session.dataTask(with: r).resume()
    }
}
