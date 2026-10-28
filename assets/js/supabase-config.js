/**
 * LearnHub — configuration Supabase.
 *
 * Ces deux valeurs sont publiques et conçues pour être exposées dans le
 * navigateur : ce sont les politiques RLS qui protègent les données.
 * Ne JAMAIS placer la clé `service_role` / `sb_secret_…` ici.
 *
 * Pour revenir au mode 100 % local (données dans le navigateur),
 * passer `backend` à false.
 */
window.LearnHubConfig = {
    backend: true,
    supabaseUrl: 'https://achwmlisnsbyxcvwteam.supabase.co',
    supabaseKey: 'sb_publishable_h2IhiuomR_h_UwdJEM7XOg_m_i6dzhQ'
};
