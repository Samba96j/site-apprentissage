/**
 * LearnHub — Edge Function « ia ».
 *
 * Reçoit une demande d'étude d'œuvre ou de question, interroge un fournisseur
 * compatible OpenAI (Gemini par défaut) et renvoie un contenu JSON structuré.
 * La clé du fournisseur reste dans les secrets Supabase, jamais dans le site.
 *
 * Déploiement :
 *   supabase secrets set AI_PROVIDER=gemini GEMINI_API_KEY=…
 *   supabase functions deploy ia
 *
 * Variables optionnelles : AI_MODEL, AI_BASE_URL, AI_API_KEY, IA_LIMITE_JOUR.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Mode = 'etude' | 'question';

interface Demande {
  mode: Mode;
  oeuvre?: string;
  auteur?: string;
  niveau?: string;
  question?: string;
}

interface Fournisseur {
  url: string;
  modele: string;
  cle: string;
  nom: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

/** Sert à vérifier depuis l'extérieur quelle version du code est déployée. */
const VERSION = '2026-10-29';

const FOURNISSEURS: Record<string, { url: string; modele: string; variable: string }> = {
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modele: 'gemini-3.5-flash',
    variable: 'GEMINI_API_KEY'
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modele: 'openai/gpt-oss-120b',
    variable: 'GROQ_API_KEY'
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    modele: 'meta-llama/llama-3.3-70b-instruct:free',
    variable: 'OPENROUTER_API_KEY'
  },
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    modele: 'deepseek-chat',
    variable: 'DEEPSEEK_API_KEY'
  },
  github: {
    url: 'https://models.github.ai/inference/chat/completions',
    modele: 'openai/gpt-4.1-mini',
    variable: 'GITHUB_TOKEN'
  }
};

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

class ErreurFournisseur extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ErreurFournisseur';
    this.code = code;
  }
}

function erreurHttp(statut: number): ErreurFournisseur {
  if (statut === 401 || statut === 403) {
    return new ErreurFournisseur('cle_refusee',
      'La clé IA est refusée par le fournisseur. Vérifiez GEMINI_API_KEY dans les secrets Supabase.');
  }
  if (statut === 404) {
    return new ErreurFournisseur('modele_introuvable',
      'Modèle introuvable chez le fournisseur. Vérifiez la variable AI_MODEL.');
  }
  if (statut === 429) {
    return new ErreurFournisseur('quota_fournisseur',
      'Quota du fournisseur atteint. Réessayez dans quelques minutes.');
  }
  if (statut === 400) {
    return new ErreurFournisseur('requete_refusee',
      'Le fournisseur a refusé la requête. Vérifiez le modèle (AI_MODEL) et la clé.');
  }
  return new ErreurFournisseur('indisponible',
    'La génération a échoué. Réessayez dans un instant.');
}

/**
 * Clé publique du projet, nécessaire au client Supabase de la fonction.
 * Les projets récents exposent SUPABASE_PUBLISHABLE_KEYS (dictionnaire JSON) ;
 * SUPABASE_ANON_KEY reste utilisé en secours pour les projets plus anciens.
 */
function clePubliqueSupabase(): string {
  const directe = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (directe) return directe;
  try {
    const dictionnaire = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    const valeurs = Object.values(dictionnaire).filter((valeur) => typeof valeur === 'string' && valeur);
    return (valeurs[0] as string) || '';
  } catch {
    return '';
  }
}

function fournisseurActif(): Fournisseur | null {
  const nom = (Deno.env.get('AI_PROVIDER') || 'gemini').toLowerCase();
  const base = FOURNISSEURS[nom];
  if (!base) return null;
  const cle = Deno.env.get('AI_API_KEY') || Deno.env.get(base.variable) || '';
  if (!cle) return null;
  return {
    url: Deno.env.get('AI_BASE_URL') || base.url,
    modele: Deno.env.get('AI_MODEL') || base.modele,
    cle,
    nom
  };
}

