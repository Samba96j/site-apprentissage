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

    /* Identité de l'assistant IA : un seul endroit à modifier pour renommer. */
    const NOM_IA = 'IAFA FAMA';
    const DESCRIPTION_IA = 'Assistant pédagogique IA : étudiez une œuvre ou posez une question, LearnHub met le résultat en forme.';
    const BADGE_IA = '<span class="badge bg-light text-dark ms-1 align-middle" title="Intelligence artificielle">IA</span>';

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
                        '<li class="nav-item dropdown">' +
                            '<a class="nav-link dropdown-toggle" href="#/lecons" role="button" data-bs-toggle="dropdown" data-nav="apprendre">Apprendre</a>' +
                            '<ul class="dropdown-menu">' +
                                '<li><a class="dropdown-item" href="#/lecons"><i class="fas fa-book-open me-2"></i>Leçons</a></li>' +
                                '<li><a class="dropdown-item" href="#/bibliotheque"><i class="fas fa-book me-2"></i>Bibliothèque</a></li>' +
                                '<li><a class="dropdown-item" href="#/exercices"><i class="fas fa-gamepad me-2"></i>Exercices</a></li>' +
                                '<li><a class="dropdown-item" href="#/seances"><i class="fas fa-calendar-days me-2"></i>Séances</a></li>' +
                            '</ul>' +
                        '</li>' +
                        '<li class="nav-item"><a class="nav-link text-nowrap" href="#/ia" data-nav="ia"><i class="fas fa-wand-magic-sparkles me-1"></i>' + NOM_IA + BADGE_IA + '</a></li>' +
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

    const TEXTE_PARTAGE = '📚 LearnHub : cours, exercices interactifs et bibliothèque gratuits — avec IAFA FAMA ✨, ' +
        'l\'assistant IA qui prépare une fiche complète sur n\'importe quelle œuvre en quelques secondes. Sans publicité.';
    const SUJET_PARTAGE = 'IAFA FAMA t\'attend sur LearnHub ✨';
    const CORPS_PARTAGE = [
        'Salut,',
        '',
        'Je te partage LearnHub : cours, exercices interactifs et bibliothèque numérique du collège au supérieur, gratuit et sans publicité.',
        '',
        'La nouveauté : IAFA FAMA ✨, un assistant IA qui prépare une fiche complète sur n\'importe quelle œuvre — résumé, contexte, personnages, thèmes, procédés, citations et questions d\'entraînement — en quelques secondes.',
        '',
        'À découvrir ici :'
    ].join('\n');

    /** URL à partager : la page canonique, plus la route courante (partage d'un chapitre, d'une matière…). */
    function urlPartage() {
        const canonique = document.querySelector('link[rel="canonical"]');
        const base = (canonique && canonique.href) || (location.origin + location.pathname);
        const hash = location.hash && location.hash !== '#/' ? location.hash : '';
        return base + hash;
    }

    function blocPartage() {
        const reseaux = [
            ['whatsapp', 'fa-whatsapp', 'Partager sur WhatsApp'],
            ['facebook', 'fa-facebook-f', 'Partager sur Facebook'],
            ['linkedin', 'fa-linkedin-in', 'Partager sur LinkedIn'],
            ['x', 'fa-twitter', 'Partager sur X'],
            ['telegram', 'fa-telegram', 'Partager sur Telegram'],
            ['email', 'fa-envelope', 'Partager par e-mail']
        ];
        return '<div class="partage-pied" id="partage-pied">' +
            '<span class="partage-titre"><i class="fas fa-share-nodes me-2"></i>Faire découvrir LearnHub</span>' +
            '<div class="partage-liens">' +
                reseaux.map(function (reseau) {
                    return '<a class="partage-lien" data-partage="' + reseau[0] + '" href="#/" target="_blank" rel="noopener"' +
                        ' title="' + reseau[2] + '" aria-label="' + reseau[2] + '"><i class="fab ' + reseau[1] + '"></i></a>';
                }).join('') +
                '<button class="partage-lien" type="button" data-partage="copier" title="Copier le lien du site" aria-label="Copier le lien du site">' +
                    '<i class="fas fa-link"></i></button>' +
                (navigator.share
                    ? '<button class="partage-lien" type="button" data-partage="natif" title="Partager avec une autre application" aria-label="Partager avec une autre application">' +
                        '<i class="fas fa-share-nodes"></i></button>'
                    : '') +
            '</div>' +
        '</div>';
    }

    function liensPartage() {
        const url = urlPartage();
        return {
            whatsapp: 'https://wa.me/?text=' + encodeURIComponent(TEXTE_PARTAGE + ' ' + url),
            facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
            linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url),
            x: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(TEXTE_PARTAGE) + '&url=' + encodeURIComponent(url),
            telegram: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(TEXTE_PARTAGE),
            email: 'mailto:?subject=' + encodeURIComponent(SUJET_PARTAGE) +
                '&body=' + encodeURIComponent(CORPS_PARTAGE + '\n' + url)
        };
    }

    function actualiserPartage() {
        const liens = liensPartage();
        document.querySelectorAll('#partage-pied [data-partage]').forEach(function (element) {
            if (liens[element.dataset.partage]) element.setAttribute('href', liens[element.dataset.partage]);
        });
    }

    function copierLien(url) {
        const reussi = function () { toast('Lien copié : collez-le dans WhatsApp, Facebook, LinkedIn…'); };
        const echoue = function () { toast('Copie impossible. Le lien est : ' + url, 'warning'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(reussi).catch(function () { copieDeSecours(url, reussi, echoue); });
            return;
        }
        copieDeSecours(url, reussi, echoue);
    }

    function copieDeSecours(url, reussi, echoue) {
        const champ = document.createElement('textarea');
        champ.value = url;
        champ.setAttribute('readonly', 'readonly');
        champ.style.position = 'fixed';
        champ.style.opacity = '0';
        document.body.appendChild(champ);
        champ.select();
        let copie = false;
        try { copie = document.execCommand('copy'); } catch (erreur) { copie = false; }
        document.body.removeChild(champ);
        if (copie) reussi(); else echoue();
    }

    function brancherPartage() {
        const zone = document.getElementById('partage-pied');
        if (!zone || zone.dataset.branche === '1') return;
        zone.dataset.branche = '1';
        zone.addEventListener('click', function (event) {
            const bouton = event.target.closest('[data-partage]');
            if (!bouton || bouton.tagName === 'A') return;
            if (bouton.dataset.partage === 'copier') {
                copierLien(urlPartage());
                return;
            }
            if (bouton.dataset.partage === 'natif' && navigator.share) {
                navigator.share({ title: 'LearnHub — cours, exercices et IAFA FAMA', text: TEXTE_PARTAGE, url: urlPartage() }).catch(function () {});
            }
        });
    }

    function htmlPied() {
        const backendActif = !!(window.LearnHubBackend && window.LearnHubBackend.disponible());
        return '<footer class="mt-5">' +
            '<div class="container">' +
                '<div class="row">' +
                    '<div class="col-lg-4 mb-4">' +
                        '<h5 class="d-flex align-items-center"><i class="fas fa-graduation-cap me-2"></i>LearnHub</h5>' +
                        '<p class="mb-2">Plateforme éducative pour tous les niveaux et tous les domaines de connaissance.</p>' +
                        '<p class="small text-white-50 mb-0">' +
                            (backendActif
                                ? 'Comptes et progression synchronisés avec Supabase.'
                                : 'Site statique : les comptes et la progression sont enregistrés dans votre navigateur.') +
                        '</p>' +
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
                            '<li><a href="#/lecons">Leçons</a></li>' +
                            '<li><a href="#/bibliotheque">Bibliothèque</a></li>' +
                            '<li><a href="#/exercices">Exercices</a></li>' +
                            '<li><a href="#/ia">' + NOM_IA + ' (IA)</a></li>' +
                            '<li><a href="#/seances">Mes séances</a></li>' +
                            '<li><a href="#/recherche">Recherche</a></li>' +
                            '<li><a href="#/profil">Ma progression</a></li>' +
                            '<li><a href="#/contact">Contact</a></li>' +
                        '</ul>' +
                    '</div>' +
                    '<div class="col-6 col-lg-2 mb-4">' +
                        '<h6>Espace admin</h6>' +
                        '<ul class="list-unstyled">' +
                            '<li><a href="#/admin">Tableau de bord</a></li>' +
                            '<li><a href="#/admin/classes">Classes</a></li>' +
                            '<li><a href="#/admin/lecons">Leçons</a></li>' +
                            '<li><a href="#/admin/seances">Séances</a></li>' +
                            '<li><a href="#/admin/exercices">Exercices</a></li>' +
                            '<li><a href="#/admin/ressources">Ressources</a></li>' +
                            '<li><a href="#/admin/bibliotheque">Bibliothèque</a></li>' +
                            '<li><a href="#/admin/statistiques">Statistiques</a></li>' +
                        '</ul>' +
                    '</div>' +
                '</div>' +
                '<hr class="border-light opacity-25">' +
                blocPartage() +
                '<div class="d-flex flex-wrap justify-content-between small text-white-50">' +
                    '<span>&copy; ' + new Date().getFullYear() + ' LearnHub.</span>' +
                    '<span>Développé par <a class="link-light text-decoration-none" href="#/contact">' +
                        esc((data.developpeur && data.developpeur.nom) || 'M.BA') + ' — ' +
                        esc((data.developpeur && data.developpeur.titre) || 'Ingénieur en génie logiciel') +
                    '</a></span>' +
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
                '<li><a class="dropdown-item" href="#/seances"><i class="fas fa-calendar-days me-2"></i>Mes séances</a></li>' +
                '<li><a class="dropdown-item" href="#/ia"><i class="fas fa-wand-magic-sparkles me-2"></i>' + NOM_IA + ' (IA)</a></li>' +
                (user.role === 'admin' ? '<li><a class="dropdown-item" href="#/admin"><i class="fas fa-user-cog me-2"></i>Administration</a></li>' : '') +
                (user.role === 'superadmin' ? '<li><a class="dropdown-item" href="#/superadmin"><i class="fas fa-shield-halved me-2"></i>Super-administration</a></li>' : '') +
                '<li><hr class="dropdown-divider"></li>' +
                '<li><button class="dropdown-item" type="button" id="bouton-deconnexion"><i class="fas fa-sign-out-alt me-2"></i>Se déconnecter</button></li>' +
            '</ul>' +
        '</div>';
    }

    const SECTIONS_APPRENDRE = ['lecons', 'lecon', 'bibliotheque', 'exercices', 'seances'];

    function majEntete(segments) {
        const zoneAuth = document.getElementById('zone-auth');
        if (zoneAuth) {
            zoneAuth.innerHTML = htmlZoneAuth();
            const deconnexion = document.getElementById('bouton-deconnexion');
            if (deconnexion) {
                deconnexion.addEventListener('click', async function () {
                    await auth.logout();
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
                (cle === 'apprendre' && SECTIONS_APPRENDRE.indexOf(section) >= 0);
            lien.classList.toggle('active', actif);
        });
    }

    /* ------------------------------------ Vues ------------------------------------ */

    function diapositive(slide, index) {
        const variante = esc(slide.variante || 'violet');
        const image = slide.image
            ? '<img class="diapo-image" src="' + esc(slide.image) + '" alt="" loading="' + (index === 0 ? 'eager' : 'lazy') + '">'
            : '';
        return '<div class="carousel-item' + (index === 0 ? ' active' : '') + '">' +
            '<div class="diapo diapo--' + variante + '">' +
                image +
                '<div class="diapo-voile"></div>' +
                '<i class="fas ' + esc(slide.embleme || slide.icone || 'fa-graduation-cap') + ' diapo-embleme" aria-hidden="true"></i>' +
                '<div class="container diapo-contenu">' +
                    '<div class="diapo-texte">' +
                        '<span class="diapo-icone"><i class="fas ' + esc(slide.icone || 'fa-graduation-cap') + '"></i></span>' +
                        '<h2 class="diapo-titre">' + esc(slide.titre) + '</h2>' +
                        '<p class="diapo-texte-desc">' + esc(slide.texte) + '</p>' +
                        (slide.cta
                            ? '<a class="btn btn-light btn-lg" href="' + esc(slide.cta.href) + '">' + esc(slide.cta.libelle) +
                              ' <i class="fas fa-arrow-right ms-1"></i></a>'
                            : '') +
                    '</div>' +
                '</div>' +
                (slide.credit ? '<span class="diapo-credit">' + esc(slide.credit) + '</span>' : '') +
            '</div>' +
        '</div>';
    }

    /**
     * Fait vivre le carrousel : moteur Bootstrap quand il est disponible,
     * moteur de secours sinon (CDN bloqué, réseau lent…). Le bouton pause
     * reste le même dans les deux cas.
     */
    let arreterCarrousel = null;

    function demarrerCarrousel(racine) {
        if (arreterCarrousel) {
            arreterCarrousel();
            arreterCarrousel = null;
        }
        const carrousel = racine.querySelector('#carrousel-learnhub');
        if (!carrousel) return;
        const items = Array.prototype.slice.call(carrousel.querySelectorAll('.carousel-item'));
        if (items.length < 2) return;

        const bouton = carrousel.querySelector('.diapo-pause');
        const indicateurs = Array.prototype.slice.call(carrousel.querySelectorAll('.carousel-indicators button'));
        const reduireAnimations = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        const intervalle = 6000;
        const moteurBootstrap = window.bootstrap && window.bootstrap.Carousel;
        let minuterie = null;
        let courant = items.findIndex(function (item) { return item.classList.contains('active'); });
        if (courant < 0) courant = 0;

        function etatPause(enPause) {
            if (!bouton) return;
            bouton.innerHTML = '<i class="fas fa-' + (enPause ? 'play' : 'pause') + '"></i>';
            bouton.setAttribute('aria-label', enPause ? 'Lancer le diaporama' : 'Mettre le diaporama en pause');
            bouton.setAttribute('title', enPause ? 'Lancer le diaporama' : 'Mettre le diaporama en pause');
        }

        /* --- Moteur Bootstrap : il gère les flèches, les indicateurs et le clavier --- */
        if (moteurBootstrap) {
            const instance = window.bootstrap.Carousel.getOrCreateInstance(carrousel, {
                interval: intervalle,
                ride: 'carousel',
                pause: false
            });
            let enPause = false;
            if (reduireAnimations) { instance.pause(); enPause = true; }
            etatPause(enPause);
            if (bouton) {
                bouton.addEventListener('click', function () {
                    enPause = !enPause;
                    if (enPause) instance.pause(); else instance.cycle();
                    etatPause(enPause);
                });
            }
            arreterCarrousel = function () { instance.dispose(); };
            return;
        }

        /* --- Moteur de secours (sans Bootstrap) --- */
        function afficher(index) {
            courant = (index + items.length) % items.length;
            items.forEach(function (item, i) { item.classList.toggle('active', i === courant); });
            indicateurs.forEach(function (indicateur, i) {
                indicateur.classList.toggle('active', i === courant);
                if (i === courant) indicateur.setAttribute('aria-current', 'true');
                else indicateur.removeAttribute('aria-current');
            });
        }

        function jouer() {
            if (minuterie) return;
            minuterie = setInterval(function () { afficher(courant + 1); }, intervalle);
            etatPause(false);
        }

        function arreter() {
            if (minuterie) { clearInterval(minuterie); minuterie = null; }
            etatPause(true);
        }

        indicateurs.forEach(function (indicateur, i) {
            indicateur.addEventListener('click', function () { afficher(i); });
        });
        const precedent = carrousel.querySelector('.carousel-control-prev');
        const suivant = carrousel.querySelector('.carousel-control-next');
        if (precedent) precedent.addEventListener('click', function () { afficher(courant - 1); });
        if (suivant) suivant.addEventListener('click', function () { afficher(courant + 1); });

        if (bouton) {
            bouton.addEventListener('click', function () {
                if (minuterie) arreter(); else jouer();
            });
        }

        arreterCarrousel = function () { if (minuterie) { clearInterval(minuterie); minuterie = null; } };
        if (reduireAnimations) arreter(); else jouer();
    }

    function vueAccueil() {
        const chapitres = data.getChapitres();
        const exercices = store.exercices.actifs();
        const diapositives = Array.isArray(data.diapositives) && data.diapositives.length
            ? data.diapositives
            : [];
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
                '<h1 class="visually-hidden">LearnHub — apprendre sans limites</h1>' +
                '<section class="carrousel-accueil" aria-label="Présentation de la plateforme">' +
                    '<div id="carrousel-learnhub" class="carousel slide" data-bs-interval="6000">' +
                        '<div class="carousel-indicators">' +
                            diapositives.map(function (slide, index) {
                                return '<button type="button" data-bs-target="#carrousel-learnhub" data-bs-slide-to="' + index + '"' +
                                    (index === 0 ? ' class="active" aria-current="true"' : '') +
                                    ' aria-label="Diapositive ' + (index + 1) + ' : ' + esc(slide.titre) + '"></button>';
                            }).join('') +
                        '</div>' +
                        '<div class="carousel-inner">' +
                            diapositives.map(diapositive).join('') +
                        '</div>' +
                        '<button class="carousel-control-prev" type="button" data-bs-target="#carrousel-learnhub" data-bs-slide="prev">' +
                            '<span class="carousel-control-prev-icon" aria-hidden="true"></span>' +
                            '<span class="visually-hidden">Diapositive précédente</span>' +
                        '</button>' +
                        '<button class="carousel-control-next" type="button" data-bs-target="#carrousel-learnhub" data-bs-slide="next">' +
                            '<span class="carousel-control-next-icon" aria-hidden="true"></span>' +
                            '<span class="visually-hidden">Diapositive suivante</span>' +
                        '</button>' +
                        '<button class="diapo-pause" type="button" aria-label="Mettre le diaporama en pause">' +
                            '<i class="fas fa-pause" aria-hidden="true"></i>' +
                        '</button>' +
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
                '</section>',
            after: function (racine) {
                demarrerCarrousel(racine);
            }
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
                            '<a class="btn btn-outline-primary btn-sm w-100 mb-2" href="#/ia"><i class="fas fa-wand-magic-sparkles me-1"></i>Demander à ' + NOM_IA + '</a>' +
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

    function texteVersHtml(texte) {
        const blocs = String(texte || '').replace(/\r/g, '').split(/\n{2,}/);
        return blocs.map(function (bloc) {
            const lignes = bloc.split('\n').filter(function (ligne) { return ligne.trim(); });
            if (!lignes.length) return '';
            const estListe = lignes.every(function (ligne) { return /^\s*[-*]\s+/.test(ligne); });
            if (estListe) {
                return '<ul>' + lignes.map(function (ligne) {
                    return '<li>' + esc(ligne.replace(/^\s*[-*]\s+/, '')) + '</li>';
                }).join('') + '</ul>';
            }
            return '<p>' + lignes.map(esc).join('<br>') + '</p>';
        }).join('');
    }

    function vueLecons() {
        const user = auth.current();
        const lecons = store.lecons.all().slice().sort(function (a, b) {
            return String(a.titre).localeCompare(String(b.titre));
        });

        const cartes = lecons.map(function (lecon) {
            const matiere = data.getMatiere(lecon.matiere);
            const niveau = lecon.niveau ? data.getNiveau(lecon.niveau) : null;
            return '<div class="col-md-6 col-xl-4">' +
                '<div class="content h-100 d-flex flex-column">' +
                    '<div class="d-flex justify-content-between align-items-start gap-2 mb-2">' +
                        '<h2 class="h5 mb-0">' + esc(lecon.titre) + '</h2>' +
                        (matiere ? '<span class="badge bg-primary bg-opacity-10 text-primary">' + esc(matiere.nom) + '</span>' : '') +
                    '</div>' +
                    '<p class="text-muted small mb-2">' +
                        '<i class="fas fa-clock me-1"></i>' + (lecon.duree || 30) + ' min' +
                        (niveau ? ' · ' + esc(niveau.nom) : ' · Tous niveaux') +
                    '</p>' +
                    (lecon.resume ? '<p class="mb-3">' + esc(lecon.resume) + '</p>' : '') +
                    '<a class="btn btn-outline-primary btn-sm mt-auto align-self-start" href="#/lecon/' + encodeURIComponent(lecon.id) + '">' +
                        '<i class="fas fa-book-open me-1"></i>Lire la leçon</a>' +
                '</div>' +
            '</div>';
        }).join('');

        return {
            titre: 'Leçons',
            html: '<div class="container py-4">' +
                '<div class="mb-4">' +
                    '<h1 class="h3 mb-1">Leçons</h1>' +
                    '<p class="text-muted mb-0">Les leçons rédigées par votre enseignant et assignées à vos séances.</p>' +
                '</div>' +
                (lecons.length
                    ? '<div class="row g-3">' + cartes + '</div>'
                    : '<div class="content text-muted">' +
                        '<i class="fas fa-book-open me-2"></i>Aucune leçon disponible pour le moment.' +
                        '<div class="small mt-2">' +
                            (user && !auth.maClasse()
                                ? 'Rejoignez une classe depuis <a href="#/profil">Ma progression</a> pour accéder aux leçons de votre enseignant.'
                                : 'Votre enseignant peut en créer depuis l\'onglet « Leçons » de son espace.') +
                        '</div>' +
                      '</div>') +
            '</div>'
        };
    }

    function vueLecon(id) {
        const lecon = store.lecons.get(id);
        if (!lecon) return vueIntrouvable('Cette leçon n\'existe pas ou n\'est pas accessible depuis votre espace.');
        const matiere = data.getMatiere(lecon.matiere);
        const niveau = lecon.niveau ? data.getNiveau(lecon.niveau) : null;

        return {
            titre: lecon.titre,
            html: '<div class="container py-4">' +
                '<nav aria-label="Fil d\'Ariane" class="mb-3">' +
                    '<ol class="breadcrumb mb-0">' +
                        '<li class="breadcrumb-item"><a href="#/">Accueil</a></li>' +
                        '<li class="breadcrumb-item"><a href="#/lecons">Leçons</a></li>' +
                        '<li class="breadcrumb-item active" aria-current="page">' + esc(lecon.titre) + '</li>' +
                    '</ol>' +
                '</nav>' +
                '<article class="content">' +
                    '<h1 class="h3 mb-2">' + esc(lecon.titre) + '</h1>' +
                    '<p class="text-muted small mb-3">' +
                        (matiere ? '<span class="badge bg-primary bg-opacity-10 text-primary me-2">' + esc(matiere.nom) + '</span>' : '') +
                        (niveau ? esc(niveau.nom) : 'Tous niveaux') + ' · ' + (lecon.duree || 30) + ' min' +
                    '</p>' +
                    (lecon.resume ? '<p class="lead">' + esc(lecon.resume) + '</p>' : '') +
                    ((lecon.objectifs || []).length
                        ? '<div class="alert alert-info py-2"><strong class="d-block mb-1">Objectifs</strong>' +
                            '<ul class="mb-0">' + lecon.objectifs.map(function (objectif) {
                                return '<li>' + esc(objectif) + '</li>';
                            }).join('') + '</ul></div>'
                        : '') +
                    '<div class="lecon-contenu">' +
                        (lecon.contenuHtml ? store.nettoyerHtml(lecon.contenuHtml) : texteVersHtml(lecon.contenu)) +
                    '</div>' +
                    '<hr>' +
                    '<div class="d-flex flex-wrap gap-2">' +
                        '<a class="btn btn-outline-secondary btn-sm" href="#/lecons"><i class="fas fa-arrow-left me-1"></i>Toutes les leçons</a>' +
                        '<a class="btn btn-outline-primary btn-sm" href="#/exercices"><i class="fas fa-gamepad me-1"></i>S\'entraîner</a>' +
                        '<a class="btn btn-outline-primary btn-sm" href="#/seances"><i class="fas fa-calendar-days me-1"></i>Mes séances</a>' +
                    '</div>' +
                '</article>' +
            '</div>'
        };
    }

    /* -------------------------------- Bibliothèque -------------------------------- */

    const LIBELLES_DOC = { pdf: 'PDF', word: 'Word / Texte', texte: 'Texte', autre: 'Document' };
    const ICONES_DOC = { pdf: 'fa-file-pdf', word: 'fa-file-word', texte: 'fa-file-lines', autre: 'fa-file' };

    function vueBibliotheque(parametres) {
        return {
            titre: 'Bibliothèque',
            html: '<div class="container py-4">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">' +
                    '<div>' +
                        '<h1 class="h3 mb-1"><i class="fas fa-book-open me-2"></i>Bibliothèque</h1>' +
                        '<p class="text-muted mb-0">Livres, cours et documents libres pour approfondir toutes les matières.</p>' +
                    '</div>' +
                '</div>' +
                '<div class="input-group mb-3" style="max-width:520px">' +
                    '<span class="input-group-text"><i class="fas fa-search"></i></span>' +
                    '<input class="form-control" id="biblio-recherche" type="search" placeholder="Rechercher un titre, un auteur, une matière…" autocomplete="off">' +
                '</div>' +
                '<div class="d-flex flex-wrap gap-2 mb-4">' +
                    '<select class="form-select form-select-sm" id="biblio-matiere" style="max-width:200px">' +
                        '<option value="">Toutes les matières</option>' +
                    '</select>' +
                    '<select class="form-select form-select-sm" id="biblio-niveau" style="max-width:180px">' +
                        '<option value="">Tous les niveaux</option>' +
                        data.niveaux.map(function (n) { return '<option value="' + esc(n.slug) + '">' + esc(n.nom) + '</option>'; }).join('') +
                    '</select>' +
                    '<select class="form-select form-select-sm" id="biblio-type" style="max-width:170px">' +
                        '<option value="">Tous les formats</option>' +
                        Object.keys(LIBELLES_DOC).map(function (t) { return '<option value="' + t + '">' + LIBELLES_DOC[t] + '</option>'; }).join('') +
                    '</select>' +
                    '<span class="text-muted small align-self-center" id="biblio-compteur"></span>' +
                '</div>' +
                '<div id="biblio-liste"><div class="text-center py-5 text-muted"><i class="fas fa-circle-notch fa-spin me-2"></i>Chargement de la bibliothèque…</div></div>' +
            '</div>',
            after: function (racine) {
                const liste = racine.querySelector('#biblio-liste');
                const compteur = racine.querySelector('#biblio-compteur');
                const recherche = racine.querySelector('#biblio-recherche');
                const filtreMatiere = racine.querySelector('#biblio-matiere');
                const filtreNiveau = racine.querySelector('#biblio-niveau');
                const filtreType = racine.querySelector('#biblio-type');
                let documents = [];

                function nomMatiere(slug) {
                    const m = data.getMatiere(slug);
                    if (m) return m.nom;
                    if (!slug) return 'Général';
                    // Matière libre saisie lors d'un import : on l'affiche lisiblement.
                    const texte = String(slug).replace(/[-_]+/g, ' ');
                    return texte.charAt(0).toUpperCase() + texte.slice(1);
                }
                function nomNiveau(slug) {
                    const n = data.niveaux.find(function (x) { return x.slug === slug; });
                    if (n) return n.nom;
                    return slug ? String(slug) : '';
                }

                function remplirFiltreMatieres() {
                    const valeurs = {};
                    documents.forEach(function (d) {
                        if (d.matiere) valeurs[d.matiere] = true;
                    });
                    const courante = filtreMatiere.value;
                    filtreMatiere.innerHTML = '<option value="">Toutes les matières</option>' +
                        Object.keys(valeurs).sort(function (a, b) {
                            return nomMatiere(a).localeCompare(nomMatiere(b), 'fr');
                        }).map(function (valeur) {
                            return '<option value="' + esc(valeur) + '">' + esc(nomMatiere(valeur)) + '</option>';
                        }).join('');
                    filtreMatiere.value = courante;
                }

                function carte(document) {
                    const type = LIBELLES_DOC[document.type] ? document.type : 'autre';
                    const badges = [];
                    if (document.matiere) badges.push('<span class="badge text-bg-primary">' + esc(nomMatiere(document.matiere)) + '</span>');
                    if (document.niveau) badges.push('<span class="badge text-bg-secondary">' + esc(nomNiveau(document.niveau)) + '</span>');
                    const visibilite = document.visibilite || 'public';
                    if (visibilite !== 'public') {
                        badges.push('<span class="badge text-bg-warning"><i class="fas fa-lock me-1"></i>' +
                            (visibilite === 'enseignants' ? 'Enseignants' : 'Élèves') + '</span>');
                    }
                    return '<div class="col">' +
                        '<div class="card h-100 border-0 shadow-sm">' +
                            '<div class="card-body d-flex flex-column">' +
                                '<div class="d-flex align-items-start gap-2 mb-2">' +
                                    '<i class="fas ' + ICONES_DOC[type] + ' fa-2x text-primary"></i>' +
                                    '<div class="flex-grow-1">' +
                                        '<h2 class="h6 mb-1">' + esc(document.titre) + '</h2>' +
                                        (document.auteur ? '<div class="small text-muted">' + esc(document.auteur) + '</div>' : '') +
                                    '</div>' +
                                '</div>' +
                                (document.description ? '<p class="small text-muted mb-2">' + esc(document.description) + '</p>' : '') +
                                '<div class="d-flex flex-wrap gap-1 mb-2">' + badges.join('') +
                                    '<span class="badge text-bg-light border">' + esc(LIBELLES_DOC[type]) + '</span>' +
                                    (document.taille ? '<span class="badge text-bg-light border">' + esc(document.taille) + '</span>' : '') +
                                '</div>' +
                                '<div class="d-flex gap-2 mt-auto">' +
                                    '<a class="btn btn-sm btn-primary" href="' + esc(document.url) + '" target="_blank" rel="noopener"><i class="fas fa-eye me-1"></i>Ouvrir</a>' +
                                    '<a class="btn btn-sm btn-outline-secondary" href="' + esc(document.url) + '" target="_blank" rel="noopener" download="' + esc(document.titre) + '"><i class="fas fa-download me-1"></i>Télécharger</a>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }

                function rafraichir() {
                    const texte = recherche.value.trim().toLowerCase();
                    const matiere = filtreMatiere.value;
                    const niveau = filtreNiveau.value;
                    const type = filtreType.value;
                    const resultats = documents.filter(function (d) {
                        if (matiere && d.matiere !== matiere) return false;
                        if (niveau && d.niveau !== niveau) return false;
                        if (type && (d.type || 'autre') !== type) return false;
                        if (texte) {
                            const hay = ((d.titre || '') + ' ' + (d.auteur || '') + ' ' + (d.description || '') + ' ' + nomMatiere(d.matiere)).toLowerCase();
                            if (hay.indexOf(texte) === -1) return false;
                        }
                        return true;
                    });
                    compteur.textContent = resultats.length + ' document(s)';
                    if (!documents.length) {
                        const connecte = !!(window.LearnHubAuth && window.LearnHubAuth.current());
                        liste.innerHTML = connecte
                            ? '<div class="content text-center py-5">' +
                                '<i class="fas fa-book-open fa-3x text-primary mb-3"></i>' +
                                '<h2 class="h5">La bibliothèque est encore vide</h2>' +
                                '<p class="text-muted">Revenez bientôt : des documents seront ajoutés.</p>' +
                              '</div>'
                            : '<div class="content text-center py-5">' +
                                '<i class="fas fa-lock fa-3x text-primary mb-3"></i>' +
                                '<h2 class="h5">Bibliothèque réservée aux élèves</h2>' +
                                '<p class="text-muted">Les documents sont accessibles une fois connecté avec votre compte LearnHub.</p>' +
                                '<a class="btn btn-primary" href="#/connexion?next=bibliotheque">Se connecter</a>' +
                              '</div>';
                        return;
                    }
                    if (!resultats.length) {
                        liste.innerHTML = '<div class="content text-center py-5 text-muted">Aucun document ne correspond à votre recherche.</div>';
                        return;
                    }
                    const connecte = !!(window.LearnHubAuth && window.LearnHubAuth.current());
                    const note = !connecte
                        ? '<div class="alert alert-info mt-4 mb-0"><i class="fas fa-lock me-1"></i>' +
                            'Certains documents sont réservés aux élèves connectés. ' +
                            '<a class="alert-link" href="#/connexion?next=bibliotheque">Se connecter</a>' +
                          '</div>'
                        : '';
                    liste.innerHTML = '<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">' +
                        resultats.map(carte).join('') + '</div>' + note;
                }

                const b = window.LearnHubBackend;
                if (!b || !b.disponible()) {
                    liste.innerHTML = '<div class="content text-center py-5 text-muted">La bibliothèque nécessite le backend Supabase (configuration absente).</div>';
                    return;
                }
                b.listerDocuments().then(function (resultat) {
                    if (!resultat.ok) {
                        liste.innerHTML = '<div class="alert alert-danger">' + esc(resultat.error) + '</div>';
                        return;
                    }
                    documents = resultat.documents;
                    remplirFiltreMatieres();
                    rafraichir();
                }).catch(function () {
                    liste.innerHTML = '<div class="alert alert-danger">Impossible de charger la bibliothèque.</div>';
                });

                [recherche, filtreMatiere, filtreNiveau, filtreType].forEach(function (element) {
                    element.addEventListener('input', rafraichir);
                    element.addEventListener('change', rafraichir);
                });
            }
        };
    }

    function vueContact() {
        const developpeur = data.developpeur || {};
        const endpoint = String(developpeur.formulaire || '').trim();
        const serviceActif = /^https:\/\/.+/i.test(endpoint);

        return {
            titre: 'Contact',
            html: '<div class="container py-4">' +
                '<div class="row g-4">' +
                    '<div class="col-lg-5">' +
                        '<div class="content h-100">' +
                            '<div class="text-center mb-3">' +
                                '<i class="fas fa-code fa-2x text-primary mb-2"></i>' +
                                '<h1 class="h4 mb-1">' + esc(developpeur.nom || 'Développeur') + '</h1>' +
                                '<p class="text-muted mb-0">' + esc(developpeur.titre || '') + '</p>' +
                            '</div>' +
                            '<p class="mb-2">' + esc(developpeur.role || '') + '</p>' +
                            '<p class="text-muted small mb-2"><i class="fas fa-shield-halved me-2"></i>Aucune adresse e-mail n\'est publiée sur le site.</p>' +
                            '<hr>' +
                            (serviceActif
                                ? '<p class="text-muted small mb-0"><i class="fas fa-circle-info me-1"></i>Votre message est transmis via un service de formulaire sécurisé. Une copie reste consultable dans la super-administration.</p>'
                                : '<p class="text-muted small mb-0"><i class="fas fa-circle-info me-1"></i>Le service d\'envoi n\'est pas encore configuré : les messages sont enregistrés localement et visibles dans la super-administration.</p>') +
                        '</div>' +
                    '</div>' +
                    '<div class="col-lg-7">' +
                        '<div class="content">' +
                            '<h2 class="h5 mb-3"><i class="fas fa-paper-plane me-2"></i>M\'écrire</h2>' +
                            '<div id="contact-message" class="d-none"></div>' +
                            '<form id="form-contact">' +
                                '<div class="row g-3">' +
                                    '<div class="col-md-6"><label class="form-label" for="contact-nom">Votre nom</label>' +
                                        '<input class="form-control" id="contact-nom" required minlength="2" autocomplete="name"></div>' +
                                    '<div class="col-md-6"><label class="form-label" for="contact-email">Votre e-mail</label>' +
                                        '<input class="form-control" type="email" id="contact-email" required autocomplete="email"></div>' +
                                '</div>' +
                                '<div class="mt-3"><label class="form-label" for="contact-sujet">Sujet</label>' +
                                    '<input class="form-control" id="contact-sujet" required minlength="3"></div>' +
                                '<div class="mt-3"><label class="form-label" for="contact-message-texte">Message</label>' +
                                    '<textarea class="form-control" id="contact-message-texte" rows="7" required minlength="10"></textarea></div>' +
                                '<button class="btn btn-primary mt-3" type="submit"><i class="fas fa-paper-plane me-1"></i>Envoyer le message</button>' +
                            '</form>' +
                            '<div id="contact-actions" class="mt-3"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>',
            after: function (racine) {
                const zone = racine.querySelector('#contact-message');
                const actions = racine.querySelector('#contact-actions');
                const form = racine.querySelector('#form-contact');

                function afficher(texte, type) {
                    zone.className = 'alert alert-' + type + ' py-2';
                    zone.textContent = texte;
                }

                form.addEventListener('submit', function (event) {
                    event.preventDefault();
                    const donnees = {
                        nom: racine.querySelector('#contact-nom').value.trim(),
                        email: racine.querySelector('#contact-email').value.trim(),
                        sujet: racine.querySelector('#contact-sujet').value.trim(),
                        message: racine.querySelector('#contact-message-texte').value.trim()
                    };
                    if (donnees.nom.length < 2) {
                        afficher('Indiquez votre nom.', 'danger');
                        return;
                    }
                    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(donnees.email)) {
                        afficher('Adresse e-mail invalide.', 'danger');
                        return;
                    }
                    if (donnees.sujet.length < 3) {
                        afficher('Précisez un sujet.', 'danger');
                        return;
                    }
                    if (donnees.message.length < 10) {
                        afficher('Votre message est trop court (10 caractères minimum).', 'danger');
                        return;
                    }
                    const enregistre = store.messages.add(donnees);
                    if (!enregistre) {
                        afficher('Enregistrement impossible (stockage du navigateur indisponible).', 'danger');
                        return;
                    }

                    if (serviceActif) {
                        const bouton = form.querySelector('button[type="submit"]');
                        bouton.disabled = true;
                        const corps = new FormData();
                        corps.append('nom', donnees.nom);
                        corps.append('email', donnees.email);
                        corps.append('sujet', donnees.sujet);
                        corps.append('message', donnees.message);
                        corps.append('_subject', '[LearnHub] ' + donnees.sujet);
                        fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Accept': 'application/json' },
                            body: corps
                        }).then(function (reponse) {
                            if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
                            form.reset();
                            afficher('Merci ' + donnees.nom + ', votre message a été transmis.', 'success');
                            actions.innerHTML = '<p class="small text-muted mb-0">Une réponse vous sera adressée à ' + esc(donnees.email) + '.</p>';
                        }).catch(function () {
                            afficher('Votre message a été enregistré, mais l\'envoi distant a échoué. Réessayez dans un instant.', 'warning');
                        }).then(function () {
                            bouton.disabled = false;
                        });
                        return;
                    }

                    form.reset();
                    afficher('Merci ' + donnees.nom + ', votre message a été enregistré.', 'success');
                    actions.innerHTML = '<p class="small text-muted mb-0">Le service d\'envoi n\'est pas encore configuré : le message reste consultable dans la super-administration de ce navigateur.</p>';
                });
            }
        };
    }

    function vueExercices(parametres) {
        const user = auth.current();
        const exoCible = parametres ? parametres.get('exo') : null;
        const tous = store.exercices.actifs();
        const actifs = exoCible
            ? tous.filter(function (ex) { return ex.id === exoCible; })
            : tous;
        const pastilles = exoCible ? '' : ['<button class="btn btn-sm btn-primary" data-matiere="" aria-pressed="true"><i class="fas fa-layer-group me-1"></i>Toutes <span class="badge bg-light text-dark ms-1">' + actifs.length + '</span></button>']
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
                (exoCible
                    ? '<div class="alert alert-info py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">' +
                        '<span><i class="fas fa-calendar-check me-1"></i>Exercice assigné dans une séance.</span>' +
                        '<a class="alert-link" href="#/exercices">Voir tous les exercices</a></div>'
                    : '') +
                '<div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filtrer les exercices par matière">' + pastilles + '</div>' +
                '<div class="content"><div id="zone-jeux"></div></div>' +
                '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>Les exercices affichés proviennent de la bibliothèque publique et de l\'espace de votre enseignant.</p>' +
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
        store.lecons.all().forEach(function (lecon) {
            const matiere = data.getMatiere(lecon.matiere);
            entrees.push({
                type: 'Leçon',
                titre: lecon.titre,
                texte: [lecon.titre, lecon.resume, matiere ? matiere.nom : '', (lecon.objectifs || []).join(' '), lecon.contenu].join(' '),
                url: '#/lecon/' + lecon.id
            });
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
        const backendActif = !!(window.LearnHubBackend && window.LearnHubBackend.disponible());

        function champ(id, libelle, icone, type, options) {
            const reglages = options || {};
            return '<div class="auth-field' + (reglages.pleineLargeur ? ' auth-field--full' : '') + '">' +
                '<label for="' + id + '">' + libelle + '</label>' +
                '<div class="auth-input">' +
                    '<i class="fas fa-' + icone + '"></i>' +
                    '<input id="' + id + '" type="' + (type || 'text') + '"' +
                        (reglages.autocomplete ? ' autocomplete="' + reglages.autocomplete + '"' : '') +
                        (reglages.requis === false ? '' : ' required') + '>' +
                    (reglages.motDePasse
                        ? '<button type="button" data-voir="' + id + '" aria-label="Afficher le mot de passe"><i class="fas fa-eye"></i></button>'
                        : '') +
                '</div>' +
                (reglages.aide ? '<span class="auth-hint">' + reglages.aide + '</span>' : '') +
            '</div>';
        }

        return {
            titre: 'Connexion',
            html: '<div class="container auth-page">' +
                '<div class="auth-card' + (mode === 'inscription' ? ' auth-card--large' : '') + '">' +
                    '<div class="auth-head">' +
                        '<span class="auth-logo"><i class="fas fa-graduation-cap"></i></span>' +
                        '<h1 class="auth-title">' + (mode === 'inscription' ? 'Créer un compte' : 'Bon retour !') + '</h1>' +
                        '<p class="auth-sub">' + (mode === 'inscription'
                            ? (backendActif ? 'Vos cours et votre progression vous suivent sur tous vos appareils.' : 'Vos scores seront conservés dans ce navigateur.')
                            : 'Accédez à votre progression et à votre espace personnel.') + '</p>' +
                    '</div>' +
                    '<div class="auth-switch" role="tablist">' +
                        '<button class="' + (mode === 'connexion' ? 'active' : '') + '" data-mode="connexion" type="button" role="tab">Connexion</button>' +
                        '<button class="' + (mode === 'inscription' ? 'active' : '') + '" data-mode="inscription" type="button" role="tab">Inscription</button>' +
                    '</div>' +
                    '<div id="auth-message" class="d-none"></div>' +
                    '<form id="form-connexion" class="' + (mode === 'inscription' ? 'd-none' : '') + '">' +
                        '<div class="auth-field">' +
                            '<label for="login-username">' + (backendActif ? 'E-mail' : 'Nom d\'utilisateur ou e-mail') + '</label>' +
                            '<div class="auth-input">' +
                                '<i class="fas fa-' + (backendActif ? 'envelope' : 'user') + '"></i>' +
                                '<input id="login-username" type="' + (backendActif ? 'email' : 'text') + '" autocomplete="username" required>' +
                            '</div>' +
                        '</div>' +
                        '<div class="auth-field">' +
                            '<label for="login-password">Mot de passe</label>' +
                            '<div class="auth-input">' +
                                '<i class="fas fa-lock"></i>' +
                                '<input id="login-password" type="password" autocomplete="current-password" required>' +
                                '<button type="button" data-voir="login-password" aria-label="Afficher le mot de passe"><i class="fas fa-eye"></i></button>' +
                            '</div>' +
                        '</div>' +
                        '<button class="btn btn-primary w-100" type="submit">Se connecter <i class="fas fa-arrow-right ms-1"></i></button>' +
                    '</form>' +
                    '<form id="form-inscription" class="' + (mode === 'connexion' ? 'd-none' : '') + '">' +
                        '<div class="auth-grid">' +
                            champ('reg-username', 'Nom d\'utilisateur', 'user', 'text', { autocomplete: 'username' }) +
                            champ('reg-email', 'E-mail', 'envelope', 'email', { autocomplete: 'email' }) +
                            champ('reg-password', 'Mot de passe', 'lock', 'password', { autocomplete: 'new-password', motDePasse: true, aide: '6 caractères minimum.' }) +
                            champ('reg-confirm', 'Confirmer', 'lock', 'password', { autocomplete: 'new-password', motDePasse: true }) +
                        '</div>' +
                        '<label class="auth-check" for="reg-enseignant">' +
                            '<input type="checkbox" id="reg-enseignant">' +
                            '<span>Je suis enseignant : créer mon espace et mes classes</span>' +
                        '</label>' +
                        '<button class="btn btn-primary w-100" type="submit">Créer mon compte <i class="fas fa-arrow-right ms-1"></i></button>' +
                    '</form>' +
                    '<p class="auth-note"><i class="fas fa-shield-halved"></i>' + (backendActif
                        ? 'E-mail et mot de passe de votre compte LearnHub. Aucun identifiant n\'est affiché sur cette page.'
                        : 'Identifiants fournis par l\'administrateur de la plateforme.') + '</p>' +
                '</div>' +
            '</div>',
            after: function (racine) {
                const zoneMessage = racine.querySelector('#auth-message');
                const formConnexion = racine.querySelector('#form-connexion');
                const formInscription = racine.querySelector('#form-inscription');
                const carte = racine.querySelector('.auth-card');
                let emailAConfirmer = '';

                function afficherMessage(texte, type, options) {
                    zoneMessage.className = 'alert alert-' + type;
                    zoneMessage.textContent = texte;
                    const reglages = options || {};
                    if (!reglages.action) return;
                    const boutonAction = document.createElement('button');
                    boutonAction.type = 'button';
                    boutonAction.className = 'btn btn-link btn-sm p-0 ms-1 align-baseline';
                    boutonAction.textContent = reglages.action;
                    boutonAction.addEventListener('click', function () {
                        boutonAction.disabled = true;
                        reglages.onClick(boutonAction);
                    });
                    zoneMessage.appendChild(boutonAction);
                }

                racine.querySelectorAll('[data-voir]').forEach(function (bouton) {
                    bouton.addEventListener('click', function () {
                        const cible = racine.querySelector('#' + bouton.dataset.voir);
                        if (!cible) return;
                        const visible = cible.type === 'password';
                        cible.type = visible ? 'text' : 'password';
                        bouton.innerHTML = '<i class="fas fa-eye' + (visible ? '-slash' : '') + '"></i>';
                        bouton.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
                    });
                });

                racine.querySelectorAll('[data-mode]').forEach(function (bouton) {
                    bouton.addEventListener('click', function () {
                        racine.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.remove('active'); });
                        bouton.classList.add('active');
                        const inscription = bouton.dataset.mode === 'inscription';
                        formConnexion.classList.toggle('d-none', inscription);
                        formInscription.classList.toggle('d-none', !inscription);
                        carte.classList.toggle('auth-card--large', inscription);
                        zoneMessage.className = 'd-none';
                        zoneMessage.textContent = '';
                        const titre = racine.querySelector('.auth-title');
                        if (titre) titre.textContent = inscription ? 'Créer un compte' : 'Bon retour !';
                        const sousTitre = racine.querySelector('.auth-sub');
                        if (sousTitre) {
                            sousTitre.textContent = inscription
                                ? (backendActif ? 'Vos cours et votre progression vous suivent sur tous vos appareils.' : 'Vos scores seront conservés dans ce navigateur.')
                                : 'Accédez à votre progression et à votre espace personnel.';
                        }
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
                        if (resultat.nonConfirme) {
                            emailAConfirmer = resultat.nonConfirme;
                            afficherMessage('Ce compte n\'est pas encore confirmé.', 'warning', {
                                action: 'Renvoyer l\'e-mail de confirmation',
                                onClick: async function (cible) {
                                    const envoi = await auth.renvoyerConfirmation(emailAConfirmer);
                                    cible.disabled = false;
                                    if (!envoi.ok) {
                                        afficherMessage(envoi.error, 'danger');
                                        return;
                                    }
                                    afficherMessage('E-mail renvoyé à ' + emailAConfirmer + '. Cliquez sur le lien reçu, puis connectez-vous.', 'success');
                                }
                            });
                            return;
                        }
                        afficherMessage(resultat.error, 'danger');
                        return;
                    }
                    toast('Bienvenue ' + resultat.user.username + ' !');
                    majEntete([]);
                    naviguer(suivant ? '#/' + suivant : (resultat.user.role === 'eleve' ? '#/profil' : '#/'));
                });

                formInscription.addEventListener('submit', async function (event) {
                    event.preventDefault();
                    const donnees = {
                        username: racine.querySelector('#reg-username').value,
                        email: racine.querySelector('#reg-email').value,
                        password: racine.querySelector('#reg-password').value,
                        enseignant: racine.querySelector('#reg-enseignant').checked
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
                    if (resultat.confirmation) {
                        emailAConfirmer = donnees.email;
                        afficherMessage('Compte créé. Confirmez votre adresse, puis connectez-vous.', 'success', {
                            action: 'Renvoyer l\'e-mail',
                            onClick: async function (cible) {
                                const envoi = await auth.renvoyerConfirmation(emailAConfirmer);
                                cible.disabled = false;
                                if (!envoi.ok) {
                                    afficherMessage(envoi.error, 'danger');
                                    return;
                                }
                                afficherMessage('E-mail renvoyé à ' + emailAConfirmer + '.', 'success');
                            }
                        });
                        formInscription.reset();
                        return;
                    }
                    const connexion = await auth.login(donnees.email, donnees.password);
                    if (connexion.ok) {
                        toast('Compte créé, bienvenue !');
                        majEntete([]);
                        naviguer(suivant ? '#/' + suivant : (donnees.enseignant ? '#/admin/classes' : '#/profil'));
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
        const classe = auth.maClasse();
        const seances = classe ? store.seances.pourClasse(classe.id) : [];

        return {
            titre: 'Ma progression',
            html: '<div class="container py-4">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">' +
                    '<div>' +
                        (user.role === 'eleve'
                            ? '<h1 class="h3 mb-1">Bonjour <strong>' + esc(user.username) + '</strong>, merci de vous être connecté.</h1>' +
                              '<p class="text-muted mb-0"><i class="fas fa-chart-line me-1"></i>Voici votre progression, vos badges et votre historique.</p>'
                            : '<h1 class="h3 mb-0">Ma progression</h1>') +
                    '</div>' +
                    '<div class="d-flex gap-2">' +
                        '<a class="btn btn-outline-primary btn-sm" href="#/ia"><i class="fas fa-wand-magic-sparkles me-1"></i>' + NOM_IA + '</a>' +
                        '<a class="btn btn-outline-primary btn-sm" href="#/exercices"><i class="fas fa-gamepad me-1"></i>S\'entraîner</a>' +
                        (tentatives.length ? '<button class="btn btn-outline-danger btn-sm" id="effacer-historique"><i class="fas fa-rotate-left me-1"></i>Effacer mon historique</button>' : '') +
                    '</div>' +
                '</div>' +
                (user.role === 'eleve'
                    ? '<div class="content mb-4">' +
                        '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">' +
                            '<h2 class="h5 mb-0"><i class="fas fa-users-rectangle me-2"></i>Ma classe</h2>' +
                            (classe ? '<button class="btn btn-outline-secondary btn-sm" id="quitter-classe"><i class="fas fa-right-from-bracket me-1"></i>Quitter la classe</button>' : '') +
                        '</div>' +
                        (classe
                            ? '<p class="mb-1"><strong>' + esc(classe.nom) + '</strong></p>' +
                              '<p class="text-muted small mb-0">' + seances.length + ' séance(s) pour votre classe. ' +
                                '<a href="#/seances">Consulter mes séances</a></p>'
                            : '<p class="text-muted small">Vous n\'êtes rattaché à aucune classe. Saisissez le code fourni par votre enseignant pour accéder à ses séances et exercices.</p>' +
                              '<form class="row g-2 align-items-end" id="form-classe">' +
                                '<div class="col-sm-6"><label class="form-label" for="code-classe">Code de la classe</label>' +
                                    '<input class="form-control" id="code-classe" maxlength="10" placeholder="ex. AB12CD" autocomplete="off"></div>' +
                                '<div class="col-sm-6"><button class="btn btn-primary" type="submit"><i class="fas fa-right-to-bracket me-1"></i>Rejoindre la classe</button></div>' +
                              '</form>') +
                      '</div>'
                    : '') +
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
                if (bouton) {
                    bouton.addEventListener('click', function () {
                        if (!window.confirm('Effacer tout votre historique de scores ?')) return;
                        auth.clearProgress(user.username);
                        toast('Historique effacé.');
                        router();
                    });
                }

                const formClasse = racine.querySelector('#form-classe');
                if (formClasse) {
                    formClasse.addEventListener('submit', async function (event) {
                        event.preventDefault();
                        const resultat = await auth.rejoindreClasse(racine.querySelector('#code-classe').value);
                        if (!resultat.ok) {
                            toast(resultat.error, 'danger');
                            return;
                        }
                        toast('Classe rejointe.');
                        router();
                    });
                }

                const quitter = racine.querySelector('#quitter-classe');
                if (quitter) {
                    quitter.addEventListener('click', async function () {
                        if (!window.confirm('Quitter votre classe ? Vous n\'aurez plus accès à ses séances.')) return;
                        const resultat = await auth.quitterClasse();
                        if (!resultat.ok) {
                            toast(resultat.error, 'danger');
                            return;
                        }
                        toast('Vous avez quitté la classe.');
                        router();
                    });
                }
            }
        };
    }

    function vueSeances() {
        const user = auth.current();
        if (!user) {
            return {
                titre: 'Mes séances',
                html: '<div class="container py-4"><div class="alert alert-info mb-0">' +
                    'Connectez-vous pour consulter les séances de votre classe. ' +
                    '<a href="#/connexion?next=seances" class="alert-link">Se connecter</a>' +
                '</div></div>'
            };
        }

        const classe = auth.maClasse();
        const toutes = classe ? store.seances.pourClasse(classe.id) : [];
        const seances = toutes.slice().sort(function (a, b) {
            return new Date(b.date || 0) - new Date(a.date || 0);
        });
        const aujourdhui = new Date();
        aujourdhui.setHours(0, 0, 0, 0);

        function scoreExercice(exerciceId) {
            const essais = auth.attempts(user.username).filter(function (t) { return t.exerciceId === exerciceId; });
            if (!essais.length) return null;
            return essais.reduce(function (acc, t) {
                const ratio = t.total > 0 ? Math.round((t.score / t.total) * 100) : 0;
                return Math.max(acc, ratio);
            }, 0);
        }

        const cartes = seances.map(function (seance) {
            const exercices = (seance.exercices || []).map(function (id) {
                const exercice = store.exercices.get(id);
                return exercice ? { id: id, titre: exercice.titre, type: exercice.type } : null;
            }).filter(Boolean);
            const chapitres = (seance.chapitres || []).map(function (id) { return data.getChapitre(id); }).filter(Boolean);
            const lecons = (seance.lecons || []).map(function (id) { return store.lecons.get(id); }).filter(Boolean);
            const faits = exercices.filter(function (ex) { return scoreExercice(ex.id) !== null; }).length;
            const moyenne = exercices.length
                ? Math.round(exercices.reduce(function (acc, ex) {
                    const score = scoreExercice(ex.id);
                    return acc + (score === null ? 0 : score);
                }, 0) / exercices.length)
                : 0;
            const date = seance.date ? new Date(seance.date) : null;
            const passee = date && date < aujourdhui;

            return '<div class="content mb-3">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">' +
                    '<div>' +
                        '<h2 class="h5 mb-1">' + esc(seance.titre) + '</h2>' +
                        '<p class="text-muted small mb-0"><i class="fas fa-calendar-day me-1"></i>' +
                            (date ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Date à préciser') +
                            ' · ' + (seance.duree || 60) + ' min</p>' +
                    '</div>' +
                    '<span class="badge ' + (passee ? 'bg-secondary' : 'bg-success') + '">' + (passee ? 'Passée' : 'À venir') + '</span>' +
                '</div>' +
                (seance.description ? '<p class="mb-3">' + esc(seance.description) + '</p>' : '') +
                (chapitres.length
                    ? '<h3 class="h6">Chapitres à revoir</h3>' +
                      '<ul class="list-unstyled mb-3">' + chapitres.map(function (chapitre) {
                        return '<li class="border-bottom py-1"><a href="#/chapitre/' + esc(chapitre.id) + '">' +
                            '<i class="fas fa-book-open me-1 text-primary"></i>' + esc(chapitre.titre) + '</a>' +
                            '<span class="text-muted small ms-2">' + esc(chapitre.matiereNom || '') + '</span></li>';
                      }).join('') + '</ul>'
                    : '') +
                (lecons.length
                    ? '<h3 class="h6">Leçons à étudier</h3>' +
                      '<ul class="list-unstyled mb-3">' + lecons.map(function (lecon) {
                        const matiere = data.getMatiere(lecon.matiere);
                        return '<li class="border-bottom py-1"><a href="#/lecon/' + encodeURIComponent(lecon.id) + '">' +
                            '<i class="fas fa-book-open me-1 text-primary"></i>' + esc(lecon.titre) + '</a>' +
                            (matiere ? '<span class="text-muted small ms-2">' + esc(matiere.nom) + '</span>' : '') + '</li>';
                      }).join('') + '</ul>'
                    : '') +
                (exercices.length
                    ? '<h3 class="h6">Exercices de la séance</h3>' +
                      '<div class="d-flex flex-wrap gap-2 mb-3">' + exercices.map(function (exercice) {
                        const score = scoreExercice(exercice.id);
                        return '<a class="btn btn-sm ' + (score === null ? 'btn-outline-primary' : 'btn-success') + '" href="#/exercices?exo=' + encodeURIComponent(exercice.id) + '">' +
                            '<i class="fas fa-gamepad me-1"></i>' + esc(exercice.titre) +
                            (score === null ? '' : ' <span class="badge bg-light text-dark ms-1">' + score + ' %</span>') + '</a>';
                      }).join('') + '</div>' +
                      '<div class="d-flex justify-content-between small text-muted mb-1">' +
                        '<span>Exercices réalisés : ' + faits + '/' + exercices.length + '</span>' +
                        '<span>Moyenne : ' + (faits ? moyenne + ' %' : '—') + '</span>' +
                      '</div>' +
                      '<div class="progress" style="height:8px"><div class="progress-bar bg-success" style="width:' +
                        (exercices.length ? Math.round((faits / exercices.length) * 100) : 0) + '%"></div></div>'
                    : '') +
            '</div>';
        });

        return {
            titre: 'Mes séances',
            html: '<div class="container py-4">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">' +
                    '<div>' +
                        '<h1 class="h3 mb-1">Mes séances</h1>' +
                        '<p class="text-muted mb-0">' +
                            (classe
                                ? 'Classe ' + esc(classe.nom)
                                : 'Aucune classe rejointe') +
                        '</p>' +
                    '</div>' +
                    '<a class="btn btn-outline-primary btn-sm" href="#/profil"><i class="fas fa-users-rectangle me-1"></i>Ma classe</a>' +
                '</div>' +
                (!classe
                    ? '<div class="alert alert-info">Rejoignez une classe depuis <a href="#/profil" class="alert-link">Ma progression</a> avec le code fourni par votre enseignant.</div>'
                    : (!cartes.length
                        ? '<div class="content text-muted"><i class="fas fa-calendar-xmark me-2"></i>Aucune séance programmée pour le moment.</div>'
                        : cartes.join(''))) +
            '</div>'
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

    /* ------------------------------ IAFA FAMA (IA) ------------------------------ */

    function sectionsTexteIA(titre, icone, valeur) {
        if (!valeur) return '';
        return '<div class="mb-4">' +
            '<h3 class="h5 text-primary mb-2"><i class="fas ' + icone + ' me-2"></i>' + esc(titre) + '</h3>' +
            '<p class="mb-0">' + esc(valeur) + '</p>' +
        '</div>';
    }

    function sectionsListeIA(titre, icone, items) {
        const liste = (Array.isArray(items) ? items : []).filter(Boolean);
        if (!liste.length) return '';
        return '<div class="mb-4">' +
            '<h3 class="h5 text-primary mb-2"><i class="fas ' + icone + ' me-2"></i>' + esc(titre) + '</h3>' +
            '<ul class="mb-0">' + liste.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>' +
        '</div>';
    }

    function htmlEtudeIA(contenu) {
        const c = contenu || {};
        const identite = [c.epoque, c.genre, c.mouvement].filter(Boolean).map(esc).join(' · ');
        const parties = Array.isArray(c.parties) ? c.parties : [];
        const personnages = Array.isArray(c.personnages) ? c.personnages : [];
        const themes = Array.isArray(c.themes) ? c.themes : [];
        const procedes = Array.isArray(c.procedes) ? c.procedes : [];
        const citations = Array.isArray(c.citations) ? c.citations : [];

        return '<article>' +
            '<header class="mb-4">' +
                '<p class="text-muted mb-1">' + (identite || 'Fiche d\'étude') + '</p>' +
                '<h2 class="h3 mb-1">' + esc(c.titre || '') + '</h2>' +
                '<p class="mb-0"><i class="fas fa-feather-pointed me-1"></i>' + esc(c.auteur || '') + '</p>' +
            '</header>' +
            sectionsTexteIA('Résumé', 'fa-book-open', c.resume) +
            sectionsTexteIA('Contexte', 'fa-landmark', c.contexte) +
            (parties.length
                ? '<div class="mb-4"><h3 class="h5 text-primary mb-2"><i class="fas fa-list-ol me-2"></i>Structure</h3>' +
                    parties.map(function (partie) {
                        return '<div class="border-start border-3 border-primary ps-3 mb-3">' +
                            '<div class="fw-semibold">' + esc(partie.titre || '') + '</div>' +
                            '<div class="text-muted small">' + esc(partie.resume || '') + '</div>' +
                        '</div>';
                    }).join('') + '</div>'
                : '') +
            (personnages.length
                ? '<div class="mb-4"><h3 class="h5 text-primary mb-2"><i class="fas fa-users me-2"></i>Personnages</h3>' +
                    '<div class="row g-3">' + personnages.map(function (personnage) {
                        return '<div class="col-md-6"><div class="border rounded-3 p-3 h-100">' +
                            '<div class="fw-semibold">' + esc(personnage.nom || '') + '</div>' +
                            '<div class="small text-primary mb-1">' + esc(personnage.role || '') + '</div>' +
                            '<div class="small text-muted">' + esc(personnage.description || '') + '</div>' +
                        '</div></div>';
                    }).join('') + '</div></div>'
                : '') +
            (themes.length
                ? '<div class="mb-4"><h3 class="h5 text-primary mb-2"><i class="fas fa-lightbulb me-2"></i>Thèmes</h3>' +
                    '<div class="list-group">' + themes.map(function (theme) {
                        return '<div class="list-group-item">' +
                            '<div class="fw-semibold">' + esc(theme.titre || '') + '</div>' +
                            '<div class="small text-muted">' + esc(theme.explication || '') + '</div>' +
                        '</div>';
                    }).join('') + '</div></div>'
                : '') +
            (procedes.length
                ? '<div class="mb-4"><h3 class="h5 text-primary mb-2"><i class="fas fa-pen-fancy me-2"></i>Procédés d\'écriture</h3>' +
                    '<div class="table-responsive"><table class="table table-sm align-middle mb-0">' +
                        '<thead><tr><th>Procédé</th><th>Exemple</th><th>Effet</th></tr></thead><tbody>' +
                        procedes.map(function (procede) {
                            return '<tr>' +
                                '<td class="fw-semibold">' + esc(procede.nom || '') + '</td>' +
                                '<td class="small">' + esc(procede.exemple || '') + '</td>' +
                                '<td class="small text-muted">' + esc(procede.effet || '') + '</td>' +
                            '</tr>';
                        }).join('') + '</tbody></table></div></div>'
                : '') +
            (citations.length
                ? '<div class="mb-4"><h3 class="h5 text-primary mb-2"><i class="fas fa-quote-left me-2"></i>Citations</h3>' +
                    citations.map(function (citation) {
                        return '<blockquote class="border-start border-3 border-secondary ps-3 mb-3">' +
                            '<p class="fst-italic mb-1">« ' + esc(citation.texte || '') + ' »</p>' +
                            '<p class="small text-muted mb-0">' + esc(citation.explication || '') + '</p>' +
                        '</blockquote>';
                    }).join('') + '</div>'
                : '') +
            sectionsListeIA('Questions d\'entraînement', 'fa-circle-question', c.questions) +
            sectionsListeIA('Sujets d\'exposé', 'fa-pen-nib', c.sujets) +
        '</article>';
    }

    function htmlReponseIA(contenu) {
        const c = contenu || {};
        return '<article>' +
            '<h2 class="h4 mb-3">' + esc(c.question || '') + '</h2>' +
            sectionsTexteIA('Réponse', 'fa-lightbulb', c.reponse) +
            sectionsTexteIA('Explication', 'fa-book-open-reader', c.explication) +
            sectionsTexteIA('Exemple', 'fa-quote-left', c.exemple) +
            sectionsListeIA('À retenir', 'fa-bookmark', c.aRetenir) +
            sectionsListeIA('Pour vérifier', 'fa-circle-question', c.questions) +
        '</article>';
    }

    function etoilesDeco(nombre) {
        // Générateur déterministe : les positions restent stables entre deux rendus.
        let graine = 20261029;
        function suivant() {
            graine = (graine * 16807) % 2147483647;
            return graine / 2147483647;
        }
        const morceaux = [];
        for (let i = 0; i < nombre; i += 1) {
            const x = (2 + suivant() * 96).toFixed(2);
            const y = (2 + suivant() * 96).toFixed(2);
            const taille = (1.2 + suivant() * 2.6).toFixed(1);
            const delai = (suivant() * 4.5).toFixed(1);
            const duree = (2.4 + suivant() * 2.8).toFixed(1);
            morceaux.push('<span class="etoile" aria-hidden="true" style="left:' + x + '%;top:' + y + '%;width:' +
                taille + 'px;height:' + taille + 'px;animation-delay:' + delai + 's;animation-duration:' + duree + 's"></span>');
        }
        return morceaux.join('');
    }

    function heroIA(sousTitre) {
        return '<section class="ia-hero mb-4" aria-label="' + esc(NOM_IA) + '">' +
            etoilesDeco(48) +
            '<div class="ia-hero-contenu">' +
                '<div class="ia-hero-etoiles" aria-hidden="true">' +
                    '<i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>' +
                '</div>' +
                '<span class="ia-hero-badge">Intelligence artificielle</span>' +
                '<h1 class="ia-hero-titre">' + esc(NOM_IA) + '</h1>' +
                '<p class="ia-hero-soustitre">' + esc(sousTitre) + '</p>' +
            '</div>' +
        '</section>';
    }

    function vueIA(parametres) {
        const user = auth.current();
        if (!user) {
            return {
                titre: NOM_IA + ' — IA',
                html: '<div class="container py-4">' +
                    heroIA(DESCRIPTION_IA) +
                    '<div class="content text-center">' +
                        '<p class="text-muted">Connectez-vous pour générer et conserver vos fiches.</p>' +
                        '<a class="btn btn-primary" href="#/connexion?next=ia">Se connecter</a>' +
                    '</div>' +
                '</div>'
            };
        }

        const modeInitial = parametres && parametres.get('mode') === 'question' ? 'question' : 'etude';
        const optionsNiveaux = data.niveaux.map(function (niveau) {
            return '<option value="' + esc(niveau.slug) + '">' + esc(niveau.nom) + '</option>';
        }).join('');
        const optionsOeuvres = data.cours.map(function (cours) {
            return '<option value="' + esc(cours.titre) + '" data-auteur="' + esc(cours.auteur) + '">' +
                esc(cours.titre) + ' — ' + esc(cours.auteur) + '</option>';
        }).join('');

        return {
            titre: NOM_IA + ' — IA',
            html: '<div class="container py-4">' +
                heroIA(DESCRIPTION_IA) +
                '<div class="d-flex flex-wrap justify-content-end align-items-center gap-2 mb-3">' +
                    '<a class="btn btn-outline-secondary btn-sm" href="#/profil"><i class="fas fa-chart-line me-1"></i>Ma progression</a>' +
                '</div>' +
                '<div class="alert alert-warning small"><i class="fas fa-triangle-exclamation me-1"></i>' +
                    'Contenu généré par intelligence artificielle : vérifiez toujours les informations avant de les apprendre.</div>' +
                '<ul class="nav nav-tabs mb-3" id="ia-onglets">' +
                    '<li class="nav-item"><button class="nav-link ' + (modeInitial === 'etude' ? 'active' : '') + '" type="button" data-mode="etude"><i class="fas fa-book-open me-1"></i>Étude d\'œuvre</button></li>' +
                    '<li class="nav-item"><button class="nav-link ' + (modeInitial === 'question' ? 'active' : '') + '" type="button" data-mode="question"><i class="fas fa-magnifying-glass me-1"></i>Recherche / question</button></li>' +
                '</ul>' +
                '<div class="content mb-4">' +
                    '<form id="form-etude" class="' + (modeInitial === 'etude' ? '' : 'd-none') + '">' +
                        '<div class="row g-3">' +
                            '<div class="col-md-6">' +
                                '<label class="form-label" for="ia-oeuvre">Œuvre</label>' +
                                '<select class="form-select" id="ia-oeuvre">' +
                                    '<option value="">Choisir dans le programme…</option>' +
                                    optionsOeuvres +
                                    '<option value="autre">Autre œuvre…</option>' +
                                '</select>' +
                                '<input class="form-control mt-2 d-none" id="ia-oeuvre-autre" maxlength="120" placeholder="Titre de l\'œuvre">' +
                                '<div class="small mt-2 d-none" id="ia-lien-fiche"></div>' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-auteur">Auteur (optionnel)</label>' +
                                '<input class="form-control" id="ia-auteur" maxlength="80" placeholder="ex. Mariama Bâ">' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-niveau">Niveau</label>' +
                                '<select class="form-select" id="ia-niveau">' + optionsNiveaux + '</select>' +
                            '</div>' +
                            '<div class="col-12">' +
                                '<button class="btn btn-primary" type="submit"><i class="fas fa-wand-magic-sparkles me-1"></i>Générer ma fiche</button>' +
                            '</div>' +
                        '</div>' +
                    '</form>' +
                    '<form id="form-question" class="' + (modeInitial === 'question' ? '' : 'd-none') + '">' +
                        '<div class="row g-3">' +
                            '<div class="col-12">' +
                                '<label class="form-label" for="ia-question">Votre question</label>' +
                                '<textarea class="form-control" id="ia-question" rows="3" maxlength="500" placeholder="ex. Qu\'est-ce que le registre lyrique ?"></textarea>' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-niveau-question">Niveau</label>' +
                                '<select class="form-select" id="ia-niveau-question">' + optionsNiveaux + '</select>' +
                            '</div>' +
                            '<div class="col-md-9 d-flex align-items-end">' +
                                '<button class="btn btn-primary" type="submit"><i class="fas fa-magnifying-glass me-1"></i>Obtenir une réponse</button>' +
                            '</div>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
                '<div id="ia-resultat"></div>' +
                '<div class="content mt-4" id="ia-historique"></div>' +
            '</div>',
            after: function (racine) {
                const onglets = racine.querySelectorAll('#ia-onglets [data-mode]');
                const formEtude = racine.querySelector('#form-etude');
                const formQuestion = racine.querySelector('#form-question');
                const zone = racine.querySelector('#ia-resultat');
                const historique = racine.querySelector('#ia-historique');
                const selectOeuvre = racine.querySelector('#ia-oeuvre');
                const oeuvreLibre = racine.querySelector('#ia-oeuvre-autre');

                function activerMode(mode) {
                    onglets.forEach(function (bouton) {
                        bouton.classList.toggle('active', bouton.dataset.mode === mode);
                    });
                    formEtude.classList.toggle('d-none', mode !== 'etude');
                    formQuestion.classList.toggle('d-none', mode !== 'question');
                }

                onglets.forEach(function (bouton) {
                    bouton.addEventListener('click', function () { activerMode(bouton.dataset.mode); });
                });

                function afficherChargement(texte) {
                    zone.innerHTML = '<div class="content text-center text-muted py-4">' +
                        '<i class="fas fa-spinner fa-spin me-2"></i>' + esc(texte) + '</div>';
                    zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                function afficherErreur(texte) {
                    zone.innerHTML = '<div class="alert alert-danger mb-0">' +
                        '<i class="fas fa-triangle-exclamation me-1"></i>' + esc(texte) + '</div>';
                }

                function rendre(item) {
                    const corps = item.type === 'question' ? htmlReponseIA(item.contenu) : htmlEtudeIA(item.contenu);
                    zone.innerHTML = '<div class="content">' +
                        (item.demo
                            ? '<div class="alert alert-info small"><i class="fas fa-circle-info me-1"></i>' +
                              'Mode démonstration : aucune clé IA n\'est configurée. Voici la présentation type d\'une fiche.</div>'
                            : '') +
                        corps +
                        '<p class="text-muted small mt-4 mb-0"><i class="fas fa-robot me-1"></i>Généré le ' +
                            new Date(item.date).toLocaleString('fr-FR') +
                            (item.modele ? ' · ' + esc(item.modele) : '') + '</p>' +
                    '</div>';
                }

                async function rafraichirHistorique() {
                    const contenus = window.LearnHubIA.mesContenus();
                    if (!contenus.length) {
                        historique.innerHTML = '<h2 class="h5 mb-3"><i class="fas fa-clock-rotate-left me-2"></i>Mes fiches</h2>' +
                            '<p class="text-muted mb-0">Vos fiches générées apparaîtront ici.</p>';
                        return;
                    }
                    historique.innerHTML = '<h2 class="h5 mb-3"><i class="fas fa-clock-rotate-left me-2"></i>Mes fiches (' + contenus.length + ')</h2>' +
                        '<div class="list-group">' + contenus.map(function (item) {
                            return '<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">' +
                                '<div>' +
                                    '<div class="fw-semibold">' + esc(item.requete) + '</div>' +
                                    '<small class="text-muted">' + esc(window.LearnHubIA.libelleType(item.type)) + ' · ' +
                                        new Date(item.date).toLocaleString('fr-FR') +
                                        (item.niveau ? ' · ' + esc(item.niveau) : '') +
                                    '</small>' +
                                '</div>' +
                                '<div class="d-flex gap-2">' +
                                    '<button class="btn btn-sm btn-outline-primary" data-action="ouvrir" data-id="' + esc(item.id) + '"><i class="fas fa-eye me-1"></i>Ouvrir</button>' +
                                    '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-id="' + esc(item.id) + '" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                                '</div>' +
                            '</div>';
                        }).join('') + '</div>';
                }

                async function lancer(mode, parametres) {
                    const boutons = racine.querySelectorAll('form button[type="submit"]');
                    boutons.forEach(function (bouton) { bouton.disabled = true; });
                    afficherChargement(mode === 'etude' ? 'L\'IA rédige la fiche…' : 'L\'IA prépare la réponse…');

                    let resultat = await window.LearnHubIA.generer(parametres);
                    let demo = false;
                    if (!resultat.ok && (resultat.code === 'local' || resultat.code === 'non_configure')) {
                        demo = true;
                        resultat = { ok: true, contenu: window.LearnHubIA.exemple(mode, parametres), modele: '' };
                    }
                    boutons.forEach(function (bouton) { bouton.disabled = false; });

                    if (!resultat.ok) {
                        afficherErreur(resultat.error || 'Génération impossible.');
                        return;
                    }

                    const item = {
                        type: mode,
                        requete: mode === 'etude' ? parametres.oeuvre : parametres.question,
                        auteur: parametres.auteur || '',
                        niveau: parametres.niveau || '',
                        modele: resultat.modele || '',
                        contenu: resultat.contenu,
                        demo: demo,
                        date: new Date().toISOString()
                    };

                    if (!demo) {
                        const enregistre = await window.LearnHubIA.enregistrer(item);
                        if (!enregistre.ok) toast(enregistre.error, 'warning');
                        else await rafraichirHistorique();
                    }

                    rendre(item);
                    zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                function majLienFiche() {
                    const zone = racine.querySelector('#ia-lien-fiche');
                    const cours = data.cours.find(function (item) { return item.titre === selectOeuvre.value; });
                    if (!cours) {
                        zone.className = 'small mt-2 d-none';
                        zone.innerHTML = '';
                        return;
                    }
                    zone.className = 'small mt-2';
                    zone.innerHTML = '<i class="fas fa-book-open me-1"></i>Une fiche rédigée existe : ' +
                        '<a href="#/cours/' + esc(cours.slug) + '">consulter l\'étude du programme</a>';
                }

                selectOeuvre.addEventListener('change', function () {
                    const estAutre = selectOeuvre.value === 'autre';
                    oeuvreLibre.classList.toggle('d-none', !estAutre);
                    if (!estAutre && selectOeuvre.value) {
                        const option = selectOeuvre.options[selectOeuvre.selectedIndex];
                        const auteur = option ? option.getAttribute('data-auteur') : null;
                        if (auteur) racine.querySelector('#ia-auteur').value = auteur;
                    }
                    majLienFiche();
                });

                formEtude.addEventListener('submit', function (event) {
                    event.preventDefault();
                    const choix = selectOeuvre.value;
                    const oeuvre = choix === 'autre' ? oeuvreLibre.value.trim() : choix;
                    if (!oeuvre) {
                        afficherErreur('Choisissez une œuvre ou saisissez son titre.');
                        return;
                    }
                    lancer('etude', {
                        mode: 'etude',
                        oeuvre: oeuvre,
                        auteur: racine.querySelector('#ia-auteur').value.trim(),
                        niveau: racine.querySelector('#ia-niveau').value
                    });
                });

                formQuestion.addEventListener('submit', function (event) {
                    event.preventDefault();
                    const question = racine.querySelector('#ia-question').value.trim();
                    if (question.length < 3) {
                        afficherErreur('Saisissez une question plus précise.');
                        return;
                    }
                    lancer('question', {
                        mode: 'question',
                        question: question,
                        niveau: racine.querySelector('#ia-niveau-question').value
                    });
                });

                historique.addEventListener('click', async function (event) {
                    const bouton = event.target.closest('button[data-action]');
                    if (!bouton) return;
                    const contenus = window.LearnHubIA.mesContenus();
                    const item = contenus.find(function (contenu) { return contenu.id === bouton.dataset.id; });
                    if (!item) return;

                    if (bouton.dataset.action === 'supprimer') {
                        if (!window.confirm('Supprimer définitivement cette fiche ?')) return;
                        const resultat = await window.LearnHubIA.supprimer(item.id);
                        if (!resultat.ok) {
                            afficherErreur(resultat.error || 'Suppression impossible.');
                            return;
                        }
                        toast('Fiche supprimée.');
                        await rafraichirHistorique();
                        return;
                    }

                    rendre(item);
                    zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });

                rafraichirHistorique();
            }
        };
    }

    /* ------------------------------ Super-administration ------------------------------ */

    const LIBELLES_ROLES = { eleve: 'Élève', admin: 'Administrateur', superadmin: 'Super-admin' };
    const ORDRE_ROLES = { superadmin: 0, admin: 1, eleve: 2 };
    const LIBELLES_TYPES_ACTIVITE = { quiz: 'Quiz', matching: 'Associations', fillblank: 'Textes à trous' };

    function infosEspaceCompte(compte) {
        if (compte.role === 'admin') {
            return { espace: compte.espaceNom || compte.espaceId || '—', classe: '—' };
        }
        if (compte.role === 'eleve' && compte.classeId) {
            const classe = store.classes.get(compte.classeId);
            if (!classe) return { espace: '—', classe: '—' };
            const titulaire = auth.users().find(function (u) {
                return u.role === 'admin' && u.espaceId === classe.espaceId;
            });
            return {
                espace: titulaire ? (titulaire.espaceNom || titulaire.espaceId) : '—',
                classe: classe.nom
            };
        }
        return { espace: '—', classe: '—' };
    }

    function vueSuperAdmin() {
        const user = auth.current();
        const backendActif = !!(window.LearnHubBackend && window.LearnHubBackend.estActif());
        if (!auth.isSuperAdmin()) {
            return {
                titre: 'Super-administration',
                html: '<div class="container py-5"><div class="content text-center">' +
                    '<i class="fas fa-shield-halved fa-3x text-primary mb-3"></i>' +
                    '<h1 class="h4 mb-3">Accès réservé au super-administrateur</h1>' +
                    '<p class="text-muted">La gestion globale de tous les comptes est réservée à ce rôle.</p>' +
                    '<p class="small text-muted">Connectez-vous avec le compte super-administrateur de la plateforme.</p>' +
                    '<a class="btn btn-primary" href="#/connexion?next=superadmin">Se connecter</a>' +
                '</div></div>'
            };
        }

        const comptes = auth.users().slice().sort(function (a, b) {
            const ordre = (ORDRE_ROLES[a.role] || 9) - (ORDRE_ROLES[b.role] || 9);
            return ordre !== 0 ? ordre : a.username.localeCompare(b.username);
        });
        const totalEleves = comptes.filter(function (c) { return c.role === 'eleve'; }).length;
        const totalAdmins = comptes.filter(function (c) { return c.role === 'admin'; }).length;
        const totalSupers = comptes.filter(function (c) { return c.role === 'superadmin'; }).length;
        const totalClasses = store.classes.all().length;
        const totalSeances = store.seances.all().length;
        const messages = store.messages.all().slice().sort(function (a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        const activites = [];
        const progres = auth.allProgress();
        Object.keys(progres).forEach(function (username) {
            (progres[username] || []).forEach(function (t) {
                activites.push(Object.assign({}, t, { username: username }));
            });
        });
        activites.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        const activitesAffichees = activites.slice(0, 200);
        const compteParNom = {};
        comptes.forEach(function (compte) { compteParNom[compte.username] = compte; });

        const lignesActivites = activitesAffichees.map(function (t) {
            const compte = compteParNom[t.username];
            const infos = compte ? infosEspaceCompte(compte) : { espace: '—', classe: '—' };
            const pourcentage = t.total > 0 ? Math.round((t.score / t.total) * 100) : 0;
            const couleur = pourcentage >= 80 ? 'success' : pourcentage >= 60 ? 'warning' : 'danger';
            return '<tr>' +
                '<td class="fw-semibold">' + esc(t.username) + '</td>' +
                '<td class="small">' + esc(compte ? (LIBELLES_ROLES[compte.role] || compte.role) : '—') + '</td>' +
                '<td class="small">' + esc(infos.espace) + '</td>' +
                '<td class="small">' + esc(infos.classe) + '</td>' +
                '<td>' + esc(t.titre) + '</td>' +
                '<td class="text-muted small">' + esc(LIBELLES_TYPES_ACTIVITE[t.type] || t.type || '—') + '</td>' +
                '<td><span class="badge bg-' + couleur + '">' + t.score + '/' + t.total + '</span></td>' +
                '<td class="text-muted small text-nowrap">' + new Date(t.date).toLocaleString('fr-FR') + '</td>' +
            '</tr>';
        }).join('');

        const classeParId = {};
        store.classes.all().forEach(function (classe) { classeParId[classe.id] = classe; });

        function espaceDeCompte(compte) {
            if (!compte) return null;
            if (compte.role === 'admin') return compte.espaceId || null;
            const classe = compte.classeId ? classeParId[compte.classeId] : null;
            return classe ? classe.espaceId : null;
        }

        const statsEspaces = {};
        function ficheEspace(id, nom) {
            if (!statsEspaces[id]) {
                statsEspaces[id] = { id: id, nom: nom || id, titulaire: '—', classes: 0, eleves: 0, activites: 0, derniere: null };
            } else if (nom && statsEspaces[id].nom === id) {
                statsEspaces[id].nom = nom;
            }
            return statsEspaces[id];
        }

        comptes.forEach(function (compte) {
            if (compte.role !== 'admin' || !compte.espaceId) return;
            ficheEspace(compte.espaceId, compte.espaceNom).titulaire = compte.username;
        });
        store.classes.all().forEach(function (classe) {
            if (!classe.espaceId) return;
            ficheEspace(classe.espaceId).classes += 1;
        });
        comptes.forEach(function (compte) {
            if (compte.role !== 'eleve') return;
            const id = espaceDeCompte(compte);
            if (id) ficheEspace(id).eleves += 1;
        });
        activites.forEach(function (t) {
            const id = espaceDeCompte(compteParNom[t.username]);
            if (!id) return;
            const fiche = ficheEspace(id);
            fiche.activites += 1;
            if (!fiche.derniere || new Date(t.date) > new Date(fiche.derniere)) fiche.derniere = t.date;
        });
        const espacesPlateforme = Object.keys(statsEspaces).map(function (id) { return statsEspaces[id]; })
            .sort(function (a, b) { return b.activites - a.activites || a.nom.localeCompare(b.nom); });

        const lignesEspaces = espacesPlateforme.map(function (espace) {
            return '<tr>' +
                '<td class="fw-semibold">' + esc(espace.nom) + '</td>' +
                '<td class="small">' + esc(espace.titulaire) + '</td>' +
                '<td>' + espace.classes + '</td>' +
                '<td>' + espace.eleves + '</td>' +
                '<td>' + espace.activites + '</td>' +
                '<td class="text-muted small text-nowrap">' + (espace.derniere ? new Date(espace.derniere).toLocaleString('fr-FR') : '—') + '</td>' +
            '</tr>';
        }).join('');

        const lignes = comptes.map(function (compte) {
            const infos = infosEspaceCompte(compte);
            const tentatives = auth.attempts(compte.username);
            const points = tentatives.reduce(function (acc, t) { return acc + t.score; }, 0);
            const possibles = tentatives.reduce(function (acc, t) { return acc + t.total; }, 0);
            const moyenne = possibles > 0 ? Math.round((points / possibles) * 100) : null;
            const moi = user.username === compte.username;
            const options = Object.keys(LIBELLES_ROLES).map(function (cle) {
                return '<option value="' + cle + '" ' + (compte.role === cle ? 'selected' : '') + '>' + LIBELLES_ROLES[cle] + '</option>';
            }).join('');
            return '<tr>' +
                '<td class="fw-semibold">' + esc(compte.username) + (moi ? ' <span class="badge bg-info text-dark">vous</span>' : '') + '</td>' +
                '<td class="text-muted small">' + esc(compte.email) + '</td>' +
                '<td><select class="form-select form-select-sm" data-action="role" data-username="' + esc(compte.username) + '" data-role="' + esc(compte.role) + '" style="min-width:150px" ' + (moi ? 'disabled' : '') + '>' + options + '</select></td>' +
                '<td class="small">' + esc(infos.espace) + '</td>' +
                '<td class="small">' + esc(infos.classe) + '</td>' +
                '<td>' + tentatives.length + '</td>' +
                '<td>' + (moyenne === null ? '—' : moyenne + ' %') + '</td>' +
                '<td class="text-end text-nowrap">' +
                    '<button class="btn btn-sm btn-outline-secondary me-1" data-action="reinitialiser" data-username="' + esc(compte.username) + '" title="Réinitialiser la progression" ' + (tentatives.length ? '' : 'disabled') + '><i class="fas fa-rotate-left"></i></button>' +
                    '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-username="' + esc(compte.username) + '" title="Supprimer le compte" ' + (moi ? 'disabled' : '') + '><i class="fas fa-trash"></i></button>' +
                '</td>' +
            '</tr>';
        }).join('');

        return {
            titre: 'Super-administration',
            html: '<div class="container py-4">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">' +
                    '<div>' +
                        '<h1 class="h3 mb-1"><i class="fas fa-shield-halved me-2"></i>Super-administration</h1>' +
                        '<p class="text-muted mb-0">Tous les comptes, espaces, classes et séances de la plateforme.</p>' +
                    '</div>' +
                    '<button class="btn btn-outline-primary btn-sm" id="export-comptes"><i class="fas fa-file-csv me-1"></i>Exporter en CSV</button>' +
                '</div>' +
                '<div id="super-message" class="d-none"></div>' +
                '<div id="super-alerte" class="d-none"></div>' +
                '<div class="row g-3 mb-4">' +
                    carteStat('bg-primary', 'fa-users', 'Comptes', comptes.length) +
                    carteStat('bg-success', 'fa-user-graduate', 'Élèves', totalEleves) +
                    carteStat('bg-warning', 'fa-chalkboard-user', 'Enseignants', totalAdmins) +
                    carteStat('bg-info', 'fa-shield-halved', 'Super-admins', totalSupers) +
                '</div>' +
                '<div class="content mb-4">' +
                    '<h2 class="h5 mb-3"><i class="fas fa-id-card me-2"></i>Mes identifiants super-admin</h2>' +
                    (backendActif
                        ? '<p class="text-muted small">Votre nom d\'utilisateur se modifie ici. L\'adresse e-mail de connexion se change depuis le tableau de bord Supabase.</p>' +
                          '<form class="row g-3 align-items-end" id="form-identifiants">' +
                              '<div class="col-md-4"><label class="form-label" for="super-username">Nom d\'utilisateur</label>' +
                                  '<input class="form-control" id="super-username" required minlength="3" value="' + esc(user.username) + '"></div>' +
                              '<div class="col-md-4"><label class="form-label" for="super-email">E-mail (lecture seule)</label>' +
                                  '<input class="form-control" type="email" id="super-email" value="' + esc(user.email) + '" disabled></div>' +
                              '<div class="col-md-4"><button class="btn btn-primary w-100" type="submit"><i class="fas fa-floppy-disk me-1"></i>Enregistrer</button></div>' +
                          '</form>'
                        : '<p class="text-muted small">Remplacez les identifiants de démonstration par les vôtres. Le nom d\'utilisateur ou l\'e-mail servent à la connexion.</p>' +
                          '<form class="row g-3 align-items-end" id="form-identifiants">' +
                              '<div class="col-md-4"><label class="form-label" for="super-username">Nom d\'utilisateur</label>' +
                                  '<input class="form-control" id="super-username" required minlength="3" value="' + esc(user.username) + '"></div>' +
                              '<div class="col-md-4"><label class="form-label" for="super-email">E-mail</label>' +
                                  '<input class="form-control" type="email" id="super-email" required value="' + esc(user.email) + '"></div>' +
                              '<div class="col-md-4"><button class="btn btn-primary w-100" type="submit"><i class="fas fa-floppy-disk me-1"></i>Enregistrer mes identifiants</button></div>' +
                          '</form>') +
                    '<hr>' +
                    '<form class="row g-3 align-items-end" id="form-mdp-super">' +
                        '<div class="col-md-4"><label class="form-label" for="super-mdp-actuel">Mot de passe actuel</label>' +
                            '<input class="form-control" type="password" id="super-mdp-actuel" required autocomplete="current-password"></div>' +
                        '<div class="col-md-4"><label class="form-label" for="super-mdp-nouveau">Nouveau mot de passe</label>' +
                            '<input class="form-control" type="password" id="super-mdp-nouveau" required minlength="6" autocomplete="new-password"></div>' +
                        '<div class="col-md-4"><button class="btn btn-outline-primary w-100" type="submit"><i class="fas fa-key me-1"></i>Changer le mot de passe</button></div>' +
                    '</form>' +
                '</div>' +
                '<div class="content mb-4">' +
                    '<h2 class="h5 mb-3"><i class="fas fa-user-plus me-2"></i>Créer un compte</h2>' +
                    '<p class="text-muted small">' + totalClasses + ' classe(s) et ' + totalSeances + ' séance(s) sur la plateforme.</p>' +
                    '<form class="row g-3 align-items-end" id="form-compte">' +
                        '<div class="col-md-3"><label class="form-label" for="compte-username">Nom d\'utilisateur</label>' +
                            '<input class="form-control" id="compte-username" required minlength="3" autocomplete="off"></div>' +
                        '<div class="col-md-3"><label class="form-label" for="compte-email">E-mail</label>' +
                            '<input class="form-control" type="email" id="compte-email" required autocomplete="off"></div>' +
                        '<div class="col-md-2"><label class="form-label" for="compte-password">Mot de passe</label>' +
                            '<input class="form-control" type="password" id="compte-password" required minlength="6" autocomplete="new-password"></div>' +
                        '<div class="col-md-2"><label class="form-label" for="compte-role">Rôle</label>' +
                            '<select class="form-select" id="compte-role"><option value="eleve">Élève</option><option value="admin">Enseignant</option><option value="superadmin">Super-admin</option></select></div>' +
                        '<div class="col-md-2"><button class="btn btn-primary w-100" type="submit"><i class="fas fa-plus me-1"></i>Créer</button></div>' +
                    '</form>' +
                '</div>' +
                '<div class="admin-panel">' +
                    '<h2 class="h5 mb-3"><i class="fas fa-address-book me-2"></i>Tous les comptes (' + comptes.length + ')</h2>' +
                    '<div class="table-responsive"><table class="table table-striped align-middle mb-0" id="table-comptes">' +
                        '<thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôle</th><th>Espace</th><th>Classe</th><th>Tentatives</th><th>Moyenne</th><th class="text-end">Actions</th></tr></thead>' +
                        '<tbody>' + lignes + '</tbody>' +
                    '</table></div>' +
                    '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>' +
                        (backendActif
                            ? 'Comptes synchronisés avec Supabase : les rôles, la création et la suppression s\'appliquent immédiatement.'
                            : 'Les comptes et leurs données restent stockés dans ce navigateur. Le rôle « super-admin » ne peut être attribué que depuis cette page.') +
                    '</p>' +
                '</div>' +
                '<div class="admin-panel mt-4" id="espaces-panel">' +
                    '<h2 class="h5 mb-3"><i class="fas fa-door-open me-2"></i>Espaces de la plateforme (' + espacesPlateforme.length + ')</h2>' +
                    (espacesPlateforme.length
                        ? '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                            '<thead><tr><th>Espace</th><th>Enseignant</th><th>Classes</th><th>Élèves</th><th>Activités</th><th>Dernière activité</th></tr></thead>' +
                            '<tbody>' + lignesEspaces + '</tbody>' +
                          '</table></div>'
                        : '<p class="text-muted mb-0">Aucun espace enseignant pour le moment.</p>') +
                    '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>Tous les espaces et tous les comptes confondus, sans cloisonnement.</p>' +
                '</div>' +
                '<div class="admin-panel mt-4" id="activites-panel">' +
                    '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                        '<h2 class="h5 mb-0"><i class="fas fa-clock-rotate-left me-2"></i>Activités de tous les utilisateurs</h2>' +
                        '<span class="badge bg-secondary">' + activitesAffichees.length + ' / ' + activites.length + '</span>' +
                    '</div>' +
                    '<p class="text-muted small">Toutes les tentatives d\'exercices, tous comptes et tous espaces confondus, de la plus récente à la plus ancienne.</p>' +
                    (activitesAffichees.length
                        ? '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                            '<thead><tr><th>Utilisateur</th><th>Rôle</th><th>Espace</th><th>Classe</th><th>Exercice</th><th>Type</th><th>Score</th><th>Date</th></tr></thead>' +
                            '<tbody>' + lignesActivites + '</tbody>' +
                          '</table></div>'
                        : '<p class="text-muted mb-0">Aucune activité enregistrée pour le moment. Les tentatives des élèves apparaîtront ici.</p>') +
                '</div>' +
                '<div class="admin-panel mt-4" id="messages-panel">' +
                    '<h2 class="h5 mb-3"><i class="fas fa-inbox me-2"></i>Messages reçus (' + messages.length + ')</h2>' +
                    (messages.length
                        ? '<div class="list-group">' + messages.map(function (message) {
                            return '<div class="list-group-item">' +
                                '<div class="d-flex flex-wrap justify-content-between align-items-start gap-2">' +
                                    '<div>' +
                                        '<div class="fw-semibold">' + esc(message.sujet) + '</div>' +
                                        '<div class="small text-muted">' + esc(message.nom) + ' · ' +
                                            '<a href="mailto:' + esc(message.email) + '">' + esc(message.email) + '</a> · ' +
                                            new Date(message.date).toLocaleString('fr-FR') + '</div>' +
                                    '</div>' +
                                    '<button class="btn btn-sm btn-outline-danger" data-action="supprimer-message" data-id="' + esc(message.id) + '" title="Supprimer le message">' +
                                        '<i class="fas fa-trash"></i></button>' +
                                '</div>' +
                                '<p class="mb-0 mt-2 small" style="white-space:pre-line">' + esc(message.message) + '</p>' +
                            '</div>';
                        }).join('') + '</div>'
                        : '<p class="text-muted mb-0">Aucun message. Les visiteurs peuvent écrire depuis la page <a href="#/contact">Contact</a>.</p>') +
                '</div>' +
            '</div>',
            after: function (racine) {
                const zone = racine.querySelector('#super-message');
                const table = racine.querySelector('#table-comptes');

                function afficher(texte, type) {
                    zone.className = 'alert alert-' + type + ' py-2';
                    zone.textContent = texte;
                }

                auth.motDePasseParDefaut().then(function (parDefaut) {
                    if (!parDefaut) return;
                    const alerte = racine.querySelector('#super-alerte');
                    if (!alerte) return;
                    alerte.className = 'alert alert-danger';
                    alerte.innerHTML = '<i class="fas fa-triangle-exclamation me-1"></i>' +
                        '<strong>Mot de passe d\'amorçage encore actif.</strong> ' +
                        'Remplacez-le dans « Mes identifiants super-admin » ci-dessous pour protéger cet espace.';
                });

                const formIdentifiants = racine.querySelector('#form-identifiants');
                if (formIdentifiants) {
                    formIdentifiants.addEventListener('submit', async function (event) {
                        event.preventDefault();
                        const bouton = event.target.querySelector('button[type="submit"]');
                        bouton.disabled = true;
                        const resultat = await auth.mettreAJourIdentifiants(user.username, {
                            username: racine.querySelector('#super-username').value,
                            email: racine.querySelector('#super-email').value
                        });
                        bouton.disabled = false;
                        if (!resultat.ok) {
                            afficher(resultat.error, 'danger');
                            return;
                        }
                        toast('Identifiants mis à jour : ' + resultat.username);
                        router();
                    });
                }

                racine.querySelector('#form-mdp-super').addEventListener('submit', async function (event) {
                    event.preventDefault();
                    const resultat = await auth.changePassword(
                        user.username,
                        racine.querySelector('#super-mdp-actuel').value,
                        racine.querySelector('#super-mdp-nouveau').value
                    );
                    if (!resultat.ok) {
                        afficher(resultat.error, 'danger');
                        return;
                    }
                    afficher('Mot de passe modifié. Utilisez-le à votre prochaine connexion.', 'success');
                    event.target.reset();
                });

                const formCompte = racine.querySelector('#form-compte');
                if (formCompte) {
                    formCompte.addEventListener('submit', async function (event) {
                        event.preventDefault();
                        const bouton = event.target.querySelector('button[type="submit"]');
                        bouton.disabled = true;
                        const resultat = await auth.creerCompte({
                            username: racine.querySelector('#compte-username').value,
                            email: racine.querySelector('#compte-email').value,
                            password: racine.querySelector('#compte-password').value,
                            role: racine.querySelector('#compte-role').value
                        });
                        bouton.disabled = false;
                        if (!resultat.ok) {
                            afficher(resultat.error, 'danger');
                            return;
                        }
                        toast(resultat.avertissement || ('Compte créé : ' + (resultat.compte ? resultat.compte.username : 'ok')));
                        router();
                    });
                }

                table.addEventListener('change', async function (event) {
                    const select = event.target.closest('select[data-action="role"]');
                    if (!select) return;
                    select.disabled = true;
                    const resultat = await auth.setRole(select.dataset.username, select.value);
                    select.disabled = false;
                    if (!resultat.ok) {
                        afficher(resultat.error, 'danger');
                        select.value = select.dataset.role;
                        return;
                    }
                    toast('Rôle mis à jour pour ' + select.dataset.username + '.');
                    router();
                });

                table.addEventListener('click', async function (event) {
                    const bouton = event.target.closest('button[data-action]');
                    if (!bouton) return;
                    const username = bouton.dataset.username;

                    if (bouton.dataset.action === 'reinitialiser') {
                        if (!window.confirm('Effacer la progression de ' + username + ' ?')) return;
                        auth.clearProgress(username);
                        toast('Progression réinitialisée.');
                        router();
                    } else if (bouton.dataset.action === 'supprimer') {
                        if (!window.confirm('Supprimer définitivement le compte ' + username + ' ? Ses contenus et résultats seront perdus.')) return;
                        bouton.disabled = true;
                        const resultat = await auth.removeUser(username);
                        bouton.disabled = false;
                        if (!resultat.ok) {
                            afficher(resultat.error, 'danger');
                            return;
                        }
                        toast('Compte supprimé.');
                        router();
                    }
                });

                racine.querySelector('#export-comptes').addEventListener('click', function () {
                    const lignesCsv = [['Utilisateur', 'E-mail', 'Rôle', 'Espace', 'Classe', 'Tentatives', 'Moyenne']];
                    auth.users().forEach(function (compte) {
                        const infos = infosEspaceCompte(compte);
                        const tentatives = auth.attempts(compte.username);
                        const points = tentatives.reduce(function (acc, t) { return acc + t.score; }, 0);
                        const possibles = tentatives.reduce(function (acc, t) { return acc + t.total; }, 0);
                        lignesCsv.push([
                            compte.username,
                            compte.email,
                            LIBELLES_ROLES[compte.role] || compte.role,
                            infos.espace,
                            infos.classe,
                            tentatives.length,
                            possibles > 0 ? Math.round((points / possibles) * 100) + ' %' : ''
                        ]);
                    });
                    const csv = lignesCsv.map(function (ligne) {
                        return ligne.map(function (valeur) {
                            return '"' + String(valeur).replace(/"/g, '""') + '"';
                        }).join(';');
                    }).join('\r\n');
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                    const lien = document.createElement('a');
                    lien.href = URL.createObjectURL(blob);
                    lien.download = 'learnhub-comptes.csv';
                    document.body.appendChild(lien);
                    lien.click();
                    document.body.removeChild(lien);
                    URL.revokeObjectURL(lien.href);
                });

                const panneauMessages = racine.querySelector('#messages-panel');
                if (panneauMessages) {
                    panneauMessages.addEventListener('click', function (event) {
                        const bouton = event.target.closest('button[data-action="supprimer-message"]');
                        if (!bouton) return;
                        if (!window.confirm('Supprimer ce message ?')) return;
                        store.messages.remove(bouton.dataset.id);
                        toast('Message supprimé.');
                        router();
                    });
                }
            }
        };
    }

    const SECTIONS_ADMIN = [
        { slug: 'dashboard', titre: 'Tableau de bord', icone: 'fa-tachometer-alt' },
        { slug: 'classes', titre: 'Classes', icone: 'fa-users-rectangle' },
        { slug: 'lecons', titre: 'Leçons', icone: 'fa-book-open' },
        { slug: 'seances', titre: 'Séances', icone: 'fa-calendar-days' },
        { slug: 'exercices', titre: 'Exercices', icone: 'fa-tasks' },
        { slug: 'ressources', titre: 'Ressources', icone: 'fa-file-pdf' },
        { slug: 'bibliotheque', titre: 'Bibliothèque', icone: 'fa-book' },
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
                    '<p class="small text-muted">Connectez-vous avec un compte administrateur fourni par la plateforme.</p>' +
                    (auth.isSuperAdmin()
                        ? '<a class="btn btn-primary" href="#/superadmin">Ouvrir la super-administration</a>'
                        : '<a class="btn btn-primary" href="#/connexion?next=admin">Se connecter</a>') +
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
            case 'lecons': return vueLecons();
            case 'lecon': return vueLecon(segments[1]);
            case 'bibliotheque': return vueBibliotheque(parametres);
            case 'contact': return vueContact();
            case 'exercices': return vueExercices(parametres);
            case 'seances': return vueSeances();
            case 'recherche': return vueRecherche(parametres);
            case 'connexion': return vueConnexion(parametres);
            case 'profil': return vueProfil();
            case 'ia': return vueIA(parametres);
            case 'superadmin': return vueSuperAdmin();
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
        if (arreterCarrousel) {
            arreterCarrousel();
            arreterCarrousel = null;
        }
        const vue = choisirVue(segments, params);
        vueCourante = vue;

        app.innerHTML = vue.html;
        document.title = vue.titre + ' — LearnHub';
        majEntete(segments);
        actualiserPartage();

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
        actualiserPartage();
        brancherPartage();

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
        window.addEventListener('learnhub:backend-error', function (event) {
            toast('Synchronisation Supabase impossible : ' + event.detail, 'danger');
        });
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
