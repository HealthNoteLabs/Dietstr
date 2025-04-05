import { useState, useEffect, useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useQuery } from '@tanstack/react-query';
import { User } from '@shared/schema';

interface Wallet {
  available: boolean;
  address?: string;
  balance?: number;
}

export const useAuth = () => {
  const { userPubkey } = useContext(NostrContext);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [wallet, setWallet] = useState<Wallet>({ available: false });

  // Fetch the user data from the backend
  const { data: user } = useQuery<User>({
    queryKey: [`/api/users/${userPubkey}`],
    enabled: !!userPubkey,
  });

  useEffect(() => {
    // Check if user is logged in (has Nostr extension and public key)
    setIsLoggedIn(!!window.nostr && !!userPubkey);

    // Simplified wallet mock for example purposes
    // In a real app, this would interact with the user's Bitcoin wallet
    const checkWallet = async () => {
      if (window.nostr) {
        // Check if there's a LUD16 (Lightning Address) in the user profile
        try {
          const metadata = await window.nostr.getMetadata();
          const lud16 = metadata?.lud16;
          
          if (lud16) {
            setWallet({
              available: true,
              address: lud16,
              balance: 0 // We can't know balance without actual wallet integration
            });
          }
        } catch (error) {
          console.error('Error checking wallet:', error);
          setWallet({ available: false });
        }
      }
    };

    if (isLoggedIn) {
      checkWallet();
    }
  }, [userPubkey]);

  // Function to simulate login
  const login = async () => {
    if (window.nostr) {
      try {
        // This will trigger the Nostr extension to ask the user for permission
        await window.nostr.getPublicKey();
        setIsLoggedIn(true);
        return true;
      } catch (error) {
        console.error('Login failed:', error);
        return false;
      }
    } else {
      alert('No Nostr extension found. Please install Nos2x, Alby, or another Nostr signer extension.');
      return false;
    }
  };

  return {
    isLoggedIn,
    login,
    wallet,
    userPubkey,
    user
  };
};