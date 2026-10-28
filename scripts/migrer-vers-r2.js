/**
 * LearnHub — migration des fichiers de Supabase Storage vers Cloudflare R2.
 *
 * Pour chaque document dont l'URL pointe encore sur Supabase Storage :
 *   1. télécharge le fichier ;
 *   2. l'envoie sur R2 (flux, sans tout charger en mémoire) ;
 *   3. met à jour l'URL en base.
 * Ensuite, optionnellement, supprime les fichiers de Supabase Storage.
 *
 * Reprenable : un fichier déjà migré est ignoré au prochain lancement.
 *
 *   node migrer-vers-r2.js --dry-run
 *   node migrer-vers-r2.js --limit 10
 *   node migrer-vers-r2.js
 *   node migrer-vers-r2.js --sans-suppression
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function chargerEnv(fichier) {
    const env = {};
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
    const o = { simulation: false, limite: 0, supprimer: true };
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run' || args[i] === '--simulation') o.simulation = true;
        else if (args[i] === '--limit') o.limite = Number(args[++i]) || 0;
        else if (args[i] === '--sans-suppression') o.supprimer = false;
    }
    return o;
}

function formaterTaille(n) {
    const v = Number(n) || 0;
    if (v < 1024) return v + ' o';
    if (v < 1024 * 1024) return Math.round(v / 1024) + ' Ko';
    return (v / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
}

function typeMime(nom) {
    const e = path.extname(String(nom || '')).toLowerCase();
    return {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.odt': 'application/vnd.oasis.opendocument.text',
        '.rtf': 'application/rtf',
        '.txt': 'text/plain; charset=utf-8',
        '.epub': 'application/epub+zip'
    }[e] || 'application/octet-stream';
}

function cleObjet(document, cheminSource) {
    const extension = path.extname(cheminSource || '') || '.pdf';
    const base = String(document.titre || 'document')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .toLowerCase();
    const empreinte = crypto.createHash('sha1').update(String(document.id)).digest('hex').slice(0, 8);
    return 'livres/' + (base || 'document') + '-' + empreinte + extension;
}

/** Extrait le chemin de l'objet dans le bucket « documents » de Supabase. */
function cheminSupabase(url) {
    const m = String(url || '').match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/([^?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
}

async function principal() {
    const options = lireArguments();
    const dossier = __dirname;
    const env = chargerEnv(path.join(dossier, '.env'));
    const base = String(env.SUPABASE_URL).replace(/\/+$/, '');
    const { S3Client, PutObjectCommand } = require(path.join(dossier, 'node_modules', '@aws-sdk', 'client-s3'));

    const client = new S3Client({
        region: 'auto',
        endpoint: 'https://' + env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
        credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }
    });

    const auth = await fetch(base + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
    });
    const session = await auth.json();
    if (!session.access_token) throw new Error('Connexion Supabase impossible.');
    const entetes = { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' };

    const reponse = await fetch(base + '/rest/v1/documents?select=id,titre,url,taille,type&order=titre', { headers: entetes });
    const documents = await reponse.json();

    const aMigrer = documents.filter(function (d) {
        return cheminSupabase(d.url) && !/r2\.dev/.test(d.url);
    });
    const dejaSurR2 = documents.filter(function (d) { return /r2\.dev/.test(d.url || ''); });

    console.log('Documents en base        : ' + documents.length);
    console.log('Déjà sur R2              : ' + dejaSurR2.length);
    console.log('À migrer                 : ' + aMigrer.length);

    const liste = options.limite ? aMigrer.slice(0, options.limite) : aMigrer;
    if (options.simulation) {
        liste.slice(0, 12).forEach(function (d) {
            console.log('  · ' + d.titre + '  (' + (d.taille || '?') + ')');
        });
        if (liste.length > 12) console.log('  … et ' + (liste.length - 12) + ' autre(s)');
        console.log('\nSimulation : aucun transfert effectué.');
        return;
    }

    const fichierEtat = path.join(dossier, '.migration-r2.json');
    let etat = { faits: {} };
    if (fs.existsSync(fichierEtat)) {
        try { etat = JSON.parse(fs.readFileSync(fichierEtat, 'utf8')); } catch (e) { /* état neuf */ }
    }

    const aFaire = liste.filter(function (d) { return !etat.faits[d.id]; });
    console.log('Reste à transférer       : ' + aFaire.length + '\n');

    let reussis = 0;
    const echecs = [];
    const debut = Date.now();
    const migratedPaths = [];

    for (let i = 0; i < aFaire.length; i++) {
        const doc = aFaire[i];
        const prefixe = '[' + String(i + 1).padStart(3, ' ') + '/' + aFaire.length + ']';
        const chemin = cheminSupabase(doc.url);
        let fait = false;
        let derniere = null;

        for (let essai = 1; essai <= 3 && !fait; essai++) {
            try {
                const source = await fetch(doc.url);
                if (!source.ok) throw new Error('téléchargement HTTP ' + source.status);
                const longueur = Number(source.headers.get('content-length') || 0);
                const cle = cleObjet(doc, chemin);

                await client.send(new PutObjectCommand({
                    Bucket: env.R2_BUCKET,
                    Key: cle,
                    Body: Buffer.from(await source.arrayBuffer()),
                    ContentLength: longueur || undefined,
                    ContentType: typeMime(chemin),
                    CacheControl: 'public, max-age=31536000, immutable'
                }));

                const urlR2 = String(env.R2_PUBLIC_BASE).replace(/\/+$/, '') + '/' + cle;
                const maj = await fetch(base + '/rest/v1/documents?id=eq.' + encodeURIComponent(doc.id), {
                    method: 'PATCH',
                    headers: entetes,
                    body: JSON.stringify({ url: urlR2 })
                });
                if (!maj.ok) throw new Error('mise à jour base : ' + (await maj.text()).slice(0, 120));

                etat.faits[doc.id] = { cle: cle, chemin: chemin, quand: new Date().toISOString() };
                fs.writeFileSync(fichierEtat, JSON.stringify(etat, null, 1), 'utf8');
                migratedPaths.push(chemin);
                reussis++;
                fait = true;
                console.log(prefixe + ' ok   ' + doc.titre.slice(0, 60) + '  (' + formaterTaille(longueur) + ')');
            } catch (erreur) {
                derniere = erreur;
                if (essai < 3) await new Promise(function (r) { setTimeout(r, 1200 * essai); });
            }
        }

        if (!fait) {
            echecs.push({ titre: doc.titre, erreur: derniere.message });
            console.log(prefixe + ' ECHEC ' + doc.titre.slice(0, 50) + ' — ' + derniere.message);
        }
    }

    const dureeSecondes = Math.round((Date.now() - debut) / 1000);
    console.log('\n──────────────────────────────────────');
    console.log('Migrés  : ' + reussis);
    console.log('Échecs  : ' + echecs.length);
    console.log('Durée   : ' + (dureeSecondes < 60 ? dureeSecondes + ' s' : Math.round(dureeSecondes / 60) + ' min'));
    if (echecs.length) {
        echecs.slice(0, 10).forEach(function (e) { console.log('  · ' + e.titre + ' — ' + e.erreur); });
    }

    if (options.supprimer && migratedPaths.length) {
        console.log('\nSuppression des fichiers migrés dans Supabase Storage…');
        let supprimes = 0;
        for (let i = 0; i < migratedPaths.length; i += 50) {
            const lot = migratedPaths.slice(i, i + 50);
            const r = await fetch(base + '/storage/v1/object/documents', {
                method: 'DELETE',
                headers: entetes,
                body: JSON.stringify({ prefixes: lot })
            });
            if (r.ok) supprimes += lot.length;
            else console.log('  ! lot en échec : ' + (await r.text()).slice(0, 150));
        }
        console.log('Fichiers supprimés de Supabase : ' + supprimes);
        if (supprimes < migratedPaths.length) {
            console.log('Relancez le script pour terminer le nettoyage (les fichiers déjà sur R2 sont ignorés).');
        }
    }

    console.log('\nTerminé.');
}

principal().catch(function (e) {
    console.error('Erreur : ' + e.message);
    process.exitCode = 1;
});
