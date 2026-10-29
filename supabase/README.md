# LearnHub — backend Supabase

Le site reste hébergé sur **GitHub Pages**. Supabase fournit uniquement l'authentification, la base de données et l'API HTTPS ; aucun serveur n'est à maintenir.

## 1. Créer le projet

1. Ouvrir <https://supabase.com> et créer un compte gratuit.
2. **New project** : nom `learnhub`, mot de passe de base de données, région proche.
3. Attendre la fin du provisionnement (1 à 2 minutes).

## 2. Créer le schéma

1. Dans le projet : **SQL Editor** → **New query**.
2. Coller l'intégralité de [schema.sql](schema.sql).
3. **Run**. Le script crée les tables, les index, les fonctions, les déclencheurs et les politiques RLS (Row Level Security).

Si le projet a été créé avec une première version du schéma, exécuter une fois les scripts de migration (idempotents) :

- [migration-seances-text-ids.sql](migration-seances-text-ids.sql) — colonnes de `seances` en `text[]` ;
- [migration-profil-trigger.sql](migration-profil-trigger.sql) — déclencheur des profils : attribution du rôle `superadmin` depuis le SQL Editor, suppression d'une classe peuplée, et blocage de l'affectation directe à une classe ;
- [migration-comptes-admin.sql](migration-comptes-admin.sql) — fonctions `admin_supprimer_compte` et `admin_changer_role` qui permettent la gestion des comptes depuis la page Super-administration ;
- [migration-bibliotheque.sql](migration-bibliotheque.sql) — table `documents` et bucket de stockage `documents` de la bibliothèque publique ;
- [migration-bibliotheque-visibilite.sql](migration-bibliotheque-visibilite.sql) — colonne `visibilite` (public / élèves / enseignants) et politique RLS correspondante ;
- [migration-ia.sql](migration-ia.sql) — table `ia_contenus` de l'assistant IA (études d'œuvres et questions), privée par élève.

## 3. Authentification

- **Authentication → Providers → Email** : activer.
- Pour des tests rapides, désactiver **Confirm email** ; en production, le laisser activé.
- Les inscriptions transmettent `username` et `role` (`eleve` ou `admin`) dans les métadonnées ; le déclencheur crée automatiquement le profil et, pour un enseignant, son espace.
- Le rôle `superadmin` n'est **jamais** attribuable depuis le formulaire. Après avoir créé votre compte, exécuter dans le SQL Editor :

```sql
update public.profiles
set role = 'superadmin'
where username = 'votre_pseudo';
```

## 4. Récupérer les clés

**Project Settings → API** :

- `Project URL` — ex. `https://xxxxxxxx.supabase.co`
- `anon public` — clé publique, sans danger dans le frontend : ce sont les politiques RLS qui protègent les données.

**Ne jamais** exposer la clé `service_role` dans le site.

