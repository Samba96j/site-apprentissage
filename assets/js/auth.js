/**
 * LearnHub — comptes, session et progression.
 *
 * Les comptes sont stockés dans le navigateur (localStorage) : le mot de passe
 * n'est jamais conservé en clair, seulement un condensat salé. Il s'agit d'une
 * démonstration hors serveur : elle ne remplace pas une authentification réelle.
 */
window.LearnHubAuth = (function () {
    'use strict';

    const PREFIX = 'learnhub.v1.';
    const KEYS = {
        users: PREFIX + 'users',
        session: PREFIX + 'session',
        progress: PREFIX + 'progress'
    };

    const ROLES = { ELEVE: 'eleve', ADMIN: 'admin', SUPERADMIN: 'superadmin' };

    // Identifiants du super-administrateur créé automatiquement s'il n'en existe aucun.
    // Ils peuvent ensuite être modifiés depuis #/superadmin (rubrique « Mes identifiants »).
    const SUPER_ADMIN_AMORCAGE = {
        username: 'superadmin',
        email: 'superadmin@example.com',
        password: 'superadmin123'
    };

    const COMPTES_DEMO = [
        { username: 'etudiant', email: 'etudiant@example.com', password: 'motdepasse', role: ROLES.ELEVE },
        { username: 'admin', email: 'admin@example.com', password: 'admin123', role: ROLES.ADMIN },
        { username: SUPER_ADMIN_AMORCAGE.username, email: SUPER_ADMIN_AMORCAGE.email, password: SUPER_ADMIN_AMORCAGE.password, role: ROLES.SUPERADMIN }
    ];

    function backend() {
        const b = window.LearnHubBackend;
        return b && b.disponible() ? b : null;
    }

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('Écriture impossible :', key, e);
            return false;
        }
    }

    function hex(buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function fallbackHash(value) {
        let h1 = 0xdeadbeef ^ value.length;
        let h2 = 0x41c6ce57 ^ value.length;
        for (let i = 0; i < value.length; i++) {
            const ch = value.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
    }

    async function digest(algo, value) {
        if (algo === 'sha256' && window.crypto && window.crypto.subtle) {
            try {
                const buffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
                return hex(buffer);
            } catch (e) {
                return null;
            }
        }
        return fallbackHash(value);
    }

    async function creerEmpreinte(password) {
        const salt = Math.random().toString(36).slice(2, 12);
        const algo = window.crypto && window.crypto.subtle ? 'sha256' : 'fallback';
        const value = await digest(algo, salt + '::' + password);
        return { algo: algo, salt: salt, hash: value };
    }

    async function verifierEmpreinte(user, password) {
        const value = await digest(user.algo, user.salt + '::' + password);
        return value !== null && value === user.hash;
    }

    /** Vrai si le super-administrateur connecté utilise encore le mot de passe d'amorçage. */
    async function motDePasseParDefaut() {
        if (backend()) return false;
        const user = current();
        if (!user || user.role !== ROLES.SUPERADMIN) return false;
        const compte = findUser(user.username);
        if (!compte) return false;
        return verifierEmpreinte(compte, SUPER_ADMIN_AMORCAGE.password);
    }

    function creerEspaceId(username) {
        const base = String(username || 'espace')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'espace';
        return 'esp-' + base + '-' + Math.random().toString(36).slice(2, 6);
    }

    async function init() {
        const b = backend();
        if (b) {
            await b.initSession();
            return true;
        }

        const users = read(KEYS.users, null);
        if (!users) {
            const seed = [];
            for (const compte of COMPTES_DEMO) {
                const empreinte = await creerEmpreinte(compte.password);
                seed.push({
                    username: compte.username,
                    email: compte.email,
                    role: compte.role,
                    algo: empreinte.algo,
                    salt: empreinte.salt,
                    hash: empreinte.hash,
                    espaceId: compte.role === ROLES.ADMIN ? creerEspaceId(compte.username) : null,
                    espaceNom: compte.role === ROLES.ADMIN ? 'Espace de ' + compte.username : null,
                    classeId: null,
                    cree: new Date().toISOString()
                });
            }
            write(KEYS.users, seed);
        }

        // Chaque administrateur possède son propre espace de travail.
        const comptes = read(KEYS.users, []);
        let modifie = false;
        comptes.forEach(function (compte) {
            if (compte.role === ROLES.ADMIN && !compte.espaceId) {
                compte.espaceId = creerEspaceId(compte.username);
                compte.espaceNom = compte.espaceNom || 'Espace de ' + compte.username;
                modifie = true;
            }
            if (compte.role === ROLES.ELEVE && compte.classeId === undefined) {
                compte.classeId = null;
                modifie = true;
            }
        });
        if (modifie) write(KEYS.users, comptes);

        // Un super-administrateur est indispensable pour gérer tous les comptes.
        const avecSuperAdmin = read(KEYS.users, []).some(function (u) { return u.role === ROLES.SUPERADMIN; });
        if (!avecSuperAdmin) {
            const existants = read(KEYS.users, []);
            const noms = existants.map(function (u) { return u.username.toLowerCase(); });
            let identifiant = SUPER_ADMIN_AMORCAGE.username;
            let suffixe = 1;
            while (noms.indexOf(identifiant) >= 0) {
                suffixe++;
                identifiant = SUPER_ADMIN_AMORCAGE.username + suffixe;
            }
            const empreinte = await creerEmpreinte(SUPER_ADMIN_AMORCAGE.password);
            existants.push({
                username: identifiant,
                email: identifiant === SUPER_ADMIN_AMORCAGE.username ? SUPER_ADMIN_AMORCAGE.email : identifiant + '@example.com',
                role: ROLES.SUPERADMIN,
                algo: empreinte.algo,
                salt: empreinte.salt,
                hash: empreinte.hash,
                espaceId: null,
                espaceNom: null,
                classeId: null,
                cree: new Date().toISOString()
            });
            write(KEYS.users, existants);
        }

        const session = read(KEYS.session, null);
        if (session && !read(KEYS.users, []).some(function (u) { return u.username === session.username; })) {
            write(KEYS.session, null);
        }
        return true;
    }

    function users() {
        const b = backend();
        if (b) return b.utilisateursCache();
        return read(KEYS.users, []);
    }

    function findUser(username) {
        const cible = String(username || '').trim().toLowerCase();
        return users().find(function (u) { return u.username.toLowerCase() === cible; }) || null;
    }

    function current() {
        const b = backend();
        if (b) {
            const p = b.profilCourant();
            if (!p) return null;
            const espace = b.listeEspaces().find(function (e) { return e.id === p.espace_id; });
            return {
                username: p.username,
                email: p.email,
                role: p.role,
                espaceId: p.espace_id || null,
                espaceNom: espace ? espace.nom : null,
                classeId: p.classe_id || null,
                loginAt: new Date().toISOString()
            };
        }

        const session = read(KEYS.session, null);
        if (!session) return null;
        const user = findUser(session.username);
        if (!user) return null;
        return {
            username: user.username,
            email: user.email,
            role: user.role,
            espaceId: user.espaceId || null,
            espaceNom: user.espaceNom || null,
            classeId: user.classeId || null,
            loginAt: session.loginAt
        };
    }

    function isAdmin() {
        const user = current();
        return !!user && (user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN);
    }

    function isSuperAdmin() {
        const user = current();
        return !!user && user.role === ROLES.SUPERADMIN;
    }

    /**
     * Espace de travail courant : celui de l'administrateur, ou celui de la
     * classe de l'élève. `null` correspond à la bibliothèque publique.
     */
    function espaceActif() {
        const b = backend();
        if (b) {
            const p = b.profilCourant();
            if (!p) return null;
            if (p.espace_id) return p.espace_id;
            if (!p.classe_id) return null;
            const store = window.LearnHubStore;
            const classe = store && store.classes ? store.classes.get(p.classe_id) : null;
            return classe ? classe.espaceId : null;
        }

        const user = current();
        if (!user) return null;
        if (user.role === ROLES.ADMIN) return user.espaceId || null;
        if (!user.classeId) return null;
        const store = window.LearnHubStore;
        const classe = store && store.classes ? store.classes.get(user.classeId) : null;
        return classe ? classe.espaceId : null;
    }

    function maClasse() {
        const b = backend();
        if (b) {
            const p = b.profilCourant();
            if (!p || !p.classe_id) return null;
            const store = window.LearnHubStore;
            return store && store.classes ? store.classes.get(p.classe_id) : null;
        }

        const user = current();
        if (!user || !user.classeId) return null;
        const store = window.LearnHubStore;
        return store && store.classes ? store.classes.get(user.classeId) : null;
    }

    function monEspace() {
        const b = backend();
        if (b) {
            const p = b.profilCourant();
            if (!p) return null;
            if (p.role === ROLES.SUPERADMIN) {
                return { id: null, nom: 'Super-administration', role: ROLES.SUPERADMIN };
            }
            if (p.role === ROLES.ADMIN) {
                const espace = b.listeEspaces().find(function (e) { return e.id === p.espace_id; });
                return {
                    id: p.espace_id,
                    nom: espace ? espace.nom : 'Mon espace',
                    role: ROLES.ADMIN
                };
            }
            const classe = maClasse();
            if (!classe) return null;
            const parent = b.listeEspaces().find(function (e) { return e.id === classe.espaceId; });
            return {
                id: classe.espaceId,
                nom: parent ? parent.nom : 'Espace enseignant',
                role: ROLES.ELEVE
            };
        }

        const user = current();
        if (!user) return null;
        if (user.role === ROLES.ADMIN) {
            return {
                id: user.espaceId,
                nom: user.espaceNom || 'Espace de ' + user.username,
                role: ROLES.ADMIN
            };
        }
        const classe = maClasse();
        if (!classe) return null;
        const titulaire = users().find(function (u) {
            return u.role === ROLES.ADMIN && u.espaceId === classe.espaceId;
        });
        return {
            id: classe.espaceId,
            nom: titulaire ? (titulaire.espaceNom || 'Espace de ' + titulaire.username) : 'Espace enseignant',
            role: ROLES.ELEVE
        };
    }

    async function rejoindreClasse(code) {
        const b = backend();
        if (b) return b.rejoindreClasse(code);

        const user = current();
        if (!user) return { ok: false, error: 'Connectez-vous pour rejoindre une classe.' };
        if (user.role !== ROLES.ELEVE) return { ok: false, error: 'Seuls les élèves peuvent rejoindre une classe.' };
        const store = window.LearnHubStore;
        const classe = store && store.classes ? store.classes.byCode(code) : null;
        if (!classe) return { ok: false, error: 'Aucune classe ne correspond à ce code.' };
        const liste = users();
        const cible = liste.find(function (u) { return u.username === user.username; });
        cible.classeId = classe.id;
        write(KEYS.users, liste);
        return { ok: true, classe: classe };
    }

    async function quitterClasse() {
        const b = backend();
        if (b) return b.quitterClasse();

        const user = current();
        if (!user) return { ok: false, error: 'Connectez-vous pour gérer votre classe.' };
        const liste = users();
        const cible = liste.find(function (u) { return u.username === user.username; });
        cible.classeId = null;
        write(KEYS.users, liste);
        return { ok: true };
    }

    function detacherClasse(classeId) {
        if (backend()) return false; // la clé étrangère met classe_id à NULL à la suppression
        const liste = users();
        let modifie = false;
        liste.forEach(function (u) {
            if (u.classeId === classeId) {
                u.classeId = null;
                modifie = true;
            }
        });
        if (modifie) write(KEYS.users, liste);
        return modifie;
    }

    function membresClasse(classeId) {
        if (!classeId) return [];
        return users().filter(function (u) {
            return u.role === ROLES.ELEVE && u.classeId === classeId;
        });
    }

    function retirerDeClasse(username) {
        const b = backend();
        if (b) return b.retirerDeClasse(username);

        const liste = users();
        const cible = liste.find(function (u) { return u.username === username; });
        if (!cible) return { ok: false, error: 'Élève introuvable.' };
        cible.classeId = null;
        write(KEYS.users, liste);
        return { ok: true };
    }

    function renommerEspace(nom) {
        const b = backend();
        if (b) return b.renommerEspace(nom);

        const user = current();
        if (!user || user.role !== ROLES.ADMIN) {
            return { ok: false, error: 'Seul un administrateur peut nommer son espace.' };
        }
        const propre = String(nom || '').trim();
        if (propre.length < 2) {
            return { ok: false, error: "Le nom de l'espace doit contenir au moins 2 caractères." };
        }
        const liste = users();
        const cible = liste.find(function (u) { return u.username === user.username; });
        cible.espaceNom = propre;
        write(KEYS.users, liste);
        return { ok: true };
    }

    async function renvoyerConfirmation(email) {
        const b = backend();
        if (!b) return { ok: false, error: 'Disponible uniquement avec le backend.' };
        const cible = String(email || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cible)) {
            return { ok: false, error: 'Adresse e-mail invalide.' };
        }
        return b.renvoyerConfirmation(cible);
    }

    async function login(username, password) {
        const b = backend();
        if (b) {
            const identifiant = String(username || '').trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifiant)) {
                return { ok: false, error: 'Utilisez votre adresse e-mail pour vous connecter.' };
            }
            const resultat = await b.connecter(identifiant, password);
            if (!resultat.ok) return resultat;
            return { ok: true, user: current() };
        }
        const saisie = String(username || '').trim().toLowerCase();
        const user = findUser(saisie) || users().find(function (u) { return u.email.toLowerCase() === saisie; }) || null;
        if (!user) return { ok: false, error: 'Identifiants incorrects.' };
        const valide = await verifierEmpreinte(user, password);
        if (!valide) return { ok: false, error: 'Identifiants incorrects.' };
        write(KEYS.session, { username: user.username, loginAt: new Date().toISOString() });
        return { ok: true, user: current() };
    }

    async function register(data) {
        const b = backend();
        if (b) {
            const username = String(data.username || '').trim();
            const email = String(data.email || '').trim();
            const password = String(data.password || '');
            if (username.length < 3) return { ok: false, error: "Le nom d'utilisateur doit contenir au moins 3 caractères." };
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Adresse e-mail invalide.' };
            if (password.length < 6) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
            return b.inscrire({ username: username, email: email, password: password, enseignant: !!data.enseignant });
        }

        const username = String(data.username || '').trim();
        const email = String(data.email || '').trim();
        const password = String(data.password || '');

        if (username.length < 3) return { ok: false, error: "Le nom d'utilisateur doit contenir au moins 3 caractères." };
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Adresse e-mail invalide.' };
        if (password.length < 6) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
        if (findUser(username)) return { ok: false, error: "Ce nom d'utilisateur est déjà pris." };
        if (users().some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) {
            return { ok: false, error: 'Cette adresse e-mail est déjà utilisée.' };
        }

        const empreinte = await creerEmpreinte(password);
        const liste = users();
        const enseignant = !!data.enseignant;
        const compte = {
            username: username,
            email: email,
            role: enseignant ? ROLES.ADMIN : ROLES.ELEVE,
            algo: empreinte.algo,
            salt: empreinte.salt,
            hash: empreinte.hash,
            espaceId: enseignant ? creerEspaceId(username) : null,
            espaceNom: enseignant ? 'Espace de ' + username : null,
            classeId: null,
            cree: new Date().toISOString()
        };
        liste.push(compte);
        if (!write(KEYS.users, liste)) {
            return { ok: false, error: "L'enregistrement a échoué (stockage du navigateur indisponible)." };
        }
        if (enseignant && window.LearnHubStore && window.LearnHubStore.exercices) {
            window.LearnHubStore.exercices.importerDemo(compte.espaceId);
        }
        return { ok: true };
    }

    async function logout() {
        const b = backend();
        if (b) await b.deconnecter();
        write(KEYS.session, null);
    }

    async function setRole(username, role) {
        const b = backend();
        if (b) {
            const acteur = current();
            if (!acteur || acteur.role !== ROLES.SUPERADMIN) {
                return { ok: false, error: 'Action réservée au super-administrateur.' };
            }
            const cible = users().find(function (u) { return u.username === username; });
            if (!cible) return { ok: false, error: 'Utilisateur introuvable.' };
            return b.changerRole(cible.id, role);
        }
        if ([ROLES.ADMIN, ROLES.ELEVE, ROLES.SUPERADMIN].indexOf(role) === -1) {
            return { ok: false, error: 'Rôle inconnu.' };
        }
        const acteur = current();
        if (!acteur || (acteur.role !== ROLES.ADMIN && acteur.role !== ROLES.SUPERADMIN)) {
            return { ok: false, error: 'Action réservée aux administrateurs.' };
        }
        if (acteur.role === ROLES.ADMIN && role === ROLES.SUPERADMIN) {
            return { ok: false, error: 'Seul un super-administrateur peut attribuer ce rôle.' };
        }

        const liste = users();
        const user = liste.find(function (u) { return u.username === username; });
        if (!user) return { ok: false, error: 'Utilisateur introuvable.' };

        if (user.role === ROLES.SUPERADMIN) {
            if (acteur.role !== ROLES.SUPERADMIN) {
                return { ok: false, error: 'Seul un super-administrateur peut modifier ce compte.' };
            }
            if (user.username === acteur.username && role !== ROLES.SUPERADMIN) {
                return { ok: false, error: 'Impossible de retirer votre propre rôle de super-administrateur.' };
            }
            const supers = liste.filter(function (u) { return u.role === ROLES.SUPERADMIN; });
            if (role !== ROLES.SUPERADMIN && supers.length <= 1) {
                return { ok: false, error: 'Il doit rester au moins un super-administrateur.' };
            }
        }

        if (acteur.role === ROLES.ADMIN && user.role === ROLES.ADMIN && user.username !== acteur.username) {
            return { ok: false, error: 'Seul un super-administrateur peut modifier un autre administrateur.' };
        }

        const admins = liste.filter(function (u) { return u.role === ROLES.ADMIN; });
        if (user.role === ROLES.ADMIN && role !== ROLES.ADMIN && admins.length <= 1) {
            return { ok: false, error: 'Il doit rester au moins un administrateur.' };
        }

        user.role = role;
        let nouvelEspace = false;
        if (role === ROLES.ADMIN && !user.espaceId) {
            user.espaceId = creerEspaceId(user.username);
            user.espaceNom = user.espaceNom || 'Espace de ' + user.username;
            nouvelEspace = true;
        }
        if (role !== ROLES.ELEVE) user.classeId = null;
        write(KEYS.users, liste);
        if (nouvelEspace && window.LearnHubStore && window.LearnHubStore.exercices) {
            window.LearnHubStore.exercices.importerDemo(user.espaceId);
        }
        return { ok: true };
    }

    async function creerCompte(data) {
        const b = backend();
        if (b) {
            const acteur = current();
            if (!acteur || acteur.role !== ROLES.SUPERADMIN) {
                return { ok: false, error: 'Action réservée au super-administrateur.' };
            }
            return b.creerCompte(data);
        }
        const acteur = current();
        if (!acteur || acteur.role !== ROLES.SUPERADMIN) {
            return { ok: false, error: 'Action réservée au super-administrateur.' };
        }
        const username = String(data.username || '').trim();
        const email = String(data.email || '').trim();
        const password = String(data.password || '');
        const role = data.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.ELEVE;

        if (username.length < 3) return { ok: false, error: "Le nom d'utilisateur doit contenir au moins 3 caractères." };
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Adresse e-mail invalide.' };
        if (password.length < 6) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
        if (findUser(username)) return { ok: false, error: "Ce nom d'utilisateur est déjà pris." };
        if (users().some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) {
            return { ok: false, error: 'Cette adresse e-mail est déjà utilisée.' };
        }

        const empreinte = await creerEmpreinte(password);
        const liste = users();
        const compte = {
            username: username,
            email: email,
            role: role,
            algo: empreinte.algo,
            salt: empreinte.salt,
            hash: empreinte.hash,
            espaceId: role === ROLES.ADMIN ? creerEspaceId(username) : null,
            espaceNom: role === ROLES.ADMIN ? 'Espace de ' + username : null,
            classeId: null,
            cree: new Date().toISOString()
        };
        liste.push(compte);
        if (!write(KEYS.users, liste)) {
            return { ok: false, error: "L'enregistrement a échoué (stockage du navigateur indisponible)." };
        }
        if (role === ROLES.ADMIN && window.LearnHubStore && window.LearnHubStore.exercices) {
            window.LearnHubStore.exercices.importerDemo(compte.espaceId);
        }
        return { ok: true, compte: { username: username, email: email, role: role } };
    }

    async function removeUser(username) {
        const b = backend();
        if (b) {
            const acteur = current();
            if (!acteur || acteur.role !== ROLES.SUPERADMIN) {
                return { ok: false, error: 'Action réservée au super-administrateur.' };
            }
            const cible = users().find(function (u) { return u.username === username; });
            if (!cible) return { ok: false, error: 'Utilisateur introuvable.' };
            if (cible.username === acteur.username) {
                return { ok: false, error: 'Impossible de supprimer votre propre compte.' };
            }
            return b.supprimerCompte(cible.id);
        }
        const acteur = current();
        if (acteur && acteur.username === username) {
            return { ok: false, error: 'Impossible de supprimer votre propre compte.' };
        }
        const liste = users();
        const user = liste.find(function (u) { return u.username === username; });
        if (!user) return { ok: false, error: 'Utilisateur introuvable.' };
        if (user.role === ROLES.SUPERADMIN) {
            if (!acteur || acteur.role !== ROLES.SUPERADMIN) {
                return { ok: false, error: 'Seul un super-administrateur peut supprimer ce compte.' };
            }
            const supers = liste.filter(function (u) { return u.role === ROLES.SUPERADMIN; });
            if (supers.length <= 1) {
                return { ok: false, error: 'Il doit rester au moins un super-administrateur.' };
            }
        }
        const admins = liste.filter(function (u) { return u.role === ROLES.ADMIN; });
        if (user.role === ROLES.ADMIN && admins.length <= 1) {
            return { ok: false, error: 'Il doit rester au moins un administrateur.' };
        }
        write(KEYS.users, liste.filter(function (u) { return u.username !== username; }));
        const progress = read(KEYS.progress, {});
        delete progress[username];
        write(KEYS.progress, progress);
        return { ok: true };
    }

    /**
     * Met à jour le nom d'utilisateur et l'e-mail du super-administrateur connecté.
     * L'historique de progression et la session suivent le renommage.
     */
    async function mettreAJourIdentifiants(username, data) {
        const b = backend();
        if (b) {
            const acteur = current();
            if (!acteur || acteur.role !== ROLES.SUPERADMIN) {
                return { ok: false, error: 'Action réservée au super-administrateur.' };
            }
            if (acteur.username !== username) {
                return { ok: false, error: 'Vous ne pouvez modifier que votre propre compte.' };
            }
            const cible = users().find(function (u) { return u.username === username; });
            if (!cible) return { ok: false, error: 'Compte introuvable.' };
            const nouveauNom = String(data.username || cible.username).trim();
            const resultat = await b.renommerCompte(cible.id, nouveauNom);
            if (!resultat.ok) return resultat;
            return { ok: true, username: nouveauNom };
        }
        const acteur = current();
        if (!acteur || acteur.role !== ROLES.SUPERADMIN) {
            return { ok: false, error: 'Action réservée au super-administrateur.' };
        }
        if (acteur.username !== username) {
            return { ok: false, error: 'Vous ne pouvez modifier que votre propre compte.' };
        }
        const liste = users();
        const cible = liste.find(function (u) { return u.username === username; });
        if (!cible) return { ok: false, error: 'Compte introuvable.' };

        const nouveauNom = String(data.username || '').trim();
        const nouvelEmail = String(data.email || '').trim();
        if (nouveauNom.length < 3) {
            return { ok: false, error: "Le nom d'utilisateur doit contenir au moins 3 caractères." };
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nouvelEmail)) {
            return { ok: false, error: 'Adresse e-mail invalide.' };
        }
        if (liste.some(function (u) {
            return u.username !== cible.username && u.username.toLowerCase() === nouveauNom.toLowerCase();
        })) {
            return { ok: false, error: "Ce nom d'utilisateur est déjà pris." };
        }
        if (liste.some(function (u) {
            return u.username !== cible.username && u.email.toLowerCase() === nouvelEmail.toLowerCase();
        })) {
            return { ok: false, error: 'Cette adresse e-mail est déjà utilisée.' };
        }

        const ancienNom = cible.username;
        cible.username = nouveauNom;
        cible.email = nouvelEmail;
        write(KEYS.users, liste);

        if (ancienNom !== nouveauNom) {
            const progress = allProgress();
            if (progress[ancienNom]) {
                progress[nouveauNom] = progress[ancienNom];
                delete progress[ancienNom];
                write(KEYS.progress, progress);
            }
            const session = read(KEYS.session, null);
            if (session && session.username === ancienNom) {
                session.username = nouveauNom;
                write(KEYS.session, session);
            }
        }
        return { ok: true, username: nouveauNom };
    }

    async function changePassword(username, currentPassword, newPassword) {
        const b = backend();
        if (b) return b.changerMotDePasse(currentPassword, newPassword);

        const user = findUser(username);
        if (!user) return { ok: false, error: 'Utilisateur introuvable.' };
        if (!(await verifierEmpreinte(user, currentPassword))) {
            return { ok: false, error: 'Mot de passe actuel incorrect.' };
        }
        if (String(newPassword).length < 6) {
            return { ok: false, error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' };
        }
        const empreinte = await creerEmpreinte(newPassword);
        const liste = users();
        const cible = liste.find(function (u) { return u.username === user.username; });
        cible.algo = empreinte.algo;
        cible.salt = empreinte.salt;
        cible.hash = empreinte.hash;
        write(KEYS.users, liste);
        return { ok: true };
    }

    /* ----------------------------- Progression ----------------------------- */

    function allProgress() {
        const b = backend();
        if (b && b.estActif()) {
            return JSON.parse(JSON.stringify(b.progressionCache()));
        }
        return read(KEYS.progress, {});
    }

    function attempts(username) {
        if (!username) return [];
        const b = backend();
        if (b && b.estActif()) {
            const liste = b.progressionCache()[username];
            return Array.isArray(liste) ? liste.slice() : [];
        }
        const progress = allProgress();
        return Array.isArray(progress[username]) ? progress[username] : [];
    }

    function recordAttempt(data) {
        const user = current();
        if (!user) return { ok: false, error: 'Connectez-vous pour enregistrer votre score.' };
        const tentative = {
            id: 'essai-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            exerciceId: data.exerciceId || 'inconnu',
            type: data.type || 'quiz',
            titre: data.titre || 'Exercice',
            score: Number(data.score) || 0,
            total: Number(data.total) || 0,
            date: new Date().toISOString()
        };
        const b = backend();
        if (b && b.estActif()) {
            const progress = b.progressionCache();
            progress[user.username] = (progress[user.username] || []).concat([tentative]);
            b.ajouterTentative(tentative);
            return { ok: true, tentative: tentative };
        }
        const progress = allProgress();
        progress[user.username] = (progress[user.username] || []).concat([tentative]);
        write(KEYS.progress, progress);
        return { ok: true, tentative: tentative };
    }

    function tentativeCount(username, exerciceId) {
        return attempts(username).filter(function (t) { return t.exerciceId === exerciceId; }).length;
    }

    function clearProgress(username) {
        const b = backend();
        if (b && b.estActif()) {
            if (username) {
                b.effacerProgression(username);
            } else {
                Object.keys(b.progressionCache()).forEach(function (cle) { b.effacerProgression(cle); });
            }
            return { ok: true };
        }
        const progress = allProgress();
        if (username) {
            delete progress[username];
        } else {
            Object.keys(progress).forEach(function (key) { delete progress[key]; });
        }
        write(KEYS.progress, progress);
        return { ok: true };
    }

    function statsFor(username) {
        const liste = attempts(username);
        const total = liste.length;
        const points = liste.reduce(function (acc, t) { return acc + t.score; }, 0);
        const possibles = liste.reduce(function (acc, t) { return acc + t.total; }, 0);
        const moyenne = possibles > 0 ? Math.round((points / possibles) * 100) : 0;
        const meilleur = liste.reduce(function (acc, t) {
            const ratio = t.total > 0 ? Math.round((t.score / t.total) * 100) : 0;
            return Math.max(acc, ratio);
        }, 0);
        return {
            tentatives: total,
            moyenne: moyenne,
            meilleur: meilleur,
            dernieres: liste.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 8)
        };
    }

    const BADGES = [
        {
            id: 'premier-pas',
            titre: 'Premier pas',
            icone: 'fa-shoe-prints',
            description: 'Terminer un premier exercice',
            condition: function (liste) { return liste.length >= 1; }
        },
        {
            id: 'sans-faute',
            titre: 'Sans faute',
            icone: 'fa-star',
            description: 'Obtenir 100 % à un exercice',
            condition: function (liste) {
                return liste.some(function (t) { return t.total > 0 && t.score === t.total; });
            }
        },
        {
            id: 'perseverant',
            titre: 'Persévérant',
            icone: 'fa-fire',
            description: 'Réaliser 5 tentatives',
            condition: function (liste) { return liste.length >= 5; }
        },
        {
            id: 'polyvalent',
            titre: 'Polyvalent',
            icone: 'fa-shapes',
            description: 'Essayer les trois types d\'exercices',
            condition: function (liste) {
                const types = {};
                liste.forEach(function (t) { types[t.type] = true; });
                return Object.keys(types).length >= 3;
            }
        },
        {
            id: 'expert',
            titre: 'Expert',
            icone: 'fa-award',
            description: 'Atteindre 80 % de moyenne sur 3 tentatives',
            condition: function (liste) {
                if (liste.length < 3) return false;
                const points = liste.reduce(function (acc, t) { return acc + t.score; }, 0);
                const possibles = liste.reduce(function (acc, t) { return acc + t.total; }, 0);
                return possibles > 0 && points / possibles >= 0.8;
            }
        }
    ];

    function badges(username) {
        const liste = attempts(username);
        return BADGES.map(function (badge) {
            return {
                id: badge.id,
                titre: badge.titre,
                icone: badge.icone,
                description: badge.description,
                obtenu: badge.condition(liste)
            };
        });
    }

    return {
        ROLES: ROLES,
        comptesDemo: COMPTES_DEMO,
        init: init,
        users: users,
        findUser: findUser,
        current: current,
        isAdmin: isAdmin,
        isSuperAdmin: isSuperAdmin,
        motDePasseParDefaut: motDePasseParDefaut,
        espaceActif: espaceActif,
        monEspace: monEspace,
        maClasse: maClasse,
        rejoindreClasse: rejoindreClasse,
        quitterClasse: quitterClasse,
        detacherClasse: detacherClasse,
        membresClasse: membresClasse,
        retirerDeClasse: retirerDeClasse,
        renommerEspace: renommerEspace,
        login: login,
        register: register,
        renvoyerConfirmation: renvoyerConfirmation,
        logout: logout,
        setRole: setRole,
        creerCompte: creerCompte,
        removeUser: removeUser,
        mettreAJourIdentifiants: mettreAJourIdentifiants,
        changePassword: changePassword,
        attempts: attempts,
        allProgress: allProgress,
        recordAttempt: recordAttempt,
        tentativeCount: tentativeCount,
        clearProgress: clearProgress,
        statsFor: statsFor,
        badges: badges
    };
})();
