import { z } from "zod";

export const categorySchema = z.enum(["nature", "movement", "mindfulness", "creativity", "gardening", "observation"]);
export const questSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3).max(90),
  tagline: z.string().min(3).max(180),
  category: categorySchema,
  durationMinutes: z.number().int().min(1).max(180),
  difficulty: z.enum(["gentle", "moderate", "adventurous", "easy"]),
  whyItFits: z.string().min(3).max(400),
  equipment: z.array(z.string().max(80)).max(10),
  steps: z.array(z.object({
    title: z.string().min(2).max(90),
    instruction: z.string().min(3).max(500),
    durationMinutes: z.number().int().min(1).max(180)
  })).min(2).max(8),
  safetyNotes: z.array(z.string().max(240)).max(8),
  reflectionPrompts: z.array(z.string().max(240)).min(1).max(5),
  screenFree: z.boolean(),
  provenance: z.enum(["demo", "ollama", "hosted"]).default("demo")
}).refine(q => q.steps.reduce((n, s) => n + s.durationMinutes, 0) <= q.durationMinutes + 5, {
  message: "Quest steps should fit the estimated duration."
});
export type Quest = z.infer<typeof questSchema>;
export type Preferences = {
  mood: string; time: number; energy: string; interests: string[];
  environment: string; difficulty: string; constraints: string;
};
export type Activity = {
  id: string; quest: Quest; completedAt: string; durationSeconds: number;
  reflection: string; moodAfter: string; wouldRepeat: boolean; status: "completed";
};
