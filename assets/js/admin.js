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

    /* ------------------------------ Tableau de bord ------------------------------ */

    function renderDashboard(racine) {
        const exercices = window.LearnHubStore.exercices.all();
        const ressources = window.LearnHubStore.ressources.all();
        const users = window.LearnHubAuth.users();
        const tentatives = toutesLesTentatives();
        const actifs = exercices.filter(function (ex) { return ex.actif !== false; });
        const eleves = users.filter(function (u) { return u.role === 'eleve'; });
        const activite = tentatives.slice(0, 6);

        racine.innerHTML =
            '<div class="row g-3 mb-4">' +
                carte('bg-primary', 'fa-tasks', 'Exercices actifs', actifs.length, exercices.length + ' au total') +
                carte('bg-success', 'fa-users', 'Élèves inscrits', eleves.length, users.length + ' compte(s) au total') +
                carte('bg-warning', 'fa-file-pdf', 'Ressources', ressources.length, 'liens et documents') +
                carte('bg-info', 'fa-chart-simple', 'Tentatives', tentatives.length, 'exercices réalisés') +
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
                            : '<p class="text-muted mb-0">Aucune activité enregistrée pour le moment. Les scores des élèves apparaîtront ici.</p>') +
                    '</div>' +
                '</div>' +
                '<div class="col-lg-5">' +
                    '<div class="admin-panel h-100">' +
                        '<h4 class="mb-3"><i class="fas fa-bolt me-2"></i>Actions rapides</h4>' +
                        '<div class="d-grid gap-2">' +
                            '<a class="btn btn-outline-primary" href="#/admin/exercices"><i class="fas fa-plus me-1"></i>Créer un exercice</a>' +
                            '<a class="btn btn-outline-primary" href="#/admin/ressources"><i class="fas fa-file-arrow-up me-1"></i>Ajouter une ressource</a>' +
                            '<a class="btn btn-outline-secondary" href="#/admin/statistiques"><i class="fas fa-chart-bar me-1"></i>Consulter les statistiques</a>' +
                            '<a class="btn btn-outline-secondary" href="#/exercices"><i class="fas fa-eye me-1"></i>Voir l\'espace élève</a>' +
                        '</div>' +
                        '<hr>' +
                        '<h5 class="mb-2">Répartition des exercices</h5>' +
                        '<ul class="list-unstyled mb-0 small">' +
                            Object.keys(LIBELLES_TYPES).map(function (type) {
                                const nombre = exercices.filter(function (ex) { return ex.type === type; }).length;
                                return '<li class="d-flex justify-content-between border-bottom py-1"><span>' + LIBELLES_TYPES[type] + '</span><span class="fw-bold">' + nombre + '</span></li>';
                            }).join('') +
                        '</ul>' +
                        '<h5 class="mb-2 mt-3">Par matière</h5>' +
                        '<ul class="list-unstyled mb-0 small">' +
                            window.LearnHubData.matieres.map(function (matiere) {
                                const nombre = exercices.filter(function (ex) { return ex.matiere === matiere.slug; }).length;
                                return '<li class="d-flex justify-content-between border-bottom py-1"><span>' + esc(matiere.nom) + '</span><span class="fw-bold">' + nombre + '</span></li>';
                            }).join('') +
                        '</ul>' +
                    '</div>' +
                '</div>' +
            '</div>';
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
                    '<button class="btn btn-primary btn-sm" id="nouvel-exercice"><i class="fas fa-plus me-1"></i>Nouvel exercice</button>' +
                '</div>' +
            '</div>' +
            '<div id="editeur-exercice" class="d-none"></div>' +
            '<div class="admin-panel"><div id="liste-exercices"></div></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const editeur = racine.querySelector('#editeur-exercice');
        const liste = racine.querySelector('#liste-exercices');
        const filtre = racine.querySelector('#filtre-exercices');

        function rafraichir() {
            const recherche = filtre.value.trim().toLowerCase();
            const exercices = window.LearnHubStore.exercices.all().filter(function (ex) {
                if (!recherche) return true;
                return (ex.titre + ' ' + nomMatiere(ex.matiere)).toLowerCase().indexOf(recherche) >= 0;
            });

            if (!exercices.length) {
                liste.innerHTML = '<p class="text-muted mb-0">Aucun exercice ne correspond à cette recherche.</p>';
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
            const ressources = window.LearnHubStore.ressources.all();
            if (!ressources.length) {
                liste.innerHTML = '<p class="text-muted mb-0">Aucune ressource. Ajoutez un lien ou un document PDF.</p>';
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
        const courant = window.LearnHubAuth.current();

        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<h2 class="mb-3"><i class="fas fa-users me-2"></i>Utilisateurs</h2>' +
            '<div class="admin-panel"><div id="liste-utilisateurs"></div></div>';

        const zoneMessage = racine.querySelector('#admin-message');
        const liste = racine.querySelector('#liste-utilisateurs');

        function rafraichir() {
            const users = window.LearnHubAuth.users();
            liste.innerHTML =
                '<div class="table-responsive"><table class="table table-striped align-middle mb-0">' +
                    '<thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôle</th><th>Tentatives</th><th>Moyenne</th><th class="text-end">Actions</th></tr></thead>' +
                    '<tbody>' + users.map(function (user) {
                        const tentatives = window.LearnHubAuth.attempts(user.username);
                        const moyenne = moyennePourcentage(tentatives);
                        const estCourant = courant && courant.username === user.username;
                        return '<tr>' +
                            '<td class="fw-semibold">' + esc(user.username) + (estCourant ? ' <span class="badge bg-info text-dark">vous</span>' : '') + '</td>' +
                            '<td class="text-muted small">' + esc(user.email) + '</td>' +
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
                                '<button class="btn btn-sm btn-outline-danger" data-action="supprimer" data-username="' + esc(user.username) + '" title="Supprimer le compte" ' + (estCourant ? 'disabled' : '') + '><i class="fas fa-trash"></i></button>' +
                            '</td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                '</table></div>' +
                '<p class="text-muted small mt-3 mb-0"><i class="fas fa-circle-info me-1"></i>Les comptes sont enregistrés dans le navigateur. Sur un site sans serveur, ils ne sont pas partagés entre appareils.</p>';
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
        const exercices = window.LearnHubStore.exercices.all();
        const tentatives = toutesLesTentatives();
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

        racine.innerHTML =
            '<div id="admin-message" class="d-none"></div>' +
            '<h2 class="mb-3"><i class="fas fa-cogs me-2"></i>Paramètres</h2>' +
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
                '<h4 class="mb-2 text-danger">Zone de réinitialisation</h4>' +
                '<p class="text-muted small mb-3">Restaure les exercices, ressources et paramètres livrés avec le site. Les comptes et les progressions sont conservés.</p>' +
                '<button class="btn btn-outline-danger" id="reinitialiser-demo"><i class="fas fa-rotate-left me-1"></i>Réinitialiser le contenu</button>' +
            '</div>';

        const zoneMessage = racine.querySelector('#admin-message');

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

        racine.querySelector('#reinitialiser-demo').addEventListener('click', function () {
            if (!window.confirm('Restaurer les exercices et ressources d\'origine ? Les créations seront perdues.')) return;
            localStorage.removeItem(window.LearnHubStore.keys.exercices);
            localStorage.removeItem(window.LearnHubStore.keys.ressources);
            localStorage.removeItem(window.LearnHubStore.keys.settings);
            localStorage.removeItem(window.LearnHubStore.keys.seeded);
            window.LearnHubStore.seedIfNeeded();
            message(zoneMessage, 'Contenu de démonstration restauré.', 'success');
            renderParametres(racine);
        });
    }

    const SECTIONS = {
        dashboard: renderDashboard,
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
