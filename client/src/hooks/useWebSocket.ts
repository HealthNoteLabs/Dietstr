import { useEffect, useCallback, useState, useRef } from 'react';
import { webSocketService, type MessageHandler } from '../services/websocket';

/**
 * Hook to interact with the WebSocket service
 * @param topics Optional array of topics to subscribe to
 * @returns WebSocket utilities and connection state
 */
export function useWebSocket(topics: string[] = []) {
  const [isConnected, setIsConnected] = useState(false);
  const initializedRef = useRef(false);
  
  useEffect(() => {
    // Initialize websocket connection if not already done
    if (!initializedRef.current) {
      webSocketService.init();
      initializedRef.current = true;
    }
    
    // Subscribe to topics
    topics.forEach(topic => {
      webSocketService.subscribe(topic);
    });
    
    // Setup connection status listener
    const connectionHandler: MessageHandler = (data) => {
      // Server sends either 'connected: true' or status: 'connected'
      setIsConnected(data.connected || data.status === 'connected');
    };
    
    webSocketService.on('connection', connectionHandler);
    
    // Clean up
    return () => {
      webSocketService.off('connection', connectionHandler);
    };
  }, [topics]);
  
  /**
   * Subscribe to a WebSocket message type
   */
  const subscribe = useCallback((messageType: string, handler: MessageHandler) => {
    webSocketService.on(messageType, handler);
    
    // Return unsubscribe function
    return () => {
      webSocketService.off(messageType, handler);
    };
  }, []);
  
  /**
   * Send a message through WebSocket
   */
  const send = useCallback((message: any) => {
    return webSocketService.send(message);
  }, []);
  
  /**
   * Send a Nostr event to the server
   */
  const sendNostrEvent = useCallback((event: any) => {
    return webSocketService.sendNostrEvent(event);
  }, []);
  
  return {
    isConnected,
    subscribe,
    send,
    sendNostrEvent
  };
}