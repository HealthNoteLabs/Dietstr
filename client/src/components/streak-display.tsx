import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO, differenceInDays } from "date-fns";
import { CalendarDaysIcon, FireIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StreakDisplayProps {
  streak?: number;
  streakStartDate?: string;
  dietPlan?: string;
}

export default function StreakDisplay({ streak = 0, streakStartDate, dietPlan }: StreakDisplayProps) {
  // Get a natural language version of the streak start date
  const formatStartDate = () => {
    if (!streakStartDate) return "Not started yet";
    
    try {
      const date = parseISO(streakStartDate);
      return format(date, "MMMM d, yyyy");
    } catch (e) {
      return "Invalid date";
    }
  };
  
  // Calculate number of days since streak start
  const calculateDaysSinceStart = () => {
    if (!streakStartDate) return 0;
    
    try {
      const startDate = parseISO(streakStartDate);
      return differenceInDays(new Date(), startDate);
    } catch (e) {
      return 0;
    }
  };
  
  // Determine the streak status message
  const getStreakMessage = () => {
    if (!dietPlan) return "No diet plan selected";
    if (streak <= 0) return "Start your streak today!";
    
    if (streak < 3) return "Just getting started!";
    if (streak < 7) return "Great start! Keep going!";
    if (streak < 14) return "Impressive dedication!";
    if (streak < 30) return "You're building a habit!";
    if (streak < 60) return "Remarkable discipline!";
    return "Extraordinary commitment!";
  };
  
  // Get color for streak badge based on streak length
  const getStreakColor = () => {
    if (streak < 3) return "bg-blue-500";
    if (streak < 7) return "bg-green-500";
    if (streak < 14) return "bg-yellow-500";
    if (streak < 30) return "bg-orange-500";
    return "bg-red-500";
  };
  
  // Get a tip based on the streak
  const getTip = () => {
    if (!dietPlan) return "Select a diet plan to start tracking your streak";
    if (streak < 3) return "The first few days are the hardest. Take it one meal at a time!";
    if (streak < 7) return "You're past the toughest part! Make a plan for challenging situations.";
    if (streak < 14) return "Your body is adapting! Notice any changes in how you feel?";
    if (streak < 30) return "You're forming a habit now! Consider taking progress photos.";
    return "You've made significant changes! Share your journey to inspire others.";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FireIcon className="h-5 w-5 text-orange-500" />
          Diet Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Current streak</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{streak}</span>
              <span className="text-xl font-medium text-muted-foreground">days</span>
            </div>
          </div>
          
          {dietPlan && (
            <Badge className={`text-white ${getStreakColor()} px-3 py-1.5`}>
              {dietPlan.charAt(0).toUpperCase() + dietPlan.slice(1)}
            </Badge>
          )}
        </div>
        
        {dietPlan && streak > 0 && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <CalendarDaysIcon className="h-4 w-4" />
              Started on:
            </span>
            <span className="text-sm font-medium">{formatStartDate()}</span>
          </div>
        )}
        
        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground">{getTip()}</p>
        </div>
      </CardContent>
    </Card>
  );
}