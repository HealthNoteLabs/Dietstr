import NDK from '@nostr-dev-kit/ndk';

// Initialize the NDK instance
let ndk: NDK;

/**
 * Initialize the Nostr Development Kit
 * Sets up relays and connects
 */
export const initializeNostr = async () => {
  if (ndk) {
    return ndk;
  }

  try {
    // Create a new NDK instance with commonly used Nostr relays
    ndk = new NDK({
      explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://relay.snort.social',
        'wss://nos.lol',
        'wss://relay.current.fyi',
        'wss://relay.nostr.band'
      ]
    });

    // Connect to the relays - this is how we access the decentralized Nostr protocol
    await ndk.connect();
    console.log('Connected to Nostr relays');
    return ndk;
  } catch (error) {
    console.error('Failed to connect to Nostr relays:', error);
    throw error;
  }
};

// Export the NDK instance
export { ndk };

/**
 * Get the user's public key from the browser extension
 * @returns The user's public key or null if not available
 */
export const getUserPubkey = async (): Promise<string | null> => {
  try {
    if (window.nostr) {
      return await window.nostr.getPublicKey();
    }
    return null;
  } catch (error) {
    console.error('Error getting user pubkey:', error);
    return null;
  }
};

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