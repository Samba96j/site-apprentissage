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

    const ROLES = { ELEVE: 'eleve', ADMIN: 'admin' };

    const COMPTES_DEMO = [
        { username: 'etudiant', email: 'etudiant@example.com', password: 'motdepasse', role: ROLES.ELEVE },
        { username: 'admin', email: 'admin@example.com', password: 'admin123', role: ROLES.ADMIN }
    ];

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

    async function init() {
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
                    cree: new Date().toISOString()
                });
            }
            write(KEYS.users, seed);
        }
        const session = read(KEYS.session, null);
        if (session && !read(KEYS.users, []).some(function (u) { return u.username === session.username; })) {
            write(KEYS.session, null);
        }
        return true;
    }

    function users() {
        return read(KEYS.users, []);
    }

    function findUser(username) {
        const cible = String(username || '').trim().toLowerCase();
        return users().find(function (u) { return u.username.toLowerCase() === cible; }) || null;
    }

    function current() {
        const session = read(KEYS.session, null);
        if (!session) return null;
        const user = findUser(session.username);
        if (!user) return null;
        return { username: user.username, email: user.email, role: user.role, loginAt: session.loginAt };
    }

    function isAdmin() {
        const user = current();
        return !!user && user.role === ROLES.ADMIN;
    }

    async function login(username, password) {
        const saisie = String(username || '').trim().toLowerCase();
        const user = findUser(saisie) || users().find(function (u) { return u.email.toLowerCase() === saisie; }) || null;
        if (!user) return { ok: false, error: 'Identifiants incorrects.' };
        const valide = await verifierEmpreinte(user, password);
        if (!valide) return { ok: false, error: 'Identifiants incorrects.' };
        write(KEYS.session, { username: user.username, loginAt: new Date().toISOString() });
        return { ok: true, user: current() };
    }

    async function register(data) {
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
        liste.push({
            username: username,
            email: email,
            role: ROLES.ELEVE,
            algo: empreinte.algo,
            salt: empreinte.salt,
            hash: empreinte.hash,
            cree: new Date().toISOString()
        });
        if (!write(KEYS.users, liste)) {
            return { ok: false, error: "L'enregistrement a échoué (stockage du navigateur indisponible)." };
        }
        return { ok: true };
    }

    function logout() {
        write(KEYS.session, null);
    }

    function setRole(username, role) {
        if (role !== ROLES.ADMIN && role !== ROLES.ELEVE) return { ok: false, error: 'Rôle inconnu.' };
        const liste = users();
        const user = liste.find(function (u) { return u.username === username; });
        if (!user) return { ok: false, error: 'Utilisateur introuvable.' };
        const admins = liste.filter(function (u) { return u.role === ROLES.ADMIN; });
        if (user.role === ROLES.ADMIN && role !== ROLES.ADMIN && admins.length <= 1) {
            return { ok: false, error: 'Il doit rester au moins un administrateur.' };
        }
        user.role = role;
        write(KEYS.users, liste);
        return { ok: true };
    }

    function removeUser(username) {
        const session = current();
        if (session && session.username === username) {
            return { ok: false, error: 'Impossible de supprimer votre propre compte.' };
        }
        const liste = users();
        const user = liste.find(function (u) { return u.username === username; });
        if (!user) return { ok: false, error: 'Utilisateur introuvable.' };
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

    async function changePassword(username, currentPassword, newPassword) {
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
        return read(KEYS.progress, {});
    }

    function attempts(username) {
        if (!username) return [];
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
        const progress = allProgress();
        progress[user.username] = (progress[user.username] || []).concat([tentative]);
        write(KEYS.progress, progress);
        return { ok: true, tentative: tentative };
    }

    function tentativeCount(username, exerciceId) {
        return attempts(username).filter(function (t) { return t.exerciceId === exerciceId; }).length;
    }

    function clearProgress(username) {
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
        login: login,
        register: register,
        logout: logout,
        setRole: setRole,
        removeUser: removeUser,
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
