import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { usePlatformContext } from '../App';

export function Navigation() {
  const [location] = useLocation();
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
  
  return (
    <nav className={`p-4 ${platform.isNative ? 'pt-safe' : ''} bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/60 z-50 w-full border-b shadow-sm`}>
      <div className="flex items-center justify-between container mx-auto">
        <Link href="/">
          <div className="font-bold text-xl cursor-pointer select-none">Dietstr</div>
        </Link>
        
        <div className="flex space-x-1">
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
        </div>
      </div>
    </nav>
  );
}