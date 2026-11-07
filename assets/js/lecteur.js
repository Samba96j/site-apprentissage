/**
 * LearnHub — lecteur de livre.
 *
 * Ouvre le document PDF d'un cours comme un vrai livre : couverture seule,
 * puis doubles pages qui se tournent de gauche à droite (clic, glisser,
 * flèches du clavier). Les bibliothèques pdf.js et page-flip sont chargées
 * à la demande, uniquement quand un livre est ouvert.
 */
window.LearnHubLecteur = (function () {
    'use strict';

    const CDN_PDF = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    const CDN_PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const CDN_FLIP = 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js';

    // Résolution de rendu des pages (élevée pour un texte net).
    const ECHELLE = 2;

    const promesses = {};

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function chargerScript(url) {
        if (promesses[url]) return promesses[url];
        promesses[url] = new Promise(function (resolve, reject) {
            const balise = document.createElement('script');
            balise.src = url;
            balise.async = true;
            balise.onload = function () { resolve(); };
            balise.onerror = function () { reject(new Error('Impossible de charger ' + url)); };
            document.head.appendChild(balise);
        });
        return promesses[url];
    }

    /** Le document est-il un PDF (seul format que le livre sait paginer) ? */
    function estPdf(lecon) {
        const url = String(lecon.supportUrl || lecon.url || '').split(/[?#]/)[0];
        const nom = String(lecon.supportNom || lecon.nom || '');
        return /\bpdf\b/i.test(String(lecon.supportType || lecon.type || '')) ||
            /\.pdf$/i.test(url) || /\.pdf$/i.test(nom);
    }

    function etat(racine, html) {
        const zone = racine.querySelector('#lecteur-etat');
        if (!zone) return;
        if (html) {
            zone.innerHTML = html;
            zone.classList.remove('d-none');
        } else {
            zone.classList.add('d-none');
            zone.innerHTML = '';
        }
    }

    /**
     * Monte le lecteur dans `racine` et charge un document PDF.
     * `lecon` : { id?, titre, supportUrl, supportNom, supportType?, urlRetour? }.
     */
    function render(racine, lecon) {
        const retour = lecon.urlRetour || (lecon.id
            ? '#/lecon/' + encodeURIComponent(lecon.id)
            : '#/bibliotheque');
        racine.innerHTML =
            '<div class="lecteur">' +
                '<div class="lecteur-barre">' +
                    '<a class="lecteur-btn" href="' + esc(retour) + '">' +
                        '<i class="fas fa-arrow-left me-1"></i><span class="d-none d-sm-inline">Quitter la lecture</span><span class="d-sm-none">Retour</span></a>' +
                    '<div class="lecteur-titre" title="' + esc(lecon.titre) + '"><i class="fas fa-book-open me-2"></i>' + esc(lecon.titre) + '</div>' +
                    '<div class="lecteur-outils">' +
                        '<button type="button" class="lecteur-btn" id="lecteur-prec" title="Page précédente"><i class="fas fa-chevron-left"></i></button>' +
                        '<span class="lecteur-page" id="lecteur-page">—</span>' +
                        '<button type="button" class="lecteur-btn" id="lecteur-suiv" title="Page suivante"><i class="fas fa-chevron-right"></i></button>' +
                        '<button type="button" class="lecteur-btn" id="lecteur-plein" title="Plein écran"><i class="fas fa-expand"></i></button>' +
                        '<a class="lecteur-btn" href="' + esc(lecon.supportUrl || '') + '" target="_blank" rel="noopener" title="Ouvrir dans un onglet"><i class="fas fa-up-right-from-square d-none d-sm-inline"></i><i class="fas fa-download d-sm-none"></i></a>' +
                        '<a class="lecteur-btn" href="' + esc(lecon.supportUrl || '') + '" download="' + esc(lecon.supportNom || lecon.titre) + '" title="Télécharger"><i class="fas fa-download d-none d-sm-inline"></i></a>' +
                    '</div>' +
                '</div>' +
                '<div class="lecteur-scene" id="lecteur-scene">' +
                    '<div class="lecteur-livre" id="lecteur-livre"></div>' +
                    '<div class="lecteur-etat" id="lecteur-etat">' +
                        '<i class="fas fa-circle-notch fa-spin me-2"></i>Ouverture du livre…' +
                    '</div>' +
                '</div>' +
                '<div class="lecteur-aide">' +
                    '<i class="fas fa-hand-pointer me-1"></i>Cliquez ou faites glisser une page pour la tourner — les flèches ← → fonctionnent aussi.' +
                '</div>' +
            '</div>';

        if (!lecon.supportUrl) {
            etat(racine, '<i class="fas fa-triangle-exclamation me-2"></i>Aucun document joint à ce cours.');
            return;
        }
        if (!estPdf(lecon)) {
            etat(racine, '<i class="fas fa-file me-2"></i>Ce document n\'est pas un PDF : le livre ne peut pas le paginer.' +
                '<div class="mt-2"><a class="btn btn-sm btn-primary" href="' + esc(lecon.supportUrl) + '" target="_blank" rel="noopener">' +
                '<i class="fas fa-up-right-from-square me-1"></i>Ouvrir le document</a></div>');
            return;
        }

        demarrer(racine, lecon);
    }

    async function demarrer(racine, lecon) {
        const livre = racine.querySelector('#lecteur-livre');
        let pdfjs;
        let Flip;
        try {
            await chargerScript(CDN_PDF);
            await chargerScript(CDN_FLIP);
            pdfjs = window.pdfjsLib;
            Flip = window.St && window.St.PageFlip;
            if (!pdfjs || !Flip) throw new Error('Bibliothèque de lecture indisponible.');
            pdfjs.GlobalWorkerOptions.workerSrc = CDN_PDF_WORKER;
        } catch (erreur) {
            console.error('Lecteur :', erreur);
            etat(racine, '<i class="fas fa-plug-circle-xmark me-2"></i>Le livre n\'a pas pu se charger (connexion requise).' +
                '<div class="mt-2"><a class="btn btn-sm btn-primary" href="' + esc(lecon.supportUrl) + '" target="_blank" rel="noopener">' +
                '<i class="fas fa-up-right-from-square me-1"></i>Ouvrir le PDF</a></div>');
            return;
        }

        let doc;
        try {
            doc = await pdfjs.getDocument(lecon.supportUrl).promise;
        } catch (erreur) {
            console.error('Lecteur : document illisible.', erreur);
            etat(racine, '<i class="fas fa-file-circle-xmark me-2"></i>Le document n\'a pas pu être ouvert.' +
                '<div class="mt-2"><a class="btn btn-sm btn-primary" href="' + esc(lecon.supportUrl) + '" target="_blank" rel="noopener">' +
                '<i class="fas fa-up-right-from-square me-1"></i>Ouvrir le PDF</a></div>');
            return;
        }

        const total = doc.numPages;
        const feuilles = [];

        // Construit une feuille (une page du PDF) par page, avec un texte d'attente.
        for (let numero = 1; numero <= total; numero += 1) {
            const feuille = {
                numero: numero,
                rendue: false,
                element: document.createElement('div'),
                canvas: document.createElement('canvas'),
                contexte: null
            };
            feuille.element.className = 'lecteur-page';
            feuille.canvas.className = 'lecteur-canevas';
            feuille.canvas.width = 600;
            feuille.canvas.height = 848;
            feuille.contexte = feuille.canvas.getContext('2d');
            feuille.contexte.fillStyle = '#ffffff';
            feuille.contexte.fillRect(0, 0, 600, 848);
            feuille.contexte.fillStyle = '#c6b6d6';
            feuille.contexte.font = '600 30px "Segoe UI", Roboto, sans-serif';
            feuille.contexte.textAlign = 'center';
            feuille.contexte.textBaseline = 'middle';
            feuille.contexte.fillText(String(numero), 300, 424);
            feuille.element.appendChild(feuille.canvas);
            livre.appendChild(feuille.element);
            feuilles.push(feuille);
        }

        async function dessiner(feuille) {
            if (!feuille || feuille.rendue) return;
            feuille.rendue = true;
            try {
                const page = await doc.getPage(feuille.numero);
                const vue = page.getViewport({ scale: ECHELLE });
                feuille.canvas.width = Math.floor(vue.width);
                feuille.canvas.height = Math.floor(vue.height);
                await page.render({
                    canvasContext: feuille.contexte,
                    viewport: vue
                }).promise;
            } catch (erreur) {
                console.error('Lecteur : page ' + feuille.numero + ' illisible.', erreur);
                feuille.rendue = false;
            }
        }

        // Index de double page (0 = couverture seule) → numéros de pages PDF visibles.
        function pagesDe(indice) {
            if (flip.getOrientation() === 'portrait') {
                return [indice + 1].filter(function (p) { return p <= total; });
            }
            const pages = indice === 0 ? [1] : [2 * indice, 2 * indice + 1];
            return pages.filter(function (p) { return p >= 1 && p <= total; });
        }

        function rendreAutour(indice) {
            const attendus = [];
            [indice - 1, indice, indice + 1].forEach(function (k) {
                if (k < 0) return;
                pagesDe(k).forEach(function (p) {
                    if (attendus.indexOf(p) === -1) attendus.push(p);
                });
            });
            attendus.forEach(function (p) { dessiner(feuilles[p - 1]); });
        }

        function libelle(indice) {
            const pages = pagesDe(indice);
            if (!pages.length) return '—';
            if (pages.length === 1) return 'Page ' + pages[0] + ' / ' + total;
            return 'Pages ' + pages[0] + '–' + pages[pages.length - 1] + ' / ' + total;
        }

        const FlipClasse = Flip;
        const flip = new FlipClasse(livre, {
            width: 500,
            height: 707,
            size: 'stretch',
            minWidth: 300,
            maxWidth: 1150,
            minHeight: 424,
            maxHeight: 1620,
            maxShadowOpacity: 0.45,
            showCover: true,
            mobileScrollSupport: false,
            usePortrait: true,
            startPage: 0,
            flippingTime: 700,
            useMouseEvents: true,
            swipeDistance: 30,
            disableFlipByClick: false,
            drawShadow: true,
            startZIndex: 0
        });

        function synchroniserOrientation() {
            livre.classList.toggle('lecteur-livre-portrait', flip.getOrientation() === 'portrait');
        }

        flip.loadFromHTML(Array.prototype.slice.call(livre.querySelectorAll('.lecteur-page')));
        synchroniserOrientation();

        const zonePage = racine.querySelector('#lecteur-page');
        zonePage.textContent = libelle(0);

        flip.on('flip', function () {
            const indice = flip.getCurrentPageIndex();
            zonePage.textContent = libelle(indice);
            rendreAutour(indice);
        });

        racine.querySelector('#lecteur-prec').addEventListener('click', function () { flip.flipPrev(); });
        racine.querySelector('#lecteur-suiv').addEventListener('click', function () { flip.flipNext(); });

        const boutonPlein = racine.querySelector('#lecteur-plein');
        const scene = racine.querySelector('#lecteur-scene');
        boutonPlein.addEventListener('click', function () {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else if (scene.requestFullscreen) {
                scene.requestFullscreen();
            }
        });
        scene.addEventListener('fullscreenchange', function () {
            boutonPlein.innerHTML = document.fullscreenElement
                ? '<i class="fas fa-compress"></i>'
                : '<i class="fas fa-expand"></i>';
            boutonPlein.title = document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran';
            if (typeof flip.update === 'function') {
                flip.update();
                synchroniserOrientation();
                const indice = flip.getCurrentPageIndex();
                zonePage.textContent = libelle(indice);
                rendreAutour(indice);
            }
        });

        const touche = function (event) {
            if (!document.body.contains(livre)) return;
            if (event.target && /^(input|textarea|select)$/i.test(event.target.tagName)) return;
            if (event.key === 'ArrowLeft') { flip.flipPrev(); event.preventDefault(); }
            if (event.key === 'ArrowRight') { flip.flipNext(); event.preventDefault(); }
        };
        document.addEventListener('keydown', touche);

        window.addEventListener('resize', function () {
            if (!document.body.contains(livre)) return;
            if (typeof flip.update === 'function') {
                flip.update();
                synchroniserOrientation();
                const indice = flip.getCurrentPageIndex();
                zonePage.textContent = libelle(indice);
                rendreAutour(indice);
            }
        });

        etat(racine, null);
        rendreAutour(0);
    }

    return {
        render: render,
        estPdf: estPdf
    };
})();