Ces deux valeurs seront placées dans un fichier `assets/js/supabase-config.js` (étape suivante de l'intégration).

## 5. Modèle de données

| Table | Rôle |
|---|---|
| `espaces` | Espace de travail d'un enseignant (propriétaire) |
| `profiles` | Compte : rôle `eleve`, `admin` ou `superadmin`, espace, classe |
| `classes` | Classe d'un espace, rejointe avec un code |
| `lessons` | Leçons (texte + HTML nettoyé) |
| `exercises` | Quiz, associations, textes à trous (JSONB) |
| `resources` | Liens et documents |
| `seances` | Séances : date, durée, classes, chapitres, leçons, exercices |
| `attempts` | Résultats des élèves |
| `messages` | Formulaire de contact (insertion publique, lecture super-admin) |
| `documents` | Bibliothèque publique : livres et documents (lecture publique, écriture admin) |
| `ia_contenus` | Fiches générées par l'assistant IA, privées par élève (RLS `user_id = auth.uid()`) |

### Bibliothèque et stockage

Les fichiers sont hébergés dans le bucket Supabase Storage **`documents`** (public, 5 Go gratuits) — ou dans **Cloudflare R2** pour les imports volumineux (voir `scripts/`). Les métadonnées (titre, matière, niveau, format, auteur, taille, visibilité) sont dans la table `documents`.

**Visibilité** (colonne `visibilite`) :

| Valeur | Qui voit le document |
|---|---|
| `public` | Tout le monde, même sans compte |
| `eleves` | Comptes connectés (élèves, enseignants, super-admin) — **valeur par défaut** |
| `enseignants` | Rôles `admin` et `superadmin` uniquement |

La restriction est appliquée par la politique RLS `documents_select`, pas seulement par l'interface : un visiteur non connecté ne peut pas lire les lignes `eleves`, même en appelant l'API directement.

- Écriture : rôles `admin` et `superadmin` uniquement (page `#/admin/bibliotheque`).
- Formats acceptés : PDF, DOC/DOCX, TXT, ODT, EPUB, ou un lien externe.
- **Import par lot** : sélectionnez plusieurs fichiers d'un coup ; ils sont envoyés un par un avec une barre de progression, le titre étant repris du nom du fichier (`03_les-fractions.pdf` → « Les fractions »). La matière, le niveau, l'auteur et la visibilité choisis s'appliquent à tout le lot.
- La suppression retire la ligne **et** le fichier du bucket.
- La visibilité de chaque document se change directement dans la liste admin.

## 6. Sécurité (RLS)

- Un élève ne lit que son profil, ses résultats et les contenus de l'espace de sa classe.
- Un enseignant lit et écrit uniquement dans son espace, et voit les profils de ses élèves.
- Le super-admin voit tout.
- Un utilisateur ne peut pas modifier son propre rôle ni son espace (déclencheur `proteger_profil`).
- L'inscription ne peut jamais créer un `superadmin`.

## 7. Migration des données locales

Les comptes actuels sont stockés dans le navigateur avec un mot de passe **haché localement** : il est impossible de les transférer vers Supabase Auth. La migration se fait donc ainsi :

1. Chaque personne crée son compte Supabase avec le même nom d'utilisateur.
2. Les contenus (leçons, exercices, séances) et les résultats peuvent être importés depuis le navigateur vers Supabase par un script ponctuel (à exécuter avec la session de l'utilisateur).

Un écran d'import pourra être ajouté dans `#/admin/parametres` lors de l'intégration.

## 8. Intégration frontend (réalisée)

| Fichier | Rôle |
|---|---|
| `assets/js/supabase-config.js` | URL du projet, clé publique et interrupteur `backend` |
| `assets/js/backend.js` | Adaptateur Supabase : session, cache mémoire, écritures, RPC, messages |
| `assets/js/store.js` | Lit/écrit le cache distant quand une session est active, sinon `localStorage` |
| `assets/js/auth.js` | Délègue l'authentification et la progression à `backend.js` |

Fonctionnement :

- **Visiteur non connecté** : le catalogue public (chapitres, exercices de démonstration) est servi localement ; le formulaire de contact écrit dans `messages`.
- **Utilisateur connecté** : les données de son espace sont chargées dans un cache mémoire, ce qui laisse toutes les vues synchrones ; chaque écriture met le cache à jour puis synchronise la table Supabase correspondante.
- **Déconnexion** : le cache est vidé, l'application revient au mode local.
- Sans `supabase-config.js` valide (`backend: false`, URL ou clé vide), l'application fonctionne intégralement en `localStorage` comme avant.

### Compte super-administrateur

Le rôle `superadmin` s'attribue uniquement en SQL :

```sql
update public.profiles
set role = 'superadmin'
where username = 'votre_pseudo';
```

En mode backend, les actions qui exigent la clé `service_role` (créer un compte sans changer de session, supprimer un compte d'authentification) sont désactivées dans l'interface : elles se font depuis le dashboard Supabase. La création de compte passe par l'inscription normale, la suppression par **Authentication → Users**.

### Gestion des comptes (page Super-administration)

Le super-administrateur dispose d'un CRUD complet depuis `#/superadmin` :

| Action | Mécanisme |
|---|---|
| **Créer** | `auth.signUp` sur un client Supabase secondaire (sans persistance) : la session du super-admin n'est pas remplacée ; le déclencheur `creer_profil` crée le profil et, pour un enseignant, son espace. |
| **Changer le rôle** | RPC `admin_changer_role` (crée un espace si le compte devient enseignant). |
| **Renommer** | `update profiles set username` (autorisé par la RLS pour un super-admin). |
| **Supprimer** | RPC `admin_supprimer_compte` (`delete from auth.users`, cascade sur le profil, l'espace et les contenus). |
| **Réinitialiser la progression** | `delete from attempts` (politique RLS dédiée). |

Les deux RPC sont `security definer` et vérifient `public.mon_role() = 'superadmin'` : un enseignant ou un élève ne peut pas les appeler. Aucune clé `service_role` n'est nécessaire.

## 9. Assistant IA (Edge Function `ia`)

La page `#/ia` n'appelle jamais le fournisseur depuis le navigateur : la clé reste dans les secrets Supabase.

1. Exécuter [migration-ia.sql](migration-ia.sql) dans le SQL Editor.
2. Enregistrer la clé et déployer la fonction :

```bash
supabase secrets set AI_PROVIDER=gemini GEMINI_API_KEY=votre_cle IA_LIMITE_JOUR=30
supabase functions deploy ia
```

Fournisseurs compatibles OpenAI pris en charge : `gemini` (palier gratuit, par défaut), `groq`, `openrouter`, `deepseek`, `github`.

| Variable | Rôle |
|---|---|
| `AI_PROVIDER` | Fournisseur choisi |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `GITHUB_TOKEN` | Clé du fournisseur correspondant |
| `AI_API_KEY` | Clé générique, prioritaire sur la précédente |
| `AI_MODEL` | Modèle à utiliser (ex. `gemini-3.5-flash`), avec repli automatique si le modèle est introuvable ou retiré |
| `AI_BASE_URL` | Point d'entrée alternatif compatible OpenAI |
| `IA_LIMITE_JOUR` | Études générées par jour et par compte (30 par défaut) |

La fonction vérifie le JWT Supabase, applique le quota quotidien, exige une sortie JSON et normalise le contenu (balises HTML supprimées, longueurs bornées). Sans clé, elle répond `non_configure` : le site bascule alors en mode démonstration. Les fiches validées sont enregistrées par le site dans `ia_contenus`, avec une RLS limitée à leur auteur.

**Vérifier ce qui est réellement déployé** — un appel `GET` renvoie la version du code en ligne, sans exposer la clé :

```powershell
curl.exe -s "https://<projet>.supabase.co/functions/v1/ia"
```

Réponse attendue : `{"ok":true,"service":"learnhub-ia","version":"2026-10-29","configure":true,"fournisseur":"gemini","modele":"gemini-3.5-flash"}`
Un `405 Méthode non autorisée` signifie que le code en ligne est une version antérieure : il faut redéployer.

> Le fichier [functions/ia/deno.d.ts](functions/ia/deno.d.ts) ne sert qu'à l'éditeur : il déclare les globales `Deno` et les imports par URL, que l'extension TypeScript de VS Code ne connaît pas. Il n'est pas utilisé au déploiement. Si vous installez l'extension VS Code « Deno », il devient inutile.
