import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { initializeNostr, getUserPubkey } from '../utils/nostr';
import NDK from '@nostr-dev-kit/ndk';
import { NDKNip07Signer } from '@nostr-dev-kit/ndk';

interface NostrContextType {
  isConnected: boolean;
  userPubkey: string | null;
  defaultZapAmount: number;
  setDefaultZapAmount: (amount: number) => void;
  ndk: NDK | null;
}

export const NostrContext = createContext<NostrContextType>({
  isConnected: false,
  userPubkey: null,
  defaultZapAmount: 1000, // 1000 sats default
  setDefaultZapAmount: () => {},
  ndk: null,
});

interface NostrProviderProps {
  children: ReactNode;
}

export const NostrProvider: React.FC<NostrProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [defaultZapAmount, setDefaultZapAmount] = useState(1000);
  const [ndk, setNdk] = useState<NDK | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeNostr();
        setIsConnected(true);

        // Get user pubkey if available
        const pubkey = await getUserPubkey();
        setUserPubkey(pubkey);
        
        // Initialize NDK with NIP-07 signer (browser extension)
        if (window.nostr) {
          const signer = new NDKNip07Signer();
          const ndkInstance = new NDK({
            explicitRelayUrls: [
              'wss://relay.damus.io',
              'wss://relay.nostr.band',
              'wss://nos.lol',
              'wss://relay.current.fyi',
              'wss://relay.snort.social',
              'wss://relay.dietstr.com',
              'wss://relay.0xchat.com',
              'wss://nostr.wine',
              'wss://relay.damus.io'
            ],
            signer
          });
          
          await ndkInstance.connect();
          setNdk(ndkInstance);
          console.log('NDK initialized and connected');
        }
      } catch (error) {
        console.error('Error initializing Nostr:', error);
        setIsConnected(false);
      }
    };

    initialize();

    // Check for extension changes
    const checkExtension = setInterval(async () => {
      if (window.nostr) {
        const pubkey = await getUserPubkey();
        setUserPubkey(pubkey);
      }
    }, 5000);

    return () => {
      clearInterval(checkExtension);
    };
  }, []);

  return (
    <NostrContext.Provider value={{ isConnected, userPubkey, defaultZapAmount, setDefaultZapAmount, ndk }}>
      {children}
    </NostrContext.Provider>
  );
};

// Utility hook to use the Nostr context
export const useNostrContext = () => useContext(NostrContext);