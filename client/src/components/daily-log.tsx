import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FoodEntry from "./food-entry";
import WaterTracker from "./water-tracker";
import DailyNotes from "./daily-notes";
import ShareMeal from "./share-meal";
import { addDays, format, subDays, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface DailyLogProps {
  userId?: number;
  date: Date;
  onDateChange: (date: Date) => void;
}

export default function DailyLog({ userId, date, onDateChange }: DailyLogProps) {
  const [activeTab, setActiveTab] = useState("food");
  const { user } = useAuth();
  
  const handlePreviousDay = () => {
    onDateChange(subDays(date, 1));
  };

  const handleNextDay = () => {
    // Don't allow future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (addDays(date, 1) <= today) {
      onDateChange(addDays(date, 1));
    }
  };

  const isTodayOrFuture = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);
    return currentDate >= today;
  };

  // Calculate streak (simple implementation)
  const calculateStreak = (): number => {
    // This is a placeholder - in a real app, you'd calculate this based on 
    // continuous days of logging or adhering to the diet plan
    return user?.preferences?.streak || 0;
  };

  // Get user's diet plan
  const getDietPlan = (): string | undefined => {
    return user?.preferences?.dietPlan;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={handlePreviousDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">
          {format(date, "EEEE, MMMM d")}
        </h2>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleNextDay}
          disabled={isTodayOrFuture()}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="food">Food Log</TabsTrigger>
          <TabsTrigger value="water">Water</TabsTrigger>
          <TabsTrigger value="share">Share</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="food" className="space-y-4">
          <FoodEntry 
            userId={userId || 0} 
            date={date}
            onSuccess={() => {}} 
          />
        </TabsContent>
        
        <TabsContent value="water" className="space-y-4">
          <WaterTracker 
            userId={userId} 
            date={date}
            goal={8} 
          />
        </TabsContent>
        
        <TabsContent value="share" className="space-y-4">
          <ShareMeal
            dietPlan={getDietPlan()}
            streak={calculateStreak()}
          />
        </TabsContent>
        
        <TabsContent value="notes" className="space-y-4">
          <DailyNotes
            userId={userId}
            date={date}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}