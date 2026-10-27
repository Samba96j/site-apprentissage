/**
 * LearnHub — application monopage.
 * Un seul point d'entrée (index.html) et un routage par ancre (#/...) : le menu,
 * la session et la recherche sont partagés entre toutes les vues.
 */
(function () {
    'use strict';

    const app = document.getElementById('app');
    const data = window.LearnHubData;
    const store = window.LearnHubStore;
    const auth = window.LearnHubAuth;

    /* --------------------------------- Utilitaires --------------------------------- */

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normaliser(texte) {
        return String(texte || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function niveauNom(slug) {
        const niveau = data.getNiveau(slug);
        return niveau ? niveau.nom : slug;
    }

    function badgeNiveau(slug) {
        return '<a class="badge niveau-badge text-decoration-none" href="#/niveau/' + esc(slug) + '">' + esc(niveauNom(slug)) + '</a>';
    }

    function parseRoute() {
        const brut = (location.hash || '').replace(/^#\/?/, '');
        const parties = brut.split('?');
        const segments = parties[0].split('/').filter(Boolean).map(function (segment) {
            return decodeURIComponent(segment);
        });
        return { segments: segments, params: new URLSearchParams(parties[1] || '') };
    }

    function naviguer(url) {
        if (location.hash === url) {
            router();
        } else {
            location.hash = url;
        }
    }

    let toastTimer = null;
    function toast(texte, type) {
        const zone = document.getElementById('toast-zone');
        if (!zone) return;
        zone.className = 'toast-zone show';
        zone.innerHTML = '<div class="toast-message border-start border-4 border-' + (type || 'success') + '">' +
            '<i class="fas fa-circle-check me-2 text-' + (type || 'success') + '"></i>' + esc(texte) + '</div>';
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            zone.className = 'toast-zone';
        }, 4000);
    }

    /* --------------------------------- En-tête / pied --------------------------------- */

    function menuMatières() {
        return data.matieres.map(function (matiere) {
            return '<li><a class="dropdown-item" href="#/matiere/' + esc(matiere.slug) + '">' + esc(matiere.nom) + '</a></li>';
        }).join('') +
            '<li><hr class="dropdown-divider"></li>' +
            '<li><a class="dropdown-item" href="#/matieres">Toutes les matières</a></li>';
    }

    function menuNiveaux() {
        return data.niveaux.map(function (niveau) {
            return '<li><a class="dropdown-item" href="#/niveau/' + esc(niveau.slug) + '">' + esc(niveau.nom) + ' <span class="text-muted small">' + esc(niveau.cycle) + '</span></a></li>';
        }).join('');
    }

    function htmlEntete() {
        return '<nav class="navbar navbar-expand-lg navbar-dark bg-edu sticky-top">' +
            '<div class="container">' +
                '<a class="navbar-brand" href="#/"><i class="fas fa-graduation-cap me-2"></i>LearnHub</a>' +
                '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Ouvrir le menu">' +
                    '<span class="navbar-toggler-icon"></span>' +
                '</button>' +
                '<div class="collapse navbar-collapse" id="mainNav">' +
                    '<ul class="navbar-nav me-auto mb-2 mb-lg-0">' +
                        '<li class="nav-item"><a class="nav-link" href="#/" data-nav="accueil">Accueil</a></li>' +
                        '<li class="nav-item dropdown">' +
                            '<a class="nav-link dropdown-toggle" href="#/matieres" role="button" data-bs-toggle="dropdown" data-nav="matieres">Matières</a>' +
                            '<ul class="dropdown-menu">' + menuMatières() + '</ul>' +
                        '</li>' +
                        '<li class="nav-item dropdown">' +
                            '<a class="nav-link dropdown-toggle" href="#/niveaux" role="button" data-bs-toggle="dropdown" data-nav="niveaux">Niveaux</a>' +
                            '<ul class="dropdown-menu">' + menuNiveaux() + '</ul>' +
                        '</li>' +
                        '<li class="nav-item"><a class="nav-link" href="#/cours/une-si-longue-lettre" data-nav="cours">Étude d\'œuvre</a></li>' +
                        '<li class="nav-item"><a class="nav-link" href="#/exercices" data-nav="exercices">Exercices</a></li>' +
                    '</ul>' +
                    '<form class="d-flex header-search my-2 my-lg-0" id="form-recherche" role="search">' +
                        '<label class="visually-hidden" for="champ-recherche">Rechercher</label>' +
                        '<input class="form-control me-2" type="search" id="champ-recherche" placeholder="Rechercher un cours, un chapitre…" autocomplete="off">' +
                        '<button class="btn btn-light" type="submit" aria-label="Lancer la recherche"><i class="fas fa-search"></i></button>' +
                    '</form>' +
                    '<div class="ms-lg-2 mt-2 mt-lg-0" id="zone-auth"></div>' +
                '</div>' +
            '</div>' +
        '</nav>';
    }

    function htmlPied() {
        return '<footer class="mt-5">' +
            '<div class="container">' +
                '<div class="row">' +
                    '<div class="col-lg-4 mb-4">' +
                        '<h5 class="d-flex align-items-center"><i class="fas fa-graduation-cap me-2"></i>LearnHub</h5>' +
                        '<p class="mb-2">Plateforme éducative pour tous les niveaux et tous les domaines de connaissance.</p>' +
                        '<p class="small text-white-50 mb-0">Site statique : les comptes et la progression sont enregistrés dans votre navigateur.</p>' +
                    '</div>' +
                    '<div class="col-6 col-lg-2 mb-4">' +
                        '<h6>Matières</h6>' +
                        '<ul class="list-unstyled">' + data.matieres.map(function (matiere) {
                            return '<li><a href="#/matiere/' + esc(matiere.slug) + '">' + esc(matiere.nom) + '</a></li>';
                        }).join('') + '</ul>' +
                    '</div>' +
                    '<div class="col-6 col-lg-2 mb-4">' +
                        '<h6>Niveaux</h6>' +
                        '<ul class="list-unstyled">' + data.niveaux.map(function (niveau) {
                            return '<li><a href="#/niveau/' + esc(niveau.slug) + '">' + esc(niveau.nom) + '</a></li>';
                        }).join('') + '</ul>' +
                    '</div>' +
                    '<div class="col-6 col-lg-2 mb-4">' +
                        '<h6>Apprendre</h6>' +
                        '<ul class="list-unstyled">' +
                            '<li><a href="#/cours/une-si-longue-lettre">Étude d\'œuvre</a></li>' +
                            '<li><a href="#/exercices">Exercices</a></li>' +
                            '<li><a href="#/recherche">Recherche</a></li>' +
                            '<li><a href="#/profil">Ma progression</a></li>' +
                        '</ul>' +
                    '</div>' +
                    '<div class="col-6 col-lg-2 mb-4">' +
                        '<h6>Espace admin</h6>' +
                        '<ul class="list-unstyled">' +
                            '<li><a href="#/admin">Tableau de bord</a></li>' +
                            '<li><a href="#/admin/exercices">Exercices</a></li>' +
                            '<li><a href="#/admin/ressources">Ressources</a></li>' +
                            '<li><a href="#/admin/statistiques">Statistiques</a></li>' +
                        '</ul>' +
                    '</div>' +
                '</div>' +
                '<hr class="border-light opacity-25">' +
                '<div class="d-flex flex-wrap justify-content-between small text-white-50">' +
                    '<span>&copy; ' + new Date().getFullYear() + ' LearnHub.</span>' +
                    '<span>Contenus pédagogiques — démonstration.</span>' +
                '</div>' +
            '</div>' +
        '</footer>';
    }

    function htmlZoneAuth() {
        const user = auth.current();
        if (!user) {
            return '<a href="#/connexion" class="btn btn-outline-light btn-sm me-2">Connexion</a>' +
                '<a href="#/connexion?mode=inscription" class="btn btn-primary btn-sm">Inscription</a>';
        }
        return '<div class="dropdown">' +
            '<button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
                '<i class="fas fa-user-circle me-1"></i>' + esc(user.username) +
            '</button>' +
            '<ul class="dropdown-menu dropdown-menu-end">' +
                '<li><a class="dropdown-item" href="#/profil"><i class="fas fa-chart-line me-2"></i>Ma progression</a></li>' +
                (user.role === 'admin' ? '<li><a class="dropdown-item" href="#/admin"><i class="fas fa-user-cog me-2"></i>Administration</a></li>' : '') +
                '<li><hr class="dropdown-divider"></li>' +
                '<li><button class="dropdown-item" type="button" id="bouton-deconnexion"><i class="fas fa-sign-out-alt me-2"></i>Se déconnecter</button></li>' +
            '</ul>' +
        '</div>';
    }

    function majEntete(segments) {
        const zoneAuth = document.getElementById('zone-auth');
        if (zoneAuth) {
            zoneAuth.innerHTML = htmlZoneAuth();
            const deconnexion = document.getElementById('bouton-deconnexion');
            if (deconnexion) {
                deconnexion.addEventListener('click', function () {
                    auth.logout();
                    toast('Vous êtes déconnecté.');
                    naviguer('#/');
                    majEntete(segments);
                });
            }
        }

        const section = segments[0] || 'accueil';
        document.querySelectorAll('[data-nav]').forEach(function (lien) {
            const cle = lien.dataset.nav;
            const actif = cle === section ||
                (cle === 'matieres' && (section === 'matiere' || section === 'chapitre')) ||
                (cle === 'niveaux' && section === 'niveau') ||
                (cle === 'accueil' && !segments.length) ||
                (cle === 'cours' && section === 'cours');
            lien.classList.toggle('active', actif);
        });
    }

    /* ------------------------------------ Vues ------------------------------------ */

    function vueAccueil() {
        const chapitres = data.getChapitres();
        const exercices = store.exercices.actifs();
        const cartes = data.matieres.map(function (matiere) {
            return '<div class="col-md-6 col-lg-3">' +
                '<div class="card h-100 domaine-card">' +
                    '<div class="card-body text-center">' +
                        '<div class="domaine-icon ' + esc(matiere.couleur) + '"><i class="fas ' + esc(matiere.icone) + '"></i></div>' +
                        '<h3 class="h5 mt-3">' + esc(matiere.nom) + '</h3>' +
                        '<p class="text-muted small">' + esc(matiere.resume) + '</p>' +
                        '<p class="small text-muted mb-2">' + matiere.chapitres.length + ' chapitres</p>' +
                        '<a href="#/matiere/' + esc(matiere.slug) + '" class="btn btn-sm btn-outline-primary">Explorer</a>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        return {
            titre: "Apprendre sans limites",
            html:
                '<section class="hero-section py-5">' +
                    '<div class="container py-4">' +
                        '<div class="row align-items-center">' +
                            '<div class="col-lg-6">' +
                                '<h1 class="display-5 fw-bold mb-4">Apprendre sans limites</h1>' +
                                '<p class="lead mb-4">Cours, fiches et exercices interactifs du collège à l\'enseignement supérieur, réunis dans un seul espace.</p>' +
                                '<div class="d-flex flex-wrap gap-3">' +
                                    '<a href="#/matieres" class="btn btn-primary btn-lg">Commencer maintenant</a>' +
                                    '<a href="#/cours/une-si-longue-lettre" class="btn btn-outline-primary btn-lg">Découvrir une étude d\'œuvre</a>' +
                                '</div>' +
                            '</div>' +
                            '<div class="col-lg-6 text-center">' +
                                '<img src="assets/images/presentation-bibliotheque.png" alt="Présentation de LearnHub : lire, apprendre et se former en toute liberté" class="img-fluid photo-presentation">' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</section>' +
                '<section class="py-4">' +
                    '<div class="container">' +
                        '<div class="row g-3 text-center">' +
                            '<div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-valeur">' + chapitres.length + '</div><div class="stat-label">chapitres</div></div></div>' +
                            '<div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-valeur">' + exercices.length + '</div><div class="stat-label">exercices actifs</div></div></div>' +
                            '<div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-valeur">' + data.niveaux.length + '</div><div class="stat-label">niveaux</div></div></div>' +
                            '<div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-valeur">' + data.matieres.length + '</div><div class="stat-label">matières</div></div></div>' +
                        '</div>' +
                    '</div>' +
                '</section>' +
                '<section class="py-5 bg-light">' +
                    '<div class="container">' +
                        '<h2 class="text-center mb-5">Explorez nos domaines de connaissance</h2>' +
                        '<div class="row g-4">' + cartes + '</div>' +
                    '</div>' +
                '</section>' +
                '<section class="py-5">' +
                    '<div class="container">' +
                        '<h2 class="text-center mb-5">Nos méthodes pédagogiques</h2>' +
                        '<div class="row g-4">' +
                            methode('fa-gamepad', 'Apprentissage par jeu', 'Quiz chronométrés, associations et textes à trous avec correction immédiate.') +
                            methode('fa-route', 'Progression suivie', 'Chaque score est enregistré : moyenne, historique et badges personnels.') +
                            methode('fa-magnifying-glass', 'Recherche globale', 'Retrouvez un chapitre, un thème ou un exercice en quelques lettres.') +
                            methode('fa-user-shield', 'Espace enseignant', 'Créez et modifiez les exercices, suivez les résultats des élèves.') +
                        '</div>' +
                    '</div>' +
                '</section>' +
                '<section class="cta-section py-5 text-white">' +
                    '<div class="container text-center">' +
                        '<h2 class="mb-3">Prêt à commencer votre parcours ?</h2>' +
                        '<p class="lead mb-4">Créez un compte gratuit pour conserver vos scores et suivre votre progression.</p>' +
                        '<a href="#/connexion?mode=inscription" class="btn btn-light btn-lg">Créer un compte</a>' +
                    '</div>' +
                '</section>'
        };
    }

    function methode(icone, titre, texte) {
        return '<div class="col-md-6 col-lg-3">' +
            '<div class="card h-100 methode-card"><div class="card-body">' +
                '<div class="methode-icon"><i class="fas ' + icone + '"></i></div>' +
                '<h3 class="h6 mt-3">' + esc(titre) + '</h3>' +
                '<p class="text-muted small mb-0">' + esc(texte) + '</p>' +
            '</div></div>' +
        '</div>';
    }

    function vueMatieres() {
        const cartes = data.matieres.map(function (matiere) {
            const niveauxCouverts = {};
            matiere.chapitres.forEach(function (chapitre) { niveauxCouverts[chapitre.niveau] = true; });
            return '<div class="col-md-6">' +
                '<div class="card h-100 domaine-card"><div class="card-body">' +
                    '<div class="d-flex align-items-start gap-3">' +
                        '<div class="domaine-icon ' + esc(matiere.couleur) + '"><i class="fas ' + esc(matiere.icone) + '"></i></div>' +
                        '<div class="flex-grow-1">' +
                            '<h2 class="h5 mb-1">' + esc(matiere.nom) + '</h2>' +
                            '<p class="text-muted small mb-2">' + esc(matiere.description) + '</p>' +
                            '<div class="mb-2">' + Object.keys(niveauxCouverts).map(badgeNiveau).join(' ') + '</div>' +
                            '<a href="#/matiere/' + esc(matiere.slug) + '" class="btn btn-sm btn-primary">Voir les ' + matiere.chapitres.length + ' chapitres</a>' +
                        '</div>' +
                    '</div>' +
                '</div></div>' +
            '</div>';
        }).join('');

        return {
            titre: 'Toutes les matières',
            html: '<div class="container py-4">' +
                '<h1 class="h3 mb-4">Toutes les matières</h1>' +
                '<div class="row g-4">' + cartes + '</div>' +
            '</div>'
        };
    }

    function vueMatiere(slug) {
        const matiere = data.getMatiere(slug);
        if (!matiere) return vueIntrouvable('Cette matière n\'existe pas.');

        const parNiveau = data.niveaux.map(function (niveau) {
            const chapitres = matiere.chapitres.filter(function (chapitre) { return chapitre.niveau === niveau.slug; });
            if (!chapitres.length) return '';
            return '<div class="mb-4">' +
                '<h3 class="h5 d-flex align-items-center justify-content-between">' +
                    '<span>' + esc(niveau.nom) + ' <span class="text-muted small fw-normal">' + esc(niveau.cycle) + '</span></span>' +
                    '<a class="btn btn-sm btn-outline-primary" href="#/niveau/' + esc(niveau.slug) + '">Ce niveau</a>' +
                '</h3>' +
                '<div class="list-group">' + chapitres.map(function (chapitre) {
                    return '<a class="list-group-item list-group-item-action" href="#/chapitre/' + esc(chapitre.id) + '">' +
                        '<div class="d-flex justify-content-between align-items-center">' +
                            '<span class="fw-semibold">' + esc(chapitre.titre) + '</span>' +
                            '<span class="badge bg-light text-dark border">' + esc(chapitre.duree) + '</span>' +
                        '</div>' +
                        '<div class="small text-muted">' + esc(chapitre.resume) + '</div>' +
                    '</a>';
                }).join('') + '</div>' +
            '</div>';
        }).join('');

        return {
            titre: matiere.nom,
            html: '<div class="container py-4">' +
                '<nav aria-label="Fil d\'Ariane" class="mb-3"><a href="#/matieres" class="small text-decoration-none"><i class="fas fa-arrow-left me-1"></i>Toutes les matières</a></nav>' +
                '<div class="content mb-4">' +
                    '<div class="d-flex align-items-start gap-3">' +
                        '<div class="domaine-icon ' + esc(matiere.couleur) + '"><i class="fas ' + esc(matiere.icone) + '"></i></div>' +
                        '<div>' +
                            '<h1 class="h3 mb-1">' + esc(matiere.nom) + '</h1>' +
                            '<p class="text-muted mb-0">' + esc(matiere.description) + '</p>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                parNiveau +
                '<div class="mt-4"><a href="#/exercices" class="btn btn-primary"><i class="fas fa-gamepad me-1"></i>M\'entraîner avec les exercices</a></div>' +
            '</div>'
        };
    }

    function vueNiveaux() {
        const cartes = data.niveaux.map(function (niveau) {
            const chapitres = data.chapitresDuNiveau(niveau.slug);
            return '<div class="col-md-4">' +
                '<div class="card h-100 domaine-card"><div class="card-body">' +
                    '<div class="methode-icon mb-2"><i class="fas ' + esc(niveau.icone) + '"></i></div>' +
                    '<h2 class="h5">' + esc(niveau.nom) + '</h2>' +
                    '<p class="text-muted small mb-2">' + esc(niveau.cycle) + '</p>' +
                    '<p class="small">' + esc(niveau.description) + '</p>' +
                    '<a href="#/niveau/' + esc(niveau.slug) + '" class="btn btn-sm btn-outline-primary">' + chapitres.length + ' chapitres</a>' +
                '</div></div>' +
            '</div>';
        }).join('');

        return {
            titre: 'Niveaux',
            html: '<div class="container py-4"><h1 class="h3 mb-4">Tous les niveaux</h1><div class="row g-4">' + cartes + '</div></div>'
        };
    }

    function vueNiveau(slug) {
        const niveau = data.getNiveau(slug);
        if (!niveau) return vueIntrouvable('Ce niveau n\'existe pas.');

        const chapitres = data.chapitresDuNiveau(slug);
        const parMatiere = data.matieres.map(function (matiere) {
            const liste = chapitres.filter(function (chapitre) { return chapitre.matiere === matiere.slug; });
            if (!liste.length) return '';
            return '<div class="col-md-6">' +
                '<div class="card h-100 domain-card"><div class="card-body">' +
                    '<h3 class="h6 d-flex align-items-center"><i class="fas ' + esc(matiere.icone) + ' me-2 text-primary"></i>' + esc(matiere.nom) + '</h3>' +
                    '<ul class="list-unstyled mb-0 small">' + liste.map(function (chapitre) {
                        return '<li class="mb-2"><a href="#/chapitre/' + esc(chapitre.id) + '">' + esc(chapitre.titre) + '</a>' +
                            '<div class="text-muted">' + esc(chapitre.duree) + '</div></li>';
                    }).join('') + '</ul>' +
                '</div></div>' +
            '</div>';
        }).join('');

        return {
            titre: niveau.nom,
            html: '<div class="container py-4">' +
                '<nav aria-label="Fil d\'Ariane" class="mb-3"><a href="#/niveaux" class="small text-decoration-none"><i class="fas fa-arrow-left me-1"></i>Tous les niveaux</a></nav>' +
                '<div class="content mb-4">' +
                    '<h1 class="h3 mb-1">' + esc(niveau.nom) + ' <span class="text-muted h6">' + esc(niveau.cycle) + '</span></h1>' +
                    '<p class="text-muted mb-0">' + esc(niveau.description) + '</p>' +
                '</div>' +
                '<div class="row g-4">' + parMatiere + '</div>' +
            '</div>'
        };
    }

    function vueChapitre(id) {
        const chapitre = data.getChapitre(id);
        if (!chapitre) return vueIntrouvable('Ce chapitre n\'existe pas.');

        const matiere = data.getMatiere(chapitre.matiere);
        const autres = matiere.chapitres.filter(function (c) { return c.niveau === chapitre.niveau && c.id !== chapitre.id; });

        return {
            titre: chapitre.titre,
            html: '<div class="container py-4">' +
                '<nav aria-label="Fil d\'Ariane" class="mb-3 small">' +
                    '<a href="#/matieres" class="text-decoration-none">Matières</a> › ' +
                    '<a href="#/matiere/' + esc(matiere.slug) + '" class="text-decoration-none">' + esc(matiere.nom) + '</a> › ' +
                    '<a href="#/niveau/' + esc(chapitre.niveau) + '" class="text-decoration-none">' + esc(niveauNom(chapitre.niveau)) + '</a>' +
                '</nav>' +
                '<div class="content">' +
                    '<div class="d-flex flex-wrap gap-2 align-items-center mb-3">' +
                        '<span class="badge bg-primary bg-opacity-10 text-primary">' + esc(matiere.nom) + '</span>' +
                        badgeNiveau(chapitre.niveau) +
                        '<span class="badge bg-light text-dark border"><i class="fas fa-clock me-1"></i>' + esc(chapitre.duree) + '</span>' +
                    '</div>' +
                    '<h1 class="h3 mb-3">' + esc(chapitre.titre) + '</h1>' +
                    '<p class="lead">' + esc(chapitre.resume) + '</p>' +
                    '<div class="row g-4 mt-1">' +
                        '<div class="col-lg-6">' +
                            '<div class="theme-card p-3 h-100">' +
                                '<h2 class="h6"><i class="fas fa-bullseye me-2"></i>Objectifs</h2>' +
                                '<ul class="mb-0">' + chapitre.objectifs.map(function (objectif) {
                                    return '<li>' + esc(objectif) + '</li>';
                                }).join('') + '</ul>' +
                            '</div>' +
                        '</div>' +
                        '<div class="col-lg-6">' +
                            '<div class="theme-card p-3 h-100">' +
                                '<h2 class="h6"><i class="fas fa-key me-2"></i>À retenir</h2>' +
                                '<ul class="mb-0">' + chapitre.points.map(function (point) {
                                    return '<li>' + esc(point) + '</li>';
                                }).join('') + '</ul>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="d-flex flex-wrap gap-2 mt-4">' +
                        (chapitre.lienCours
                            ? '<a class="btn btn-primary" href="#/cours/' + esc(chapitre.lienCours) + '"><i class="fas fa-book-open me-1"></i>Ouvrir l\'étude complète</a>'
                            : '') +
                        '<a class="btn btn-outline-primary" href="#/exercices"><i class="fas fa-gamepad me-1"></i>S\'entraîner</a>' +
                        '<a class="btn btn-outline-secondary" href="#/matiere/' + esc(matiere.slug) + '"><i class="fas fa-arrow-left me-1"></i>Retour à la matière</a>' +
                    '</div>' +
                '</div>' +
                (autres.length
                    ? '<div class="content mt-4"><h2 class="h6 mb-3">Autres chapitres de ' + esc(niveauNom(chapitre.niveau)).toLowerCase() + ' en ' + esc(matiere.nom).toLowerCase() + '</h2>' +
                        '<ul class="list-unstyled mb-0">' + autres.map(function (autre) {
                            return '<li class="mb-2"><a href="#/chapitre/' + esc(autre.id) + '">' + esc(autre.titre) + '</a></li>';
                        }).join('') + '</ul></div>'
                    : '') +
            '</div>'
        };
    }

    function vueCours(slug, section) {
        const cours = data.getCours(slug);
        if (!cours) return vueIntrouvable('Ce cours n\'existe pas.');

        const sommaire = cours.sections.map(function (s) {
            return '<li class="nav-item"><a class="nav-link" href="#/cours/' + esc(cours.slug) + '/' + esc(s.id) + '">' +
                '<i class="fas ' + esc(s.icone) + '"></i> ' + esc(s.titre) + '</a></li>';
        }).join('');

        const contenu = cours.sections.map(function (s) {
            return '<section id="section-' + esc(s.id) + '" class="mb-5">' +
                '<h2 class="text-primary h4 mb-3"><i class="fas ' + esc(s.icone) + ' me-2"></i>' + esc(s.titre) + '</h2>' +
                s.html +
            '</section>';
        }).join('');

        return {
            titre: cours.titre,
            section: section,
            html: '<div class="container py-4">' +
                '<div class="row">' +
                    '<aside class="col-lg-3 mb-4 mb-lg-0">' +
                        '<div class="sidebar p-3 sticky-lg-top" style="top: 90px;">' +
                            '<h2 class="h6 text-primary mb-3"><i class="fas fa-compass me-2"></i>Sommaire</h2>' +
                            '<ul class="nav flex-column">' + sommaire + '</ul>' +
                            '<hr>' +
                            '<a class="btn btn-primary btn-sm w-100 mb-2" href="#/exercices"><i class="fas fa-gamepad me-1"></i>Exercices</a>' +
                            '<a class="btn btn-outline-secondary btn-sm w-100" href="#/matiere/francais"><i class="fas fa-book me-1"></i>Français</a>' +
                        '</div>' +
                    '</aside>' +
                    '<div class="col-lg-9">' +
                        '<div class="content">' +
                            '<div class="row align-items-center mb-4">' +
                                '<div class="col-md-8">' +
                                    '<p class="text-muted mb-1">' + esc(cours.auteur) + ' · ' + esc(cours.annee) + '</p>' +
                                    '<h1 class="h3 mb-2">' + esc(cours.titre) + '</h1>' +
                                    '<p class="mb-0">' + esc(cours.resume) + '</p>' +
                                '</div>' +
                                '<div class="col-md-4 text-center mt-3 mt-md-0">' +
                                    '<img src="' + esc(cours.image) + '" alt="Couverture de ' + esc(cours.titre) + '" class="img-fluid rounded-3 shadow-sm" style="max-height:220px">' +
                                '</div>' +
                            '</div>' +
                            contenu +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        };
    }

    function vueExercices() {
        const user = auth.current();
        const actifs = store.exercices.actifs();
        const pastilles = ['<button class="btn btn-sm btn-primary" data-matiere="" aria-pressed="true"><i class="fas fa-layer-group me-1"></i>Toutes <span class="badge bg-light text-dark ms-1">' + actifs.length + '</span></button>']
            .concat(data.matieres.map(function (matiere) {
                const nombre = actifs.filter(function (ex) { return ex.matiere === matiere.slug; }).length;
                return '<button class="btn btn-sm btn-outline-primary" data-matiere="' + esc(matiere.slug) + '" aria-pressed="false">' +
                    '<i class="fas ' + esc(matiere.icone) + ' me-1"></i>' + esc(matiere.nom) +
                    ' <span class="badge bg-light text-dark ms-1">' + nombre + '</span></button>';
            })).join('');

        return {
            titre: 'Exercices interactifs',
            html: '<div class="container py-4">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                    '<div>' +
                        '<h1 class="h3 mb-1">Exercices interactifs</h1>' +
                        '<p class="text-muted mb-0">Quiz chronométrés, associations et textes à trous dans toutes les matières.</p>' +
                    '</div>' +
                    (user
                        ? '<a class="btn btn-outline-primary btn-sm" href="#/profil"><i class="fas fa-chart-line me-1"></i>Ma progression</a>'
                        : '<a class="btn btn-primary btn-sm" href="#/connexion">Se connecter pour enregistrer mes scores</a>') +
                '</div>' +
                '<div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filtrer les exercices par matière">' + pastilles + '</div>' +
                '<div class="content"><div id="zone-jeux"></div></div>' +
                '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>Les exercices sont gérés depuis le back-office : un exercice créé par un administrateur apparaît ici immédiatement.</p>' +
            '</div>',
            after: function (racine) {
                const zone = racine.querySelector('#zone-jeux');
                const boutons = racine.querySelectorAll('[data-matiere]');

                function afficher(matiereSlug) {
                    const liste = matiereSlug
                        ? actifs.filter(function (ex) { return ex.matiere === matiereSlug; })
                        : actifs;
                    window.LearnHubGames.render(zone, {
                        exercices: liste,
                        onScore: function (resultat) {
                            if (resultat && resultat.ok) toast('Score enregistré : ' + resultat.tentative.score + '/' + resultat.tentative.total);
                        }
                    });
                }

                boutons.forEach(function (bouton) {
                    bouton.addEventListener('click', function () {
                        boutons.forEach(function (autre) {
                            autre.classList.remove('btn-primary');
                            autre.classList.add('btn-outline-primary');
                            autre.setAttribute('aria-pressed', 'false');
                        });
                        bouton.classList.remove('btn-outline-primary');
                        bouton.classList.add('btn-primary');
                        bouton.setAttribute('aria-pressed', 'true');
                        afficher(bouton.dataset.matiere);
                    });
                });

                afficher('');
            }
        };
    }

    function construireIndex() {
        const entrees = [];
        data.matieres.forEach(function (matiere) {
            entrees.push({
                type: 'Matière',
                titre: matiere.nom,
                texte: [matiere.nom, matiere.resume, matiere.description].join(' '),
                url: '#/matiere/' + matiere.slug
            });
            matiere.chapitres.forEach(function (chapitre) {
                entrees.push({
                    type: 'Chapitre',
                    titre: chapitre.titre,
                    texte: [chapitre.titre, chapitre.resume, matiere.nom, (chapitre.objectifs || []).join(' '), (chapitre.points || []).join(' ')].join(' '),
                    url: '#/chapitre/' + chapitre.id
                });
            });
        });
        data.niveaux.forEach(function (niveau) {
            entrees.push({
                type: 'Niveau',
                titre: niveau.nom,
                texte: [niveau.nom, niveau.description, niveau.cycle].join(' '),
                url: '#/niveau/' + niveau.slug
            });
        });
        data.cours.forEach(function (cours) {
            entrees.push({
                type: 'Cours',
                titre: cours.titre + ' — ' + cours.auteur,
                texte: [cours.titre, cours.auteur, cours.resume].join(' '),
                url: '#/cours/' + cours.slug
            });
            cours.sections.forEach(function (section) {
                entrees.push({
                    type: 'Cours',
                    titre: cours.titre + ' — ' + section.titre,
                    texte: [cours.titre, section.titre, section.html.replace(/<[^>]+>/g, ' ')].join(' '),
                    url: '#/cours/' + cours.slug + '/' + section.id
                });
            });
        });
        store.exercices.all().forEach(function (exercice) {
            const matiere = data.getMatiere(exercice.matiere);
            let texte = exercice.titre + ' ' + (matiere ? matiere.nom : '');
            if (exercice.type === 'quiz') {
                texte += ' ' + exercice.questions.map(function (q) { return q.question + ' ' + q.options.join(' '); }).join(' ');
            } else if (exercice.type === 'matching') {
                texte += ' ' + exercice.pairs.map(function (p) { return p.item + ' ' + p.match; }).join(' ');
            } else if (exercice.type === 'fillblank') {
                texte += ' ' + (exercice.quotes || []).map(function (q) { return q.text.replace(/<[^>]+>/g, ' '); }).join(' ');
            }
            entrees.push({ type: 'Exercice', titre: exercice.titre, texte: texte, url: '#/exercices' });
        });
        store.ressources.all().forEach(function (ressource) {
            entrees.push({
                type: 'Ressource',
                titre: ressource.titre,
                texte: [ressource.titre, ressource.type].join(' '),
                url: ressource.url
            });
        });
        return entrees;
    }

    function vueRecherche(parametres) {
        const requete = (parametres.get('q') || '').trim();
        let resultats = '';
        let resume = '';

        if (requete.length >= 2) {
            const mots = normaliser(requete).split(/\s+/).filter(Boolean);
            const entrees = construireIndex().map(function (entree) {
                return Object.assign({}, entree, { recherche: normaliser(entree.texte + ' ' + entree.titre) });
            });
            const trouvees = entrees.filter(function (entree) {
                return mots.every(function (mot) { return entree.recherche.indexOf(mot) !== -1; });
            });
            resume = trouvees.length + ' résultat(s) pour « ' + esc(requete) + ' »';
            resultats = trouvees.length
                ? '<div class="list-group">' + trouvees.slice(0, 40).map(function (entree) {
                    return '<a class="list-group-item list-group-item-action" href="' + esc(entree.url) + '">' +
                        '<div class="d-flex justify-content-between align-items-center">' +
                            '<span class="fw-semibold">' + esc(entree.titre) + '</span>' +
                            '<span class="badge bg-primary bg-opacity-10 text-primary">' + esc(entree.type) + '</span>' +
                        '</div>' +
                    '</a>';
                }).join('') + '</div>'
                : '<div class="alert alert-warning mb-0">Aucun résultat. Essayez un autre mot-clé (par exemple « polygamie », « Pythagore » ou « commentaire »).</div>';
        } else if (requete.length === 1) {
            resume = 'Saisissez au moins deux caractères.';
        } else {
            resume = 'Tapez un mot-clé pour explorer les cours, les chapitres et les exercices.';
        }

        return {
            titre: 'Recherche',
            html: '<div class="container py-4">' +
                '<h1 class="h3 mb-3">Recherche</h1>' +
                '<form class="row g-2 mb-4" id="form-recherche-page">' +
                    '<div class="col-sm"><label class="visually-hidden" for="recherche-page">Mot-clé</label>' +
                        '<input class="form-control" type="search" id="recherche-page" value="' + esc(requete) + '" placeholder="Un thème, un chapitre, un auteur…"></div>' +
                    '<div class="col-auto"><button class="btn btn-primary" type="submit"><i class="fas fa-search me-1"></i>Rechercher</button></div>' +
                '</form>' +
                '<p class="text-muted">' + resume + '</p>' +
                resultats +
            '</div>',
            after: function (racine) {
                const formulaire = racine.querySelector('#form-recherche-page');
                formulaire.addEventListener('submit', function (event) {
                    event.preventDefault();
                    const valeur = racine.querySelector('#recherche-page').value.trim();
                    naviguer('#/recherche?q=' + encodeURIComponent(valeur));
                });
            }
        };
    }

    function vueConnexion(parametres) {
        const mode = parametres.get('mode') === 'inscription' ? 'inscription' : 'connexion';
        const suivant = parametres.get('next') || '';

        return {
            titre: 'Connexion',
            html: '<div class="container py-4">' +
                '<div class="row justify-content-center">' +
                    '<div class="col-lg-7 col-xl-6">' +
                        '<div class="auth-container">' +
                            '<div class="auth-header">' +
                                '<i class="fas fa-user-circle auth-icon"></i>' +
                                '<h1 class="h4 mb-1">' + (mode === 'inscription' ? 'Créer un compte' : 'Connexion') + '</h1>' +
                                '<p class="text-muted mb-0">' + (mode === 'inscription' ? 'Vos scores seront conservés dans ce navigateur.' : 'Accédez à votre progression et à votre espace personnel.') + '</p>' +
                            '</div>' +
                            '<ul class="nav nav-pills nav-fill mb-3" role="tablist" id="onglets-auth">' +
                                '<li class="nav-item"><button class="nav-link ' + (mode === 'connexion' ? 'active' : '') + '" data-mode="connexion" type="button">Connexion</button></li>' +
                                '<li class="nav-item"><button class="nav-link ' + (mode === 'inscription' ? 'active' : '') + '" data-mode="inscription" type="button">Inscription</button></li>' +
                            '</ul>' +
                            '<div id="auth-message" class="d-none"></div>' +
                            '<form id="form-connexion" class="' + (mode === 'inscription' ? 'd-none' : '') + '">' +
                                '<div class="mb-3"><label class="form-label" for="login-username">Nom d\'utilisateur ou e-mail</label>' +
                                    '<input class="form-control" id="login-username" autocomplete="username" required></div>' +
                                '<div class="mb-3"><label class="form-label" for="login-password">Mot de passe</label>' +
                                    '<input class="form-control" type="password" id="login-password" autocomplete="current-password" required></div>' +
                                '<button class="btn btn-primary w-100" type="submit">Se connecter</button>' +
                            '</form>' +
                            '<form id="form-inscription" class="' + (mode === 'connexion' ? 'd-none' : '') + '">' +
                                '<div class="mb-3"><label class="form-label" for="reg-username">Nom d\'utilisateur</label>' +
                                    '<input class="form-control" id="reg-username" autocomplete="username" required></div>' +
                                '<div class="mb-3"><label class="form-label" for="reg-email">E-mail</label>' +
                                    '<input class="form-control" type="email" id="reg-email" autocomplete="email" required></div>' +
                                '<div class="mb-3"><label class="form-label" for="reg-password">Mot de passe</label>' +
                                    '<input class="form-control" type="password" id="reg-password" autocomplete="new-password" required>' +
                                    '<div class="form-text">Six caractères minimum.</div></div>' +
                                '<div class="mb-3"><label class="form-label" for="reg-confirm">Confirmer le mot de passe</label>' +
                                    '<input class="form-control" type="password" id="reg-confirm" autocomplete="new-password" required></div>' +
                                '<button class="btn btn-primary w-100" type="submit">Créer mon compte</button>' +
                            '</form>' +
                            '<hr class="my-4">' +
                            '<p class="small text-muted mb-1"><strong>Comptes de démonstration</strong></p>' +
                            '<p class="small text-muted mb-0">Élève : <code>etudiant</code> / <code>motdepasse</code><br>Administrateur : <code>admin</code> / <code>admin123</code></p>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>',
            after: function (racine) {
                const zoneMessage = racine.querySelector('#auth-message');
                const formConnexion = racine.querySelector('#form-connexion');
                const formInscription = racine.querySelector('#form-inscription');

                function afficherMessage(texte, type) {
                    zoneMessage.className = 'alert alert-' + type + ' py-2';
                    zoneMessage.textContent = texte;
                }

                racine.querySelectorAll('[data-mode]').forEach(function (bouton) {
                    bouton.addEventListener('click', function () {
                        racine.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.remove('active'); });
                        bouton.classList.add('active');
                        const inscription = bouton.dataset.mode === 'inscription';
                        formConnexion.classList.toggle('d-none', inscription);
                        formInscription.classList.toggle('d-none', !inscription);
                        zoneMessage.className = 'd-none';
                    });
                });

                formConnexion.addEventListener('submit', async function (event) {
                    event.preventDefault();
                    const identifiant = racine.querySelector('#login-username').value.trim();
                    const motDePasse = racine.querySelector('#login-password').value;
                    const bouton = formConnexion.querySelector('button[type="submit"]');
                    bouton.disabled = true;
                    const resultat = await auth.login(identifiant, motDePasse);
                    bouton.disabled = false;
                    if (!resultat.ok) {
                        afficherMessage(resultat.error, 'danger');
                        return;
                    }
                    toast('Bienvenue ' + resultat.user.username + ' !');
                    majEntete([]);
                    naviguer(suivant ? '#/' + suivant : '#/');
                });

                formInscription.addEventListener('submit', async function (event) {
                    event.preventDefault();
                    const donnees = {
                        username: racine.querySelector('#reg-username').value,
                        email: racine.querySelector('#reg-email').value,
                        password: racine.querySelector('#reg-password').value
                    };
                    const confirmation = racine.querySelector('#reg-confirm').value;
                    if (donnees.password !== confirmation) {
                        afficherMessage('Les mots de passe ne correspondent pas.', 'danger');
                        return;
                    }
                    const bouton = formInscription.querySelector('button[type="submit"]');
                    bouton.disabled = true;
                    const resultat = await auth.register(donnees);
                    bouton.disabled = false;
                    if (!resultat.ok) {
                        afficherMessage(resultat.error, 'danger');
                        return;
                    }
                    const connexion = await auth.login(donnees.username, donnees.password);
                    if (connexion.ok) {
                        toast('Compte créé, bienvenue !');
                        majEntete([]);
                        naviguer(suivant ? '#/' + suivant : '#/profil');
                    } else {
                        afficherMessage('Compte créé. Vous pouvez maintenant vous connecter.', 'success');
                    }
                });
            }
        };
    }

    function vueProfil() {
        const user = auth.current();
        if (!user) {
            return {
                titre: 'Ma progression',
                html: '<div class="container py-4"><div class="alert alert-info mb-0">' +
                    'Connectez-vous pour consulter votre progression. <a href="#/connexion?next=profil" class="alert-link">Se connecter</a>' +
                '</div></div>'
            };
        }

        const stats = auth.statsFor(user.username);
        const badges = auth.badges(user.username);
        const tentatives = auth.attempts(user.username).slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

        return {
            titre: 'Ma progression',
            html: '<div class="container py-4">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">' +
                    '<h1 class="h3 mb-0">Ma progression</h1>' +
                    '<div class="d-flex gap-2">' +
                        '<a class="btn btn-outline-primary btn-sm" href="#/exercices"><i class="fas fa-gamepad me-1"></i>S\'entraîner</a>' +
                        (tentatives.length ? '<button class="btn btn-outline-danger btn-sm" id="effacer-historique"><i class="fas fa-rotate-left me-1"></i>Effacer mon historique</button>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="row g-3 mb-4">' +
                    carteStat('bg-primary', 'fa-pen-to-square', 'Tentatives', stats.tentatives) +
                    carteStat('bg-success', 'fa-percent', 'Moyenne', stats.tentatives ? stats.moyenne + ' %' : '—') +
                    carteStat('bg-warning', 'fa-trophy', 'Meilleur score', stats.tentatives ? stats.meilleur + ' %' : '—') +
                    carteStat('bg-info', 'fa-medal', 'Badges', badges.filter(function (b) { return b.obtenu; }).length + '/' + badges.length) +
                '</div>' +
                '<div class="content mb-4">' +
                    '<h2 class="h5 mb-3">Badges</h2>' +
                    '<div class="row g-3">' + badges.map(function (badge) {
                        return '<div class="col-6 col-lg-4">' +
                            '<div class="badge-card ' + (badge.obtenu ? 'obtenu' : '') + '">' +
                                '<i class="fas ' + esc(badge.icone) + ' fa-2x mb-2"></i>' +
                                '<div class="fw-semibold">' + esc(badge.titre) + '</div>' +
                                '<div class="small text-muted">' + esc(badge.description) + '</div>' +
                            '</div>' +
                        '</div>';
                    }).join('') + '</div>' +
                '</div>' +
                '<div class="content">' +
                    '<h2 class="h5 mb-3">Historique</h2>' +
                    (tentatives.length
                        ? '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr>' +
                            '<th>Exercice</th><th>Type</th><th>Score</th><th>Date</th>' +
                          '</tr></thead><tbody>' + tentatives.map(function (t) {
                            const pourcentage = t.total > 0 ? Math.round((t.score / t.total) * 100) : 0;
                            const couleur = pourcentage >= 80 ? 'success' : pourcentage >= 60 ? 'warning' : 'danger';
                            return '<tr>' +
                                '<td class="fw-semibold">' + esc(t.titre) + '</td>' +
                                '<td class="text-muted small">' + esc(t.type) + '</td>' +
                                '<td><span class="badge bg-' + couleur + '">' + t.score + '/' + t.total + '</span></td>' +
                                '<td class="text-muted small">' + new Date(t.date).toLocaleString('fr-FR') + '</td>' +
                            '</tr>';
                        }).join('') + '</tbody></table></div>'
                        : '<p class="text-muted mb-0">Aucune tentative enregistrée. Lancez un exercice pour démarrer votre suivi.</p>') +
                '</div>' +
            '</div>',
            after: function (racine) {
                const bouton = racine.querySelector('#effacer-historique');
                if (!bouton) return;
                bouton.addEventListener('click', function () {
                    if (!window.confirm('Effacer tout votre historique de scores ?')) return;
                    auth.clearProgress(user.username);
                    toast('Historique effacé.');
                    router();
                });
            }
        };
    }

    function carteStat(couleur, icone, titre, valeur) {
        return '<div class="col-6 col-lg-3">' +
            '<div class="stat-card h-100">' +
                '<div class="stat-icone ' + couleur + '"><i class="fas ' + icone + '"></i></div>' +
                '<div class="stat-valeur">' + valeur + '</div>' +
                '<div class="stat-label">' + esc(titre) + '</div>' +
            '</div>' +
        '</div>';
    }

    const SECTIONS_ADMIN = [
        { slug: 'dashboard', titre: 'Tableau de bord', icone: 'fa-tachometer-alt' },
        { slug: 'exercices', titre: 'Exercices', icone: 'fa-tasks' },
        { slug: 'ressources', titre: 'Ressources', icone: 'fa-file-pdf' },
        { slug: 'utilisateurs', titre: 'Utilisateurs', icone: 'fa-users' },
        { slug: 'statistiques', titre: 'Statistiques', icone: 'fa-chart-bar' },
        { slug: 'parametres', titre: 'Paramètres', icone: 'fa-cogs' }
    ];

    function vueAdmin(section) {
        const user = auth.current();
        if (!auth.isAdmin()) {
            return {
                titre: 'Administration',
                html: '<div class="container py-4"><div class="content">' +
                    '<h1 class="h4 mb-3"><i class="fas fa-lock me-2"></i>Accès réservé</h1>' +
                    '<p class="text-muted">Cet espace est réservé aux administrateurs.</p>' +
                    '<p class="small text-muted">Compte de démonstration : <code>admin</code> / <code>admin123</code></p>' +
                    '<a class="btn btn-primary" href="#/connexion?next=admin">Se connecter</a>' +
                    (user ? ' <a class="btn btn-outline-secondary" href="#/profil">Mon espace élève</a>' : '') +
                '</div></div>'
            };
        }

        const sectionActive = SECTIONS_ADMIN.some(function (s) { return s.slug === section; }) ? section : 'dashboard';
        const titreSection = (SECTIONS_ADMIN.find(function (s) { return s.slug === sectionActive; }) || SECTIONS_ADMIN[0]).titre;
        const menu = SECTIONS_ADMIN.map(function (s) {
            return '<li class="nav-item"><a class="nav-link ' + (s.slug === sectionActive ? 'active' : '') + '" href="#/admin/' + s.slug + '">' +
                '<i class="fas ' + esc(s.icone) + ' me-2"></i>' + esc(s.titre) + '</a></li>';
        }).join('');

        return {
            titre: 'Administration',
            html: '<div class="container py-4">' +
                '<div class="row">' +
                    '<aside class="col-lg-3 mb-4">' +
                        '<div class="admin-nav sticky-top" style="top: 90px;">' +
                            '<h2 class="h6 mb-3"><i class="fas fa-user-cog me-2"></i>Panel Admin</h2>' +
                            '<ul class="nav flex-column">' + menu + '</ul>' +
                            '<hr class="border-light opacity-25">' +
                            '<a class="nav-link" href="#/"><i class="fas fa-arrow-left me-2"></i>Retour au site</a>' +
                        '</div>' +
                    '</aside>' +
                    '<div class="col-lg-9">' +
                        '<h1 class="visually-hidden">Administration — ' + esc(titreSection) + '</h1>' +
                        '<div id="zone-admin"></div>' +
                    '</div>' +
                '</div>' +
            '</div>',
            after: function (racine) {
                window.LearnHubAdmin.render(racine.querySelector('#zone-admin'), sectionActive);
            }
        };
    }

    function vueIntrouvable(detail) {
        return {
            titre: 'Page introuvable',
            html: '<div class="container py-5"><div class="content text-center">' +
                '<i class="fas fa-compass fa-3x text-primary mb-3"></i>' +
                '<h1 class="h3">Page introuvable</h1>' +
                '<p class="text-muted">' + esc(detail || 'Cette adresse ne correspond à aucune page du site.') + '</p>' +
                '<a class="btn btn-primary" href="#/">Retour à l\'accueil</a>' +
            '</div></div>'
        };
    }

    /* ---------------------------------- Routage ---------------------------------- */

    let vueCourante = null;

    function choisirVue(segments, parametres) {
        if (!segments.length) return vueAccueil();
        const premier = segments[0];
        switch (premier) {
            case 'matieres': return vueMatieres();
            case 'matiere': return vueMatiere(segments[1]);
            case 'niveaux': return vueNiveaux();
            case 'niveau': return vueNiveau(segments[1]);
            case 'chapitre': return vueChapitre(segments[1]);
            case 'cours': return vueCours(segments[1], segments[2]);
            case 'exercices': return vueExercices();
            case 'recherche': return vueRecherche(parametres);
            case 'connexion': return vueConnexion(parametres);
            case 'profil': return vueProfil();
            case 'admin': return vueAdmin(segments[1]);
            default: return vueIntrouvable();
        }
    }

    function allerSection(id) {
        const cible = document.getElementById('section-' + id);
        if (!cible) return false;
        window.scrollTo(0, cible.getBoundingClientRect().top + window.scrollY - 80);
        return true;
    }

    function router() {
        const { segments, params } = parseRoute();        window.LearnHubGames.destroy();
        const vue = choisirVue(segments, params);
        vueCourante = vue;

        app.innerHTML = vue.html;
        document.title = vue.titre + ' — LearnHub';
        majEntete(segments);

        if (typeof vue.after === 'function') {
            vue.after(app);
        }

        if (vue.section && allerSection(vue.section)) {
            if (document.readyState !== 'complete') {
                window.addEventListener('load', function () {
                    allerSection(vue.section);
                }, { once: true });
            }
            return;
        }
        window.scrollTo(0, 0);

        const collapse = document.getElementById('mainNav');
        if (collapse && collapse.classList.contains('show')) {
            collapse.classList.remove('show');
        }
    }

    /* ---------------------------------- Démarrage ---------------------------------- */

    function monterEnteteEtPied() {
        document.getElementById('nav-principal').innerHTML = htmlEntete();
        document.getElementById('pied-principal').innerHTML = htmlPied();

        const champ = document.getElementById('champ-recherche');
        document.getElementById('form-recherche').addEventListener('submit', function (event) {
            event.preventDefault();
            naviguer('#/recherche?q=' + encodeURIComponent(champ.value.trim()));
            champ.value = '';
        });

        champ.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                naviguer('#/recherche?q=' + encodeURIComponent(champ.value.trim()));
                champ.value = '';
            }
        });
    }

    function demarrer() {
        store.seedIfNeeded();
        monterEnteteEtPied();
        majEntete([]);

        window.addEventListener('hashchange', router);
        if (!location.hash) {
            history.replaceState(null, '', location.pathname + location.search + '#/');
        }
        router();
    }

    auth.init().then(demarrer).catch(function (erreur) {
        console.error(erreur);
        app.innerHTML = '<div class="container py-5"><div class="alert alert-danger">' +
            'Impossible d\'initialiser l\'application : ' + esc(erreur.message) + '</div></div>';
    });
})();
