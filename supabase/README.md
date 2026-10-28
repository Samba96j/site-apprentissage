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

## 8. Étapes suivantes (intégration frontend)

1. Ajouter `assets/js/supabase-config.js` (URL + clé anon) et le SDK `@supabase/supabase-js` via CDN.
2. Brancher l'authentification : `signUp` / `signInWithPassword` / `signOut`, profil chargé depuis `profiles`.
3. Remplacer la lecture/écriture `localStorage` de `store.js` par des appels Supabase, avec cache en mémoire pour garder les vues synchrones.
4. Conserver le mode local comme repli si la configuration est absente.
5. Tester les scénarios : enseignant crée une classe sur un appareil → élève la rejoint depuis un autre.

### Opérations réservées au serveur

Deux actions du super-administrateur nécessitent la clé `service_role`, qui ne doit jamais être dans le navigateur :

- **Créer un compte** sans changer la session en cours ;
- **Supprimer un compte** d'authentification.

Elles seront exposées par une **Edge Function Supabase** (`supabase/functions/admin-comptes`) qui vérifie le rôle super-admin avant d'agir. En attendant, la création de compte passe par l'inscription normale et la suppression se fait dans le dashboard Supabase.
