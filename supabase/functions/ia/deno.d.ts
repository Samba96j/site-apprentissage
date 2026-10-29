/**
 * Déclarations minimales pour l'éditeur.
 *
 * Le code de cette fonction s'exécute sur le runtime Deno de Supabase : les
 * globales `Deno` et les imports par URL y existent réellement. L'extension
 * TypeScript intégrée à VS Code, elle, ne les connaît pas — d'où les
 * soulignements. Ce fichier les lui fait connaître.
 *
 * Il n'est utilisé que par l'éditeur : il est ignoré au déploiement.
 * Si vous installez l'extension VS Code « Deno », vous pouvez le supprimer.
 */

declare namespace Deno {
  /** Démarre le serveur HTTP du runtime Deno (Supabase Edge Functions). */
  function serve(
    handler: (requete: Request) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string }
  ): unknown;

  const env: {
    get(nom: string): string | undefined;
    set(nom: string, valeur: string): void;
  };
}

declare module 'https://esm.sh/*' {
  export function createClient(url: string, cle: string, options?: Record<string, unknown>): any;
  const contenu: any;
  export default contenu;
}
