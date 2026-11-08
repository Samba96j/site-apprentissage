import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function reponse(corps: Record<string, unknown>, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function clePubliqueSupabase(): string {
  const directe = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (directe) return directe;
  try {
    const cles = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return Object.values(cles).find((valeur): valeur is string =>
      typeof valeur === 'string' && valeur.length > 0
    ) || '';
  } catch {
    return '';
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return reponse({ error: 'Méthode non autorisée.' }, 405);

  const authorization = request.headers.get('Authorization') || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return reponse({ error: 'Connexion requise.' }, 401);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const clePublique = clePubliqueSupabase();
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !clePublique || !cleService) {
    return reponse({ error: 'Fonction serveur mal configurée.' }, 500);
  }

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return reponse({ error: 'Requête invalide.' }, 400);
  }
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) {
    return reponse({ error: 'Requête invalide.' }, 400);
  }

  const donnees = corps as Record<string, unknown>;
  const userId = typeof donnees.userId === 'string' ? donnees.userId.trim() : '';
  const email = typeof donnees.email === 'string' ? donnees.email.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return reponse({ error: 'Compte introuvable.' }, 400);
  }
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return reponse({ error: 'Adresse e-mail invalide.' }, 400);
  }

  const utilisateurClient = createClient(url, clePublique, {
    global: { headers: { Authorization: `Bearer ${tokenMatch[1]}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: sessionData, error: sessionError } = await utilisateurClient.auth.getUser(tokenMatch[1]);
  if (sessionError || !sessionData.user) return reponse({ error: 'Session invalide ou expirée.' }, 401);
  if (sessionData.user.id === userId) {
    return reponse({ error: 'Cette action concerne uniquement les autres comptes.' }, 400);
  }

  const { data: profilActeur, error: profilError } = await utilisateurClient
    .from('profiles')
    .select('role')
    .eq('id', sessionData.user.id)
    .maybeSingle();
  if (profilError) return reponse({ error: 'Vérification des droits impossible.' }, 500);
  if (!profilActeur || profilActeur.role !== 'superadmin') {
    return reponse({ error: 'Action réservée au super-administrateur.' }, 403);
  }

  const serviceClient = createClient(url, cleService, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: profilCible, error: cibleError } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (cibleError) return reponse({ error: 'Vérification du compte cible impossible.' }, 500);
  if (!profilCible) return reponse({ error: 'Utilisateur introuvable.' }, 404);

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true
  });
  if (updateError) {
    const message = /already registered|already exists|duplicate key|email_exists|user_already_exists/i.test(updateError.message)
      ? 'Cette adresse e-mail est déjà utilisée.'
      : 'La mise à jour de l’adresse e-mail a échoué.';
    return reponse({ error: message }, 400);
  }

  return reponse({ ok: true, email });
});
