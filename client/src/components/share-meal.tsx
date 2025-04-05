import { useState, useRef } from "react";
import { useNostrContext } from "@/contexts/NostrContext";
import { Camera, Image, Send, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { usePlatform } from "@/hooks/use-mobile";
import { User } from "@shared/schema";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { takeCameraPhoto, checkCameraPermissions, requestCameraPermissions } from "@/utils/camera";

interface ShareMealProps {
  user?: User;
  onClose?: () => void;
  dietPlan?: string;
  streak?: number;
}

export default function ShareMeal({ user, onClose, dietPlan: propDietPlan, streak: propStreak }: ShareMealProps) {
  const [caption, setCaption] = useState("");
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const { isNative, isAndroid, isIOS } = usePlatform();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const { ndk, userPubkey } = useNostrContext();
  
  // Use props if provided, otherwise fallback to user object
  const dietPlan = propDietPlan || user?.preferences?.dietPlan || "healthy eating";
  const streak = propStreak ?? user?.preferences?.streak ?? 0;

  // Setup camera stream
  const startCamera = async () => {
    try {
      if (isNative) {
        // Use Capacitor Camera API for native apps
        handleNativeCamera();
        return;
      }
      
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  // Handle camera capture for native apps
  const handleNativeCamera = async () => {
    try {
      // Check camera permissions
      const hasPermission = await checkCameraPermissions();
      
      if (!hasPermission) {
        // Request permissions if not granted
        const granted = await requestCameraPermissions();
        if (!granted) {
          toast({
            title: "Permission Required",
            description: "Camera permission is needed to take photos.",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Use our utility function to take a photo
      const photo = await takeCameraPhoto();
      
      if (photo) {
        setPhotoSrc(photo);
      } else {
        // Fall back to file input if camera fails
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    } catch (error) {
      console.error("Error with native camera:", error);
      toast({
        title: "Camera Error",
        description: "Could not access device camera.",
        variant: "destructive",
      });
      
      // Fall back to file input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  // Handle file selection from device
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoSrc(e.target?.result as string);
        setShowCamera(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Take photo from camera stream
  const takePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    
    if (ctx && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setPhotoSrc(dataUrl);
      setShowCamera(false);
      
      // Stop the camera stream
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  // Reset the photo
  const resetPhoto = () => {
    setPhotoSrc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Post to Nostr
  const postToNostrMutation = useMutation({
    mutationFn: async () => {
      if (!ndk || !userPubkey) {
        throw new Error("Not connected to Nostr");
      }

      // Create a new Nostr event
      const event = new NDKEvent(ndk);
      event.kind = 1; // Regular note
      
      // Add tags
      event.tags = [
        ["t", "dietstr"],
        ["t", "food"],
        ["t", "diet"]
      ];
      
      // Add diet plan tag if available
      if (dietPlan) {
        event.tags.push(["t", dietPlan.replace(/\s+/g, '')]);
      }
      
      // Prepare caption
      let content = caption || "My meal today";
      
      // Add diet info and streak
      content += `\n\nDiet plan: ${dietPlan}`;
      if (streak > 0) {
        content += `\nCurrent streak: ${streak} days`;
      }
      content += `\n\n#dietstr #food #diet`;
      if (dietPlan) {
        content += ` #${dietPlan.replace(/\s+/g, '')}`;
      }
      
      // If we have an image, encode it
      if (photoSrc) {
        // Extract base64 data from dataURL by removing the prefix
        let imageData = photoSrc;
        if (imageData.includes('base64,')) {
          imageData = imageData.split('base64,')[1];
        }
        
        // Add image URL to content
        event.tags.push(["image", imageData]);
      }
      
      event.content = content;
      
      // Sign and publish the event
      if (window.nostr) {
        // Use extension to sign
        try {
          const signedEvent = await window.nostr.signEvent(event.rawEvent());
          event.sig = signedEvent.sig;
          await event.publish();
          return true;
        } catch (error) {
          console.error("Error signing with extension:", error);
          throw new Error("Failed to sign with extension");
        }
      } else {
        // Fallback to direct publishing if user has a private key
        try {
          await event.publish();
          return true;
        } catch (error) {
          console.error("Error publishing:", error);
          throw new Error("Failed to publish");
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Meal shared!",
        description: "Your meal has been posted to Nostr.",
      });
      
      // Reset form
      setCaption("");
      setPhotoSrc(null);
      
      // Close the modal if needed
      if (onClose) {
        onClose();
      }
    },
    onError: (error) => {
      toast({
        title: "Error sharing meal",
        description: error.message || "Failed to post to Nostr",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Share Meal to Nostr</span>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCamera ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="h-full w-full object-cover"
            />
            <Button 
              onClick={takePhoto}
              className="absolute bottom-2 left-1/2 transform -translate-x-1/2"
              size="lg"
            >
              Take Photo
            </Button>
          </div>
        ) : photoSrc ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
            <img 
              src={photoSrc} 
              alt="Meal preview" 
              className="h-full w-full object-cover" 
            />
            <Button 
              variant="destructive" 
              size="icon"
              className="absolute top-2 right-2 rounded-full"
              onClick={resetPhoto}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div 
            className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-md text-center"
            onClick={startCamera}
          >
            <div className="p-4 bg-muted rounded-full">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Take a photo of your meal</p>
              <p className="text-xs text-muted-foreground">
                Click to {isNative ? "open camera" : "take a photo"}
              </p>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />
          </div>
        )}

        <Textarea
          placeholder="Add a caption to your meal..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="min-h-[100px] resize-none"
        />

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Your post will include:</p>
          <ul className="list-disc pl-5">
            <li>Dietstr hashtag</li>
            {dietPlan && <li>Diet plan: {dietPlan}</li>}
            {streak > 0 && <li>Current streak: {streak} days</li>}
          </ul>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end">
        <Button 
          disabled={
            postToNostrMutation.isPending || 
            (!photoSrc && !caption) ||
            !userPubkey
          }
          onClick={() => postToNostrMutation.mutate()}
          className="space-x-2"
        >
          {postToNostrMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Posting...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Share to Nostr</span>
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}