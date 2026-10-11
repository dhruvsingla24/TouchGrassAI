import { questSchema, type Preferences, type Quest } from "./types";
import { demoQuests } from "./quests";

export type Provider = "demo" | "ollama";
const STORAGE_KEY = "tg-settings";
export type AISettings = { provider: Provider; baseUrl: string; model: string };
export const defaultSettings: AISettings = { provider: "demo", baseUrl: "http://localhost:11434", model: "llama3.2" };
export function readSettings(): AISettings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return defaultSettings; }
}
export function writeSettings(settings: AISettings) { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }

export async function testOllama(settings: AISettings): Promise<string> {
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
  const data = await response.json();
  const models = (data.models || []).map((m: {name:string}) => m.name);
  if (!models.length) throw new Error("Ollama is reachable, but no models are installed. Pull a model first.");
  return models.join(", ");
}
function chooseDemo(p: Preferences): Quest {
  const matches = demoQuests.filter(q => p.interests.length === 0 || p.interests.includes(q.category) ||
    (p.interests.includes("walking") && q.category === "movement") ||
    (p.interests.includes("photography") && q.category === "creativity") ||
    (p.interests.includes("birdwatching") && q.category === "observation"));
  const pool = matches.length ? matches : demoQuests;
  const q = pool[Math.floor(Math.random() * pool.length)];
  const clone = structuredClone(q);
  clone.id = `demo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  clone.durationMinutes = p.time;
  const baseMinutes = Math.floor(p.time / clone.steps.length);
  let remaining = p.time;
  clone.steps = clone.steps.map((step, index) => {
    const durationMinutes = index === clone.steps.length - 1 ? remaining : Math.max(1, baseMinutes);
    remaining -= durationMinutes;
    return { ...step, durationMinutes };
  });
  clone.whyItFits = `A predefined demo quest adapted for ${p.mood.toLowerCase()} mood, ${p.energy.toLowerCase()} energy, and about ${p.time} minutes.`;
  clone.provenance = "demo";
  return clone;
}
export async function generateQuest(p: Preferences, settings: AISettings, forceDemo = false): Promise<Quest> {
  if (forceDemo || settings.provider === "demo") return chooseDemo(p);
  const prompt = `Create one safe, specific, practical outdoor micro-adventure. Return ONLY valid JSON with keys title, tagline, category (nature|movement|mindfulness|creativity|gardening|observation), durationMinutes, difficulty (gentle|moderate|adventurous), whyItFits, equipment (string array), steps (array of {title,instruction,durationMinutes}), safetyNotes (string array), reflectionPrompts (string array), screenFree (boolean). User preferences: ${JSON.stringify(p)}. Duration must be ${p.time} minutes or less. 2-5 steps whose durations sum to no more than ${p.time}. Do not invent weather, location, wildlife, or conditions. Include accessible alternatives. Never suggest trespassing, approaching wildlife, eating unknown plants, or unsafe roads.`;
  const base = settings.baseUrl.replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: settings.model, prompt, stream: false, format: "json", options: { temperature: 0.8 } }),
      signal: AbortSignal.timeout(45000)
    });
  } catch (e) {
    throw new Error(`Could not reach Ollama at ${base}. Check that Ollama is running and browser CORS allows this origin. ${e instanceof Error ? e.message : ""}`);
  }
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}. Check the model name and Ollama logs.`);
  const result = await response.json();
  let raw: unknown;
  try { raw = JSON.parse(result.response); } catch { throw new Error("The model returned invalid JSON. Try again or use demo mode."); }
  const candidate = { ...raw as object, id: `ollama-${Date.now()}`, provenance: "ollama" };
  const quest = questSchema.safeParse(candidate);
  if (!quest.success) throw new Error(`The model's quest did not pass validation: ${quest.error.issues[0]?.message || "invalid format"}`);
  if (quest.data.steps.reduce((sum, s) => sum + s.durationMinutes, 0) > p.time + 2) throw new Error("The generated steps exceed your selected time. Please retry.");
  return quest.data;
}
export function getAIStatus(settings: AISettings) {
  return settings.provider === "demo" ? "Demo mode" : "Local AI configured · connection not yet verified";
}