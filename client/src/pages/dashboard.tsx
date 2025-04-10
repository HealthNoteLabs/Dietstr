import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DailyLog from "@/components/daily-log";
import NutritionSummary from "@/components/nutrition-summary";
import WaterTracker from "@/components/water-tracker";
import DietPlan from "@/components/diet-plan";
import { Button } from "@/components/ui/button";
import { LogOut, ListPlus, Activity, Droplets, Menu, Rss, Utensils } from "lucide-react";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { isNativeApp, getPreference, removePreference } from "../capacitor";
import { getPrivateKeyFromNsec, getPubKeyFromPrivateKey } from "@/lib/nostr";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("diet");
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isNative = isNativeApp();

  // Get pubkey on mount
  useEffect(() => {
    async function getPubkey() {
      try {
        // For native apps, check if we have a stored key
        if (isNative) {
          const savedKey = await getPreference("nostr_nsec");
          if (savedKey) {
            // Use the saved key
            const privateKey = getPrivateKeyFromNsec(savedKey);
            const key = getPubKeyFromPrivateKey(privateKey);
            setPubkey(key);
            return;
          }
        }
        
        // For browser extension
        if (!window.nostr) {
          throw new Error("No Nostr extension found");
        }
        const key = await window.nostr.getPublicKey();
        setPubkey(key);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to get Nostr public key. Please try logging in again.",
          variant: "destructive",
        });
        setLocation("/");
      }
    }
    getPubkey();
  }, [setLocation, toast, isNative]);

  const { data: user } = useQuery<User>({
    queryKey: [`/api/users/${pubkey}`],
    enabled: !!pubkey
  });

  const handleLogout = async () => {
    if (isNative) {
      // Remove stored key if on native app
      await removePreference("nostr_nsec");
    }
    localStorage.removeItem("privateKey");
    setLocation("/");
  };

  // Layout for mobile devices
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center justify-end px-4 py-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col h-full">
                <div className="flex-1 py-8">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Menu</h2>
                    <SheetClose asChild>
                      <Button 
                        variant="ghost" 
                        onClick={() => setActiveTab("diet")}
                        className="justify-start w-full"
                      >
                        <Utensils className="h-4 w-4 mr-2" />
                        Diet Plan
                      </Button>
                    </SheetClose>

                    <SheetClose asChild>
                      <Button 
                        variant="ghost" 
                        onClick={() => setActiveTab("water")}
                        className="justify-start w-full"
                      >
                        <Droplets className="h-4 w-4 mr-2" />
                        Water Tracker
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button 
                        variant="ghost" 
                        onClick={() => setActiveTab("food")}
                        className="justify-start w-full"
                      >
                        <ListPlus className="h-4 w-4 mr-2" />
                        Food Log
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <main className="flex-1 container px-3 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="diet">
                <Utensils className="h-4 w-4 mr-2" />
                <span className="sr-only sm:not-sr-only">Diet</span>
              </TabsTrigger>
              <TabsTrigger value="water">
                <Droplets className="h-4 w-4 mr-2" />
                <span className="sr-only sm:not-sr-only">Water</span>
              </TabsTrigger>
              <TabsTrigger value="food">
                <ListPlus className="h-4 w-4 mr-2" />
                <span className="sr-only sm:not-sr-only">Food Log</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="diet" className="mt-0">
              <Card>
                <CardContent className="p-4 pt-4">
                  <DietPlan 
                    userId={user?.id}
                    user={user}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="water" className="mt-0">
              <Card>
                <CardContent className="p-4 pt-4">
                  <WaterTracker
                    date={selectedDate}
                    userId={user?.id}
                    goal={user?.preferences?.waterGoal || 2000}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="food" className="mt-0">
              <Card>
                <CardContent className="p-4 pt-4">
                  <DailyLog
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                    userId={user?.id}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <DietPlan 
                  userId={user?.id}
                  user={user}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <WaterTracker
                  date={selectedDate}
                  userId={user?.id}
                  goal={user?.preferences?.waterGoal || 2000}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardContent className="p-6">
              <DailyLog
                date={selectedDate}
                onDateChange={setSelectedDate}
                userId={user?.id}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}