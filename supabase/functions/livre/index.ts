/**
 * LearnHub — Edge Function « livre ».
 *
 * Transforme une leçon en livre PDF (couverture + contenu mis en page), dépose
 * le fichier sur Cloudflare R2 et enregistre son URL dans la table `lessons`.
 * L'élève ouvre ensuite ce PDF depuis son espace, comme un vrai livre.
 *
 * Déploiement :
 *   supabase secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=…
 *   supabase secrets set R2_BUCKET=learnhub-bibliotheque R2_PUBLIC_BASE=https://pub-xxxx.r2.dev
 *   supabase functions deploy livre
 *
 * Sans secrets R2, le fichier est déposé dans Supabase Storage (bucket
 * `documents`) afin que la génération fonctionne malgré tout.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const VERSION = '2026-10-31.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 58;
const LARGEUR_UTILE = A4.largeur - MARGE * 2;

const COULEURS = {
    primaire: rgb(0.416, 0.106, 0.604),
    sombre: rgb(0.192, 0.106, 0.31),
    secondaire: rgb(0.671, 0.278, 0.737),
    accent: rgb(1, 0.439, 0.263),
    texte: rgb(0.16, 0.16, 0.19),
    doux: rgb(0.42, 0.45, 0.5),
    filet: rgb(0.85, 0.85, 0.88),
    blanc: rgb(1, 1, 1)
};

function reponse(corps: unknown, statut = 200): Response {
    return new Response(JSON.stringify(corps), {
        status: statut,
        headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
}

/** Clé publique : nécessaire au client Supabase avec le jeton de l'appelant. */
function clePublique(): string {
    const directe = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (directe) return directe;
    try {
        const dictionnaire = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
        const valeurs = Object.values(dictionnaire).filter((valeur) => typeof valeur === 'string' && valeur);
        return (valeurs[0] as string) || '';
    } catch {
        return '';
    }
}

function tailleLisible(octets: number): string {
    if (octets >= 1024 * 1024) return (octets / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
    return Math.max(1, Math.round(octets / 1024)) + ' Ko';
}

/* ------------------------------ Texte et encodage ------------------------------ */

const REMPLACEMENTS: Record<string, string> = {
    '\u2018': "'", '\u2019': "'", '\u201A': ',', '\u201B': "'",
    '\u201C': '"', '\u201D': '"', '\u201E': '"',
    '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-',
    '\u2026': '...', '\u00A0': ' ', '\u202F': ' ', '\u2009': ' ',
    '\u0153': 'oe', '\u0152': 'OE', '\u20AC': ' EUR', '\u2022': '-',
    '\u00B7': '.', '\u2039': '<', '\u203A': '>', '\u00AD': '-'
};

/**
 * Les polices standard du PDF utilisent l'encodage WinAnsi : tout caractère
 * hors Latin-1 (emoji, symboles exotiques) ferait échouer l'écriture.
 */
function assainir(valeur: unknown): string {
    const source = String(valeur == null ? '' : valeur);
    let sortie = '';
    for (const caractere of source) {
        const remplace = REMPLACEMENTS[caractere];
        if (remplace !== undefined) {
            sortie += remplace;
            continue;
        }
        const code = caractere.codePointAt(0) || 0;
        if (code === 10 || code === 13) { sortie += ' '; continue; }
        if (code >= 32 && code <= 255) { sortie += caractere; continue; }
        // Caractère non représentable : ignoré plutôt que de casser la génération.
    }
    return sortie.replace(/[ \t]{2,}/g, ' ').trim();
}

/* ------------------------------ Lecture du HTML ------------------------------ */

interface Morceau { texte: string; gras: boolean; italique: boolean; }

interface Bloc {
    type: 'h2' | 'h3' | 'p' | 'li' | 'quote' | 'img' | 'hr';
    morceaux: Morceau[];
    src?: string;
    puce?: string;
}

const BALISES_BLOC = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div', 'figure', 'figcaption'];

function decoderEntites(texte: string): string {
    const entites: Record<string, string> = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
        '&apos;': "'", '&nbsp;': ' ', '&laquo;': '\u00AB', '&raquo;': '\u00BB',
        '&eacute;': '\u00E9', '&egrave;': '\u00E8', '&agrave;': '\u00E0',
        '&ccedil;': '\u00E7', '&ocirc;': '\u00F4', '&ucirc;': '\u00FB',
        '&icirc;': '\u00EE', '&acirc;': '\u00E2', '&ugrave;': '\u00F9'
    };
    return texte
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/&[a-z]+;/gi, (entite) => entites[entite.toLowerCase()] ?? entite);
}

