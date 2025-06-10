import { LRUCache } from 'lru-cache';
import pLimit from 'p-limit';
import axios, { AxiosResponse } from 'axios';

export const limitFetch = pLimit(20);

export const responseCache = new LRUCache<string, AxiosResponse>({
  max: 200,
  ttl: 1000 * 60 * 10,
});

export async function cachedGet(url: string, params: any) {
  const key = `${url}?${new URLSearchParams(params)}`;
  const hit = responseCache.get(key);
  if (hit) return hit;

  let tries = 0;
  while (true) {
    try {
      const res = await axios.get(url, { params });
      responseCache.set(key, res);
      return res;
    } catch (err: any) {
      if (err?.response?.status === 429 && tries < 3) {
        await new Promise(r => setTimeout(r, 2 ** tries * 1_000));
        tries++;
        continue;
      }
      throw err;
    }
  }
}
