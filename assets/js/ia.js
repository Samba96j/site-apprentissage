/**
 * LearnHub — assistant IA côté navigateur.
 *
 * En mode Supabase, la génération passe par l'Edge Function `ia` (la clé du
 * fournisseur reste côté serveur) et les contenus sont stockés dans la table
 * `ia_contenus`, filtrée par RLS : chaque élève ne voit que ses fiches.
 * En mode local (sans backend), les contenus sont conservés dans localStorage.
 */
window.LearnHubIA = (function () {
    'use strict';

    const CLE_STOCKAGE = 'learnhub.v1.ia';

    function backend() {
        const b = window.LearnHubBackend;
        return b && b.estActif() ? b : null;
    }

    function utilisateur() {
        const auth = window.LearnHubAuth;
        return auth && typeof auth.current === 'function' ? auth.current() : null;
    }

    function lireLocal() {
        try {
            return JSON.parse(localStorage.getItem(CLE_STOCKAGE) || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function ecrireLocal(valeur) {
        try {
            localStorage.setItem(CLE_STOCKAGE, JSON.stringify(valeur));
        } catch (e) {
            /* quota navigateur atteint : on ignore */
        }
    }

    function trier(liste) {
        return liste.slice().sort(function (a, b) {
            return new Date(b.date || 0) - new Date(a.date || 0);
        });
    }

    function mesContenus() {
        const b = backend();
        if (b) return trier(b.contenusIA());
        const user = utilisateur();
        if (!user) return [];
        const tout = lireLocal();
        return trier(tout[user.username] || []);
    }

    function disponible() {
        return !!backend();
    }

    async function generer(parametres) {
        const b = backend();
        if (!b) {
            return { ok: false, code: 'local', error: 'La génération IA nécessite le backend Supabase.' };
        }
        return b.invoquerIA(parametres);
    }

    async function enregistrer(entree) {
        const b = backend();
        if (b) return b.enregistrerIA(entree);

        const user = utilisateur();
        if (!user) return { ok: false, error: 'Connexion requise.' };
        const tout = lireLocal();
        const liste = tout[user.username] || [];
        const contenu = Object.assign({
            id: 'ia-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            date: new Date().toISOString()
        }, entree);
        liste.unshift(contenu);
        tout[user.username] = liste.slice(0, 50);
        ecrireLocal(tout);
        return { ok: true, id: contenu.id };
    }

    async function supprimer(id) {
        const b = backend();
        if (b) return b.supprimerIA(id);

        const user = utilisateur();
        if (!user) return { ok: false, error: 'Connexion requise.' };
        const tout = lireLocal();
        tout[user.username] = (tout[user.username] || []).filter(function (c) { return c.id !== id; });
        ecrireLocal(tout);
        return { ok: true };
    }

    function libelleType(type) {
        return type === 'question' ? 'Recherche' : 'Étude d\'œuvre';
    }

    /**
     * Contenu de démonstration : structure complète, sans invention de faits,
     * utilisé quand aucune clé IA n'est configurée. Toujours signalé comme tel.
     */
    function exemple(mode, parametres) {
        const oeuvre = (parametres && parametres.oeuvre) || 'Œuvre choisie';
        const auteur = (parametres && parametres.auteur) || 'Auteur à préciser';
        const question = (parametres && parametres.question) || 'Votre question';

        if (mode === 'question') {
            return {
                question: question,
                reponse: 'Exemple de démonstration : ici apparaîtra la réponse courte générée par l\'IA.',
                explication: 'Ce bloc présentera l\'explication détaillée, adaptée au niveau choisi. ' +
                    'La génération réelle s\'active dès qu\'une clé IA est configurée dans Supabase.',
                exemple: 'Un exemple concret illustrera la notion.',
                aRetenir: [
                    'La réponse est structurée : réponse courte, explication, exemple, à retenir.',
                    'Chaque contenu généré doit être vérifié avant d\'être appris.',
                    'Les questions finales servent à s\'auto-évaluer.'
                ],
                questions: [
                    'Pouvez-vous reformuler la réponse avec vos propres mots ?',
                    'Quel exemple personnel illustre cette notion ?',
                    'Quelle partie reste à approfondir ?'
                ]
            };
        }

        return {
            titre: oeuvre,
            auteur: auteur,
            epoque: 'À compléter',
            genre: 'À compléter',
            mouvement: 'À compléter',
            resume: 'Exemple de démonstration : ce bloc accueillera le résumé de « ' + oeuvre + ' » généré par l\'IA.',
            contexte: 'Ce bloc présentera le contexte historique et littéraire de l\'œuvre.',
            parties: [
                { titre: 'Première partie', resume: 'Résumé de la première partie.' },
                { titre: 'Deuxième partie', resume: 'Résumé de la deuxième partie.' }
            ],
            personnages: [
                { nom: 'Personnage principal', role: 'Rôle dans l\'intrigue', description: 'Description et évolution du personnage.' }
            ],
            themes: [
                { titre: 'Thème principal', explication: 'Explication du thème et de son traitement dans l\'œuvre.' }
            ],
            procedes: [
                { nom: 'Procédé d\'écriture', exemple: 'Citation ou passage', effet: 'Effet produit sur le lecteur' }
            ],
            citations: [
                { texte: 'Citation marquante de l\'œuvre', explication: 'Analyse de la citation.' }
            ],
            questions: [
                'Quel est le sujet principal de l\'œuvre ?',
                'Comment évolue le personnage principal ?'
            ],
            sujets: [
                'Sujet d\'exposé ou de dissertation proposé par l\'IA.'
            ]
        };
    }

    return {
        disponible: disponible,
        mesContenus: mesContenus,
        generer: generer,
        enregistrer: enregistrer,
        supprimer: supprimer,
        exemple: exemple,
        libelleType: libelleType
    };
})();