/* ------------------------------ Normalisation ------------------------------ */

function texte(valeur: unknown, max = 4000): string {
  return String(valeur == null ? '' : valeur)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function listeTextes(valeur: unknown, max = 12): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.map((item) => texte(item, 300)).filter(Boolean).slice(0, max);
}

function listeObjets(valeur: unknown, champs: string[], max = 20): Record<string, string>[] {
  if (!Array.isArray(valeur)) return [];
  return valeur
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const objet: Record<string, string> = {};
      champs.forEach((champ) => { objet[champ] = texte((item as Record<string, unknown>)[champ], 1200); });
      return objet;
    })
    .filter((objet) => Object.values(objet).some(Boolean))
    .slice(0, max);
}

function normaliserEtude(brut: Record<string, unknown>, oeuvre: string, auteur: string): Record<string, unknown> {
  return {
    titre: texte(brut.titre, 200) || oeuvre,
    auteur: texte(brut.auteur, 160) || auteur,
    epoque: texte(brut.epoque, 120),
    genre: texte(brut.genre, 160),
    mouvement: texte(brut.mouvement, 160),
    resume: texte(brut.resume, 3000),
    contexte: texte(brut.contexte, 3000),
    parties: listeObjets(brut.parties, ['titre', 'resume'], 20),
    personnages: listeObjets(brut.personnages, ['nom', 'role', 'description'], 20),
    themes: listeObjets(brut.themes, ['titre', 'explication'], 12),
    procedes: listeObjets(brut.procedes, ['nom', 'exemple', 'effet'], 12),
    citations: listeObjets(brut.citations, ['texte', 'explication'], 12),
    questions: listeTextes(brut.questions, 12),
    sujets: listeTextes(brut.sujets, 8)
  };
}

function normaliserQuestion(brut: Record<string, unknown>, question: string): Record<string, unknown> {
  return {
    question: texte(brut.question, 400) || question,
    reponse: texte(brut.reponse, 2500),
    explication: texte(brut.explication, 3000),
    exemple: texte(brut.exemple, 1500),
    aRetenir: listeTextes(brut.aRetenir, 8),
    questions: listeTextes(brut.questions, 8)
  };
}

/* --------------------------------- Prompts -------------------------------- */

const SYSTEME = [
  'Tu es un professeur de lettres et de littérature françaises, rigoureux et pédagogique.',
  'Tu réponds UNIQUEMENT par un objet JSON valide, sans texte avant ou après, sans balise Markdown.',
  'Toutes les valeurs sont en français, en texte brut, sans HTML.',
  'Si une information est incertaine, reste général plutôt que d\'inventer un fait précis.'
].join(' ');

function promptEtude(oeuvre: string, auteur: string, niveau: string): string {
  return [
    `Prépare une fiche d'étude pour l'œuvre « ${oeuvre} »${auteur ? ` de ${auteur}` : ''}, niveau ${niveau}.`,
    'Réponds exactement avec ce schéma JSON (toutes les clés sont obligatoires) :',
    '{',
    '  "titre": string, "auteur": string, "epoque": string, "genre": string, "mouvement": string,',
    '  "resume": string, "contexte": string,',
    '  "parties": [{"titre": string, "resume": string}],',
    '  "personnages": [{"nom": string, "role": string, "description": string}],',
    '  "themes": [{"titre": string, "explication": string}],',
    '  "procedes": [{"nom": string, "exemple": string, "effet": string}],',
    '  "citations": [{"texte": string, "explication": string}],',
    '  "questions": [string],',
    '  "sujets": [string]',
    '}',
    'Adapte le vocabulaire et la profondeur au niveau demandé.'
  ].join('\n');
}

