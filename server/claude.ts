import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type Provider } from "./tuteur.ts";

export const MODELE = "claude-opus-5-5";

/**
 * Fournisseur Claude (SDK officiel). La clé est lue par le SDK dans ANTHROPIC_API_KEY, côté serveur uniquement.
 * Les « fallbacks » côté serveur sont activés : si le modèle principal refuse une demande, l'API peut
 * réessayer avec un modèle de repli (bêta server-side-fallback-2026-07-01).
 */
export function claudeProvider(options: { apiKey?: string; fetch?: typeof fetch; maxRetries?: number } = {}): Provider {
  // Les options ne servent qu'aux tests (fetch simulé) : en production, la clé vient de l'environnement.
  const client = new Anthropic({ maxRetries: 2, timeout: 60_000, ...options });
  return {
    name: "claude",
    model: MODELE,
    async answer(system, user) {
      try {
        const msg = await client.beta.messages.create({
          model: MODELE,
          max_tokens: 2000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" },
          system,
          messages: [{ role: "user", content: user }],
        });
        if (msg.stop_reason === "refusal") return { refused: true };
        const text = msg.content
          .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        if (!text) throw new ProviderError("réponse vide du modèle", 502);
        return { text };
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (e instanceof Anthropic.AuthenticationError) throw new ProviderError("clé API refusée par le fournisseur", 503);
        if (e instanceof Anthropic.RateLimitError) throw new ProviderError("limite du fournisseur atteinte, réessaie plus tard", 429);
        if (e instanceof Anthropic.APIConnectionError) throw new ProviderError("fournisseur injoignable", 502);
        if (e instanceof Anthropic.APIError) throw new ProviderError(`erreur du fournisseur (${e.status ?? "?"})`, 502);
        throw new ProviderError("erreur du fournisseur", 502);
      }
    },
  };
}
