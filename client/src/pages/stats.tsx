import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { User, FoodEntry, WaterEntry } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, DropletIcon, FlameIcon, TrendingUpIcon, Utensils, Beef, Salad } from "lucide-react";
import ProfileUpdate from "@/components/profile-update";
import { format, subDays, isWithinInterval, startOfDay, endOfDay, differenceInDays } from "date-fns";

export default function StatsPage() {
  const { user } = useAuth();
  const [streaks, setStreaks] = useState({
    current: {
      diet: 0,
      water: 0,
      logging: 0,
    },
    longest: {
      diet: 0,
      water: 0,
      logging: 0,
    }
  });

  // Fetch food entries for the last 30 days
  const { data: foodEntries30Days } = useQuery<FoodEntry[]>({
    queryKey: ['/api/food-entries-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dateParam = `${thirtyDaysAgo.toISOString().split('T')[0]}`;
      
      const response = await fetch(`/api/food-entries?userId=${user.id}&date=${dateParam}&range=30`);
      if (!response.ok) {
        throw new Error('Failed to fetch food entries');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Fetch water entries for the last 30 days
  const { data: waterEntries30Days } = useQuery<WaterEntry[]>({
    queryKey: ['/api/water-entries-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dateParam = `${thirtyDaysAgo.toISOString().split('T')[0]}`;
      
      const response = await fetch(`/api/water-entries?userId=${user.id}&date=${dateParam}&range=30`);
      if (!response.ok) {
        throw new Error('Failed to fetch water entries');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Calculate streaks when data changes
  useEffect(() => {
    if (!user || !foodEntries30Days || !waterEntries30Days) return;

    // Helper function to group entries by date
    const groupByDate = (entries: { date: string | Date }[]) => {
      const grouped: Record<string, boolean> = {};
      entries.forEach(entry => {
        const dateStr = new Date(entry.date).toISOString().split('T')[0];
        grouped[dateStr] = true;
      });
      return grouped;
    };

    const foodEntriesByDate = groupByDate(foodEntries30Days);
    const waterEntriesByDate = groupByDate(waterEntries30Days);
    
    // Calculate current streaks
    let currentDietStreak = 0;
    let currentWaterStreak = 0;
    let currentLoggingStreak = 0;
    
    // Calculate longest streaks
    let longestDietStreak = 0;
    let longestWaterStreak = 0;
    let longestLoggingStreak = 0;
    
    let tempDietStreak = 0;
    let tempWaterStreak = 0;
    let tempLoggingStreak = 0;
    
    // Iterate over the last 30 days in reverse (from today backward)
    for (let i = 0; i < 30; i++) {
      const checkDate = subDays(new Date(), i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const hasFoodEntry = foodEntriesByDate[dateStr];
      const hasWaterEntry = waterEntriesByDate[dateStr];
      const hasAnyEntry = hasFoodEntry || hasWaterEntry;
      
      // Check if diet plan was followed (based on food entries matching the diet plan)
      let followedDietPlan = false;
      if (user?.preferences?.dietPlan && hasFoodEntry) {
        const dietPlan = user.preferences.dietPlan;
        
        // Simple heuristic based on meal names, can be enhanced with more data
        const entriesForDate = foodEntries30Days.filter(
          entry => new Date(entry.date).toISOString().split('T')[0] === dateStr
        );
        
        if (dietPlan === 'carnivore') {
          // All food entries should be animal products for carnivore
          followedDietPlan = entriesForDate.every(entry => 
            /meat|beef|chicken|fish|pork|lamb|eggs|bacon|turkey|sausage|steak/.test(entry.name.toLowerCase())
          );
        } else if (dietPlan === 'keto') {
          // All food entries should be low-carb for keto
          const hasHighCarbFood = entriesForDate.some(entry =>
            /bread|pasta|rice|potato|sugar|cake|cookie|donut|pizza|cereal|fries/.test(entry.name.toLowerCase())
          );
          followedDietPlan = !hasHighCarbFood;
        } else if (dietPlan === 'fasting') {
          // For fasting, we check if they have limited entries (1-2) during expected eating window
          followedDietPlan = entriesForDate.length <= 2;
        } else if (dietPlan === 'animal-based') {
          // Predominantly animal products with some low-toxicity fruits
          const animalBasedRatio = entriesForDate.filter(entry => 
            /meat|beef|chicken|fish|pork|lamb|eggs|bacon|turkey|sausage|steak|honey|fruit/.test(entry.name.toLowerCase())
          ).length / entriesForDate.length;
          
          followedDietPlan = animalBasedRatio >= 0.8; // 80% or more animal-based foods
        }
      }
      
      // For days without entries: if it's today or yesterday, we don't break the streak
      // For older days, we break the streak
      if (i <= 1) {
        // For today and yesterday, continue regardless
        if (followedDietPlan || !user?.preferences?.dietPlan) tempDietStreak++;
        if (hasWaterEntry) tempWaterStreak++;
        if (hasAnyEntry) tempLoggingStreak++;
      } else {
        // For older days, only continue if there are entries
        if (followedDietPlan) {
          tempDietStreak++;
        } else {
          // Reset streak counter if plan wasn't followed or user has no plan
          if (tempDietStreak > longestDietStreak) longestDietStreak = tempDietStreak;
          tempDietStreak = 0;
        }
        
        if (hasWaterEntry) {
          tempWaterStreak++;
        } else {
          if (tempWaterStreak > longestWaterStreak) longestWaterStreak = tempWaterStreak;
          tempWaterStreak = 0;
        }
        
        if (hasAnyEntry) {
          tempLoggingStreak++;
        } else {
          if (tempLoggingStreak > longestLoggingStreak) longestLoggingStreak = tempLoggingStreak;
          tempLoggingStreak = 0;
        }
      }
      
      // Current streak is only counted for consecutive days including today
      if (i === 0 && followedDietPlan) currentDietStreak = tempDietStreak;
      if (i === 0 && hasWaterEntry) currentWaterStreak = tempWaterStreak;
      if (i === 0 && hasAnyEntry) currentLoggingStreak = tempLoggingStreak;
    }
    
    // Final check for longest streaks
    if (tempDietStreak > longestDietStreak) longestDietStreak = tempDietStreak;
    if (tempWaterStreak > longestWaterStreak) longestWaterStreak = tempWaterStreak;
    if (tempLoggingStreak > longestLoggingStreak) longestLoggingStreak = tempLoggingStreak;
    
    setStreaks({
      current: {
        diet: currentDietStreak,
        water: currentWaterStreak,
        logging: currentLoggingStreak,
      },
      longest: {
        diet: longestDietStreak,
        water: longestWaterStreak,
        logging: longestLoggingStreak,
      }
    });
  }, [user, foodEntries30Days, waterEntries30Days]);

  // Get current diet plan icon
  const getDietIcon = () => {
    switch(user?.preferences?.dietPlan) {
      case 'carnivore':
        return <Beef className="h-6 w-6 text-red-500" />;
      case 'keto':
        return <FlameIcon className="h-6 w-6 text-orange-500" />;
      case 'fasting':
        return <Utensils className="h-6 w-6 text-blue-500" />;
      case 'animal-based':
        return <Salad className="h-6 w-6 text-green-500" />;
      default:
        return <FlameIcon className="h-6 w-6 text-purple-500" />;
    }
  };

  // Calculate nutrition averages for the last 7 days
  const calculateNutritionAverages = () => {
    if (!foodEntries30Days?.length) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentEntries = foodEntries30Days.filter(entry => 
      new Date(entry.date) >= sevenDaysAgo
    );
    
    if (recentEntries.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    const totalCalories = recentEntries.reduce((sum, entry) => sum + entry.calories, 0);
    
    // Filter out entries with missing macros before calculating
    const entriesWithProtein = recentEntries.filter(entry => entry.protein !== null);
    const entriesWithCarbs = recentEntries.filter(entry => entry.carbs !== null);
    const entriesWithFat = recentEntries.filter(entry => entry.fat !== null);
    
    const totalProtein = entriesWithProtein.reduce((sum, entry) => sum + (entry.protein || 0), 0);
    const totalCarbs = entriesWithCarbs.reduce((sum, entry) => sum + (entry.carbs || 0), 0);
    const totalFat = entriesWithFat.reduce((sum, entry) => sum + (entry.fat || 0), 0);
    
    // Get number of unique days with entries
    const uniqueDays = new Set(recentEntries.map(entry => 
      new Date(entry.date).toISOString().split('T')[0]
    )).size;
    
    return {
      calories: Math.round(totalCalories / uniqueDays) || 0,
      protein: Math.round(totalProtein / uniqueDays) || 0,
      carbs: Math.round(totalCarbs / uniqueDays) || 0,
      fat: Math.round(totalFat / uniqueDays) || 0,
    };
  };

  // Calculate water average for the last 7 days
  const calculateWaterAverage = () => {
    if (!waterEntries30Days?.length) return 0;
    
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentEntries = waterEntries30Days.filter(entry => 
      new Date(entry.date) >= sevenDaysAgo
    );
    
    if (recentEntries.length === 0) return 0;
    
    const totalWater = recentEntries.reduce((sum, entry) => sum + entry.amount, 0);
    
    // Get number of unique days with entries
    const uniqueDays = new Set(recentEntries.map(entry => 
      new Date(entry.date).toISOString().split('T')[0]
    )).size;
    
    return Math.round(totalWater / uniqueDays) || 0;
  };

  const nutritionAverages = calculateNutritionAverages();
  const waterAverage = calculateWaterAverage();

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Diet Stats & Streaks</h1>
        <ProfileUpdate userId={user?.id} user={user} />
      </div>
      
      {/* Weekly Averages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlameIcon className="h-5 w-5 text-orange-500" />
              Nutrition (7-day avg)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Calories</span>
                <span className="font-medium">{nutritionAverages.calories} kcal</span>
              </div>
              <Progress value={
                user?.preferences?.dailyCalorieGoal
                  ? (nutritionAverages.calories / user.preferences.dailyCalorieGoal) * 100
                  : 50
              } />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Protein</span>
                <p className="font-medium">{nutritionAverages.protein}g</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Carbs</span>
                <p className="font-medium">{nutritionAverages.carbs}g</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Fat</span>
                <p className="font-medium">{nutritionAverages.fat}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DropletIcon className="h-5 w-5 text-blue-500" />
              Water Intake (7-day avg)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Daily Water</span>
                <span className="font-medium">{waterAverage} ml</span>
              </div>
              <Progress value={
                user?.preferences?.waterGoal
                  ? (waterAverage / user.preferences.waterGoal) * 100
                  : 50
              } />
            </div>
            
            <div className="pt-2">
              {user?.preferences?.waterGoal ? (
                <p className="text-sm text-muted-foreground">
                  {waterAverage < user.preferences.waterGoal 
                    ? `${user.preferences.waterGoal - waterAverage} ml below your daily goal`
                    : `${waterAverage - user.preferences.waterGoal} ml above your daily goal`
                  }
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Set a water goal in your preferences</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Streak Cards */}
      <h2 className="text-xl font-bold mt-6 mb-3">Your Streaks</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {user?.preferences?.dietPlan && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {getDietIcon()}
                Diet Plan Streak
              </CardTitle>
              <CardDescription>
                {user?.preferences?.dietPlan 
                  ? `${user.preferences.dietPlan.charAt(0).toUpperCase() + user.preferences.dietPlan.slice(1)} diet`
                  : "No diet plan selected"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{streaks.current.diet}</p>
                  <p className="text-muted-foreground text-sm">Current days</p>
                </div>
                <div>
                  <p className="text-xl font-semibold">{streaks.longest.diet}</p>
                  <p className="text-muted-foreground text-sm">Longest streak</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DropletIcon className="h-5 w-5 text-blue-500" />
              Water Tracking
            </CardTitle>
            <CardDescription>
              Daily water intake logging
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{streaks.current.water}</p>
                <p className="text-muted-foreground text-sm">Current days</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{streaks.longest.water}</p>
                <p className="text-muted-foreground text-sm">Longest streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-green-500" />
              Logging Streak
            </CardTitle>
            <CardDescription>
              Days with any nutrition tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{streaks.current.logging}</p>
                <p className="text-muted-foreground text-sm">Current days</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{streaks.longest.logging}</p>
                <p className="text-muted-foreground text-sm">Longest streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* If no diet plan is selected, show recommendation */}
      {!user?.preferences?.dietPlan && (
        <Card className="mt-4 border-dashed">
          <CardHeader>
            <CardTitle>Choose a Diet Plan</CardTitle>
            <CardDescription>
              Select a diet plan on the dashboard to track your adherence streak and get diet-specific recommendations.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      {/* Profile Information Display */}
      {user?.preferences?.profile && Object.keys(user.preferences.profile).some(key => !!user.preferences.profile?.[key as keyof typeof user.preferences.profile]) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5 text-purple-500" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your personal stats help us provide better recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {user.preferences.profile.weight && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Weight</span>
                  <p className="font-medium">{user.preferences.profile.weight} kg</p>
                </div>
              )}
              
              {user.preferences.profile.height && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Height</span>
                  <p className="font-medium">{user.preferences.profile.height} cm</p>
                </div>
              )}
              
              {user.preferences.profile.gender && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Gender</span>
                  <p className="font-medium">{user.preferences.profile.gender.charAt(0).toUpperCase() + user.preferences.profile.gender.slice(1)}</p>
                </div>
              )}
              
              {user.preferences.profile.age && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Age</span>
                  <p className="font-medium">{user.preferences.profile.age} years</p>
                </div>
              )}
              
              {user.preferences.profile.fitnessLevel && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Fitness Level</span>
                  <p className="font-medium">{user.preferences.profile.fitnessLevel.charAt(0).toUpperCase() + user.preferences.profile.fitnessLevel.slice(1)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}