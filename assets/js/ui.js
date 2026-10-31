/**
 * LearnHub — petits composants d'interface partagés.
 *
 * `pagination()` produit un bloc « 1–15 sur 248 » + numéros de pages.
 * Le clic est laissé à l'appelant : il écoute `data-page` sur son conteneur.
 */
window.LearnHubUI = (function () {
    'use strict';

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function numerosDePages(page, pages) {
        const liste = [];
        const fenetre = 1;
        for (let i = 1; i <= pages; i += 1) {
            const proche = Math.abs(i - page) <= fenetre;
            if (i === 1 || i === pages || proche) {
                liste.push(i);
            } else if (liste[liste.length - 1] !== '…') {
                liste.push('…');
            }
        }
        return liste;
    }

    /**
     * @param {{page:number, taille:number, total:number, libelle?:string}} options
     * @returns {string} HTML du bloc de pagination (vide s'il n'y a qu'une page)
     */
    function pagination(options) {
        const total = Math.max(0, Number(options.total) || 0);
        const taille = Math.max(1, Number(options.taille) || 10);
        const pages = Math.max(1, Math.ceil(total / taille));
        if (total === 0) return '';

        const page = Math.min(Math.max(1, Number(options.page) || 1), pages);
        if (pages === 1) {
            return '<div class="biblio-pagination">' +
                '<p class="small text-muted mb-0">' + total + ' ' + esc(options.libelle || 'document(s)') + '</p>' +
            '</div>';
        }

        const debut = (page - 1) * taille + 1;
        const fin = Math.min(page * taille, total);

        const element = function (numero, libelle, options2) {
            const actif = options2 && options2.actif;
            const desactive = options2 && options2.desactive;
            const aria = options2 && options2.aria;
            return '<li class="page-item' + (actif ? ' active' : '') + (desactive ? ' disabled' : '') + '">' +
                '<button class="page-link" type="button" data-page="' + numero + '"' +
                (aria ? ' aria-label="' + esc(aria) + '"' : '') +
                (actif ? ' aria-current="page"' : '') +
                (desactive ? ' disabled' : '') + '>' + libelle + '</button>' +
            '</li>';
        };

        const items = [element(page - 1, '<i class="fas fa-chevron-left" aria-hidden="true"></i><span class="visually-hidden">Page précédente</span>',
            { desactive: page <= 1, aria: 'Page précédente' })];

        numerosDePages(page, pages).forEach(function (valeur) {
            if (valeur === '…') {
                items.push('<li class="page-item disabled"><span class="page-link">…</span></li>');
                return;
            }
            items.push(element(valeur, String(valeur), { actif: valeur === page, aria: 'Page ' + valeur }));
        });

        items.push(element(page + 1, '<i class="fas fa-chevron-right" aria-hidden="true"></i><span class="visually-hidden">Page suivante</span>',
            { desactive: page >= pages, aria: 'Page suivante' }));

        return '<div class="biblio-pagination">' +
            '<p class="small text-muted mb-0">' + debut + '–' + fin + ' sur ' + total + ' ' + esc(options.libelle || 'document(s)') + '</p>' +
            '<ul class="pagination pagination-sm mb-0 flex-wrap">' + items.join('') + '</ul>' +
        '</div>';
    }

    /** Page demandée par un clic, ou null. */
    function pageCliquee(evenement) {
        const bouton = evenement.target.closest('[data-page]');
        if (!bouton || bouton.disabled) return null;
        const valeur = Number(bouton.dataset.page);
        return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
    }

    return {
        pagination: pagination,
        pageCliquee: pageCliquee
    };
})();