function promptQuestion(question: string, niveau: string): string {
  return [
    `Réponds à la question suivante au niveau ${niveau} : « ${question} ».`,
    'Réponds exactement avec ce schéma JSON (toutes les clés sont obligatoires) :',
    '{',
    '  "question": string, "reponse": string, "explication": string, "exemple": string,',
    '  "aRetenir": [string], "questions": [string]',
    '}',
    '"questions" contient trois questions courtes pour vérifier la compréhension.'
  ].join('\n');
}

/* ---------------------------- Appel fournisseur ---------------------------- */

function extraireJson(contenu: string): Record<string, unknown> {
  const nettoye = String(contenu || '').replace(/```json/gi, '```').replace(/```/g, '').trim();
  const debut = nettoye.indexOf('{');
  const fin = nettoye.lastIndexOf('}');
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new ErreurFournisseur('reponse_invalide', 'Le fournisseur n\'a pas renvoyé un contenu exploitable. Réessayez.');
  }
  try {
    return JSON.parse(nettoye.slice(debut, fin + 1));
  } catch {
    throw new ErreurFournisseur('reponse_invalide', 'Le fournisseur n\'a pas renvoyé un contenu exploitable. Réessayez.');
  }
}

async function appelerModele(
  fournisseur: Fournisseur,
  messages: Array<{ role: string; content: string }>,
  modeles: string[]
): Promise<{ contenu: string; modele: string }> {
  let derniereErreur: ErreurFournisseur | null = null;

  for (const modele of modeles) {
    const corps: Record<string, unknown> = {
      model: modele,
      messages,
      temperature: 0.4,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    };
    if (fournisseur.nom === 'gemini') {
      // Réduit les jetons de réflexion : plus rapide et moins coûteux.
      corps.reasoning_effort = 'low';
    }

    const envoyer = async (avecFormat: boolean): Promise<Response> => {
      const controleur = new AbortController();
      const minuteur = setTimeout(() => controleur.abort(), 60000);
      try {
        const charge = avecFormat ? corps : { ...corps };
        if (!avecFormat) delete charge.response_format;
        return await fetch(fournisseur.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fournisseur.cle}`
          },
          body: JSON.stringify(charge),
          signal: controleur.signal
        });
      } finally {
        clearTimeout(minuteur);
      }
    };

    let resultat = await envoyer(true);
    if (resultat.status === 400) {
      // Certains fournisseurs n'acceptent pas response_format : nouvel essai sans.
      resultat = await envoyer(false);
    }

    if (resultat.status === 404) {
      derniereErreur = erreurHttp(404);
      continue;
    }

    if (!resultat.ok) {
      const detail = await resultat.text().catch(() => '');
      console.error(
        `Fournisseur ${fournisseur.nom} : HTTP ${resultat.status}`,
        detail.slice(0, 300),
        `| clé : ${fournisseur.cle.length} caractères, se termine par …${fournisseur.cle.slice(-4)}`
      );
      throw erreurHttp(resultat.status);
    }

    const donnees = await resultat.json();
    const contenu = donnees?.choices?.[0]?.message?.content;
    if (!contenu) {
      throw new ErreurFournisseur('reponse_invalide', 'Le fournisseur n\'a pas renvoyé de contenu. Réessayez.');
    }
    return { contenu: String(contenu), modele };
  }

  throw derniereErreur || erreurHttp(404);
}

/* --------------------------------- Handler -------------------------------- */

Deno.serve(async (requete: Request) => {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (requete.method === 'GET') {
    const actif = fournisseurActif();
    return reponse({
      ok: true,
      service: 'learnhub-ia',
      version: VERSION,
      configure: !!actif,
      fournisseur: actif ? actif.nom : null,
      modele: actif ? actif.modele : null
    });
  }
  if (requete.method !== 'POST') return reponse({ ok: false, error: 'Méthode non autorisée.' }, 405);

  const urlSupabase = Deno.env.get('SUPABASE_URL') || '';
  const cleAnon = clePubliqueSupabase();
  const autorisation = requete.headers.get('Authorization') || '';
  const jeton = autorisation.replace(/^Bearer\s+/i, '').trim();
  if (!jeton) return reponse({ ok: false, code: 'non_connecte', error: 'Connexion requise.' }, 401);
  if (!urlSupabase || !cleAnon) {
    console.error('Configuration Supabase incomplète', { url: !!urlSupabase, cle: !!cleAnon });
    return reponse({ ok: false, code: 'configuration', error: 'Configuration serveur incomplète.' }, 500);
  }

  let supabase;
  try {
    supabase = createClient(urlSupabase, cleAnon, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
      auth: { persistSession: false }
    });
  } catch (erreur) {
    console.error('Client Supabase :', erreur);
    return reponse({ ok: false, code: 'configuration', error: 'Configuration serveur invalide.' }, 500);
  }

  const { data: donneesUtilisateur, error: erreurUtilisateur } = await supabase.auth.getUser(jeton);
  const utilisateur = donneesUtilisateur?.user;
  if (erreurUtilisateur || !utilisateur) {
    return reponse({ ok: false, code: 'non_connecte', error: 'Session expirée.' }, 401);
  }

  let demande: Demande;
  try {
    demande = await requete.json();
  } catch {
    return reponse({ ok: false, error: 'Requête illisible.' }, 400);
  }

  const mode: Mode = demande.mode === 'question' ? 'question' : 'etude';
  const niveau = texte(demande.niveau, 20) || 'lycee';
  const oeuvre = texte(demande.oeuvre, 200);
  const auteur = texte(demande.auteur, 160);
  const question = texte(demande.question, 500);

  if (mode === 'etude' && oeuvre.length < 2) {
    return reponse({ ok: false, code: 'invalide', error: 'Indiquez le titre de l\'œuvre.' }, 400);
  }
  if (mode === 'question' && question.length < 3) {
    return reponse({ ok: false, code: 'invalide', error: 'Posez une question plus précise.' }, 400);
  }

  const fournisseur = fournisseurActif();
  if (!fournisseur) {
    return reponse({
      ok: false,
      code: 'non_configure',
      error: 'Aucune clé IA configurée. Ajoutez GEMINI_API_KEY dans les secrets Supabase.'
    }, 503);
  }

  if (mode === 'etude') {
    const limite = Number(Deno.env.get('IA_LIMITE_JOUR') || 30) || 30;
    const debutJour = new Date();
    debutJour.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('ia_contenus')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', utilisateur.id)
      .gte('created_at', debutJour.toISOString());
    if ((count || 0) >= limite) {
      return reponse({
        ok: false,
        code: 'quota',
        error: `Limite de ${limite} générations par jour atteinte. Réessayez demain.`
      }, 429);
    }
  }

  const invite = mode === 'etude'
    ? promptEtude(oeuvre, auteur, niveau)
    : promptQuestion(question, niveau);

  const modeles = fournisseur.nom === 'gemini'
    ? Array.from(new Set([fournisseur.modele, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash']))
    : fournisseur.nom === 'groq'
      ? Array.from(new Set([fournisseur.modele, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile']))
      : [fournisseur.modele];

  try {
    const resultatModele = await appelerModele(fournisseur, [
      { role: 'system', content: SYSTEME },
      { role: 'user', content: invite }
    ], modeles);
    const objet = extraireJson(resultatModele.contenu);
    const contenu = mode === 'etude'
      ? normaliserEtude(objet, oeuvre, auteur)
      : normaliserQuestion(objet, question);

    return reponse({
      ok: true,
      mode,
      fournisseur: fournisseur.nom,
      modele: resultatModele.modele,
      contenu
    });
  } catch (erreur) {
    console.error('Assistant IA :', erreur);
    const connue = erreur instanceof ErreurFournisseur;
    return reponse({
      ok: false,
      code: connue ? erreur.code : 'indisponible',
      error: connue ? erreur.message : 'La génération a échoué. Réessayez dans un instant.'
    }, 502);
  }
});
