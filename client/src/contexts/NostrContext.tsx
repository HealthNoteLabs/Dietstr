import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { initializeNostr, getUserPubkey } from '../utils/nostr';

interface NostrContextType {
  isConnected: boolean;
  userPubkey: string | null;
  defaultZapAmount: number;
  setDefaultZapAmount: (amount: number) => void;
}

export const NostrContext = createContext<NostrContextType>({
  isConnected: false,
  userPubkey: null,
  defaultZapAmount: 1000, // 1000 sats default
  setDefaultZapAmount: () => {},
});

interface NostrProviderProps {
  children: ReactNode;
}

export const NostrProvider: React.FC<NostrProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [defaultZapAmount, setDefaultZapAmount] = useState(1000);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeNostr();
        setIsConnected(true);

        // Get user pubkey if available
        const pubkey = await getUserPubkey();
        setUserPubkey(pubkey);
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
    <NostrContext.Provider value={{ isConnected, userPubkey, defaultZapAmount, setDefaultZapAmount }}>
      {children}
    </NostrContext.Provider>
  );
};