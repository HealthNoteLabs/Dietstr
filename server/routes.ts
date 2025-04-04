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
  let connectionCounter = 0;
  
  wss.on('connection', (ws: WebSocket) => {
    // Create unique ID for this connection
    connectionCounter++;
    const clientId = `client_${Date.now()}_${connectionCounter}`;
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
        status: 'connected',
        clientId,
        timestamp: Date.now(),
        message: 'Connected to Dietstr WebSocket server'
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
          // Support both single feed and array of feeds
          const topics = Array.isArray(data.topics) ? data.topics : 
                        data.feed ? [data.feed] : [];
                        
          if (topics.length > 0) {
            // Store these subscriptions
            const clientSub = subscriptions.get(clientId);
            if (clientSub) {
              // Add new topics avoiding duplicates
              topics.forEach(topic => {
                if (!clientSub.topics.includes(topic)) {
                  clientSub.topics.push(topic);
                }
              });
              subscriptions.set(clientId, clientSub);
            }
            
            ws.send(JSON.stringify({
              type: 'subscribed',
              topics,
              timestamp: Date.now()
            }));
            
            console.log(`Client ${clientId} subscribed to topics: ${topics.join(', ')}`);
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
    console.log(`Broadcasting Nostr event: ${JSON.stringify(event, null, 2)}`);
    
    // Count active connections
    let activeConnections = 0;
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        activeConnections++;
      }
    });
    console.log(`Active WebSocket connections: ${activeConnections}`);
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
    
    // Handle NIP-29 Group Events
    if (event.kind === 39000) {
      // Group metadata event
      topic = 'group_metadata';
      console.log('Received group metadata event (kind 39000):', JSON.stringify(event, null, 2));
      
      // Extract group info from tags
      let groupName = '';
      let groupAbout = '';
      let groupImage = '';
      
      if (event.tags) {
        for (const tag of event.tags) {
          if (tag[0] === 'name' && tag[1]) {
            groupName = tag[1];
          } else if (tag[0] === 'about' && tag[1]) {
            groupAbout = tag[1];
          } else if (tag[0] === 'image' && tag[1]) {
            groupImage = tag[1];
          }
        }
      }
      
      console.log(`Group info - Name: "${groupName}", About: "${groupAbout}", Image: ${groupImage ? 'Yes' : 'No'}`);
    } else if (event.kind === 9021) {
      // Group member list event
      topic = 'group_members';
      console.log('Received group member event (kind 9021):', JSON.stringify(event, null, 2));
      
      // Count members in the list
      const memberCount = event.tags ? event.tags.filter((t: string[]) => t[0] === 'p').length : 0;
      console.log(`Group has ${memberCount} members`);
    } else if (event.kind === 9020) {
      // Group creation event
      topic = 'group_creation';
      console.log('Received group creation event (kind 9020):', JSON.stringify(event, null, 2));
    }
    
    // Get the source client ID
    const sourceClientId = (sourceWs as any).clientId;
    
    // Broadcast to all clients except the source
    wss.clients.forEach((client) => {
      if (client !== sourceWs && client.readyState === WebSocket.OPEN) {
        const clientId = (client as any).clientId;
        
        // Check if this client is subscribed to this topic
        const subscription = subscriptions.get(clientId);
        if (subscription && (subscription.topics.includes(topic) || subscription.topics.includes('all'))) {
          // Determine message type based on the event kind and topic
          let messageType = 'new_post';
          
          if (topic === 'group_metadata') {
            messageType = 'group_updated';
          } else if (topic === 'group_members') {
            messageType = 'group_members_updated';
          } else if (topic === 'group_creation') {
            messageType = 'group_created';
          }
          
          client.send(JSON.stringify({
            type: messageType,
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
