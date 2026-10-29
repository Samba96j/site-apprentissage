# LearnHub — Plateforme d'apprentissage

Site web éducatif statique qui regroupe des cours, des fiches de révision et des exercices interactifs, du collège à l'enseignement supérieur.

**Site en ligne :** <https://samba96j.github.io/site-apprentissage/>

![Aperçu de LearnHub](assets/images/hero-education.png)

## Fonctionnalités

- **Une seule page, plusieurs vues.** `index.html` sert de point d'entrée unique et affiche les vues par routage d'ancre (`#/matieres`, `#/niveau/lycee`, `#/admin`…). Le menu, la session et la recherche sont donc partagés partout.
- **Contenus réels.** 5 matières, 3 niveaux et 28 chapitres rédigés (résumé, objectifs, points clés), consultables par matière, par niveau ou individuellement.
- **Étude d'œuvre complète.** *Une si longue lettre* de Mariama Bâ : présentation, analyse littéraire, thèmes, personnages, contexte historique et deux exposés corrigés.
- **Exercices interactifs.** Quiz chronométré, jeu d'associations (clic ou glisser-déposer) et textes à trous, avec correction immédiate. 17 exercices répartis sur les cinq matières, filtrables par matière.
- **Suivi de progression.** Chaque tentative est enregistrée : moyenne, meilleur score, historique et badges (premier pas, sans faute, persévérant, polyvalent, expert).
- **Recherche globale.** Un champ unique interroge les matières, les chapitres, le cours, les exercices et les ressources.
- **Espace administrateur réel.** Création, modification, activation et suppression des exercices ; gestion des ressources (liens ou PDF importés) ; gestion des utilisateurs et des rôles ; statistiques calculées ; export CSV ; paramètres appliqués aux exercices.
- **Un espace par enseignant.** Chaque administrateur dispose de son propre espace cloisonné : ses exercices, leçons, ressources, classes, séances et réglages sont invisibles pour les autres administrateurs. Un nouvel espace peut importer la bibliothèque de démonstration en un clic.
- **Leçons et exercices personnalisés.** Chaque enseignant rédige ses propres leçons avec un éditeur riche (gras, italique, titres, listes, citations, liens) et crée ses propres quiz, associations ou textes à trous, sans toucher au code.
- **Contact développeur.** Une page `#/contact` présente M.BA, Ingénieur en génie logiciel, avec un formulaire de message ; les messages sont consultables dans la super-administration.
- **Classes et séances.** Un enseignant crée des classes avec un code d'inscription, planifie des séances (date, durée, chapitres du site, ses leçons, exercices assignés, classes ciblées), publie ou masque celles-ci, et suit les résultats de chaque élève.
- **Espace élève personnalisé.** En saisissant le code de sa classe, un élève rejoint l'espace de son enseignant et accède à ses séances, ses chapitres et ses exercices, avec la progression réalisée séance par séance. Son espace l'accueille par son nom (« Bonjour … ») et n'affiche pas le nom de l'enseignant.
- **IAFA FAMA (assistant IA).** Page `#/ia` : l'élève choisit une œuvre (ou pose une question) et reçoit une fiche structurée rédigée par une IA (Gemini gratuit par défaut, Edge Function Supabase). Chaque fiche est enregistrée dans son espace personnel et peut être relue ou supprimée. L'entrée « IAFA FAMA » (badge **IA**) remplace « Étude d'œuvre » dans le menu principal ; la fiche rédigée du programme reste accessible depuis le pied de page et depuis la page IA. Les onglets Leçons, Bibliothèque, Exercices et Séances sont regroupés dans le menu déroulant **Apprendre**. Le nom et la description de l'assistant sont définis une seule fois (`NOM_IA`, `DESCRIPTION_IA`) dans [app.js](assets/js/app.js).
- **Navigation corrigée.** Aucun lien mort : le pied de page, les menus et les fil d'Ariane pointent tous vers une vue existante. Les anciennes adresses (`exo.html`, `theme.html`, `eleve/**`) redirigent automatiquement.

## Comptes et identifiants

Avec le backend Supabase activé (voir plus bas), les comptes sont créés par l'inscription du site (e-mail + mot de passe) et stockés dans Supabase. La page de connexion **n'affiche aucun identifiant**.

