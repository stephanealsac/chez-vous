// Redirection des QR codes imprimés du catalogue 2027 : app.stephane-alsac.com/Q/<n> (et /q/<n>).
// Le CRM (Supabase, fonction qr_resolve) donne l'adresse et compte le scan. Aucune IP n'est enregistrée ni transmise.
// Secours si Supabase est lent (> 2 s) ou en erreur : table _qr-secours.json
// (générée par « select numero, langue, destination from qr_liens where actif »).
// Requêtes HEAD et robots d'aperçu de lien : table de secours directement, sans compter de faux scan.
import secours from './_qr-secours.json';

const RPC = 'https://gmghhnfvjjazagilzctz.supabase.co/rest/v1/rpc/qr_resolve';
const CLE = 'sb_publishable_6x0JuqEp2lSa4ufaC-fw6A_-jciiYCO';
const ACCUEIL = 'https://www.stephane-alsac.com/';
const DELAI_MS = 2000;
const ROBOTS = /facebookexternalhit|facebot|slackbot|whatsapp|twitterbot|linkedinbot|discordbot|telegrambot|skypeuripreview|pinterest|redditbot|embedly|vkshare|applebot|googlebot|bingbot|yandex|baiduspider|duckduckbot|bot[\/\s;)]|crawler|spider|preview/i;
const PAR_NUMERO = new Map(secours.map(r => [r.numero, r]));

const vers = url => new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });

export function appareil(ua = '') {
  if (/iPhone|iPod/i.test(ua)) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  if (/iPad|Mobile|Tablet/i.test(ua)) return 'autre';
  if (/Windows NT|Macintosh|X11|Linux|CrOS/i.test(ua)) return 'ordinateur';
  return 'autre';
}

export function adresseSecours(n) {
  const r = PAR_NUMERO.get(n);
  if (!r) return null;
  const dest = 'https://www.stephane-alsac.com' + r.destination;
  return dest + (dest.includes('?') ? '&' : '?')
    + `utm_source=catalogue&utm_medium=qr-${r.langue}&utm_campaign=catalogue-2027&utm_content=q${n}`;
}

export async function onRequest({ request, params }) {
  const brut = Array.isArray(params.n) ? params.n.join('/') : String(params.n ?? '');
  if (!/^[1-9]\d{0,3}$/.test(brut)) return vers(ACCUEIL);   // entier de 1 à 9999, rien d'autre
  const n = Number(brut);
  const ua = request.headers.get('User-Agent') || '';

  if (request.method !== 'GET' || ROBOTS.test(ua)) return vers(adresseSecours(n) || ACCUEIL);

  const stop = new AbortController();
  const minuterie = setTimeout(() => stop.abort(), DELAI_MS);
  try {
    const rep = await fetch(RPC, {
      method: 'POST', signal: stop.signal,
      headers: { 'Content-Type': 'application/json', apikey: CLE, Authorization: 'Bearer ' + CLE },
      body: JSON.stringify({ p_numero: n, p_pays: request.cf?.country ?? null, p_appareil: appareil(ua) })
    });
    if (!rep.ok) throw new Error('qr_resolve ' + rep.status);
    const adresse = await rep.json();
    clearTimeout(minuterie);
    return vers(typeof adresse === 'string' && /^https:\/\//.test(adresse) ? adresse : ACCUEIL);
  } catch (_) {
    clearTimeout(minuterie);
    return vers(adresseSecours(n) || ACCUEIL);
  }
}
