/**
 * LearnHub — adaptateur Supabase.
 *
 * Le site reste statique (GitHub Pages) : ce module appelle l'API Supabase.
 * Les vues continuent de lire `LearnHubStore` de façon synchrone ; les données
 * distantes sont chargées dans un cache mémoire au démarrage de la session.
 *
 * Si la configuration est absente ou si `backend` vaut false, l'application
 * reste en mode local (localStorage) comme avant.
 */
window.LearnHubBackend = (function () {
    'use strict';

    const config = window.LearnHubConfig || {};
    const url = String(config.supabaseUrl || '').trim();
    const cle = String(config.supabaseKey || '').trim();
    const active = !!(config.backend !== false && url && cle && window.supabase && typeof window.supabase.createClient === 'function');

    const TABLES = {
        exercices: 'exercises',
        ressources: 'resources',
        lecons: 'lessons',
        classes: 'classes',
        seances: 'seances',
        messages: 'messages'
    };

    let client = null;
    let profil = null;
    let espaces = [];
    let utilisateurs = [];
    let cache = null;
    let progression = {};
    let derniereErreur = null;

    if (active) {
        try {
            client = window.supabase.createClient(url, cle, {
                auth: { persistSession: true, autoRefreshToken: true }
            });
        } catch (erreur) {
            console.error('Supabase : initialisation impossible', erreur);
            client = null;
        }
    }

    function disponible() {
        return active && !!client;
    }

    function estActif() {
        return disponible() && !!profil;
    }

    function profilCourant() {
        return profil;
    }

    function cacheDonnees() {
        return cache;
    }

    function utilisateursCache() {
        return utilisateurs;
    }

    function progressionCache() {
        return progression;
    }

    function listeEspaces() {
        return espaces;
    }

    function signaler(erreur) {
        derniereErreur = erreur;
        console.error('Supabase :', erreur);
        try {
            window.dispatchEvent(new CustomEvent('learnhub:backend-error', {
                detail: (erreur && erreur.message) || String(erreur)
            }));
        } catch (e) { /* ignore */ }
    }

    /* ------------------------------- Mapping ------------------------------- */

    function versUtilisateur(row) {
        const espace = espaces.find(function (e) { return e.id === row.espace_id; });
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            role: row.role,
            espaceId: row.espace_id || null,
            espaceNom: espace ? espace.nom : null,
            classeId: row.classe_id || null,
            cree: row.created_at
        };
    }

    function versClasse(row) {
        return {
            id: row.id,
            espaceId: row.espace_id,
            nom: row.nom,
            niveau: row.niveau || '',
            description: row.description || '',
            code: row.code,
            cree: row.created_at
        };
    }

    function versLecon(row) {
        return {
            id: row.id,
            espaceId: row.espace_id,
            titre: row.titre,
            matiere: row.matiere,
            niveau: row.niveau || '',
            duree: row.duree || 30,
            resume: row.resume || '',
            objectifs: row.objectifs || [],
            contenu: row.contenu || '',
            contenuHtml: row.contenu_html || '',
            cree: row.created_at,
            maj: row.updated_at
        };
    }

    function versExercice(row) {
        return {
            id: row.id,
            espaceId: row.espace_id,
            titre: row.titre,
            matiere: row.matiere,
            type: row.type,
            actif: row.actif !== false,
            temps: row.temps || null,
            questions: row.questions || [],
            pairs: row.pairs || [],
            quotes: row.quotes || [],
            cree: row.created_at,
            maj: row.updated_at
        };
    }

    function versRessource(row) {
        return {
            id: row.id,
            espaceId: row.espace_id,
            titre: row.titre,
            type: row.type || '',
            url: row.url,
            taille: row.taille || '',
            date: row.created_at
        };
    }

    function versSeance(row) {
        return {
            id: row.id,
            espaceId: row.espace_id,
            titre: row.titre,
            description: row.description || '',
            date: row.date,
            duree: row.duree || 60,
            publie: row.publie !== false,
            classeIds: row.classe_ids || [],
            chapitres: row.chapter_ids || [],
            lecons: row.lesson_ids || [],
            exercices: row.exercise_ids || [],
            cree: row.created_at,
            maj: row.updated_at
        };
    }

    function versLigne(cle, item) {
        const espaceId = item.espaceId || (profil && profil.espace_id) || null;

        if (cle === 'classes') {
            return {
                id: item.id,
                espace_id: espaceId,
                nom: item.nom,
                niveau: item.niveau || null,
                description: item.description || null,
                code: item.code
            };
        }
        if (cle === 'lecons') {
            return {
                id: item.id,
                espace_id: espaceId,
                titre: item.titre,
                matiere: item.matiere,
                niveau: item.niveau || null,
                duree: item.duree || 30,
                resume: item.resume || null,
                objectifs: item.objectifs || [],
                contenu: item.contenu || '',
                contenu_html: item.contenuHtml || null
            };
        }
        if (cle === 'exercices') {
            return {
                id: item.id,
                espace_id: espaceId,
                titre: item.titre,
                matiere: item.matiere,
                type: item.type,
                actif: item.actif !== false,
                temps: item.temps || null,
                questions: item.questions || [],
                pairs: item.pairs || [],
                quotes: item.quotes || []
            };
        }
        if (cle === 'ressources') {
            return {
                id: item.id,
                espace_id: espaceId,
                titre: item.titre,
                type: item.type || null,
                url: item.url,
                taille: item.taille || null
            };
        }
        if (cle === 'seances') {
            return {
                id: item.id,
                espace_id: espaceId,
                titre: item.titre,
                description: item.description || null,
                date: item.date,
                duree: item.duree || 60,
                publie: item.publie !== false,
                classe_ids: item.classeIds || [],
                chapter_ids: item.chapitres || [],
                lesson_ids: item.lecons || [],
                exercise_ids: item.exercices || []
            };
        }
        if (cle === 'messages') {
            return {
                id: item.id,
                nom: item.nom,
                email: item.email,
                sujet: item.sujet,
                message: item.message
            };
        }
        return null;
    }

    /* ----------------------------- Chargement ----------------------------- */

    async function chargerProfil() {
        if (!disponible()) return null;
        const session = await client.auth.getSession();
        const utilisateur = session && session.data && session.data.session && session.data.session.user;
        if (!utilisateur) {
            profil = null;
            return null;
        }
        const resultat = await client.from('profiles').select('*').eq('id', utilisateur.id).maybeSingle();
        if (resultat.error) {
            signaler(resultat.error);
            profil = null;
            return null;
        }
        profil = resultat.data || null;
        return profil;
    }

    async function chargerTout() {
        if (!estActif()) return;
        const cles = window.LearnHubStore.keys;
        const reponses = await Promise.all([
            client.from('espaces').select('*'),
            client.from('profiles').select('*'),
            client.from('classes').select('*'),
            client.from('lessons').select('*'),
            client.from('exercises').select('*'),
            client.from('resources').select('*'),
            client.from('seances').select('*'),
            client.from('attempts').select('*'),
            client.from('messages').select('*')
        ]);

        reponses.forEach(function (reponse) {
            if (reponse.error) signaler(reponse.error);
        });

        const espacesRows = reponses[0].data || [];
        const profilsRows = reponses[1].data || [];
        const classesRows = reponses[2].data || [];
        const leconsRows = reponses[3].data || [];
        const exercicesRows = reponses[4].data || [];
        const ressourcesRows = reponses[5].data || [];
        const seancesRows = reponses[6].data || [];
        const attemptsRows = reponses[7].data || [];
        const messagesRows = reponses[8].data || [];

        espaces = espacesRows;
        utilisateurs = profilsRows.map(versUtilisateur);

        cache = {};
        cache[cles.classes] = classesRows.map(versClasse);
        cache[cles.lecons] = leconsRows.map(versLecon);
        cache[cles.exercices] = exercicesRows.map(versExercice);
        cache[cles.ressources] = ressourcesRows.map(versRessource);
        cache[cles.seances] = seancesRows.map(versSeance);
        cache[cles.messages] = messagesRows.map(function (row) {
            return {
                id: row.id,
                nom: row.nom,
                email: row.email,
                sujet: row.sujet,
                message: row.message,
                date: row.created_at
            };
        });

        progression = {};
        attemptsRows.forEach(function (tentative) {
            const auteur = utilisateurs.find(function (u) { return u.id === tentative.user_id; });
            if (!auteur) return;
            if (!progression[auteur.username]) progression[auteur.username] = [];
            progression[auteur.username].push({
                id: tentative.id,
                exerciceId: tentative.exercise_id,
                type: tentative.type,
                titre: tentative.titre,
                score: tentative.score,
                total: tentative.total,
                date: tentative.created_at
            });
        });
    }

    async function initSession() {
        if (!disponible()) return null;
        const profilCharge = await chargerProfil();
        if (!profilCharge) return null;
        await chargerTout();
        return profil;
    }

    /* ------------------------------- Auth -------------------------------- */

    function traduireErreur(erreur) {
        const message = (erreur && erreur.message) || '';
        if (/invalid login credentials/i.test(message)) return 'Identifiants incorrects.';
        if (/email not confirmed/i.test(message)) return 'Confirmez votre adresse e-mail avant de vous connecter.';
        if (/user already registered/i.test(message)) return 'Cette adresse e-mail est déjà utilisée.';
        if (/password should be at least/i.test(message)) return 'Le mot de passe doit contenir au moins 6 caractères.';
        if (/unable to validate email/i.test(message)) return 'Adresse e-mail invalide.';
        return message || 'Erreur d’authentification.';
    }

    async function connecter(email, motDePasse) {
        if (!disponible()) return { ok: false, error: 'Backend indisponible.' };
        const resultat = await client.auth.signInWithPassword({ email: email, password: motDePasse });
        if (resultat.error) return { ok: false, error: traduireErreur(resultat.error) };
        const profilCharge = await initSession();
        if (!profilCharge) {
            await client.auth.signOut();
            return { ok: false, error: 'Profil introuvable. Le schéma Supabase est-il bien installé ?' };
        }
        return { ok: true };
    }

    async function inscrire(donnees) {
        if (!disponible()) return { ok: false, error: 'Backend indisponible.' };
        const resultat = await client.auth.signUp({
            email: donnees.email,
            password: donnees.password,
            options: {
                data: {
                    username: donnees.username,
                    role: donnees.enseignant ? 'admin' : 'eleve'
                }
            }
        });
        if (resultat.error) return { ok: false, error: traduireErreur(resultat.error) };
        if (!resultat.data || !resultat.data.session) {
            return { ok: true, confirmation: true };
        }
        const profilCharge = await initSession();
        if (!profilCharge) {
            await new Promise(function (resolve) { setTimeout(resolve, 400); });
            const second = await initSession();
            if (!second) return { ok: true, confirmation: true };
        }
        return { ok: true };
    }

    async function deconnecter() {
        if (!disponible()) return;
        await client.auth.signOut();
        profil = null;
        cache = null;
        utilisateurs = [];
        espaces = [];
        progression = {};
    }

    async function changerMotDePasse(actuel, nouveau) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        const verification = await client.auth.signInWithPassword({
            email: profil.email,
            password: actuel
        });
        if (verification.error) return { ok: false, error: 'Mot de passe actuel incorrect.' };
        const resultat = await client.auth.updateUser({ password: nouveau });
        if (resultat.error) return { ok: false, error: traduireErreur(resultat.error) };
        return { ok: true };
    }

    /* ------------------------- Classes et espaces ------------------------- */

    async function rejoindreClasse(code) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        const resultat = await client.rpc('rejoindre_classe', { p_code: code });
        if (resultat.error) {
            const message = /Code de classe inconnu/i.test(resultat.error.message)
                ? 'Aucune classe ne correspond à ce code.'
                : resultat.error.message;
            return { ok: false, error: message };
        }
        await initSession();
        return { ok: true };
    }

    async function quitterClasse() {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        const resultat = await client.from('profiles')
            .update({ classe_id: null })
            .eq('id', profil.id);
        if (resultat.error) return { ok: false, error: resultat.error.message };
        await initSession();
        return { ok: true };
    }

    async function retirerDeClasse(username) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        const cible = utilisateurs.find(function (u) { return u.username === username; });
        if (!cible) return { ok: false, error: 'Élève introuvable.' };
        const resultat = await client.from('profiles')
            .update({ classe_id: null })
            .eq('id', cible.id);
        if (resultat.error) return { ok: false, error: resultat.error.message };
        await initSession();
        return { ok: true };
    }

    async function renommerEspace(nom) {
        if (!estActif() || !profil.espace_id) return { ok: false, error: 'Aucun espace enseignant.' };
        const resultat = await client.from('espaces')
            .update({ nom: nom })
            .eq('id', profil.espace_id);
        if (resultat.error) return { ok: false, error: resultat.error.message };
        await initSession();
        return { ok: true };
    }

    /* ---------------------------- Synchronisation ------------------------- */

    // Les vues écrivent avec la clé de stockage (« learnhub.v1.classes ») :
    // on la ramène au nom court utilisé par les tables Supabase.
    function nomCourt(cle) {
        if (TABLES[cle]) return cle;
        const cles = (window.LearnHubStore && window.LearnHubStore.keys) || {};
        for (const nom in TABLES) {
            if (cles[nom] === cle) return nom;
        }
        return null;
    }

    function synchroniser(cle, ancienne, nouvelle) {
        if (!estActif() || !cache) return;
        const court = nomCourt(cle);
        const table = court ? TABLES[court] : null;
        if (!table) return;

        const avant = {};
        (ancienne || []).forEach(function (item) { avant[item.id] = item; });
        const apres = {};
        (nouvelle || []).forEach(function (item) { apres[item.id] = item; });

        (nouvelle || []).forEach(function (item) {
            const ancien = avant[item.id];
            if (ancien && JSON.stringify(ancien) === JSON.stringify(item)) return;
            const ligne = versLigne(court, item);
            if (!ligne) return;
            client.from(table).upsert(ligne).then(function (resultat) {
                if (resultat.error) signaler(resultat.error);
            }).catch(signaler);
        });

        (ancienne || []).forEach(function (item) {
            if (apres[item.id]) return;
            client.from(table).delete().eq('id', item.id).then(function (resultat) {
                if (resultat.error) signaler(resultat.error);
            }).catch(signaler);
        });
    }

    /* ------------------------------ Tentatives ---------------------------- */

    function ajouterTentative(tentative) {
        if (!estActif() || !profil) return;
        client.from('attempts').insert({
            id: tentative.id,
            user_id: profil.id,
            exercise_id: tentative.exerciceId,
            type: tentative.type,
            titre: tentative.titre,
            score: tentative.score,
            total: tentative.total
        }).then(function (resultat) {
            if (resultat.error) signaler(resultat.error);
        });
    }

    function effacerProgression(username) {
        if (!estActif()) return;
        const auteur = utilisateurs.find(function (u) { return u.username === username; });
        const id = auteur ? auteur.id : (profil && profil.username === username ? profil.id : null);
        if (!id) return;
        delete progression[username];
        client.from('attempts').delete().eq('user_id', id).then(function (resultat) {
            if (resultat.error) signaler(resultat.error);
        });
    }

    /* ------------------------------- Messages ----------------------------- */

    function ajouterMessage(message) {
        if (!disponible()) return;
        client.from('messages').insert({
            id: message.id,
            nom: message.nom,
            email: message.email,
            sujet: message.sujet,
            message: message.message
        }).then(function (resultat) {
            if (resultat.error) signaler(resultat.error);
        });
    }

    return {
        disponible: disponible,
        estActif: estActif,
        initSession: initSession,
        profilCourant: profilCourant,
        cacheDonnees: cacheDonnees,
        utilisateursCache: utilisateursCache,
        progressionCache: progressionCache,
        listeEspaces: listeEspaces,
        connecter: connecter,
        inscrire: inscrire,
        deconnecter: deconnecter,
        changerMotDePasse: changerMotDePasse,
        rejoindreClasse: rejoindreClasse,
        quitterClasse: quitterClasse,
        retirerDeClasse: retirerDeClasse,
        renommerEspace: renommerEspace,
        synchroniser: synchroniser,
        ajouterTentative: ajouterTentative,
        effacerProgression: effacerProgression,
        ajouterMessage: ajouterMessage,
        erreur: function () { return derniereErreur; }
    };
})();
