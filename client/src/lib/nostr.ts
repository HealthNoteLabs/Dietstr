import { SimplePool, getPublicKey, nip19 } from 'nostr-tools';

export const pool = new SimplePool();

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
];

export interface NostrEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
}

export async function publishEvent(event: Partial<NostrEvent>, privateKey: string): Promise<string | undefined> {
  try {
    const pub = await pool.publish(RELAYS, {
      kind: event.kind!,
      content: event.content!,
      tags: event.tags || [],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(privateKey),
    });
    return pub;
  } catch (error) {
    console.error('Failed to publish event:', error);
    return undefined;
  }
}

export function getPrivateKeyFromNsec(nsec: string): string {
  try {
    const decoded = nip19.decode(nsec);
    return decoded.data as string;
  } catch {
    throw new Error('Invalid nsec format');
  }
}

export function getPubKeyFromPrivateKey(privateKey: string): string {
  return getPublicKey(privateKey);
}
