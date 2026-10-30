/**
 * LearnHub — source de données unique du site.
 * Tout le contenu pédagogique (matières, niveaux, chapitres, cours, exercices)
 * est déclaré ici et consommé par app.js, games.js et admin.js.
 */
window.LearnHubData = (function () {
    'use strict';

    // Formulaire de contact : renseigner l'endpoint d'un service (Formspree, Getform…)
    // pour recevoir les messages sans publier l'adresse e-mail.
    // Exemple : formulaire: 'https://formspree.io/f/abcdwxyz'
    const developpeur = {
        nom: 'M.BA',
        titre: 'Ingénieur en génie logiciel',
        formulaire: 'https://formspree.io/f/xdeegrzw',
        role: 'Conception et développement de la plateforme LearnHub'
    };

    const matieres = [
        {
            slug: 'maths',
            nom: 'Mathématiques',
            icone: 'fa-square-root-alt',
            couleur: 'bg-maths',
            resume: 'Algèbre, géométrie, analyse, probabilités et statistiques',
            description: "Des chapitres progressifs pour construire les automatismes de calcul et apprendre à démontrer : algèbre, géométrie, fonctions et probabilités.",
            chapitres: [
                {
                    id: 'maths-fractions',
                    niveau: 'college',
                    titre: 'Fractions, proportionnalité et pourcentages',
                    duree: '40 min',
                    resume: "Revoir les opérations sur les fractions, la règle de trois et les pourcentages d'évolution, trois outils réutilisés dans toutes les disciplines scientifiques.",
                    objectifs: [
                        'Additionner, soustraire, multiplier et diviser des fractions',
                        'Résoudre un problème de proportionnalité par la règle de trois',
                        'Calculer une augmentation ou une réduction en pourcentage'
                    ],
                    points: [
                        "Pour additionner deux fractions, on les met d'abord au même dénominateur.",
                        'La règle de trois revient à multiplier en croix dans un tableau de proportionnalité.',
                        "Une hausse de 20 % se traduit par un coefficient multiplicateur de 1,20 ; une baisse de 20 % par 0,80."
                    ]
                },
                {
                    id: 'maths-pythagore',
                    niveau: 'college',
                    titre: 'Théorème de Pythagore et géométrie du triangle',
                    duree: '35 min',
                    resume: "Utiliser le théorème de Pythagore et sa réciproque pour calculer une longueur ou démontrer qu'un triangle est rectangle.",
                    objectifs: [
                        "Reconnaître l'hypoténuse d'un triangle rectangle",
                        'Calculer une longueur manquante avec le théorème direct',
                        "Démontrer la nature d'un triangle avec la réciproque"
                    ],
                    points: [
                        "Le théorème ne s'applique qu'aux triangles rectangles.",
                        "Dans un triangle rectangle, le carré de l'hypoténuse est égal à la somme des carrés des deux autres côtés.",
                        "La réciproque sert à prouver qu'un triangle est rectangle, pas à calculer une longueur."
                    ]
                },
                {
                    id: 'maths-second-degre',
                    niveau: 'lycee',
                    titre: 'Fonctions polynômes du second degré',
                    duree: '50 min',
                    resume: "Étudier la forme canonique, le discriminant et la parabole pour résoudre équations et inéquations du second degré.",
                    objectifs: [
                        'Passer de la forme développée à la forme canonique',
                        'Calculer le discriminant et interpréter son signe',
                        "Dresser le tableau de signes d'un trinôme"
                    ],
                    points: [
                        'Le signe du discriminant donne le nombre de racines réelles : deux, une double, aucune.',
                        'Le sommet de la parabole se lit dans la forme canonique.',
                        "Le coefficient du terme de degré 2 donne l'orientation de la parabole."
                    ]
                },
                {
                    id: 'maths-probabilites',
                    niveau: 'lycee',
                    titre: 'Probabilités conditionnelles et arbres pondérés',
                    duree: '45 min',
                    resume: "Modéliser une expérience aléatoire à deux étapes, calculer une probabilité conditionnelle et utiliser la formule des probabilités totales.",
                    objectifs: [
                        "Construire un arbre pondéré à partir d'un énoncé",
                        'Calculer une probabilité conditionnelle',
                        'Distinguer probabilité conditionnelle et indépendance'
                    ],
                    points: [
                        "Sur un arbre, on multiplie les probabilités le long d'un chemin et on additionne les chemins.",
                        'Une probabilité conditionnelle se note avec une barre verticale et se lit « sachant que ».',
                        "Deux événements sont indépendants si la réalisation de l'un ne change pas la probabilité de l'autre."
                    ]
                },
                {
                    id: 'maths-suites',
                    niveau: 'superieur',
                    titre: 'Suites et séries numériques',
                    duree: '60 min',
                    resume: "Étudier la convergence des suites et des séries, comparer les croissances et manipuler les critères de convergence usuels.",
                    objectifs: [
                        'Démontrer une convergence par encadrement',
                        "Utiliser les critères de comparaison et d'équivalence",
                        'Reconnaître les séries de référence'
                    ],
                    points: [
                        'Une suite croissante et majorée converge.',
                        "Les séries de Riemann servent d'étalon pour comparer les séries à termes positifs.",
                        "La convergence d'une série ne dépend pas de ses premiers termes."
                    ]
                },
                {
                    id: 'maths-algebre-lineaire',
                    niveau: 'superieur',
                    titre: 'Algèbre linéaire : matrices et déterminants',
                    duree: '55 min',
                    resume: "Manipuler les matrices, interpréter un déterminant et résoudre un système linéaire par la méthode du pivot de Gauss.",
                    objectifs: [
                        'Effectuer un produit matriciel dans le bon ordre',
                        'Interpréter un déterminant nul',
                        'Résoudre un système linéaire par échelonnement'
                    ],
                    points: [
                        "Le produit matriciel n'est pas commutatif en général.",
                        "Un déterminant nul signifie que les lignes sont liées : le système n'a pas de solution unique.",
                        "Le pivot de Gauss conserve l'ensemble des solutions du système."
                    ]
                }
            ]
        },
        {
            slug: 'francais',
            nom: 'Français',
            icone: 'fa-book-open',
            couleur: 'bg-lettres',
            resume: 'Lecture, analyse littéraire, expression écrite et orale',
            description: "Lire, analyser et écrire : les outils du commentaire littéraire, de la dissertation et de l'argumentation, du collège au supérieur.",
            chapitres: [
                {
                    id: 'francais-point-de-vue',
                    niveau: 'college',
                    titre: 'Le récit : narrateur et point de vue',
                    duree: '35 min',
                    resume: "Distinguer auteur, narrateur et personnage, puis identifier le point de vue adopté dans un récit.",
                    objectifs: [
                        "Repérer qui raconte l'histoire",
                        'Identifier une focalisation interne, externe ou omnisciente',
                        'Justifier ses réponses par des citations du texte'
                    ],
                    points: [
                        "Le narrateur n'est pas forcément l'auteur.",
                        "La focalisation interne donne accès aux pensées d'un seul personnage.",
                        'Toute interprétation doit s\'appuyer sur une citation précise.'
                    ]
                },
                {
                    id: 'francais-figures',
                    niveau: 'college',
                    titre: 'Les figures de style essentielles',
                    duree: '30 min',
                    resume: "Reconnaître et nommer les figures de style les plus fréquentes, puis expliquer leur effet sur le lecteur.",
                    objectifs: [
                        'Identifier comparaison, métaphore et personnification',
                        'Distinguer hyperbole, euphémisme et litote',
                        'Relier une figure à un effet de sens'
                    ],
                    points: [
                        "La comparaison utilise un outil de comparaison ; la métaphore s'en passe.",
                        'La litote dit moins pour suggérer plus.',
                        'Nommer une figure ne suffit pas : il faut expliquer son effet.'
                    ]
                },
                {
                    id: 'francais-commentaire',
                    niveau: 'lycee',
                    titre: 'Le commentaire littéraire : méthode',
                    duree: '50 min',
                    resume: "Construire un commentaire littéraire en trois temps : observation du texte, formulation des axes, rédaction.",
                    objectifs: [
                        'Repérer les procédés significatifs dans un texte',
                        'Organiser deux ou trois axes de lecture',
                        'Rédiger une introduction conforme aux attentes'
                    ],
                    points: [
                        "On part toujours du texte, jamais d'une idée préétablie.",
                        "Chaque sous-partie énonce une idée, apporte une citation et l'analyse.",
                        "Le commentaire ne raconte pas l'histoire et ne juge pas le texte."
                    ]
                },
                {
                    id: 'francais-si-longue-lettre',
                    niveau: 'lycee',
                    titre: 'Une si longue lettre — Mariama Bâ',
                    duree: 'Lecture intégrale',
                    resume: "Étude complète du roman épistolaire de Mariama Bâ : présentation, analyse littéraire, thèmes, personnages, contexte historique et exposés corrigés.",
                    lienCours: 'une-si-longue-lettre',
                    objectifs: [
                        "Situer l'œuvre dans la littérature africaine francophone",
                        'Analyser la forme épistolaire',
                        'Dégager les thèmes de la condition féminine et de la tradition'
                    ],
                    points: [
                        'Roman publié en 1979, écrit sous forme de lettre adressée à une amie.',
                        'La narration rétrospective donne au récit sa dimension de bilan.',
                        "La critique sociale passe par le regard d'une femme instruite."
                    ]
                },
                {
                    id: 'francais-dissertation',
                    niveau: 'superieur',
                    titre: 'Dissertation littéraire : problématiser un sujet',
                    duree: '60 min',
                    resume: "Apprendre à transformer un sujet en problème, à choisir une thèse et à construire un plan dialectique ou thématique.",
                    objectifs: [
                        'Reformuler un sujet sans le trahir',
                        'Dégager une tension entre deux notions',
                        'Choisir un plan adapté au problème posé'
                    ],
                    points: [
                        'La problématique est une question que le sujet rend discutable.',
                        'Le plan dialectique convient aux sujets qui opposent deux thèses.',
                        'Les exemples littéraires doivent être précis et variés.'
                    ]
                },
                {
                    id: 'francais-negritude',
                    niveau: 'superieur',
                    titre: 'Littérature africaine francophone : négritude et postcolonialisme',
                    duree: '55 min',
                    resume: "Replacer l'œuvre de Mariama Bâ dans l'histoire littéraire africaine, de la négritude aux écritures postcoloniales.",
                    objectifs: [
                        'Situer le mouvement de la négritude et ses figures',
                        "Comprendre l'apport des écritures postcoloniales",
                        'Analyser la réception des œuvres en contexte'
                    ],
                    points: [
                        "La négritude s'affirme dans les années 1930 à Paris.",
                        'Les écritures postcoloniales interrogent les indépendances et leurs désillusions.',
                        'La littérature féminine africaine occupe une place propre dans cet ensemble.'
                    ]
                }
            ]
        },
        {
            slug: 'sciences',
            nom: 'Sciences',
            icone: 'fa-atom',
            couleur: 'bg-sciences',
            resume: "Physique, chimie, SVT, sciences de l'ingénieur",
            description: "Observer, modéliser et vérifier : des chapitres d'expérimentation pour les sciences physiques et les sciences de la vie.",
            chapitres: [
                {
                    id: 'sciences-cycle-eau',
                    niveau: 'college',
                    titre: "Le cycle de l'eau et les états de la matière",
                    duree: '35 min',
                    resume: "Relier les changements d'état de l'eau à ses usages et au cycle de l'eau dans la nature.",
                    objectifs: [
                        "Nommer les changements d'état et leurs conditions",
                        "Décrire le cycle de l'eau",
                        "Relier fusion et solidification à un transfert d'énergie"
                    ],
                    points: [
                        "Les changements d'état se produisent à température constante pour un corps pur.",
                        "L'évaporation se produit à toute température.",
                        "L'énergie transférée lors d'un changement d'état ne fait pas varier la température."
                    ]
                },
                {
                    id: 'sciences-cellule',
                    niveau: 'college',
                    titre: 'La cellule, unité du vivant',
                    duree: '30 min',
                    resume: "Identifier les structures communes aux cellules et distinguer cellules animales et végétales au microscope.",
                    objectifs: [
                        'Observer des cellules au microscope',
                        'Nommer les principaux organites',
                        'Comparer cellule animale et cellule végétale'
                    ],
                    points: [
                        'Tous les êtres vivants sont constitués de cellules.',
                        'La paroi et les chloroplastes sont propres à la cellule végétale.',
                        'Un grossissement se calcule en multipliant oculaire et objectif.'
                    ]
                },
                {
                    id: 'sciences-newton',
                    niveau: 'lycee',
                    titre: 'Lois de Newton et mouvement',
                    duree: '50 min',
                    resume: "Appliquer les trois lois de Newton à des situations simples et relier force, masse et accélération.",
                    objectifs: [
                        'Faire le bilan des forces sur un système',
                        'Appliquer la deuxième loi de Newton',
                        'Utiliser la troisième loi dans les interactions'
                    ],
                    points: [
                        "Sans force résultante, le mouvement est rectiligne uniforme : ce n'est pas l'absence de mouvement.",
                        'La deuxième loi relie force résultante, masse et accélération.',
                        "Les forces d'action et de réaction s'exercent sur deux objets différents."
                    ]
                },
                {
                    id: 'sciences-acide-base',
                    niveau: 'lycee',
                    titre: 'Réactions acido-basiques et pH',
                    duree: '45 min',
                    resume: "Relier pH, concentration en ions oxonium et nature acide ou basique d'une solution, puis écrire une réaction de neutralisation.",
                    objectifs: [
                        "Calculer un pH à partir d'une concentration",
                        'Identifier un couple acide/base',
                        "Écrire l'équation d'une réaction acido-basique"
                    ],
                    points: [
                        'Le pH est une échelle logarithmique : une unité correspond à un facteur 10.',
                        'Un acide cède un proton ; une base le capte.',
                        "Une réaction acido-basique se produit entre l'acide d'un couple et la base d'un autre."
                    ]
                },
                {
                    id: 'sciences-thermodynamique',
                    niveau: 'superieur',
                    titre: 'Thermodynamique : premier principe',
                    duree: '60 min',
                    resume: "Appliquer le premier principe de la thermodynamique aux transformations d'un système et calculer travaux et transferts thermiques.",
                    objectifs: [
                        "Définir un système thermodynamique et ses variables d'état",
                        "Écrire le bilan énergétique d'une transformation",
                        'Distinguer transformations réversible et irréversible'
                    ],
                    points: [
                        "La variation d'énergie interne ne dépend que de l'état initial et de l'état final.",
                        'Le travail et le transfert thermique dépendent du chemin suivi.',
                        "Une transformation isochore s'accompagne d'un travail nul."
                    ]
                },
                {
                    id: 'sciences-genetique',
                    niveau: 'superieur',
                    titre: 'Génétique mendélienne et hérédité',
                    duree: '55 min',
                    resume: "Prévoir la transmission de caractères à partir d'arbres généalogiques et de croisements test.",
                    objectifs: [
                        'Interpréter un arbre généalogique',
                        'Utiliser les échiquiers de croisement',
                        'Distinguer gène, allèle et phénotype'
                    ],
                    points: [
                        'Un caractère récessif peut rester masqué pendant plusieurs générations.',
                        "Les proportions attendues d'un croisement ne sont que des probabilités.",
                        'Un résultat observé se compare toujours à un modèle théorique.'
                    ]
                }
            ]
        },
        {
            slug: 'langues',
            nom: 'Langues',
            icone: 'fa-language',
            couleur: 'bg-lettres',
            resume: 'Anglais, espagnol, allemand : grammaire, expression et compréhension',
            description: "Des chapitres courts et concrets pour gagner en aisance à l'oral comme à l'écrit, du collège au supérieur.",
            chapitres: [
                {
                    id: 'langues-present-perfect',
                    niveau: 'college',
                    titre: 'Present perfect et past simple (anglais)',
                    duree: '30 min',
                    resume: "Choisir entre present perfect et past simple selon le lien avec le présent, et repérer les marqueurs temporels.",
                    objectifs: [
                        'Formuler correctement les deux temps',
                        'Associer chaque temps à ses marqueurs temporels',
                        'Raconter une expérience sans préciser la date'
                    ],
                    points: [
                        'Un passé daté et terminé appelle le past simple.',
                        'Un bilan encore lié au présent appelle le present perfect.',
                        'Une action commencée dans le passé et toujours en cours utilise le present perfect avec since ou for.'
                    ]
                },
                {
                    id: 'langues-espagnol-present',
                    niveau: 'college',
                    titre: "Le présent de l'indicatif en espagnol",
                    duree: '30 min',
                    resume: "Maîtriser les terminaisons du présent régulier et les diphtongues des verbes irréguliers les plus fréquents.",
                    objectifs: [
                        'Conjuguer les trois groupes réguliers',
                        'Reconnaître les verbes à diphtongue',
                        "Employer le présent pour parler de l'habitude"
                    ],
                    points: [
                        'Trois groupes : -ar, -er, -ir, avec des terminaisons distinctes.',
                        "Les verbes à diphtongue modifient la voyelle du radical sous l'accent.",
                        "Le présent s'emploie aussi pour une action en cours."
                    ]
                },
                {
                    id: 'langues-ecoute',
                    niveau: 'lycee',
                    titre: "Compréhension orale : stratégies d'écoute",
                    duree: '40 min',
                    resume: "Développer une écoute en plusieurs passages : repérer la situation, les mots-clés, puis les détails.",
                    objectifs: [
                        'Anticiper le contenu à partir de la consigne',
                        "Prendre des notes abrégées pendant l'écoute",
                        "Identifier l'attitude et l'intention du locuteur"
                    ],
                    points: [
                        "Trois écoutes valent mieux qu'une écoute exhaustive.",
                        'La première écoute sert à la situation, la deuxième aux détails.',
                        'Les connecteurs logiques donnent la structure du discours.'
                    ]
                },
                {
                    id: 'langues-opinion',
                    niveau: 'lycee',
                    titre: 'Exprimer et nuancer son opinion (anglais B2)',
                    duree: '40 min',
                    resume: "Structurer une prise de position avec des connecteurs, des modalisateurs et des formules de nuance.",
                    objectifs: [
                        'Structurer un propos en trois temps',
                        'Utiliser des connecteurs logiques variés',
                        'Nuancer une affirmation'
                    ],
                    points: [
                        "Annoncer, développer, conclure : la structure rend l'opinion audible.",
                        'Les modaux permettent de nuancer le degré de certitude.',
                        'Les connecteurs assurent la cohérence du propos.'
                    ]
                },
                {
                    id: 'langues-academic-writing',
                    niveau: 'superieur',
                    titre: 'Academic writing : structurer un essai',
                    duree: '55 min',
                    resume: "Rédiger un essai académique en anglais : thèse, paragraphes argumentés, sources et transitions.",
                    objectifs: [
                        'Formuler une thèse claire en une phrase',
                        'Construire des paragraphes argumentés',
                        'Citer et référencer une source'
                    ],
                    points: [
                        "Un paragraphe développe une seule idée principale.",
                        "Chaque affirmation doit être étayée ou référencée.",
                        "Les transitions assurent la progression de l'argumentation."
                    ]
                },
                {
                    id: 'langues-traduction',
                    niveau: 'superieur',
                    titre: 'Traduction : faux amis et registres',
                    duree: '50 min',
                    resume: "Éviter les calques les plus fréquents et adapter le registre de langue à la situation de communication.",
                    objectifs: [
                        'Repérer les faux amis classiques',
                        'Choisir le registre adapté',
                        'Reformuler plutôt que traduire mot à mot'
                    ],
                    points: [
                        "Un faux ami ressemble à un mot français mais n'a pas le même sens.",
                        'Le registre se choisit selon le destinataire et le support.',
                        'Traduire, c\'est transmettre un sens, pas aligner des mots.'
                    ]
                }
            ]
        },
        {
            slug: 'informatique',
            nom: 'Informatique',
            icone: 'fa-microchip',
            couleur: 'bg-informatique',
            resume: 'Binaire, algorithmes, programmation Python, réseaux et sécurité',
            description: "Comprendre ce qui se passe derrière un écran : coder l'information, concevoir un algorithme, écrire un programme et sécuriser ses données.",
            chapitres: [
                {
                    id: 'informatique-representation',
                    niveau: 'lycee',
                    titre: "Représenter l'information : binaire et encodage",
                    duree: '40 min',
                    resume: "Comprendre comment un ordinateur code textes, images et sons avec des 0 et des 1, et passer d'une base de numération à l'autre.",
                    objectifs: [
                        'Convertir un nombre entre base 2 et base 10',
                        'Calculer le poids d\'un fichier texte ou d\'une image',
                        'Distinguer bit, octet et multiples'
                    ],
                    points: [
                        "Un bit vaut 0 ou 1 ; huit bits forment un octet.",
                        'Un texte est codé caractère par caractère, par exemple en UTF-8.',
                        'Une image se code en pixels, chacun décrit par ses composantes de couleur.'
                    ]
                },
                {
                    id: 'informatique-algorithmique',
                    niveau: 'lycee',
                    titre: 'Algorithmique : variables, conditions et boucles',
                    duree: '45 min',
                    resume: "Écrire un algorithme en pseudo-code : déclarer des variables, décider avec si… alors… sinon et répéter avec les boucles pour et tant que.",
                    objectifs: [
                        'Déclarer puis mettre à jour une variable',
                        'Traduire un énoncé en instructions conditionnelles',
                        "Choisir entre une boucle bornée et une boucle non bornée"
                    ],
                    points: [
                        "Un algorithme décrit une suite finie d'instructions sans ambiguïté.",
                        'Une condition évalue une expression booléenne, vraie ou fausse.',
                        "La boucle pour s'emploie quand le nombre d'itérations est connu, la boucle tant que sinon."
                    ]
                },
                {
                    id: 'informatique-python',
                    niveau: 'lycee',
                    titre: 'Programmer en Python : fonctions et listes',
                    duree: '50 min',
                    resume: "Passer du pseudo-code au langage Python : définir une fonction, parcourir une liste et renvoyer un résultat vérifiable par des tests.",
                    objectifs: [
                        'Définir une fonction avec def et return',
                        'Parcourir une liste avec une boucle for',
                        'Tester une fonction sur des cas simples et limites'
                    ],
                    points: [
                        "En Python, l'indentation délimite les blocs d'instructions.",
                        'Une fonction claire fait une seule chose et porte un nom explicite.',
                        "Une liste est ordonnée et ses éléments s'indexent à partir de 0."
                    ]
                },
                {
                    id: 'informatique-reseaux',
                    niveau: 'lycee',
                    titre: 'Réseaux, Web et sécurité des données',
                    duree: '45 min',
                    resume: "Suivre le trajet d'une requête HTTP, distinguer client et serveur, et adopter les bons réflexes pour protéger ses comptes et ses données personnelles.",
                    objectifs: [
                        'Décrire le rôle du client, du serveur et du DNS',
                        'Expliquer ce que protège le chiffrement HTTPS',
                        "Identifier une donnée personnelle et sa durée de conservation"
                    ],
                    points: [
                        'Le DNS traduit un nom de domaine en adresse IP.',
                        "HTTPS chiffre l'échange entre le navigateur et le serveur.",
                        'Un mot de passe long et unique vaut mieux qu\'un mot de passe complexe réutilisé partout.'
                    ]
                }
            ]
        }
    ];

    const niveaux = [
        {
            slug: 'college',
            nom: 'Collège',
            cycle: '6e → 3e',
            icone: 'fa-school',
            description: "Consolider les bases : méthodes de travail, automatismes et premières analyses."
        },
        {
            slug: 'lycee',
            nom: 'Lycée',
            cycle: '2nde → Terminale',
            icone: 'fa-graduation-cap',
            description: "Approfondir, argumenter et préparer les épreuves du baccalauréat."
        },
        {
            slug: 'superieur',
            nom: 'Supérieur',
            cycle: 'Licence, prépa, BTS',
            icone: 'fa-university',
            description: "Formaliser et prendre du recul : méthodes académiques et autonomie."
        }
    ];

    /**
     * Exercices livrés avec le site. Ils sont copiés dans le stockage local au
     * premier chargement, puis modifiables depuis le back-office.
     */
    const exercicesSeed = [
        {
            id: 'quiz-personnages',
            type: 'quiz',
            matiere: 'francais',
            titre: 'Personnages principaux',
            actif: true,
            temps: 30,
            questions: [
                {
                    question: 'Quel est le nom de la narratrice du roman ?',
                    options: ['Aïssatou', 'Ramatoulaye', 'Binetou', 'Jacqueline'],
                    answer: 1,
                    explanation: 'Ramatoulaye est la narratrice qui écrit à son amie Aïssatou.'
                },
                {
                    question: 'Quelle forme littéraire le roman utilise-t-il ?',
                    options: ['Journal intime', 'Roman épistolaire', 'Autobiographie', 'Nouvelle'],
                    answer: 1,
                    explanation: 'Le roman est écrit sous forme de lettre (épistolaire) adressée à Aïssatou.'
                },
                {
                    question: 'Pourquoi Aïssatou a-t-elle quitté son mari ?',
                    options: [
                        'Il était violent',
                        'Il a pris une seconde épouse',
                        "Elle est tombée amoureuse d'un autre homme",
                        'Elle voulait poursuivre ses études'
                    ],
                    answer: 1,
                    explanation: "Aïssatou a quitté son mari Mawdo lorsqu'il a pris une seconde épouse selon la tradition."
                },
                {
                    question: 'Quel est le métier de Ramatoulaye ?',
                    options: ['Infirmière', 'Commerçante', 'Professeure', 'Fonctionnaire'],
                    answer: 2,
                    explanation: 'Ramatoulaye est professeure, ce qui montre son éducation et son statut social.'
                },
                {
                    question: "Quel thème n'est PAS abordé dans le roman ?",
                    options: [
                        'La polygamie',
                        "L'émancipation féminine",
                        'Le conflit générationnel',
                        'La révolution industrielle'
                    ],
                    answer: 3,
                    explanation: "La révolution industrielle n'est pas un thème de ce roman qui traite de la société sénégalaise postcoloniale."
                },
                {
                    question: 'Quelle est la relation entre Ramatoulaye et Aïssatou ?',
                    options: ['Sœurs', 'Cousines', "Amies d'enfance", 'Collègues de travail'],
                    answer: 2,
                    explanation: "Ramatoulaye et Aïssatou sont des amies d'enfance qui ont grandi ensemble."
                },
                {
                    question: 'Pourquoi Binetou épouse-t-elle Modou Fall ?',
                    options: [
                        'Par amour',
                        'Pour aider financièrement sa famille',
                        'Pour obtenir un visa',
                        'Par obligation religieuse'
                    ],
                    answer: 1,
                    explanation: "Binetou est contrainte d'épouser Modou Fall pour des raisons financières, sa famille tirant profit de ce mariage."
                }
            ]
        },
        {
            id: 'quiz-themes',
            type: 'quiz',
            matiere: 'francais',
            titre: 'Thèmes du roman',
            actif: true,
            temps: 30,
            questions: [
                {
                    question: 'Quel événement ouvre le roman ?',
                    options: ['Un mariage', 'Un décès', 'Un déménagement', 'Une rentrée scolaire'],
                    answer: 1,
                    explanation: "Le roman s'ouvre sur la mort de Modou Fall et le veuvage de Ramatoulaye."
                },
                {
                    question: 'Que critique Mariama Bâ à travers les cérémonies ?',
                    options: [
                        'Leur durée',
                        "Le gaspillage et l'endettement",
                        'Leur caractère religieux',
                        'Leur rareté'
                    ],
                    answer: 1,
                    explanation: 'Les dépenses ostentatoires des mariages et funérailles appauvrissent les familles.'
                },
                {
                    question: 'Comment se manifeste la solidarité féminine ?',
                    options: [
                        'Par la correspondance entre amies',
                        'Par les réunions de quartier',
                        'Par les voyages',
                        'Par le commerce'
                    ],
                    answer: 0,
                    explanation: 'La longue lettre elle-même est le lieu de cette solidarité entre Ramatoulaye et Aïssatou.'
                },
                {
                    question: 'Quel conflit structure le roman ?',
                    options: [
                        'Tradition contre modernité',
                        'Ville contre campagne',
                        'Riche contre pauvre',
                        "Jeunes contre aînés uniquement"
                    ],
                    answer: 0,
                    explanation: 'Le roman explore la tension entre valeurs traditionnelles et aspirations modernes.'
                }
            ]
        },
        {
            id: 'matching-personnages',
            type: 'matching',
            matiere: 'francais',
            titre: 'Personnages et descriptions',
            actif: true,
            pairs: [
                { item: 'Ramatoulaye', match: 'Narratrice du roman, professeure et mère de famille' },
                { item: 'Aïssatou', match: 'Amie de Ramatoulaye qui a quitté son mari polygame' },
                { item: 'Modou Fall', match: 'Mari de Ramatoulaye qui a pris une seconde épouse' },
                { item: 'Binetou', match: 'Jeune étudiante devenue co-épouse par obligation' }
            ]
        },
        {
            id: 'matching-themes',
            type: 'matching',
            matiere: 'francais',
            titre: 'Thèmes et définitions',
            actif: true,
            pairs: [
                { item: 'La condition féminine', match: 'Le quotidien des femmes face aux traditions patriarcales' },
                { item: 'Tradition et modernité', match: 'Le décalage entre les valeurs héritées et les aspirations nouvelles' },
                { item: "L'amitié féminine", match: 'Une solidarité qui soutient et libère' },
                { item: 'Le gaspillage', match: 'Les dépenses ostentatoires des cérémonies' }
            ]
        },
        {
            id: 'fillblank-citations',
            type: 'fillblank',
            matiere: 'francais',
            titre: 'Citations célèbres',
            actif: true,
            quotes: [
                {
                    text: "Le poids des <span class='blank' data-answer='traditions'></span>, des <span class='blank' data-answer='coutumes'></span>... est plus lourd que celui des <span class='blank' data-answer='cercueils'></span>.",
                    words: ['traditions', 'coutumes', 'cercueils', 'hommes', 'femmes', 'enfants']
                },
                {
                    text: "Une si longue <span class='blank' data-answer='lettre'></span>... Je l'ai commencée dans la <span class='blank' data-answer='solitude'></span> et la <span class='blank' data-answer='douleur'></span>.",
                    words: ['lettre', 'histoire', 'solitude', 'douleur', 'joie', 'colère']
                },
                {
                    text: "On s'endette pour un jour de <span class='blank' data-answer='gloire'></span> <span class='blank' data-answer='éphémère'></span>.",
                    words: ['gloire', 'honte', 'éphémère', 'éternel', 'bonheur', 'malheur']
                },
                {
                    text: "Notre longue <span class='blank' data-answer='amitié'></span> a gardé ses <span class='blank' data-answer='merveilleuses'></span> qualités : <span class='blank' data-answer='franchise'></span>, <span class='blank' data-answer='dévouement'></span>.",
                    words: ['amitié', 'merveilleuses', 'franchise', 'dévouement', 'amour', 'souffrance']
                }
            ]
        },
        {
            id: 'maths-quiz-calculs',
            type: 'quiz',
            matiere: 'maths',
            titre: 'Calculs, pourcentages et second degré',
            actif: true,
            temps: 30,
            questions: [
                {
                    question: 'Combien vaut 3/4 + 1/2 ?',
                    options: ['4/6', '5/4', '2/3', '1/4'],
                    answer: 1,
                    explanation: '1/2 = 2/4, donc 3/4 + 2/4 = 5/4.'
                },
                {
                    question: 'Un article coûte 40 €. Après une hausse de 25 %, il coûte…',
                    options: ['45 €', '50 €', '55 €', '65 €'],
                    answer: 1,
                    explanation: '40 × 1,25 = 50 €.'
                },
                {
                    question: "Dans un triangle rectangle, l'hypoténuse est…",
                    options: [
                        'le côté le plus court',
                        "le côté opposé à l'angle droit",
                        'toujours le côté horizontal',
                        "la hauteur issue de l'angle droit"
                    ],
                    answer: 1,
                    explanation: "L'hypoténuse est le côté opposé à l'angle droit ; c'est aussi le côté le plus long."
                },
                {
                    question: 'Si le discriminant Δ est strictement négatif, une équation du second degré…',
                    options: [
                        'a deux solutions réelles',
                        'a une solution double',
                        "n'a aucune solution réelle",
                        'a une infinité de solutions'
                    ],
                    answer: 2,
                    explanation: 'Δ < 0 : aucune racine réelle, la parabole ne coupe pas l\'axe des abscisses.'
                },
                {
                    question: "Les solutions de l'équation x² − 4 = 0 sont…",
                    options: ['2 seulement', '−2 seulement', '−2 et 2', '0 et 4'],
                    answer: 2,
                    explanation: '(x − 2)(x + 2) = 0, donc x = −2 ou x = 2.'
                }
            ]
        },
        {
            id: 'maths-matching-notions',
            type: 'matching',
            matiere: 'maths',
            titre: 'Notions et définitions',
            actif: true,
            pairs: [
                { item: 'Hypoténuse', match: "Côté opposé à l'angle droit dans un triangle rectangle" },
                { item: 'Discriminant', match: 'b² − 4ac, il indique le nombre de racines réelles' },
                { item: 'Coefficient multiplicateur', match: 'Nombre par lequel on multiplie pour appliquer un pourcentage' },
                { item: 'Suite convergente', match: 'Suite dont les termes se rapprochent d\'une limite' }
            ]
        },
        {
            id: 'maths-fillblank-pythagore',
            type: 'fillblank',
            matiere: 'maths',
            titre: 'Le théorème de Pythagore',
            actif: true,
            quotes: [
                {
                    text: "Dans un triangle <span class='blank' data-answer='rectangle'></span>, le carré de l'<span class='blank' data-answer='hypoténuse'></span> est égal à la <span class='blank' data-answer='somme'></span> des carrés des deux autres côtés.",
                    words: ['rectangle', 'hypoténuse', 'somme', 'produit', 'différence', 'angle']
                }
            ]
        },
        {
            id: 'sciences-quiz-matiere',
            type: 'quiz',
            matiere: 'sciences',
            titre: 'États de la matière et vivant',
            actif: true,
            temps: 30,
            questions: [
                {
                    question: "Le passage de l'état liquide à l'état gazeux s'appelle…",
                    options: ['la fusion', 'la solidification', 'la vaporisation', 'la condensation'],
                    answer: 2,
                    explanation: 'Liquide → gaz : vaporisation (évaporation ou ébullition).'
                },
                {
                    question: "Pendant un changement d'état d'un corps pur, la température…",
                    options: [
                        'augmente régulièrement',
                        'reste constante',
                        'diminue régulièrement',
                        'devient nulle'
                    ],
                    answer: 1,
                    explanation: "À pression constante, la température reste constante pendant toute la durée du changement d'état."
                },
                {
                    question: 'Ce qui distingue la cellule végétale de la cellule animale est…',
                    options: [
                        "la présence d'un noyau",
                        "la présence d'une paroi et de chloroplastes",
                        "l'absence de cytoplasme",
                        'la présence de vacuoles uniquement'
                    ],
                    answer: 1,
                    explanation: 'La paroi et les chloroplastes sont propres aux cellules végétales.'
                },
                {
                    question: 'Une solution acide a un pH…',
                    options: ['égal à 7', 'supérieur à 7', 'inférieur à 7', 'toujours égal à 0'],
                    answer: 2,
                    explanation: 'pH < 7 : solution acide ; pH > 7 : solution basique.'
                },
                {
                    question: 'La deuxième loi de Newton relie…',
                    options: [
                        'la masse et le volume',
                        'la force résultante, la masse et l\'accélération',
                        'la pression et la température',
                        "l'énergie et la puissance"
                    ],
                    answer: 1,
                    explanation: 'La résultante des forces vaut le produit de la masse par l\'accélération (ΣF = m × a).'
                }
            ]
        },
        {
            id: 'sciences-matching-phenomenes',
            type: 'matching',
            matiere: 'sciences',
            titre: 'Phénomènes et définitions',
            actif: true,
            pairs: [
                { item: 'Fusion', match: "Passage de l'état solide à l'état liquide" },
                { item: 'Photosynthèse', match: 'Production de matière organique grâce à la lumière, à l\'eau et au CO₂' },
                { item: 'Neutralisation', match: 'Réaction entre un acide et une base' },
                { item: 'Inertie', match: 'Tendance d\'un corps à conserver son mouvement en l\'absence de force' }
            ]
        },
        {
            id: 'sciences-fillblank-cycle-eau',
            type: 'fillblank',
            matiere: 'sciences',
            titre: "Le cycle de l'eau",
            actif: true,
            quotes: [
                {
                    text: "Sous l'effet de la chaleur, l'eau des océans s'<span class='blank' data-answer='évapore'></span> ; la vapeur se <span class='blank' data-answer='condense'></span> en altitude pour former des nuages, puis l'eau retombe sous forme de <span class='blank' data-answer='précipitations'></span>.",
                    words: ['évapore', 'condense', 'précipitations', 'gèle', 'fond', 'ruissellement']
                }
            ]
        },
        {
            id: 'langues-quiz-anglais',
            type: 'quiz',
            matiere: 'langues',
            titre: 'Anglais : temps et expressions',
            actif: true,
            temps: 25,
            questions: [
                {
                    question: 'I ___ in Paris since 2019.',
                    options: ['live', 'lived', 'have lived', 'am living'],
                    answer: 2,
                    explanation: 'Avec « since », on emploie le present perfect : have lived.'
                },
                {
                    question: 'Yesterday, she ___ to the cinema.',
                    options: ['goes', 'went', 'has gone', 'is going'],
                    answer: 1,
                    explanation: '« Yesterday » indique un passé daté et terminé : past simple.'
                },
                {
                    question: 'He is interested ___ science.',
                    options: ['on', 'in', 'at', 'for'],
                    answer: 1,
                    explanation: 'La préposition associée à « interested » est « in ».'
                },
                {
                    question: 'If I ___ rich, I would travel the world.',
                    options: ['am', 'was', 'were', 'will be'],
                    answer: 2,
                    explanation: 'Hypothèse irréelle au présent : « If I were… ».'
                }
            ]
        },
        {
            id: 'langues-matching-espagnol',
            type: 'matching',
            matiere: 'langues',
            titre: 'Espagnol : expressions courantes',
            actif: true,
            pairs: [
                { item: 'Buenos días', match: 'Bonjour (le matin)' },
                { item: '¿Cómo estás?', match: 'Comment vas-tu ?' },
                { item: 'Me llamo…', match: "Je m'appelle…" },
                { item: 'Hasta luego', match: 'À plus tard' }
            ]
        },
        {
            id: 'langues-fillblank-connecteurs',
            type: 'fillblank',
            matiere: 'langues',
            titre: 'Anglais : connecteurs logiques',
            actif: true,
            quotes: [
                {
                    text: "I wanted to go out, <span class='blank' data-answer='but'></span> it was raining. <span class='blank' data-answer='However'></span>, I took an umbrella <span class='blank' data-answer='because'></span> I hate getting wet.",
                    words: ['but', 'However', 'because', 'although', 'so', 'unless']
                }
            ]
        },
        {
            id: 'informatique-quiz-bases',
            type: 'quiz',
            matiere: 'informatique',
            titre: 'Informatique : bases et culture numérique',
            actif: true,
            temps: 30,
            questions: [
                {
                    question: 'Combien de bits contient un octet ?',
                    options: ['4', '8', '16', '1024'],
                    answer: 1,
                    explanation: 'Un octet regroupe 8 bits.'
                },
                {
                    question: 'En base 2, le nombre 1010 vaut en décimal…',
                    options: ['10', '8', '12', '5'],
                    answer: 0,
                    explanation: '1010₂ = 8 + 0 + 2 + 0 = 10.'
                },
                {
                    question: "Quel composant exécute les instructions d'un programme ?",
                    options: ['Le disque dur', 'Le processeur', 'La mémoire vive', "L'écran"],
                    answer: 1,
                    explanation: 'Le processeur (CPU) exécute les instructions ; la mémoire vive stocke temporairement les données.'
                },
                {
                    question: 'Un algorithme est…',
                    options: [
                        'un langage de programmation',
                        "une suite finie d'instructions qui résout un problème",
                        "un format de fichier",
                        'un composant matériel'
                    ],
                    answer: 1,
                    explanation: "Un algorithme décrit la méthode de résolution, indépendamment du langage utilisé pour le programmer."
                },
                {
                    question: 'HTTPS sert principalement à…',
                    options: [
                        'accélérer le chargement du site',
                        'chiffrer les échanges entre le navigateur et le serveur',
                        'compresser les images',
                        'stocker les cookies'
                    ],
                    answer: 1,
                    explanation: "HTTPS chiffre la communication, ce qui empêche l'interception du mot de passe ou des données envoyées."
                }
            ]
        },
        {
            id: 'informatique-matching-notions',
            type: 'matching',
            matiere: 'informatique',
            titre: 'Informatique : notions et définitions',
            actif: true,
            pairs: [
                { item: 'Bit', match: "Plus petite unité d'information, qui vaut 0 ou 1" },
                { item: 'Variable', match: "Nom associé à une valeur qui peut changer pendant l'exécution" },
                { item: 'Boucle', match: 'Structure qui répète plusieurs fois des instructions' },
                { item: 'Serveur', match: 'Machine qui répond aux requêtes envoyées par les clients' }
            ]
        },
        {
            id: 'informatique-fillblank-algorithme',
            type: 'fillblank',
            matiere: 'informatique',
            titre: 'Algorithme : calculer une moyenne',
            actif: true,
            quotes: [
                {
                    text: "Pour calculer une moyenne, on <span class='blank' data-answer='initialise'></span> une variable somme à 0, on <span class='blank' data-answer='additionne'></span> les notes dans une boucle, puis on <span class='blank' data-answer='divise'></span> le total par le nombre de notes.",
                    words: ['initialise', 'additionne', 'divise', 'multiplie', 'supprime', 'compare']
                }
            ]
        }
    ];

    /** Ressources livrées par défaut (liens internes) ; l'administrateur les complète. */
    const ressourcesSeed = [
        {
            id: 'res-fiche-lettre',
            titre: 'Fiche de lecture : Une si longue lettre',
            type: 'Fiche de lecture',
            url: '#/cours/une-si-longue-lettre',
            taille: 'Page web',
            date: '2023-10-15'
        },
        {
            id: 'res-exposes',
            titre: 'Exposés corrigés — Les thèmes',
            type: 'Corrigé',
            url: '#/cours/une-si-longue-lettre/exposes',
            taille: 'Page web',
            date: '2023-10-10'
        }
    ];

    const cours = [
        {
            slug: 'une-si-longue-lettre',
            titre: 'Une si longue lettre',
            auteur: 'Mariama Bâ',
            annee: '1979',
            image: 'assets/images/une-si-longue-lettre.jpg',
            matiere: 'francais',
            niveaux: ['college', 'lycee', 'superieur'],
            resume: "Roman épistolaire majeur de la littérature africaine francophone : Ramatoulaye écrit à son amie Aïssatou après la mort de son mari.",
            sections: [
                {
                    id: 'presentation',
                    titre: 'Présentation',
                    icone: 'fa-info-circle',
                    html: `
                        <p>Publié en 1979, <em>Une si longue lettre</em> est un roman épistolaire de l'écrivaine sénégalaise Mariama Bâ. Cette œuvre majeure de la littérature africaine francophone explore avec finesse la condition des femmes dans la société sénégalaise postcoloniale à travers la correspondance de Ramatoulaye, qui vient de perdre son mari.</p>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-book-open me-2"></i>Genre et structure</h4>
                            <p>Le roman adopte la forme épistolaire : il se présente comme une longue lettre que Ramatoulaye adresse à son amie d'enfance Aïssatou. Cette structure intime permet une profonde introspection des personnages et une critique sociale subtile.</p>
                            <div class="quote p-3 my-2">
                                « Une si longue lettre… Je l'ai commencée dans la solitude et la douleur. Je la termine dans la solitude et la douleur. »
                            </div>
                        </div>
                        <div class="row g-3 my-4">
                            <div class="col-sm-6 col-lg-3">
                                <div class="theme-card p-3 h-100">
                                    <div class="text-muted small text-uppercase">Autrice</div>
                                    <div class="fw-bold">Mariama Bâ</div>
                                </div>
                            </div>
                            <div class="col-sm-6 col-lg-3">
                                <div class="theme-card p-3 h-100">
                                    <div class="text-muted small text-uppercase">Publication</div>
                                    <div class="fw-bold">1979</div>
                                </div>
                            </div>
                            <div class="col-sm-6 col-lg-3">
                                <div class="theme-card p-3 h-100">
                                    <div class="text-muted small text-uppercase">Genre</div>
                                    <div class="fw-bold">Roman épistolaire</div>
                                </div>
                            </div>
                            <div class="col-sm-6 col-lg-3">
                                <div class="theme-card p-3 h-100">
                                    <div class="text-muted small text-uppercase">Cadre</div>
                                    <div class="fw-bold">Sénégal</div>
                                </div>
                            </div>
                        </div>
                        <p class="mb-0">Le récit se déroule pendant les mois de veuvage de Ramatoulaye, qui revient sur sa vie conjugale, sur l'amitié qui la lie à Aïssatou et sur les transformations de la société sénégalaise après l'indépendance.</p>
                    `
                },
                {
                    id: 'analyse',
                    titre: 'Analyse littéraire',
                    icone: 'fa-search',
                    html: `
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-envelope-open-text me-2"></i>Une lettre qui tient lieu de récit</h4>
                            <p>La forme épistolaire n'est pas un simple décor : elle installe une narration à la première personne, adressée à une destinataire absente. Ramatoulaye ne raconte pas pour un lecteur anonyme, elle écrit pour être comprise par une amie. Cette adresse donne au texte sa tonalité confidentielle et autorise les digressions, les retours en arrière et les bilans.</p>
                            <p>Le récit est rétrospectif : le présent du veuvage encadre le passé conjugal. Ce va-et-vient entre ce qui est vécu et ce qui est analysé transforme la confidence en examen de conscience, puis en critique sociale.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-masks-theater me-2"></i>Registres et tonalités</h4>
                            <ul>
                                <li><strong>Lyrique</strong> : l'expression de la douleur personnelle, des souvenirs et de l'amitié.</li>
                                <li><strong>Pathétique</strong> : la solitude du veuvage, l'humiliation de la co-épouse imposée.</li>
                                <li><strong>Polémique</strong> : la dénonciation des traditions qui broient les individus, notamment les femmes.</li>
                            </ul>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-comment-dots me-2"></i>Une écriture de l'oralité</h4>
                            <p>Le roman intègre des proverbes, des formules de politesse et des tours propres à la parole wolof. Cette oralité donne au texte une chaleur et une autorité morale : la sentence traditionnelle est reprise pour être discutée, parfois retournée contre elle-même.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-lightbulb me-2"></i>Pistes pour le commentaire</h4>
                            <ul>
                                <li>Étudier les marques de l'énonciation (apostrophes, questions, impératifs) pour montrer la présence de la destinataire.</li>
                                <li>Analyser le champ lexical du corps et de la souffrance dans les passages du veuvage.</li>
                                <li>Montrer comment un souvenir personnel devient un argument collectif.</li>
                            </ul>
                        </div>
                    `
                },
                {
                    id: 'themes',
                    titre: 'Thèmes principaux',
                    icone: 'fa-tags',
                    html: `
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-venus me-2"></i>1. La condition féminine</h4>
                            <p>Mariama Bâ dépeint avec réalisme les difficultés des femmes africaines confrontées aux traditions patriarcales. Les thèmes du mariage, de la polygamie, du veuvage et de l'émancipation féminine sont centraux.</p>
                            <div class="quote p-3 my-2">« Le poids des traditions, des coutumes… est plus lourd que celui des cercueils. »</div>
                            <p>Le roman montre comment les femmes doivent naviguer entre les attentes traditionnelles et leurs propres aspirations, avec des personnages comme Ramatoulaye et Aïssatou qui représentent différentes approches de cette lutte.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-scale-balanced me-2"></i>2. Tradition contre modernité</h4>
                            <p>Le roman explore les tensions entre les valeurs traditionnelles africaines et les influences modernes, particulièrement dans le contexte postcolonial. Cette opposition se manifeste à travers :</p>
                            <ul>
                                <li>les conflits générationnels ;</li>
                                <li>les différentes conceptions du mariage ;</li>
                                <li>l'éducation des enfants ;</li>
                                <li>le rôle des femmes dans la société.</li>
                            </ul>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-heart me-2"></i>3. L'amitié féminine</h4>
                            <p>La relation entre Ramatoulaye et Aïssatou montre la solidarité féminine comme force de résistance face aux oppressions sociales.</p>
                            <div class="quote p-3 my-2">« Notre longue amitié a gardé ses merveilleuses qualités : franchise, dévouement. »</div>
                            <p>Cette amitié transcende les distances et les années, offrant aux deux femmes un espace de liberté et de soutien mutuel dans une société qui cherche souvent à les isoler.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-money-bill-wave me-2"></i>4. Le gaspillage dans les cérémonies</h4>
                            <p>Critique des dépenses ostentatoires lors des mariages et funérailles qui appauvrissent les familles tout en étant socialement obligatoires.</p>
                            <div class="quote p-3 my-2">« On s'endette pour un jour de gloire éphémère. »</div>
                            <p>Mariama Bâ dénonce cette pratique qui maintient les familles dans un cycle de pauvreté tout en servant à maintenir les apparences et le statut social.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-graduation-cap me-2"></i>5. L'éducation comme levier</h4>
                            <p>Les études ne sont jamais un simple ornement dans le roman : elles donnent aux personnages les moyens de nommer ce qu'elles subissent. Le parcours d'Aïssatou, qui devient indépendante grâce à son travail, illustre cette idée que l'autonomie matérielle conditionne la liberté de choix.</p>
                        </div>
                    `
                },
                {
                    id: 'personnages',
                    titre: 'Personnages clés',
                    icone: 'fa-users',
                    html: `
                        <div class="row">
                            <div class="col-md-6 mb-4">
                                <div class="theme-card p-3 h-100">
                                    <h4 class="text-dark"><i class="fas fa-user-edit me-2"></i>Ramatoulaye</h4>
                                    <p>La narratrice et protagoniste principale. Professeure, mère de famille et veuve, elle écrit à son amie Aïssatou pour raconter sa vie, ses épreuves et ses réflexions sur la condition féminine.</p>
                                    <p><strong>Caractéristiques :</strong></p>
                                    <ul>
                                        <li>Éduquée et réfléchie</li>
                                        <li>Fidèle à ses valeurs malgré les épreuves</li>
                                        <li>Critique envers les traditions oppressives</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6 mb-4">
                                <div class="theme-card p-3 h-100">
                                    <h4 class="text-dark"><i class="fas fa-user-friends me-2"></i>Aïssatou</h4>
                                    <p>Destinataire de la lettre et meilleure amie de Ramatoulaye. Elle a quitté son mari lorsqu'il a pris une seconde épouse, symbolisant la résistance aux traditions oppressives.</p>
                                    <p><strong>Caractéristiques :</strong></p>
                                    <ul>
                                        <li>Indépendante et déterminée</li>
                                        <li>Expatriée aux États-Unis</li>
                                        <li>Modèle d'émancipation féminine</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6 mb-4">
                                <div class="theme-card p-3 h-100">
                                    <h4 class="text-dark"><i class="fas fa-user-tie me-2"></i>Modou Fall</h4>
                                    <p>Le défunt mari de Ramatoulaye. Après vingt-cinq ans de mariage, il prend une seconde épouse, Binetou, et abandonne progressivement Ramatoulaye et leurs enfants.</p>
                                    <p><strong>Caractéristiques :</strong></p>
                                    <ul>
                                        <li>Fonctionnaire respecté</li>
                                        <li>Succombe aux pressions sociales</li>
                                        <li>Représente l'homme tiraillé entre tradition et modernité</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6 mb-4">
                                <div class="theme-card p-3 h-100">
                                    <h4 class="text-dark"><i class="fas fa-user-graduate me-2"></i>Binetou</h4>
                                    <p>Jeune étudiante contrainte d'épouser Modou Fall pour des raisons financières. Elle représente les victimes des mariages arrangés.</p>
                                    <p><strong>Caractéristiques :</strong></p>
                                    <ul>
                                        <li>Jeune et belle</li>
                                        <li>Sacrifiée par sa famille</li>
                                        <li>Victime des attentes sociales</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6 mb-4">
                                <div class="theme-card p-3 h-100">
                                    <h4 class="text-dark"><i class="fas fa-user-shield me-2"></i>Mawdo Bâ</h4>
                                    <p>Mari d'Aïssatou, médecin respecté, qui cède à la volonté familiale en épousant sa cousine. Son personnage montre qu'un homme instruit peut reproduire les schémas qu'il prétend critiquer.</p>
                                    <p><strong>Caractéristiques :</strong></p>
                                    <ul>
                                        <li>Héritier d'une grande famille</li>
                                        <li>Déchiré entre amour et devoir familial</li>
                                        <li>Illustration de la pression du groupe</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6 mb-4">
                                <div class="theme-card p-3 h-100">
                                    <h4 class="text-dark"><i class="fas fa-user-clock me-2"></i>Daouda Dieng</h4>
                                    <p>Ami de longue date de la famille, médecin lui aussi, qui demande Ramatoulaye en mariage à la fin du roman. Il incarne une autre manière d'aimer, fondée sur le respect et le choix libre.</p>
                                    <p><strong>Caractéristiques :</strong></p>
                                    <ul>
                                        <li>Patient et respectueux</li>
                                        <li>Porte une vision moderne du couple</li>
                                        <li>Laisse à Ramatoulaye la liberté de décider</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `
                },
                {
                    id: 'contexte',
                    titre: 'Contexte historique',
                    icone: 'fa-history',
                    html: `
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-globe-africa me-2"></i>Le Sénégal après l'indépendance</h4>
                            <p>Le Sénégal accède à l'indépendance en 1960. Le roman se situe dans les décennies qui suivent : une période d'urbanisation rapide, de développement de l'école publique et de transformation des modèles familiaux. Les personnages appartiennent à une génération formée à l'école française tout en restant insérée dans des réseaux familiaux traditionnels.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-people-roof me-2"></i>Le poids des structures familiales</h4>
                            <p>Dans la société dépeinte, le mariage engage les familles autant que les individus. La polygamie, l'alliance avec la famille élargie et les obligations cérémonielles structurent les rapports sociaux. C'est précisément cette emprise que les héroïnes interrogent : elles ne rejettent pas toute tradition, mais refusent celles qui nient la personne.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-pen-nib me-2"></i>Mariama Bâ (1929-1981)</h4>
                            <p>Institutrice puis directrice d'école, Mariama Bâ est aussi une militante engagée pour les droits des femmes et contre les inégalités sociales. Son œuvre, brève et dense, est portée par cette expérience de terrain. <em>Une si longue lettre</em> a reçu en 1980 le prix Noma, qui récompense pour la première fois une œuvre africaine publiée en Afrique.</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-book me-2"></i>Place dans l'histoire littéraire</h4>
                            <p>Le roman paraît après le moment de la négritude et accompagne l'émergence d'écritures qui déplacent le regard : de la célébration identitaire vers l'analyse des rapports sociaux internes. La voix féminine y occupe une place centrale, ce qui fait de cette œuvre une référence pour les études postcoloniales et de genre.</p>
                        </div>
                    `
                },
                {
                    id: 'exposes',
                    titre: 'Exposés corrigés',
                    icone: 'fa-file-lines',
                    html: `
                        <p class="text-muted">Deux exposés complets, avec plan, introduction rédigée et conclusion. À utiliser comme modèle de méthode, pas comme texte à réciter.</p>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-file-signature me-2"></i>Exposé 1 — La polygamie dans <em>Une si longue lettre</em></h4>
                            <p><strong>Problématique :</strong> comment le roman passe-t-il d'un récit personnel du mariage polygame à une critique sociale argumentée ?</p>
                            <p><strong>Plan :</strong></p>
                            <ol>
                                <li>La polygamie vécue : blessure intime et humiliation quotidienne</li>
                                <li>La polygamie comme institution : familles, argent et statut</li>
                                <li>Les réponses possibles : résignation, fuite, reconstruction</li>
                            </ol>
                            <p><strong>Introduction rédigée :</strong> « Dans <em>Une si longue lettre</em>, Mariama Bâ fait le choix d'une confidence pour parler d'une institution. En confiant à Ramatoulaye le soin de raconter son veuvage, elle installe le lecteur dans l'intimité d'une blessure avant de la transformer en objet de réflexion. La polygamie y apparaît d'abord comme un événement privé, puis se révèle être un mécanisme social où se jouent la domination des hommes, la complicité des familles et la vulnérabilité économique des femmes. Nous verrons comment le roman fait de cette expérience singulière une critique argumentée de l'institution, avant d'examiner les réponses que les personnages lui opposent. »</p>
                            <p><strong>Développement (idées principales) :</strong></p>
                            <ul>
                                <li>Le récit de la seconde noce montre la polygamie comme une décision prise sans la première épouse.</li>
                                <li>Les familles organisent les alliances pour des raisons matérielles et symboliques ; Binetou est un objet d'échange.</li>
                                <li>Aïssatou choisit la rupture et l'exil professionnel ; Ramatoulaye choisit de rester, puis de reconstruire sa dignité autrement.</li>
                            </ul>
                            <p><strong>Conclusion rédigée :</strong> « Le roman ne se contente pas de dénoncer : il montre des femmes qui agissent avec les moyens dont elles disposent. En passant de la plainte à l'analyse, Ramatoulaye fait de sa lettre un acte de lucidité, et transforme la blessure en parole publique. C'est là que réside la force critique de l'œuvre : elle ne parle pas de la polygamie en général, elle en montre les effets sur des existences singulières. »</p>
                        </div>
                        <div class="theme-card p-3 my-4">
                            <h4 class="text-dark"><i class="fas fa-file-signature me-2"></i>Exposé 2 — Tradition et modernité</h4>
                            <p><strong>Problématique :</strong> le roman oppose-t-il radicalement tradition et modernité, ou cherche-t-il une troisième voie ?</p>
                            <p><strong>Plan :</strong></p>
                            <ol>
                                <li>Une opposition apparente : deux mondes, deux générations</li>
                                <li>Des frontières poreuses : personnages hybrides et compromis</li>
                                <li>Une troisième voie : réformer sans trahir</li>
                            </ol>
                            <p><strong>Introduction rédigée :</strong> « On lit souvent <em>Une si longue lettre</em> comme un conflit entre un monde ancien et un monde nouveau. Le roman met en effet face à face deux générations et deux conceptions du mariage. Pourtant, la lettre de Ramatoulaye ne se réduit pas à un réquisitoire : elle distingue les usages qui font vivre de ceux qui écrasent. En cela, l'œuvre propose moins une rupture qu'un tri, et c'est ce travail de discernement qu'il faut interroger. »</p>
                            <p><strong>Développement (idées principales) :</strong></p>
                            <ul>
                                <li>Les personnages instruits ne sont pas automatiquement modernes : Mawdo Bâ en est la preuve.</li>
                                <li>Ramatoulaye conserve des pratiques traditionnelles tout en refusant leur versant oppressif.</li>
                                <li>L'école, le travail et l'amitié constituent des espaces de liberté concrets, plus que des slogans.</li>
                            </ul>
                            <p><strong>Conclusion rédigée :</strong> « La modernité, dans ce roman, ne consiste pas à quitter sa culture mais à en discuter les règles. La lettre devient alors l'instrument de ce débat : elle transmet, explique, conteste et transmet encore. C'est cette circulation de la parole entre deux femmes qui permet d'inventer une fidélité sans soumission. »</p>
                        </div>
                    `
                }
            ]
        }
    ];

    function getMatiere(slug) {
        return matieres.find(function (m) { return m.slug === slug; }) || null;
    }

    function getNiveau(slug) {
        return niveaux.find(function (n) { return n.slug === slug; }) || null;
    }

    function getCours(slug) {
        return cours.find(function (c) { return c.slug === slug; }) || null;
    }

    function getChapitres() {
        const liste = [];
        matieres.forEach(function (matiere) {
            matiere.chapitres.forEach(function (chapitre) {
                liste.push(Object.assign({}, chapitre, {
                    matiere: matiere.slug,
                    matiereNom: matiere.nom,
                    matiereIcone: matiere.icone,
                    matiereCouleur: matiere.couleur
                }));
            });
        });
        return liste;
    }

    function getChapitre(id) {
        return getChapitres().find(function (c) { return c.id === id; }) || null;
    }

    function chapitresDuNiveau(niveauSlug) {
        return getChapitres().filter(function (c) { return c.niveau === niveauSlug; });
    }

    /**
     * Diapositives du carrousel de la page d'accueil.
     * `image` est facultatif : sans image, la diapositive s'affiche avec un
     * dégradé et une icône (aucune dépendance externe).
     */
    const diapositives = [
        {
            titre: 'Apprendre sans limites',
            texte: "Cours, fiches et exercices interactifs du collège à l'enseignement supérieur, réunis dans un seul espace.",
            icone: 'fa-graduation-cap',
            embleme: 'fa-earth-africa',
            variante: 'violet',
            image: 'assets/images/carrousel/slide-1.jpg',
            credit: 'Photo : Dorothy Voorhees — CC BY-SA 2.0',
            cta: { libelle: 'Explorer les matières', href: '#/matieres' }
        },
        {
            titre: 'Des exercices qui corrigent instantanément',
            texte: 'Quiz chronométrés, associations et textes à trous : chaque réponse est expliquée.',
            icone: 'fa-gamepad',
            embleme: 'fa-brain',
            variante: 'orange',
            image: 'assets/images/carrousel/slide-2.jpg',
            credit: 'Photo : Boydiop2 — CC BY-SA 4.0',
            cta: { libelle: "S'entraîner maintenant", href: '#/exercices' }
        },
        {
            titre: 'Une bibliothèque pour approfondir',
            texte: 'Romans, annales et manuels classés par matière et par niveau, réservés aux élèves connectés.',
            icone: 'fa-book-open',
            embleme: 'fa-book-bookmark',
            variante: 'vert',
            image: 'assets/images/carrousel/slide-3.jpg',
            credit: 'Photo : nathan williams — CC BY 2.0',
            cta: { libelle: 'Ouvrir la bibliothèque', href: '#/bibliotheque' }
        },
        {
            titre: 'Suivez vos progrès, mois après mois',
            texte: 'Moyenne, historique et badges personnels : vous savez toujours où vous en êtes.',
            icone: 'fa-chart-line',
            embleme: 'fa-chart-simple',
            variante: 'bleu',
            image: 'assets/images/carrousel/slide-4.jpg',
            credit: 'Photo : Richard David Ramsey — domaine public',
            cta: { libelle: 'Ma progression', href: '#/profil' }
        },
        {
            titre: 'Un espace pour chaque enseignant',
            texte: 'Créez vos classes, publiez vos leçons et vos séances, suivez les résultats de vos élèves.',
            icone: 'fa-chalkboard-user',
            embleme: 'fa-users-rectangle',
            variante: 'bordeaux',
            image: 'assets/images/carrousel/slide-5.jpg',
            credit: 'Photo : Rumuri Rutazima — CC BY 4.0',
            cta: { libelle: 'Créer mon espace', href: '#/connexion?mode=inscription' }
        },
        {
            titre: 'IAFA FAMA, votre assistant de lecture',
            texte: 'Choisissez une œuvre : résumé, personnages, thèmes, citations et questions arrivent en quelques secondes.',
            icone: 'fa-wand-magic-sparkles',
            embleme: 'fa-star',
            variante: 'violet',
            image: 'assets/images/carrousel/slide-6.jpg',
            credit: 'Illustration : LearnHub',
            cta: { libelle: 'Essayer IAFA FAMA', href: '#/ia' }
        }
    ];

    return {
        developpeur: developpeur,
        matieres: matieres,
        niveaux: niveaux,
        cours: cours,
        exercicesSeed: exercicesSeed,
        ressourcesSeed: ressourcesSeed,
        diapositives: diapositives,
        getMatiere: getMatiere,
        getNiveau: getNiveau,
        getCours: getCours,
        getChapitres: getChapitres,
        getChapitre: getChapitre,
        chapitresDuNiveau: chapitresDuNiveau
    };
})();
