# Import massif de la bibliothèque

Ce script envoie un dossier de livres vers **Cloudflare R2** (stockage objet, 10 Go gratuits) et enregistre leurs métadonnées dans la table Supabase `documents`, qui alimente la page `#/bibliotheque`.

## Pourquoi R2 plutôt que Supabase Storage

| | Supabase Storage (gratuit) | Cloudflare R2 (gratuit) |
|---|---|---|
| Stockage | 1 Go | **10 Go** |
| Taille max par fichier | 50 Mo | 5 To |
| Trafic sortant | 2 Go/mois | **gratuit et illimité** |

Supabase conserve les métadonnées (titre, auteur, matière, niveau) ; R2 héberge les fichiers. Le site ne fait pas la différence : il ouvre simplement l'URL enregistrée.

## 1. Créer le bucket R2

1. <https://dash.cloudflare.com> → **R2** → activez R2 (une carte bancaire est demandée, rien n'est facturé sous 10 Go).
2. **Create bucket** → nom `learnhub-bibliotheque`.
3. Onglet **Settings** du bucket → **Public access** :
   - le plus simple : activez le sous-domaine **r2.dev** et copiez l'URL (`https://pub-xxxx.r2.dev`) ;
   - en production, préférez un **domaine personnalisé** (le sous-domaine r2.dev est limité en débit).
4. **Manage R2 API Tokens** → **Create API token** → permission **Object Read & Write** sur ce bucket → notez `Access Key ID` et `Secret Access Key`.
5. Notez votre **Account ID** (affiché en haut à droite de R2).

## 2. Configurer

```powershell
cd scripts
npm install
Copy-Item .env.example .env
notepad .env
```

Renseignez `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE` et `ADMIN_EMAIL` / `ADMIN_PASSWORD` (compte enseignant ou super-administrateur LearnHub).

> `.env` est ignoré par git : vos clés ne seront jamais publiées.

## 3. Tester puis lancer

```powershell
node importer-bibliotheque.js --dry-run     # simulation, rien n'est envoyé
node importer-bibliotheque.js --limit 5     # 5 premiers fichiers, pour vérifier
node importer-bibliotheque.js               # import complet
```

## Ce que fait le script

- lit la table `livres` de `database.db` pour reprendre **titres, auteurs, matières et niveaux** du catalogue existant (au lieu de déduire les titres des noms de fichiers) ;
- traduit les matières vers les filtres du site (`Mathématiques` → `maths`, `Littérature` → `francais`, `Physique`/`Chimie` → `sciences`) et conserve les autres telles quelles (`philosophie`, `histoire`) ;
- envoie chaque fichier sous une clé stable (`livres/mon-livre-a1b2c3d4.pdf`) ;
- enregistre une ligne `documents` avec un identifiant déterministe : relancer le script **met à jour** au lieu de dupliquer ;
- note sa progression dans `.import-state.json` : après une coupure, il **reprend** là où il s'était arrêté ;
- réessaie 3 fois chaque fichier en cas d'erreur réseau, puis continue et affiche le bilan.

## Options

| Option | Effet |
|---|---|
| `--source <dossier>` | Projet contenant `database.db` et le dossier des livres |
| `--limit <n>` | N'importer que les n premiers fichiers |
| `--dry-run` | Simuler sans rien envoyer |
| `--reset` | Ignorer l'état de reprise et tout réimporter |

## Droits d'auteur

Le catalogue fourni contient des ouvrages commerciaux. Ne publiez publiquement que les documents dont vous détenez les droits (œuvres du domaine public, cours que vous avez rédigés, sujets d'examens officiels) ou pour lesquels vous disposez d'une autorisation. L'hébergeur n'y change rien : la responsabilité de la diffusion vous revient.
