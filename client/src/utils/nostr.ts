import NDK from '@nostr-dev-kit/ndk';

// Initialize the NDK instance
let ndk: NDK;

/**
 * Initialize the Nostr Development Kit
 * Sets up relays and connects
 */
let initializationPromise: Promise<typeof ndk> | null = null;
let cachedUserPubkey: string | null = null;
let lastPubkeyFetch = 0;

export const initializeNostr = async () => {
  // If already initialized, return the NDK instance
  if (ndk && ndk.pool?.relays?.size > 0) {
    return ndk;
  }
  
  // If initialization is in progress, wait for it to complete
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      // Create a new NDK instance with Nostr relays, but with auto-connections disabled
      // to prevent frequent permission prompts
      ndk = new NDK({
        explicitRelayUrls: [
          'wss://relay.damus.io',
          'wss://nos.lol',
          'wss://relay.nostr.band',
          'wss://relay.current.fyi',
          'wss://relay.snort.social',
          'wss://relay.dietstr.com',
          'wss://relay.0xchat.com',
          'wss://nostr.wine'
        ],
        autoConnectUserRelays: false, // Don't auto-connect to user relays
        autoFetchUserMutelist: false  // Don't auto-fetch user mutes
      });

      // Connect to the relays manually - this gives us more control
      await ndk.connect();
      console.log('Connected to Nostr relays');
      return ndk;
    } catch (error) {
      console.error('Failed to connect to Nostr relays:', error);
      initializationPromise = null; // Reset so we can try again
      throw error;
    }
  })();
  
  return initializationPromise;
};

/**
 * Get the user's public key from the browser extension with caching
 * This implementation caches the public key to reduce permission prompts
 * @param forceRefresh Force a refresh of the cached pubkey
 * @returns The user's public key or null if not available
 */
export const getUserPubkey = async (forceRefresh = false): Promise<string | null> => {
  // Check if we have a cached pubkey and it's less than 10 minutes old
  const now = Date.now();
  if (!forceRefresh && cachedUserPubkey && (now - lastPubkeyFetch < 10 * 60 * 1000)) {
    return cachedUserPubkey;
  }
  
  try {
    if (window.nostr) {
      // Only request the pubkey from extension
      cachedUserPubkey = await window.nostr.getPublicKey();
      lastPubkeyFetch = now;
      return cachedUserPubkey;
    }
    return null;
  } catch (error) {
    console.error('Error getting user pubkey:', error);
    return cachedUserPubkey; // Return last cached value if available
  }
};

// Export the NDK instance
export { ndk };

/**
 * Format a Nostr content string to handle mentions, links, and hashtags
 * @param content The raw content string
 * @returns Formatted HTML string
 */
export const formatNostrContent = (content: string): string => {
  if (!content) return '';
  
  // Handle URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  content = content.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${url}</a>`;
  });
  
  // Handle hashtags
  const hashtagRegex = /#(\w+)/g;
  content = content.replace(hashtagRegex, (match, hashtag) => {
    return `<a href="/tag/${hashtag}" class="text-blue-500 hover:underline">#${hashtag}</a>`;
  });
  
  // Handle line breaks
  content = content.replace(/\n/g, '<br/>');
  
  return content;
};

/**
 * Extract image URLs from a Nostr event content
 * @param content The raw content string
 * @returns Array of image URLs
 */
export const extractImageUrls = (content: string): string[] => {
  if (!content) return [];
  
  const urlRegex = /(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi;
  const matches = content.match(urlRegex);
  
  return matches || [];
};