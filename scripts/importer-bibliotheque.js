/**
 * LearnHub — import massif de la bibliothèque.
 *
 * Envoie les fichiers d'un dossier vers Cloudflare R2 (stockage objet) puis
 * enregistre leurs métadonnées dans la table Supabase `documents`.
 *
 * Le script est reprenable : relancé après une coupure, il saute les fichiers
 * déjà envoyés et met à jour les lignes existantes au lieu de les dupliquer.
 *
 * Prérequis : Node.js 20+ (idéalement 22+), `npm install` dans ce dossier,
 * un fichier `.env` (voir `.env.example`) et les droits de publication
 * (compte enseignant ou super-administrateur).
 *
 * Utilisation :
 *   node importer-bibliotheque.js
 *   node importer-bibliotheque.js --source "C:\\chemin\\vers\\projet" --limit 20
 *   node importer-bibliotheque.js --dry-run
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/* --------------------------------- Options --------------------------------- */

function lireArguments() {
    const args = process.argv.slice(2);
    const options = {
        source: null,
        limite: 0,
        simulation: false,
        reinitialiser: false,
        dossierCatalogue: 'pdf'
    };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--source') options.source = args[++i];
        else if (a === '--limit') options.limite = Number(args[++i]) || 0;
        else if (a === '--dry-run' || a === '--simulation') options.simulation = true;
        else if (a === '--reset') options.reinitialiser = true;
        else if (a === '--help' || a === '-h') options.aide = true;
        else if (!a.startsWith('-') && !options.source) options.source = a;
    }
    return options;
}

function chargerEnv(fichier) {
    if (!fs.existsSync(fichier)) return;
    const contenu = fs.readFileSync(fichier, 'utf8');
    for (const ligne of contenu.split(/\r?\n/)) {
        const net = ligne.trim();
        if (!net || net.startsWith('#')) continue;
        const egal = net.indexOf('=');
        if (egal === -1) continue;
        const cle = net.slice(0, egal).trim();
        let valeur = net.slice(egal + 1).trim();
        if ((valeur.startsWith('"') && valeur.endsWith('"')) || (valeur.startsWith("'") && valeur.endsWith("'"))) {
            valeur = valeur.slice(1, -1);
        }
        if (!process.env[cle]) process.env[cle] = valeur;
    }
}

/* ------------------------------- Catalogue --------------------------------- */

/** Traduit une matière libre du catalogue vers les filtres du site. */
function normaliserMatiere(valeur) {
    const texte = String(valeur || '').trim().toLowerCase();
    if (!texte) return '';
    const table = {
        'mathématiques': 'maths',
        'mathematiques': 'maths',
        'maths': 'maths',
        'littérature': 'francais',
        'litterature': 'francais',
        'français': 'francais',
        'francais': 'francais',
        'physique': 'sciences',
        'chimie': 'sciences',
        'sciences': 'sciences',
        'svt': 'sciences',
        'langues': 'langues',
        'anglais': 'langues',
        'espagnol': 'langues',
        'philosophie': 'philosophie',
        'histoire': 'histoire',
        'géographie': 'geographie',
        'geographie': 'geographie'
    };
    return table[texte] || texte.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normaliserNiveau(valeur) {
    const texte = String(valeur || '').trim().toLowerCase();
    if (!texte) return '';
    if (/^(6|5|4|3)e|college|collège/.test(texte)) return 'college';
    if (/2nde|1ere|1re|terminale|lycee|lycée/.test(texte)) return 'lycee';
    if (/licence|master|prepa|prépa|bts|superieur|supérieur|université/.test(texte)) return 'superieur';
    return texte;
}

function normaliserType(nomFichier) {
    const extension = path.extname(String(nomFichier || '')).toLowerCase();
    if (extension === '.pdf') return 'pdf';
    if (['.doc', '.docx', '.odt', '.rtf', '.txt', '.epub'].includes(extension)) return 'word';
    return 'autre';
}

function titreDepuisNom(nom) {
    const base = path
        .basename(String(nom || ''), path.extname(String(nom || '')))
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!base) return 'Document';
    return base.charAt(0).toUpperCase() + base.slice(1);
}