- Les rôles (`eleve`, `admin`, `superadmin`) sont dans la table `profiles`.
- Le rôle `superadmin` ne peut pas être obtenu à l'inscription : il se donne manuellement dans le SQL Editor :
  `update public.profiles set role = 'superadmin' where username = 'votre_pseudo';`
- La suppression d'un compte et le changement de rôle passent par le tableau de bord Supabase (clé `service_role` côté serveur uniquement).
- La création de compte publique peut être désactivée dans **Authentication → Sign In / Providers**.

Sans backend (mode local, `backend: false`), les comptes de démonstration restent définis dans `COMPTES_DEMO` / `SUPER_ADMIN_AMORCAGE` de [auth.js](assets/js/auth.js) et sont stockés dans le navigateur.

## Contact du développeur

La page `#/contact` présente **M.BA — Ingénieur en génie logiciel** et un formulaire (nom, e-mail, sujet, message). Les messages sont envoyés via Formspree et une copie est enregistrée dans Supabase, consultable dans `#/superadmin` → « Messages reçus » (suppression possible).

Aucune adresse e-mail n'est publiée sur le site. Le formulaire passe par un service externe :

1. Le formulaire gratuit [Formspree](https://formspree.io) est déjà relié au compte du développeur.
2. Son endpoint est configuré dans [data.js](assets/js/data.js) :

```js
const developpeur = {
    nom: 'M.BA',
    titre: 'Ingénieur en génie logiciel',
    formulaire: 'https://formspree.io/f/xdeegrzw',
    role: 'Conception et développement de la plateforme LearnHub'
};
```

Le formulaire envoie alors les champs en `POST` au service, qui les transmet par e-mail. Pour changer de service ou de formulaire, remplacer la valeur de `formulaire`. Si l'endpoint est vide, les messages sont seulement conservés dans le navigateur et visibles dans la super-administration.

L'inscription est ouverte. Une case à cocher permet de créer directement un **espace enseignant** (rôle administrateur) ; sans elle, le compte est un compte élève. Un administrateur peut changer le rôle des élèves rattachés à ses classes.

Le rôle **super-administrateur** `#/superadmin` dépasse le cloisonnement des espaces : il liste tous les comptes, affiche leur espace et leur classe, permet de changer les rôles (élève, administrateur, super-admin), de réinitialiser une progression, de supprimer un compte, d'en créer, de consulter **tous les espaces** (enseignant titulaire, classes, élèves, activité) puis **l'activité de tous les utilisateurs** (toutes les tentatives d'exercices, tous espaces et tous comptes confondus) et d'exporter la liste en CSV. Seul un super-administrateur peut attribuer ce rôle ; un compte d'amorçage est créé automatiquement s'il n'en existe aucun.

Les identifiants du super-administrateur se remplacent directement dans `#/superadmin`, rubrique **« Mes identifiants super-admin »** : nom d'utilisateur, e-mail et mot de passe (l'historique de progression suit le renommage). Pour une installation neuve, les valeurs d'amorçage sont définies dans la constante `SUPER_ADMIN_AMORCAGE` de [auth.js](assets/js/auth.js).

## Espaces enseignants, classes et séances

1. **Créer son espace.** S'inscrire en cochant « Je suis enseignant », ou être promu administrateur. Chaque administrateur reçoit un identifiant d'espace (`esp-…`) et peut le renommer dans `#/admin/parametres`.
2. **Créer une classe.** `#/admin/classes` → « Nouvelle classe ». Le code généré (ex. `AB12CD`) est à communiquer aux élèves.
3. **Rejoindre une classe.** L'élève se connecte, va dans `#/profil` et saisit le code. Il voit alors les séances, leçons et exercices de cet espace.
4. **Rédiger ses contenus.** `#/admin/lecons` → « Nouvelle leçon » (titre, matière, niveau, durée, résumé, objectifs, contenu mis en forme : gras, titres, listes, citations, liens) ; `#/admin/exercices` → « Nouvel exercice » (quiz, associations, textes à trous).
5. **Planifier une séance.** `#/admin/seances` → « Nouvelle séance » : titre, date, durée, classes ciblées, chapitres du site, ses propres leçons, exercices assignés, publication.
6. **Suivre les résultats.** Le bouton « Suivi » d'une séance affiche, pour chaque élève, le nombre d'exercices réalisés, la moyenne, la dernière activité et le meilleur score par exercice.

Les contenus publics livrés avec le site restent visibles pour les visiteurs et les élèves sans classe. Un espace enseignant est vide au départ : le bouton « Bibliothèque démo » (onglet Exercices) ou « Importer la bibliothèque de démonstration » (onglet Paramètres) y copie les 17 exercices.

## Routes principales

| Route | Vue |
|---|---|
| `#/` | Accueil |
| `#/matieres` · `#/matiere/maths` | Liste des matières et détail d'une matière |
| `#/niveaux` · `#/niveau/lycee` | Liste des niveaux et détail d'un niveau |
| `#/chapitre/maths-pythagore` | Fiche d'un chapitre |
| `#/cours/une-si-longue-lettre` | Fiche rédigée d'une œuvre du programme (section optionnelle : `…/exposes`) |
| `#/exercices` · `#/exercices?exo=<id>` | Exercices interactifs (tous, ou un exercice assigné) |
| `#/lecons` · `#/lecon/<id>` | Leçons de l'espace de l'élève et contenu d'une leçon |
| `#/seances` | Séances de la classe de l'élève |
| `#/recherche?q=polygamie` | Recherche |
| `#/connexion` · `#/profil` | Authentification, classe et progression |
| `#/ia` | IAFA FAMA : étude d'œuvre ou recherche/question |
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
├── supabase/                   # Schéma SQL et guide du backend Supabase
└── eleve/                      # Anciennes pages, redirigées vers les nouvelles routes
```

## Backend Supabase (multi-appareils)

GitHub Pages ne peut pas exécuter de code serveur, mais le site appelle une **API distante**. Supabase fournit l'authentification, la base PostgreSQL et l'API ; le site reste hébergé sur GitHub Pages.

- Configuration : [assets/js/supabase-config.js](assets/js/supabase-config.js) (`backend`, `supabaseUrl`, `supabaseKey`). La clé `publishable`/`anon` est publique ; **ne jamais** mettre la clé `secret`/`service_role` dans le site.
- Schéma, politiques RLS et guide : [supabase/README.md](supabase/README.md) et [supabase/schema.sql](supabase/schema.sql).
- Visiteur non connecté : catalogue public local (comme avant) et bibliothèque publique.
- Bibliothèque : page `#/bibliotheque` (recherche + filtres matière/niveau/format) ; gestion dans `#/admin/bibliotheque`, avec ajout unitaire ou **import par lot** (plusieurs fichiers, envoi séquentiel avec progression). Chaque document a une visibilité : **élèves connectés** (par défaut), tout public, ou enseignants seulement. Fichiers hébergés dans Supabase Storage (bucket `documents`) ou Cloudflare R2 pour les gros volumes.
- Utilisateur connecté : espace, classes, leçons, exercices, séances et résultats chargés depuis Supabase et synchronisés à l'enregistrement.
- Élève : rejoint une classe avec son code ; l'enseignant voit les résultats sur un autre appareil.
- Comptes : inscription/connexion par e-mail ; mot de passe géré par Supabase. Le super-administrateur gère les comptes (création, rôle, suppression) depuis `#/superadmin`.
- Après une mise à jour du schéma, ré-exécuter `supabase/schema.sql` (script idempotent). Pour un projet créé avant certaines corrections, exécuter une fois [supabase/migration-seances-text-ids.sql](supabase/migration-seances-text-ids.sql), [supabase/migration-profil-trigger.sql](supabase/migration-profil-trigger.sql) et [supabase/migration-comptes-admin.sql](supabase/migration-comptes-admin.sql).
- Inscription : Supabase envoie un e-mail de confirmation tant que **Authentication → Providers → Email → Confirm email** reste activé. Le service d'e-mail intégré est limité à quelques messages par heure (« email rate limit exceeded »). Pour un usage réel, désactiver la confirmation ou brancher un SMTP personnalisé (Resend, Brevo…).

Les données locales existantes ne peuvent pas être transférées automatiquement : les mots de passe locaux sont hachés dans le navigateur. Chaque personne recrée son compte Supabase ; les contenus et résultats pourront être importés par un écran dédié (à venir).

## IAFA FAMA (assistant IA : études d'œuvres et recherche)

La page `#/ia` (menu du compte, pied de page, espace élève) propose deux modes :

- **Étude d'œuvre** : l'élève choisit une œuvre du programme ou saisit un titre et un auteur. L'IA renvoie une fiche structurée : fiche d'identité, contexte, résumé, parties, personnages, thèmes, procédés d'écriture, citations, questions et sujets d'exposé.
- **Recherche / question** : l'élève pose une question libre et reçoit une réponse courte, une explication, un exemple, l'essentiel à retenir et des questions de vérification.

Chaque fiche est enregistrée dans la table `ia_contenus` et reste privée : les politiques RLS limitent la lecture et la suppression à son auteur (et au super-administrateur). Les réponses sont affichées en texte brut dans les gabarits du site — **aucun HTML généré par l'IA n'est injecté** dans la page.

### Activation

#### 1. Obtenir une clé Gemini (gratuite)

1. Ouvrir <https://aistudio.google.com/apikey> et se connecter avec un compte Google.
2. Cliquer sur **Create API key** (ou **Créer une clé API**), choisir ou créer un projet Google Cloud.
3. Copier la clé affichée (elle commence par `AIza…`). Aucune carte bancaire n'est demandée pour le palier gratuit.

Autres fournisseurs gratuits, si besoin :

| Fournisseur | Où récupérer la clé | Variable du secret |
|---|---|---|
| Gemini | <https://aistudio.google.com/apikey> | `GEMINI_API_KEY` |
| Groq | <https://console.groq.com/keys> | `GROQ_API_KEY` |
| OpenRouter | <https://openrouter.ai/keys> | `OPENROUTER_API_KEY` |
| DeepSeek | <https://platform.deepseek.com/api_keys> | `DEEPSEEK_API_KEY` |
| GitHub Models | jeton GitHub avec le droit `models:read` | `GITHUB_TOKEN` |

#### 2. Configurer Supabase

1. Exécuter [supabase/migration-ia.sql](supabase/migration-ia.sql) **puis** [supabase/migration-ia-quota.sql](supabase/migration-ia-quota.sql) dans le **SQL Editor**.
2. Ajouter les secrets : **Project Settings → Edge Functions → Secrets** (ou **Edge Functions → Manage secrets**), puis créer :
   - `AI_PROVIDER` = `gemini`
   - `GEMINI_API_KEY` = la clé `AIza…`
3. Déployer la fonction : **Edge Functions → Deploy a new function → Via Editor**, nom `ia`, coller le contenu de [supabase/functions/ia/index.ts](supabase/functions/ia/index.ts), puis **Deploy**.

Avec la CLI Supabase, les étapes 2 et 3 se résument à :

```bash
supabase link --project-ref votre_reference_projet
supabase secrets set AI_PROVIDER=gemini GEMINI_API_KEY=votre_cle
supabase functions deploy ia
```

La clé ne doit **jamais** être placée dans `assets/js/ia.js`, `supabase-config.js` ou un autre fichier du site : elle resterait visible par tous les visiteurs.

#### 3. Vérifier

Contrôler d'abord quelle version du code est en ligne (réponse `ok: true` avec `"version"`), puis générer une étude depuis le site :

```powershell
curl.exe -s "https://achwmlisnsbyxcvwteam.supabase.co/functions/v1/ia"
```

Un `405 Méthode non autorisée` indique que le code déployé est plus ancien que le fichier [index.ts](supabase/functions/ia/index.ts) : redéployer.

Après reconnexion sur le site, ouvrir `#/ia` et lancer une étude. Si la fiche réelle apparaît, tout est branché. En cas de souci :

| Message affiché | Cause probable |
|---|---|
| « Mode démonstration » | Secret absent ou fonction non déployée |
| « La clé IA est refusée par le fournisseur » | Clé révoquée, copiée partiellement, ou bloquée pour le service (`API_KEY_SERVICE_BLOCKED`) : activer la **Generative Language API** et autoriser la clé dans Google Cloud, ou recréer une clé sur <https://aistudio.google.com/apikey> |
| « Modèle introuvable chez le fournisseur » | Modèle retiré (ex. `gemini-2.5-flash` n'est plus ouvert aux nouveaux comptes) ou `AI_MODEL` erroné ; la fonction bascule automatiquement sur `gemini-3.5-flash` |
| « Service IA indisponible » | Nom de fonction erroné, fonction en erreur, quota du fournisseur atteint |
| « Limite de N générations par jour atteinte » | Quota `IA_LIMITE_JOUR` / `IA_LIMITE_QUESTIONS`, ou plafond `IA_LIMITE_GLOBALE` |
| « Session expirée » | Se reconnecter |

Journaux utiles : **Edge Functions → ia → Logs**, ou `supabase functions logs ia`.

Fournisseurs pris en charge (`AI_PROVIDER`) : `gemini` (palier gratuit, par défaut), `groq`, `openrouter`, `deepseek`, `github`. Changer de fournisseur ne demande que de modifier ces variables, sans toucher au site.

Variables optionnelles :

| Variable | Rôle |
|---|---|
| `AI_MODEL` | Modèle à utiliser (ex. `gemini-3.5-flash`). En cas de modèle introuvable ou retiré, la fonction essaie automatiquement des modèles de repli |
| `AI_BASE_URL` | Autre point d'entrée compatible OpenAI |
| `AI_API_KEY` | Clé générique, prioritaire sur la variable du fournisseur |
| `IA_LIMITE_JOUR` | Fiches d'étude par jour et par compte (30 par défaut) |
| `IA_LIMITE_QUESTIONS` | Recherches/questions par jour et par compte (60 par défaut) |
| `IA_LIMITE_GLOBALE` | Plafond quotidien tous comptes confondus (300 par défaut) |

**Quota tenu par la base.** Le compteur vit dans la table `ia_quotas` et n'est mis à jour que par les fonctions `ia_consommer()` / `ia_liberer()`. Un appel direct à la fonction, sans passer par le site, ne remet donc pas le compteur à zéro — contrairement à un décompte basé sur les lignes enregistrées. La réservation est rendue automatiquement si le fournisseur échoue. Les deux modes sont comptés séparément, et `IA_LIMITE_GLOBALE` borne l'usage total du projet (comptes multiples, abus).

Sans clé configurée, la page reste utilisable en **mode démonstration** : la présentation type d'une fiche est affichée et clairement signalée comme exemple.

> L'IA ne navigue pas sur le Web : elle répond à partir de ses connaissances et peut se tromper. La page affiche en permanence la mention « contenu généré par IA — à vérifier ». Aucune donnée personnelle (nom, e-mail, classe) n'est envoyée au fournisseur : seuls le titre de l'œuvre ou la question et le niveau sont transmis.

## Carrousel de la page d'accueil

Les diapositives défilent automatiquement (6 s), avec indicateurs, flèches, pause au survol et respect de `prefers-reduced-motion`.

Elles sont définies dans [data.js](assets/js/data.js), tableau `diapositives` :

| Champ | Rôle |
|---|---|
| `titre`, `texte` | Contenu affiché |
| `icone` | Petite icône dans la pastille |
| `embleme` | Grande icône décorative en filigrane |
| `variante` | Dégradé : `violet`, `orange`, `vert`, `bleu`, `bordeaux` |
| `image` | Photo de fond (`assets/images/carrousel/…`). Un voile sombre garantit la lisibilité du texte |
| `credit` | Mention affichée en bas de la diapositive (obligatoire pour les licences CC BY / CC BY-SA) |
| `cta` | Bouton : `{ libelle, href }` |

### Photos du carrousel

Les 5 photos sont stockées dans `assets/images/carrousel/` (Wikimedia Commons, licences libres) et leurs crédits dans `assets/images/carrousel/credits.json`.

Pour en changer :

```powershell
cd scripts
node images-carrousel.js                                   # 5 photos automatiques
node images-carrousel.js --source pixabay                  # via Pixabay (clé requise)
node images-carrousel.js --fichier "Nom du fichier.jpg" --nom slide-3
```

Le script affiche l'auteur et la licence : reportez-les dans le champ `credit` de la diapositive concernée.

Pour ajouter une diapositive, ajoutez simplement un objet au tableau. Pour utiliser une vraie photo, déposez-la dans `assets/images/` et renseignez `image: 'assets/images/mon-image.jpg'`.

## Import massif de livres

Pour importer un dossier entier (plusieurs centaines de fichiers, plusieurs Go), utilisez le script fourni : [scripts/importer-bibliotheque.js](scripts/importer-bibliotheque.js). Il envoie les fichiers vers **Cloudflare R2** (10 Go gratuits, trafic sortant gratuit) et enregistre les métadonnées dans Supabase.

Supabase garde les métadonnées ; R2 héberge les fichiers. Voir [scripts/README.md](scripts/README.md) pour la mise en place et les options (`--dry-run`, `--limit`, `--reset`).

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

## Publier et partager le site

Le site est **déjà public** : <https://samba96j.github.io/site-apprentissage/>. Toute personne qui possède le lien peut l'ouvrir, sans compte. GitHub Pages redéploie automatiquement à chaque `git push` sur `main` (une minute environ).

### Aperçu des liens (WhatsApp, Facebook, LinkedIn, X, Telegram…)

Le `<head>` de [index.html](index.html) contient les balises **Open Graph** et **Twitter Card** : un lien collé dans WhatsApp, Messenger, Facebook, LinkedIn, Telegram, Discord ou Slack s'affiche avec un titre, un résumé et l'image `assets/images/og-image.jpg` (1200 × 630 px, 100 Ko — le format attendu par les réseaux).

| Élément | Où le modifier |
|---|---|
| Titre / description de l'aperçu | `og:title`, `og:description` dans [index.html](index.html) |
| Image de l'aperçu | `assets/images/og-image.jpg` (+ `og:image:width` / `og:image:height`) |
| Favicon et icône mobile | `assets/images/favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`, `icon-512.png`, `manifest.webmanifest` |
| Référencement | `robots.txt`, `sitemap.xml`, données structurées JSON-LD dans [index.html](index.html) |

> Les réseaux **gardent l'aperçu en cache**. Après avoir changé un titre ou l'image, forcez la relecture :
> - Facebook / Messenger : <https://developers.facebook.com/tools/debug/> → « Scrape again »
> - LinkedIn : <https://www.linkedin.com/post-inspector/>
> - X : <https://cards-dev.twitter.com/validator>
> - WhatsApp : l'aperçu se rafraîchit en renvoyant le lien (ou en ajoutant `?v=2` à la fin).

### Boutons de partage intégrés

Le pied de page affiche une barre « Partager LearnHub » : WhatsApp, Facebook, LinkedIn, X, Telegram, e-mail, copie du lien, et le partage natif du téléphone quand il existe. Le lien partagé suit la page en cours : depuis `#/matiere/maths`, c'est ce chapitre qui est partagé.

### Bonnes pratiques par réseau

- **WhatsApp (groupe ou statut)** : collez simplement `https://samba96j.github.io/site-apprentissage/`, l'aperçu se génère tout seul.
- **Facebook** : lien cliquable dans la publication, l'aperçu vient des balises Open Graph.
- **Instagram** : les liens ne sont **pas cliquables** dans les posts. Placez le lien dans la **bio** (ou « lien en story ») et renvoyez-y depuis vos publications.
- **LinkedIn** : lien cliquable dans le post ou la section « Site web » du profil.
- **TikTok / YouTube / Snapchat** : lien en bio ou dans la description.

### Recherche Google

`robots.txt` et `sitemap.xml` sont fournis. Pour accélérer l'indexation : [Google Search Console](https://search.google.com/search-console) → ajouter la propriété `https://samba96j.github.io/site-apprentissage/` → « Indexation » → « Sitemaps » → envoyer `sitemap.xml`.

### Domaine personnalisé (optionnel)

Un domaine du type `learnhub.sn` donne un lien plus court et plus crédible :

1. Acheter le domaine, puis créer un enregistrement `CNAME` vers `samba96j.github.io`.
2. Dans le dépôt GitHub : *Settings → Pages → Custom domain*, puis cocher **Enforce HTTPS**.
3. Créer un fichier `CNAME` à la racine contenant le domaine, et remplacer les URL absolues (`canonical`, `og:url`, `og:image`, `sitemap.xml`, `robots.txt`) par le nouveau domaine.

## Ajouter du contenu

- **Un chapitre** : ajouter une entrée dans `matieres[].chapitres` de [data.js](assets/js/data.js) (`id`, `niveau`, `titre`, `resume`, `objectifs`, `points`, `duree`).
- **Une matière ou un niveau** : compléter les tableaux `matieres` ou `niveaux` du même fichier. Pour une nouvelle `couleur`, ajouter la classe `bg-…` correspondante dans [styles.css](styles.css), sinon l'icône s'affiche sans fond coloré.
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
- Les fiches de l'assistant IA sont générées par un modèle de langage : elles peuvent contenir des erreurs et doivent être vérifiées. Les paliers gratuits des fournisseurs imposent des quotas ; la page affiche un message clair lorsque le service est indisponible.

## Contribution

Les contributions sont bienvenues. Merci d'ouvrir une *issue* pour signaler un problème ou proposer une amélioration, puis une *pull request* avec vos modifications.
