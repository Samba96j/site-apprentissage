/**
 * LearnHub — back-office.
 * Toutes les données passent par LearnHubStore (localStorage), ce qui rend les
 * créations, modifications et suppressions réellement persistantes et visibles
 * immédiatement dans l'espace élève.
 */
window.LearnHubAdmin = (function () {
    'use strict';

    const LIBELLES_TYPES = { quiz: 'Quiz', matching: 'Associations', fillblank: 'Textes à trous' };
    const LIMITE_FICHIER = 1.5 * 1024 * 1024;

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formaterDate(iso) {
        if (!iso) return '—';
        const date = new Date(iso);
        if (isNaN(date.getTime())) return esc(iso);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formaterDateHeure(iso) {
        if (!iso) return '—';
        const date = new Date(iso);
        if (isNaN(date.getTime())) return esc(iso);
        return date.toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function message(zone, texte, type) {
        if (!zone) return;
        zone.className = 'alert alert-' + (type || 'success') + ' py-2';
        zone.innerHTML = '<i class="fas fa-circle-check me-1"></i>' + esc(texte);
        setTimeout(function () {
            zone.className = 'd-none';
        }, 4000);
    }

    function detailsExercice(ex) {
        if (ex.type === 'quiz') return ex.questions.length + ' question(s)';
        if (ex.type === 'matching') return ex.pairs.length + ' paire(s)';
        return (ex.quotes || []).length + ' citation(s)';
    }

    function nomMatiere(slug) {
        const matiere = window.LearnHubData.getMatiere(slug);
        return matiere ? matiere.nom : 'Français';
    }

    /** Convertit le HTML des trous (généré par l'éditeur) en texte éditable « [mot] ». */
    function htmlVersTexte(html) {
        return String(html || '').replace(/<span class=['"]blank['"] data-answer=['"]([^'"]*)['"]><\/span>/g, '[$1]');
    }

    /** Convertit un contenu texte (paragraphes et puces) en HTML pour l'éditeur riche. */
    function texteSimpleVersHtml(texte) {
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

    function moyennePourcentage(tentatives) {
        if (!tentatives.length) return null;
        let points = 0;
        let possibles = 0;
        tentatives.forEach(function (t) {
            points += t.score;
            possibles += t.total;
        });
        return possibles > 0 ? Math.round((points / possibles) * 100) : 0;
    }

    function toutesLesTentatives() {
        const progress = window.LearnHubAuth.allProgress();
        const liste = [];
        Object.keys(progress).forEach(function (username) {
            (progress[username] || []).forEach(function (t) {
                liste.push(Object.assign({}, t, { username: username }));
            });
        });
        return liste.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    }

    /* ------------------------------- Espace courant ------------------------------- */

    function elevesEspace() {
        const espace = window.LearnHubAuth.espaceActif();
        if (!espace) return [];
        const ids = window.LearnHubStore.classes.miens().map(function (c) { return c.id; });
        return window.LearnHubAuth.users().filter(function (u) {
            return u.role === 'eleve' && ids.indexOf(u.classeId) >= 0;
        });
    }

    function tentativesEspace() {
        const noms = elevesEspace().map(function (u) { return u.username; });
        return toutesLesTentatives().filter(function (t) {
            return noms.indexOf(t.username) >= 0;
        });
    }

    function nomClasse(id) {
        const classe = window.LearnHubStore.classes.get(id);
        return classe ? classe.nom : 'Classe supprimée';
    }

    function elevesDesClasses(classeIds) {
        const ids = classeIds || [];
        return window.LearnHubAuth.users().filter(function (u) {
            return u.role === 'eleve' && ids.indexOf(u.classeId) >= 0;
        });
    }

    function bilanEleve(username, exerciceIds) {
        const tentatives = window.LearnHubAuth.attempts(username).filter(function (t) {
            return exerciceIds.indexOf(t.exerciceId) >= 0;
        });
        const faits = {};
        tentatives.forEach(function (t) {
            const ratio = t.total > 0 ? Math.round((t.score / t.total) * 100) : 0;
            faits[t.exerciceId] = Math.max(faits[t.exerciceId] || 0, ratio);
        });
        const derniere = tentatives.reduce(function (acc, t) {
            return !acc || new Date(t.date) > new Date(acc) ? t.date : acc;
        }, null);
        return {
            faits: Object.keys(faits).length,
            moyenne: moyennePourcentage(tentatives),
            meilleurParExercice: faits,
            derniere: derniere
        };
    }

    /* ------------------------------ Tableau de bord ------------------------------ */

    function renderDashboard(racine) {
        const espace = window.LearnHubAuth.monEspace();
        const exercices = window.LearnHubStore.exercices.miens();
        const ressources = window.LearnHubStore.ressources.miens();
        const classes = window.LearnHubStore.classes.miens();
        const seances = window.LearnHubStore.seances.miens();
        const lecons = window.LearnHubStore.lecons.miens();
        const eleves = elevesEspace();
        const tentatives = tentativesEspace();
        const actifs = exercices.filter(function (ex) { return ex.actif !== false; });
        const activite = tentatives.slice(0, 6);
        const aujourdhui = new Date();
        aujourdhui.setHours(0, 0, 0, 0);
        const prochaines = seances
            .filter(function (s) { return s.date && new Date(s.date) >= aujourdhui; })
            .sort(function (a, b) { return new Date(a.date) - new Date(b.date); })
            .slice(0, 4);

        racine.innerHTML =
            '<div class="row g-3 mb-4">' +
                carte('bg-primary', 'fa-tasks', 'Exercices actifs', actifs.length, exercices.length + ' dans mon espace') +
                carte('bg-success', 'fa-users', 'Mes élèves', eleves.length, classes.length + ' classe(s)') +
                carte('bg-warning', 'fa-calendar-days', 'Séances', seances.length, prochaines.length + ' à venir') +
                carte('bg-info', 'fa-chart-simple', 'Tentatives', tentatives.length, 'réalisées par mes élèves') +
            '</div>' +
            '<div class="row g-4">' +
                '<div class="col-lg-7">' +
                    '<div class="admin-panel h-100">' +
                        '<h4 class="mb-3"><i class="fas fa-clock-rotate-left me-2"></i>Activité récente</h4>' +
                        (activite.length
                            ? '<div class="list-group">' + activite.map(function (t) {
                                return '<div class="list-group-item d-flex justify-content-between align-items-start">' +
                                    '<div><div class="fw-semibold">' + esc(t.titre) + '</div>' +
                                    '<small class="text-muted">' + esc(t.username) + ' · ' + esc(LIBELLES_TYPES[t.type] || t.type) + '</small></div>' +
                                    '<div class="text-end"><span class="badge bg-secondary">' + t.score + '/' + t.total + '</span>' +
                                    '<div><small class="text-muted">' + formaterDateHeure(t.date) + '</small></div></div>' +
                                '</div>';
                            }).join('') + '</div>'
                            : '<p class="text-muted mb-0">Aucune activité enregistrée pour le moment. Les scores de vos élèves apparaîtront ici.</p>') +
                    '</div>' +
                '</div>' +
                '<div class="col-lg-5">' +
                    '<div class="admin-panel h-100">' +
                        '<h4 class="mb-3"><i class="fas fa-bolt me-2"></i>Actions rapides</h4>' +
                        '<div class="d-grid gap-2">' +
                            '<a class="btn btn-outline-primary" href="#/admin/seances"><i class="fas fa-calendar-plus me-1"></i>Planifier une séance</a>' +
                            '<a class="btn btn-outline-primary" href="#/admin/classes"><i class="fas fa-users-rectangle me-1"></i>Créer une classe</a>' +
                            '<a class="btn btn-outline-secondary" href="#/admin/exercices"><i class="fas fa-plus me-1"></i>Créer un exercice</a>' +
                            '<a class="btn btn-outline-secondary" href="#/admin/statistiques"><i class="fas fa-chart-bar me-1"></i>Consulter les statistiques</a>' +
                        '</div>' +
                        '<hr>' +
                        '<h5 class="mb-2"><i class="fas fa-door-open me-1"></i>Mon espace</h5>' +
                        '<p class="mb-2 fw-semibold">' + esc(espace ? espace.nom : 'Espace non défini') + '</p>' +
                        (classes.length
                            ? '<ul class="list-unstyled mb-0 small">' + classes.map(function (c) {
                                return '<li class="d-flex justify-content-between border-bottom py-1">' +
                                    '<span>' + esc(c.nom) + '</span><span class="badge bg-light text-dark">' + esc(c.code) + '</span></li>';
                            }).join('') + '</ul>'
                            : '<p class="text-muted small mb-0">Aucune classe : créez-en une pour inviter vos élèves avec un code.</p>') +
                        '<h5 class="mb-2 mt-3">Mes contenus</h5>' +
                        '<p class="text-muted small mb-0">' + lecons.length + ' leçon(s), ' + exercices.length + ' exercice(s) et ' + ressources.length + ' ressource(s) dans mon espace.</p>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            (prochaines.length
                ? '<div class="admin-panel mt-4"><h4 class="mb-3"><i class="fas fa-calendar-check me-2"></i>Prochaines séances</h4>' +
                    '<div class="list-group">' + prochaines.map(function (s) {
                        return '<div class="list-group-item d-flex justify-content-between align-items-center">' +
                            '<div><div class="fw-semibold">' + esc(s.titre) + '</div>' +
                            '<small class="text-muted">' + formaterDate(s.date) + ' · ' + (s.duree || 60) + ' min · ' +
                            esc((s.classeIds || []).map(nomClasse).join(', ') || 'Toutes mes classes') + '</small></div>' +
                            '<a class="btn btn-sm btn-outline-primary" href="#/admin/seances">Ouvrir</a></div>';
                    }).join('') + '</div></div>'
                : '');
    }

    function carte(couleur, icone, titre, valeur, sousTitre) {
        return '<div class="col-sm-6 col-xl-3">' +
            '<div class="dashboard-card ' + couleur + ' text-white p-3 h-100">' +
                '<h5><i class="fas ' + icone + ' me-2"></i>' + titre + '</h5>' +
                '<h2 class="mt-2">' + valeur + '</h2>' +
                '<p class="mb-0 small">' + esc(sousTitre) + '</p>' +
            '</div>' +
        '</div>';
    }

    /* -------------------------------- Exercices -------------------------------- */

    function renderExercices(racine) {
        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                '<h2 class="mb-0"><i class="fas fa-tasks me-2"></i>Gestion des exercices</h2>' +
                '<div class="d-flex gap-2">' +
                    '<input type="search" class="form-control form-control-sm" id="filtre-exercices" placeholder="Filtrer…" style="max-width:200px">' +
                    '<button class="btn btn-outline-secondary btn-sm" id="importer-demo-exercices" title="Copier les exercices de démonstration dans mon espace"><i class="fas fa-download me-1"></i>Bibliothèque démo</button>' +
                    '<button class="btn btn-primary btn-sm" id="nouvel-exercice"><i class="fas fa-plus me-1"></i>Nouvel exercice</button>' +
                '</div>' +
            '</div>' +
            '<p class="text-muted small"><i class="fas fa-circle-info me-1"></i>Les exercices affichés appartiennent à votre espace. Ceux d\'un autre administrateur vous sont invisibles.</p>' +
            '<div id="editeur-exercice" class="d-none"></div>' +
            '<div class="admin-panel"><div id="liste-exercices"></div></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const editeur = racine.querySelector('#editeur-exercice');
        const liste = racine.querySelector('#liste-exercices');
        const filtre = racine.querySelector('#filtre-exercices');

        function rafraichir() {
            const recherche = filtre.value.trim().toLowerCase();
            const exercices = window.LearnHubStore.exercices.miens().filter(function (ex) {
                if (!recherche) return true;
                return (ex.titre + ' ' + nomMatiere(ex.matiere)).toLowerCase().indexOf(recherche) >= 0;
            });

            if (!exercices.length) {
                liste.innerHTML = '<p class="text-muted mb-0">' +
                    (recherche
                        ? 'Aucun exercice ne correspond à cette recherche.'
                        : 'Votre espace ne contient encore aucun exercice. Créez-en un ou importez la bibliothèque de démonstration.') +
                    '</p>';
                return;
            }

            liste.innerHTML =
                '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                    '<thead><tr><th>Titre</th><th>Matière</th><th>Type</th><th>Contenu</th><th>Statut</th><th class="text-end">Actions</th></tr></thead>' +
                    '<tbody>' + exercices.map(function (ex) {
                        const badge = ex.actif === false
                            ? '<span class="badge bg-secondary">Inactif</span>'
                            : '<span class="badge bg-success">Actif</span>';
                        return '<tr>' +
                            '<td class="fw-semibold">' + esc(ex.titre) + '</td>' +
                            '<td><span class="badge bg-primary bg-opacity-10 text-primary">' + esc(nomMatiere(ex.matiere)) + '</span></td>' +
                            '<td>' + esc(LIBELLES_TYPES[ex.type] || ex.type) + '</td>' +
                            '<td class="text-muted small">' + detailsExercice(ex) + '</td>' +
                            '<td>' + badge + '</td>' +
                            '<td class="text-end text-nowrap">' +
                                '<button class="btn btn-sm btn-outline-primary me-1" data-action="editer" data-id="' + esc(ex.id) + '" title="Modifier"><i class="fas fa-edit"></i></button>' +
                                '<button class="btn btn-sm btn-outline-secondary me-1" data-action="basculer" data-id="' + esc(ex.id) + '" title="Activer ou désactiver"><i class="fas fa-power-off"></i></button>' +
                                '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-id="' + esc(ex.id) + '" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                            '</td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                '</table></div>';
        }

        function questionCard(question) {
            const donnees = question || { question: '', options: ['', ''], answer: 0, explanation: '' };
            const numero = window.LearnHubStore.uid('q');
            return '<div class="card mb-3 question-card">' +
                '<div class="card-header d-flex justify-content-between align-items-center">' +
                    '<span>Question</span>' +
                    '<button type="button" class="btn btn-sm btn-outline-danger supprimer-question"><i class="fas fa-trash"></i></button>' +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="mb-2">' +
                        '<label class="form-label">Énoncé</label>' +
                        '<input type="text" class="form-control question-text" value="' + esc(donnees.question) + '">' +
                    '</div>' +
                    '<label class="form-label">Options (cochez la bonne réponse)</label>' +
                    '<div class="options-container">' + donnees.options.map(function (option, index) {
                        return '<div class="input-group mb-2">' +
                            '<div class="input-group-text"><input class="form-check-input correct-answer" type="radio" name="correct-' + numero + '" ' + (index === donnees.answer ? 'checked' : '') + '></div>' +
                            '<input type="text" class="form-control option-text" value="' + esc(option) + '" placeholder="Option ' + (index + 1) + '">' +
                        '</div>';
                    }).join('') + '</div>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary ajouter-option"><i class="fas fa-plus me-1"></i>Ajouter une option</button>' +
                    '<div class="mt-3">' +
                        '<label class="form-label">Explication (facultative)</label>' +
                        '<textarea class="form-control explanation" rows="2">' + esc(donnees.explanation) + '</textarea>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }

        function pairCard(paire) {
            const donnees = paire || { item: '', match: '' };
            return '<div class="card mb-3 pair-card">' +
                '<div class="card-header d-flex justify-content-between align-items-center">' +
                    '<span>Paire</span>' +
                    '<button type="button" class="btn btn-sm btn-outline-danger supprimer-paire"><i class="fas fa-trash"></i></button>' +
                '</div>' +
                '<div class="card-body"><div class="row">' +
                    '<div class="col-md-6 mb-2"><label class="form-label">Élément</label><input type="text" class="form-control pair-item" value="' + esc(donnees.item) + '"></div>' +
                    '<div class="col-md-6 mb-2"><label class="form-label">Correspondance</label><input type="text" class="form-control pair-match" value="' + esc(donnees.match) + '"></div>' +
                '</div></div>' +
            '</div>';
        }

        function ouvrirEditeur(exercice) {
            const type = exercice ? exercice.type : 'quiz';
            editeur.classList.remove('d-none');
            editeur.innerHTML =
                '<div class="admin-panel border border-primary">' +
                    '<div class="d-flex justify-content-between align-items-center mb-3">' +
                        '<h4 class="mb-0">' + (exercice ? 'Modifier l\'exercice' : 'Nouvel exercice') + '</h4>' +
                        '<button class="btn btn-sm btn-outline-secondary" id="fermer-editeur"><i class="fas fa-xmark"></i></button>' +
                    '</div>' +
                    '<div class="row g-3 mb-3">' +
                        '<div class="col-md-5"><label class="form-label" for="exo-titre">Titre</label><input type="text" class="form-control" id="exo-titre" value="' + esc(exercice ? exercice.titre : '') + '"></div>' +
                        '<div class="col-md-3"><label class="form-label" for="exo-matiere">Matière</label>' +
                            '<select class="form-select" id="exo-matiere">' +
                                window.LearnHubData.matieres.map(function (matiere) {
                                    const selection = (exercice ? exercice.matiere : 'francais') === matiere.slug;
                                    return '<option value="' + esc(matiere.slug) + '" ' + (selection ? 'selected' : '') + '>' + esc(matiere.nom) + '</option>';
                                }).join('') +
                            '</select></div>' +
                        '<div class="col-md-2"><label class="form-label" for="exo-type">Type</label>' +
                            '<select class="form-select" id="exo-type" ' + (exercice ? 'disabled' : '') + '>' +
                                Object.keys(LIBELLES_TYPES).map(function (cle) {
                                    return '<option value="' + cle + '" ' + (cle === type ? 'selected' : '') + '>' + LIBELLES_TYPES[cle] + '</option>';
                                }).join('') +
                            '</select></div>' +
                        '<div class="col-md-2"><label class="form-label" for="exo-temps">Temps / question</label><input type="number" min="5" class="form-control" id="exo-temps" value="' + esc(exercice && exercice.temps ? exercice.temps : window.LearnHubStore.settings.get().tempsQuestion) + '"></div>' +
                    '</div>' +
                    '<div class="form-check form-switch mb-3">' +
                        '<input class="form-check-input" type="checkbox" id="exo-actif" ' + (!exercice || exercice.actif !== false ? 'checked' : '') + '>' +
                        '<label class="form-check-label" for="exo-actif">Exercice actif (visible par les élèves)</label>' +
                    '</div>' +
                    '<div id="exo-champs"></div>' +
                    '<div class="d-flex gap-2 mt-2">' +
                        '<button class="btn btn-primary" id="enregistrer-exercice"><i class="fas fa-floppy-disk me-1"></i>Enregistrer</button>' +
                        '<button class="btn btn-outline-secondary" id="annuler-editeur">Annuler</button>' +
                    '</div>' +
                '</div>';

            const inner = editeur.firstElementChild;
            const typeSelect = inner.querySelector('#exo-type');
            const champs = inner.querySelector('#exo-champs');

            function afficherChamps() {
                const valeur = typeSelect.value;
                if (valeur === 'quiz') {
                    const questions = exercice && exercice.questions ? exercice.questions : [];
                    champs.innerHTML = '<label class="form-label">Questions</label><div id="questions-container">' +
                        questions.map(function (q) { return questionCard(q); }).join('') +
                        '</div><button type="button" class="btn btn-sm btn-outline-primary" id="ajouter-question"><i class="fas fa-plus me-1"></i>Ajouter une question</button>';
                    if (!questions.length) {
                        champs.querySelector('#questions-container').innerHTML = questionCard(null);
                    }
                } else if (valeur === 'matching') {
                    const paires = exercice && exercice.pairs ? exercice.pairs : [];
                    champs.innerHTML = '<label class="form-label">Paires à associer</label><div id="paires-container">' +
                        paires.map(function (p) { return pairCard(p); }).join('') +
                        '</div><button type="button" class="btn btn-sm btn-outline-primary" id="ajouter-paire"><i class="fas fa-plus me-1"></i>Ajouter une paire</button>';
                    if (!paires.length) {
                        champs.querySelector('#paires-container').innerHTML = pairCard(null);
                    }
                } else {
                    const texte = exercice && exercice.quotes && exercice.quotes[0] ? exercice.quotes[0].text : '';
                    const texteEditable = htmlVersTexte(texte);
                    const mots = exercice && exercice.quotes ? exercice.quotes.reduce(function (acc, q) {
                        return acc.concat(q.words || []);
                    }, []).filter(function (mot, i, arr) { return arr.indexOf(mot) === i; }) : [];
                    const leurres = mots.filter(function (mot) { return texteEditable.indexOf('[' + mot + ']') === -1; });
                    champs.innerHTML =
                        '<div class="mb-3"><label class="form-label">Texte avec trous</label>' +
                        '<textarea class="form-control" id="exo-texte" rows="5" placeholder="Entrez le texte en entourant les mots à trouver avec des crochets : [mot]">' + esc(texteEditable) + '</textarea>' +
                        '<small class="text-muted">Entourez les mots à trouver avec des crochets, par exemple : « Le poids des [traditions]… »</small></div>' +
                        '<div class="mb-3"><label class="form-label">Mots leurres (séparés par des virgules)</label>' +
                        '<input type="text" class="form-control" id="exo-leurres" value="' + esc(leurres.join(', ')) + '"></div>';
                }
            }

            afficherChamps();
            typeSelect.addEventListener('change', afficherChamps);

            inner.querySelector('#fermer-editeur').addEventListener('click', fermerEditeur);
            inner.querySelector('#annuler-editeur').addEventListener('click', fermerEditeur);

            inner.addEventListener('click', function (event) {
                if (event.target.closest('#ajouter-question')) {
                    const container = inner.querySelector('#questions-container');
                    container.insertAdjacentHTML('beforeend', questionCard(null));
                }
                if (event.target.closest('.supprimer-question')) {
                    const carte = event.target.closest('.question-card');
                    if (champs.querySelectorAll('.question-card').length > 1) carte.remove();
                }
                if (event.target.closest('.ajouter-option')) {
                    const carte = event.target.closest('.question-card');
                    const container = carte.querySelector('.options-container');
                    const numero = carte.querySelector('input[type="radio"]').name;
                    container.insertAdjacentHTML('beforeend',
                        '<div class="input-group mb-2">' +
                            '<div class="input-group-text"><input class="form-check-input correct-answer" type="radio" name="' + numero + '"></div>' +
                            '<input type="text" class="form-control option-text" placeholder="Option ' + (container.children.length + 1) + '">' +
                        '</div>');
                }
                if (event.target.closest('#ajouter-paire')) {
                    inner.querySelector('#paires-container').insertAdjacentHTML('beforeend', pairCard(null));
                }
                if (event.target.closest('.supprimer-paire')) {
                    const carte = event.target.closest('.pair-card');
                    if (champs.querySelectorAll('.pair-card').length > 1) carte.remove();
                }
            });

            inner.querySelector('#enregistrer-exercice').addEventListener('click', function () {
                const titre = inner.querySelector('#exo-titre').value.trim();
                const type = typeSelect.value;
                if (titre.length < 3) {
                    message(zoneMessage, 'Le titre doit contenir au moins 3 caractères.', 'danger');
                    return;
                }
                let donnees = null;

                if (type === 'quiz') {
                    const questions = [];
                    let erreur = null;
                    champs.querySelectorAll('.question-card').forEach(function (carte) {
                        const intitule = carte.querySelector('.question-text').value.trim();
                        const options = [];
                        let bonne = -1;
                        carte.querySelectorAll('.options-container .input-group').forEach(function (groupe, index) {
                            const texte = groupe.querySelector('.option-text').value.trim();
                            if (!texte) return;
                            options.push(texte);
                            if (groupe.querySelector('.correct-answer').checked) bonne = options.length - 1;
                        });
                        const explication = carte.querySelector('.explanation').value.trim();
                        if (!intitule || options.length < 2 || bonne === -1) {
                            erreur = 'Chaque question doit avoir un énoncé, au moins deux options et une bonne réponse cochée.';
                            return;
                        }
                        questions.push({ question: intitule, options: options, answer: bonne, explanation: explication });
                    });
                    if (erreur) { message(zoneMessage, erreur, 'danger'); return; }
                    if (!questions.length) { message(zoneMessage, 'Ajoutez au moins une question complète.', 'danger'); return; }
                    donnees = { titre: titre, type: type, actif: editeur.querySelector('#exo-actif').checked, temps: Number(editeur.querySelector('#exo-temps').value) || 30, questions: questions };
                } else if (type === 'matching') {
                    const paires = [];
                    let erreur = null;
                    champs.querySelectorAll('.pair-card').forEach(function (carte) {
                        const item = carte.querySelector('.pair-item').value.trim();
                        const match = carte.querySelector('.pair-match').value.trim();
                        if (!item || !match) {
                            erreur = 'Chaque paire doit comporter un élément et une correspondance.';
                            return;
                        }
                        paires.push({ item: item, match: match });
                    });
                    if (erreur) { message(zoneMessage, erreur, 'danger'); return; }
                    if (paires.length < 2) { message(zoneMessage, 'Ajoutez au moins deux paires.', 'danger'); return; }
                    donnees = { titre: titre, type: type, actif: editeur.querySelector('#exo-actif').checked, pairs: paires };
                } else {
                    const texte = champs.querySelector('#exo-texte').value.trim();
                    const trouves = texte.match(/\[([^\]]+)\]/g) || [];
                    if (!trouves.length) {
                        message(zoneMessage, 'Entourez au moins un mot avec des crochets pour créer un trou.', 'danger');
                        return;
                    }
                    const reponses = trouves.map(function (t) { return t.replace(/[\[\]]/g, '').trim(); });
                    const leurres = champs.querySelector('#exo-leurres').value.split(',')
                        .map(function (mot) { return mot.trim(); })
                        .filter(function (mot) { return mot && reponses.indexOf(mot) === -1; });
                    const html = texte.replace(/\r?\n/g, ' ').replace(/\[([^\]]+)\]/g, function (_, mot) {
                        return "<span class='blank' data-answer='" + mot.trim() + "'></span>";
                    });
                    donnees = {
                        titre: titre,
                        type: type,
                        actif: editeur.querySelector('#exo-actif').checked,
                        quotes: [{ text: html, words: reponses.concat(leurres) }]
                    };
                }

                donnees.matiere = inner.querySelector('#exo-matiere').value;

                const enregistre = exercice
                    ? window.LearnHubStore.exercices.save(Object.assign({}, donnees, { id: exercice.id }))
                    : window.LearnHubStore.exercices.save(donnees);

                if (!enregistre) {
                    message(zoneMessage, 'Enregistrement impossible : le stockage du navigateur est plein ou bloqué.', 'danger');
                    return;
                }
                fermerEditeur();
                rafraichir();
                message(zoneMessage, 'Exercice « ' + titre + ' » enregistré.', 'success');
            });
        }

        function fermerEditeur() {
            editeur.classList.add('d-none');
            editeur.innerHTML = '';
        }

        racine.querySelector('#nouvel-exercice').addEventListener('click', function () {
            ouvrirEditeur(null);
            editeur.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        racine.querySelector('#importer-demo-exercices').addEventListener('click', function () {
            const importes = window.LearnHubStore.exercices.importerDemo();
            message(
                zoneMessage,
                importes ? importes + ' exercice(s) copié(s) dans votre espace.' : 'Tous les exercices de démonstration sont déjà dans votre espace.',
                importes ? 'success' : 'warning'
            );
            rafraichir();
        });

        liste.addEventListener('click', function (event) {
            const bouton = event.target.closest('button[data-action]');
            if (!bouton) return;
            const exercice = window.LearnHubStore.exercices.get(bouton.dataset.id);
            if (!exercice) return;

            if (bouton.dataset.action === 'editer') {
                ouvrirEditeur(exercice);
                editeur.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (bouton.dataset.action === 'basculer') {
                window.LearnHubStore.exercices.toggle(exercice.id);
                message(zoneMessage, 'Statut de « ' + exercice.titre + ' » modifié.', 'success');
                rafraichir();
            } else if (bouton.dataset.action === 'supprimer') {
                if (window.confirm('Supprimer définitivement « ' + exercice.titre + ' » ?')) {
                    window.LearnHubStore.exercices.remove(exercice.id);
                    message(zoneMessage, 'Exercice supprimé.', 'success');
                    rafraichir();
                }
            }
        });

        filtre.addEventListener('input', rafraichir);
        rafraichir();
    }

    /* -------------------------------- Ressources -------------------------------- */

    function renderRessources(racine) {
        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                '<h2 class="mb-0"><i class="fas fa-file-pdf me-2"></i>Ressources</h2>' +
                '<button class="btn btn-primary btn-sm" id="nouvelle-ressource"><i class="fas fa-plus me-1"></i>Ajouter une ressource</button>' +
            '</div>' +
            '<div id="formulaire-ressource" class="d-none"></div>' +
            '<div class="admin-panel"><div id="liste-ressources"></div></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const formulaire = racine.querySelector('#formulaire-ressource');
        const liste = racine.querySelector('#liste-ressources');

        function rafraichir() {
            const ressources = window.LearnHubStore.ressources.miens();
            if (!ressources.length) {
                liste.innerHTML = '<p class="text-muted mb-0">Aucune ressource dans votre espace. Ajoutez un lien ou un document PDF.</p>';
                return;
            }
            liste.innerHTML =
                '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                    '<thead><tr><th>Titre</th><th>Type</th><th>Format</th><th>Date</th><th class="text-end">Actions</th></tr></thead>' +
                    '<tbody>' + ressources.map(function (res) {
                        return '<tr>' +
                            '<td class="fw-semibold">' + esc(res.titre) + '</td>' +
                            '<td>' + esc(res.type) + '</td>' +
                            '<td class="text-muted small">' + esc(res.taille || '—') + '</td>' +
                            '<td class="text-muted small">' + formaterDate(res.date) + '</td>' +
                            '<td class="text-end text-nowrap">' +
                                '<a class="btn btn-sm btn-outline-primary me-1" href="' + esc(res.url) + '" target="_blank" rel="noopener" title="Ouvrir"><i class="fas fa-eye"></i></a>' +
                                '<a class="btn btn-sm btn-outline-secondary me-1" href="' + esc(res.url) + '" download="' + esc(res.titre) + '" title="Télécharger"><i class="fas fa-download"></i></a>' +
                                '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-id="' + esc(res.id) + '" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                            '</td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                '</table></div>' +
                '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>Les documents importés sont conservés dans le navigateur (localStorage) : ils ne sont pas partagés entre appareils.</p>';
        }

        racine.querySelector('#nouvelle-ressource').addEventListener('click', function () {
            formulaire.classList.remove('d-none');
            formulaire.innerHTML =
                '<div class="admin-panel border border-primary">' +
                    '<h4 class="mb-3">Nouvelle ressource</h4>' +
                    '<div class="row g-3">' +
                        '<div class="col-md-6"><label class="form-label">Titre</label><input type="text" class="form-control" id="res-titre"></div>' +
                        '<div class="col-md-6"><label class="form-label">Type</label>' +
                            '<select class="form-select" id="res-type">' +
                                ['Fiche de lecture', 'Corrigé', 'Cours', 'Exercice', 'Vidéo', 'Lien externe'].map(function (type) {
                                    return '<option value="' + type + '">' + type + '</option>';
                                }).join('') +
                            '</select></div>' +
                        '<div class="col-md-6"><label class="form-label">Lien (URL ou ancre interne)</label><input type="text" class="form-control" id="res-url" placeholder="#/cours/une-si-longue-lettre"></div>' +
                        '<div class="col-md-6"><label class="form-label">… ou fichier PDF (max 1,5 Mo)</label><input type="file" class="form-control" id="res-fichier" accept="application/pdf"></div>' +
                    '</div>' +
                    '<div class="d-flex gap-2 mt-3">' +
                        '<button class="btn btn-primary" id="enregistrer-ressource"><i class="fas fa-floppy-disk me-1"></i>Enregistrer</button>' +
                        '<button class="btn btn-outline-secondary" id="annuler-ressource">Annuler</button>' +
                    '</div>' +
                '</div>';

            formulaire.querySelector('#annuler-ressource').addEventListener('click', function () {
                formulaire.classList.add('d-none');
                formulaire.innerHTML = '';
            });

            formulaire.querySelector('#enregistrer-ressource').addEventListener('click', function () {
                const titre = formulaire.querySelector('#res-titre').value.trim();
                const type = formulaire.querySelector('#res-type').value;
                const url = formulaire.querySelector('#res-url').value.trim();
                const fichier = formulaire.querySelector('#res-fichier').files[0];

                if (titre.length < 3) {
                    message(zoneMessage, 'Le titre doit contenir au moins 3 caractères.', 'danger');
                    return;
                }

                function enregistrerLien(lien, taille) {
                    const ok = window.LearnHubStore.ressources.save({
                        titre: titre,
                        type: type,
                        url: lien,
                        taille: taille,
                        date: new Date().toISOString()
                    });
                    if (!ok) {
                        message(zoneMessage, 'Enregistrement impossible : le stockage du navigateur est plein.', 'danger');
                        return;
                    }
                    formulaire.classList.add('d-none');
                    formulaire.innerHTML = '';
                    rafraichir();
                    message(zoneMessage, 'Ressource ajoutée.', 'success');
                }

                if (fichier) {
                    if (fichier.type !== 'application/pdf') {
                        message(zoneMessage, 'Seuls les fichiers PDF sont acceptés.', 'danger');
                        return;
                    }
                    if (fichier.size > LIMITE_FICHIER) {
                        message(zoneMessage, 'Fichier trop volumineux (1,5 Mo maximum pour un stockage local).', 'danger');
                        return;
                    }
                    const lecteur = new FileReader();
                    lecteur.onload = function () {
                        enregistrerLien(lecteur.result, Math.round(fichier.size / 1024) + ' Ko');
                    };
                    lecteur.onerror = function () {
                        message(zoneMessage, 'Lecture du fichier impossible.', 'danger');
                    };
                    lecteur.readAsDataURL(fichier);
                    return;
                }

                if (!url) {
                    message(zoneMessage, 'Indiquez un lien ou sélectionnez un fichier PDF.', 'danger');
                    return;
                }
                enregistrerLien(url, 'Lien');
            });
        });

        liste.addEventListener('click', function (event) {
            const bouton = event.target.closest('button[data-action="supprimer"]');
            if (!bouton) return;
            if (window.confirm('Supprimer cette ressource ?')) {
                window.LearnHubStore.ressources.remove(bouton.dataset.id);
                rafraichir();
                message(zoneMessage, 'Ressource supprimée.', 'success');
            }
        });

        rafraichir();
    }

    /* -------------------------------- Utilisateurs -------------------------------- */

    function renderUtilisateurs(racine) {
        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<h2 class="mb-3"><i class="fas fa-users me-2"></i>Utilisateurs</h2>' +
            '<div class="admin-panel"><div id="liste-utilisateurs"></div></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const liste = racine.querySelector('#liste-utilisateurs');

        function rafraichir() {
            const users = elevesEspace();
            if (!users.length) {
                liste.innerHTML = '<p class="text-muted mb-0">Aucun élève dans vos classes. Créez une classe dans l\'onglet « Classes » et partagez son code d\'inscription.</p>' +
                    '<p class="text-muted small mt-2 mb-0"><i class="fas fa-circle-info me-1"></i>Gérez votre propre compte depuis l\'onglet « Paramètres ».</p>';
                return;
            }
            liste.innerHTML =
                '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                    '<thead><tr><th>Élève</th><th>E-mail</th><th>Classe</th><th>Rôle</th><th>Tentatives</th><th>Moyenne</th><th class="text-end">Actions</th></tr></thead>' +
                    '<tbody>' + users.map(function (user) {
                        const tentatives = window.LearnHubAuth.attempts(user.username);
                        const moyenne = moyennePourcentage(tentatives);
                        const classe = window.LearnHubStore.classes.get(user.classeId);
                        return '<tr>' +
                            '<td class="fw-semibold">' + esc(user.username) + '</td>' +
                            '<td class="text-muted small">' + esc(user.email) + '</td>' +
                            '<td class="small">' + esc(classe ? classe.nom : '—') + '</td>' +
                            '<td>' +
                                '<select class="form-select form-select-sm" data-action="role" data-username="' + esc(user.username) + '" style="max-width:120px">' +
                                    '<option value="eleve" ' + (user.role === 'eleve' ? 'selected' : '') + '>Élève</option>' +
                                    '<option value="admin" ' + (user.role === 'admin' ? 'selected' : '') + '>Admin</option>' +
                                '</select>' +
                            '</td>' +
                            '<td>' + tentatives.length + '</td>' +
                            '<td>' + (moyenne === null ? '—' : moyenne + ' %') + '</td>' +
                            '<td class="text-end text-nowrap">' +
                                '<button class="btn btn-sm btn-outline-secondary me-1" data-action="reinitialiser" data-username="' + esc(user.username) + '" title="Réinitialiser la progression"><i class="fas fa-rotate-left"></i></button>' +
                                '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-username="' + esc(user.username) + '" title="Supprimer le compte"><i class="fas fa-trash"></i></button>' +
                            '</td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                '</table></div>' +
                '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>Seuls les élèves rattachés à vos classes apparaissent ici. Les comptes sont enregistrés dans le navigateur : ils ne sont pas partagés entre appareils.</p>';
        }

        liste.addEventListener('change', function (event) {
            const select = event.target.closest('select[data-action="role"]');
            if (!select) return;
            const resultat = window.LearnHubAuth.setRole(select.dataset.username, select.value);
            if (!resultat.ok) {
                message(zoneMessage, resultat.error, 'danger');
                rafraichir();
                return;
            }
            message(zoneMessage, 'Rôle mis à jour.', 'success');
            rafraichir();
        });

        liste.addEventListener('click', function (event) {
            const bouton = event.target.closest('button[data-action]');
            if (!bouton) return;
            const username = bouton.dataset.username;

            if (bouton.dataset.action === 'reinitialiser') {
                if (window.confirm('Effacer la progression de ' + username + ' ?')) {
                    window.LearnHubAuth.clearProgress(username);
                    rafraichir();
                    message(zoneMessage, 'Progression réinitialisée.', 'success');
                }
            } else if (bouton.dataset.action === 'supprimer') {
                if (window.confirm('Supprimer définitivement le compte ' + username + ' ?')) {
                    const resultat = window.LearnHubAuth.removeUser(username);
                    if (!resultat.ok) {
                        message(zoneMessage, resultat.error, 'danger');
                        return;
                    }
                    rafraichir();
                    message(zoneMessage, 'Compte supprimé.', 'success');
                }
            }
        });

        rafraichir();
    }

    /* -------------------------------- Statistiques -------------------------------- */

    function renderStatistiques(racine) {
        const exercices = window.LearnHubStore.exercices.miens();
        const tentatives = tentativesEspace();
        const moyenne = moyennePourcentage(tentatives);
        const reussites = tentatives.filter(function (t) { return t.total > 0 && t.score / t.total >= 0.6; }).length;
        const tauxReussite = tentatives.length ? Math.round((reussites / tentatives.length) * 100) : 0;

        const parExercice = exercices.map(function (ex) {
            const essais = tentatives.filter(function (t) { return t.exerciceId === ex.id; });
            return {
                titre: ex.titre,
                type: ex.type,
                matiere: ex.matiere,
                essais: essais.length,
                moyenne: moyennePourcentage(essais)
            };
        }).filter(function (item) { return item.essais > 0; });

        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                '<h2 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Statistiques</h2>' +
                '<button class="btn btn-outline-primary btn-sm" id="export-csv"><i class="fas fa-file-csv me-1"></i>Exporter en CSV</button>' +
            '</div>' +
            '<div class="row g-3 mb-4">' +
                carte('bg-primary', 'fa-pen-to-square', 'Tentatives', tentatives.length, 'tous exercices confondus') +
                carte('bg-success', 'fa-percent', 'Moyenne générale', (moyenne === null ? '—' : moyenne + ' %'), 'sur l\'ensemble des essais') +
                carte('bg-warning', 'fa-thumbs-up', 'Taux de réussite', tauxReussite + ' %', 'score supérieur ou égal à 60 %') +
                carte('bg-info', 'fa-users', 'Apprenants actifs', new Set(tentatives.map(function (t) { return t.username; })).size, 'au moins un essai') +
            '</div>' +
            '<div class="admin-panel">' +
                '<h4 class="mb-3">Résultats par exercice</h4>' +
                (parExercice.length
                    ? '<div class="table-responsive"><table class="table align-middle mb-0">' +
                        '<thead><tr><th>Exercice</th><th>Matière</th><th>Type</th><th>Tentatives</th><th>Moyenne</th><th style="width:30%">Progression</th></tr></thead>' +
                        '<tbody>' + parExercice.map(function (item) {
                            return '<tr>' +
                                '<td class="fw-semibold">' + esc(item.titre) + '</td>' +
                                '<td><span class="badge bg-primary bg-opacity-10 text-primary">' + esc(nomMatiere(item.matiere)) + '</span></td>' +
                                '<td>' + esc(LIBELLES_TYPES[item.type] || item.type) + '</td>' +
                                '<td>' + item.essais + '</td>' +
                                '<td>' + item.moyenne + ' %</td>' +
                                '<td><div class="progress" style="height:10px"><div class="progress-bar" style="width:' + item.moyenne + '%"></div></div></td>' +
                            '</tr>';
                        }).join('') + '</tbody></table></div>'
                    : '<p class="text-muted mb-0">Aucun résultat enregistré. Les statistiques se remplissent dès qu\'un élève termine un exercice.</p>') +
            '</div>' +
            '<div class="admin-panel mt-4">' +
                '<h4 class="mb-3">Dernières tentatives</h4>' +
                (tentatives.length
                    ? '<div class="table-responsive"><table class="table table-sm align-middle mb-0">' +
                        '<thead><tr><th>Élève</th><th>Exercice</th><th>Score</th><th>Date</th></tr></thead>' +
                        '<tbody>' + tentatives.slice(0, 15).map(function (t) {
                            return '<tr>' +
                                '<td>' + esc(t.username) + '</td>' +
                                '<td>' + esc(t.titre) + '</td>' +
                                '<td>' + t.score + '/' + t.total + '</td>' +
                                '<td class="text-muted small">' + formaterDateHeure(t.date) + '</td>' +
                            '</tr>';
                        }).join('') + '</tbody></table></div>'
                    : '<p class="text-muted mb-0">Aucune tentative enregistrée.</p>') +
            '</div>';

        racine.querySelector('#export-csv').addEventListener('click', function () {
            if (!tentatives.length) {
                message(racine.querySelector('#admin-message'), 'Aucune donnée à exporter.', 'warning');
                return;
            }
            const lignes = [['eleve', 'exercice', 'type', 'score', 'total', 'date']].concat(tentatives.map(function (t) {
                return [t.username, t.titre, t.type, t.score, t.total, t.date];
            }));
            const csv = lignes.map(function (ligne) {
                return ligne.map(function (cellule) {
                    return '"' + String(cellule).replace(/"/g, '""') + '"';
                }).join(';');
            }).join('\r\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
            const lien = document.createElement('a');
            lien.href = URL.createObjectURL(blob);
            lien.download = 'learnhub-resultats.csv';
            document.body.appendChild(lien);
            lien.click();
            document.body.removeChild(lien);
            URL.revokeObjectURL(lien.href);
        });
    }

    /* --------------------------------- Paramètres --------------------------------- */

    function renderParametres(racine) {
        const settings = window.LearnHubStore.settings.get();
        const courant = window.LearnHubAuth.current();
        const espace = window.LearnHubAuth.monEspace();

        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<h2 class="mb-3"><i class="fas fa-cogs me-2"></i>Paramètres</h2>' +
            '<div class="admin-panel">' +
                '<h4 class="mb-3"><i class="fas fa-door-open me-2"></i>Mon espace</h4>' +
                '<p class="text-muted small">Chaque administrateur travaille dans son propre espace : exercices, ressources, classes et séances sont cloisonnés.</p>' +
                '<div class="row g-3 align-items-end">' +
                    '<div class="col-md-8"><label class="form-label" for="espace-nom">Nom de mon espace</label>' +
                        '<input type="text" class="form-control" id="espace-nom" value="' + esc(espace ? espace.nom : '') + '"></div>' +
                    '<div class="col-md-4"><button class="btn btn-outline-primary w-100" id="renommer-espace"><i class="fas fa-floppy-disk me-1"></i>Enregistrer le nom</button></div>' +
                '</div>' +
                '<p class="text-muted small mt-2 mb-0">Identifiant technique : <code>' + esc(espace ? espace.id : '—') + '</code></p>' +
            '</div>' +
            '<div class="admin-panel">' +
                '<h4 class="mb-3">Réglages des exercices</h4>' +
                '<div class="row g-3">' +
                    '<div class="col-md-4"><label class="form-label" for="set-temps">Temps par question (secondes)</label>' +
                        '<input type="number" min="5" max="300" class="form-control" id="set-temps" value="' + settings.tempsQuestion + '"></div>' +
                    '<div class="col-md-4"><label class="form-label" for="set-tentatives">Tentatives maximales par exercice</label>' +
                        '<input type="number" min="0" max="50" class="form-control" id="set-tentatives" value="' + settings.tentativesMax + '">' +
                        '<div class="form-text">0 = tentatives illimitées.</div></div>' +
                '</div>' +
                '<div class="form-check form-switch mt-4">' +
                    '<input class="form-check-input" type="checkbox" id="set-corrections" ' + (settings.afficherCorrections ? 'checked' : '') + '>' +
                    '<label class="form-check-label" for="set-corrections">Afficher les corrections et explications après chaque réponse</label>' +
                '</div>' +
                '<div class="form-check form-switch mb-4">' +
                    '<input class="form-check-input" type="checkbox" id="set-melanger" ' + (settings.melangerQuestions ? 'checked' : '') + '>' +
                    '<label class="form-check-label" for="set-melanger">Ordonner aléatoirement les questions des quiz</label>' +
                '</div>' +
                '<button class="btn btn-primary" id="enregistrer-parametres"><i class="fas fa-floppy-disk me-1"></i>Enregistrer les paramètres</button>' +
            '</div>' +
            (courant
                ? '<div class="admin-panel">' +
                    '<h4 class="mb-3">Mon compte</h4>' +
                    '<p class="text-muted small">Connecté en tant que <strong>' + esc(courant.username) + '</strong> (' + esc(courant.role) + ').</p>' +
                    '<div class="row g-3">' +
                        '<div class="col-md-4"><label class="form-label" for="mdp-actuel">Mot de passe actuel</label><input type="password" class="form-control" id="mdp-actuel"></div>' +
                        '<div class="col-md-4"><label class="form-label" for="mdp-nouveau">Nouveau mot de passe</label><input type="password" class="form-control" id="mdp-nouveau"></div>' +
                        '<div class="col-md-4 d-flex align-items-end"><button class="btn btn-outline-primary w-100" id="changer-mdp">Modifier</button></div>' +
                    '</div>' +
                '</div>'
                : '') +
            '<div class="admin-panel border border-danger">' +
                '<h4 class="mb-2 text-danger">Contenu de mon espace</h4>' +
                '<p class="text-muted small mb-3">Ces actions ne concernent que votre espace : les contenus des autres administrateurs ne sont pas modifiés.</p>' +
                '<div class="d-flex flex-wrap gap-2">' +
                    '<button class="btn btn-outline-primary" id="importer-demo-parametres"><i class="fas fa-download me-1"></i>Importer la bibliothèque de démonstration</button>' +
                    '<button class="btn btn-outline-danger" id="vider-espace"><i class="fas fa-trash me-1"></i>Vider mon espace</button>' +
                '</div>' +
            '</div>';

        const zoneMessage = racine.querySelector('#admin-message');

        racine.querySelector('#renommer-espace').addEventListener('click', function () {
            const resultat = window.LearnHubAuth.renommerEspace(racine.querySelector('#espace-nom').value);
            message(zoneMessage, resultat.ok ? 'Nom de l\'espace enregistré.' : resultat.error, resultat.ok ? 'success' : 'danger');
        });

        racine.querySelector('#enregistrer-parametres').addEventListener('click', function () {
            const temps = Number(racine.querySelector('#set-temps').value);
            const tentatives = Number(racine.querySelector('#set-tentatives').value);
            if (!temps || temps < 5) {
                message(zoneMessage, 'Le temps par question doit être au moins de 5 secondes.', 'danger');
                return;
            }
            const enregistre = window.LearnHubStore.settings.save({
                tempsQuestion: temps,
                tentativesMax: Math.max(0, tentatives || 0),
                afficherCorrections: racine.querySelector('#set-corrections').checked,
                melangerQuestions: racine.querySelector('#set-melanger').checked
            });
            message(zoneMessage, enregistre ? 'Paramètres enregistrés.' : 'Enregistrement impossible.', enregistre ? 'success' : 'danger');
        });

        const boutonMdp = racine.querySelector('#changer-mdp');
        if (boutonMdp) {
            boutonMdp.addEventListener('click', async function () {
                const actuel = racine.querySelector('#mdp-actuel').value;
                const nouveau = racine.querySelector('#mdp-nouveau').value;
                const resultat = await window.LearnHubAuth.changePassword(courant.username, actuel, nouveau);
                message(zoneMessage, resultat.ok ? 'Mot de passe modifié.' : resultat.error, resultat.ok ? 'success' : 'danger');
                if (resultat.ok) {
                    racine.querySelector('#mdp-actuel').value = '';
                    racine.querySelector('#mdp-nouveau').value = '';
                }
            });
        }

        racine.querySelector('#importer-demo-parametres').addEventListener('click', function () {
            const importes = window.LearnHubStore.exercices.importerDemo();
            message(
                zoneMessage,
                importes ? importes + ' exercice(s) ajouté(s) à votre espace.' : 'La bibliothèque est déjà présente dans votre espace.',
                importes ? 'success' : 'warning'
            );
        });

        racine.querySelector('#vider-espace').addEventListener('click', function () {
            if (!window.confirm('Supprimer tous vos exercices, leçons, ressources et séances ? Vos classes et les comptes élèves sont conservés.')) return;
            const resultat = window.LearnHubStore.viderEspace();
            if (!resultat) {
                message(zoneMessage, 'Aucun espace actif.', 'danger');
                return;
            }
            message(
                zoneMessage,
                'Espace vidé : ' + resultat.exercices + ' exercice(s), ' + resultat.lecons + ' leçon(s), ' + resultat.ressources + ' ressource(s) et ' + resultat.seances + ' séance(s) supprimés.',
                'success'
            );
        });
    }

    /* ---------------------------------- Classes ---------------------------------- */

    function copierTexte(texte, zoneMessage) {
        const confirmer = function () {
            message(zoneMessage, 'Code « ' + texte + ' » copié dans le presse-papiers.', 'success');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texte).then(confirmer).catch(function () {
                window.prompt('Copiez ce code :', texte);
            });
        } else {
            window.prompt('Copiez ce code :', texte);
        }
    }

    function renderClasses(racine) {
        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                '<h2 class="mb-0"><i class="fas fa-users-rectangle me-2"></i>Mes classes</h2>' +
                '<button class="btn btn-primary btn-sm" id="nouvelle-classe"><i class="fas fa-plus me-1"></i>Nouvelle classe</button>' +
            '</div>' +
            '<p class="text-muted small">Chaque classe possède un code à communiquer à vos élèves : ils le saisissent dans « Ma progression » pour rejoindre votre espace.</p>' +
            '<div id="editeur-classe" class="d-none"></div>' +
            '<div class="admin-panel"><div id="liste-classes"></div></div>' +
            '<div id="membres-classe"></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const editeur = racine.querySelector('#editeur-classe');
        const liste = racine.querySelector('#liste-classes');
        const zoneMembres = racine.querySelector('#membres-classe');
        let classeAffichee = null;

        function rafraichir() {
            const classes = window.LearnHubStore.classes.miens();
            if (!classes.length) {
                liste.innerHTML = '<p class="text-muted mb-0">Vous n\'avez encore aucune classe. Créez-en une pour organiser vos séances et suivre vos élèves.</p>';
                return;
            }
            const seances = window.LearnHubStore.seances.miens();
            liste.innerHTML =
                '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                    '<thead><tr><th>Classe</th><th>Niveau</th><th>Code d\'inscription</th><th>Élèves</th><th>Séances</th><th class="text-end">Actions</th></tr></thead>' +
                    '<tbody>' + classes.map(function (classe) {
                        const membres = window.LearnHubAuth.membresClasse(classe.id);
                        const nombreSeances = seances.filter(function (s) {
                            const cibles = s.classeIds || [];
                            return !cibles.length || cibles.indexOf(classe.id) >= 0;
                        }).length;
                        const niveau = classe.niveau ? window.LearnHubData.getNiveau(classe.niveau) : null;
                        return '<tr>' +
                            '<td class="fw-semibold">' + esc(classe.nom) +
                                (classe.description ? '<div class="small text-muted fw-normal">' + esc(classe.description) + '</div>' : '') + '</td>' +
                            '<td class="small">' + esc(niveau ? niveau.nom : 'Tous niveaux') + '</td>' +
                            '<td><span class="badge bg-primary me-1">' + esc(classe.code) + '</span>' +
                                '<button class="btn btn-sm btn-outline-secondary" data-action="copier" data-id="' + esc(classe.id) + '" title="Copier le code"><i class="fas fa-copy"></i></button></td>' +
                            '<td>' + membres.length + '</td>' +
                            '<td>' + nombreSeances + '</td>' +
                            '<td class="text-end text-nowrap">' +
                                '<button class="btn btn-sm btn-outline-secondary me-1" data-action="membres" data-id="' + esc(classe.id) + '" title="Voir les élèves"><i class="fas fa-user-group"></i></button>' +
                                '<button class="btn btn-sm btn-outline-primary me-1" data-action="editer" data-id="' + esc(classe.id) + '" title="Modifier"><i class="fas fa-edit"></i></button>' +
                                '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-id="' + esc(classe.id) + '" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                            '</td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                '</table></div>';
        }

        function ouvrirEditeur(classe) {
            editeur.classList.remove('d-none');
            editeur.innerHTML =
                '<form class="admin-panel border border-primary" id="form-classe">' +
                    '<div class="d-flex justify-content-between align-items-center mb-3">' +
                        '<h4 class="mb-0">' + (classe ? 'Modifier la classe' : 'Nouvelle classe') + '</h4>' +
                        '<button type="button" class="btn btn-sm btn-outline-secondary" id="fermer-classe"><i class="fas fa-xmark"></i></button>' +
                    '</div>' +
                    '<div class="row g-3">' +
                        '<div class="col-md-5"><label class="form-label" for="classe-nom">Nom de la classe</label>' +
                            '<input type="text" class="form-control" id="classe-nom" maxlength="60" required placeholder="ex. Terminale A" value="' + esc(classe ? classe.nom : '') + '"></div>' +
                        '<div class="col-md-3"><label class="form-label" for="classe-niveau">Niveau</label>' +
                            '<select class="form-select" id="classe-niveau">' +
                                '<option value="">Tous niveaux</option>' +
                                window.LearnHubData.niveaux.map(function (niveau) {
                                    return '<option value="' + esc(niveau.slug) + '" ' + (classe && classe.niveau === niveau.slug ? 'selected' : '') + '>' + esc(niveau.nom) + '</option>';
                                }).join('') +
                            '</select></div>' +
                        '<div class="col-md-4"><label class="form-label" for="classe-description">Description (facultative)</label>' +
                            '<input type="text" class="form-control" id="classe-description" value="' + esc(classe ? classe.description || '' : '') + '"></div>' +
                    '</div>' +
                    '<div class="d-flex gap-2 mt-3">' +
                        '<button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk me-1"></i>Enregistrer</button>' +
                        '<button type="button" class="btn btn-outline-secondary" id="annuler-classe">Annuler</button>' +
                    '</div>' +
                '</form>';

            const form = editeur.querySelector('#form-classe');
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                const nom = editeur.querySelector('#classe-nom').value.trim();
                if (nom.length < 2) {
                    message(zoneMessage, 'Le nom de la classe doit contenir au moins 2 caractères.', 'danger');
                    return;
                }
                const donnees = {
                    nom: nom,
                    niveau: editeur.querySelector('#classe-niveau').value,
                    description: editeur.querySelector('#classe-description').value.trim()
                };
                if (classe) donnees.id = classe.id;
                const enregistre = window.LearnHubStore.classes.save(donnees);
                if (!enregistre) {
                    message(zoneMessage, 'Enregistrement impossible.', 'danger');
                    return;
                }
                fermerEditeur();
                rafraichir();
                message(zoneMessage, classe ? 'Classe mise à jour.' : 'Classe créée. Code d\'inscription : ' + enregistre.code, 'success');
            });
            editeur.querySelector('#fermer-classe').addEventListener('click', fermerEditeur);
            editeur.querySelector('#annuler-classe').addEventListener('click', fermerEditeur);
            editeur.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function fermerEditeur() {
            editeur.classList.add('d-none');
            editeur.innerHTML = '';
        }

        function afficherMembres(classeId) {
            const classe = window.LearnHubStore.classes.get(classeId);
            if (!classe) return;
            classeAffichee = classeId;
            const membres = window.LearnHubAuth.membresClasse(classeId);
            zoneMembres.innerHTML =
                '<div class="admin-panel mt-3">' +
                    '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                        '<h4 class="mb-0"><i class="fas fa-user-group me-2"></i>' + esc(classe.nom) + '</h4>' +
                        '<span class="badge bg-primary">Code ' + esc(classe.code) + '</span>' +
                    '</div>' +
                    (membres.length
                        ? '<ul class="list-group">' + membres.map(function (eleve) {
                            return '<li class="list-group-item d-flex justify-content-between align-items-center">' +
                                '<span><strong>' + esc(eleve.username) + '</strong> <span class="text-muted small">' + esc(eleve.email) + '</span></span>' +
                                '<button class="btn btn-sm btn-outline-danger" data-action="retirer-membre" data-username="' + esc(eleve.username) + '"><i class="fas fa-user-minus me-1"></i>Retirer</button>' +
                            '</li>';
                        }).join('') + '</ul>'
                        : '<p class="text-muted mb-0">Aucun élève inscrit pour le moment.</p>') +
                    '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>Un élève rejoint cette classe en créant un compte puis en saisissant le code <strong>' + esc(classe.code) + '</strong> dans « Ma progression ».</p>' +
                '</div>';
        }

        racine.querySelector('#nouvelle-classe').addEventListener('click', function () {
            ouvrirEditeur(null);
        });

        liste.addEventListener('click', function (event) {
            const bouton = event.target.closest('button[data-action]');
            if (!bouton) return;
            const classe = window.LearnHubStore.classes.get(bouton.dataset.id);
            if (!classe) return;

            if (bouton.dataset.action === 'copier') {
                copierTexte(classe.code, zoneMessage);
            } else if (bouton.dataset.action === 'membres') {
                afficherMembres(classe.id);
            } else if (bouton.dataset.action === 'editer') {
                ouvrirEditeur(classe);
            } else if (bouton.dataset.action === 'supprimer') {
                if (!window.confirm('Supprimer la classe « ' + classe.nom + ' » ? Les élèves seront détachés (leurs comptes sont conservés).')) return;
                window.LearnHubStore.classes.remove(classe.id);
                zoneMembres.innerHTML = '';
                rafraichir();
                message(zoneMessage, 'Classe supprimée.', 'success');
            }
        });

        zoneMembres.addEventListener('click', function (event) {
            const bouton = event.target.closest('button[data-action="retirer-membre"]');
            if (!bouton) return;
            const resultat = window.LearnHubAuth.retirerDeClasse(bouton.dataset.username);
            if (!resultat.ok) {
                message(zoneMessage, resultat.error, 'danger');
                return;
            }
            rafraichir();
            if (classeAffichee) afficherMembres(classeAffichee);
            message(zoneMessage, 'Élève retiré de la classe.', 'success');
        });

        rafraichir();
    }

    /* ---------------------------------- Séances ---------------------------------- */

    function renderSeances(racine) {
        const classes = window.LearnHubStore.classes.miens();
        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                '<h2 class="mb-0"><i class="fas fa-calendar-days me-2"></i>Mes séances</h2>' +
                '<button class="btn btn-primary btn-sm" id="nouvelle-seance"><i class="fas fa-plus me-1"></i>Nouvelle séance</button>' +
            '</div>' +
            '<p class="text-muted small">Une séance rassemble des chapitres et des exercices pour une ou plusieurs de vos classes, à une date donnée.</p>' +
            (classes.length
                ? ''
                : '<div class="alert alert-warning py-2"><i class="fas fa-triangle-exclamation me-1"></i>Aucune classe pour l\'instant : ' +
                    '<a href="#/admin/classes" class="alert-link">créez une classe</a> pour cibler des élèves.</div>') +
            '<div id="editeur-seance" class="d-none"></div>' +
            '<div class="admin-panel"><div id="liste-seances"></div></div>' +
            '<div id="suivi-seance"></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const editeur = racine.querySelector('#editeur-seance');
        const liste = racine.querySelector('#liste-seances');
        const zoneSuivi = racine.querySelector('#suivi-seance');

        function trier(listeSeances) {
            return listeSeances.slice().sort(function (a, b) {
                return new Date(b.date || 0) - new Date(a.date || 0);
            });
        }

        function rafraichir() {
            const seances = trier(window.LearnHubStore.seances.miens());
            if (!seances.length) {
                liste.innerHTML = '<p class="text-muted mb-0">Aucune séance planifiée. Créez votre première séance pour organiser un cours ou une série d\'exercices.</p>';
                return;
            }
            liste.innerHTML =
                '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                    '<thead><tr><th>Date</th><th>Séance</th><th>Classes</th><th>Contenu</th><th>Statut</th><th class="text-end">Actions</th></tr></thead>' +
                    '<tbody>' + seances.map(function (seance) {
                        const cibles = seance.classeIds || [];
                        const chapitres = seance.chapitres || [];
                        const lecons = seance.lecons || [];
                        const exercices = seance.exercices || [];
                        return '<tr>' +
                            '<td class="text-nowrap small">' + formaterDate(seance.date) +
                                '<div class="text-muted">' + (seance.duree || 60) + ' min</div></td>' +
                            '<td class="fw-semibold">' + esc(seance.titre) +
                                (seance.description ? '<div class="small text-muted fw-normal">' + esc(seance.description) + '</div>' : '') + '</td>' +
                            '<td class="small">' + esc(cibles.length ? cibles.map(nomClasse).join(', ') : 'Toutes mes classes') + '</td>' +
                            '<td class="small">' + chapitres.length + ' chapitre(s)<br>' + lecons.length + ' leçon(s)<br>' + exercices.length + ' exercice(s)</td>' +
                            '<td>' + (seance.publie === false
                                ? '<span class="badge bg-secondary">Brouillon</span>'
                                : '<span class="badge bg-success">Publiée</span>') + '</td>' +
                            '<td class="text-end text-nowrap">' +
                                '<button class="btn btn-sm btn-outline-primary me-1" data-action="suivi" data-id="' + esc(seance.id) + '" title="Suivi des résultats"><i class="fas fa-chart-line"></i></button>' +
                                '<button class="btn btn-sm btn-outline-secondary me-1" data-action="editer" data-id="' + esc(seance.id) + '" title="Modifier"><i class="fas fa-edit"></i></button>' +
                                '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-id="' + esc(seance.id) + '" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                            '</td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                '</table></div>';
        }

        function chapitresOptions(selection) {
            return window.LearnHubData.matieres.map(function (matiere) {
                return '<optgroup label="' + esc(matiere.nom) + '">' + matiere.chapitres.map(function (chapitre) {
                    const actif = selection.indexOf(chapitre.id) >= 0 ? ' selected' : '';
                    return '<option value="' + esc(chapitre.id) + '"' + actif + '>' + esc(chapitre.titre) + '</option>';
                }).join('') + '</optgroup>';
            }).join('');
        }

        function ouvrirEditeur(seance) {
            const exercices = window.LearnHubStore.exercices.miens();
            const lecons = window.LearnHubStore.lecons.miens();
            const selectionClasses = seance ? seance.classeIds || [] : [];
            const selectionChapitres = seance ? seance.chapitres || [] : [];
            const selectionLecons = seance ? seance.lecons || [] : [];
            const selectionExercices = seance ? seance.exercices || [] : [];
            editeur.classList.remove('d-none');
            editeur.innerHTML =
                '<form class="admin-panel border border-primary" id="form-seance">' +
                    '<div class="d-flex justify-content-between align-items-center mb-3">' +
                        '<h4 class="mb-0">' + (seance ? 'Modifier la séance' : 'Nouvelle séance') + '</h4>' +
                        '<button type="button" class="btn btn-sm btn-outline-secondary" id="fermer-seance"><i class="fas fa-xmark"></i></button>' +
                    '</div>' +
                    '<div class="row g-3 mb-3">' +
                        '<div class="col-md-6"><label class="form-label" for="seance-titre">Titre</label>' +
                            '<input type="text" class="form-control" id="seance-titre" required placeholder="ex. Révisions Pythagore" value="' + esc(seance ? seance.titre : '') + '"></div>' +
                        '<div class="col-md-3"><label class="form-label" for="seance-date">Date</label>' +
                            '<input type="date" class="form-control" id="seance-date" required value="' + esc(seance && seance.date ? seance.date : '') + '"></div>' +
                        '<div class="col-md-3"><label class="form-label" for="seance-duree">Durée (minutes)</label>' +
                            '<input type="number" min="5" max="480" step="5" class="form-control" id="seance-duree" value="' + (seance && seance.duree ? seance.duree : 60) + '"></div>' +
                    '</div>' +
                    '<div class="mb-3"><label class="form-label" for="seance-description">Consignes (facultatives)</label>' +
                        '<textarea class="form-control" id="seance-description" rows="2">' + esc(seance ? seance.description || '' : '') + '</textarea></div>' +
                    '<div class="row g-3">' +
                        '<div class="col-md-3"><label class="form-label d-block">Classes concernées</label>' +
                            (classes.length
                                ? '<div class="border rounded p-2" style="max-height:220px;overflow:auto">' + classes.map(function (classe) {
                                    const coche = selectionClasses.indexOf(classe.id) >= 0 ? ' checked' : '';
                                    return '<div class="form-check"><input class="form-check-input classe-seance" type="checkbox" value="' + esc(classe.id) + '" id="cl-' + esc(classe.id) + '"' + coche + '>' +
                                        '<label class="form-check-label" for="cl-' + esc(classe.id) + '">' + esc(classe.nom) + '</label></div>';
                                }).join('') + '</div>' +
                                  '<div class="form-text">Aucune case cochée = toutes mes classes.</div>'
                                : '<p class="text-muted small mb-0">Créez d\'abord une classe.</p>') +
                        '</div>' +
                        '<div class="col-md-3"><label class="form-label" for="seance-chapitres">Chapitres du site</label>' +
                            '<select class="form-select" id="seance-chapitres" multiple size="8">' + chapitresOptions(selectionChapitres) + '</select>' +
                            '<div class="form-text">Ctrl/Cmd + clic pour plusieurs chapitres.</div></div>' +
                        '<div class="col-md-3"><label class="form-label d-block">Mes leçons</label>' +
                            (lecons.length
                                ? '<div class="border rounded p-2" style="max-height:220px;overflow:auto">' + lecons.map(function (lecon) {
                                    const coche = selectionLecons.indexOf(lecon.id) >= 0 ? ' checked' : '';
                                    return '<div class="form-check"><input class="form-check-input lecon-seance" type="checkbox" value="' + esc(lecon.id) + '" id="le-' + esc(lecon.id) + '"' + coche + '>' +
                                        '<label class="form-check-label" for="le-' + esc(lecon.id) + '">' + esc(lecon.titre) + '</label></div>';
                                }).join('') + '</div>'
                                : '<p class="text-muted small mb-0">Aucune leçon : créez-en une depuis l\'onglet « Leçons ».</p>') +
                        '</div>' +
                        '<div class="col-md-3"><label class="form-label d-block">Exercices assignés</label>' +
                            (exercices.length
                                ? '<div class="border rounded p-2" style="max-height:220px;overflow:auto">' + exercices.map(function (exercice) {
                                    const coche = selectionExercices.indexOf(exercice.id) >= 0 ? ' checked' : '';
                                    return '<div class="form-check"><input class="form-check-input exercice-seance" type="checkbox" value="' + esc(exercice.id) + '" id="ex-' + esc(exercice.id) + '"' + coche + '>' +
                                        '<label class="form-check-label" for="ex-' + esc(exercice.id) + '">' + esc(exercice.titre) +
                                        ' <span class="text-muted small">(' + esc(LIBELLES_TYPES[exercice.type] || exercice.type) + ')</span></label></div>';
                                }).join('') + '</div>'
                                : '<p class="text-muted small mb-0">Aucun exercice dans votre espace : créez-en un depuis l\'onglet « Exercices ».</p>') +
                        '</div>' +
                    '</div>' +
                    '<div class="form-check form-switch mt-3">' +
                        '<input class="form-check-input" type="checkbox" id="seance-publiee" ' + (!seance || seance.publie !== false ? 'checked' : '') + '>' +
                        '<label class="form-check-label" for="seance-publiee">Publier la séance (visible par les élèves)</label>' +
                    '</div>' +
                    '<div class="d-flex gap-2 mt-3">' +
                        '<button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk me-1"></i>Enregistrer</button>' +
                        '<button type="button" class="btn btn-outline-secondary" id="annuler-seance">Annuler</button>' +
                    '</div>' +
                '</form>';

            const form = editeur.querySelector('#form-seance');
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                const titre = editeur.querySelector('#seance-titre').value.trim();
                const date = editeur.querySelector('#seance-date').value;
                if (titre.length < 3) {
                    message(zoneMessage, 'Le titre de la séance doit contenir au moins 3 caractères.', 'danger');
                    return;
                }
                if (!date) {
                    message(zoneMessage, 'Indiquez la date de la séance.', 'danger');
                    return;
                }
                const donnees = {
                    titre: titre,
                    date: date,
                    duree: Number(editeur.querySelector('#seance-duree').value) || 60,
                    description: editeur.querySelector('#seance-description').value.trim(),
                    classeIds: Array.prototype.slice.call(editeur.querySelectorAll('.classe-seance:checked')).map(function (c) { return c.value; }),
                    chapitres: Array.prototype.slice.call(editeur.querySelector('#seance-chapitres').selectedOptions).map(function (o) { return o.value; }),
                    lecons: Array.prototype.slice.call(editeur.querySelectorAll('.lecon-seance:checked')).map(function (c) { return c.value; }),
                    exercices: Array.prototype.slice.call(editeur.querySelectorAll('.exercice-seance:checked')).map(function (c) { return c.value; }),
                    publie: editeur.querySelector('#seance-publiee').checked
                };
                if (seance) donnees.id = seance.id;
                const enregistre = window.LearnHubStore.seances.save(donnees);
                if (!enregistre) {
                    message(zoneMessage, 'Enregistrement impossible.', 'danger');
                    return;
                }
                fermerEditeur();
                rafraichir();
                message(zoneMessage, seance ? 'Séance mise à jour.' : 'Séance créée.', 'success');
            });
            editeur.querySelector('#fermer-seance').addEventListener('click', fermerEditeur);
            editeur.querySelector('#annuler-seance').addEventListener('click', fermerEditeur);
            editeur.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function fermerEditeur() {
            editeur.classList.add('d-none');
            editeur.innerHTML = '';
        }

        function afficherSuivi(seance) {
            const exercices = seance.exercices || [];
            const cibleIds = (seance.classeIds || []).length
                ? seance.classeIds
                : window.LearnHubStore.classes.miens().map(function (c) { return c.id; });
            const eleves = elevesDesClasses(cibleIds);
            const noms = exercices.map(function (id) {
                const exercice = window.LearnHubStore.exercices.get(id);
                return { id: id, titre: exercice ? exercice.titre : 'Exercice supprimé' };
            });

            zoneSuivi.innerHTML =
                '<div class="admin-panel mt-3">' +
                    '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                        '<h4 class="mb-0"><i class="fas fa-chart-line me-2"></i>Suivi — ' + esc(seance.titre) + '</h4>' +
                        '<span class="text-muted small">' + formaterDate(seance.date) + ' · ' + (seance.duree || 60) + ' min</span>' +
                    '</div>' +
                    (!exercices.length
                        ? '<p class="text-muted mb-0">Aucun exercice assigné à cette séance : ajoutez-en pour suivre les résultats.</p>'
                        : (!eleves.length
                            ? '<p class="text-muted mb-0">Aucun élève inscrit dans les classes concernées.</p>'
                            : '<div class="table-responsive"><table class="table align-middle mb-0">' +
                                '<thead><tr><th>Élève</th><th>Classe</th><th>Exercices réalisés</th><th>Moyenne</th><th>Dernière activité</th><th>Détail</th></tr></thead>' +
                                '<tbody>' + eleves.map(function (eleve) {
                                    const bilan = bilanEleve(eleve.username, exercices);
                                    const classe = window.LearnHubStore.classes.get(eleve.classeId);
                                    const detail = noms.map(function (item) {
                                        const score = bilan.meilleurParExercice[item.id];
                                        return '<span class="badge me-1 ' + (score === undefined ? 'bg-secondary' : score >= 80 ? 'bg-success' : score >= 50 ? 'bg-warning text-dark' : 'bg-danger') + '" title="' + esc(item.titre) + '">' +
                                            esc(item.titre.length > 18 ? item.titre.slice(0, 17) + '…' : item.titre) + (score === undefined ? ' : —' : ' : ' + score + ' %') + '</span>';
                                    }).join('');
                                    return '<tr>' +
                                        '<td class="fw-semibold">' + esc(eleve.username) + '</td>' +
                                        '<td class="small">' + esc(classe ? classe.nom : '—') + '</td>' +
                                        '<td>' + bilan.faits + '/' + exercices.length + '</td>' +
                                        '<td>' + (bilan.moyenne === null ? '—' : bilan.moyenne + ' %') + '</td>' +
                                        '<td class="small text-muted">' + (bilan.derniere ? formaterDateHeure(bilan.derniere) : '—') + '</td>' +
                                        '<td>' + detail + '</td>' +
                                    '</tr>';
                                }).join('') + '</tbody></table></div>')) +
                '</div>';
            zoneSuivi.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        racine.querySelector('#nouvelle-seance').addEventListener('click', function () {
            ouvrirEditeur(null);
        });

        liste.addEventListener('click', function (event) {
            const bouton = event.target.closest('button[data-action]');
            if (!bouton) return;
            const seance = window.LearnHubStore.seances.get(bouton.dataset.id);
            if (!seance) return;

            if (bouton.dataset.action === 'editer') {
                ouvrirEditeur(seance);
            } else if (bouton.dataset.action === 'suivi') {
                afficherSuivi(seance);
            } else if (bouton.dataset.action === 'supprimer') {
                if (!window.confirm('Supprimer la séance « ' + seance.titre + ' » ?')) return;
                window.LearnHubStore.seances.remove(seance.id);
                zoneSuivi.innerHTML = '';
                rafraichir();
                message(zoneMessage, 'Séance supprimée.', 'success');
            }
        });

        rafraichir();
    }

    /* ---------------------------------- Leçons ---------------------------------- */

    function renderLecons(racine) {
        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">' +
                '<h2 class="mb-0"><i class="fas fa-book-open me-2"></i>Mes leçons</h2>' +
                '<button class="btn btn-primary btn-sm" id="nouvelle-lecon"><i class="fas fa-plus me-1"></i>Nouvelle leçon</button>' +
            '</div>' +
            '<p class="text-muted small">Rédigez vos propres leçons : elles restent dans votre espace et peuvent être assignées dans vos séances.</p>' +
            '<div id="editeur-lecon" class="d-none"></div>' +
            '<div class="admin-panel"><div id="liste-lecons"></div></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const editeur = racine.querySelector('#editeur-lecon');
        const liste = racine.querySelector('#liste-lecons');

        function rafraichir() {
            const lecons = window.LearnHubStore.lecons.miens();
            if (!lecons.length) {
                liste.innerHTML = '<p class="text-muted mb-0">Votre espace ne contient encore aucune leçon. Créez-en une pour la proposer dans vos séances.</p>';
                return;
            }
            const seances = window.LearnHubStore.seances.miens();
            liste.innerHTML =
                '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                    '<thead><tr><th>Titre</th><th>Matière</th><th>Niveau</th><th>Durée</th><th>Séances</th><th class="text-end">Actions</th></tr></thead>' +
                    '<tbody>' + lecons.map(function (lecon) {
                        const niveau = lecon.niveau ? window.LearnHubData.getNiveau(lecon.niveau) : null;
                        const usage = seances.filter(function (s) {
                            return (s.lecons || []).indexOf(lecon.id) >= 0;
                        }).length;
                        return '<tr>' +
                            '<td class="fw-semibold">' + esc(lecon.titre) +
                                (lecon.resume ? '<div class="small text-muted fw-normal">' + esc(lecon.resume) + '</div>' : '') + '</td>' +
                            '<td><span class="badge bg-primary bg-opacity-10 text-primary">' + esc(nomMatiere(lecon.matiere)) + '</span></td>' +
                            '<td class="small">' + esc(niveau ? niveau.nom : 'Tous niveaux') + '</td>' +
                            '<td class="small">' + (lecon.duree || 30) + ' min</td>' +
                            '<td>' + usage + '</td>' +
                            '<td class="text-end text-nowrap">' +
                                '<button class="btn btn-sm btn-outline-primary me-1" data-action="editer" data-id="' + esc(lecon.id) + '" title="Modifier"><i class="fas fa-edit"></i></button>' +
                                '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-id="' + esc(lecon.id) + '" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                            '</td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                '</table></div>';
        }

        function ouvrirEditeur(lecon) {
            editeur.classList.remove('d-none');
            editeur.innerHTML =
                '<form class="admin-panel border border-primary" id="form-lecon">' +
                    '<div class="d-flex justify-content-between align-items-center mb-3">' +
                        '<h4 class="mb-0">' + (lecon ? 'Modifier la leçon' : 'Nouvelle leçon') + '</h4>' +
                        '<button type="button" class="btn btn-sm btn-outline-secondary" id="fermer-lecon"><i class="fas fa-xmark"></i></button>' +
                    '</div>' +
                    '<div class="row g-3 mb-3">' +
                        '<div class="col-md-6"><label class="form-label" for="lecon-titre">Titre</label>' +
                            '<input type="text" class="form-control" id="lecon-titre" required placeholder="ex. Méthode de la dissertation" value="' + esc(lecon ? lecon.titre : '') + '"></div>' +
                        '<div class="col-md-3"><label class="form-label" for="lecon-matiere">Matière</label>' +
                            '<select class="form-select" id="lecon-matiere">' +
                                window.LearnHubData.matieres.map(function (matiere) {
                                    const selection = (lecon ? lecon.matiere : 'francais') === matiere.slug;
                                    return '<option value="' + esc(matiere.slug) + '" ' + (selection ? 'selected' : '') + '>' + esc(matiere.nom) + '</option>';
                                }).join('') +
                            '</select></div>' +
                        '<div class="col-md-3"><label class="form-label" for="lecon-niveau">Niveau</label>' +
                            '<select class="form-select" id="lecon-niveau">' +
                                '<option value="">Tous niveaux</option>' +
                                window.LearnHubData.niveaux.map(function (niveau) {
                                    return '<option value="' + esc(niveau.slug) + '" ' + (lecon && lecon.niveau === niveau.slug ? 'selected' : '') + '>' + esc(niveau.nom) + '</option>';
                                }).join('') +
                            '</select></div>' +
                    '</div>' +
                    '<div class="row g-3 mb-3">' +
                        '<div class="col-md-3"><label class="form-label" for="lecon-duree">Durée (minutes)</label>' +
                            '<input type="number" min="5" max="480" step="5" class="form-control" id="lecon-duree" value="' + (lecon && lecon.duree ? lecon.duree : 30) + '"></div>' +
                        '<div class="col-md-9"><label class="form-label" for="lecon-resume">Résumé</label>' +
                            '<input type="text" class="form-control" id="lecon-resume" value="' + esc(lecon ? lecon.resume || '' : '') + '"></div>' +
                    '</div>' +
                    '<div class="mb-3"><label class="form-label" for="lecon-objectifs">Objectifs (un par ligne)</label>' +
                        '<textarea class="form-control" id="lecon-objectifs" rows="3" placeholder="Comprendre la structure d\'une introduction">' +
                        esc(lecon && lecon.objectifs ? lecon.objectifs.join('\n') : '') + '</textarea></div>' +
                    '<div class="mb-3"><label class="form-label" for="lecon-editeur">Contenu de la leçon</label>' +
                        '<div class="rich-toolbar btn-toolbar mb-2" role="toolbar" aria-label="Mise en forme de la leçon">' +
                            '<div class="btn-group btn-group-sm me-2" role="group" aria-label="Style du texte">' +
                                '<button type="button" class="btn btn-outline-secondary" data-cmd="bold" title="Gras"><i class="fas fa-bold"></i></button>' +
                                '<button type="button" class="btn btn-outline-secondary" data-cmd="italic" title="Italique"><i class="fas fa-italic"></i></button>' +
                                '<button type="button" class="btn btn-outline-secondary" data-cmd="underline" title="Souligné"><i class="fas fa-underline"></i></button>' +
                            '</div>' +
                            '<div class="btn-group btn-group-sm me-2" role="group" aria-label="Titres">' +
                                '<button type="button" class="btn btn-outline-secondary" data-block="h2" title="Titre de section">H2</button>' +
                                '<button type="button" class="btn btn-outline-secondary" data-block="h3" title="Sous-titre">H3</button>' +
                                '<button type="button" class="btn btn-outline-secondary" data-block="p" title="Paragraphe">¶</button>' +
                            '</div>' +
                            '<div class="btn-group btn-group-sm me-2" role="group" aria-label="Listes et citation">' +
                                '<button type="button" class="btn btn-outline-secondary" data-cmd="insertUnorderedList" title="Liste à puces"><i class="fas fa-list-ul"></i></button>' +
                                '<button type="button" class="btn btn-outline-secondary" data-cmd="insertOrderedList" title="Liste numérotée"><i class="fas fa-list-ol"></i></button>' +
                                '<button type="button" class="btn btn-outline-secondary" data-block="blockquote" title="Citation"><i class="fas fa-quote-right"></i></button>' +
                            '</div>' +
                            '<div class="btn-group btn-group-sm" role="group" aria-label="Liens et nettoyage">' +
                                '<button type="button" class="btn btn-outline-secondary" data-action="lien" title="Insérer un lien"><i class="fas fa-link"></i></button>' +
                                '<button type="button" class="btn btn-outline-secondary" data-cmd="removeFormat" title="Effacer la mise en forme"><i class="fas fa-eraser"></i></button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="form-control rich-editor" id="lecon-editeur" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="lecon-editeur-label"></div>' +
                        '<span class="visually-hidden" id="lecon-editeur-label">Contenu de la leçon</span>' +
                        '<div class="form-text">Gras, italique, titres, listes, citation et liens. Le contenu est nettoyé automatiquement à l\'enregistrement.</div>' +
                    '</div>' +
                    '<div class="d-flex gap-2">' +
                        '<button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk me-1"></i>Enregistrer</button>' +
                        '<button type="button" class="btn btn-outline-secondary" id="annuler-lecon">Annuler</button>' +
                    '</div>' +
                '</form>';

            const form = editeur.querySelector('#form-lecon');
            const zoneContenu = editeur.querySelector('#lecon-editeur');
            zoneContenu.innerHTML = lecon
                ? (lecon.contenuHtml ? window.LearnHubStore.nettoyerHtml(lecon.contenuHtml) : texteSimpleVersHtml(lecon.contenu))
                : '<p><br></p>';

            zoneContenu.addEventListener('paste', function (event) {
                const html = event.clipboardData && event.clipboardData.getData('text/html');
                if (!html) return;
                event.preventDefault();
                document.execCommand('insertHTML', false, window.LearnHubStore.nettoyerHtml(html));
            });

            const barre = editeur.querySelector('.rich-toolbar');
            barre.addEventListener('mousedown', function (event) {
                event.preventDefault();
            });
            barre.addEventListener('click', function (event) {
                const bouton = event.target.closest('button');
                if (!bouton) return;
                zoneContenu.focus();
                if (bouton.dataset.cmd) {
                    document.execCommand(bouton.dataset.cmd, false, null);
                } else if (bouton.dataset.block) {
                    document.execCommand('formatBlock', false, '<' + bouton.dataset.block + '>');
                } else if (bouton.dataset.action === 'lien') {
                    const url = window.prompt('Adresse du lien (https://…)', 'https://');
                    if (url && /^(https?:\/\/|mailto:)/i.test(url)) {
                        document.execCommand('createLink', false, url);
                    }
                }
                zoneContenu.focus();
            });

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                const titre = editeur.querySelector('#lecon-titre').value.trim();
                const contenuHtml = window.LearnHubStore.nettoyerHtml(zoneContenu.innerHTML);
                const texteContenu = (function () {
                    const conteneur = document.createElement('div');
                    conteneur.innerHTML = contenuHtml;
                    return (conteneur.textContent || '').replace(/\s+/g, ' ').trim();
                })();
                if (titre.length < 3) {
                    message(zoneMessage, 'Le titre de la leçon doit contenir au moins 3 caractères.', 'danger');
                    return;
                }
                if (texteContenu.length < 20) {
                    message(zoneMessage, 'Le contenu de la leçon doit contenir au moins 20 caractères.', 'danger');
                    return;
                }
                const donnees = {
                    titre: titre,
                    matiere: editeur.querySelector('#lecon-matiere').value,
                    niveau: editeur.querySelector('#lecon-niveau').value,
                    duree: Number(editeur.querySelector('#lecon-duree').value) || 30,
                    resume: editeur.querySelector('#lecon-resume').value.trim(),
                    objectifs: editeur.querySelector('#lecon-objectifs').value.split('\n')
                        .map(function (ligne) { return ligne.trim(); })
                        .filter(Boolean),
                    contenu: texteContenu,
                    contenuHtml: contenuHtml
                };
                if (lecon) donnees.id = lecon.id;
                const enregistre = window.LearnHubStore.lecons.save(donnees);
                if (!enregistre) {
                    message(zoneMessage, 'Enregistrement impossible.', 'danger');
                    return;
                }
                fermerEditeur();
                rafraichir();
                message(zoneMessage, lecon ? 'Leçon mise à jour.' : 'Leçon créée.', 'success');
            });
            editeur.querySelector('#fermer-lecon').addEventListener('click', fermerEditeur);
            editeur.querySelector('#annuler-lecon').addEventListener('click', fermerEditeur);
            editeur.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function fermerEditeur() {
            editeur.classList.add('d-none');
            editeur.innerHTML = '';
        }

        racine.querySelector('#nouvelle-lecon').addEventListener('click', function () {
            ouvrirEditeur(null);
        });

        liste.addEventListener('click', function (event) {
            const bouton = event.target.closest('button[data-action]');
            if (!bouton) return;
            const lecon = window.LearnHubStore.lecons.get(bouton.dataset.id);
            if (!lecon) return;

            if (bouton.dataset.action === 'editer') {
                ouvrirEditeur(lecon);
            } else if (bouton.dataset.action === 'supprimer') {
                if (!window.confirm('Supprimer la leçon « ' + lecon.titre + ' » ? Elle sera retirée des séances concernées.')) return;
                window.LearnHubStore.lecons.remove(lecon.id);
                rafraichir();
                message(zoneMessage, 'Leçon supprimée.', 'success');
            }
        });

        rafraichir();
    }

    const SECTIONS = {
        dashboard: renderDashboard,
        classes: renderClasses,
        lecons: renderLecons,
        seances: renderSeances,
        exercices: renderExercices,
        ressources: renderRessources,
        utilisateurs: renderUtilisateurs,
        statistiques: renderStatistiques,
        parametres: renderParametres
    };

    function render(racine, section) {
        const rendu = SECTIONS[section] || SECTIONS.dashboard;
        rendu(racine);
    }

    return {
        render: render,
        sections: Object.keys(SECTIONS)
    };
})();
