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
    let listeIA = [];
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

    function contenusIA() {
        if (!profil) return [];
        return listeIA.filter(function (contenu) { return contenu.userId === profil.id; });
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
            client.from('messages').select('*'),
            client.from('ia_contenus').select('*')
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
        const iaRows = reponses[9].data || [];

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

        listeIA = iaRows.map(function (row) {
            return {
                id: row.id,
                userId: row.user_id,
                type: row.type,
                requete: row.requete,
                auteur: row.auteur || '',
                niveau: row.niveau || '',
                modele: row.modele || '',
                contenu: row.contenu || {},
                date: row.created_at
            };
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
        if (/email rate limit exceeded|over_email_send_rate_limit|too many requests/i.test(message)) {
            return 'Trop de tentatives : Supabase limite l’envoi d’e-mails (quelques-uns par heure, service intégré). Réessayez plus tard, ou désactivez « Confirm email » dans Authentication → Sign In / Providers → Email.';
        }
        if (/you can only request this after (\d+) seconds/i.test(message)) {
            const secondes = message.match(/after (\d+) seconds/i)[1];
            return 'Patientez ' + secondes + ' secondes avant de réessayer.';
        }
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
        if (resultat.error) {
            const brut = (resultat.error.message || '');
            const renvoi = { ok: false, error: traduireErreur(resultat.error) };
            if (/email not confirmed/i.test(brut)) renvoi.nonConfirme = email;
            if (/rate limit|too many requests/i.test(brut)) renvoi.limite = true;
            return renvoi;
        }
        const profilCharge = await initSession();
        if (!profilCharge) {
            await client.auth.signOut();
            return { ok: false, error: 'Profil introuvable. Le schéma Supabase est-il bien installé ?' };
        }
        return { ok: true };
    }

    async function renvoyerConfirmation(email) {
        if (!disponible()) return { ok: false, error: 'Backend indisponible.' };
        const resultat = await client.auth.resend({ type: 'signup', email: email });
        if (resultat.error) return { ok: false, error: traduireErreur(resultat.error) };
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
        listeIA = [];
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

    /* -------------------------- Gestion des comptes ----------------------- */

    // Un second client, sans persistance, permet de créer un compte sans
    // remplacer la session du super-administrateur en cours.
    function clientTemporaire() {
        return window.supabase.createClient(url, cle, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: 'learnhub.creation.' + Date.now()
            }
        });
    }

    async function creerCompte(donnees) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        const email = String(donnees.email || '').trim().toLowerCase();
        const username = String(donnees.username || '').trim();
        const motDePasse = String(donnees.password || '');
        const role = donnees.role === 'superadmin' || donnees.role === 'admin' ? donnees.role : 'eleve';

        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Adresse e-mail invalide.' };
        if (username.length < 3) return { ok: false, error: "Le nom d'utilisateur doit contenir au moins 3 caractères." };
        if (motDePasse.length < 6) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };

        const provisoire = clientTemporaire();
        // Le déclencheur refuse le rôle super-admin à l'inscription : on crée un
        // compte élève puis on promeut, ce qui laisse une trace contrôlée.
        const cree = await provisoire.auth.signUp({
            email: email,
            password: motDePasse,
            options: { data: { username: username, role: role === 'superadmin' ? 'eleve' : role } }
        });
        if (cree.error) return { ok: false, error: traduireErreur(cree.error) };

        const utilisateur = cree.data && cree.data.user;
        if (!utilisateur) return { ok: false, error: 'Création impossible : réponse inattendue de Supabase.' };
        if (!cree.data.session) {
            return {
                ok: false,
                error: 'Compte créé mais la confirmation par e-mail est activée : l\'utilisateur devra confirmer son adresse avant de se connecter.'
            };
        }

        if (role === 'superadmin') {
            const promotion = await client.rpc('admin_changer_role', { p_id: utilisateur.id, p_role: 'superadmin' });
            await initSession();
            const compte = utilisateurs.find(function (u) { return u.id === utilisateur.id; }) || null;
            if (promotion.error) {
                return {
                    ok: true,
                    compte: compte,
                    avertissement: 'Compte créé en élève : la promotion super-admin a échoué (' + traduireErreurAdmin(promotion.error) + ').'
                };
            }
            return { ok: true, compte: compte };
        }

        await initSession();
        const compte = utilisateurs.find(function (u) { return u.id === utilisateur.id; }) || null;
        return { ok: true, compte: compte };
    }

    function traduireErreurAdmin(erreur) {
        const message = (erreur && erreur.message) || '';
        if (/could not find the function|function .* does not exist/i.test(message)) {
            return 'fonction serveur manquante, exécutez supabase/migration-comptes-admin.sql dans le SQL Editor';
        }
        if (/Réservé au super-administrateur/i.test(message)) {
            return 'action réservée au super-administrateur';
        }
        return message || 'action impossible';
    }

    async function supprimerCompte(id) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        if (!id) return { ok: false, error: 'Compte introuvable.' };
        if (profil && profil.id === id) return { ok: false, error: 'Impossible de supprimer votre propre compte.' };
        const resultat = await client.rpc('admin_supprimer_compte', { p_id: id });
        if (resultat.error) {
            return { ok: false, error: traduireErreurAdmin(resultat.error) };
        }
        await initSession();
        return { ok: true };
    }

    async function changerRole(id, role) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        if (['eleve', 'admin', 'superadmin'].indexOf(role) === -1) return { ok: false, error: 'Rôle inconnu.' };
        if (profil && profil.id === id && role !== 'superadmin') {
            return { ok: false, error: 'Vous ne pouvez pas retirer votre propre rôle super-administrateur.' };
        }
        const resultat = await client.rpc('admin_changer_role', { p_id: id, p_role: role });
        if (resultat.error) return { ok: false, error: traduireErreurAdmin(resultat.error) };
        await initSession();
        return { ok: true };
    }

    async function renommerCompte(id, username) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        const nom = String(username || '').trim();
        if (nom.length < 3) return { ok: false, error: "Le nom d'utilisateur doit contenir au moins 3 caractères." };
        const resultat = await client.from('profiles').update({ username: nom }).eq('id', id);
        if (resultat.error) return { ok: false, error: resultat.error.message };
        await initSession();
        return { ok: true };
    }

    /* -------------------------- Bibliothèque publique --------------------- */

    function formatteTaille(octets) {
        const n = Number(octets) || 0;
        if (n < 1024) return n + ' o';
        if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
        return (n / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
    }

    // Lecture publique : fonctionne aussi pour un visiteur non connecté.
    async function listerDocuments() {
        if (!disponible()) return { ok: false, error: 'Backend indisponible.' };
        const resultat = await client.from('documents').select('*').order('titre', { ascending: true });
        if (resultat.error) {
            if (/could not find the table|relation .* does not exist/i.test(resultat.error.message || '')) {
                return { ok: false, error: 'La bibliothèque n\'est pas installée : exécutez supabase/migration-bibliotheque.sql.' };
            }
            return { ok: false, error: resultat.error.message };
        }
        return { ok: true, documents: resultat.data || [] };
    }

    async function ajouterDocument(donnees) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        const titre = String((donnees && donnees.titre) || '').trim();
        if (titre.length < 2) return { ok: false, error: 'Titre requis.' };

        let url = String((donnees && donnees.url) || '').trim();
        let taille = String((donnees && donnees.taille) || '').trim();
        const fichier = donnees && donnees.fichier ? donnees.fichier : null;

        if (fichier) {
            const nom = fichier.name || 'document.pdf';
            const extension = (nom.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
            const chemin = 'documents/' + Date.now().toString(36) + '-' +
                Math.random().toString(36).slice(2, 8) + (extension ? '.' + extension : '');
            const envoi = await client.storage.from('documents').upload(chemin, fichier, { upsert: true });
            if (envoi.error) return { ok: false, error: envoi.error.message };
            const publique = client.storage.from('documents').getPublicUrl(chemin);
            url = publique && publique.data ? publique.data.publicUrl : url;
            taille = formatteTaille(fichier.size);
        }

        if (!url) return { ok: false, error: 'Fournissez un fichier ou une URL.' };

        const ligne = {
            id: 'doc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            titre: titre,
            description: String((donnees && donnees.description) || '').trim(),
            matiere: String((donnees && donnees.matiere) || '').trim(),
            niveau: String((donnees && donnees.niveau) || '').trim(),
            type: String((donnees && donnees.type) || 'pdf').trim() || 'pdf',
            url: url,
            taille: taille,
            auteur: String((donnees && donnees.auteur) || '').trim(),
            visibilite: ['public', 'eleves', 'enseignants'].indexOf(donnees && donnees.visibilite) !== -1
                ? donnees.visibilite
                : 'public'
        };

        const insertion = await client.from('documents').insert(ligne).select();
        if (insertion.error) {
            // Colonne `visibilite` absente : migration non exécutée. On réessaie
            // sans elle pour ne pas bloquer la publication.
            if (/visibilite/i.test(insertion.error.message || '')) {
                const secours = Object.assign({}, ligne);
                delete secours.visibilite;
                const seconde = await client.from('documents').insert(secours).select();
                if (seconde.error) return { ok: false, error: seconde.error.message };
                return {
                    ok: true,
                    document: seconde.data && seconde.data[0],
                    avertissement: 'Document publié, mais la restriction de visibilité n\'est pas installée : exécutez supabase/migration-bibliotheque-visibilite.sql.'
                };
            }
            return { ok: false, error: insertion.error.message };
        }
        return { ok: true, document: insertion.data && insertion.data[0] };
    }

    async function supprimerDocument(id) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        if (!id) return { ok: false, error: 'Document introuvable.' };

        const trouve = await client.from('documents').select('url').eq('id', id).maybeSingle();
        const suppression = await client.from('documents').delete().eq('id', id);
        if (suppression.error) return { ok: false, error: suppression.error.message };

        if (trouve.data && trouve.data.url) {
            const correspondance = String(trouve.data.url).match(/\/documents\/([^?#]+)/);
            if (correspondance) {
                client.storage.from('documents').remove([decodeURIComponent(correspondance[1])])
                    .catch(function () { /* l'objet peut déjà être absent */ });
            }
        }
        return { ok: true };
    }

    async function mettreAJourDocument(id, champs) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        if (!id) return { ok: false, error: 'Document introuvable.' };
        const autorise = {};
        if (champs && champs.visibilite) autorise.visibilite = champs.visibilite;
        if (!Object.keys(autorise).length) return { ok: false, error: 'Rien à modifier.' };
        const resultat = await client.from('documents').update(autorise).eq('id', id);
        if (resultat.error) return { ok: false, error: resultat.error.message };
        return { ok: true };
    }

    /* ------------------------------ Assistant IA ------------------------------ */

    async function invoquerIA(parametres) {
        if (!estActif()) return { ok: false, code: 'non_connecte', error: 'Connexion requise.' };
        try {
            const resultat = await client.functions.invoke('ia', { body: parametres });
            if (resultat.error) {
                let corps = resultat.data || null;
                if (!corps && resultat.error.context && typeof resultat.error.context.json === 'function') {
                    corps = await resultat.error.context.json().catch(function () { return null; });
                }
                return {
                    ok: false,
                    code: (corps && corps.code) || 'indisponible',
                    error: (corps && corps.error) || 'Service IA indisponible.'
                };
            }
            const donnees = resultat.data || null;
            if (!donnees || !donnees.ok) {
                return {
                    ok: false,
                    code: (donnees && donnees.code) || 'indisponible',
                    error: (donnees && donnees.error) || 'Génération impossible.'
                };
            }
            return {
                ok: true,
                contenu: donnees.contenu,
                modele: donnees.modele,
                fournisseur: donnees.fournisseur
            };
        } catch (erreur) {
            return { ok: false, code: 'indisponible', error: 'Service IA indisponible.' };
        }
    }

    async function enregistrerIA(entree) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        if (!entree || !entree.contenu) return { ok: false, error: 'Contenu vide.' };

        const id = 'ia-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const ligne = {
            id: id,
            user_id: profil.id,
            type: entree.type === 'question' ? 'question' : 'etude',
            requete: String(entree.requete || '').slice(0, 500),
            auteur: entree.auteur ? String(entree.auteur).slice(0, 160) : null,
            niveau: entree.niveau ? String(entree.niveau).slice(0, 20) : null,
            modele: entree.modele ? String(entree.modele).slice(0, 80) : null,
            contenu: entree.contenu
        };

        const resultat = await client.from('ia_contenus').insert(ligne);
        if (resultat.error) return { ok: false, error: resultat.error.message };

        listeIA = [{
            id: id,
            userId: profil.id,
            type: ligne.type,
            requete: ligne.requete,
            auteur: ligne.auteur || '',
            niveau: ligne.niveau || '',
            modele: ligne.modele || '',
            contenu: ligne.contenu,
            date: new Date().toISOString()
        }].concat(listeIA);
        return { ok: true, id: id };
    }

    async function supprimerIA(id) {
        if (!estActif()) return { ok: false, error: 'Connexion requise.' };
        if (!id) return { ok: false, error: 'Contenu introuvable.' };
        const resultat = await client.from('ia_contenus').delete().eq('id', id);
        if (resultat.error) return { ok: false, error: resultat.error.message };
        listeIA = listeIA.filter(function (contenu) { return contenu.id !== id; });
        return { ok: true };
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
        renvoyerConfirmation: renvoyerConfirmation,
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
        creerCompte: creerCompte,
        supprimerCompte: supprimerCompte,
        changerRole: changerRole,
        renommerCompte: renommerCompte,
        listerDocuments: listerDocuments,
        ajouterDocument: ajouterDocument,
        supprimerDocument: supprimerDocument,
        mettreAJourDocument: mettreAJourDocument,
        contenusIA: contenusIA,
        invoquerIA: invoquerIA,
        enregistrerIA: enregistrerIA,
        supprimerIA: supprimerIA,
        erreur: function () { return derniereErreur; }
    };
})();
