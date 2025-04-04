import * as React from "react"
import { isNativeApp, isAndroid, isIOS } from "../capacitor"

const MOBILE_BREAKPOINT = 768

/**
 * Hook to detect if the current device is mobile (either by screen size or because it's a native app)
 * @returns Whether the current device is considered mobile
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // If running as a native app, we're definitely on mobile
    if (isNativeApp()) {
      setIsMobile(true)
      return
    }

    // Otherwise, use responsive breakpoint
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/**
 * Hook to detect the platform we're running on
 * @returns Object with platform detection flags
 */
export function usePlatform() {
  const [platform, setPlatform] = React.useState({
    isNative: false,
    isAndroid: false,
    isIOS: false,
    isMobileWeb: false,
  })

  React.useEffect(() => {
    const native = isNativeApp()
    const android = isAndroid()
    const ios = isIOS()
    
    // Check if it's mobile web but not a native app
    const mobileWeb = !native && window.innerWidth < MOBILE_BREAKPOINT
    
    setPlatform({
      isNative: native,
      isAndroid: android,
      isIOS: ios,
      isMobileWeb: mobileWeb,
    })
    
    // Add platform-specific classes to document for CSS targeting
    if (native) {
      document.documentElement.classList.add('native-app')
      
      if (android) {
        document.documentElement.classList.add('android-app')
      }
      
      if (ios) {
        document.documentElement.classList.add('ios-app')
      }
    } else if (mobileWeb) {
      document.documentElement.classList.add('mobile-web')
    }
    
    // Responsive handler
    if (!native) {
      const handleResize = () => {
        const newMobileWeb = window.innerWidth < MOBILE_BREAKPOINT
        
        if (newMobileWeb !== mobileWeb) {
          setPlatform(prev => ({
            ...prev,
            isMobileWeb: newMobileWeb
          }))
          
          if (newMobileWeb) {
            document.documentElement.classList.add('mobile-web')
          } else {
            document.documentElement.classList.remove('mobile-web')
          }
        }
      }
      
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  return platform
}

/**
 * Hook to listen for back button presses on Android
 * @param callback Function to call when back button is pressed
 */
export function useAndroidBackButton(callback: () => boolean) {
  React.useEffect(() => {
    // Only register if this is an Android device
    if (!isAndroid()) return
    
    const handleBackButton = () => {
      return callback()
    }
    
    // Use the native Android back button API
    document.addEventListener('ionBackButton', (ev: any) => {
      // Prevent default if our callback returns true
      if (handleBackButton()) {
        ev.detail.register(10, () => {
          // Do nothing, preventing default
        })
      }
    })
  }, [callback])
}

/**
 * Hook to add safe area insets as CSS variables
 * Use these variables in your CSS like:
 * padding-top: var(--safe-area-top);
 */
export function useSafeAreaInsets() {
  React.useEffect(() => {
    if (!isNativeApp()) return
    
    // Get safe area insets
    const getSafeAreaInsets = () => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      
      // Store inset values as CSS variables
      root.style.setProperty(
        '--safe-area-top', 
        computedStyle.getPropertyValue('--ion-safe-area-top') || '0px'
      )
      root.style.setProperty(
        '--safe-area-right', 
        computedStyle.getPropertyValue('--ion-safe-area-right') || '0px'
      )
      root.style.setProperty(
        '--safe-area-bottom', 
        computedStyle.getPropertyValue('--ion-safe-area-bottom') || '0px'
      )
      root.style.setProperty(
        '--safe-area-left', 
        computedStyle.getPropertyValue('--ion-safe-area-left') || '0px'
      )
    }
    
    // Read insets when component mounts
    getSafeAreaInsets()
    
    // Update on orientation change
    window.addEventListener('resize', getSafeAreaInsets)
    return () => window.removeEventListener('resize', getSafeAreaInsets)
  }, [])
}
