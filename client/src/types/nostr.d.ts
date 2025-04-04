// Type definitions for window.nostr

interface NostrMetadata {
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  website?: string;
  lud06?: string; // LNURL
  lud16?: string; // Lightning Address
  nip05?: string; // NIP-05 Identifier
}

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface Nostr {
  getPublicKey(): Promise<string>;
  signEvent(event: Omit<NostrEvent, 'id' | 'sig' | 'pubkey'>): Promise<NostrEvent>;
  getRelays(): Promise<{ [url: string]: { read: boolean; write: boolean } }>;
  nip04: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  getMetadata(): Promise<NostrMetadata | undefined>;
}

declare global {
  interface Window {
    nostr?: Nostr;
  }
}