/** Découpe le HTML de la leçon en blocs simples (titres, paragraphes, listes, images). */
function analyserHtml(html: string): Bloc[] {
    const blocs: Bloc[] = [];
    let morceaux: Morceau[] = [];
    let typeCourant: Bloc['type'] = 'p';
    let gras = 0;
    let italique = 0;
    let numPuce = 0;
    let listeOrdonnee = false;

    function vider() {
        const utile = morceaux.filter((morceau) => morceau.texte.trim());
        if (utile.length) {
            blocs.push({
                type: typeCourant,
                morceaux: utile,
                puce: typeCourant === 'li' && listeOrdonnee && numPuce ? `${numPuce}.` : undefined
            });
        }
        morceaux = [];
    }

    function ajouter(texte: string) {
        const propre = decoderEntites(texte);
        if (!propre) return;
        morceaux.push({ texte: propre, gras: gras > 0, italique: italique > 0 });
    }

    const jetons = String(html || '').match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g) || [];
    for (const jeton of jetons) {
        if (jeton.startsWith('<!--')) continue;
        if (!jeton.startsWith('<')) { ajouter(jeton); continue; }

        const fermeture = jeton.startsWith('</');
        const nom = (jeton.match(/^<\/?([a-zA-Z0-9]+)/) || [])[1]?.toLowerCase() || '';
        if (!nom) continue;

        if (nom === 'br') { morceaux.push({ texte: '\n', gras: false, italique: false }); continue; }
        if (nom === 'hr') { vider(); blocs.push({ type: 'hr', morceaux: [] }); continue; }

        if (nom === 'img') {
            vider();
            const src = (jeton.match(/src\s*=\s*"([^"]*)"/i) || jeton.match(/src\s*=\s*'([^']*)'/i) || [])[1] || '';
            if (src) blocs.push({ type: 'img', morceaux: [], src });
            continue;
        }

        if (nom === 'strong' || nom === 'b') { gras = Math.max(0, gras + (fermeture ? -1 : 1)); continue; }
        if (nom === 'em' || nom === 'i') { italique = Math.max(0, italique + (fermeture ? -1 : 1)); continue; }

        if (nom === 'ul' || nom === 'ol') {
            vider();
            listeOrdonnee = nom === 'ol';
            numPuce = 0;
            continue;
        }

        if (BALISES_BLOC.indexOf(nom) === -1) continue;

        if (fermeture) {
            vider();
            typeCourant = 'p';
            continue;
        }

        vider();
        if (nom === 'h1' || nom === 'h2') { typeCourant = 'h2'; continue; }
        if (nom === 'h3' || nom === 'h4' || nom === 'h5' || nom === 'h6') { typeCourant = 'h3'; continue; }
        if (nom === 'li') {
            typeCourant = 'li';
            if (listeOrdonnee) numPuce += 1;
            continue;
        }
        if (nom === 'blockquote') { typeCourant = 'quote'; continue; }
        typeCourant = 'p';
    }
    vider();

    if (!blocs.length) {
        const texte = assainir(String(html || '').replace(/<[^>]*>/g, ' '));
        if (texte) blocs.push({ type: 'p', morceaux: [{ texte: texte, gras: false, italique: false }] });
    }
    return blocs;
}

/* ------------------------------- Flux du document ------------------------------- */

type Police = 'normal' | 'gras' | 'italique' | 'grasItalique';

interface Polices {
    normal: any;
    gras: any;
    italique: any;
    grasItalique: any;
}

interface Segment { texte: string; police: Police; taille: number; couleur: any; }

class Redacteur {
    doc: any;
    polices: Polices;
    page: any;
    y = 0;
    titre: string;

