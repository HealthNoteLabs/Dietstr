import { useMutation, useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Droplets } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WaterEntry } from "@shared/schema";

interface WaterTrackerProps {
  userId?: number;
  date: Date;
  goal: number;
}

export default function WaterTracker({ userId, date, goal }: WaterTrackerProps) {
  const { data: entries = [] } = useQuery<WaterEntry[]>({
    queryKey: [`/api/water-entries`, { userId, date: date.toISOString() }],
    enabled: !!userId,
  });

  const totalWater = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const progress = Math.min((totalWater / goal) * 100, 100);

  const mutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!userId) return;
      await apiRequest("POST", "/api/water-entries", {
        userId,
        amount,
        date,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/water-entries"] });
    },
  });

  const addWater = (amount: number) => {
    mutation.mutate(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Droplets className="h-5 w-5" />
          Water Intake
        </h2>
        <span className="text-sm text-muted-foreground">
          {totalWater}ml / {goal}ml
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex gap-2 justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => addWater(250)}
          disabled={mutation.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          250ml
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addWater(500)}
          disabled={mutation.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          500ml
        </Button>
      </div>
    </div>
  );
}
