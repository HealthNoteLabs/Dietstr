import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertFoodEntrySchema, insertWaterEntrySchema } from "@shared/schema";

export async function registerRoutes(app: Express) {
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

  return createServer(app);
}
