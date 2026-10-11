import Dexie, { type Table } from "dexie";
import type { Activity, Quest } from "./types";

class TouchGrassDB extends Dexie {
  saved!: Table<Quest, string>;
  activities!: Table<Activity, string>;
  constructor() {
    super("touchgrass-ai");
    this.version(1).stores({ saved: "id, category", activities: "id, completedAt, status" });
  }
}
export const db = new TouchGrassDB();
export const getSaved = () => db.saved.toArray();
export const isSaved = async (id: string) => !!(await db.saved.get(id));
export const toggleSaved = async (quest: Quest) => {
  if (await isSaved(quest.id)) { await db.saved.delete(quest.id); return false; }
  await db.saved.put(quest); return true;
};
export const saveActivity = (activity: Activity) => db.activities.put(activity);
export const getActivities = () => db.activities.orderBy("completedAt").reverse().toArray();
export const deleteActivity = (id: string) => db.activities.delete(id);
export const clearAll = async () => { await db.transaction("rw", db.saved, db.activities, async () => { await db.saved.clear(); await db.activities.clear(); }); };