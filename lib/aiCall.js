// ── Helper: AI API call — provider auto-detect karo localStorage se ──
// Yeh function use karo fetch('/api/ai') ki jagah everywhere

export function getAiProvider() {
  try { return localStorage.getItem('kr_api_provider') || 'openrouter'; } catch { return 'openrouter'; }
}

export async function aiCall({ messages, max_tokens = 1000, temperature = 0.9, stream = false, model = 'openai/gpt-4o-mini' }) {
  const provider = getAiProvider();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, messages, max_tokens, temperature, stream }),
  });
  return res;
}