    constructor(doc: any, polices: Polices, titre: string, creerPage = true) {
        this.doc = doc;
        this.polices = polices;
        this.titre = titre;
        if (creerPage) this.nouvellePage();
    }

    nouvellePage() {
        this.page = this.doc.addPage([A4.largeur, A4.hauteur]);
        this.y = A4.hauteur - MARGE - 14;
        // Bandeau discret en haut de chaque page de contenu.
        this.page.drawRectangle({
            x: 0, y: A4.hauteur - 26, width: A4.largeur, height: 26, color: COULEURS.sombre
        });
        this.page.drawText(assainir(this.titre).slice(0, 90), {
            x: MARGE, y: A4.hauteur - 18, size: 8, font: this.polices.normal, color: rgb(0.85, 0.85, 0.9)
        });
    }

    place(hauteur: number): void {
        if (this.y - hauteur < MARGE + 24) this.nouvellePage();
    }

    largeurTexte(texte: string, police: Police, taille: number): number {
        return this.polices[police].widthOfTextAtSize(texte, taille);
    }

    /** Découpe un paragraphe en lignes en respectant la largeur disponible. */
    lignes(morceaux: Morceau[], taille: number, largeur: number): Segment[][] {
        const lignes: Segment[][] = [];
        let courante: Segment[] = [];
        let largeurCourante = 0;

        const pousser = () => {
            if (courante.length) lignes.push(courante);
            courante = [];
            largeurCourante = 0;
        };

        morceaux.forEach((morceau) => {
            const police: Police = morceau.gras && morceau.italique ? 'grasItalique'
                : morceau.gras ? 'gras' : morceau.italique ? 'italique' : 'normal';
            morceau.texte.split(/(\n)/).forEach((partie) => {
                if (partie === '\n') { pousser(); return; }
                if (!partie) return;
                partie.split(/(\s+)/).filter(Boolean).forEach((bout) => {
                    if (/^\s+$/.test(bout)) {
                        if (courante.length) {
                            courante[courante.length - 1].texte += ' ';
                            largeurCourante += this.largeurTexte(' ', police, taille);
                        }
                        return;
                    }
                    const largeurMot = this.largeurTexte(bout, police, taille);
                    if (largeurCourante + largeurMot > largeur && courante.length) pousser();
                    if (largeurMot > largeur) {
                        // Mot plus long que la ligne : découpe caractère par caractère.
                        let reste = bout;
                        while (reste.length) {
                            let i = reste.length;
                            while (i > 1 && this.largeurTexte(reste.slice(0, i), police, taille) > largeur) i -= 1;
                            courante.push({ texte: reste.slice(0, i), police: police, taille: taille, couleur: COULEURS.texte });
                            largeurCourante = this.largeurTexte(reste.slice(0, i), police, taille);
                            reste = reste.slice(i);
                            if (reste.length) pousser();
                        }
                        return;
                    }
                    courante.push({ texte: bout, police: police, taille: taille, couleur: COULEURS.texte });
                    largeurCourante += largeurMot;
                });
            });
        });
        if (courante.length) lignes.push(courante);
        return lignes;
    }

    ecrire(segments: Segment[], x: number, interligne: number) {
        let curseur = x;
        segments.forEach((segment) => {
            this.page.drawText(segment.texte, {
                x: curseur, y: this.y, size: segment.taille, font: this.polices[segment.police], color: segment.couleur
            });
            curseur += this.largeurTexte(segment.texte, segment.police, segment.taille);
        });
        this.y -= interligne;
    }

    paragraphe(lignes: Segment[][], options: {
        taille?: number; interligne?: number; couleur?: any;
        retrait?: number; espaceAvant?: number; espaceApres?: number;
    } = {}) {
        const taille = options.taille || 10.5;
        const interligne = options.interligne || taille * 1.55;
        const retrait = options.retrait || 0;

        if (options.espaceAvant) {
            this.place(options.espaceAvant);
            this.y -= options.espaceAvant;
        }
        lignes.forEach((ligne) => {
            this.place(interligne);
            const peinte = options.couleur
                ? ligne.map((segment) => ({ ...segment, couleur: options.couleur }))
                : ligne;
            this.ecrire(peinte, MARGE + retrait, interligne);
        });
        if (options.espaceApres) this.y -= options.espaceApres;
    }

