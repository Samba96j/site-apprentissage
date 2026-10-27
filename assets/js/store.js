/**
 * LearnHub — persistance locale (localStorage).
 * Regroupe les exercices, les ressources et les paramètres partagés entre
 * l'espace élève et le back-office.
 */
window.LearnHubStore = (function () {
    'use strict';

    const PREFIX = 'learnhub.v1.';
    const SEED_VERSION = 3;
    const KEYS = {
        exercices: PREFIX + 'exercices',
        ressources: PREFIX + 'ressources',
        settings: PREFIX + 'settings',
        classes: PREFIX + 'classes',
        seances: PREFIX + 'seances',
        seeded: PREFIX + 'seeded'
    };

    const DEFAULT_SETTINGS = {
        tempsQuestion: 30,
        tentativesMax: 3,
        afficherCorrections: true,
        melangerQuestions: true
    };

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Lecture impossible :', key, e);
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

    function uid(prefix) {
        return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    /** Espace de travail de l'utilisateur connecté (administrateur ou classe de l'élève). */
    function espaceActif() {
        const auth = window.LearnHubAuth;
        return auth && typeof auth.espaceActif === 'function' ? auth.espaceActif() : null;
    }

    /**
     * Enregistrement visible : le contenu de l'espace courant, ou la
     * bibliothèque publique pour un visiteur (ou un élève sans classe).
     */
    function visible(entree) {
        const espace = espaceActif();
        if (espace) return entree.espaceId === espace;
        return !entree.espaceId;
    }

    function dansEspaceActif(entree) {
        const espace = espaceActif();
        return !!espace && entree.espaceId === espace;
    }

    function codeClasse() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return code;
    }

    function amorcerEspacesAdmins() {
        const comptes = window.LearnHubAuth ? window.LearnHubAuth.users() : [];
        const admins = comptes.filter(function (u) { return u.role === 'admin' && u.espaceId; });
        if (!admins.length) return;
        const liste = read(KEYS.exercices, []);
        let modifie = false;
        admins.forEach(function (admin) {
            const dejaDuContenu = liste.some(function (ex) { return ex.espaceId === admin.espaceId; });
            if (dejaDuContenu) return;
            window.LearnHubData.exercicesSeed.forEach(function (seed) {
                liste.push(Object.assign(clone(seed), {
                    id: uid('exo'),
                    espaceId: admin.espaceId,
                    cree: new Date().toISOString()
                }));
            });
            modifie = true;
        });
        if (modifie) write(KEYS.exercices, liste);
    }

    function seedIfNeeded() {
        const version = Number(read(KEYS.seeded, 0));
        if (!version) {
            write(KEYS.exercices, clone(window.LearnHubData.exercicesSeed));
            write(KEYS.ressources, clone(window.LearnHubData.ressourcesSeed));
            write(KEYS.settings, clone(DEFAULT_SETTINGS));
            write(KEYS.classes, []);
            write(KEYS.seances, []);
            write(KEYS.seeded, SEED_VERSION);
            amorcerEspacesAdmins();
            return;
        }

        const exercices = read(KEYS.exercices, []);
        const ressources = read(KEYS.ressources, []);
        let modifie = false;

        if (version < 2) {
            // Migration : ajoute les nouveaux exercices livrés sans écraser les créations locales.
            window.LearnHubData.exercicesSeed.forEach(function (seed) {
                const index = exercices.findIndex(function (ex) { return ex.id === seed.id; });
                if (index === -1) {
                    exercices.push(clone(seed));
                } else if (!exercices[index].matiere) {
                    exercices[index].matiere = seed.matiere;
                }
            });
            modifie = true;
        }

        if (version < SEED_VERSION) {
            // Migration : rattache les contenus créés avant les espaces au premier administrateur.
            const admins = (window.LearnHubAuth ? window.LearnHubAuth.users() : []).filter(function (u) {
                return u.role === 'admin' && u.espaceId;
            });
            const proprietaire = admins.find(function (u) { return u.username === 'admin'; }) || admins[0];
            if (proprietaire) {
                const idsSeedExercices = window.LearnHubData.exercicesSeed.map(function (ex) { return ex.id; });
                const idsSeedRessources = window.LearnHubData.ressourcesSeed.map(function (r) { return r.id; });
                exercices.forEach(function (ex) {
                    if (!ex.espaceId && idsSeedExercices.indexOf(ex.id) === -1) {
                        ex.espaceId = proprietaire.espaceId;
                        modifie = true;
                    }
                });
                ressources.forEach(function (r) {
                    if (!r.espaceId && idsSeedRessources.indexOf(r.id) === -1) {
                        r.espaceId = proprietaire.espaceId;
                        modifie = true;
                    }
                });
            }
        }

        if (modifie) {
            write(KEYS.exercices, exercices);
            write(KEYS.ressources, ressources);
        }
        if (!read(KEYS.classes, null)) write(KEYS.classes, []);
        if (!read(KEYS.seances, null)) write(KEYS.seances, []);
        if (version < SEED_VERSION) amorcerEspacesAdmins();
        write(KEYS.seeded, SEED_VERSION);
    }

    const exercices = {
        all: function () {
            return read(KEYS.exercices, []).map(function (ex) {
                return ex.matiere ? ex : Object.assign({}, ex, { matiere: 'francais' });
            }).filter(visible);
        },
        miens: function () {
            const espace = espaceActif();
            if (!espace) return [];
            return read(KEYS.exercices, []).map(function (ex) {
                return ex.matiere ? ex : Object.assign({}, ex, { matiere: 'francais' });
            }).filter(dansEspaceActif);
        },
        actifs: function () {
            return this.all().filter(function (ex) { return ex.actif !== false; });
        },
        byType: function (type) {
            return this.all().filter(function (ex) { return ex.type === type; });
        },
        get: function (id) {
            return this.all().find(function (ex) { return ex.id === id; }) || null;
        },
        save: function (data) {
            const espace = espaceActif();
            if (!espace) return null;
            const liste = read(KEYS.exercices, []);
            const existant = data.id ? liste.findIndex(function (ex) { return ex.id === data.id; }) : -1;
            if (existant >= 0 && liste[existant].espaceId && liste[existant].espaceId !== espace) {
                return null;
            }
            const enregistrement = Object.assign({}, data, {
                id: data.id || uid(data.type || 'exo'),
                espaceId: espace,
                maj: new Date().toISOString()
            });
            if (existant >= 0) {
                liste[existant] = Object.assign({}, liste[existant], enregistrement);
            } else {
                enregistrement.cree = new Date().toISOString();
                liste.push(enregistrement);
            }
            const ok = write(KEYS.exercices, liste);
            return ok ? enregistrement : null;
        },
        remove: function (id) {
            const liste = read(KEYS.exercices, []);
            const cible = liste.find(function (ex) { return ex.id === id; });
            if (!cible || !dansEspaceActif(cible)) return false;
            return write(KEYS.exercices, liste.filter(function (ex) { return ex.id !== id; }));
        },
        toggle: function (id) {
            const liste = read(KEYS.exercices, []);
            const exo = liste.find(function (ex) { return ex.id === id; });
            if (!exo || !dansEspaceActif(exo)) return false;
            exo.actif = exo.actif === false;
            return write(KEYS.exercices, liste);
        },
        importerDemo: function (espaceCible) {
            const espace = espaceCible || espaceActif();
            if (!espace) return 0;
            const liste = read(KEYS.exercices, []);
            let importes = 0;
            window.LearnHubData.exercicesSeed.forEach(function (seed) {
                const dejaLa = liste.some(function (ex) {
                    return ex.espaceId === espace && ex.titre === seed.titre;
                });
                if (dejaLa) return;
                liste.push(Object.assign(clone(seed), {
                    id: uid('exo'),
                    espaceId: espace,
                    cree: new Date().toISOString()
                }));
                importes++;
            });
            if (importes) write(KEYS.exercices, liste);
            return importes;
        },
        count: function () {
            return this.all().length;
        }
    };

    const ressources = {
        all: function () {
            return read(KEYS.ressources, []).filter(visible);
        },
        miens: function () {
            const espace = espaceActif();
            if (!espace) return [];
            return read(KEYS.ressources, []).filter(dansEspaceActif);
        },
        get: function (id) {
            return this.all().find(function (r) { return r.id === id; }) || null;
        },
        save: function (data) {
            const espace = espaceActif();
            if (!espace) return null;
            const liste = read(KEYS.ressources, []);
            const index = data.id ? liste.findIndex(function (r) { return r.id === data.id; }) : -1;
            if (index >= 0 && liste[index].espaceId && liste[index].espaceId !== espace) {
                return null;
            }
            const enregistrement = Object.assign({}, data, { id: data.id || uid('res'), espaceId: espace });
            if (index >= 0) {
                liste[index] = Object.assign({}, liste[index], enregistrement);
            } else {
                liste.push(enregistrement);
            }
            const ok = write(KEYS.ressources, liste);
            return ok ? enregistrement : null;
        },
        remove: function (id) {
            const liste = read(KEYS.ressources, []);
            const cible = liste.find(function (r) { return r.id === id; });
            if (!cible || !dansEspaceActif(cible)) return false;
            return write(KEYS.ressources, liste.filter(function (r) { return r.id !== id; }));
        },
        count: function () {
            return this.all().length;
        }
    };

    const settings = {
        /** Les réglages sont propres à chaque espace ; « public » sert de valeur par défaut. */
        toutes: function () {
            const brut = read(KEYS.settings, {});
            if (brut && typeof brut === 'object' && brut.tempsQuestion !== undefined) {
                return { parEspace: { public: brut } };
            }
            if (!brut || typeof brut !== 'object' || !brut.parEspace) return { parEspace: {} };
            return brut;
        },
        get: function () {
            const espace = espaceActif() || 'public';
            const tous = this.toutes();
            const base = Object.assign({}, DEFAULT_SETTINGS, tous.parEspace.public || {});
            return Object.assign(base, tous.parEspace[espace] || {});
        },
        save: function (patch) {
            const espace = espaceActif() || 'public';
            const tous = this.toutes();
            tous.parEspace[espace] = Object.assign({}, tous.parEspace[espace] || {}, patch);
            return write(KEYS.settings, tous) ? this.get() : null;
        },
        defaults: function () {
            return clone(DEFAULT_SETTINGS);
        }
    };

    /* ---------------------------------- Classes ---------------------------------- */

    const classes = {
        all: function () {
            return read(KEYS.classes, []);
        },
        miens: function () {
            return this.all().filter(dansEspaceActif);
        },
        get: function (id) {
            return this.all().find(function (c) { return c.id === id; }) || null;
        },
        byCode: function (code) {
            const cible = String(code || '').trim().toUpperCase();
            if (!cible) return null;
            return this.all().find(function (c) { return String(c.code).toUpperCase() === cible; }) || null;
        },
        save: function (data) {
            const espace = espaceActif();
            if (!espace) return null;
            const liste = read(KEYS.classes, []);
            const index = data.id ? liste.findIndex(function (c) { return c.id === data.id; }) : -1;
            if (index >= 0 && liste[index].espaceId !== espace) return null;
            const enregistrement = Object.assign({}, data, { espaceId: espace });
            if (index >= 0) {
                liste[index] = Object.assign({}, liste[index], enregistrement, { code: liste[index].code });
                write(KEYS.classes, liste);
                return liste[index];
            }
            let code = codeClasse();
            while (liste.some(function (c) { return String(c.code).toUpperCase() === code; })) {
                code = codeClasse();
            }
            enregistrement.id = data.id || uid('classe');
            enregistrement.code = code;
            enregistrement.cree = new Date().toISOString();
            liste.push(enregistrement);
            return write(KEYS.classes, liste) ? enregistrement : null;
        },
        remove: function (id) {
            const liste = read(KEYS.classes, []);
            const cible = liste.find(function (c) { return c.id === id; });
            if (!cible || !dansEspaceActif(cible)) return false;
            if (window.LearnHubAuth && typeof window.LearnHubAuth.detacherClasse === 'function') {
                window.LearnHubAuth.detacherClasse(id);
            }
            const seances = read(KEYS.seances, []).map(function (seance) {
                return Object.assign({}, seance, {
                    classeIds: (seance.classeIds || []).filter(function (cid) { return cid !== id; })
                });
            });
            write(KEYS.seances, seances);
            return write(KEYS.classes, liste.filter(function (c) { return c.id !== id; }));
        },
        count: function () {
            return this.miens().length;
        }
    };

    /* ---------------------------------- Séances ---------------------------------- */

    const seances = {
        all: function () {
            return read(KEYS.seances, []).filter(visible);
        },
        miens: function () {
            const espace = espaceActif();
            if (!espace) return [];
            return read(KEYS.seances, []).filter(dansEspaceActif);
        },
        get: function (id) {
            return this.all().find(function (s) { return s.id === id; }) || null;
        },
        pourClasse: function (classeId) {
            if (!classeId) return [];
            return this.all().filter(function (s) {
                if (s.publie === false) return false;
                const cibles = s.classeIds || [];
                return !cibles.length || cibles.indexOf(classeId) >= 0;
            });
        },
        save: function (data) {
            const espace = espaceActif();
            if (!espace) return null;
            const liste = read(KEYS.seances, []);
            const index = data.id ? liste.findIndex(function (s) { return s.id === data.id; }) : -1;
            if (index >= 0 && liste[index].espaceId !== espace) return null;
            const enregistrement = Object.assign({}, data, {
                id: data.id || uid('seance'),
                espaceId: espace,
                classeIds: Array.isArray(data.classeIds) ? data.classeIds : [],
                chapitres: Array.isArray(data.chapitres) ? data.chapitres : [],
                exercices: Array.isArray(data.exercices) ? data.exercices : [],
                maj: new Date().toISOString()
            });
            if (index >= 0) {
                liste[index] = Object.assign({}, liste[index], enregistrement);
            } else {
                enregistrement.cree = new Date().toISOString();
                liste.push(enregistrement);
            }
            return write(KEYS.seances, liste) ? enregistrement : null;
        },
        remove: function (id) {
            const liste = read(KEYS.seances, []);
            const cible = liste.find(function (s) { return s.id === id; });
            if (!cible || !dansEspaceActif(cible)) return false;
            return write(KEYS.seances, liste.filter(function (s) { return s.id !== id; }));
        },
        count: function () {
            return this.miens().length;
        }
    };

    function viderEspace() {
        const espace = espaceActif();
        if (!espace) return null;
        const resultat = {};
        [['exercices', KEYS.exercices], ['ressources', KEYS.ressources], ['seances', KEYS.seances]].forEach(function (paire) {
            const liste = read(paire[1], []);
            const garde = liste.filter(function (entree) { return entree.espaceId !== espace; });
            resultat[paire[0]] = liste.length - garde.length;
            write(paire[1], garde);
        });
        return resultat;
    }

    return {
        keys: KEYS,
        seedIfNeeded: seedIfNeeded,
        uid: uid,
        espaceActif: espaceActif,
        viderEspace: viderEspace,
        exercices: exercices,
        ressources: ressources,
        settings: settings,
        classes: classes,
        seances: seances
    };
})();
