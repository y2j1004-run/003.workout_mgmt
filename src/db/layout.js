import { db } from './db';
const KEY = 'statsOrder';
export async function getStatsOrder() {
    return (await db.meta.get(KEY))?.value;
}
export async function setStatsOrder(order) {
    if (order)
        await db.meta.put({ key: KEY, value: order });
    else
        await db.meta.delete(KEY);
}
