const accountChoice = (id, label, model, effort) => Object.freeze({ id, label, model, effort });

export const ACCOUNT_MODEL_CATALOG = Object.freeze({
  "codex-account": Object.freeze([
    accountChoice("gpt-5.6-luna@low", "GPT-5.6 Luna · Low", "gpt-5.6-luna", "low"),
    accountChoice("gpt-5.6-luna@medium", "GPT-5.6 Luna · Medium", "gpt-5.6-luna", "medium"),
    accountChoice("gpt-5.6-luna@high", "GPT-5.6 Luna · High", "gpt-5.6-luna", "high"),
    accountChoice("gpt-5.6-luna@max", "GPT-5.6 Luna · Max", "gpt-5.6-luna", "max"),
    accountChoice("gpt-5.6-terra@medium", "GPT-5.6 Terra · Medium", "gpt-5.6-terra", "medium"),
    accountChoice("gpt-5.6-terra@high", "GPT-5.6 Terra · High", "gpt-5.6-terra", "high"),
    accountChoice("gpt-5.6-terra@max", "GPT-5.6 Terra · Max", "gpt-5.6-terra", "max"),
    accountChoice("gpt-5.6-sol@medium", "GPT-5.6 Sol · Medium", "gpt-5.6-sol", "medium"),
    accountChoice("gpt-5.6-sol@high", "GPT-5.6 Sol · High", "gpt-5.6-sol", "high"),
    accountChoice("gpt-5.6-sol@max", "GPT-5.6 Sol · Max", "gpt-5.6-sol", "max"),
  ]),
  "claude-account": Object.freeze([
    accountChoice("fable@low", "Claude Fable · Low", "fable", "low"),
    accountChoice("fable@medium", "Claude Fable · Medium", "fable", "medium"),
    accountChoice("sonnet@medium", "Claude Sonnet · Medium", "sonnet", "medium"),
    accountChoice("sonnet@high", "Claude Sonnet · High", "sonnet", "high"),
    accountChoice("sonnet@max", "Claude Sonnet · Max", "sonnet", "max"),
    accountChoice("opus@high", "Claude Opus · High", "opus", "high"),
    accountChoice("opus@max", "Claude Opus · Max", "opus", "max"),
  ]),
  "gemini-account": Object.freeze([
    accountChoice("gemini-2.5-flash", "Gemini 2.5 Flash", "gemini-2.5-flash", null),
    accountChoice("gemini-2.5-pro", "Gemini 2.5 Pro", "gemini-2.5-pro", null),
  ]),
});

export function accountModelChoices(provider) {
  return ACCOUNT_MODEL_CATALOG[provider] ?? Object.freeze([]);
}

export function accountModelChoice(provider, id) {
  return accountModelChoices(provider).find((choice) => choice.id === id) ?? null;
}

export function defaultAccountModel(provider) {
  if (provider === "codex-account") return "gpt-5.6-luna@low";
  if (provider === "claude-account") return "fable@low";
  if (provider === "gemini-account") return "gemini-2.5-flash";
  return "";
}
