import { pgTable, text, serial, integer, timestamp, json } from "drizzle-orm/pg-core";
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
  }>("preferences"),
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
});

export const waterEntries = pgTable("water_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  amount: integer("amount").notNull(),
  date: timestamp("date").notNull(),
  nostrEventId: text("nostr_event_id"),
});

export const insertUserSchema = createInsertSchema(users);
export const insertFoodEntrySchema = createInsertSchema(foodEntries).omit({ id: true, nostrEventId: true });
export const insertWaterEntrySchema = createInsertSchema(waterEntries).omit({ id: true, nostrEventId: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type InsertFoodEntry = z.infer<typeof insertFoodEntrySchema>;
export type WaterEntry = typeof waterEntries.$inferSelect;
export type InsertWaterEntry = z.infer<typeof insertWaterEntrySchema>;
