import { db } from './db';
const KEY = 'goals';
export async function getGoals() {
    return (await db.meta.get(KEY))?.value ?? {};
}
export async function setGoals(goals) {
    await db.meta.put({ key: KEY, value: goals });
}
