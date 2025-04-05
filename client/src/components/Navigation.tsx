import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { usePlatformContext } from '../App';
import { LogOut } from 'lucide-react';
import { isNativeApp, removePreference } from '../capacitor';

export function Navigation() {
  const [location, setLocation] = useLocation();
  const platform = usePlatformContext();
  
  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/feed', label: 'Feed' },
    { href: '/groups', label: 'Groups' },
  ];
  
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location === path;
    }
    // For other paths, check if location starts with the path
    return location.startsWith(path);
  };

  const handleLogout = async () => {
    if (isNativeApp()) {
      // Remove stored key if on native app
      await removePreference("nostr_nsec");
    }
    localStorage.removeItem("privateKey");
    setLocation("/");
  };
  
  return (
    <nav className={`p-4 ${platform.isNative ? 'pt-safe' : ''} bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/60 z-50 w-full border-b shadow-sm`}>
      <div className="flex items-center justify-between container mx-auto">
        <Link href="/">
          <div className="font-bold text-xl cursor-pointer select-none">Dietstr</div>
        </Link>
        
        <div className="flex space-x-1 items-center">
          {links.map(link => (
            <Button 
              key={link.href} 
              variant={isActive(link.href) ? 'default' : 'ghost'} 
              asChild
            >
              <Link href={link.href}>
                {link.label}
              </Link>
            </Button>
          ))}
          
          <Button variant="ghost" size="icon" onClick={handleLogout} className="ml-2">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}