    piedsDePage(sousTitre: string) {
        const pages = this.doc.getPages();
        pages.forEach((page: any, index: number) => {
            if (index === 0) return; // la couverture reste vierge de numéro
            page.drawLine({
                start: { x: MARGE, y: 46 }, end: { x: A4.largeur - MARGE, y: 46 },
                thickness: 0.6, color: COULEURS.filet
            });
            page.drawText(assainir(sousTitre).slice(0, 70), {
                x: MARGE, y: 33, size: 8, font: this.polices.normal, color: COULEURS.doux
            });
            page.drawText(String(index + 1) + ' / ' + pages.length, {
                x: A4.largeur - MARGE - 46, y: 33, size: 8, font: this.polices.gras, color: COULEURS.primaire
            });
        });
    }
}

/* ------------------------------- Rendu du livre ------------------------------- */

interface Lecon {
    id: string;
    espace_id: string;
    titre: string;
    matiere: string;
    niveau?: string | null;
    duree?: number | null;
    resume?: string | null;
    objectifs?: string[] | null;
    contenu?: string | null;
    contenu_html?: string | null;
    classe_ids?: string[] | null;
    couverture_url?: string | null;
}

const NOMS_MATIERES: Record<string, string> = {
    francais: 'Français', maths: 'Mathématiques', sciences: 'Sciences',
    histoire: 'Histoire-Géographie', langues: 'Langues', philosophie: 'Philosophie',
    informatique: 'Informatique'
};

