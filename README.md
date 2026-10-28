# LearnHub — Plateforme d'apprentissage

Site web éducatif statique qui regroupe des cours, des fiches de révision et des exercices interactifs, du collège à l'enseignement supérieur.

**Site en ligne :** <https://samba96j.github.io/site-apprentissage/>

![Aperçu de LearnHub](assets/images/hero-education.png)

## Fonctionnalités

- **Une seule page, plusieurs vues.** `index.html` sert de point d'entrée unique et affiche les vues par routage d'ancre (`#/matieres`, `#/niveau/lycee`, `#/admin`…). Le menu, la session et la recherche sont donc partagés partout.
- **Contenus réels.** 4 matières, 3 niveaux et 24 chapitres rédigés (résumé, objectifs, points clés), consultables par matière, par niveau ou individuellement.
- **Étude d'œuvre complète.** *Une si longue lettre* de Mariama Bâ : présentation, analyse littéraire, thèmes, personnages, contexte historique et deux exposés corrigés.
- **Exercices interactifs.** Quiz chronométré, jeu d'associations (clic ou glisser-déposer) et textes à trous, avec correction immédiate. 14 exercices répartis sur les quatre matières, filtrables par matière.
- **Suivi de progression.** Chaque tentative est enregistrée : moyenne, meilleur score, historique et badges (premier pas, sans faute, persévérant, polyvalent, expert).
- **Recherche globale.** Un champ unique interroge les matières, les chapitres, le cours, les exercices et les ressources.
- **Espace administrateur réel.** Création, modification, activation et suppression des exercices ; gestion des ressources (liens ou PDF importés) ; gestion des utilisateurs et des rôles ; statistiques calculées ; export CSV ; paramètres appliqués aux exercices.
- **Un espace par enseignant.** Chaque administrateur dispose de son propre espace cloisonné : ses exercices, leçons, ressources, classes, séances et réglages sont invisibles pour les autres administrateurs. Un nouvel espace peut importer la bibliothèque de démonstration en un clic.
- **Leçons et exercices personnalisés.** Chaque enseignant rédige ses propres leçons avec un éditeur riche (gras, italique, titres, listes, citations, liens) et crée ses propres quiz, associations ou textes à trous, sans toucher au code.
- **Contact développeur.** Une page `#/contact` présente M.BA, Ingénieur en génie logiciel, avec un formulaire de message ; les messages sont consultables dans la super-administration.
- **Classes et séances.** Un enseignant crée des classes avec un code d'inscription, planifie des séances (date, durée, chapitres du site, ses leçons, exercices assignés, classes ciblées), publie ou masque celles-ci, et suit les résultats de chaque élève.
- **Espace élève personnalisé.** En saisissant le code de sa classe, un élève rejoint l'espace de son enseignant et accède à ses séances, ses chapitres et ses exercices, avec la progression réalisée séance par séance.
- **Navigation corrigée.** Aucun lien mort : le pied de page, les menus et les fil d'Ariane pointent tous vers une vue existante. Les anciennes adresses (`exo.html`, `theme.html`, `eleve/**`) redirigent automatiquement.

## Comptes et identifiants

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Élève (démo) | `etudiant` | `motdepasse` |
| Administrateur | défini dans `COMPTES_DEMO` ([auth.js](assets/js/auth.js)) | idem |
| Super-administrateur | défini dans `SUPER_ADMIN_AMORCAGE` ([auth.js](assets/js/auth.js)) | idem |

Pour éviter tout accès non désiré, la page de connexion **n'affiche plus aucun identifiant** : le formulaire reste utilisable avec les coordonnées définies dans le code. Personnalisez `SUPER_ADMIN_AMORCAGE` avant publication, puis changez le mot de passe depuis `#/superadmin` → « Mes identifiants super-admin » (une alerte rouge s'affiche tant que le mot de passe d'amorçage est encore actif).

