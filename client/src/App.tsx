import { useEffect, useState, createContext, useContext } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { 
  isNativeApp, 
  isAndroid, 
  isIOS, 
  registerAppListeners,
  registerAppUrlOpenHandler
} from "./capacitor";
import { usePlatform } from "./hooks/use-mobile";
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Create a platform context to share platform info with all components
type PlatformContextType = {
  isNative: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isMobileWeb: boolean;
};

const PlatformContext = createContext<PlatformContextType>({
  isNative: false,
  isAndroid: false,
  isIOS: false,
  isMobileWeb: false,
});

// Hook to access platform information throughout the app
export const usePlatformContext = () => useContext(PlatformContext);

function Router() {
  const [, setLocation] = useLocation();
  const platform = usePlatformContext();

  // Handle deep links when app is opened with specific URLs
  useEffect(() => {
    if (platform.isNative) {
      const cleanup = registerAppUrlOpenHandler((url) => {
        // Extract path from the URL and navigate to it
        try {
          const parsedUrl = new URL(url);
          const path = parsedUrl.pathname;
          setLocation(path);
        } catch (error) {
          console.error('Failed to parse deep link URL:', error);
        }
      });
      
      return cleanup;
    }
  }, [platform.isNative, setLocation]);

  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const platform = usePlatform();
  const [location, setLocation] = useLocation();
  const [appReady, setAppReady] = useState(false);

  // Setup native app capabilities
  useEffect(() => {
    // Initialize native app features
    const initNativeApp = async () => {
      if (platform.isNative) {
        try {
          // Set status bar style based on theme
          if (platform.isAndroid) {
            await StatusBar.setBackgroundColor({ color: '#ffffff' });
            await StatusBar.setStyle({ style: StatusBarStyle.Dark });
          } else if (platform.isIOS) {
            await StatusBar.setStyle({ style: StatusBarStyle.Dark });
          }
          
          // Listen for app lifecycle events
          const cleanup = registerAppListeners(
            // Resume
            () => {
              // Refresh data when app comes back to foreground
              queryClient.refetchQueries();
            },
            // Pause
            () => {
              // App going to background
              console.log('App paused');
            },
            // Back button (Android)
            () => {              
              // If we're not on the home screen, go back instead of exiting
              if (location !== '/') {
                setLocation('/');
                return true; // Prevent default behavior
              }
              
              // Default behavior (exit app)
              return false;
            }
          );
          
          // Hide splash screen with short delay to ensure UI is ready
          setTimeout(() => {
            SplashScreen.hide();
            setAppReady(true);
          }, 300);
          
          return cleanup;
        } catch (error) {
          console.error('Error initializing native features:', error);
          setAppReady(true);
        }
      } else {
        // Not a native app, mark as ready immediately
        setAppReady(true);
      }
    };
    
    initNativeApp();
  }, [platform.isNative, platform.isAndroid, platform.isIOS]);

  // Provide platform context to all components
  return (
    <PlatformContext.Provider value={platform}>
      <QueryClientProvider client={queryClient}>
        <div className={`app-container ${platform.isNative ? 'mobile-container pb-safe' : ''}`}>
          {/* Show app content when ready, could add a loading spinner here */}
          {appReady && (
            <>
              <Router />
              <Toaster />
            </>
          )}
        </div>
      </QueryClientProvider>
    </PlatformContext.Provider>
  );
}

export default App;
