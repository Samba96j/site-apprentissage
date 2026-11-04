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
    const NOM_IA = 'YA FAMA AI';
    const DESCRIPTION_IA = 'Assistant pédagogique IA : étudiez une œuvre ou posez une question, LearnHub met le résultat en forme.';
    const BADGE_IA = '<span class="bg-primary text-white rounded-pill px-3 py-2 small fw-bold">IA</span>';

    /* --------------------------------- Utilitaires --------------------------------- */

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function initiales(nom) {
        const mots = String(nom || '?').trim().split(/\s+/).filter(Boolean);
        if (!mots.length) return '?';
        if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
        return (mots[0].charAt(0) + mots[mots.length - 1].charAt(0)).toUpperCase();
    }

    /** Teinte stable déduite du nom : deux comptes n'ont pas la même couleur. */
    function teinteAvatar(nom) {
        let hash = 0;
        const texte = String(nom || '');
        for (let i = 0; i < texte.length; i += 1) {
            hash = (hash * 31 + texte.charCodeAt(i)) % 360;
        }
        return hash;
    }

    function avatarHtml(nom, url, taille, classes) {
        const taillePx = taille || 40;
        const classe = 'avatar' + (classes ? ' ' + classes : '');
        const style = 'width:' + taillePx + 'px;height:' + taillePx + 'px;font-size:' + Math.round(taillePx * 0.38) + 'px';
        if (url) {
            return '<span class="' + classe + '">' +
                '<img src="' + esc(url) + '" alt="Photo de ' + esc(nom) + '" style="' + style + '" loading="lazy">' +
            '</span>';
        }
        const teinte = teinteAvatar(nom);
        const teinte2 = (teinte + 45) % 360;
        return '<span class="' + classe + ' avatar-initiales" aria-hidden="true" style="' + style +
            ';background:linear-gradient(135deg,hsl(' + teinte + ',64%,55%),hsl(' + teinte2 + ',68%,38%))">' +
            esc(initiales(nom)) +
        '</span>';
    }

    /** Recadre et compresse l'image choisie (carré 384 px, JPEG). */
    function preparerAvatar(fichier) {
        return new Promise(function (resolve, reject) {
            const lecteur = new FileReader();
            lecteur.onerror = reject;
            lecteur.onload = function () {
                const image = new Image();
                image.onerror = reject;
                image.onload = function () {
                    const cote = Math.min(image.width, image.height);
                    const cible = 384;
                    const toile = document.createElement('canvas');
                    toile.width = cible;
                    toile.height = cible;
                    const contexte = toile.getContext('2d');
                    contexte.fillStyle = '#ffffff';
                    contexte.fillRect(0, 0, cible, cible);
                    contexte.drawImage(
                        image,
                        (image.width - cote) / 2, (image.height - cote) / 2, cote, cote,
                        0, 0, cible, cible
                    );
                    const dataUrl = toile.toDataURL('image/jpeg', 0.86);
                    toile.toBlob(function (blob) {
                        resolve({ blob: blob, dataUrl: dataUrl, nom: fichier.name });
                    }, 'image/jpeg', 0.86);
                };
                image.src = lecteur.result;
            };
            lecteur.readAsDataURL(fichier);
        });
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
        // MODIFICATION ICI : remplacement de 'sticky-top' par 'fixed-top'
        return '<nav class="navbar navbar-expand-lg navbar-dark bg-edu fixed-top shadow-sm">' +
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
                                '<li><a class="dropdown-item" href="#/ressources"><i class="fas fa-folder-open me-2"></i>Ressources</a></li>' +
                                '<li><a class="dropdown-item" href="#/bibliotheque"><i class="fas fa-book me-2"></i>Bibliothèque</a></li>' +
                                '<li><a class="dropdown-item" href="#/exercices"><i class="fas fa-gamepad me-2"></i>Exercices</a></li>' +
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

    const TEXTE_PARTAGE = '📚 LearnHub : cours, exercices interactifs et bibliothèque gratuits — avec YA FAMA AI ✨, ' +
        'l\'assistant IA qui prépare une fiche complète sur n\'importe quelle œuvre en quelques secondes. Sans publicité.';
    const SUJET_PARTAGE = 'YA FAMA AI t\'attend sur LearnHub ✨';
    const CORPS_PARTAGE = [
        'Salut,',
        '',
        'Je te partage LearnHub : cours, exercices interactifs et bibliothèque numérique du collège au supérieur, gratuit et sans publicité.',
        '',
        'La nouveauté : YA FAMA AI ✨, un assistant IA qui prépare une fiche complète sur n\'importe quelle œuvre — résumé, contexte, personnages, thèmes, procédés, citations et questions d\'entraînement — en quelques secondes.',
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
                navigator.share({ title: 'LearnHub — cours, exercices et YA FAMA AI', text: TEXTE_PARTAGE, url: urlPartage() }).catch(function () {});
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
                            '<li><a href="#/ressources">Ressources</a></li>' +
                            '<li><a href="#/bibliotheque">Bibliothèque</a></li>' +
                            '<li><a href="#/exercices">Exercices</a></li>' +
                            '<li><a href="#/ia">' + NOM_IA + '</a></li>' +
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
        return htmlClocheDevoirs(user) +
            '<div class="dropdown">' +
            '<button class="btn btn-outline-light btn-sm dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
                avatarHtml(user.username, user.avatarUrl, 26) +
                '<span class="d-none d-sm-inline">' + esc(user.username) + '</span>' +
            '</button>' +
            '<ul class="dropdown-menu dropdown-menu-end">' +
                '<li><a class="dropdown-item" href="#/profil"><i class="fas fa-chart-line me-2"></i>Ma progression</a></li>' +
                '<li><a class="dropdown-item" href="#/lecons"><i class="fas fa-book-open me-2"></i>Mes leçons</a></li>' +
                '<li><a class="dropdown-item" href="#/ia"><i class="fas fa-wand-magic-sparkles me-2"></i>' + NOM_IA + '</a></li>' +
                (user.role === 'admin' ? '<li><a class="dropdown-item" href="#/admin"><i class="fas fa-user-cog me-2"></i>Administration</a></li>' : '') +
                (user.role === 'superadmin' ? '<li><a class="dropdown-item" href="#/superadmin"><i class="fas fa-shield-halved me-2"></i>Super-administration</a></li>' : '') +
                '<li><hr class="dropdown-divider"></li>' +
                '<li><button class="dropdown-item" type="button" id="bouton-deconnexion"><i class="fas fa-sign-out-alt me-2"></i>Se déconnecter</button></li>' +
            '</ul>' +
        '</div>';
    }

    const SECTIONS_APPRENDRE = ['lecons', 'lecon', 'ressources', 'bibliotheque', 'exercices'];

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
        const fondateur = data.fondateur || data.developpeur;
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
                '<section class="py-5 fondateur-section">' +
                    '<div class="container">' +
                        '<div class="row g-5 align-items-center">' +
                            '<div class="col-lg-5 text-center">' +
                                '<figure class="fondateur-portrait" data-reveal="left">' +
                                    '<span class="fondateur-halo" aria-hidden="true"></span>' +
                                    '<img src="' + esc(fondateur.photo) + '" alt="Portrait de ' + esc(fondateur.nom) + ', ' + esc(fondateur.fonction) + '" width="420" height="557" loading="lazy">' +
                                    '<figcaption class="fondateur-legende">' +
                                        '<strong>' + esc(fondateur.nom) + '</strong>' +
                                        '<span>' + esc(fondateur.fonction || fondateur.titre) + '</span>' +
                                        (fondateur.titre ? '<small>' + esc(fondateur.titre) + '</small>' : '') +
                                    '</figcaption>' +
                                '</figure>' +
                            '</div>' +
                            '<div class="col-lg-7">' +
                                '<p class="fondateur-surtitre" data-reveal><i class="fas fa-quote-left me-2"></i>Le mot du fondateur</p>' +
                                '<h2 class="fondateur-citation" data-reveal>« ' + esc(fondateur.citation) + ' »</h2>' +
                                '<p class="fondateur-intro" data-reveal>' + esc(fondateur.introduction) + '</p>' +
                                '<div class="row g-3 mt-4">' +
                                    fondateur.messages.map(function (item, index) {
                                        return '<div class="col-md-6" data-reveal style="--delai:' + (index * 90) + 'ms">' +
                                            '<div class="fondateur-message h-100">' +
                                                '<span class="fondateur-message-icone"><i class="fas ' + esc(item.icone) + '"></i></span>' +
                                                '<h3 class="h6 mb-1">' + esc(item.titre) + '</h3>' +
                                                '<p class="small text-muted mb-0">' + esc(item.texte) + '</p>' +
                                            '</div>' +
                                        '</div>';
                                    }).join('') +
                                '</div>' +
                                '<div class="d-flex flex-wrap gap-2 mt-4" data-reveal>' +
                                    '<a class="btn btn-primary" href="#/contact"><i class="fas fa-paper-plane me-1"></i>Écrire à l\'administrateur</a>' +
                                    '<a class="btn btn-outline-primary" href="#/connexion?mode=inscription"><i class="fas fa-user-plus me-1"></i>Rejoindre LearnHub</a>' +
                                '</div>' +
                            '</div>' +
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
                demarrerRevelations(racine);
            }
        };
    }

    function demarrerRevelations(racine) {
        const cibles = racine.querySelectorAll('[data-reveal]');
        if (!cibles.length) return;
        const reduire = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (reduire || typeof IntersectionObserver === 'undefined') {
            Array.prototype.forEach.call(cibles, function (element) {
                element.classList.add('est-visible');
            });
            return;
        }
        const observateur = new IntersectionObserver(function (entrees) {
            entrees.forEach(function (entree) {
                if (!entree.isIntersecting) return;
                entree.target.classList.add('est-visible');
                observateur.unobserve(entree.target);
            });
        }, { threshold: 0.15 });
        Array.prototype.forEach.call(cibles, function (element) {
            observateur.observe(element);
        });
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

    function vueLecons() {
        const user = auth.current();
        const matiereClasse = auth.matiereClasse();
        const maClasse = auth.maClasse();
        const toutes = store.lecons.all().slice().sort(function (a, b) {
            return String(a.titre).localeCompare(String(b.titre));
        });

        function cibleMaClasse(lecon) {
            return !!maClasse && (lecon.classeIds || []).indexOf(maClasse.id) >= 0;
        }

        function cartesDe(liste) {
            return liste.map(function (lecon) {
                const matiere = data.getMatiere(lecon.matiere);
                const niveau = lecon.niveau ? data.getNiveau(lecon.niveau) : null;
                const pourMaClasse = cibleMaClasse(lecon) || (matiereClasse && lecon.matiere === matiereClasse);
                return '<div class="col-md-6 col-xl-4" data-lecon-matiere="' + esc(lecon.matiere || '') + '">' +
                    '<div class="content h-100 d-flex flex-column' + (pourMaClasse ? ' border border-primary border-opacity-25' : '') + '">' +
                        '<div class="livre-carte">' +
                            '<div class="livre-carte-couverture">' + couvertureLivre(lecon) + '</div>' +
                            '<div class="livre-carte-texte">' +
                                '<h2 class="h6 mb-1">' + esc(lecon.titre) + '</h2>' +
                                '<p class="text-muted small mb-1">' +
                                    (matiere ? esc(matiere.nom) + ' · ' : '') +
                                    (niveau ? esc(niveau.nom) : 'Tous niveaux') +
                                '</p>' +
                                '<p class="text-muted small mb-0">' +
                                    (lecon.supportNom
                                        ? '<i class="fas fa-file-lines me-1"></i>' + esc(lecon.supportNom)
                                        : '<i class="fas fa-file-lines me-1"></i>Cours de votre enseignant') +
                                    (pourMaClasse ? ' · <span class="text-primary">votre classe</span>' : '') +
                                '</p>' +
                            '</div>' +
                        '</div>' +
                        '<div class="mt-auto d-flex flex-wrap gap-2 pt-3">' +
                            (lecon.supportUrl
                                ? (estDocumentPdf(lecon)
                                    ? '<a class="btn btn-primary btn-sm" href="#/lecon/' + encodeURIComponent(lecon.id) + '/lire">' +
                                        '<i class="fas fa-book-open me-1"></i>Lire le livre</a>'
                                    : '<a class="btn btn-primary btn-sm" href="' + esc(lecon.supportUrl) + '" target="_blank" rel="noopener">' +
                                        '<i class="fas fa-book-open me-1"></i>Ouvrir le document</a>') +
                                  '<a class="btn btn-outline-secondary btn-sm" href="' + esc(lecon.supportUrl) + '" download="' + esc(lecon.supportNom || lecon.titre) + '" title="Télécharger">' +
                                    '<i class="fas fa-download"></i></a>'
                                : '<span class="badge bg-secondary bg-opacity-25 text-dark align-self-center">Document bientôt disponible</span>') +
                            '<a class="btn btn-outline-primary btn-sm" href="#/lecon/' + encodeURIComponent(lecon.id) + '">' +
                                '<i class="fas fa-circle-info"></i></a>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        const lecons = matiereClasse
            ? toutes.filter(function (lecon) {
                return lecon.matiere === matiereClasse || cibleMaClasse(lecon);
            })
            : toutes;

        const cartes = cartesDe(lecons);

        return {
            titre: 'Leçons',
            html: '<div class="container py-4">' +
                '<div class="mb-4">' +
                    '<h1 class="h3 mb-1">Leçons</h1>' +
                    '<p class="text-muted mb-0">Les documents de cours déposés par votre enseignant et les ressources du programme.</p>' +
                '</div>' +
                (matiereClasse
                    ? '<div class="alert alert-primary py-2 small"><i class="fas fa-filter me-1"></i>' +
                        'Votre classe travaille une seule matière : seules les leçons de <strong>' +
                        esc((data.getMatiere(matiereClasse) || {}).nom || matiereClasse) +
                        '</strong> sont proposées.</div>'
                    : '') +
                (lecons.length
                    ? '<div class="row g-3" id="lecons-liste">' + cartes + '</div>'
                    : '<div class="content text-muted">' +
                        '<i class="fas fa-book-open me-2"></i>' +
                        (matiereClasse
                            ? 'Aucun cours de ' + esc((data.getMatiere(matiereClasse) || {}).nom || matiereClasse) + ' pour le moment.'
                            : 'Aucun cours disponible pour le moment.') +
                        '<div class="small mt-2">' +
                            (user && !maClasse
                                ? 'Rejoignez une classe depuis <a href="#/profil">Ma progression</a> pour accéder aux cours de votre enseignant.'
                                : 'Votre enseignant peut en ajouter depuis l\'onglet « Leçons » de son espace. ' +
                                  'Si un cours vient d\'être publié, rechargez la page (Ctrl + F5).') +
                        '</div>' +
                      '</div>') +
            '</div>'
        };
    }

    function couvertureLivre(lecon, options) {
        const reglages = options || {};
        const matiere = data.getMatiere(lecon.matiere);
        const niveau = lecon.niveau ? data.getNiveau(lecon.niveau) : null;
        const classes = (lecon.classeIds || []).map(function (id) {
            const classe = store.classes.get(id);
            return classe ? classe.nom : '';
        }).filter(Boolean);
        const badgeMatiere = matiere
            ? '<span class="livre-couverture-matiere">' + esc(matiere.nom) + '</span>'
            : '';
        const image = lecon.couvertureUrl
            ? '<img class="livre-couverture-image" src="' + esc(lecon.couvertureUrl) + '" alt="Couverture de ' + esc(lecon.titre) + '" loading="lazy">'
            : '';
        return '<div class="livre-couverture' + (lecon.couvertureUrl ? ' avec-image' : '') +
                (reglages.grande ? ' livre-couverture-grande' : '') + '">' +
            image +
            '<div class="livre-couverture-texte">' +
                '<span class="livre-couverture-marque"><i class="fas fa-graduation-cap me-1"></i>LearnHub</span>' +
                badgeMatiere +
                '<strong class="livre-couverture-titre">' + esc(lecon.titre) + '</strong>' +
                '<span class="livre-couverture-meta">' +
                    (niveau ? esc(niveau.nom) : 'Tous niveaux') +
                    (classes.length ? ' · ' + esc(classes.join(', ')) : '') +
                '</span>' +
                '<span class="livre-couverture-pied"><i class="fas fa-file-pdf me-1"></i>Document de cours</span>' +
            '</div>' +
        '</div>';
    }

    function estDocumentPdf(lecon) {
        const url = String(lecon.supportUrl || '').split('?')[0];
        const nom = String(lecon.supportNom || '');
        return /\.pdf$/i.test(url) || /\.pdf$/i.test(nom);
    }

    function actionsDocument(lecon, taille) {
        if (!lecon.supportUrl) {
            return '<span class="badge bg-secondary bg-opacity-25 text-dark">' +
                '<i class="fas fa-hourglass-half me-1"></i>Document bientôt disponible</span>';
        }
        const suffixe = taille ? ' btn-' + taille : '';
        const estPdf = estDocumentPdf(lecon);
        const boutonLire = estPdf
            ? '<a class="btn btn-primary' + suffixe + '" href="#/lecon/' + encodeURIComponent(lecon.id) + '/lire">' +
                '<i class="fas fa-book-open me-1"></i>Lire le livre</a>'
            : '';
        return boutonLire +
            '<a class="btn ' + (estPdf ? 'btn-outline-primary' : 'btn-primary') + suffixe + '" href="' + esc(lecon.supportUrl) + '" target="_blank" rel="noopener">' +
                '<i class="fas fa-up-right-from-square me-1"></i>' + (estPdf ? 'Ouvrir dans un onglet' : 'Ouvrir le document') + '</a>' +
            '<a class="btn btn-outline-secondary' + suffixe + '" href="' + esc(lecon.supportUrl) + '" download="' + esc(lecon.supportNom || lecon.titre) + '">' +
                '<i class="fas fa-download me-1"></i>Télécharger</a>';
    }

    function carteCoursMini(lecon) {
        return '<a class="mes-cours-item" href="#/lecon/' + encodeURIComponent(lecon.id) + '">' +
            '<div class="mes-cours-cover">' + couvertureLivre(lecon) + '</div>' +
            '<div class="mes-cours-nom">' + esc(lecon.titre) + '</div>' +
        '</a>';
    }

    function vueLecon(id, mode) {
        const lecon = store.lecons.get(id);
        if (!lecon) return vueIntrouvable('Ce cours n\'existe pas ou n\'est pas accessible depuis votre espace.');

        if (mode === 'lire') {
            return {
                titre: 'Lire — ' + lecon.titre,
                html: '<div class="lecteur-conteneur"></div>',
                after: function (racine) {
                    const cible = racine.querySelector('.lecteur-conteneur');
                    if (cible && window.LearnHubLecteur) {
                        window.LearnHubLecteur.render(cible, lecon);
                    }
                }
            };
        }

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
                    '<div class="livre-presentation">' +
                        '<div class="livre-presentation-couverture">' + couvertureLivre(lecon, { grande: true }) + '</div>' +
                        '<div class="livre-presentation-texte">' +
                            '<h1 class="h3 mb-2">' + esc(lecon.titre) + '</h1>' +
                            '<p class="text-muted small mb-3">' +
                                (matiere ? '<span class="badge bg-primary bg-opacity-10 text-primary me-2">' + esc(matiere.nom) + '</span>' : '') +
                                (niveau ? esc(niveau.nom) : 'Tous niveaux') +
                            '</p>' +
                            (lecon.supportUrl
                                ? '<p class="mb-2"><i class="fas fa-file-lines me-1 text-primary"></i>' +
                                    esc(lecon.supportNom || 'Document de cours') +
                                    (lecon.supportTaille ? ' · ' + esc(lecon.supportTaille) : '') + '</p>'
                                : '') +
                            '<div class="d-flex flex-wrap gap-2 mb-3">' +
                                actionsDocument(lecon, 'sm') +
                            '</div>' +
                            '<p class="text-muted small mb-0">' +
                                (lecon.supportUrl
                                    ? (estDocumentPdf(lecon)
                                        ? 'Cliquez sur « Lire le livre » : les pages se tournent de gauche à droite, comme un vrai livre.'
                                        : 'Le document s\'ouvre dans un nouvel onglet : vous pouvez le lire et le télécharger.')
                                    : 'Votre enseignant n\'a pas encore joint le document de ce cours.') +
                            '</p>' +
                        '</div>' +
                    '</div>' +
                    '<hr>' +
                    '<div class="d-flex flex-wrap gap-2">' +
                        '<a class="btn btn-outline-secondary btn-sm" href="#/lecons"><i class="fas fa-arrow-left me-1"></i>Toutes les leçons</a>' +
                        '<a class="btn btn-outline-primary btn-sm" href="#/exercices"><i class="fas fa-gamepad me-1"></i>S\'entraîner</a>' +
                    '</div>' +
                '</article>' +
            '</div>'
        };
    }

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
                let page = 1;
                const TAILLE_PAGE = 9;

                function nomMatiere(slug) {
                    const m = data.getMatiere(slug);
                    if (m) return m.nom;
                    if (!slug) return 'Général';
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
                    const pages = Math.max(1, Math.ceil(resultats.length / TAILLE_PAGE));
                    if (page > pages) page = pages;
                    const debut = (page - 1) * TAILLE_PAGE;
                    const visibles = resultats.slice(debut, debut + TAILLE_PAGE);
                    liste.innerHTML = '<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">' +
                        visibles.map(carte).join('') + '</div>' +
                        window.LearnHubUI.pagination({
                            page: page,
                            taille: TAILLE_PAGE,
                            total: resultats.length,
                            libelle: 'document(s)'
                        }) +
                        note;
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
                    element.addEventListener('input', function () { page = 1; rafraichir(); });
                    element.addEventListener('change', function () { page = 1; rafraichir(); });
                });

                liste.addEventListener('click', function (event) {
                    const cible = window.LearnHubUI.pageCliquee(event);
                    if (!cible) return;
                    page = cible;
                    rafraichir();
                    const haut = liste.getBoundingClientRect().top + window.scrollY - 90;
                    window.scrollTo({ top: haut, behavior: 'smooth' });
                });
            }
        };
    }

    const ICONES_RESSOURCE = {
        'Fiche de lecture': 'fa-file-lines',
        'Corrigé': 'fa-circle-check',
        'Cours': 'fa-chalkboard-user',
        'Exercice': 'fa-pen-to-square',
        'Vidéo': 'fa-video',
        'Lien externe': 'fa-up-right-from-square'
    };

    function dateRessource(iso) {
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const MOTIF_YOUTUBE = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;

    function idYoutube(url) {
        const trouve = MOTIF_YOUTUBE.exec(String(url || ''));
        return trouve ? trouve[1] : '';
    }

    function vueRessources() {
        const user = auth.current();
        const espace = auth.espaceActif();
        const ressources = store.ressources.all().slice().sort(function (a, b) {
            return String(b.date || '').localeCompare(String(a.date || ''));
        });

        function carteRessource(ressource) {
            const url = String(ressource.url || '');
            const externe = /^https?:/i.test(url);
            const video = idYoutube(url);
            const icone = video ? 'fa-circle-play' : (ICONES_RESSOURCE[ressource.type] || 'fa-file');
            const date = dateRessource(ressource.date);

            const vignette = video
                ? '<div class="ratio ratio-16x9 lecteur-video mb-3">' +
                    '<button type="button" class="lecteur-video-vignette" data-video="' + esc(video) + '"' +
                        ' aria-label="Lire la vidéo ' + esc(ressource.titre) + '">' +
                        '<img src="https://i.ytimg.com/vi/' + esc(video) + '/hqdefault.jpg" alt="" loading="lazy">' +
                        '<span class="lecteur-video-play"><i class="fas fa-play"></i></span>' +
                    '</button>' +
                  '</div>'
                : '';

            const actions = video
                ? '<div class="mt-auto d-flex gap-2 carte-ressource-actions">' +
                    '<button class="btn btn-primary btn-sm" type="button" data-video="' + esc(video) + '">' +
                        '<i class="fas fa-circle-play me-1"></i>Regarder ici</button>' +
                    '<a class="btn btn-outline-secondary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener"' +
                        ' title="Ouvrir sur YouTube"><i class="fab fa-youtube"></i></a>' +
                  '</div>'
                : '<div class="mt-auto d-flex gap-2">' +
                    '<a class="btn btn-primary btn-sm" href="' + esc(url) + '"' +
                        (externe ? ' target="_blank" rel="noopener"' : '') + '>' +
                        '<i class="fas fa-eye me-1"></i>Ouvrir</a>' +
                    (externe
                        ? '<a class="btn btn-outline-secondary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener" download="' + esc(ressource.titre) + '" title="Télécharger">' +
                            '<i class="fas fa-download"></i></a>'
                        : '') +
                  '</div>';

            return '<div class="col-md-6 col-xl-4">' +
                '<div class="content h-100 d-flex flex-column carte-ressource">' +
                    '<div class="d-flex align-items-start gap-2 mb-2">' +
                        '<i class="fas ' + icone + ' fa-2x text-primary"></i>' +
                        '<div class="flex-grow-1">' +
                            '<h2 class="h6 mb-1">' + esc(ressource.titre) + '</h2>' +
                            '<p class="text-muted small mb-0">' + esc(ressource.type || 'Ressource') + '</p>' +
                        '</div>' +
                    '</div>' +
                    vignette +
                    '<div class="d-flex flex-wrap gap-1 mb-3">' +
                        (ressource.taille ? '<span class="badge text-bg-light border">' + esc(ressource.taille) + '</span>' : '') +
                        (date ? '<span class="badge text-bg-light border"><i class="fas fa-calendar-day me-1"></i>' + esc(date) + '</span>' : '') +
                    '</div>' +
                    actions +
                '</div>' +
            '</div>';
        }

        let contenu;
        if (!user) {
            contenu = '<div class="content text-center py-5">' +
                '<i class="fas fa-lock fa-3x text-primary mb-3"></i>' +
                '<h2 class="h5">Ressources réservées aux élèves</h2>' +
                '<p class="text-muted">Connectez-vous avec votre compte élève pour voir les documents et liens partagés par votre enseignant.</p>' +
                '<a class="btn btn-primary" href="#/connexion?next=ressources">Se connecter</a>' +
                '<p class="small text-muted mt-3 mb-0">Pas encore de compte ? ' +
                    '<a href="#/connexion?mode=inscription">Créez-en un gratuitement</a>.</p>' +
              '</div>';
        } else if (!ressources.length) {
            contenu = '<div class="content text-muted">' +
                '<i class="fas fa-folder-open me-2"></i>' +
                (espace
                    ? 'Aucune ressource partagée pour le moment. Votre enseignant peut en ajouter depuis l\'onglet « Ressources » de son espace.'
                    : 'Rejoignez une classe depuis <a href="#/profil">Ma progression</a> pour accéder aux ressources de votre enseignant.') +
              '</div>';
        } else {
            contenu = '<div class="row g-3">' + ressources.map(carteRessource).join('') + '</div>';
        }

        return {
            titre: 'Ressources',
            html: '<div class="container py-4">' +
                '<div class="mb-4">' +
                    '<h1 class="h3 mb-1"><i class="fas fa-folder-open me-2"></i>Ressources</h1>' +
                    '<p class="text-muted mb-0">Fiches, corrigés, cours, vidéos et liens partagés par votre enseignant.</p>' +
                '</div>' +
                    '<div id="ressources-contenu">' + contenu + '</div>' +
            '</div>',
            after: function (racine) {
                    const zoneVue = racine.querySelector('#ressources-contenu');
                    if (!zoneVue) return;
                    zoneVue.addEventListener('click', function (event) {
                    const declencheur = event.target.closest ? event.target.closest('[data-video]') : null;
                    if (!declencheur) return;
                    const carte = declencheur.closest('.carte-ressource');
                    const zone = carte ? carte.querySelector('.lecteur-video') : null;
                    if (!zone || zone.querySelector('iframe')) return;
                    event.preventDefault();
                    const video = String(declencheur.dataset.video || '');
                    if (!/^[A-Za-z0-9_-]{6,}$/.test(video)) return;
                    zone.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + video +
                        '?autoplay=1&rel=0" title="Lecteur vidéo" loading="lazy"' +
                        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' +
                        ' referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
                    const bouton = carte.querySelector('.carte-ressource-actions button[data-video]');
                    if (bouton) bouton.remove();
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

    const JOUR_MS = 24 * 60 * 60 * 1000;

    function devoirsVisibles(user) {
        if (!user) return [];
        return store.exercices.devoirs().slice().sort(function (a, b) {
            return String(a.echeance || '9999-12-31').localeCompare(String(b.echeance || '9999-12-31'));
        });
    }

    function etatDevoir(exercice, username) {
        const tentatives = username
            ? auth.attempts(username).filter(function (t) { return t.exerciceId === exercice.id; })
            : [];
        if (tentatives.length) {
            const meilleur = tentatives.reduce(function (acc, t) {
                return Math.max(acc, t.total > 0 ? Math.round((t.score / t.total) * 100) : 0);
            }, 0);
            return { fait: true, retard: false, pourcentage: meilleur, essais: tentatives.length };
        }
        if (!exercice.echeance) return { fait: false, retard: false, jours: null };
        const limite = new Date(String(exercice.echeance) + 'T23:59:59');
        if (isNaN(limite.getTime())) return { fait: false, retard: false, jours: null };
        const jours = Math.ceil((limite.getTime() - Date.now()) / JOUR_MS);
        return { fait: false, retard: jours < 0, jours: jours };
    }

    function dateEcheance(valeur) {
        const trouve = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur || ''));
        if (!trouve) return dateRessource(valeur);
        return trouve[3] + '/' + trouve[2] + '/' + trouve[1];
    }

    function libelleEcheance(exercice, etat) {
        if (!exercice.echeance) return 'Sans date limite';
        const date = dateEcheance(exercice.echeance);
        if (etat.fait) return 'Rendu — échéance du ' + date;
        if (etat.retard) return 'En retard depuis le ' + date;
        if (etat.jours === 0) return 'À rendre aujourd\'hui';
        if (etat.jours === 1) return 'À rendre demain';
        return 'À rendre avant le ' + date;
    }

    function pastilleEtatDevoir(etat) {
        if (etat.fait) return '<span class="devoir-pastille devoir-pastille-fait"><i class="fas fa-circle-check me-1"></i>Rendu</span>';
        if (etat.retard) return '<span class="devoir-pastille devoir-pastille-retard"><i class="fas fa-triangle-exclamation me-1"></i>En retard</span>';
        return '<span class="devoir-pastille devoir-pastille-a-faire"><i class="fas fa-hourglass-half me-1"></i>À faire</span>';
    }

    function devoirsEnAttente(user) {
        if (!user || user.role !== 'eleve') return [];
        return devoirsVisibles(user).filter(function (exercice) {
            return !etatDevoir(exercice, user.username).fait;
        });
    }

    function htmlClocheDevoirs(user) {
        const devoirs = devoirsEnAttente(user);
        if (!devoirs.length) return '';
        const apercu = devoirs.slice(0, 4).map(function (exercice) {
            const etat = etatDevoir(exercice, user.username);
            const matiere = data.getMatiere(exercice.matiere);
            return '<li><a class="dropdown-item devoir-notif" href="#/exercices?exo=' + encodeURIComponent(exercice.id) + '">' +
                '<span class="devoir-notif-titre">' + esc(exercice.titre) + '</span>' +
                '<span class="devoir-notif-detail">' + esc(matiere ? matiere.nom : exercice.matiere) +
                    ' · ' + esc(libelleEcheance(exercice, etat)) + '</span>' +
            '</a></li>';
        }).join('');
        return '<div class="dropdown me-2">' +
            '<button class="btn btn-outline-light btn-sm position-relative" type="button" data-bs-toggle="dropdown" aria-expanded="false" ' +
                'aria-label="' + devoirs.length + ' devoir(s) à faire" title="Devoirs à faire">' +
                '<i class="fas fa-bell"></i>' +
                '<span class="cloche-pastille">' + devoirs.length + '</span>' +
            '</button>' +
            '<ul class="dropdown-menu dropdown-menu-end devoirs-menu">' +
                '<li><p class="dropdown-header mb-1">Devoirs à faire</p></li>' +
                apercu +
                (devoirs.length > 4 ? '<li><span class="dropdown-item-text small text-muted">' + (devoirs.length - 4) + ' autre(s) devoir(s)…</span></li>' : '') +
                '<li><hr class="dropdown-divider"></li>' +
                '<li><a class="dropdown-item text-center fw-semibold" href="#/exercices">Voir mes devoirs</a></li>' +
            '</ul>' +
        '</div>';
    }

    function vueExercices(parametres) {
        const user = auth.current();
        const exoCible = parametres ? parametres.get('exo') : null;
        const matiereClasse = auth.matiereClasse();
        const matiereNom = matiereClasse ? (data.getMatiere(matiereClasse) || {}).nom : null;
        const maClasse = auth.maClasse();
        const tous = store.exercices.actifs().filter(function (ex) {
            return !matiereClasse || ex.matiere === matiereClasse ||
                (ex.devoir === true && !!maClasse && (ex.classeIds || []).indexOf(maClasse.id) >= 0);
        });
        const actifs = exoCible
            ? tous.filter(function (ex) { return ex.id === exoCible; })
            : tous;
        const mesDevoirs = user && user.role === 'eleve' ? devoirsVisibles(user) : [];

        function carteDevoir(exercice) {
            const etat = etatDevoir(exercice, user.username);
            const matiere = data.getMatiere(exercice.matiere);
            const classes = (exercice.classeIds || []).map(function (id) {
                const classe = store.classes.get(id);
                return classe ? classe.nom : '';
            }).filter(Boolean);
            return '<div class="col-md-6 col-xl-4">' +
                '<article class="content h-100 d-flex flex-column devoir-carte' + (etat.retard ? ' devoir-carte-retard' : '') + '">' +
                    '<div class="d-flex justify-content-between align-items-start gap-2 mb-2">' +
                        '<span class="devoir-matiere"><i class="fas ' + esc(matiere ? matiere.icone : 'fa-book') + ' me-1"></i>' +
                            esc(matiere ? matiere.nom : exercice.matiere) + '</span>' +
                        pastilleEtatDevoir(etat) +
                    '</div>' +
                    '<h3 class="h6 mb-1">' + esc(exercice.titre) + '</h3>' +
                    (classes.length ? '<p class="small text-muted mb-2">' + esc(classes.join(' · ')) + '</p>' : '') +
                    (exercice.consigne ? '<p class="small mb-2">' + esc(exercice.consigne) + '</p>' : '') +
                    '<div class="d-flex flex-wrap gap-1 mb-3">' +
                        '<span class="badge text-bg-light border"><i class="fas fa-calendar-day me-1"></i>' +
                            esc(libelleEcheance(exercice, etat)) + '</span>' +
                        (etat.fait ? '<span class="badge text-bg-success">Meilleur score : ' + etat.pourcentage + ' %</span>' : '') +
                    '</div>' +
                    '<a class="btn ' + (etat.fait ? 'btn-outline-primary' : 'btn-primary') + ' btn-sm mt-auto align-self-start" href="#/exercices?exo=' + encodeURIComponent(exercice.id) + '">' +
                        '<i class="fas fa-play me-1"></i>' + (etat.fait ? 'Refaire le devoir' : 'Faire le devoir') +
                    '</a>' +
                '</article>' +
            '</div>';
        }

        const devoirsAFaire = mesDevoirs.filter(function (exercice) {
            return !etatDevoir(exercice, user ? user.username : null).fait;
        }).length;
        const blocDevoirs = (!exoCible && mesDevoirs.length)
            ? '<section class="devoirs-bloc mb-4" aria-labelledby="titre-devoirs">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">' +
                    '<h2 class="h5 mb-0" id="titre-devoirs"><i class="fas fa-clipboard-check me-2 text-warning"></i>Mes devoirs</h2>' +
                    (devoirsAFaire
                        ? '<span class="badge bg-warning text-dark">' + devoirsAFaire + ' à faire</span>'
                        : '<span class="badge bg-success">Tout est rendu</span>') +
                '</div>' +
                '<p class="text-muted small mb-3">Exercices donnés par votre enseignant à votre classe.</p>' +
                '<div class="row g-3">' + mesDevoirs.map(carteDevoir).join('') + '</div>' +
              '</section>'
            : '';

        const pastilles = (exoCible || matiereClasse) ? '' : ['<button class="btn btn-sm btn-primary" data-matiere="" aria-pressed="true"><i class="fas fa-layer-group me-1"></i>Toutes <span class="badge bg-light text-dark ms-1">' + actifs.length + '</span></button>']
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
                        '<p class="text-muted mb-0">' +
                            (matiereClasse
                                ? 'Quiz, associations et textes à trous — filtre par défaut : <strong>' + esc(matiereNom || matiereClasse) + '</strong>.'
                                : 'Quiz chronométrés, associations et textes à trous dans toutes les matières.') +
                        '</p>' +
                    '</div>' +
                    (user
                        ? '<a class="btn btn-outline-primary btn-sm" href="#/profil"><i class="fas fa-chart-line me-1"></i>Ma progression</a>'
                        : '<a class="btn btn-primary btn-sm" href="#/connexion">Se connecter pour enregistrer mes scores</a>') +
                '</div>' +
                (exoCible
                    ? '<div class="alert alert-info py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">' +
                        (mesDevoirs.some(function (exercice) { return exercice.id === exoCible; })
                            ? '<span><i class="fas fa-clipboard-check me-1"></i>Devoir sélectionné : rendez-le avant la date limite.</span>'
                            : '<span><i class="fas fa-book-open me-1"></i>Exercice choisi depuis une leçon.</span>') +
                        '<a class="alert-link" href="#/exercices">Voir tous les exercices</a></div>'
                    : '') +
                (matiereClasse && !exoCible
                    ? '<div class="alert alert-primary py-2 small"><i class="fas fa-filter me-1"></i>' +
                        'Votre classe travaille une seule matière : seuls les exercices de <strong>' +
                        esc(matiereNom || matiereClasse) + '</strong> sont proposés.</div>'
                    : '') +
                blocDevoirs +
                (pastilles ? '<div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filtrer les exercices par matière">' + pastilles + '</div>' : '') +
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
        const matiereClasse = classe && classe.matiere ? data.getMatiere(classe.matiere) : null;
        const niveauClasse = classe && classe.niveau ? data.getNiveau(classe.niveau) : null;
        const leconsClasse = classe
            ? store.lecons.all().filter(function (lecon) {
                const cibles = lecon.classeIds || [];
                return !cibles.length || cibles.indexOf(classe.id) >= 0;
            })
            : [];

        return {
            titre: 'Ma progression',
            html: '<div class="container py-4">' +
                '<div class="content mb-4">' +
                    '<div class="identite-entete">' +
                        avatarHtml(user.username, user.avatarUrl, 96, 'avatar-principal') +
                        '<div class="identite-texte">' +
                            '<h1 class="h3 mb-1">Bonjour ' + esc(user.username) + '</h1>' +
                            '<p class="text-muted mb-2">' +
                                (user.role === 'eleve'
                                    ? '<i class="fas fa-user-graduate me-1"></i>Élève'
                                    : '<i class="fas fa-chalkboard-user me-1"></i>Enseignant') +
                                (classe ? ' · <strong>' + esc(classe.nom) + '</strong>' : '') +
                            '</p>' +
                            '<div class="d-flex flex-wrap gap-2">' +
                                '<label class="btn btn-outline-primary btn-sm mb-0" for="champ-avatar"><i class="fas fa-camera me-1"></i>Changer ma photo</label>' +
                                '<input type="file" id="champ-avatar" accept="image/*" class="visually-hidden">' +
                                (user.avatarUrl ? '<button class="btn btn-outline-secondary btn-sm" id="retirer-avatar"><i class="fas fa-trash-can me-1"></i>Retirer</button>' : '') +
                            '</div>' +
                        '</div>' +
                        '<div class="identite-actions">' +
                            '<a class="btn btn-outline-primary btn-sm" href="#/ia"><i class="fas fa-wand-magic-sparkles me-1"></i>' + esc(NOM_IA) + '</a>' +
                            '<a class="btn btn-outline-primary btn-sm" href="#/exercices"><i class="fas fa-gamepad me-1"></i>S\'entraîner</a>' +
                            (tentatives.length ? '<button class="btn btn-outline-danger btn-sm" id="effacer-historique"><i class="fas fa-rotate-left me-1"></i>Effacer mon historique</button>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                (user.role === 'eleve'
                    ? '<div class="content mb-4">' +
                        '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                            '<h2 class="h5 mb-0"><i class="fas fa-users-rectangle me-2"></i>Ma classe</h2>' +
                            (classe ? '<button class="btn btn-outline-secondary btn-sm" id="quitter-classe"><i class="fas fa-right-from-bracket me-1"></i>Quitter la classe</button>' : '') +
                        '</div>' +
                        (classe
                            ? '<div class="classe-carte">' +
                                '<div class="classe-entete">' +
                                    '<div class="classe-icone"><i class="fas fa-chalkboard-user"></i></div>' +
                                    '<div class="classe-infos">' +
                                        '<h3 class="h5 mb-1">' + esc(classe.nom) + '</h3>' +
                                        '<div class="d-flex flex-wrap gap-2 mb-2">' +
                                            (matiereClasse ? '<span class="badge bg-primary bg-opacity-10 text-primary"><i class="fas ' + esc(matiereClasse.icone) + ' me-1"></i>' + esc(matiereClasse.nom) + '</span>' : '') +
                                            (niveauClasse ? '<span class="badge bg-secondary bg-opacity-10 text-dark">' + esc(niveauClasse.nom) + '</span>' : '') +
                                            (classe.code ? '<span class="badge bg-light text-dark border"><i class="fas fa-key me-1"></i>' + esc(classe.code) + '</span>' : '') +
                                        '</div>' +
                                        '<p class="text-muted small mb-0">' +
                                            (leconsClasse.length
                                                ? leconsClasse.length + ' cours dans votre espace — ouvrez-en un pour apprendre.'
                                                : 'Votre enseignant n\'a pas encore publié de cours. Revenez bientôt.') +
                                        '</p>' +
                                    '</div>' +
                                '</div>' +
                                (leconsClasse.length
                                    ? '<div class="mes-cours">' +
                                        '<h4 class="h6 mb-2"><i class="fas fa-book-open me-1"></i>Mes cours</h4>' +
                                        '<div class="mes-cours-liste">' +
                                            leconsClasse.slice().sort(function (a, b) {
                                                return String(a.titre).localeCompare(String(b.titre));
                                            }).map(carteCoursMini).join('') +
                                        '</div>' +
                                      '</div>'
                                    : '') +
                              '</div>'
                            : '<div class="classe-join text-center">' +
                                '<i class="fas fa-door-open fa-3x text-primary mb-3"></i>' +
                                '<h3 class="h5">Vous n\'êtes rattaché à aucune classe</h3>' +
                                '<p class="text-muted small mb-3">Saisissez le code fourni par votre enseignant pour accéder à ses cours et exercices.</p>' +
                                '<form class="row g-2 align-items-end justify-content-center" id="form-classe">' +
                                    '<div class="col-sm-6 col-md-4"><label class="form-label" for="code-classe">Code de la classe</label>' +
                                        '<input class="form-control text-uppercase" id="code-classe" maxlength="10" placeholder="ex. AB12CD" autocomplete="off"></div>' +
                                    '<div class="col-sm-auto"><button class="btn btn-primary" type="submit"><i class="fas fa-right-to-bracket me-1"></i>Rejoindre la classe</button></div>' +
                                '</form>' +
                              '</div>') +
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

                const champAvatar = racine.querySelector('#champ-avatar');
                if (champAvatar) {
                    champAvatar.addEventListener('change', async function () {
                        const fichier = champAvatar.files && champAvatar.files[0];
                        if (!fichier) return;
                        if (fichier.size > 8 * 1024 * 1024) {
                            toast('Image trop lourde : 8 Mo maximum.', 'danger');
                            return;
                        }
                        try {
                            const prepare = await preparerAvatar(fichier);
                            const resultat = await auth.changerAvatar(prepare);
                            if (!resultat.ok) {
                                toast(resultat.error || 'Enregistrement impossible.', 'danger');
                                return;
                            }
                            toast('Photo de profil mise à jour.');
                            router();
                        } catch (erreur) {
                            toast('Image illisible. Essayez un autre fichier.', 'danger');
                        } finally {
                            champAvatar.value = '';
                        }
                    });
                }

                const retirerAvatar = racine.querySelector('#retirer-avatar');
                if (retirerAvatar) {
                    retirerAvatar.addEventListener('click', async function () {
                        if (!window.confirm('Retirer votre photo de profil ?')) return;
                        const resultat = await auth.effacerAvatar();
                        if (!resultat.ok) {
                            toast(resultat.error || 'Suppression impossible.', 'danger');
                            return;
                        }
                        toast('Photo retirée.');
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
                        if (!window.confirm('Quitter votre classe ? Vous n\'aurez plus accès à ses livres de cours.')) return;
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

    function carteStat(couleur, icone, titre, valeur) {
        return '<div class="col-6 col-lg-3">' +
            '<div class="stat-card h-100">' +
                '<div class="stat-icone ' + couleur + '"><i class="fas ' + icone + '"></i></div>' +
                '<div class="stat-valeur">' + valeur + '</div>' +
                '<div class="stat-label">' + esc(titre) + '</div>' +
            '</div>' +
        '</div>';
    }

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

    function htmlQuizIA(contenu) {
        const c = contenu || {};
        const questions = Array.isArray(c.questions) ? c.questions : [];
        return '<article>' +
            '<h2 class="h3 mb-4">' + esc(c.titre || 'Quiz interactif') + '</h2>' +
            (questions.length
                ? '<div class="vstack gap-4">' + questions.map(function (question, index) {
                    const choix = Array.isArray(question.choix) ? question.choix : [];
                    return '<fieldset class="border rounded-3 p-3" data-quiz-question="' + index + '">' +
                        '<legend class="h6">' + (index + 1) + '. ' + esc(question.question || '') + '</legend>' +
                        choix.map(function (option, optionIndex) {
                            return '<label class="d-block py-1"><input class="form-check-input me-2" type="radio" name="ia-quiz-' +
                                index + '" value="' + optionIndex + '"> ' + esc(option) + '</label>';
                        }).join('') +
                        '<p class="small mt-2 mb-0 d-none" data-quiz-explication>' +
                            esc(question.explication || '') + '</p>' +
                    '</fieldset>';
                }).join('') + '</div>' +
                '<button class="btn btn-primary mt-3" type="button" data-quiz-action="verifier">Vérifier mes réponses</button>' +
                '<button class="btn btn-outline-primary mt-3 ms-sm-2 d-none" type="button" data-quiz-action="recommencer">Recommencer</button>' +
                '<p class="fw-semibold mt-3 mb-0" data-quiz-score aria-live="polite"></p>'
                : '<div class="alert alert-warning">Aucune question exploitable n’a été générée. Réessayez.</div>') +
        '</article>';
    }

    function htmlFicheRevisionIA(contenu) {
        const c = contenu || {};
        const notions = Array.isArray(c.notions) ? c.notions : [];
        return '<article>' +
            '<h2 class="h3 mb-4">' + esc(c.titre || 'Fiche de révision') + '</h2>' +
            sectionsTexteIA('Idée générale', 'fa-lightbulb', c.ideeGenerale) +
            sectionsListeIA('L’essentiel à retenir', 'fa-bookmark', c.essentiels) +
            (notions.length
                ? '<div class="mb-4"><h3 class="h5 text-primary mb-2"><i class="fas fa-list-check me-2"></i>Notions clés</h3>' +
                    '<dl class="row">' + notions.map(function (notion) {
                        return '<dt class="col-md-3">' + esc(notion.titre || '') + '</dt>' +
                            '<dd class="col-md-9">' + esc(notion.definition || '') + '</dd>';
                    }).join('') + '</dl></div>'
                : '') +
            sectionsListeIA('Méthode', 'fa-list-ol', c.methode) +
            sectionsListeIA('Pour s’auto-évaluer', 'fa-circle-question', c.autoEvaluation) +
        '</article>';
    }

    function etoilesDeco(nombre) {
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
            etoilesDeco(18) +
            '<div class="ia-hero-contenu">' +
                '<div class="ia-hero-marque"><span class="ia-hero-mark-icon"><i class="fas fa-wand-magic-sparkles"></i></span>' +
                    '<span>TON ESPACE D’APPRENTISSAGE</span><span class="ia-hero-live"><i class="fas fa-circle"></i>Assistant IA</span>' +
                '</div>' +
                '<div class="ia-hero-layout"><div class="ia-hero-copy">' +
                    '<p class="ia-hero-kicker">Apprendre devient plus simple</p>' +
                    '<h1 class="ia-hero-titre">' + esc(NOM_IA) + '</h1>' +
                    '<p class="ia-hero-soustitre">' + esc(sousTitre) + '</p>' +
                '</div><div class="ia-hero-art" aria-hidden="true">' +
                    '<span class="ia-hero-art-ring ia-hero-art-ring-outer"></span>' +
                    '<span class="ia-hero-art-ring ia-hero-art-ring-inner"></span>' +
                    '<span class="ia-hero-art-core"><i class="fas fa-book-open"></i></span>' +
                    '<span class="ia-hero-art-spark ia-hero-art-spark-one"><i class="fas fa-star"></i></span>' +
                    '<span class="ia-hero-art-spark ia-hero-art-spark-two"><i class="fas fa-sparkles"></i></span>' +
                '</div></div>' +
                '<div class="ia-hero-promise"><span><i class="fas fa-check me-2"></i>Explications adaptées à ton niveau</span>' +
                    '<span><i class="fas fa-check me-2"></i>Contenus à retrouver dans ton historique</span></div>' +
            '</div>' +
        '</section>';
    }

    function vueIA(parametres) {
        const user = auth.current();
        if (!user) {
            return {
                titre: NOM_IA,
                html: '<div class="container py-4 ia-page ia-page-public">' +
                    heroIA('Une question, une œuvre ou un cours : transforme ton sujet en explication claire, fiche de révision ou quiz.') +
                    '<section class="ia-public-intro">' +
                        '<div class="ia-public-copy">' +
                            '<span class="ia-section-eyebrow">Prêt à progresser ?</span>' +
                            '<h2>Ton prochain déclic commence ici.</h2>' +
                            '<p>Choisis un sujet et YA FAMA AI t’aide à comprendre, mémoriser et t’entraîner. Connecte-toi pour lancer une génération et retrouver tes contenus.</p>' +
                            '<a class="btn btn-primary ia-primary-action" href="#/connexion?next=ia"><i class="fas fa-arrow-right me-2"></i>Commencer gratuitement</a>' +
                            '<p class="ia-public-note"><i class="fas fa-lock me-1"></i>Tes fiches restent liées à ton compte.</p>' +
                        '</div>' +
                        '<div class="ia-public-modes" aria-label="Les modes disponibles">' +
                            '<div class="ia-public-mode"><span class="ia-mode-icon ia-mode-icon-book"><i class="fas fa-book-open"></i></span><div><strong>Étude d’œuvre</strong><small>Résumé, thèmes et personnages</small></div></div>' +
                            '<div class="ia-public-mode"><span class="ia-mode-icon ia-mode-icon-search"><i class="fas fa-magnifying-glass"></i></span><div><strong>Recherche / question</strong><small>Une explication à ton niveau</small></div></div>' +
                            '<div class="ia-public-mode"><span class="ia-mode-icon ia-mode-icon-quiz"><i class="fas fa-circle-question"></i></span><div><strong>Quiz interactif</strong><small>Teste tes connaissances</small></div></div>' +
                            '<div class="ia-public-mode"><span class="ia-mode-icon ia-mode-icon-note"><i class="fas fa-file-lines"></i></span><div><strong>Fiche de révision</strong><small>Les notions à retenir</small></div></div>' +
                        '</div>' +
                    '</section>' +
                '</div>'
            };
        }

        const modesIA = ['etude', 'question', 'quiz', 'fiche'];
        const modeDemande = parametres && parametres.get('mode');
        const modeInitial = modesIA.indexOf(modeDemande) >= 0 ? modeDemande : 'etude';
        const optionsNiveaux = data.niveaux.map(function (niveau) {
            return '<option value="' + esc(niveau.slug) + '">' + esc(niveau.nom) + '</option>';
        }).join('');
        const optionsOeuvres = data.cours.map(function (cours) {
            return '<option value="' + esc(cours.titre) + '" data-auteur="' + esc(cours.auteur) + '">' +
                esc(cours.titre) + ' — ' + esc(cours.auteur) + '</option>';
        }).join('');

        return {
            titre: NOM_IA,
            html: '<div class="container py-4 ia-page">' +
                heroIA('Ton assistant de cours personnel : comprends mieux, révise plus vite et entraîne-toi.') +
                '<div class="ia-page-toolbar"><p class="ia-welcome-line"><span class="ia-welcome-dot"></span>Bonjour ' +
                    esc(user.username || 'et bienvenue') + ', on révise quoi aujourd’hui ?</p>' +
                    '<a class="btn btn-outline-primary btn-sm ia-progress-link" href="#/profil"><i class="fas fa-chart-line me-1"></i>Ma progression</a>' +
                '</div>' +
                '<div class="ia-workspace">' +
                    '<section class="ia-generator content" aria-label="Générer un contenu pédagogique">' +
                        '<div class="ia-generator-heading"><div><span class="ia-section-eyebrow">Studio de révision</span>' +
                            '<h2>Que veux-tu travailler ?</h2><p>Choisis un format, donne ton sujet et je prépare le contenu.</p></div>' +
                            '<span class="ia-generator-spark"><i class="fas fa-wand-magic-sparkles"></i></span></div>' +
                        '<div class="ia-modes" id="ia-onglets" role="tablist" aria-label="Format de génération">' +
                            '<button class="ia-mode-card ' + (modeInitial === 'etude' ? 'active' : '') + '" type="button" role="tab" aria-selected="' + (modeInitial === 'etude') + '" data-mode="etude"><span class="ia-mode-icon ia-mode-icon-book"><i class="fas fa-book-open"></i></span><span class="ia-mode-copy"><strong>Étude d’œuvre</strong><small>Analyse littéraire</small></span><i class="fas fa-chevron-right ia-mode-arrow"></i></button>' +
                            '<button class="ia-mode-card ' + (modeInitial === 'question' ? 'active' : '') + '" type="button" role="tab" aria-selected="' + (modeInitial === 'question') + '" data-mode="question"><span class="ia-mode-icon ia-mode-icon-search"><i class="fas fa-magnifying-glass"></i></span><span class="ia-mode-copy"><strong>Question</strong><small>Comprendre une notion</small></span><i class="fas fa-chevron-right ia-mode-arrow"></i></button>' +
                            '<button class="ia-mode-card ' + (modeInitial === 'quiz' ? 'active' : '') + '" type="button" role="tab" aria-selected="' + (modeInitial === 'quiz') + '" data-mode="quiz"><span class="ia-mode-icon ia-mode-icon-quiz"><i class="fas fa-circle-question"></i></span><span class="ia-mode-copy"><strong>Quiz interactif</strong><small>S’entraîner en jouant</small></span><i class="fas fa-chevron-right ia-mode-arrow"></i></button>' +
                            '<button class="ia-mode-card ' + (modeInitial === 'fiche' ? 'active' : '') + '" type="button" role="tab" aria-selected="' + (modeInitial === 'fiche') + '" data-mode="fiche"><span class="ia-mode-icon ia-mode-icon-note"><i class="fas fa-file-lines"></i></span><span class="ia-mode-copy"><strong>Fiche de révision</strong><small>Mémoriser l’essentiel</small></span><i class="fas fa-chevron-right ia-mode-arrow"></i></button>' +
                        '</div>' +
                        '<div class="ia-form-panel">' +
                    '<form id="form-etude" role="tabpanel" class="' + (modeInitial === 'etude' ? '' : 'd-none') + '">' +
                        '<div class="row g-3">' +
                            '<div class="col-md-6 ia-field">' +
                                '<label class="form-label" for="ia-oeuvre">Œuvre</label>' +
                                '<select class="form-select" id="ia-oeuvre">' +
                                    '<option value="">Choisir dans le programme…</option>' +
                                    optionsOeuvres +
                                    '<option value="autre">Autre œuvre…</option>' +
                                '</select>' +
                                '<input class="form-control mt-2 d-none" id="ia-oeuvre-autre" maxlength="120" placeholder="Titre de l\'œuvre">' +
                                '<div class="small mt-2 d-none" id="ia-lien-fiche"></div>' +
                            '</div>' +
                            '<div class="col-md-3 ia-field">' +
                                '<label class="form-label" for="ia-auteur">Auteur (optionnel)</label>' +
                                '<input class="form-control" id="ia-auteur" maxlength="80" placeholder="ex. Mariama Bâ">' +
                            '</div>' +
                            '<div class="col-md-3 ia-field">' +
                                '<label class="form-label" for="ia-niveau">Niveau</label>' +
                                '<select class="form-select" id="ia-niveau">' + optionsNiveaux + '</select>' +
                            '</div>' +
                            '<div class="col-12">' +
                                '<button class="btn btn-primary ia-generate-button" type="submit"><i class="fas fa-wand-magic-sparkles me-2"></i>Générer mon étude<span class="ia-button-arrow"><i class="fas fa-arrow-right"></i></span></button>' +
                            '</div>' +
                        '</div>' +
                    '</form>' +
                    '<form id="form-question" role="tabpanel" class="' + (modeInitial === 'question' ? '' : 'd-none') + '">' +
                        '<div class="row g-3">' +
                            '<div class="col-12">' +
                                '<label class="form-label" for="ia-question">La notion ou question qui te bloque</label>' +
                                '<textarea class="form-control ia-question-input" id="ia-question" rows="3" maxlength="500" placeholder="ex. Comment reconnaître une métaphore ?"></textarea>' +
                                '<div class="ia-field-footer"><span>Décris ce que tu veux comprendre.</span><span data-ia-counter="ia-question">0 / 500</span></div>' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-niveau-question">Niveau</label>' +
                                '<select class="form-select" id="ia-niveau-question">' + optionsNiveaux + '</select>' +
                            '</div>' +
                            '<div class="col-md-9 d-flex align-items-end">' +
                                '<button class="btn btn-primary ia-generate-button" type="submit"><i class="fas fa-wand-magic-sparkles me-2"></i>M’expliquer<span class="ia-button-arrow"><i class="fas fa-arrow-right"></i></span></button>' +
                            '</div>' +
                        '</div>' +
                    '</form>' +
                    '<form id="form-quiz" role="tabpanel" class="' + (modeInitial === 'quiz' ? '' : 'd-none') + '">' +
                        '<div class="row g-3">' +
                            '<div class="col-md-6">' +
                                '<label class="form-label" for="ia-sujet-quiz">Sujet à maîtriser</label>' +
                                '<input class="form-control" id="ia-sujet-quiz" maxlength="300" required placeholder="ex. Les figures de style">' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-niveau-quiz">Niveau</label>' +
                                '<select class="form-select" id="ia-niveau-quiz">' + optionsNiveaux + '</select>' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-nombre-quiz">Nombre de questions</label>' +
                                '<select class="form-select" id="ia-nombre-quiz">' +
                                    '<option value="3">3 questions</option><option value="5" selected>5 questions</option>' +
                                    '<option value="8">8 questions</option><option value="10">10 questions</option>' +
                                '</select>' +
                            '</div>' +
                            '<div class="col-12"><button class="btn btn-primary ia-generate-button" type="submit"><i class="fas fa-wand-magic-sparkles me-2"></i>Lancer mon quiz<span class="ia-button-arrow"><i class="fas fa-arrow-right"></i></span></button></div>' +
                        '</div>' +
                    '</form>' +
                    '<form id="form-fiche" role="tabpanel" class="' + (modeInitial === 'fiche' ? '' : 'd-none') + '">' +
                        '<div class="row g-3">' +
                            '<div class="col-md-6">' +
                                '<label class="form-label" for="ia-sujet-fiche">Matière ou notion</label>' +
                                '<input class="form-control" id="ia-sujet-fiche" maxlength="300" required placeholder="ex. La poésie engagée">' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-type-fiche">Type de fiche</label>' +
                                '<select class="form-select" id="ia-type-fiche">' +
                                    '<option value="synthèse">Synthèse</option><option value="notions clés">Notions clés</option>' +
                                    '<option value="méthode">Méthode</option>' +
                                '</select>' +
                            '</div>' +
                            '<div class="col-md-3">' +
                                '<label class="form-label" for="ia-niveau-fiche">Niveau</label>' +
                                '<select class="form-select" id="ia-niveau-fiche">' + optionsNiveaux + '</select>' +
                            '</div>' +
                            '<div class="col-12"><button class="btn btn-primary ia-generate-button" type="submit"><i class="fas fa-wand-magic-sparkles me-2"></i>Créer ma fiche<span class="ia-button-arrow"><i class="fas fa-arrow-right"></i></span></button></div>' +
                        '</div>' +
                    '</form>' +
                        '</div>' +
                        '<div class="ia-trust-note"><i class="fas fa-shield-halved"></i><span>Un contenu clair et personnalisé. Pense à comparer les informations avec ton cours.</span></div>' +
                    '</section>' +
                '</div>' +
                '<div id="ia-resultat" aria-live="polite" aria-atomic="true"></div>' +
                '<section class="ia-history content mt-4" id="ia-historique"></section>' +
            '</div>',
            after: function (racine) {
                const onglets = racine.querySelectorAll('#ia-onglets [data-mode]');
                const formEtude = racine.querySelector('#form-etude');
                const formQuestion = racine.querySelector('#form-question');
                const formQuiz = racine.querySelector('#form-quiz');
                const formFiche = racine.querySelector('#form-fiche');
                const formulaires = { etude: formEtude, question: formQuestion, quiz: formQuiz, fiche: formFiche };
                const zone = racine.querySelector('#ia-resultat');
                const historique = racine.querySelector('#ia-historique');
                const selectOeuvre = racine.querySelector('#ia-oeuvre');
                const oeuvreLibre = racine.querySelector('#ia-oeuvre-autre');
                let quizCourant = null;
                let elementQuizCourant = null;
                let generationEnCours = false;

                function activerMode(mode) {
                    onglets.forEach(function (bouton) {
                        bouton.classList.toggle('active', bouton.dataset.mode === mode);
                        bouton.setAttribute('aria-selected', String(bouton.dataset.mode === mode));
                    });
                    Object.keys(formulaires).forEach(function (cle) {
                        formulaires[cle].classList.toggle('d-none', cle !== mode);
                    });
                }

                onglets.forEach(function (bouton) {
                    bouton.addEventListener('click', function () { activerMode(bouton.dataset.mode); });
                    bouton.addEventListener('keydown', function (event) {
                        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                        event.preventDefault();
                        const pas = event.key === 'ArrowRight' ? 1 : -1;
                        const index = Array.prototype.indexOf.call(onglets, bouton);
                        const suivant = onglets[(index + pas + onglets.length) % onglets.length];
                        suivant.focus();
                        activerMode(suivant.dataset.mode);
                    });
                });

                function afficherChargement(texte) {
                    zone.innerHTML = '<section class="ia-loading-card" role="status">' +
                        '<span class="ia-loading-icon"><i class="fas fa-wand-magic-sparkles"></i></span>' +
                        '<span class="ia-loading-spinner"></span>' +
                        '<h2>' + esc(texte) + '</h2>' +
                        '<p>Je prépare une réponse claire et adaptée à ton niveau. Cela peut prendre quelques secondes.</p>' +
                        '<div class="ia-loading-track"><span></span></div>' +
                    '</section>';
                    zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                zone.addEventListener('click', function (event) {
                    const boutonRecommencer = event.target.closest('[data-quiz-action="recommencer"]');
                    if (boutonRecommencer) {
                        rendre(elementQuizCourant);
                        return;
                    }
                    const bouton = event.target.closest('[data-quiz-action="verifier"]');
                    if (!bouton || !quizCourant) return;
                    const nonRepondues = quizCourant.questions.reduce(function (liste, question, index) {
                        const groupe = zone.querySelector('[data-quiz-question="' + index + '"]');
                        if (!groupe || !groupe.querySelector('input[name="ia-quiz-' + index + '"]:checked')) liste.push(index + 1);
                        return liste;
                    }, []);
                    if (nonRepondues.length) {
                        toast('Réponds aux questions ' + nonRepondues.join(', ') + ' avant de vérifier ton score.', 'warning');
                        return;
                    }
                    let score = 0;
                    quizCourant.questions.forEach(function (question, index) {
                        const groupe = zone.querySelector('[data-quiz-question="' + index + '"]');
                        const selection = groupe.querySelector('input[name="ia-quiz-' + index + '"]:checked');
                        const juste = selection && Number(selection.value) === question.bonneReponse;
                        if (juste) score += 1;
                        groupe.classList.add(juste ? 'border-success' : 'border-danger');
                        const explication = groupe.querySelector('[data-quiz-explication]');
                        explication.classList.remove('d-none');
                        groupe.querySelectorAll('input[type="radio"]').forEach(function (reponse) {
                            reponse.disabled = true;
                        });
                        const retour = document.createElement('span');
                        retour.className = 'd-block small fw-semibold mt-2 ' + (juste ? 'text-success' : 'text-danger');
                        retour.textContent = juste ? 'Bonne réponse.' :
                            'Réponse attendue : ' + (question.choix[question.bonneReponse] || '');
                        explication.before(retour);
                    });
                    const resultat = zone.querySelector('[data-quiz-score]');
                    resultat.textContent = 'Votre score : ' + score + ' / ' + quizCourant.questions.length;
                    bouton.disabled = true;
                    zone.querySelector('[data-quiz-action="recommencer"]').classList.remove('d-none');
                });

                function afficherErreur(texte) {
                    zone.innerHTML = '<div class="alert alert-danger mb-0">' +
                        '<i class="fas fa-triangle-exclamation me-1"></i>' + esc(texte) + '</div>';
                }

                function rendre(item) {
                    if (!item || !item.contenu) return;
                    const corps = item.type === 'question'
                        ? htmlReponseIA(item.contenu)
                        : item.type === 'quiz'
                            ? htmlQuizIA(item.contenu)
                            : item.type === 'fiche'
                                ? htmlFicheRevisionIA(item.contenu)
                                : htmlEtudeIA(item.contenu);
                    quizCourant = item.type === 'quiz' ? item.contenu : null;
                    elementQuizCourant = item.type === 'quiz' ? item : null;
                    zone.innerHTML = '<section class="ia-result-card content">' +
                        '<div class="ia-result-heading"><span class="ia-result-label"><i class="fas fa-sparkles me-2"></i>TON CONTENU EST PRÊT</span>' +
                            '<span class="ia-result-type">' + esc(window.LearnHubIA.libelleType(item.type)) + '</span></div>' +
                        (item.demo
                            ? '<div class="alert alert-info small"><i class="fas fa-circle-info me-1"></i>' +
                              'Aucune génération IA réelle n’est configurée ici : ce résultat est un exemple de démonstration.</div>'
                            : '') +
                        corps +
                        '<p class="ia-result-meta"><i class="fas fa-clock me-2"></i>Généré le ' +
                            new Date(item.date).toLocaleString('fr-FR') +
                            (item.modele ? ' <span>·</span> ' + esc(item.modele) : '') + '</p>' +
                    '</section>';
                }

                async function rafraichirHistorique() {
                    const contenus = window.LearnHubIA.mesContenus();
                    if (!contenus.length) {
                        historique.innerHTML = '<div class="ia-history-heading"><div><span class="ia-section-eyebrow">Bibliothèque personnelle</span>' +
                            '<h2><i class="fas fa-clock-rotate-left me-2"></i>Mes contenus récents</h2></div><span class="ia-history-count">0 contenu</span></div>' +
                            '<div class="ia-history-empty"><span class="ia-history-empty-icon"><i class="fas fa-book-open"></i></span>' +
                                '<div><strong>Ton espace de révision t’attend.</strong><p>Les contenus que tu génères apparaîtront ici.</p></div></div>';
                        return;
                    }
                    historique.innerHTML = '<div class="ia-history-heading"><div><span class="ia-section-eyebrow">Bibliothèque personnelle</span>' +
                        '<h2><i class="fas fa-clock-rotate-left me-2"></i>Mes contenus récents</h2></div>' +
                        '<span class="ia-history-count">' + contenus.length + ' contenu' + (contenus.length > 1 ? 's' : '') + '</span></div>' +
                        '<div class="ia-history-list">' + contenus.map(function (item) {
                            return '<article class="ia-history-item">' +
                                '<span class="ia-history-item-icon"><i class="fas ' +
                                    (item.type === 'quiz' ? 'fa-circle-question' : item.type === 'fiche' ? 'fa-file-lines' : item.type === 'question' ? 'fa-magnifying-glass' : 'fa-book-open') +
                                    '"></i></span><div class="ia-history-item-copy">' +
                                    '<strong>' + esc(item.requete) + '</strong>' +
                                    '<small>' + esc(window.LearnHubIA.libelleType(item.type)) + ' · ' +
                                        new Date(item.date).toLocaleString('fr-FR') +
                                        (item.niveau ? ' · ' + esc(item.niveau) : '') +
                                    '</small>' +
                                '</div><div class="ia-history-actions">' +
                                    '<button class="btn btn-sm btn-outline-primary" data-action="ouvrir" data-id="' + esc(item.id) + '"><i class="fas fa-arrow-up-right-from-square me-1"></i>Ouvrir</button>' +
                                    '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-id="' + esc(item.id) + '" title="Supprimer" aria-label="Supprimer ' + esc(item.requete) + '"><i class="fas fa-trash"></i></button>' +
                                '</div></article>';
                        }).join('') + '</div>';
                }

                async function lancer(mode, parametres) {
                    if (generationEnCours) return;
                    generationEnCours = true;
                    const boutons = racine.querySelectorAll('form button[type="submit"]');
                    boutons.forEach(function (bouton) {
                        bouton.disabled = true;
                        bouton.setAttribute('aria-busy', 'true');
                    });
                    const chargements = {
                        etude: 'L\'IA rédige la fiche d’œuvre…',
                        question: 'L\'IA prépare la réponse…',
                        quiz: 'L\'IA prépare le quiz…',
                        fiche: 'L\'IA rédige la fiche de révision…'
                    };
                    afficherChargement(chargements[mode]);
                    try {
                        let resultat = await window.LearnHubIA.generer(parametres);
                        let demo = false;
                        if (!resultat.ok && (resultat.code === 'local' || resultat.code === 'non_configure')) {
                            demo = true;
                            resultat = { ok: true, contenu: window.LearnHubIA.exemple(mode, parametres), modele: '' };
                        }
                        if (!resultat.ok) {
                            afficherErreur(resultat.error || 'Génération impossible. Vérifie ta connexion et réessaie.');
                            return;
                        }

                        const item = {
                            type: mode,
                            requete: parametres.oeuvre || parametres.question || parametres.sujetQuiz || parametres.sujetFiche,
                            auteur: parametres.auteur || '',
                            niveau: parametres.niveau || '',
                            modele: resultat.modele || '',
                            contenu: resultat.contenu,
                            demo: demo,
                            date: new Date().toISOString()
                        };

                        if (!demo) {
                            const enregistre = await window.LearnHubIA.enregistrer(item);
                            if (!enregistre.ok) toast('Le contenu est prêt, mais son enregistrement a échoué : ' + enregistre.error, 'warning');
                            else await rafraichirHistorique();
                        }

                        rendre(item);
                        zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } catch (erreur) {
                        console.error('Génération IA :', erreur);
                        afficherErreur(erreur && erreur.message
                            ? 'La génération a échoué : ' + erreur.message
                            : 'La génération a échoué. Vérifie ta connexion et réessaie.');
                    } finally {
                        generationEnCours = false;
                        boutons.forEach(function (bouton) {
                            bouton.disabled = false;
                            bouton.removeAttribute('aria-busy');
                        });
                    }
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

                formQuiz.addEventListener('submit', function (event) {
                    event.preventDefault();
                    const sujetQuiz = racine.querySelector('#ia-sujet-quiz').value.trim();
                    if (sujetQuiz.length < 2) {
                        afficherErreur('Indiquez le sujet du quiz.');
                        return;
                    }
                    lancer('quiz', {
                        mode: 'quiz',
                        sujetQuiz: sujetQuiz,
                        nombreQuestions: Number(racine.querySelector('#ia-nombre-quiz').value),
                        niveau: racine.querySelector('#ia-niveau-quiz').value
                    });
                });

                formFiche.addEventListener('submit', function (event) {
                    event.preventDefault();
                    const sujetFiche = racine.querySelector('#ia-sujet-fiche').value.trim();
                    if (sujetFiche.length < 2) {
                        afficherErreur('Indiquez le sujet de la fiche de révision.');
                        return;
                    }
                    lancer('fiche', {
                        mode: 'fiche',
                        sujetFiche: sujetFiche,
                        typeFiche: racine.querySelector('#ia-type-fiche').value,
                        niveau: racine.querySelector('#ia-niveau-fiche').value
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
        const totalLivres = store.lecons.all().filter(function (lecon) { return !!lecon.supportUrl; }).length;
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
                        '<p class="text-muted mb-0">Tous les comptes, espaces, classes et livres de la plateforme.</p>' +
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
                    '<p class="text-muted small">' + totalClasses + ' classe(s) et ' + totalLivres + ' livre(s) PDF sur la plateforme.</p>' +
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
        { slug: 'dashboard', titre: 'Tableau de bord', icone: 'fa-tachometer-alt', groupe: 'Pilotage' },
        { slug: 'statistiques', titre: 'Statistiques', icone: 'fa-chart-bar', groupe: 'Pilotage' },
        { slug: 'classes', titre: 'Classes', icone: 'fa-users-rectangle', groupe: 'Contenus' },
        { slug: 'lecons', titre: 'Leçons', icone: 'fa-book-open', groupe: 'Contenus' },
        { slug: 'exercices', titre: 'Exercices', icone: 'fa-tasks', groupe: 'Contenus' },
        { slug: 'ressources', titre: 'Ressources', icone: 'fa-file-pdf', groupe: 'Contenus' },
        { slug: 'bibliotheque', titre: 'Bibliothèque', icone: 'fa-book', groupe: 'Contenus' },
        { slug: 'utilisateurs', titre: 'Utilisateurs', icone: 'fa-users', groupe: 'Gestion' },
        { slug: 'parametres', titre: 'Paramètres', icone: 'fa-cogs', groupe: 'Gestion' }
    ];

    const GROUPES_ADMIN = ['Pilotage', 'Contenus', 'Gestion'];

    function vueAdmin(section) {
        const user = auth.current();
        if (!auth.isAdmin()) {
            const sectionDemandee = section || 'dashboard';
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
                    (sectionDemandee === 'ressources'
                        ? ' <a class="btn btn-outline-primary" href="#/ressources">Voir les ressources de ma classe</a>'
                        : '') +
                '</div></div>'
            };
        }

        const sectionActive = SECTIONS_ADMIN.some(function (s) { return s.slug === section; }) ? section : 'dashboard';
        const titreSection = (SECTIONS_ADMIN.find(function (s) { return s.slug === sectionActive; }) || SECTIONS_ADMIN[0]).titre;

        const menu = GROUPES_ADMIN.map(function (groupe) {
            const liens = SECTIONS_ADMIN.filter(function (s) { return s.groupe === groupe; });
            if (!liens.length) return '';
            return '<div class="admin-nav-groupe">' +
                '<p class="admin-nav-titre">' + esc(groupe) + '</p>' +
                '<ul class="admin-nav-liste">' +
                    liens.map(function (s) {
                        const actif = s.slug === sectionActive;
                        return '<li>' +
                            '<a class="admin-nav-lien' + (actif ? ' active' : '') + '" href="#/admin/' + s.slug + '"' +
                                (actif ? ' aria-current="page"' : '') + '>' +
                                '<span class="admin-nav-icone"><i class="fas ' + esc(s.icone) + '"></i></span>' +
                                '<span class="admin-nav-libelle">' + esc(s.titre) + '</span>' +
                            '</a>' +
                        '</li>';
                    }).join('') +
                '</ul>' +
            '</div>';
        }).join('');

        const nomCompte = user && user.username ? user.username : 'Administrateur';
        const initiales = nomCompte.trim().slice(0, 2).toUpperCase();
        const avatar = user && user.avatarUrl
            ? '<img src="' + esc(user.avatarUrl) + '" alt="">'
            : esc(initiales);
        const role = auth.isSuperAdmin() ? 'Super-administrateur' : 'Administrateur';

        return {
            titre: 'Administration',
            html: '<div class="container py-4">' +
                '<div class="row g-4">' +
                    '<aside class="col-lg-3">' +
                        '<nav class="admin-nav" aria-label="Navigation de l\'administration">' +
                            '<div class="admin-nav-entete">' +
                                '<span class="admin-nav-avatar">' + avatar + '</span>' +
                                '<span class="admin-nav-identite">' +
                                    '<span class="admin-nav-nom">' + esc(nomCompte) + '</span>' +
                                    '<span class="admin-nav-role"><i class="fas fa-shield-halved me-1"></i>' + esc(role) + '</span>' +
                                '</span>' +
                            '</div>' +
                            '<div class="admin-nav-groupes">' + menu + '</div>' +
                            '<a class="admin-nav-retour" href="#/"><i class="fas fa-arrow-left"></i>Retour au site</a>' +
                        '</nav>' +
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
            case 'lecon': return vueLecon(segments[1], segments[2]);
            case 'ressources': return vueRessources();
            case 'bibliotheque': return vueBibliotheque(parametres);
            case 'contact': return vueContact();
            case 'exercices': return vueExercices(parametres);
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