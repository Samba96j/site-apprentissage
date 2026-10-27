/**
 * LearnHub — exercices interactifs (quiz, associations, textes à trous).
 * Chaque vue est reconstruite depuis LearnHubStore : les exercices créés dans
 * le back-office apparaissent donc immédiatement côté élève.
 */
window.LearnHubGames = (function () {
    'use strict';

    let timerId = null;

    function destroy() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function shuffle(array) {
        const copie = array.slice();
        for (let i = copie.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = copie[i];
            copie[i] = copie[j];
            copie[j] = tmp;
        }
        return copie;
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function feedback(zone, message, type) {
        if (!zone) return;
        zone.className = 'feedback mt-3 p-3 rounded bg-' + type + ' bg-opacity-10 text-' + type + ' show';
        zone.textContent = message;
    }

    function viderFeedback(zone) {
        if (!zone) return;
        zone.className = 'feedback mt-3 p-3 rounded';
        zone.textContent = '';
    }

    function tentativesRestantes(exerciceId) {
        const settings = window.LearnHubStore.settings.get();
        const max = Number(settings.tentativesMax) || 0;
        const user = window.LearnHubAuth.current();
        if (!user || max <= 0) return null;
        return Math.max(0, max - window.LearnHubAuth.tentativeCount(user.username, exerciceId));
    }

    function entete(exercice) {
        const user = window.LearnHubAuth.current();
        const restantes = tentativesRestantes(exercice.id);
        let html = '';
        if (!user) {
            html += '<div class="alert alert-info py-2 small mb-3"><i class="fas fa-circle-info me-1"></i>Vous jouez en mode invité : votre score ne sera pas conservé. <a href="#/connexion" class="alert-link">Se connecter</a></div>';
        } else if (restantes !== null) {
            html += '<div class="small text-muted mb-2">Tentatives restantes : ' + restantes + '</div>';
        }
        if (restantes === 0) {
            html += '<div class="alert alert-warning py-2 small mb-3"><i class="fas fa-lock me-1"></i>Nombre maximal de tentatives atteint pour cet exercice. <a href="#/profil" class="alert-link">Voir ma progression</a></div>';
        }
        return html;
    }

    function estBloque(exercice) {
        return tentativesRestantes(exercice.id) === 0;
    }

    function enregistrer(exercice, score, total, onScore) {
        const resultat = window.LearnHubAuth.recordAttempt({
            exerciceId: exercice.id,
            type: exercice.type,
            titre: exercice.titre,
            score: score,
            total: total
        });
        if (onScore) onScore(resultat);
        return resultat;
    }

    /* ------------------------------- Quiz ------------------------------- */

    function renderQuiz(zone, exercices, onScore) {
        const settings = window.LearnHubStore.settings.get();

        if (!exercices.length) {
            zone.innerHTML = '<p class="text-muted mb-0">Aucun quiz actif. Un administrateur peut en créer depuis le back-office.</p>';
            return;
        }

        zone.innerHTML =
            '<div class="d-flex flex-wrap gap-2 align-items-center mb-3">' +
                '<label class="form-label mb-0 small text-muted" for="quiz-select">Quiz :</label>' +
                '<select class="form-select form-select-sm" id="quiz-select" style="max-width: 320px;">' +
                    exercices.map(function (ex) {
                        const nombre = ex.questions.length;
                        return '<option value="' + esc(ex.id) + '">' + esc(ex.titre) + ' (' + nombre + ' question' + (nombre > 1 ? 's' : '') + ')</option>';
                    }).join('') +
                '</select>' +
            '</div>' +
            '<div id="quiz-zone"></div>';

        const select = zone.querySelector('#quiz-select');
        const cible = zone.querySelector('#quiz-zone');

        function charger() {
            destroy();
            const exercice = exercices.find(function (ex) { return ex.id === select.value; }) || exercices[0];
            const questions = settings.melangerQuestions ? shuffle(exercice.questions) : exercice.questions.slice();
            let index = 0;
            let score = 0;
            let actif = true;
            const dureeQuestion = Number(exercice.temps) || Number(settings.tempsQuestion) || 30;
            let secondes = dureeQuestion;

            if (estBloque(exercice)) {
                cible.innerHTML = entete(exercice);
                return;
            }

            cible.innerHTML =
                entete(exercice) +
                '<div class="d-flex align-items-center mb-3">' +
                    '<div class="timer me-3 fw-bold text-accent" id="quiz-timer">' + secondes + '</div>' +
                    '<div class="progress flex-grow-1" style="height: 10px;">' +
                        '<div class="progress-bar" id="quiz-progress" style="width:100%"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="small text-muted mb-1" id="quiz-compteur"></div>' +
                '<h5 class="question mb-3" id="quiz-question"></h5>' +
                '<div class="options" id="quiz-options"></div>' +
                '<div class="feedback my-3 p-3 rounded" id="quiz-feedback"></div>' +
                '<button class="btn btn-primary mt-2 d-none" id="quiz-next">' +
                    '<i class="fas fa-arrow-right me-1"></i>Question suivante' +
                '</button>' +
                '<div class="score-container text-center mt-4 d-none" id="quiz-score-container">' +
                    '<h5 class="final-score text-primary fw-bold" id="quiz-final-score"></h5>' +
                    '<p class="text-muted" id="quiz-score-detail"></p>' +
                    '<button class="btn btn-danger mt-2" id="quiz-restart">' +
                        '<i class="fas fa-redo me-1"></i>Recommencer' +
                    '</button>' +
                '</div>';

            const timerEl = cible.querySelector('#quiz-timer');
            const progressEl = cible.querySelector('#quiz-progress');
            const compteurEl = cible.querySelector('#quiz-compteur');
            const questionEl = cible.querySelector('#quiz-question');
            const optionsEl = cible.querySelector('#quiz-options');
            const zoneFeedback = cible.querySelector('#quiz-feedback');
            const boutonSuivant = cible.querySelector('#quiz-next');
            const scoreContainer = cible.querySelector('#quiz-score-container');
            const scoreFinal = cible.querySelector('#quiz-final-score');
            const scoreDetail = cible.querySelector('#quiz-score-detail');

            function arreterTimer() {
                if (timerId) {
                    clearInterval(timerId);
                    timerId = null;
                }
            }

            function afficherQuestion() {
                if (index >= questions.length) {
                    terminer();
                    return;
                }
                actif = true;
                secondes = dureeQuestion;
                const question = questions[index];
                compteurEl.textContent = 'Question ' + (index + 1) + ' sur ' + questions.length;
                questionEl.textContent = question.question;
                optionsEl.innerHTML = '';
                viderFeedback(zoneFeedback);
                boutonSuivant.classList.add('d-none');
                scoreContainer.classList.add('d-none');
                timerEl.textContent = secondes;
                progressEl.style.width = '100%';

                question.options.forEach(function (option, i) {
                    const bouton = document.createElement('button');
                    bouton.type = 'button';
                    bouton.className = 'option p-3 mb-2 border rounded w-100 text-start bg-white';
                    bouton.textContent = option;
                    bouton.dataset.index = String(i);
                    bouton.addEventListener('click', function () { repondre(i); });
                    optionsEl.appendChild(bouton);
                });

                arreterTimer();
                timerId = setInterval(function () {
                    secondes--;
                    timerEl.textContent = secondes;
                    progressEl.style.width = Math.max(0, (secondes / dureeQuestion) * 100) + '%';
                    if (secondes <= 0) {
                        arreterTimer();
                        tempsEcoule();
                    }
                }, 1000);
            }

            function boutons() {
                return cible.querySelectorAll('#quiz-options .option');
            }

            function tempsEcoule() {
                actif = false;
                const question = questions[index];
                feedback(zoneFeedback, 'Temps écoulé ! La bonne réponse était : ' + question.options[question.answer], 'danger');
                const liste = boutons();
                if (liste[question.answer]) liste[question.answer].classList.add('correct');
                boutonSuivant.classList.remove('d-none');
            }

            function repondre(choix) {
                if (!actif) return;
                arreterTimer();
                actif = false;
                const question = questions[index];
                const liste = boutons();
                if (choix === question.answer) {
                    score++;
                    const explication = settings.afficherCorrections && question.explanation ? ' ' + question.explanation : '';
                    feedback(zoneFeedback, 'Correct !' + explication, 'success');
                    liste[choix].classList.add('correct');
                } else {
                    const explication = settings.afficherCorrections && question.explanation ? ' ' + question.explanation : '';
                    feedback(zoneFeedback, 'Incorrect.' + explication, 'danger');
                    liste[choix].classList.add('wrong');
                    if (liste[question.answer]) liste[question.answer].classList.add('correct');
                }
                boutonSuivant.classList.remove('d-none');
            }

            function terminer() {
                arreterTimer();
                questionEl.textContent = 'Quiz terminé !';
                optionsEl.innerHTML = '';
                compteurEl.textContent = '';
                timerEl.textContent = '';
                progressEl.style.width = '0%';
                viderFeedback(zoneFeedback);
                boutonSuivant.classList.add('d-none');

                const pourcentage = Math.round((score / questions.length) * 100);
                let message = 'Vous pouvez faire mieux !';
                if (pourcentage >= 80) message = 'Excellent !';
                else if (pourcentage >= 60) message = 'Bien joué !';

                scoreFinal.textContent = message + ' Score : ' + score + '/' + questions.length + ' (' + pourcentage + ' %)';
                scoreContainer.classList.remove('d-none');

                const resultat = enregistrer(exercice, score, questions.length, onScore);
                if (!resultat.ok) {
                    scoreDetail.textContent = resultat.error;
                } else {
                    scoreDetail.textContent = 'Score enregistré dans votre progression.';
                }
            }

            boutonSuivant.addEventListener('click', function () {
                index++;
                afficherQuestion();
            });

            cible.querySelector('#quiz-restart').addEventListener('click', function () {
                index = 0;
                score = 0;
                charger();
            });

            afficherQuestion();
        }

        select.addEventListener('change', charger);
        charger();
    }

    /* ---------------------------- Associations ---------------------------- */

    function renderMatching(zone, exercices, onScore) {
        if (!exercices.length) {
            zone.innerHTML = '<p class="text-muted mb-0">Aucun exercice d\'association actif.</p>';
            return;
        }

        zone.innerHTML =
            '<div class="d-flex flex-wrap gap-2 align-items-center mb-3">' +
                '<label class="form-label mb-0 small text-muted" for="matching-select">Exercice :</label>' +
                '<select class="form-select form-select-sm" id="matching-select" style="max-width: 320px;">' +
                    exercices.map(function (ex) {
                        return '<option value="' + esc(ex.id) + '">' + esc(ex.titre) + '</option>';
                    }).join('') +
                '</select>' +
            '</div>' +
            '<div id="matching-zone"></div>';

        const select = zone.querySelector('#matching-select');
        const cible = zone.querySelector('#matching-zone');

        function charger() {
            const exercice = exercices.find(function (ex) { return ex.id === select.value; }) || exercices[0];
            const paires = exercice.pairs;

            if (estBloque(exercice)) {
                cible.innerHTML = entete(exercice);
                return;
            }

            const items = shuffle(paires.map(function (p) { return p.item; }));
            const cibles = shuffle(paires.map(function (p) { return p.match; }));
            let selection = null;
            let restants = paires.length;
            let erreurs = 0;
            let resolusSansAide = 0;

            cible.innerHTML =
                entete(exercice) +
                '<p class="text-muted small">Cliquez sur un élément puis sur la description correspondante (ou glissez-déposez).</p>' +
                '<div class="row">' +
                    '<div class="col-md-6 mb-3">' +
                        '<h6><i class="fas fa-users me-1"></i>Éléments</h6>' +
                        '<div id="matching-items">' +
                            items.map(function (item) {
                                return '<div class="draggable" draggable="true" data-item="' + esc(item) + '">' + esc(item) + '</div>';
                            }).join('') +
                        '</div>' +
                    '</div>' +
                    '<div class="col-md-6 mb-3">' +
                        '<h6><i class="fas fa-align-left me-1"></i>Descriptions</h6>' +
                        '<div id="matching-cibles">' +
                            cibles.map(function (match) {
                                return '<div class="droppable" data-match="' + esc(match) + '">' + esc(match) + '</div>';
                            }).join('') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<button class="btn btn-outline-primary mt-2" id="matching-check"><i class="fas fa-check me-1"></i>Voir les réponses</button>' +
                '<div class="feedback mt-3 p-3 rounded" id="matching-feedback"></div>';

            const zoneFeedback = cible.querySelector('#matching-feedback');
            const itemsEl = cible.querySelector('#matching-items');

            function placer(itemEl, cibleEl) {
                const item = itemEl.dataset.item;
                const match = cibleEl.dataset.match;
                const paire = paires.find(function (p) { return p.item === item; });
                if (!paire) return;

                if (paire.match === match) {
                    cibleEl.innerHTML = '<i class="fas fa-check me-1"></i>' + esc(item);
                    cibleEl.classList.add('matched');
                    cibleEl.dataset.resolu = 'true';
                    itemEl.remove();
                    restants--;
                    resolusSansAide++;
                    feedback(zoneFeedback, restants > 0 ? 'Bien joué ! Continuez ainsi.' : 'Félicitations ! Tout est associé.', 'success');
                    if (restants === 0) {
                        terminer(Math.max(0, paires.length - erreurs));
                    }
                } else {
                    erreurs++;
                    cibleEl.classList.add('wrong');
                    setTimeout(function () { cibleEl.classList.remove('wrong'); }, 600);
                    feedback(zoneFeedback, 'Association incorrecte, essayez encore !', 'danger');
                }
                selection = null;
                document.querySelectorAll('#matching-items .draggable.selected').forEach(function (el) {
                    el.classList.remove('selected');
                });
            }

            function terminer(score) {
                const resultat = enregistrer(exercice, score, paires.length, onScore);
                const complement = resultat.ok ? ' Score enregistré.' : ' ' + resultat.error;
                feedback(zoneFeedback, 'Terminé : ' + score + '/' + paires.length + '.' + complement, score === paires.length ? 'success' : 'warning');
            }

            itemsEl.addEventListener('click', function (event) {
                const draggable = event.target.closest('.draggable');
                if (!draggable) return;
                itemsEl.querySelectorAll('.draggable').forEach(function (el) { el.classList.remove('selected'); });
                draggable.classList.add('selected');
                selection = draggable;
            });

            cible.querySelector('#matching-cibles').addEventListener('click', function (event) {
                const drop = event.target.closest('.droppable');
                if (!drop || drop.dataset.resolu === 'true') return;
                if (!selection) {
                    feedback(zoneFeedback, 'Sélectionnez d\'abord un élément à gauche.', 'warning');
                    return;
                }
                placer(selection, drop);
            });

            itemsEl.querySelectorAll('.draggable').forEach(function (el) {
                el.addEventListener('dragstart', function (event) {
                    event.dataTransfer.setData('text/plain', el.dataset.item);
                    selection = el;
                });
            });

            cible.querySelectorAll('.droppable').forEach(function (el) {
                el.addEventListener('dragover', function (event) { event.preventDefault(); });
                el.addEventListener('dragenter', function () { el.classList.add('highlight'); });
                el.addEventListener('dragleave', function () { el.classList.remove('highlight'); });
                el.addEventListener('drop', function (event) {
                    event.preventDefault();
                    el.classList.remove('highlight');
                    if (el.dataset.resolu === 'true') return;
                    const item = event.dataTransfer.getData('text/plain');
                    const source = itemsEl.querySelector('.draggable[data-item="' + CSS.escape(item) + '"]');
                    if (source) placer(source, el);
                });
            });

            cible.querySelector('#matching-check').addEventListener('click', function () {
                const nonResolus = cible.querySelectorAll('.droppable:not([data-resolu="true"])');
                if (!nonResolus.length) {
                    feedback(zoneFeedback, 'Tout est déjà correctement associé.', 'success');
                    return;
                }
                nonResolus.forEach(function (drop) {
                    const paire = paires.find(function (p) { return p.match === drop.dataset.match; });
                    drop.innerHTML = '<i class="fas fa-lightbulb me-1"></i>' + esc(paire.item);
                    drop.classList.add('matched');
                    drop.dataset.resolu = 'true';
                });
                restants = 0;
                terminer(resolusSansAide);
            });
        }

        select.addEventListener('change', charger);
        charger();
    }

    /* --------------------------- Textes à trous --------------------------- */

    function renderFillBlank(zone, exercices, onScore) {
        if (!exercices.length) {
            zone.innerHTML = '<p class="text-muted mb-0">Aucun texte à trous actif.</p>';
            return;
        }

        zone.innerHTML =
            '<div class="d-flex flex-wrap gap-2 align-items-center mb-3">' +
                '<label class="form-label mb-0 small text-muted" for="fillblank-select">Exercice :</label>' +
                '<select class="form-select form-select-sm" id="fillblank-select" style="max-width: 320px;">' +
                    exercices.map(function (ex) {
                        return '<option value="' + esc(ex.id) + '">' + esc(ex.titre) + '</option>';
                    }).join('') +
                '</select>' +
            '</div>' +
            '<div id="fillblank-zone"></div>';

        const select = zone.querySelector('#fillblank-select');
        const cible = zone.querySelector('#fillblank-zone');

        function charger(quoteIndex) {
            const exercice = exercices.find(function (ex) { return ex.id === select.value; }) || exercices[0];
            const quotes = exercice.quotes;
            const index = ((quoteIndex || 0) % quotes.length + quotes.length) % quotes.length;
            const quote = quotes[index];
            let motSelectionne = null;

            if (estBloque(exercice)) {
                cible.innerHTML = entete(exercice);
                return;
            }

            cible.innerHTML =
                entete(exercice) +
                '<div class="small text-muted mb-2">Citation ' + (index + 1) + ' sur ' + quotes.length + '</div>' +
                '<div class="quote p-3 mb-4"><p id="fillblank-text">' + quote.text + '</p></div>' +
                '<div class="word-bank mt-4 p-3 bg-light rounded">' +
                    '<h6><i class="fas fa-th-list me-1"></i>Mots disponibles :</h6>' +
                    '<div id="word-options" class="d-flex flex-wrap"></div>' +
                '</div>' +
                '<button class="btn btn-primary mt-3" id="fillblank-check"><i class="fas fa-check me-1"></i>Vérifier</button>' +
                '<div class="feedback mt-3 p-3 rounded" id="fillblank-feedback"></div>' +
                '<button class="btn btn-success mt-2 d-none" id="fillblank-next"><i class="fas fa-arrow-right me-1"></i>Citation suivante</button>';

            const zoneFeedback = cible.querySelector('#fillblank-feedback');
            const wordBank = cible.querySelector('#word-options');
            const texte = cible.querySelector('#fillblank-text');
            const boutonSuivant = cible.querySelector('#fillblank-next');
            const blancs = texte.querySelectorAll('.blank');

            shuffle(quote.words).forEach(function (mot) {
                const span = document.createElement('span');
                span.className = 'word-option';
                span.textContent = mot;
                span.draggable = true;
                span.dataset.word = mot;
                span.addEventListener('click', function () {
                    wordBank.querySelectorAll('.word-option').forEach(function (el) { el.classList.remove('selected'); });
                    span.classList.add('selected');
                    motSelectionne = span;
                });
                span.addEventListener('dragstart', function (event) {
                    event.dataTransfer.setData('text/plain', mot);
                    motSelectionne = span;
                });
                wordBank.appendChild(span);
            });

            function remplir(blanc, mot, source) {
                if (!mot) return;
                blanc.textContent = mot;
                if (blanc.dataset.answer === mot) {
                    blanc.classList.remove('wrong');
                    blanc.classList.add('correct');
                    if (source) {
                        source.classList.add('used');
                        source.classList.remove('selected');
                    }
                    if (cible.querySelectorAll('.blank:not(.correct)').length === 0) {
                        boutonSuivant.classList.remove('d-none');
                        feedback(zoneFeedback, 'Bravo ! Vous avez complété la citation correctement.', 'success');
                        const total = blancs.length;
                        const resultat = enregistrer(exercice, total, total, onScore);
                        if (!resultat.ok) feedback(zoneFeedback, 'Bien joué ! ' + resultat.error, 'warning');
                    }
                } else {
                    blanc.classList.add('wrong');
                    setTimeout(function () {
                        blanc.classList.remove('wrong');
                        blanc.textContent = '';
                    }, 900);
                }
                motSelectionne = null;
            }

            blancs.forEach(function (blanc) {
                blanc.addEventListener('click', function () {
                    if (blanc.classList.contains('correct')) return;
                    if (motSelectionne) {
                        remplir(blanc, motSelectionne.dataset.word, motSelectionne);
                    } else {
                        const dispo = wordBank.querySelector('.word-option:not(.used)');
                        if (dispo) remplir(blanc, dispo.dataset.word, dispo);
                    }
                });
                blanc.addEventListener('dragover', function (event) { event.preventDefault(); });
                blanc.addEventListener('drop', function (event) {
                    event.preventDefault();
                    if (blanc.classList.contains('correct')) return;
                    const mot = event.dataTransfer.getData('text/plain');
                    const source = wordBank.querySelector('.word-option[data-word="' + CSS.escape(mot) + '"]:not(.used)');
                    remplir(blanc, mot, source);
                });
            });

            cible.querySelector('#fillblank-check').addEventListener('click', function () {
                let corrects = 0;
                blancs.forEach(function (blanc) {
                    if (blanc.textContent === blanc.dataset.answer) {
                        blanc.classList.add('correct');
                        blanc.classList.remove('wrong');
                        corrects++;
                    } else {
                        blanc.classList.add('wrong');
                    }
                });
                if (corrects === blancs.length) {
                    feedback(zoneFeedback, 'Parfait ! Toutes les réponses sont correctes.', 'success');
                } else {
                    feedback(zoneFeedback, 'Vous avez ' + corrects + ' bonne(s) réponse(s) sur ' + blancs.length + '. Les réponses sont affichées.', 'warning');
                    blancs.forEach(function (blanc) {
                        if (!blanc.classList.contains('correct')) {
                            blanc.textContent = blanc.dataset.answer;
                            blanc.classList.add('correct');
                        }
                    });
                }
                boutonSuivant.classList.remove('d-none');
                enregistrer(exercice, corrects, blancs.length, onScore);
            });

            boutonSuivant.addEventListener('click', function () {
                charger(index + 1);
            });
        }

        select.addEventListener('change', function () { charger(0); });
        charger(0);
    }

    /* -------------------------------- Vue -------------------------------- */

    function render(conteneur, options) {
        destroy();
        const opts = options || {};
        const actifs = opts.exercices || window.LearnHubStore.exercices.actifs();
        const quiz = actifs.filter(function (ex) { return ex.type === 'quiz'; });
        const matching = actifs.filter(function (ex) { return ex.type === 'matching'; });
        const fillblank = actifs.filter(function (ex) { return ex.type === 'fillblank'; });

        if (!actifs.length) {
            conteneur.innerHTML = '<div class="text-center text-muted py-5">' +
                '<i class="fas fa-inbox fa-2x d-block mb-2"></i>' +
                'Aucun exercice actif pour cette sélection.' +
                '<div class="small mt-1">Un administrateur peut en créer depuis le back-office, ou choisissez une autre matière.</div>' +
            '</div>';
            return;
        }

        conteneur.innerHTML =
            '<ul class="nav nav-tabs" role="tablist">' +
                '<li class="nav-item" role="presentation">' +
                    '<button class="nav-link active game-tab" data-onglet="quiz" type="button"><i class="fas fa-question-circle me-1"></i>Quiz <span class="badge bg-light text-dark">' + quiz.length + '</span></button>' +
                '</li>' +
                '<li class="nav-item" role="presentation">' +
                    '<button class="nav-link game-tab" data-onglet="matching" type="button"><i class="fas fa-random me-1"></i>Associations <span class="badge bg-light text-dark">' + matching.length + '</span></button>' +
                '</li>' +
                '<li class="nav-item" role="presentation">' +
                    '<button class="nav-link game-tab" data-onglet="fillblank" type="button"><i class="fas fa-font me-1"></i>Textes à trous <span class="badge bg-light text-dark">' + fillblank.length + '</span></button>' +
                '</li>' +
            '</ul>' +
            '<div class="tab-content p-3 border border-top-0 rounded-bottom">' +
                '<div class="onglet-contenu" data-contenu="quiz"></div>' +
                '<div class="onglet-contenu d-none" data-contenu="matching"></div>' +
                '<div class="onglet-contenu d-none" data-contenu="fillblank"></div>' +
            '</div>';

        const zones = {
            quiz: conteneur.querySelector('[data-contenu="quiz"]'),
            matching: conteneur.querySelector('[data-contenu="matching"]'),
            fillblank: conteneur.querySelector('[data-contenu="fillblank"]')
        };

        renderQuiz(zones.quiz, quiz, opts.onScore);
        renderMatching(zones.matching, matching, opts.onScore);
        renderFillBlank(zones.fillblank, fillblank, opts.onScore);

        conteneur.querySelectorAll('[data-onglet]').forEach(function (bouton) {
            bouton.addEventListener('click', function () {
                conteneur.querySelectorAll('[data-onglet]').forEach(function (b) { b.classList.remove('active'); });
                bouton.classList.add('active');
                Object.keys(zones).forEach(function (cle) {
                    zones[cle].classList.toggle('d-none', cle !== bouton.dataset.onglet);
                });
            });
        });
    }

    return {
        render: render,
        destroy: destroy
    };
})();
