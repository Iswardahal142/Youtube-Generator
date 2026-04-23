// lib/aiCall.js
// Har fetch('/api/ai') call ki jagah yeh use karo
// Provider window.__aiProvider se auto-detect hota hai (SideDrawer set karta hai)

export function getActiveProvider() {
  if (typeof window !== 'undefined' && window.__aiProvider) {
    return window.__aiProvider;
  }
  return 'openrouter';
}

export async function aiCall({
  messages,
  max_tokens = 1000,
  temperature = 0.9,
  stream = false,
  model = 'openai/gpt-4o-mini',
}) {
  const provider = getActiveProvider();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, messages, max_tokens, temperature, stream }),
  });
  return res;
}
