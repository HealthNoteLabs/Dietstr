import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import DailyLog from "@/components/daily-log";
import NutritionSummary from "@/components/nutrition-summary";
import WaterTracker from "@/components/water-tracker";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import type { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pubkey, setPubkey] = useState<string | null>(null);
  const { toast } = useToast();

  // Get pubkey on mount
  useEffect(() => {
    async function getPubkey() {
      try {
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
  }, [setLocation, toast]);

  const { data: user } = useQuery<User>({
    queryKey: [`/api/users/${pubkey}`],
    enabled: !!pubkey
  });

  const handleLogout = () => {
    localStorage.removeItem("privateKey");
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dietstr</h1>
          <Button variant="ghost" onClick={() => setLocation("/")}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <NutritionSummary 
                  date={selectedDate}
                  userId={user?.id}
                  goals={user?.preferences?.macroGoals}
                  calorieGoal={user?.preferences?.dailyCalorieGoal}
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