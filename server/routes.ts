import type { Express } from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertFoodEntrySchema, 
  insertWaterEntrySchema, 
  insertGroupSchema,
  insertGroupMemberSchema,
  insertGroupInviteSchema
} from "@shared/schema";

// Interface for tracking Nostr relay subscriptions
interface NostrSubscription {
  clientId: string;
  topics: string[];
}

export async function registerRoutes(app: Express) {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server for real-time updates from Nostr relays
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track client subscriptions by client ID
  const subscriptions = new Map<string, NostrSubscription>();
  
  wss.on('connection', (ws: WebSocket) => {
    // Create unique ID for this connection
    const clientId = Math.random().toString(36).substring(2, 15);
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Store client reference with empty subscriptions
    subscriptions.set(clientId, {
      clientId,
      topics: []
    });
    
    // Attach client ID to WebSocket instance for later reference
    (ws as any).clientId = clientId;
    
    // Send welcome message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Dietstr WebSocket server for Nostr relay events'
      }));
    }
    
    // Handle incoming messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log('Received WebSocket message:', data);
        
        // Handle different message types
        if (data.type === 'subscribe') {
          // Subscribe to updates for a specific feed or Nostr event type
          if (data.feed) {
            // Store this subscription
            const clientSub = subscriptions.get(clientId);
            if (clientSub) {
              clientSub.topics.push(data.feed);
              subscriptions.set(clientId, clientSub);
            }
            
            ws.send(JSON.stringify({
              type: 'subscribed',
              feed: data.feed
            }));
            
            console.log(`Client ${clientId} subscribed to ${data.feed} feed`);
          }
        } else if (data.type === 'nostr_event') {
          // Client is relaying a Nostr event they received directly from a relay
          // We'll broadcast it to other interested clients
          console.log(`Received Nostr event from client ${clientId}:`, 
            data.event ? `kind ${data.event.kind}` : 'unknown');
            
          // Broadcast to other clients
          broadcastNostrEvent(data.event, ws);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log(`WebSocket client disconnected: ${clientId}`);
      // Remove this client's subscriptions
      subscriptions.delete(clientId);
    });
  });
  
  /**
   * Broadcast a Nostr event to all interested WebSocket clients
   */
  function broadcastNostrEvent(event: any, sourceWs: WebSocket) {
    if (!event) return;
    
    // Determine which topic this event belongs to
    let topic = 'unknown';
    
    // Kind 1 posts with food hashtags go to the food feed
    if (event.kind === 1 && event.tags) {
      const hasDietTag = event.tags.some((tag: string[]) => 
        tag[0] === 't' && 
        ['food', 'diet', 'nutrition', 'recipe', 'meal', 'cooking'].includes(tag[1])
      );
      
      if (hasDietTag) {
        topic = 'food';
      }
    }
    
    // Get the source client ID
    const sourceClientId = (sourceWs as any).clientId;
    
    // Broadcast to all clients except the source
    wss.clients.forEach((client) => {
      if (client !== sourceWs && client.readyState === WebSocket.OPEN) {
        const clientId = (client as any).clientId;
        
        // Check if this client is subscribed to this topic
        const subscription = subscriptions.get(clientId);
        if (subscription && subscription.topics.includes(topic)) {
          client.send(JSON.stringify({
            type: 'new_post',
            feed: topic,
            data: event
          }));
        }
      }
    });
  }
  
  // Function to broadcast updates to all connected clients
  const broadcastUpdate = (type: string, data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type,
          data
        }));
      }
    });
  };
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.get("/api/users/:pubkey", async (req, res) => {
    const user = await storage.getUser(req.params.pubkey);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  });

  app.patch("/api/users/:id/preferences", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.updateUserPreferences(userId, req.body);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid preferences data" });
    }
  });

  app.get("/api/food-entries", async (req, res) => {
    const userId = parseInt(req.query.userId as string);
    const date = new Date(req.query.date as string);
    const entries = await storage.getFoodEntries(userId, date);
    res.json(entries);
  });

  app.post("/api/food-entries", async (req, res) => {
    try {
      const entryData = insertFoodEntrySchema.parse(req.body);
      const entry = await storage.createFoodEntry(entryData);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: "Invalid food entry data" });
    }
  });

  app.get("/api/water-entries", async (req, res) => {
    const userId = parseInt(req.query.userId as string);
    const date = new Date(req.query.date as string);
    const entries = await storage.getWaterEntries(userId, date);
    res.json(entries);
  });

  app.post("/api/water-entries", async (req, res) => {
    try {
      const entryData = insertWaterEntrySchema.parse(req.body);
      const entry = await storage.createWaterEntry(entryData);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: "Invalid water entry data" });
    }
  });

  // Group endpoints
  app.get("/api/groups", async (req, res) => {
    try {
      const groups = await storage.getGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.post("/api/groups", async (req, res) => {
    try {
      const groupData = insertGroupSchema.parse(req.body);
      const group = await storage.createGroup(groupData);
      
      // Broadcast update to connected clients
      broadcastUpdate('group_created', group);
      
      res.json(group);
    } catch (error) {
      res.status(400).json({ error: "Invalid group data" });
    }
  });

  app.get("/api/groups/:id", async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch group" });
    }
  });

  app.get("/api/groups/:id/members", async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const members = await storage.getGroupMembers(groupId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch group members" });
    }
  });

  app.post("/api/groups/:id/members", async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const memberData = insertGroupMemberSchema.parse({
        ...req.body,
        groupId
      });
      const member = await storage.addGroupMember(memberData);
      
      // Broadcast update to connected clients
      broadcastUpdate('member_added', { groupId, member });
      
      res.json(member);
    } catch (error) {
      res.status(400).json({ error: "Invalid member data" });
    }
  });

  app.post("/api/groups/:id/invites", async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const inviteData = insertGroupInviteSchema.parse({
        ...req.body,
        groupId
      });
      const invite = await storage.createGroupInvite(inviteData);
      res.json(invite);
    } catch (error) {
      res.status(400).json({ error: "Invalid invite data" });
    }
  });

  app.get("/api/invites/:code", async (req, res) => {
    try {
      const invite = await storage.getGroupInviteByCode(req.params.code);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found or expired" });
      }
      res.json(invite);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invite" });
    }
  });

  return httpServer;
}