function formaterTaille(octets) {
    const n = Number(octets) || 0;
    if (n < 1024) return n + ' o';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
    return (n / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
}

/** Lit la table `livres` de la base SQLite du projet Biblio (si elle existe). */
function lireCatalogue(dossierProjet) {
    const fichierDb = path.join(dossierProjet, 'database.db');
    if (!fs.existsSync(fichierDb)) return [];
    try {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(fichierDb, { readOnly: true });
        const lignes = db.prepare('select titre, auteur, matiere, niveau, fichier_pdf, description from livres').all();
        db.close();
        return lignes;
    } catch (erreur) {
        console.warn('  ! Catalogue illisible (' + erreur.message + '), les titres seront déduits des noms de fichiers.');
        return [];
    }
}

function construireEntrees(dossierProjet, sousDossier) {
    const dossier = path.join(dossierProjet, sousDossier);
    if (!fs.existsSync(dossier)) {
        throw new Error('Dossier introuvable : ' + dossier);
    }

    const catalogue = lireCatalogue(dossierProjet);
    const parFichier = new Map();
    catalogue.forEach(function (ligne) {
        if (ligne.fichier_pdf) parFichier.set(String(ligne.fichier_pdf), ligne);
    });

    const extensions = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt', '.epub'];
    const entrees = [];

    fs.readdirSync(dossier, { withFileTypes: true })
        .filter(function (d) { return d.isFile() && extensions.includes(path.extname(d.name).toLowerCase()); })
        .forEach(function (d) {
            const complet = path.join(dossier, d.name);
            const infos = fs.statSync(complet);
            const ligne = parFichier.get(d.name);
            entrees.push({
                fichier: d.name,
                chemin: complet,
                tailleOctets: infos.size,
                taille: formaterTaille(infos.size),
                titre: (ligne && ligne.titre ? String(ligne.titre) : titreDepuisNom(d.name)).trim(),
                auteur: ligne && ligne.auteur && ligne.auteur !== 'Auteur inconnu' ? String(ligne.auteur) : '',
                matiere: normaliserMatiere(ligne && ligne.matiere),
                niveau: normaliserNiveau(ligne && ligne.niveau),
                description: ligne && ligne.description ? String(ligne.description) : '',
                type: normaliserType(d.name)
            });
        });

    entrees.sort(function (a, b) { return a.fichier.localeCompare(b.fichier, 'fr'); });
    return entrees;
}

/* ---------------------------------- R2 ------------------------------------- */

function creerClientR2(env) {
    const { S3Client } = require('@aws-sdk/client-s3');
    return new S3Client({
        region: 'auto',
        endpoint: 'https://' + env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
        credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY
        }
    });
}

function typeMime(nomFichier) {
    const extension = path.extname(String(nomFichier || '')).toLowerCase();
    const table = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.odt': 'application/vnd.oasis.opendocument.text',
        '.rtf': 'application/rtf',
        '.txt': 'text/plain; charset=utf-8',
        '.epub': 'application/epub+zip'
    };
    return table[extension] || 'application/octet-stream';
}

/** Nom d'objet sûr et stable : mêmes fichiers = mêmes clés. */
function cleObjet(nomFichier) {
    const extension = path.extname(nomFichier).toLowerCase();
    const base = path.basename(nomFichier, extension)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .toLowerCase();
    const empreinte = crypto.createHash('sha1').update(nomFichier).digest('hex').slice(0, 8);
    return 'livres/' + (base || 'document') + '-' + empreinte + extension;
}

async function envoyerVersR2(client, env, entree) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const cle = cleObjet(entree.fichier);
    const corps = fs.readFileSync(entree.chemin);
    await client.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: cle,
        Body: corps,
        ContentType: typeMime(entree.fichier),
        CacheControl: 'public, max-age=31536000, immutable'
    }));
    return cle;
}

/* -------------------------------- Supabase --------------------------------- */

async function connecterSupabase(env) {
    const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
    const reponse = await fetch(url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
    });
    const donnees = await reponse.json();
    if (!reponse.ok || !donnees.access_token) {
        throw new Error('Connexion Supabase impossible : ' + (donnees.error_description || donnees.msg || donnees.message || reponse.status));
    }
    return { url: url, jeton: donnees.access_token };
}

async function enregistrerDocument(session, env, entree, urlPublique) {
    const identifiant = 'doc-' + crypto.createHash('sha1').update(entree.fichier).digest('hex').slice(0, 18);
    const ligne = {
        id: identifiant,
        titre: entree.titre,
        description: entree.description || null,
        matiere: entree.matiere || null,
        niveau: entree.niveau || null,
        type: entree.type,
        url: urlPublique,
        taille: entree.taille,
        auteur: entree.auteur || null
    };
    const reponse = await fetch(session.url + '/rest/v1/documents?on_conflict=id', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + session.jeton,
            Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify([ligne])
    });
    if (!reponse.ok) {
        const texte = await reponse.text();
        throw new Error('Enregistrement refusé (' + reponse.status + ') : ' + texte.slice(0, 200));
    }
    return identifiant;
}

/* ---------------------------------- État ----------------------------------- */

function lireEtat(fichier) {
    if (!fs.existsSync(fichier)) return { faits: {} };
    try {
        return JSON.parse(fs.readFileSync(fichier, 'utf8'));
    } catch (e) {
        return { faits: {} };
    }
}

function ecrireEtat(fichier, etat) {
    fs.writeFileSync(fichier, JSON.stringify(etat, null, 2), 'utf8');
}

/* ---------------------------------- Main ----------------------------------- */

