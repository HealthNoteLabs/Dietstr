/**
 * WebSocket service for real-time updates
 * 
 * This service manages connections to the WebSocket server
 * and provides an event-based system for handling messages.
 */

// Event handlers by message type
type MessageHandler = (data: any) => void;
type MessageHandlers = Record<string, MessageHandler[]>;

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectInterval = 3000; // 3 seconds
  private subscriptions: string[] = [];
  private messageHandlers: MessageHandlers = {};
  
  /**
   * Initialize the WebSocket connection
   */
  public init() {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket server at ${wsUrl}`);
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.addEventListener('open', this.handleOpen);
    this.socket.addEventListener('message', this.handleMessage);
    this.socket.addEventListener('close', this.handleClose);
    this.socket.addEventListener('error', this.handleError);
    
    return this;
  }
  
  /**
   * Subscribe to a topic or multiple topics
   */
  public subscribe(topics: string | string[]) {
    const topicsArray = Array.isArray(topics) ? topics : [topics];
    
    // Add new topics to our subscription list
    let hasNewTopics = false;
    topicsArray.forEach(topic => {
      if (!this.subscriptions.includes(topic)) {
        this.subscriptions.push(topic);
        hasNewTopics = true;
      }
    });
    
    // If already connected and we have new topics, send subscription
    if (hasNewTopics && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'subscribe',
        topics: this.subscriptions
      }));
      console.log(`Subscribed to topics: ${this.subscriptions.join(', ')}`);
    }
    
    return this;
  }
  
  /**
   * Add an event handler for a specific message type
   */
  public on(type: string, handler: MessageHandler) {
    if (!this.messageHandlers[type]) {
      this.messageHandlers[type] = [];
    }
    
    this.messageHandlers[type].push(handler);
    return this;
  }
  
  /**
   * Remove an event handler
   */
  public off(type: string, handler: MessageHandler) {
    if (this.messageHandlers[type]) {
      this.messageHandlers[type] = this.messageHandlers[type].filter(h => h !== handler);
    }
    return this;
  }
  
  /**
   * Send a message to the server
   */
  public send(message: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  
  /**
   * Close the connection
   */
  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Send a Nostr event to the server
   */
  public sendNostrEvent(event: any) {
    return this.send({
      type: 'nostr_event',
      event
    });
  }
  
  // Private handlers
  
  private handleOpen = () => {
    console.log('WebSocket connection established');
    
    // Send all subscriptions at once
    if (this.subscriptions.length > 0) {
      this.socket?.send(JSON.stringify({
        type: 'subscribe',
        topics: this.subscriptions
      }));
      console.log(`Subscribed to topics: ${this.subscriptions.join(', ')}`);
    }
    
    // Trigger handlers
    this.triggerHandlers('connection', { connected: true, timestamp: Date.now() });
  }
  
  private handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      console.log('WebSocket message received:', message);
      
      // Trigger handlers for this message type
      if (message.type) {
        this.triggerHandlers(message.type, message);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }
  
  private handleClose = () => {
    console.log('WebSocket connection closed');
    
    // Trigger disconnect handlers
    this.triggerHandlers('connection', { 
      connected: false, 
      status: 'disconnected', 
      timestamp: Date.now() 
    });
    
    // Attempt to reconnect
    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.init();
    }, this.reconnectInterval);
  }
  
  private handleError = (error: Event) => {
    console.error('WebSocket error:', error);
    this.triggerHandlers('error', { error });
  }
  
  private triggerHandlers(type: string, data: any) {
    if (this.messageHandlers[type]) {
      for (const handler of this.messageHandlers[type]) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket handler for ${type}:`, error);
        }
      }
    }
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();

// Export types
export type { MessageHandler };