/**
 * LearnHub — persistance locale (localStorage).
 * Regroupe les exercices, les ressources et les paramètres partagés entre
 * l'espace élève et le back-office.
 */
window.LearnHubStore = (function () {
    'use strict';

    const PREFIX = 'learnhub.v1.';
    const SEED_VERSION = 2;
    const KEYS = {
        exercices: PREFIX + 'exercices',
        ressources: PREFIX + 'ressources',
        settings: PREFIX + 'settings',
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

    function seedIfNeeded() {
        const version = Number(read(KEYS.seeded, 0));
        if (!version) {
            write(KEYS.exercices, clone(window.LearnHubData.exercicesSeed));
            write(KEYS.ressources, clone(window.LearnHubData.ressourcesSeed));
            write(KEYS.settings, clone(DEFAULT_SETTINGS));
            write(KEYS.seeded, SEED_VERSION);
            return;
        }
        if (version < SEED_VERSION) {
            // Migration : ajoute les nouveaux exercices livrés sans écraser les créations locales.
            const existants = read(KEYS.exercices, []);
            window.LearnHubData.exercicesSeed.forEach(function (seed) {
                const index = existants.findIndex(function (ex) { return ex.id === seed.id; });
                if (index === -1) {
                    existants.push(clone(seed));
                } else if (!existants[index].matiere) {
                    existants[index].matiere = seed.matiere;
                }
            });
            write(KEYS.exercices, existants);
            write(KEYS.seeded, SEED_VERSION);
        }
    }

    const exercices = {
        all: function () {
            return read(KEYS.exercices, []).map(function (ex) {
                return ex.matiere ? ex : Object.assign({}, ex, { matiere: 'francais' });
            });
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
            const liste = this.all();
            const existant = data.id ? liste.findIndex(function (ex) { return ex.id === data.id; }) : -1;
            const enregistrement = Object.assign({}, data, {
                id: data.id || uid(data.type || 'exo'),
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
            const liste = this.all().filter(function (ex) { return ex.id !== id; });
            return write(KEYS.exercices, liste);
        },
        toggle: function (id) {
            const liste = this.all();
            const exo = liste.find(function (ex) { return ex.id === id; });
            if (!exo) return false;
            exo.actif = exo.actif === false;
            return write(KEYS.exercices, liste);
        },
        count: function () {
            return this.all().length;
        }
    };

    const ressources = {
        all: function () {
            return read(KEYS.ressources, []);
        },
        get: function (id) {
            return this.all().find(function (r) { return r.id === id; }) || null;
        },
        save: function (data) {
            const liste = this.all();
            const index = data.id ? liste.findIndex(function (r) { return r.id === data.id; }) : -1;
            const enregistrement = Object.assign({}, data, { id: data.id || uid('res') });
            if (index >= 0) {
                liste[index] = Object.assign({}, liste[index], enregistrement);
            } else {
                liste.push(enregistrement);
            }
            const ok = write(KEYS.ressources, liste);
            return ok ? enregistrement : null;
        },
        remove: function (id) {
            return write(KEYS.ressources, this.all().filter(function (r) { return r.id !== id; }));
        },
        count: function () {
            return this.all().length;
        }
    };

    const settings = {
        get: function () {
            return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {}));
        },
        save: function (patch) {
            const fusion = Object.assign({}, this.get(), patch);
            return write(KEYS.settings, fusion) ? fusion : null;
        },
        defaults: function () {
            return clone(DEFAULT_SETTINGS);
        }
    };

    return {
        keys: KEYS,
        seedIfNeeded: seedIfNeeded,
        uid: uid,
        exercices: exercices,
        ressources: ressources,
        settings: settings
    };
})();