async function principal() {
    const options = lireArguments();
    const dossierScript = __dirname;
    chargerEnv(path.join(dossierScript, '.env'));

    if (options.aide) {
        console.log([
            'Usage : node importer-bibliotheque.js [options]',
            '',
            '  --source <dossier>  Projet contenant database.db et le dossier des livres',
            '                      (défaut : BIBLIO_SOURCE du .env)',
            '  --limit <n>         N\'importer que les n premiers fichiers',
            '  --dry-run           Simuler sans rien envoyer',
            '  --reset             Ignorer l\'état de reprise et tout réimporter'
        ].join('\n'));
        return;
    }

    const env = process.env;
    const source = options.source || env.BIBLIO_SOURCE;
    if (!source) throw new Error('Indiquez le dossier source : --source "C:\\chemin\\du\\projet".');

    const manquants = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE',
        'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']
        .filter(function (cle) { return !env[cle]; });
    // La simulation n'a besoin d'aucune clé : elle sert justement à vérifier le catalogue.
    if (manquants.length && !options.simulation) {
        throw new Error('Variables manquantes dans .env : ' + manquants.join(', '));
    }
    if (manquants.length && options.simulation) {
        console.log('(simulation : variables absentes tolérées — ' + manquants.join(', ') + ')\n');
    }

    console.log('LearnHub — import de la bibliothèque');
    console.log('Source   : ' + path.resolve(source));
    console.log('Bucket   : ' + env.R2_BUCKET);
    console.log('Public   : ' + env.R2_PUBLIC_BASE);
    console.log('');

    const toutes = construireEntrees(source, options.dossierCatalogue);
    const entrees = options.limite ? toutes.slice(0, options.limite) : toutes;
    const poidsTotal = entrees.reduce(function (acc, e) { return acc + e.tailleOctets; }, 0);

    console.log(entrees.length + ' fichier(s), ' + formaterTaille(poidsTotal) + ' à envoyer.');
    if (options.simulation) {
        entrees.slice(0, 10).forEach(function (e) {
            console.log('  · ' + e.fichier + '  →  « ' + e.titre + ' »  [' + e.matiere + '/' + e.niveau + '/' + e.type + ']');
        });
        if (entrees.length > 10) console.log('  … et ' + (entrees.length - 10) + ' autre(s)');
        console.log('\nMode simulation : rien n\'a été envoyé.');
        return;
    }

    const fichierEtat = path.join(dossierScript, '.import-state.json');
    const etat = options.reinitialiser ? { faits: {} } : lireEtat(fichierEtat);

    const client = creerClientR2(env);
    const session = await connecterSupabase(env);
    console.log('Connecté à Supabase. Début de l\'envoi…\n');

    let reussis = 0;
    let ignores = 0;
    const echecs = [];
    const debut = Date.now();

    for (let index = 0; index < entrees.length; index++) {
        const entree = entrees[index];
        const prefixe = '[' + String(index + 1).padStart(3, ' ') + '/' + entrees.length + ']';

        if (etat.faits[entree.fichier]) {
            ignores++;
            continue;
        }

        let derniereErreur = null;
        let fait = false;
        for (let essai = 1; essai <= 3 && !fait; essai++) {
            try {
                const cle = await envoyerVersR2(client, env, entree);
                const urlPublique = String(env.R2_PUBLIC_BASE).replace(/\/+$/, '') + '/' + cle;
                await enregistrerDocument(session, env, entree, urlPublique);
                etat.faits[entree.fichier] = { cle: cle, url: urlPublique, quand: new Date().toISOString() };
                ecrireEtat(fichierEtat, etat);
                fait = true;
                reussis++;
                console.log(prefixe + ' ok   ' + entree.fichier + '  (' + entree.taille + ')');
            } catch (erreur) {
                derniereErreur = erreur;
                if (essai < 3) await new Promise(function (r) { setTimeout(r, 1500 * essai); });
            }
        }

        if (!fait) {
            echecs.push({ fichier: entree.fichier, erreur: derniereErreur.message });
            console.log(prefixe + ' ECHEC ' + entree.fichier + ' — ' + derniereErreur.message);
        }
    }

    const duree = Math.round((Date.now() - debut) / 1000);
    console.log('\n──────────────────────────────────────');
    console.log('Envoyés   : ' + reussis);
    console.log('Déjà faits: ' + ignores);
    console.log('Échecs    : ' + echecs.length);
    console.log('Durée     : ' + duree + ' s');
    if (echecs.length) {
        console.log('\nFichiers en échec (relancez le script pour réessayer) :');
        echecs.forEach(function (e) { console.log('  · ' + e.fichier + ' — ' + e.erreur); });
    }
    console.log('\nTerminé. La bibliothèque est visible sur #/bibliotheque.');
}

principal().catch(function (erreur) {
    console.error('\nErreur : ' + erreur.message);
    process.exitCode = 1;
});
