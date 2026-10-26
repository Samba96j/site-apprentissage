# LearnHub — Plateforme d'apprentissage

Site web éducatif statique qui regroupe des cours, des fiches de révision et des exercices interactifs, du collège à l'enseignement supérieur.

**Site en ligne :** <https://samba96j.github.io/site-apprentissage/>

![Aperçu de LearnHub](assets/images/hero-education.png)

## Fonctionnalités

- **Page d'accueil** : présentation des domaines de connaissance (mathématiques, sciences, lettres et langues), des méthodes pédagogiques et appel à l'inscription.
- **Espace élève** (`exo.html`) : étude complète de l'œuvre *Une si longue lettre* de Mariama Bâ (présentation, thèmes, analyse littéraire, personnages, contexte historique, exposés corrigés) avec des exercices interactifs : quiz chronométré, jeu d'associations et textes à trous.
- **Espace administrateur** (`theme.html`) : tableau de bord de gestion des exercices, des ressources PDF, des utilisateurs et des statistiques.
- **Pages de matières et de niveaux** : navigation en place, prête à accueillir les contenus à venir.

> L'authentification de l'espace élève est une démonstration côté navigateur (`localStorage`) : aucune donnée n'est envoyée à un serveur.

## Structure du projet

```
.
├── index.html              # Page d'accueil
├── exo.html                # Espace élève : cours et exercices
├── theme.html              # Espace administrateur
├── styles.css              # Feuille de style commune
├── assets/
│   └── images/
│       ├── hero-education.png
│       └── logo.png
└── eleve/
    ├── matieres/           # Français, mathématiques, sciences, langues
    └── niveaux/            # Collège, lycée, supérieur
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

## Technologies

- HTML5 / CSS3
- [Bootstrap 5](https://getbootstrap.com/)
- [Font Awesome 6](https://fontawesome.com/)
- [jQuery](https://jquery.com/) et [DataTables](https://datatables.net/) pour l'espace administrateur

Les dépendances sont chargées via CDN : aucun gestionnaire de paquets n'est requis.

## Contribution

Les contributions sont bienvenues. Merci d'ouvrir une *issue* pour signaler un problème ou proposer une amélioration, puis une *pull request* avec vos modifications.
