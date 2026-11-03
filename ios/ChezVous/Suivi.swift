import Foundation
import Network

/// Suivi anonyme vers le CRM (même table que les QR du catalogue) : aucune donnée personnelle,
/// aucun identifiant d'appareil. Hors ligne, les événements attendent sur le téléphone (avec leur date)
/// et partent au retour du réseau. Tout se passe en arrière-plan : l'interface n'attend jamais.
enum Suivi {
    enum Evenement: String { case vue, essai_ar, format, achat }

    static func envoyer(_ e: Evenement, _ work: Work, _ size: WorkSize?) {
        #if !targetEnvironment(simulator)   // captures automatiques et essais sur simulateur : rien n'est compté
        let ev = FileSuivi.Ev(evenement: e.rawValue, tableau: work.slug, format: size?.slug,
                              langue: Lang.en ? "en" : "fr", date: Date())
        FileSuivi.shared.ajouter(ev)
        #endif
    }

    /// À appeler au lancement et au retour au premier plan : envoie ce qui attend et surveille le retour du réseau.
    static func demarrer() { FileSuivi.shared.demarrer() }
}

private final class FileSuivi {
    static let shared = FileSuivi()

    struct Ev: Codable { let evenement: String; let tableau: String; let format: String?; let langue: String; let date: Date }

    private let url = URL(string: "https://gmghhnfvjjazagilzctz.supabase.co/rest/v1/rpc/app_relais_evenement")!
    private let cle = "sb_publishable_6x0JuqEp2lSa4ufaC-fw6A_-jciiYCO"
    private let maxFile = 500
    private let cleStockage = "suivi.file"
    private let q = DispatchQueue(label: "chezvous.suivi")          // tout passe par cette file : jamais sur le fil principal
    private let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 15
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()
    private let moniteur = NWPathMonitor()
    private var attente: [Ev] = []
    private var enCours = false
    private var demarre = false

    private init() {
        if let d = UserDefaults.standard.data(forKey: cleStockage),
           let l = try? JSONDecoder().decode([Ev].self, from: d) { attente = l }
    }

    func demarrer() {
        q.async {
            guard !self.demarre else { self.vider(); return }
            self.demarre = true
            self.moniteur.pathUpdateHandler = { [weak self] p in
                if p.status == .satisfied { self?.q.async { self?.vider() } }
            }
            self.moniteur.start(queue: self.q)
            self.vider()
        }
    }

    func ajouter(_ e: Ev) {
        q.async {
            self.attente.append(e)
            while self.attente.count > self.maxFile { self.attente.remove(at: self.enCours ? 1 : 0) }   // file pleine : on oublie les plus anciens (sauf celui en cours d'envoi)
            self.sauver()
            self.vider()
        }
    }

    private func sauver() {
        if let d = try? JSONEncoder().encode(attente) { UserDefaults.standard.set(d, forKey: cleStockage) }
    }

    /// Envoie les événements un par un, du plus ancien au plus récent ; s'arrête à la première panne réseau.
    private func vider() {
        guard !enCours, let e = attente.first else { return }
        enCours = true
        session.dataTask(with: requete(e)) { _, rep, err in
            self.q.async {
                self.enCours = false
                let code = (rep as? HTTPURLResponse)?.statusCode ?? 0
                if err != nil || code == 0 || code == 429 || code >= 500 { return }   // réseau ou serveur : on réessaiera plus tard
                self.attente.removeFirst()                                           // envoyé (ou refusé définitivement : inutile d'insister)
                self.sauver()
                self.vider()
            }
        }.resume()
    }

    private func requete(_ e: Ev) -> URLRequest {
        var r = URLRequest(url: url)
        r.httpMethod = "POST"
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue(cle, forHTTPHeaderField: "apikey")
        r.setValue("Bearer \(cle)", forHTTPHeaderField: "Authorization")
        var corps: [String: Any] = ["p_origine": "app-ios", "p_evenement": e.evenement, "p_tableau": e.tableau,
                                    "p_format": e.format ?? NSNull(), "p_langue": e.langue]
        // au-delà de 30 jours, l'événement prend la date de l'envoi
        if Date().timeIntervalSince(e.date) < 30 * 86_400 {
            let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            corps["p_date"] = f.string(from: e.date)
        }
        r.httpBody = try? JSONSerialization.data(withJSONObject: corps)
        return r
    }
}