async function telechargerImage(url: string): Promise<Uint8Array | null> {
    try {
        if (/^data:image\//i.test(url)) {
            const base64 = url.split(',')[1] || '';
            const binaire = atob(base64);
            const octets = new Uint8Array(binaire.length);
            for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
            return octets;
        }
        if (!/^https?:\/\//i.test(url)) return null;
        const resultat = await fetch(url);
        if (!resultat.ok) return null;
        const type = resultat.headers.get('content-type') || '';
        if (!/image\//i.test(type)) return null;
        const tampon = await resultat.arrayBuffer();
        if (tampon.byteLength > 8 * 1024 * 1024) return null;
        return new Uint8Array(tampon);
    } catch {
        return null;
    }
}

async function integrerImage(doc: any, url: string) {
    const octets = await telechargerImage(url);
    if (!octets) return null;
    try {
        if (/^data:image\/png/i.test(url) || /\.png($|\?)/i.test(url)) return await doc.embedPng(octets);
    } catch {
        // On tente JPEG juste après.
    }
    try {
        return await doc.embedJpg(octets);
    } catch {
        return null;
    }
}

async function dessinerCouverture(doc: any, polices: Polices, lecon: Lecon, meta: { matieres: string; classes: string; professeur: string }) {
    const page = doc.addPage([A4.largeur, A4.hauteur]);
    const image = lecon.couverture_url ? await integrerImage(doc, String(lecon.couverture_url)) : null;

    if (image) {
        // Cadrage « cover » : l'image remplit la page sans déformation.
        const echelle = Math.max(A4.largeur / image.width, A4.hauteur / image.height);
        const largeur = image.width * echelle;
        const hauteur = image.height * echelle;
        page.drawImage(image, {
            x: (A4.largeur - largeur) / 2, y: (A4.hauteur - hauteur) / 2, width: largeur, height: hauteur
        });
    } else {
        const bandes = 90;
        for (let i = 0; i < bandes; i += 1) {
            const ratio = i / (bandes - 1);
            const couleur = rgb(
                0.416 + (0.192 - 0.416) * ratio,
                0.106,
                0.604 + (0.31 - 0.604) * ratio
            );
            page.drawRectangle({
                x: 0, y: A4.hauteur - (A4.hauteur / bandes) * (i + 1),
                width: A4.largeur, height: A4.hauteur / bandes + 1, color: couleur
            });
        }
        page.drawCircle({ x: A4.largeur - 70, y: A4.hauteur - 120, size: 130, color: COULEURS.secondaire, opacity: 0.35 });
        page.drawCircle({ x: 80, y: 150, size: 150, color: COULEURS.accent, opacity: 0.18 });
    }

    // Voile sombre en bas pour garantir la lisibilité du titre.
    page.drawRectangle({
        x: 0, y: 0, width: A4.largeur, height: A4.hauteur * 0.55,
        color: rgb(0.07, 0.03, 0.13), opacity: 0.82
    });

    const redacteur = new Redacteur(doc, polices, lecon.titre, false);
    // La couverture n'utilise le rédacteur que pour la mesure et le découpage du titre.
    redacteur.page = page;

    const y = 300;
    page.drawText('LearnHub', {
        x: MARGE, y: y, size: 12, font: polices.gras, color: rgb(0.95, 0.9, 1)
    });
    page.drawText('LIVRE DE COURS', {
        x: MARGE, y: y - 16, size: 8.5, font: polices.normal, color: rgb(0.78, 0.72, 0.88)
    });

    // Pastille de matière.
    const etiquette = assainir(meta.matieres).toUpperCase();
    const largeurEtiquette = polices.gras.widthOfTextAtSize(etiquette, 8.5) + 20;
    page.drawRectangle({
        x: MARGE, y: y - 52, width: largeurEtiquette, height: 20, color: COULEURS.accent, opacity: 0.95
    });
    page.drawText(etiquette, {
        x: MARGE + 10, y: y - 46, size: 8.5, font: polices.gras, color: COULEURS.blanc
    });

    // Titre : retour à la ligne manuel pour maîtriser la composition.
    let tailleTitre = 30;
    let lignesTitre = redacteur.lignes([{ texte: assainir(lecon.titre), gras: true, italique: false }], tailleTitre, LARGEUR_UTILE);
    // La dernière ligne doit rester au-dessus du bloc de métadonnées (y = 96).
    const derniereLigne = (nombre: number, taille: number) => (y - 92) - (nombre - 1) * taille * 1.18;
    while (tailleTitre > 14 && (lignesTitre.length > 4 || derniereLigne(lignesTitre.length, tailleTitre) < 120)) {
        tailleTitre -= 2;
        lignesTitre = redacteur.lignes([{ texte: assainir(lecon.titre), gras: true, italique: false }], tailleTitre, LARGEUR_UTILE);
    }
    let yTitre = y - 92;
    lignesTitre.forEach((ligne) => {
        let curseur = MARGE;
        ligne.forEach((segment) => {
            page.drawText(segment.texte, {
                x: curseur, y: yTitre, size: tailleTitre, font: polices.gras, color: COULEURS.blanc
            });
            curseur += polices.gras.widthOfTextAtSize(segment.texte, tailleTitre);
        });
        yTitre -= tailleTitre * 1.18;
    });

    page.drawLine({
        start: { x: MARGE, y: yTitre + 8 }, end: { x: MARGE + 90, y: yTitre + 8 },
        thickness: 2, color: COULEURS.accent
    });

    const lignesMeta = [meta.classes, meta.professeur].filter(Boolean).join('  ·  ');
    if (lignesMeta) {
        page.drawText(assainir(lignesMeta).slice(0, 90), {
            x: MARGE, y: 96, size: 9.5, font: polices.normal, color: rgb(0.86, 0.82, 0.92)
        });
    }
    page.drawText('Document PDF généré par LearnHub', {
        x: MARGE, y: 72, size: 8, font: polices.normal, color: rgb(0.7, 0.65, 0.8)
    });
}

async function composerLivre(lecon: Lecon, meta: { matieres: string; classes: string; professeur: string }) {
    const doc = await PDFDocument.create();
    doc.setTitle(assainir(lecon.titre));
    doc.setAuthor(assainir(meta.professeur || 'LearnHub'));
    doc.setSubject(assainir(meta.matieres));
    doc.setCreator('LearnHub');
    doc.setProducer('LearnHub — fonction livre');

    const polices: Polices = {
        normal: await doc.embedFont(StandardFonts.Helvetica),
        gras: await doc.embedFont(StandardFonts.HelveticaBold),
        italique: await doc.embedFont(StandardFonts.HelveticaOblique),
        grasItalique: await doc.embedFont(StandardFonts.HelveticaBoldOblique)
    };

    await dessinerCouverture(doc, polices, lecon, meta);

    const redacteur = new Redacteur(doc, polices, lecon.titre);

    // Page d'ouverture : résumé et objectifs.
    redacteur.y -= 6;
    redacteur.paragraphe(
        [[{ texte: 'OBJECTIFS ET RÉSUMÉ', police: 'gras', taille: 9, couleur: COULEURS.secondaire }]],
        { interligne: 16, espaceApres: 4 }
    );

    const resume = assainir(lecon.resume || '');
    if (resume) {
        redacteur.paragraphe(
            redacteur.lignes([{ texte: resume, gras: false, italique: true }], 11.5, LARGEUR_UTILE),
            { taille: 11.5, interligne: 18, espaceApres: 10 }
        );
    }

    const objectifs = (lecon.objectifs || []).map((objectif) => assainir(objectif)).filter(Boolean);
    objectifs.forEach((objectif, index) => {
        const lignes = redacteur.lignes([{ texte: objectif, gras: false, italique: false }], 10.5, LARGEUR_UTILE - 26);
        if (!lignes.length) return;
        lignes[0] = [{
            texte: `${index + 1}.  `, police: 'gras', taille: 10.5, couleur: COULEURS.primaire
        }].concat(lignes[0]);
        redacteur.paragraphe(lignes, { retrait: 6, espaceApres: 3 });
    });

    redacteur.y -= 12;
    redacteur.page.drawLine({
        start: { x: MARGE, y: redacteur.y }, end: { x: A4.largeur - MARGE, y: redacteur.y },
        thickness: 1, color: COULEURS.filet
    });
    redacteur.y -= 26;

    // Contenu de la leçon.
    const blocs = analyserHtml(lecon.contenu_html || lecon.contenu || '');
    for (const bloc of blocs) {
        if (bloc.type === 'hr') {
            redacteur.place(20);
            redacteur.page.drawLine({
                start: { x: MARGE, y: redacteur.y }, end: { x: A4.largeur - MARGE, y: redacteur.y },
                thickness: 0.8, color: COULEURS.filet
            });
            redacteur.y -= 16;
            continue;
        }

        if (bloc.type === 'img') {
            const image = await integrerImage(doc, bloc.src || '');
            if (!image) continue;
            const largeurMax = LARGEUR_UTILE;
            const hauteurMax = 330;
            const echelle = Math.min(largeurMax / image.width, hauteurMax / image.height, 1);
            const largeur = image.width * echelle;
            const hauteur = image.height * echelle;
            redacteur.place(hauteur + 14);
            redacteur.page.drawImage(image, {
                x: MARGE + (LARGEUR_UTILE - largeur) / 2, y: redacteur.y - hauteur,
                width: largeur, height: hauteur
            });
            redacteur.y -= hauteur + 16;
            continue;
        }

        if (bloc.type === 'h2' || bloc.type === 'h3') {
            const taille = bloc.type === 'h2' ? 15 : 12.5;
            redacteur.place(taille * 3);
            redacteur.y -= 10;
            redacteur.paragraphe(redacteur.lignes(bloc.morceaux, taille, LARGEUR_UTILE), {
                taille: taille, interligne: taille * 1.4, couleur: COULEURS.sombre, espaceApres: 4
            });
            if (bloc.type === 'h2') {
                redacteur.page.drawLine({
                    start: { x: MARGE, y: redacteur.y + 2 }, end: { x: MARGE + 60, y: redacteur.y + 2 },
                    thickness: 1.6, color: COULEURS.accent
                });
                redacteur.y -= 8;
            }
            continue;
        }

        if (bloc.type === 'li') {
            const lignes = redacteur.lignes(bloc.morceaux, 10.5, LARGEUR_UTILE - 20);
            if (lignes.length) {
                lignes[0] = [{
                    texte: (bloc.puce ? bloc.puce : '-') + '  ', police: 'gras', taille: 10.5, couleur: COULEURS.primaire
                }].concat(lignes[0]);
            }
            redacteur.paragraphe(lignes, { retrait: 10, espaceApres: 2 });
            continue;
        }

        if (bloc.type === 'quote') {
            const lignes = redacteur.lignes(bloc.morceaux, 10.5, LARGEUR_UTILE - 20);
            const hauteur = lignes.length * 10.5 * 1.55;
            redacteur.place(hauteur + 8);
            redacteur.page.drawRectangle({
                x: MARGE, y: redacteur.y - hauteur + 6, width: 3, height: hauteur, color: COULEURS.secondaire
            });
            redacteur.paragraphe(lignes, { retrait: 14, espaceApres: 6 });
            continue;
        }

        redacteur.paragraphe(redacteur.lignes(bloc.morceaux, 10.5, LARGEUR_UTILE), {
            interligne: 10.5 * 1.6, espaceApres: 6
        });
    }

    redacteur.piedsDePage(meta.matieres + (meta.classes ? ' — ' + meta.classes : ''));
    const octets = await doc.save();
    return { octets: octets as Uint8Array, pages: doc.getPageCount() };
}

/* ----------------------------------- R2 ----------------------------------- */

function configurationR2() {
    const compte = Deno.env.get('R2_ACCOUNT_ID') || '';
    const acces = Deno.env.get('R2_ACCESS_KEY_ID') || '';
    const secret = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
    const bucket = Deno.env.get('R2_BUCKET') || 'learnhub-bibliotheque';
    const publicBase = (Deno.env.get('R2_PUBLIC_BASE') || '').replace(/\/+$/, '');
    if (!compte || !acces || !secret || !publicBase) return null;
    return { compte, acces, secret, bucket, publicBase };
}

async function envoyerVersR2(
    cfg: { compte: string; acces: string; secret: string; bucket: string; publicBase: string },
    cle: string,
    octets: Uint8Array
): Promise<string> {
    const client = new AwsClient({
        accessKeyId: cfg.acces,
        secretAccessKey: cfg.secret,
        service: 's3',
        region: 'auto'
    });
    const url = `https://${cfg.compte}.r2.cloudflarestorage.com/${cfg.bucket}/${cle}`;
    const resultat = await client.fetch(url, {
        method: 'PUT',
        body: octets,
        headers: { 'Content-Type': 'application/pdf' }
    });
    if (!resultat.ok) {
        const detail = await resultat.text().catch(() => '');
        throw new Error(`R2 a refusé l'envoi (HTTP ${resultat.status}) ${detail.slice(0, 160)}`);
    }
    return `${cfg.publicBase}/${cle}`;
}

/* --------------------------------- Handler --------------------------------- */

Deno.serve(async (requete: Request) => {
    if (requete.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (requete.method === 'GET') {
        const cfg = configurationR2();
        return reponse({
            ok: true,
            service: 'learnhub-livre',
            version: VERSION,
            stockage: cfg ? 'r2' : 'supabase',
            bucket: cfg ? cfg.bucket : 'documents'
        });
    }
    if (requete.method !== 'POST') return reponse({ ok: false, error: 'Méthode non autorisée.' }, 405);

    const urlSupabase = Deno.env.get('SUPABASE_URL') || '';
    const cle = clePublique();
    const jeton = (requete.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!jeton) return reponse({ ok: false, code: 'non_connecte', error: 'Connexion requise.' }, 401);
    if (!urlSupabase || !cle) {
        return reponse({ ok: false, code: 'configuration', error: 'Configuration serveur incomplète.' }, 500);
    }

    const entetes = { Authorization: 'Bearer ' + jeton };
    const supabase = createClient(urlSupabase, cle, {
        global: { headers: entetes },
        auth: { persistSession: false }
    });

    const { data: donneesUtilisateur, error: erreurUtilisateur } = await supabase.auth.getUser(jeton);
    const utilisateur = donneesUtilisateur?.user;
    if (erreurUtilisateur || !utilisateur) {
        return reponse({ ok: false, code: 'non_connecte', error: 'Session expirée.' }, 401);
    }

    let demande: { leconId?: string };
    try {
        demande = await requete.json();
    } catch {
        return reponse({ ok: false, error: 'Requête illisible.' }, 400);
    }
    const leconId = String(demande.leconId || '').trim();
    if (!leconId) return reponse({ ok: false, code: 'invalide', error: 'Identifiant de leçon manquant.' }, 400);

    // Seuls les enseignants (et super-administrateurs) fabriquent des livres.
    const { data: profil } = await supabase
        .from('profiles').select('id, username, role').eq('id', utilisateur.id).maybeSingle();
    if (!profil || (profil.role !== 'admin' && profil.role !== 'superadmin')) {
        return reponse({ ok: false, code: 'interdit', error: 'Seul un enseignant peut publier un livre.' }, 403);
    }

    const { data: lecon, error: erreurLecon } = await supabase
        .from('lessons').select('*').eq('id', leconId).maybeSingle();
    if (erreurLecon) {
        return reponse({ ok: false, code: 'erreur', error: erreurLecon.message }, 500);
    }
    if (!lecon) {
        return reponse({ ok: false, code: 'introuvable', error: 'Leçon introuvable ou non autorisée.' }, 404);
    }

    // Métadonnées de la couverture : matière, classes ciblées, enseignant.
    const classeIds: string[] = Array.isArray(lecon.classe_ids) ? lecon.classe_ids : [];
    let classes = '';
    if (classeIds.length) {
        const { data: lignesClasses } = await supabase.from('classes').select('nom').in('id', classeIds);
        classes = (lignesClasses || []).map((ligne: { nom: string }) => ligne.nom).join(', ');
    }
    const { data: enseignant } = await supabase
        .from('profiles').select('username').eq('espace_id', lecon.espace_id).eq('role', 'admin').maybeSingle();

    const meta = {
        matieres: NOMS_MATIERES[lecon.matiere] || assainir(lecon.matiere || 'Cours'),
        classes: assainir(classes),
        professeur: assainir(enseignant?.username || '')
    };

    let livre: { octets: Uint8Array; pages: number };
    try {
        livre = await composerLivre(lecon as Lecon, meta);
    } catch (erreur) {
        console.error('Composition du livre impossible :', erreur);
        return reponse({
            ok: false, code: 'composition',
            error: 'La mise en page du livre a échoué. Vérifiez les images jointes à la leçon.'
        }, 500);
    }

    const date = new Date().toISOString();
    const version = Date.now().toString(36);
    let url = '';
    let stockage = '';

    const cfg = configurationR2();
    if (cfg) {
        try {
            const cleObjet = `livres/${lecon.espace_id}/${lecon.id}.pdf`;
            url = await envoyerVersR2(cfg, cleObjet, livre.octets);
            url += `?v=${version}`;
            stockage = 'r2';
        } catch (erreur) {
            console.error('Dépôt R2 impossible :', erreur);
        }
    }

    if (!url) {
        // Repli : stockage Supabase, pour ne jamais bloquer la publication.
        const chemin = `livres/${utilisateur.id}/${lecon.id}-${version}.pdf`;
        const envoi = await supabase.storage.from('documents').upload(chemin, livre.octets, {
            contentType: 'application/pdf', upsert: true
        });
        if (envoi.error) {
            return reponse({ ok: false, code: 'stockage', error: envoi.error.message }, 500);
        }
        const publique = supabase.storage.from('documents').getPublicUrl(chemin);
        url = publique?.data?.publicUrl || '';
        stockage = 'supabase';
        if (!url) return reponse({ ok: false, code: 'stockage', error: 'URL publique introuvable.' }, 500);
    }

    const taille = tailleLisible(livre.octets.byteLength);
    const miseAJour = await supabase
        .from('lessons')
        .update({ livre_url: url, livre_taille: taille, livre_maj: date })
        .eq('id', leconId)
        .select('id');

    if (miseAJour.error) {
        return reponse({ ok: false, code: 'ecriture', error: miseAJour.error.message }, 500);
    }
    if (!miseAJour.data || !miseAJour.data.length) {
        return reponse({ ok: false, code: 'interdit', error: 'Vous ne pouvez pas modifier cette leçon.' }, 403);
    }

    return reponse({ ok: true, url, taille, date, pages: livre.pages, stockage });
});
