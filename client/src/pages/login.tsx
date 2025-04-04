import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isNativeApp, isAndroid, storePreference, getPreference } from "../capacitor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPrivateKeyFromNsec, getPubKeyFromPrivateKey } from "@/lib/nostr";

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
    };
  }
}

export default function Login() {
  const [extensionFound, setExtensionFound] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [nsecInput, setNsecInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Check if we're on a native app
    const nativeApp = isNativeApp();
    setIsNative(nativeApp);
    
    // If using browser extension
    if (!nativeApp) {
      setExtensionFound(!!window.nostr);
    } else {
      // In native app, check if we have stored keys
      checkForStoredKeys();
    }
  }, []);

  const checkForStoredKeys = async () => {
    try {
      const savedKey = await getPreference("nostr_nsec");
      if (savedKey) {
        // We have a saved key, enable login
        setExtensionFound(true);
      }
    } catch (error) {
      console.error("Failed to check for stored keys:", error);
    }
  };

  const handleManualLogin = async () => {
    if (!nsecInput) {
      toast({
        title: "Error",
        description: "Please enter your private key",
        variant: "destructive",
      });
      return;
    }

    try {
      // Convert nsec to hex private key, then get pubkey
      const privateKey = getPrivateKeyFromNsec(nsecInput);
      const pubkey = getPubKeyFromPrivateKey(privateKey);
      
      // If on native app, store the nsec
      if (isNative) {
        await storePreference("nostr_nsec", nsecInput);
      }

      // Create or get user
      await apiRequest("POST", "/api/users", { pubkey });
      
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid private key",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async () => {
    try {
      // For native apps, check if we have a stored key
      if (isNative) {
        const savedKey = await getPreference("nostr_nsec");
        if (savedKey) {
          // Use the saved key
          const privateKey = getPrivateKeyFromNsec(savedKey);
          const pubkey = getPubKeyFromPrivateKey(privateKey);
          
          // Create or get user
          await apiRequest("POST", "/api/users", { pubkey });
          
          setLocation("/dashboard");
          return;
        }
      }
      
      // For browser extension
      if (!window.nostr) {
        throw new Error("No Nostr extension found");
      }

      const pubkey = await window.nostr.getPublicKey();

      // Create or get user
      await apiRequest("POST", "/api/users", { pubkey });

      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to login",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center">Welcome to Dietstr</h1>
          <p className="text-center text-muted-foreground text-sm">
            Your decentralized nutrition tracker
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Show different messages based on platform */}
            {!extensionFound && !isNative && (
              <p className="text-sm text-muted-foreground text-center">
                Please install a Nostr extension like{" "}
                <a
                  href="https://getalby.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Alby
                </a>
                {" "}or{" "}
                <a
                  href="https://github.com/fiatjaf/nos2x"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  nos2x
                </a>
                {" "}to continue
              </p>
            )}

            {/* Standard login button */}
            {!showManualInput && (
              <Button 
                className="w-full" 
                onClick={handleLogin}
                disabled={!extensionFound && !isNative}
              >
                {isNative ? "Login to Dietstr" : "Login with Nostr"}
              </Button>
            )}

            {/* Manual key input option */}
            {showManualInput ? (
              <div className="space-y-3">
                <Label htmlFor="nsec">Enter your nsec private key</Label>
                <Input
                  id="nsec"
                  type="password"
                  value={nsecInput}
                  onChange={(e) => setNsecInput(e.target.value)}
                  placeholder="nsec1..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <Button className="w-full" onClick={handleManualLogin}>
                  Login with Private Key
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setShowManualInput(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center my-4">
                  <Separator className="flex-1" />
                  <span className="mx-2 text-xs text-muted-foreground">OR</span>
                  <Separator className="flex-1" />
                </div>

                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setShowManualInput(true)}
                >
                  Use Private Key
                </Button>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-muted-foreground">
            Your data is stored securely and synced with Nostr protocol
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}