> **Limite du site statique.** Comptes, rôles et règles d'accès vivent dans le navigateur. Masquer les identifiants dans l'interface évite les accès accidentels, mais ne remplace pas une authentification serveur : toute personne qui lit le JavaScript peut retrouver les valeurs du code. Pour une réelle protection, ajoutez un backend (Supabase, Firebase, API…) et vérifiez les rôles côté serveur.

## Contact du développeur

La page `#/contact` présente **M.BA — Ingénieur en génie logiciel** et un formulaire (nom, e-mail, sujet, message). Les messages sont enregistrés dans le navigateur et listés dans `#/superadmin` → « Messages reçus », avec suppression possible.

Pour activer l'envoi par messagerie, renseignez l'adresse dans [data.js](assets/js/data.js) :

```js
const developpeur = {
    nom: 'M.BA',
    titre: 'Ingénieur en génie logiciel',
    email: 'votre.adresse@exemple.com',
    role: 'Conception et développement de la plateforme LearnHub'
};
```

Un bouton « Ouvrir dans ma messagerie » apparaît alors après l'envoi (lien `mailto:`). Sans backend ni service de formulaires, aucun message n'est transmis automatiquement à distance : c'est une limite du site statique.

L'inscription est ouverte. Une case à cocher permet de créer directement un **espace enseignant** (rôle administrateur) ; sans elle, le compte est un compte élève. Un administrateur peut changer le rôle des élèves rattachés à ses classes.

Le rôle **super-administrateur** `#/superadmin` dépasse le cloisonnement des espaces : il liste tous les comptes, affiche leur espace et leur classe, permet de changer les rôles (élève, administrateur, super-admin), de réinitialiser une progression, de supprimer un compte, d'en créer et d'exporter la liste en CSV. Seul un super-administrateur peut attribuer ce rôle ; un compte d'amorçage est créé automatiquement s'il n'en existe aucun.

Les identifiants du super-administrateur se remplacent directement dans `#/superadmin`, rubrique **« Mes identifiants super-admin »** : nom d'utilisateur, e-mail et mot de passe (l'historique de progression suit le renommage). Pour une installation neuve, les valeurs d'amorçage sont définies dans la constante `SUPER_ADMIN_AMORCAGE` de [auth.js](assets/js/auth.js).

## Espaces enseignants, classes et séances

1. **Créer son espace.** S'inscrire en cochant « Je suis enseignant », ou être promu administrateur. Chaque administrateur reçoit un identifiant d'espace (`esp-…`) et peut le renommer dans `#/admin/parametres`.
2. **Créer une classe.** `#/admin/classes` → « Nouvelle classe ». Le code généré (ex. `AB12CD`) est à communiquer aux élèves.
3. **Rejoindre une classe.** L'élève se connecte, va dans `#/profil` et saisit le code. Il voit alors les séances, leçons et exercices de cet espace.
4. **Rédiger ses contenus.** `#/admin/lecons` → « Nouvelle leçon » (titre, matière, niveau, durée, résumé, objectifs, contenu mis en forme : gras, titres, listes, citations, liens) ; `#/admin/exercices` → « Nouvel exercice » (quiz, associations, textes à trous).
5. **Planifier une séance.** `#/admin/seances` → « Nouvelle séance » : titre, date, durée, classes ciblées, chapitres du site, ses propres leçons, exercices assignés, publication.
6. **Suivre les résultats.** Le bouton « Suivi » d'une séance affiche, pour chaque élève, le nombre d'exercices réalisés, la moyenne, la dernière activité et le meilleur score par exercice.

Les contenus publics livrés avec le site restent visibles pour les visiteurs et les élèves sans classe. Un espace enseignant est vide au départ : le bouton « Bibliothèque démo » (onglet Exercices) ou « Importer la bibliothèque de démonstration » (onglet Paramètres) y copie les 14 exercices.

## Routes principales

