require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI || !DB_NAME) {
  console.error("Missing MONGO_URI or DB_NAME env vars.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

let usersCollection;

app.post("/users", async (req, res) => {
  try {
    const { clerkId, name, email, image } = req.body || {};
    if (!clerkId || !email) {
      return res
        .status(400)
        .json({ error: "clerkId and email are required fields." });
    }

    const result = await usersCollection.updateOne(
      { clerkId },
      { $set: { clerkId, name, email, image } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      upsertedId: result.upsertedId ?? null,
    });
  } catch (error) {
    console.error("POST /users error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/users", async (_req, res) => {
  try {
    const users = await usersCollection.find({}).toArray();
    return res.status(200).json(users);
  } catch (error) {
    console.error("GET /users error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const user = await usersCollection.findOne({ clerkId: req.params.id });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error("GET /users/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.put("/users/:id", async (req, res) => {
  try {
    const update = req.body || {};
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Update payload is required." });
    }

    const result = await usersCollection.updateOne(
      { clerkId: req.params.id },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("PUT /users/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const result = await usersCollection.deleteOne({ clerkId: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("DELETE /users/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

async function init() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("MongoDB connected.");
    const db = client.db(DB_NAME);
    usersCollection = db.collection("users");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

init();
