import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
    };
  }
}

export default function Login() {
  const [extensionFound, setExtensionFound] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    setExtensionFound(!!window.nostr);
  }, []);

  const handleLogin = async () => {
    try {
      if (!window.nostr) {
        throw new Error("No Nostr extension found");
      }

      const pubkey = await window.nostr.getPublicKey();

      // Create or get user
      const res = await apiRequest("POST", "/api/users", { pubkey });

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
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!extensionFound && (
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
            <Button 
              className="w-full" 
              onClick={handleLogin}
              disabled={!extensionFound}
            >
              Login with Nostr
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}