| Route | Vue |
|---|---|
| `#/` | Accueil |
| `#/matieres` · `#/matiere/maths` | Liste des matières et détail d'une matière |
| `#/niveaux` · `#/niveau/lycee` | Liste des niveaux et détail d'un niveau |
| `#/chapitre/maths-pythagore` | Fiche d'un chapitre |
| `#/cours/une-si-longue-lettre` | Étude d'œuvre (section optionnelle : `…/exposes`) |
| `#/exercices` · `#/exercices?exo=<id>` | Exercices interactifs (tous, ou un exercice assigné) |
| `#/lecons` · `#/lecon/<id>` | Leçons de l'espace de l'élève et contenu d'une leçon |
| `#/seances` | Séances de la classe de l'élève |
| `#/recherche?q=polygamie` | Recherche |
| `#/connexion` · `#/profil` | Authentification, classe et progression |
| `#/contact` | Présentation du développeur et formulaire de contact |
| `#/admin/classes` · `#/admin/lecons` · `#/admin/seances` | Classes, leçons et séances de l'enseignant |
| `#/admin/exercices` | Back-office (réservé aux administrateurs) |
| `#/superadmin` | Gestion globale de tous les comptes (super-administrateur) |

## Structure du projet

```
.
├── index.html                  # Coquille de l'application (en-tête, vue, pied de page)
├── styles.css                  # Styles de base (couleurs, typographie, cartes)
├── exo.html                    # Redirection vers l'étude d'œuvre
├── theme.html                  # Redirection vers le back-office
├── assets/
│   ├── css/
│   │   ├── app.css             # Composants de l'application
│   │   ├── admin.css           # Composants du back-office
│   │   └── cours.css           # Composants du cours et des exercices
│   ├── js/
│   │   ├── data.js             # Source de données unique (matières, cours, exercices)
│   │   ├── store.js            # Persistance locale (contenus par espace, classes, séances)
│   │   ├── auth.js             # Comptes, session et progression
│   │   ├── games.js            # Quiz, associations, textes à trous
│   │   ├── admin.js            # Back-office
│   │   └── app.js              # Routage et vues
│   └── images/
└── eleve/                      # Anciennes pages, redirigées vers les nouvelles routes
```

## Lancer le site

Le site est entièrement statique : aucune installation n'est nécessaire.

1. Cloner le dépôt :

   ```bash
   git clone https://github.com/<utilisateur>/site-apprentissage.git
   ```

2. Ouvrir `index.html` dans un navigateur.

Pour un rendu identique à celui d'un hébergement, servir le dossier avec un serveur local :

```bash
python -m http.server 8000
```

puis ouvrir <http://localhost:8000>.

> Un serveur local est recommandé : certains navigateurs limitent le stockage local et l'API de hachage lorsqu'une page est ouverte via `file://`.

## Ajouter du contenu

- **Un chapitre** : ajouter une entrée dans `matieres[].chapitres` de [data.js](assets/js/data.js) (`id`, `niveau`, `titre`, `resume`, `objectifs`, `points`, `duree`).
- **Une matière ou un niveau** : compléter les tableaux `matieres` ou `niveaux` du même fichier.
- **Un exercice** : le créer depuis `#/admin/exercices` (persisté dans le navigateur, rattaché à votre espace) ou l'ajouter à `exercicesSeed`.
- **Une leçon** : la rédiger depuis `#/admin/lecons`, puis l'assigner à une séance dans `#/admin/seances`.

## Technologies

- HTML5 / CSS3
- [Bootstrap 5](https://getbootstrap.com/) et [Font Awesome 6](https://fontawesome.com/) via CDN
- JavaScript natif, sans framework ni gestionnaire de paquets

## Limites connues

Le site n'a pas de serveur : les comptes, les scores, les exercices créés et les ressources importées sont stockés dans le navigateur (`localStorage`).

- Les données ne sont pas partagées entre appareils ni entre navigateurs.
- Les mots de passe ne sont jamais stockés en clair (condensat salé), mais une authentification réelle exigerait un back-end.
- Vider les données du navigateur réinitialise les comptes créés et la progression ; le contenu de démonstration est alors régénéré automatiquement.

## Contribution

Les contributions sont bienvenues. Merci d'ouvrir une *issue* pour signaler un problème ou proposer une amélioration, puis une *pull request* avec vos modifications.
