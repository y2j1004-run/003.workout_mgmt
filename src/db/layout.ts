import { db } from './db'

const KEY = 'statsOrder'

export async function getStatsOrder(): Promise<string[] | undefined> {
  return (await db.meta.get(KEY))?.value as string[] | undefined
}

export async function setStatsOrder(order: string[] | undefined) {
  if (order) await db.meta.put({ key: KEY, value: order })
  else await db.meta.delete(KEY)
}
