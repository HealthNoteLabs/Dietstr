import { pgTable, text, serial, integer, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  pubkey: text("pubkey").notNull().unique(),
  preferences: json("preferences").$type<{
    dailyCalorieGoal?: number;
    waterGoal?: number;
    macroGoals?: {
      protein: number;
      carbs: number;
      fat: number;
    };
    dietPlan?: 'carnivore' | 'keto' | 'fasting' | 'animal-based' | undefined;
  }>(),
});

export const foodEntries = pgTable("food_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  calories: integer("calories").notNull(),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  mealType: text("meal_type").notNull(),
  date: timestamp("date").notNull(),
  nostrEventId: text("nostr_event_id"),
  groupId: text("group_id"),
});

export const waterEntries = pgTable("water_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  amount: integer("amount").notNull(),
  date: timestamp("date").notNull(),
  nostrEventId: text("nostr_event_id"),
  groupId: text("group_id"),
});

// NIP29 Groups
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  groupId: text("group_id").notNull().unique(), // NIP29 group ID format: <host>'<group-id>
  name: text("name").notNull(),
  about: text("about"),
  picture: text("picture"),
  ownerId: integer("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  kind39000EventId: text("kind39000_event_id"), // Group metadata event
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id),
  userId: integer("user_id").references(() => users.id),
  role: text("role").default("member"), // Options: owner, admin, moderator, member
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  kind9021EventId: text("kind9021_event_id"), // Join event
});

export const groupInvites = pgTable("group_invites", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").default(0),
  isActive: boolean("is_active").default(true),
});

export const groupEvents = pgTable("group_events", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id),
  kind: integer("kind").notNull(), // NIP29 event kind
  eventId: text("event_id").notNull(), // Nostr event ID
  pubkey: text("pubkey").notNull(), // Who created the event
  createdAt: timestamp("created_at").notNull(),
  content: text("content"),
  tags: json("tags"),
  referencedEventIds: json("referenced_event_ids"),
});

export const insertUserSchema = createInsertSchema(users);
export const insertFoodEntrySchema = createInsertSchema(foodEntries).omit({ id: true, nostrEventId: true, groupId: true });
export const insertWaterEntrySchema = createInsertSchema(waterEntries).omit({ id: true, nostrEventId: true, groupId: true });

// Group schemas
export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, kind39000EventId: true, createdAt: true });
export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({ id: true, joinedAt: true, kind9021EventId: true });
export const insertGroupInviteSchema = createInsertSchema(groupInvites).omit({ id: true, createdAt: true, useCount: true, isActive: true });
export const insertGroupEventSchema = createInsertSchema(groupEvents).omit({ id: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type InsertFoodEntry = z.infer<typeof insertFoodEntrySchema>;
export type WaterEntry = typeof waterEntries.$inferSelect;
export type InsertWaterEntry = z.infer<typeof insertWaterEntrySchema>;

// Group types
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type GroupInvite = typeof groupInvites.$inferSelect;
export type InsertGroupInvite = z.infer<typeof insertGroupInviteSchema>;
export type GroupEvent = typeof groupEvents.$inferSelect;
export type InsertGroupEvent = z.infer<typeof insertGroupEventSchema>;

// NIP29 Event kinds
export const NIP29_EVENT_KINDS = {
  // Moderation events
  ADD_USER: 9000,
  REMOVE_USER: 9001,
  JOIN_REQUEST: 9021,
  LEAVE_REQUEST: 9022,
  // Metadata events
  GROUP_METADATA: 39000,
  ADMIN_METADATA: 39001,
  USER_METADATA: 39002,
  RELAY_METADATA: 39003,
  // Regular content kinds in groups
  TEXT_NOTE: 1,
  REACTION: 7,
};
