# Sécurité de LearnHub

## Secrets

Aucune clé secrète ne doit figurer dans ce dépôt. Le site est public : tout fichier poussé est lisible par n'importe qui.

| Secret | Où il vit | Ne doit jamais être dans |
|---|---|---|
| Clé Gemini / Groq / OpenRouter (`AI_API_KEY`) | Secrets Supabase → Edge Functions | `assets/js/`, README, capture d'écran |
| `service_role` Supabase | Dashboard Supabase uniquement | le site, un fichier `.env` versionné |
| Clés Cloudflare R2 (`R2_SECRET_ACCESS_KEY`) | `scripts/.env`, ignoré par Git | le dépôt |
| Mot de passe administrateur | `scripts/.env`, ignoré par Git | le dépôt |

La clé `publishable` / `anon` de Supabase est publique **par conception** : ce sont les politiques RLS (`supabase/schema.sql`) qui protègent les données.

## Protections actives sur GitHub

- **Secret scanning** : détection des clés poussées dans l'historique.
- **Push protection** : un push contenant un secret reconnu est bloqué avant d'entrer dans le dépôt.
- **Dependabot** : alertes de vulnérabilités et mises à jour de sécurité.
- **Protection de `main`** : suppression de la branche et `force-push` interdits.

## En cas de clé exposée

1. Révoquer la clé chez le fournisseur (par exemple <https://aistudio.google.com/apikey>).
2. En créer une nouvelle.
3. Mettre à jour le secret dans Supabase (**Project Settings → Edge Functions → Secrets**).
4. Redéployer la fonction : `supabase functions deploy ia`, ou **Deploy** depuis l'éditeur du dashboard.
5. Vérifier : `curl -s "https://<projet>.supabase.co/functions/v1/ia"` doit renvoyer `ok: true` et le bon modèle.

## Signaler une vulnérabilité

Écrire à l'adresse de contact du site (`#/contact`) plutôt que d'ouvrir une issue publique.
