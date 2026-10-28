/**
 * LearnHub — mise à niveau de la bibliothèque existante.
 *
 * Corrige les documents importés avant l'ajout de la visibilité :
 *   • applique une visibilité (« eleves » par défaut) ;
 *   • récupère titre, auteur, matière et niveau depuis le catalogue SQLite ;
 *   • supprime les doublons créés par un import de test sur R2.
 *
 * Utilisation :
 *   node enrichir-bibliotheque.js --dry-run
 *   node enrichir-bibliotheque.js
 *   node enrichir-bibliotheque.js --visibilite public
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

function lireArguments() {
    const args = process.argv.slice(2);
    const options = { simulation: false, visibilite: 'eleves', supprimerDoublonsR2: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run' || args[i] === '--simulation') options.simulation = true;
        else if (args[i] === '--visibilite') options.visibilite = args[++i];
        // Suppression des doublons d'import : désormais désactivée par défaut,
        // car l'ensemble de la bibliothèque est hébergée sur R2.
        else if (args[i] === '--supprimer-doublons-r2') options.supprimerDoublonsR2 = true;
    }
    return options;
}

/** Clé de rapprochement : nom sans extension, sans accents, sans ponctuation. */
function normaliser(texte) {
    return String(texte || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\.[a-z0-9]{2,5}$/, '')
        .replace(/[^a-z0-9]+/g, '');
}

function normaliserMatiere(valeur) {
    const t = String(valeur || '').trim().toLowerCase();
    const table = {
        'mathématiques': 'maths', 'mathematiques': 'maths', 'maths': 'maths',
        'littérature': 'francais', 'litterature': 'francais', 'français': 'francais', 'francais': 'francais',
        'physique': 'sciences', 'chimie': 'sciences', 'sciences': 'sciences', 'svt': 'sciences',
        'langues': 'langues', 'anglais': 'langues', 'espagnol': 'langues',
        'philosophie': 'philosophie', 'histoire': 'histoire',
        'géographie': 'geographie', 'geographie': 'geographie'
    };
    return table[t] || t.replace(/[^a-z0-9]+/g, '-');
}

function normaliserNiveau(valeur) {
    const t = String(valeur || '').trim().toLowerCase();
    if (!t) return '';
    if (/college|collège|^(6|5|4|3)e/.test(t)) return 'college';
    if (/lycee|lycée|2nde|1ere|1re|terminale/.test(t)) return 'lycee';
    if (/licence|master|prepa|prépa|bts|superieur|supérieur/.test(t)) return 'superieur';
    return t;
}

function lireCatalogue(dossierProjet) {
    const fichier = path.join(dossierProjet, 'database.db');
    if (!fs.existsSync(fichier)) return new Map();
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(fichier, { readOnly: true });
    const lignes = db.prepare('select titre, auteur, matiere, niveau, fichier_pdf from livres').all();
    db.close();
    const map = new Map();
    lignes.forEach(function (l) {
        if (!l.fichier_pdf) return;
        map.set(normaliser(l.fichier_pdf), {
            titre: String(l.titre || '').trim(),
            auteur: l.auteur && l.auteur !== 'Auteur inconnu' ? String(l.auteur).trim() : '',
            matiere: normaliserMatiere(l.matiere),
            niveau: normaliserNiveau(l.niveau)
        });
    });
    return map;
}

async function principal() {
    const options = lireArguments();
    const env = chargerEnv(path.join(__dirname, '.env'));
    const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
    if (!base) throw new Error('SUPABASE_URL manquant dans .env');

    const connexion = await fetch(base + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
    });
    const session = await connexion.json();
    if (!session.access_token) throw new Error('Connexion Supabase impossible.');
    const entetes = { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' };

    const reponse = await fetch(base + '/rest/v1/documents?select=id,titre,auteur,matiere,niveau,visibilite,url', { headers: entetes });
    const documents = await reponse.json();
    console.log(documents.length + ' document(s) en base.');

    const catalogue = lireCatalogue(env.BIBLIO_SOURCE || '');
    console.log(catalogue.size + ' entrée(s) dans le catalogue.');

    let enrichis = 0;
    let visibilites = 0;
    let doublons = 0;
    const inconnus = [];

    for (const doc of documents) {
        const ref = catalogue.get(normaliser(doc.titre));

        // Doublons d'un import de test sur R2 (même livre déjà présent).
        if (options.supprimerDoublonsR2 && /r2\.dev/.test(doc.url || '')) {
            doublons++;
            if (!options.simulation) {
                await fetch(base + '/rest/v1/documents?id=eq.' + encodeURIComponent(doc.id), { method: 'DELETE', headers: entetes });
            }
            continue;
        }

        const champs = {};

        if (ref) {
            if (ref.titre && ref.titre !== doc.titre) champs.titre = ref.titre;
            if (ref.auteur && ref.auteur !== doc.auteur) champs.auteur = ref.auteur;
            if (ref.matiere && ref.matiere !== doc.matiere) champs.matiere = ref.matiere;
            if (ref.niveau && ref.niveau !== doc.niveau) champs.niveau = ref.niveau;
        } else {
            inconnus.push(doc.titre);
        }

        if (doc.visibilite !== options.visibilite) champs.visibilite = options.visibilite;

        if (!Object.keys(champs).length) continue;
        if (champs.titre || champs.matiere || champs.niveau || champs.auteur) enrichis++;
        if (champs.visibilite) visibilites++;

        if (!options.simulation) {
            const maj = await fetch(base + '/rest/v1/documents?id=eq.' + encodeURIComponent(doc.id), {
                method: 'PATCH',
                headers: entetes,
                body: JSON.stringify(champs)
            });
            if (!maj.ok) console.log('  ! échec sur « ' + doc.titre + ' » : ' + (await maj.text()).slice(0, 120));
        }
    }

    console.log('\n──────────────────────────────────────');
    console.log((options.simulation ? 'SIMULATION — ' : '') + 'Résumé :');
    console.log('Métadonnées complétées : ' + enrichis);
    console.log('Visibilité corrigée    : ' + visibilites + ' → ' + options.visibilite);
    console.log('Doublons R2 supprimés  : ' + doublons);
    console.log('Hors catalogue         : ' + inconnus.length);
    if (inconnus.length) inconnus.slice(0, 8).forEach(function (t) { console.log('  · ' + t); });
}

principal().catch(function (e) {
    console.error('Erreur : ' + e.message);
    process.exitCode = 1;
});
