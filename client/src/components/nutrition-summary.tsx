import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FoodEntry } from "@shared/schema";

interface NutritionSummaryProps {
  userId?: number;
  date: Date;
  goals?: {
    protein: number;
    carbs: number;
    fat: number;
  };
  calorieGoal?: number;
}

export default function NutritionSummary({
  userId,
  date,
  goals,
  calorieGoal = 2000,
}: NutritionSummaryProps) {
  const { data: entries = [] } = useQuery<FoodEntry[]>({
    queryKey: [`/api/food-entries`, { userId, date: date.toISOString() }],
    enabled: !!userId,
  });

  const totals = entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + (entry.calories || 0),
      protein: acc.protein + (entry.protein || 0),
      carbs: acc.carbs + (entry.carbs || 0),
      fat: acc.fat + (entry.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const macros = [
    {
      label: "Protein",
      value: totals.protein,
      goal: goals?.protein || 50,
      color: "bg-blue-500",
    },
    {
      label: "Carbs",
      value: totals.carbs,
      goal: goals?.carbs || 250,
      color: "bg-green-500",
    },
    {
      label: "Fat",
      value: totals.fat,
      goal: goals?.fat || 70,
      color: "bg-yellow-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Calories</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold">{totals.calories}</span>
          <span className="text-sm text-muted-foreground">
            of {calorieGoal} kcal
          </span>
        </div>
        <Progress
          value={(totals.calories / calorieGoal) * 100}
          className="h-2"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Macronutrients</h2>
        <div className="grid gap-4">
          {macros.map((macro) => (
            <div key={macro.label}>
              <div className="flex justify-between text-sm mb-1">
                <span>{macro.label}</span>
                <span className="text-muted-foreground">
                  {macro.value}g / {macro.goal}g
                </span>
              </div>
              <Progress
                value={(macro.value / macro.goal) * 100}
                className={`h-2 ${macro.color}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
