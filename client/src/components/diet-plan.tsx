import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Utensils, Flame, Salad, Beef } from "lucide-react";

type DietPlanType = 'carnivore' | 'keto' | 'fasting' | 'animal-based' | undefined;

interface DietPlanProps {
  userId?: number;
  user?: User;
}

interface DietInfo {
  title: string;
  description: string;
  benefits: string[];
  foods: string[];
  avoid: string[];
  icon: React.ReactNode;
}

export default function DietPlan({ userId, user }: DietPlanProps) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<DietPlanType>(
    user?.preferences?.dietPlan || undefined
  );
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when user preferences change
  useEffect(() => {
    if (user?.preferences?.dietPlan) {
      setSelectedPlan(user.preferences.dietPlan);
    }
  }, [user?.preferences?.dietPlan]);

  const dietPlans: Record<string, DietInfo> = {
    'carnivore': {
      title: 'Carnivore Diet',
      description: 'An all-animal product diet that excludes all plant foods.',
      benefits: [
        'May reduce inflammation',
        'Potential weight loss',
        'Simplified food choices',
        'Possible improvement in certain autoimmune conditions'
      ],
      foods: [
        'Meat (beef, lamb, pork, etc.)',
        'Poultry (chicken, turkey, etc.)',
        'Fish and seafood',
        'Eggs',
        'Animal fats',
        'Dairy (for some versions)'
      ],
      avoid: [
        'All plant foods including vegetables',
        'Fruits and berries',
        'Nuts and seeds',
        'Grains and legumes',
        'Plant oils'
      ],
      icon: <Beef className="h-8 w-8 text-red-500" />
    },
    'keto': {
      title: 'Ketogenic Diet',
      description: 'A high-fat, low-carbohydrate diet designed to induce ketosis.',
      benefits: [
        'May aid weight loss',
        'Potential improvement in blood sugar control',
        'Increased mental clarity for some',
        'Reduced hunger and appetite'
      ],
      foods: [
        'Fatty meats and fish',
        'Full-fat dairy',
        'Avocados',
        'Low-carb vegetables',
        'Nuts and seeds',
        'Healthy oils'
      ],
      avoid: [
        'Grains and starches',
        'Most fruits',
        'Legumes',
        'Root vegetables',
        'Sugar and sweetened foods',
        'Alcohol'
      ],
      icon: <Flame className="h-8 w-8 text-orange-500" />
    },
    'fasting': {
      title: 'Intermittent Fasting',
      description: 'An eating pattern that cycles between periods of fasting and eating.',
      benefits: [
        'May help with weight loss',
        'Potential reduction in insulin resistance',
        'Possible cellular repair processes',
        'Simplifies daily routine'
      ],
      foods: [
        'Whole foods during eating windows',
        'Protein-rich foods',
        'Healthy fats',
        'Vegetables and fruits',
        'Water, tea, and coffee during fasting periods (no calories)'
      ],
      avoid: [
        'Any calories during fasting periods',
        'Processed foods (recommended)',
        'Excessive eating during feeding windows'
      ],
      icon: <Utensils className="h-8 w-8 text-blue-500" />
    },
    'animal-based': {
      title: 'Animal-Based Diet',
      description: 'A diet centered around animal products but includes some fruits and honey.',
      benefits: [
        'Rich in bioavailable nutrients',
        'May improve digestive issues',
        'Potential hormonal benefits',
        'Emphasis on nutrient density'
      ],
      foods: [
        'Meat and organ meats',
        'Fish and seafood',
        'Eggs',
        'Raw dairy (if tolerated)',
        'Honey',
        'Low-toxicity fruits',
        'Animal fats'
      ],
      avoid: [
        'Most plant foods, especially legumes',
        'Grains',
        'Seed oils',
        'Processed foods',
        'Industrial foods'
      ],
      icon: <Salad className="h-8 w-8 text-green-500" />
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    
    setIsSaving(true);
    
    try {
      // Get current user preferences
      const currentPreferences = user?.preferences || {};
      
      // Update with new diet plan
      // If diet plan is different, reset streak; otherwise maintain it
      const isNewDietPlan = currentPreferences.dietPlan !== selectedPlan;
      const now = new Date().toISOString();
      
      const updatedPreferences = {
        ...currentPreferences,
        dietPlan: selectedPlan,
        // If it's a new diet plan, reset streak to 1 (day 1), otherwise keep the existing streak
        streak: isNewDietPlan ? 1 : (currentPreferences.streak || 1),
        // If it's a new diet plan, set the streak start date to today
        streakStartDate: isNewDietPlan ? now : (currentPreferences.streakStartDate || now)
      };
      
      // Send update to server
      await apiRequest(`/api/users/${user?.pubkey}/preferences`, 'PUT', {
        preferences: updatedPreferences
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.pubkey}`] });
      
      toast({
        title: "Diet Plan Updated",
        description: selectedPlan 
          ? `Your diet plan has been set to ${dietPlans[selectedPlan].title}.` 
          : "Your diet plan preference has been cleared.",
      });
    } catch (error) {
      console.error("Failed to update diet plan:", error);
      toast({
        title: "Update Failed",
        description: "There was a problem updating your diet plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            {selectedPlan && dietPlans[selectedPlan].icon}
            Diet Plan
          </CardTitle>
          <CardDescription>
            Select a diet plan to track and receive recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedPlan}
            onValueChange={(value) => setSelectedPlan(value as DietPlanType)}
            className="space-y-3"
          >
            {Object.entries(dietPlans).map(([key, plan]) => (
              <div key={key} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50">
                <RadioGroupItem value={key} id={`plan-${key}`} />
                <div className="flex items-center gap-2">
                  {plan.icon}
                  <Label htmlFor={`plan-${key}`} className="font-medium">
                    {plan.title}
                  </Label>
                </div>
              </div>
            ))}
          </RadioGroup>
          
          <Button 
            onClick={handleSave}
            disabled={isSaving || !userId || selectedPlan === user?.preferences?.dietPlan}
            className="mt-4 w-full"
          >
            {isSaving ? "Saving..." : "Save Diet Plan"}
          </Button>
        </CardContent>
      </Card>
      
      {selectedPlan && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {dietPlans[selectedPlan].icon}
              <CardTitle>{dietPlans[selectedPlan].title}</CardTitle>
            </div>
            <CardDescription>
              {dietPlans[selectedPlan].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Benefits</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {dietPlans[selectedPlan].benefits.map((benefit, index) => (
                    <li key={index}>{benefit}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Recommended Foods</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {dietPlans[selectedPlan].foods.map((food, index) => (
                    <li key={index}>{food}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Foods to Avoid</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {dietPlans[selectedPlan].avoid.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}