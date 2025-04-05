import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, FoodEntry, WaterEntry } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Droplets, Flame, Trophy, TrendingUp } from "lucide-react";
import { format, subDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { isNativeApp, getPreference } from "../capacitor";
import { getPrivateKeyFromNsec, getPubKeyFromPrivateKey } from "@/lib/nostr";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Streak {
  name: string;
  currentStreak: number;
  longestStreak: number;
  icon: React.ReactNode;
  color: string;
}

export default function StatsPage() {
  const [, setLocation] = useLocation();
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>("week");
  const { toast } = useToast();
  const isNative = isNativeApp();

  // Get pubkey on mount (same as in dashboard)
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

  // Get user data
  const { data: user } = useQuery<User>({
    queryKey: [`/api/users/${pubkey}`],
    enabled: !!pubkey,
  });

  // Get food entries for stats
  const { data: foodEntries } = useQuery<FoodEntry[]>({
    queryKey: ['/api/food-entries'],
    enabled: !!user?.id,
  });

  // Get water entries for stats
  const { data: waterEntries } = useQuery<WaterEntry[]>({
    queryKey: ['/api/water-entries'],
    enabled: !!user?.id,
  });

  // Calculate date range for filtered data
  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case "week":
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case "month":
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        };
      case "year":
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31),
        };
      default:
        return {
          start: subDays(now, 7),
          end: now,
        };
    }
  };

  const dateRange = getDateRange();
  
  // Filter entries by date range
  const filteredFoodEntries = foodEntries?.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate >= dateRange.start && entryDate <= dateRange.end;
  }) || [];

  const filteredWaterEntries = waterEntries?.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate >= dateRange.start && entryDate <= dateRange.end;
  }) || [];

  // Calculate calorie stats
  const calculateCalorieStats = () => {
    if (!filteredFoodEntries.length) return { average: 0, min: 0, max: 0, total: 0 };
    
    const dailyCalories: { [date: string]: number } = {};
    
    filteredFoodEntries.forEach(entry => {
      const dateStr = format(new Date(entry.date), 'yyyy-MM-dd');
      if (!dailyCalories[dateStr]) {
        dailyCalories[dateStr] = 0;
      }
      dailyCalories[dateStr] += entry.calories;
    });
    
    const values = Object.values(dailyCalories);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = values.length ? Math.round(total / values.length) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    
    return { average, min, max, total };
  };

  // Calculate water stats
  const calculateWaterStats = () => {
    if (!filteredWaterEntries.length) return { average: 0, min: 0, max: 0, total: 0 };
    
    const dailyWater: { [date: string]: number } = {};
    
    filteredWaterEntries.forEach(entry => {
      const dateStr = format(new Date(entry.date), 'yyyy-MM-dd');
      if (!dailyWater[dateStr]) {
        dailyWater[dateStr] = 0;
      }
      dailyWater[dateStr] += entry.amount;
    });
    
    const values = Object.values(dailyWater);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = values.length ? Math.round(total / values.length) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    
    return { average, min, max, total };
  };

  // Calculate streaks
  const calculateStreaks = (): Streak[] => {
    // Helper function to check if an array of dates has no gaps
    const checkConsecutiveDays = (dates: Date[]): number => {
      if (dates.length === 0) return 0;
      
      // Sort dates in descending order
      dates.sort((a, b) => b.getTime() - a.getTime());
      
      let currentStreak = 1;
      const today = new Date();
      
      // Check if the most recent date is today or yesterday
      if (!isSameDay(dates[0], today) && !isSameDay(dates[0], subDays(today, 1))) {
        return 0;
      }
      
      // Count consecutive days
      for (let i = 0; i < dates.length - 1; i++) {
        const current = dates[i];
        const next = dates[i + 1];
        
        // Check if the next date is exactly one day before the current
        if (isSameDay(subDays(current, 1), next)) {
          currentStreak++;
        } else {
          break;
        }
      }
      
      return currentStreak;
    };

    // For demonstration, create some mock streaks
    // In a real app, these would be calculated from actual user data
    const streaks: Streak[] = [];
    
    // Fasting streak - assuming under 1500 calories counts as fasting day
    if (foodEntries) {
      const fastingDates: Date[] = [];
      const dailyCalories: { [date: string]: number } = {};
      
      foodEntries.forEach(entry => {
        const dateStr = format(new Date(entry.date), 'yyyy-MM-dd');
        if (!dailyCalories[dateStr]) {
          dailyCalories[dateStr] = 0;
        }
        dailyCalories[dateStr] += entry.calories;
      });
      
      // Check which days have under 1500 calories
      for (const [dateStr, calories] of Object.entries(dailyCalories)) {
        if (calories < 1500) {
          fastingDates.push(new Date(dateStr));
        }
      }
      
      const currentFastingStreak = checkConsecutiveDays(fastingDates);
      streaks.push({
        name: "Fasting",
        currentStreak: currentFastingStreak,
        longestStreak: Math.max(currentFastingStreak, 14), // Mock value for longest
        icon: <Flame className="h-5 w-5" />,
        color: "text-orange-500"
      });
    }
    
    // Carnivore streak - assuming meals with meat category would count
    if (foodEntries) {
      const carnivoreDates: Date[] = [];
      const dailyProteinGrams: { [date: string]: number } = {};
      
      foodEntries.forEach(entry => {
        const dateStr = format(new Date(entry.date), 'yyyy-MM-dd');
        if (!dailyProteinGrams[dateStr]) {
          dailyProteinGrams[dateStr] = 0;
        }
        dailyProteinGrams[dateStr] += entry.protein || 0;
      });
      
      // Check which days have high protein (carnivore indicator)
      for (const [dateStr, protein] of Object.entries(dailyProteinGrams)) {
        if (protein > 100) { // Assuming high protein indicates carnivore diet
          carnivoreDates.push(new Date(dateStr));
        }
      }
      
      const currentCarnivoreStreak = checkConsecutiveDays(carnivoreDates);
      streaks.push({
        name: "Carnivore",
        currentStreak: currentCarnivoreStreak,
        longestStreak: Math.max(currentCarnivoreStreak, 21), // Mock value for longest
        icon: <TrendingUp className="h-5 w-5" />,
        color: "text-red-500"
      });
    }
    
    // Custom plan streak - assuming user goal calories
    if (foodEntries && user?.preferences?.dailyCalorieGoal) {
      const planDates: Date[] = [];
      const dailyCalories: { [date: string]: number } = {};
      const goalCalories = user.preferences.dailyCalorieGoal;
      
      foodEntries.forEach(entry => {
        const dateStr = format(new Date(entry.date), 'yyyy-MM-dd');
        if (!dailyCalories[dateStr]) {
          dailyCalories[dateStr] = 0;
        }
        dailyCalories[dateStr] += entry.calories;
      });
      
      // Check which days are within 10% of calorie goal
      for (const [dateStr, calories] of Object.entries(dailyCalories)) {
        if (calories >= goalCalories * 0.9 && calories <= goalCalories * 1.1) {
          planDates.push(new Date(dateStr));
        }
      }
      
      const currentPlanStreak = checkConsecutiveDays(planDates);
      streaks.push({
        name: "Custom Plan",
        currentStreak: currentPlanStreak,
        longestStreak: Math.max(currentPlanStreak, 30), // Mock value for longest
        icon: <Trophy className="h-5 w-5" />,
        color: "text-green-500"
      });
    }
    
    return streaks;
  };

  const calorieStats = calculateCalorieStats();
  const waterStats = calculateWaterStats();
  const streaks = calculateStreaks();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold mb-1">Statistics</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Tabs defaultValue="nutrition">
        <TabsList className="mb-6">
          <TabsTrigger value="nutrition">Nutrition Stats</TabsTrigger>
          <TabsTrigger value="streaks">Streaks</TabsTrigger>
        </TabsList>
        
        <TabsContent value="nutrition">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Calorie Stats Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-lg">
                  <Flame className="h-5 w-5 mr-2 text-orange-500" />
                  Calorie Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Daily Average</div>
                      <div className="text-2xl font-bold">{calorieStats.average}</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="text-2xl font-bold">{calorieStats.total}</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Min</div>
                      <div className="text-2xl font-bold">{calorieStats.min}</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Max</div>
                      <div className="text-2xl font-bold">{calorieStats.max}</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Average vs Goal</span>
                      <span className="text-sm font-medium">
                        {calorieStats.average} / {user?.preferences?.dailyCalorieGoal || 2000}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (calorieStats.average / (user?.preferences?.dailyCalorieGoal || 2000)) * 100)} 
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Water Stats Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-lg">
                  <Droplets className="h-5 w-5 mr-2 text-blue-500" />
                  Water Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Daily Average</div>
                      <div className="text-2xl font-bold">{waterStats.average} ml</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="text-2xl font-bold">{waterStats.total} ml</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Min</div>
                      <div className="text-2xl font-bold">{waterStats.min} ml</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Max</div>
                      <div className="text-2xl font-bold">{waterStats.max} ml</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Average vs Goal</span>
                      <span className="text-sm font-medium">
                        {waterStats.average} / {user?.preferences?.waterGoal || 2000} ml
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (waterStats.average / (user?.preferences?.waterGoal || 2000)) * 100)} 
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="streaks">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Streaks Cards */}
            {streaks.map((streak, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <CardTitle className={`flex items-center text-lg ${streak.color}`}>
                    {streak.icon}
                    <span className="ml-2">{streak.name} Streak</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Current Streak</div>
                        <div className="text-2xl font-bold">{streak.currentStreak} days</div>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Longest Streak</div>
                        <div className="text-2xl font-bold">{streak.longestStreak} days</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Progress
                      </div>
                      <Progress 
                        value={Math.min(100, (streak.currentStreak / streak.longestStreak) * 100)} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Show message if no streaks */}
            {streaks.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="p-6 text-center">
                  <div className="text-muted-foreground">
                    No streak data available yet. Start tracking your diet and activity to see your streaks here.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}