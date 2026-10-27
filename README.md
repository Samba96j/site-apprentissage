# LearnHub — Plateforme d'apprentissage

Site web éducatif statique qui regroupe des cours, des fiches de révision et des exercices interactifs, du collège à l'enseignement supérieur.

**Site en ligne :** <https://samba96j.github.io/site-apprentissage/>

![Aperçu de LearnHub](assets/images/presentation-bibliotheque.png)

## Fonctionnalités

- **Une seule page, plusieurs vues.** `index.html` sert de point d'entrée unique et affiche les vues par routage d'ancre (`#/matieres`, `#/niveau/lycee`, `#/admin`…). Le menu, la session et la recherche sont donc partagés partout.
- **Contenus réels.** 4 matières, 3 niveaux et 24 chapitres rédigés (résumé, objectifs, points clés), consultables par matière, par niveau ou individuellement.
- **Étude d'œuvre complète.** *Une si longue lettre* de Mariama Bâ : présentation, analyse littéraire, thèmes, personnages, contexte historique et deux exposés corrigés.
- **Exercices interactifs.** Quiz chronométré, jeu d'associations (clic ou glisser-déposer) et textes à trous, avec correction immédiate. 14 exercices répartis sur les quatre matières, filtrables par matière.
- **Suivi de progression.** Chaque tentative est enregistrée : moyenne, meilleur score, historique et badges (premier pas, sans faute, persévérant, polyvalent, expert).
- **Recherche globale.** Un champ unique interroge les matières, les chapitres, le cours, les exercices et les ressources.
- **Espace administrateur réel.** Création, modification, activation et suppression des exercices ; gestion des ressources (liens ou PDF importés) ; gestion des utilisateurs et des rôles ; statistiques calculées ; export CSV ; paramètres appliqués aux exercices.
- **Navigation corrigée.** Aucun lien mort : le pied de page, les menus et les fil d'Ariane pointent tous vers une vue existante. Les anciennes adresses (`exo.html`, `theme.html`, `eleve/**`) redirigent automatiquement.

## Comptes de démonstration

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Élève | `etudiant` | `motdepasse` |
| Administrateur | `admin` | `admin123` |

L'inscription est ouverte : tout nouveau compte est créé avec le rôle « élève ». Seul un administrateur peut changer un rôle.

## Routes principales

| Route | Vue |
|---|---|
| `#/` | Accueil |
| `#/matieres` · `#/matiere/maths` | Liste des matières et détail d'une matière |
| `#/niveaux` · `#/niveau/lycee` | Liste des niveaux et détail d'un niveau |
| `#/chapitre/maths-pythagore` | Fiche d'un chapitre |
| `#/cours/une-si-longue-lettre` | Étude d'œuvre (section optionnelle : `…/exposes`) |
| `#/exercices` | Exercices interactifs |
| `#/recherche?q=polygamie` | Recherche |
| `#/connexion` · `#/profil` | Authentification et progression |
| `#/admin/exercices` | Back-office (réservé aux administrateurs) |

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
│   │   ├── store.js            # Persistance locale (exercices, ressources, paramètres)
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
- **Un exercice** : le créer depuis `#/admin/exercices` (persisté dans le navigateur) ou l'ajouter à `exercicesSeed`.

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
