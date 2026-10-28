/**
 * LearnHub — photos du carrousel de la page d'accueil.
 *
 * Télécharge une photo paysage par diapositive et l'enregistre dans
 * assets/images/carrousel/. Les images sont servies localement : pas de lien
 * externe fragile, pas de dépendance à un CDN tiers.
 *
 * Sources (--source) :
 *   commons    Wikimedia Commons — aucune clé, licences libres (défaut)
 *   pixabay    Pixabay — clé gratuite requise (PIXABAY_KEY dans .env)
 *
 * Utilisation :
 *   node images-carrousel.js
 *   node images-carrousel.js --source pixabay
 *   node images-carrousel.js --sujet "laboratory science" --nom test
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

function chargerEnv(fichier) {
    const env = {};
    if (!fs.existsSync(fichier)) return env;
    for (const ligne of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
        const net = ligne.trim();
        if (!net || net.startsWith('#')) continue;
        const egal = net.indexOf('=');
        if (egal === -1) continue;
        env[net.slice(0, egal).trim()] = net.slice(egal + 1).trim();
    }
    return env;
}

const AGENT = 'LearnHub/1.0 (projet pedagogique; moyizaba@gmail.com)';

/** Un thème par diapositive, avec des requêtes de secours. */
const THEMES = [
    {
        nom: 'slide-1',
        description: 'Apprendre sans limites',
        requetes: [
            'Category:Reading Wikipedia in the Classroom in Rwanda',
            'Category:Classroom',
            'students classroom learning'
        ]
    },
    {
        nom: 'slide-2',
        description: 'Des exercices corrigés',
        requetes: [
            'Category:Reading Wikipedia in the classroom in Yemen 2023',
            'Category:Classroom',
            'school exercise notebook writing'
        ]
    },
    {
        nom: 'slide-3',
        description: 'La bibliothèque',
        requetes: [
            'Category:Interiors of libraries',
            'Category:Library interiors',
            'library books shelves'
        ]
    },
    {
        nom: 'slide-4',
        description: 'Suivre ses progrès',
        requetes: [
            'Category:Graduations',
            'Category:Graduation ceremonies',
            'graduation students diploma'
        ]
    },
    {
        nom: 'slide-5',
        description: 'Espace enseignant',
        requetes: [
            'Category:Reading Wikipedia in the Classroom in Tanzania 2026',
            "Category:Teacher's desk",
            'teacher blackboard classroom'
        ]
    }
];

function lireArguments() {
    const o = { source: 'commons', sujet: null, nom: null, fichier: null };
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--source') o.source = args[++i];
        else if (args[i] === '--sujet') o.sujet = args[++i];
        else if (args[i] === '--nom') o.nom = args[++i];
        else if (args[i] === '--fichier') o.fichier = args[++i];
    }
    return o;
}

/** Récupère une image précise de Commons à partir de son titre de fichier. */
async function fichierCommons(titre) {
    const nom = titre.startsWith('File:') ? titre : 'File:' + titre;
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
        '&titles=' + encodeURIComponent(nom) +
        '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600';
    const reponse = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (!reponse.ok) throw new Error('Wikimedia HTTP ' + reponse.status);
    const donnees = await reponse.json();
    const pages = donnees.query ? donnees.query.pages : null;
    if (!pages) throw new Error('fichier introuvable : ' + titre);
    const page = Object.values(pages)[0];
    const info = page && (page.imageinfo || [])[0];
    if (!info) throw new Error('fichier introuvable : ' + titre);
    const meta = info.extmetadata || {};
    return {
        url: info.thumburl || info.url,
        largeur: info.width,
        hauteur: info.height,
        licence: nettoyerHtml((meta.LicenseShortName || {}).value) || 'Wikimedia Commons',
        auteur: nettoyerHtml((meta.Artist || {}).value) || 'Auteur inconnu',
        page: info.descriptionurl || '',
        titre: String(page.title || '').replace(/^File:/, '')
    };
}

