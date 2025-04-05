import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share } from "lucide-react";
import ShareMeal from "./share-meal";
import { User } from "@shared/schema";
import { useState } from "react";

interface ShareMealModalProps {
  user?: User;
  buttonText?: string;
  showIcon?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  dietPlan?: string;
  streak?: number;
}

export default function ShareMealModal({
  user,
  buttonText = "Share Meal",
  showIcon = true,
  variant = "default",
  size = "default",
  dietPlan,
  streak
}: ShareMealModalProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={showIcon ? "gap-2" : ""}>
          {showIcon && <Share className="h-4 w-4" />}
          {size !== "icon" && buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <ShareMeal user={user} dietPlan={dietPlan} streak={streak} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}