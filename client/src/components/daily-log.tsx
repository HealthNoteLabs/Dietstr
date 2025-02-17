import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import FoodEntry from "./food-entry";
import type { FoodEntry as FoodEntryType } from "@shared/schema";

interface DailyLogProps {
  userId?: number;
  date: Date;
  onDateChange: (date: Date) => void;
}

export default function DailyLog({ userId, date, onDateChange }: DailyLogProps) {
  const [isAddingFood, setIsAddingFood] = useState(false);

  const { data: entries = [] } = useQuery<FoodEntryType[]>({
    queryKey: [`/api/food-entries`, { userId, date: date.toISOString() }],
    enabled: !!userId,
  });

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Daily Log</h2>
        <Dialog open={isAddingFood} onOpenChange={setIsAddingFood}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Food
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Food Entry</DialogTitle>
            </DialogHeader>
            {userId && (
              <FoodEntry
                userId={userId}
                date={date}
                onSuccess={() => setIsAddingFood(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Calendar
        mode="single"
        selected={date}
        onSelect={(date) => date && onDateChange(date)}
        className="rounded-md border"
      />

      <div className="space-y-6">
        {mealTypes.map((mealType) => {
          const mealEntries = entries.filter(
            (entry) => entry.mealType === mealType
          );

          return (
            <div key={mealType} className="space-y-2">
              <h3 className="font-medium capitalize">{mealType}</h3>
              {mealEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries yet</p>
              ) : (
                <div className="space-y-2">
                  {mealEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center p-2 rounded-lg bg-secondary"
                    >
                      <div>
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-sm text-muted-foreground">
                          P: {entry.protein}g | C: {entry.carbs}g | F: {entry.fat}g
                        </p>
                      </div>
                      <p className="font-medium">{entry.calories} kcal</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