function nettoyerHtml(texte) {
    return String(texte || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

/* ------------------------------ Wikimedia --------------------------------- */

async function chercherCommons(requete) {
    // Une requête « Category:… » interroge les fichiers de la catégorie
    // (bien plus pertinente qu'une recherche par mots-clés).
    const parCategorie = requete.startsWith('Category:');
    const url = parCategorie
        ? 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers' +
          '&gcmtitle=' + encodeURIComponent(requete) + '&gcmtype=file&gcmlimit=40' +
          '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600'
        : 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search' +
          '&gsrsearch=' + encodeURIComponent(requete + ' filetype:bitmap') +
          '&gsrlimit=20&gsrnamespace=6' +
          '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600';

    const reponse = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (!reponse.ok) throw new Error('Wikimedia HTTP ' + reponse.status);
    const donnees = await reponse.json();
    const pages = donnees.query ? donnees.query.pages : null;
    if (!pages) return [];
    return Object.values(pages).map(function (page) {
        const info = (page.imageinfo || [])[0];
        if (!info) return null;
        const meta = info.extmetadata || {};
        return {
            url: info.thumburl || info.url,
            largeur: info.width,
            hauteur: info.height,
            licence: nettoyerHtml((meta.LicenseShortName || {}).value) || 'Wikimedia Commons',
            auteur: nettoyerHtml((meta.Artist || {}).value) || 'Auteur inconnu',
            page: info.descriptionurl || '',
            titre: String(page.title || '').replace(/^File:/, '')
        };
    }).filter(Boolean);
}

/* -------------------------------- Pixabay --------------------------------- */

async function chercherPixabay(cle, requete) {
    const url = 'https://pixabay.com/api/?key=' + encodeURIComponent(cle) +
        '&q=' + encodeURIComponent(requete) +
        '&image_type=photo&orientation=horizontal' +
        '&safesearch=true&per_page=20&order=popular';
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error('Pixabay HTTP ' + reponse.status);
    const donnees = await reponse.json();
    return (donnees.hits || []).map(function (h) {
        return {
            url: h.largeImageURL || h.webformatURL,
            largeur: h.imageWidth,
            hauteur: h.imageHeight,
            licence: 'Pixabay Content License',
            auteur: h.user || 'Auteur Pixabay',
            page: h.pageURL || ''
        };
    });
}

/* --------------------------------- Commun --------------------------------- */

/** Sélectionne une image paysage suffisamment grande. */
function choisir(candidats) {
    const utilisables = candidats.filter(function (c) {
        const ratio = c.largeur / c.hauteur;
        return c.largeur >= 1280 && c.hauteur >= 640 && ratio >= 1.4 && ratio <= 2.4;
    });
    return utilisables[0] || null;
}

async function telecharger(url, destination) {
    const reponse = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (!reponse.ok) throw new Error('téléchargement HTTP ' + reponse.status);
    const tampon = Buffer.from(await reponse.arrayBuffer());
    if (tampon.length < 20000) throw new Error('image trop petite (' + tampon.length + ' o)');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, tampon);
    return tampon.length;
}

async function principal() {
    const options = lireArguments();
    const env = chargerEnv(path.join(__dirname, '.env'));
    const clePixabay = process.env.PIXABAY_KEY || env.PIXABAY_KEY || '';

    if (options.source === 'pixabay' && !clePixabay) {
        throw new Error('Pixabay choisi mais PIXABAY_KEY absente de scripts/.env');
    }
    const source = options.source === 'pixabay' ? 'pixabay' : 'commons';

    const cibles = options.sujet
        ? [{ nom: options.nom || 'test', description: options.sujet, requetes: [options.sujet] }]
        : THEMES;

    const dossier = path.join(__dirname, '..', 'assets', 'images', 'carrousel');

    // Mode « fichier précis » : télécharge exactement l'image demandée.
    if (options.fichier) {
        const nomCible = options.nom || 'image';
        console.log('Fichier Commons : ' + options.fichier);
        const image = await fichierCommons(options.fichier);
        const fichier = path.join(dossier, nomCible + '.jpg');
        const octets = await telecharger(image.url, fichier);
        console.log('ok  ' + Math.round(octets / 1024) + ' Ko  ' + image.largeur + 'x' + image.hauteur + '  ' + image.licence);
        console.log('   ' + image.auteur);
        console.log('   ' + image.page);
        const fichierCredits = path.join(dossier, 'credits.json');
        let credits = [];
        if (fs.existsSync(fichierCredits)) {
            try { credits = JSON.parse(fs.readFileSync(fichierCredits, 'utf8')); } catch (e) { credits = []; }
        }
        credits = credits.filter(function (c) { return c.nom !== nomCible; });
        credits.push({ nom: nomCible, fichier: 'assets/images/carrousel/' + nomCible + '.jpg',
            auteur: image.auteur, licence: image.licence, page: image.page });
        credits.sort(function (a, b) { return a.nom.localeCompare(b.nom); });
        fs.writeFileSync(fichierCredits, JSON.stringify(credits, null, 2), 'utf8');
        console.log("\nEnregistré dans assets/images/carrousel/" + nomCible + '.jpg');
        return;
    }

    console.log('Source : ' + source + ' — ' + cibles.length + ' photo(s) à récupérer\n');

    const credits = [];

    for (const cible of cibles) {
        process.stdout.write('· ' + cible.description.padEnd(24) + ' ');
        let trouve = null;

        for (const requete of cible.requetes) {
            try {
                const candidats = source === 'pixabay'
                    ? await chercherPixabay(clePixabay, requete)
                    : await chercherCommons(requete);
                trouve = choisir(candidats);
                if (trouve) break;
            } catch (erreur) {
                console.log('(requête « ' + requete + ' » : ' + erreur.message + ')');
            }
        }

        if (!trouve) {
            console.log('aucune image exploitable');
            continue;
        }

        try {
            const fichier = path.join(dossier, cible.nom + '.jpg');
            const octets = await telecharger(trouve.url, fichier);
            console.log('ok  ' + Math.round(octets / 1024) + ' Ko  ' +
                trouve.largeur + 'x' + trouve.hauteur + '  ' + trouve.licence);
            credits.push({
                nom: cible.nom,
                fichier: 'assets/images/carrousel/' + cible.nom + '.jpg',
                auteur: trouve.auteur,
                licence: trouve.licence,
                page: trouve.page
            });
        } catch (erreur) {
            console.log('ECHEC — ' + erreur.message);
        }
    }

    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, 'credits.json'), JSON.stringify(credits, null, 2), 'utf8');

    console.log('\n──────────────────────────────────────');
    credits.forEach(function (c) {
        console.log(c.fichier);
        console.log('   ' + c.auteur + ' — ' + c.licence);
        console.log('   ' + c.page);
    });
    console.log('\nCrédits enregistrés dans assets/images/carrousel/credits.json');
}

principal().catch(function (e) {
    console.error('\nErreur : ' + e.message);
    process.exitCode = 1;
});
