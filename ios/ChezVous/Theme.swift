import SwiftUI

// Charte de stephane-alsac.com : parchemin, Cormorant Garamond italique + Raleway, filets, zéro décoration.
enum Theme {
    static let bg = Color(red: 0xEE / 255, green: 0xEA / 255, blue: 0xE1 / 255)
    static let bg2 = Color(red: 0xE2 / 255, green: 0xDB / 255, blue: 0xCC / 255)
    static let border = Color(red: 0xD4 / 255, green: 0xCF / 255, blue: 0xC4 / 255)
    static let ink = Color(red: 0x1A / 255, green: 0x1A / 255, blue: 0x1A / 255)
    static let inkSoft = Color(red: 0x4A / 255, green: 0x4A / 255, blue: 0x4A / 255)
    static let muted = Color(red: 0x6A / 255, green: 0x66 / 255, blue: 0x5E / 255)

    static func serif(_ size: CGFloat) -> Font { .custom("CormorantGaramond-LightItalic", size: size) }
    static func serifUpright(_ size: CGFloat) -> Font { .custom("CormorantGaramond-Regular", size: size) }
    static func sans(_ size: CGFloat, _ weight: String = "Light") -> Font { .custom("Raleway-\(weight)", size: size) }
}

struct Caps: View {
    let text: String; var size: CGFloat = 10; var tracking: CGFloat = 2.5; var color: Color = Theme.ink
    var body: some View {
        Text(text.uppercased()).font(Theme.sans(size, "Regular")).tracking(tracking).foregroundStyle(color)
    }
}

struct Rule: View {
    var body: some View { Rectangle().fill(Theme.border).frame(height: 1) }
}

struct PrimaryButton: View {
    let title: String; let action: () -> Void
    var body: some View {
        Button(action: action) {
            Caps(text: title, size: 11, tracking: 2.75, color: Theme.bg)
                .frame(maxWidth: .infinity).frame(height: 52).background(Theme.ink)
        }.buttonStyle(.plain)
    }
}
