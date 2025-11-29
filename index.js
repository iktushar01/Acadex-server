require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

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
let coursesCollection;
let notesCollection;
let classroomsCollection;

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Courses CRUD API
app.post("/courses", async (req, res) => {
  try {
    if (!coursesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }

    const { title, faculty, code, description, semester, credits } = req.body || {};
    if (!title || !faculty) {
      return res
        .status(400)
        .json({ error: "title and faculty are required fields." });
    }

    const course = {
      title,
      faculty,
      code: code || null,
      description: description || null,
      semester: semester || null,
      credits: credits || null,
      noteCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await coursesCollection.insertOne(course);
    return res.status(201).json({
      success: true,
      course: { ...course, _id: result.insertedId },
    });
  } catch (error) {
    console.error("POST /courses error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/courses", async (_req, res) => {
  try {
    if (!coursesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }
    const courses = await coursesCollection.find({}).toArray();
    return res.status(200).json(courses);
  } catch (error) {
    console.error("GET /courses error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/courses/:id", async (req, res) => {
  try {
    if (!coursesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }
    let course;
    try {
      course = await coursesCollection.findOne({ _id: new ObjectId(req.params.id) });
    } catch (err) {
      return res.status(400).json({ error: "Invalid course ID." });
    }
    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }
    return res.status(200).json(course);
  } catch (error) {
    console.error("GET /courses/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.put("/courses/:id", async (req, res) => {
  try {
    if (!coursesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }
    const update = req.body || {};
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Update payload is required." });
    }

    update.updatedAt = new Date();

    let result;
    try {
      result = await coursesCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: update }
      );
    } catch (err) {
      return res.status(400).json({ error: "Invalid course ID." });
    }

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("PUT /courses/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/courses/:id", async (req, res) => {
  try {
    if (!coursesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }
    let result;
    try {
      result = await coursesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    } catch (err) {
      return res.status(400).json({ error: "Invalid course ID." });
    }
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Course not found." });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("DELETE /courses/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Notes CRUD API
app.post("/notes", async (req, res) => {
  try {
    if (!notesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }

    const {
      title,
      subject,
      courseId,
      courseTitle,
      description,
      attachments,
      fileUrl,
      publicId,
      originalFilename,
      resourceType,
      format,
      bytes,
    } = req.body || {};

    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .filter((item) => item && item.secureUrl)
          .map((item) => ({
            secureUrl: item.secureUrl,
            publicId: item.publicId || null,
            originalFilename: item.originalFilename || null,
            resourceType: item.resourceType || null,
            format: item.format || null,
            bytes: typeof item.bytes === "number" ? item.bytes : null,
            folder: item.folder || null,
            relativePath: item.relativePath || null,
          }))
      : [];

    const primaryAttachment = normalizedAttachments[0];

    if (!title || (!subject && !courseId && !courseTitle)) {
      return res.status(400).json({ error: "title and course information are required." });
    }

    if (!primaryAttachment && !fileUrl) {
      return res.status(400).json({ error: "At least one uploaded file is required." });
    }

    const note = {
      title,
      subject: courseTitle || subject || null,
      courseId: courseId || null,
      courseTitle: courseTitle || subject || null,
      description: description || "",
      attachments: normalizedAttachments,
      fileUrl: primaryAttachment?.secureUrl || fileUrl || null,
      publicId: primaryAttachment?.publicId || publicId || null,
      originalFilename: primaryAttachment?.originalFilename || originalFilename || null,
      resourceType: primaryAttachment?.resourceType || resourceType || null,
      format: primaryAttachment?.format || format || null,
      bytes:
        typeof primaryAttachment?.bytes === "number"
          ? primaryAttachment.bytes
          : typeof bytes === "number"
          ? bytes
          : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notesCollection.insertOne(note);
    return res.status(201).json({
      success: true,
      note: { ...note, _id: result.insertedId },
    });
  } catch (error) {
    console.error("POST /notes error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/notes", async (_req, res) => {
  try {
    if (!notesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }

    const notes = await notesCollection.find({}).sort({ createdAt: -1 }).toArray();
    return res.status(200).json(notes);
  } catch (error) {
    console.error("GET /notes error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/notes/:id", async (req, res) => {
  try {
    if (!notesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }

    let note;
    try {
      note = await notesCollection.findOne({ _id: new ObjectId(req.params.id) });
    } catch (err) {
      return res.status(400).json({ error: "Invalid note ID." });
    }

    if (!note) {
      return res.status(404).json({ error: "Note not found." });
    }

    return res.status(200).json(note);
  } catch (error) {
    console.error("GET /notes/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.put("/notes/:id", async (req, res) => {
  try {
    if (!notesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }

    const update = req.body || {};
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Update payload is required." });
    }

    update.updatedAt = new Date();

    let result;
    try {
      result = await notesCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: update }
      );
    } catch (err) {
      return res.status(400).json({ error: "Invalid note ID." });
    }

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Note not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("PUT /notes/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/notes/:id", async (req, res) => {
  try {
    if (!notesCollection) {
      return res.status(503).json({ error: "Database not initialized. Please wait." });
    }

    let result;
    try {
      result = await notesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    } catch (err) {
      return res.status(400).json({ error: "Invalid note ID." });
    }

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Note not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("DELETE /notes/:id error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

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

// Classrooms API
app.post("/classrooms", async (req, res) => {
  try {
    if (!classroomsCollection) {
      return res
        .status(503)
        .json({ error: "Database not initialized. Please wait." });
    }

    const {
      institutionType,
      institutionName,
      departmentName,
      classOrGrade,
      section,
      classroomName,
      classCode,
      capacity,
    } = req.body || {};

    if (!institutionType || !institutionName || !classroomName || !classCode) {
      return res.status(400).json({
        error:
          "institutionType, institutionName, classroomName and classCode are required fields.",
      });
    }

    if (!/^[A-Za-z0-9]{6}$/.test(classCode)) {
      return res.status(400).json({
        error: "classCode must be 6 characters long and contain only A-Z, 0-9.",
      });
    }

    const existing = await classroomsCollection.findOne({ classCode });
    if (existing) {
      return res.status(409).json({
        error: "A classroom with this code already exists. Please regenerate.",
      });
    }

    const classroom = {
      institutionType,
      institutionName,
      departmentName: departmentName || null,
      classOrGrade: classOrGrade || null,
      section: section || null,
      classroomName,
      classCode,
      capacity:
        typeof capacity === "number"
          ? capacity
          : capacity
          ? Number(capacity) || null
          : null,
      memberCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await classroomsCollection.insertOne(classroom);
    return res.status(201).json({
      success: true,
      classroom: { ...classroom, _id: result.insertedId },
    });
  } catch (error) {
    console.error("POST /classrooms error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/classrooms/join", async (req, res) => {
  try {
    if (!classroomsCollection) {
      return res
        .status(503)
        .json({ error: "Database not initialized. Please wait." });
    }

    const { classCode, displayName } = req.body || {};

    if (!classCode) {
      return res
        .status(400)
        .json({ error: "classCode is required to join a classroom." });
    }

    const classroom = await classroomsCollection.findOne({ classCode });
    if (!classroom) {
      return res
        .status(404)
        .json({ error: "No classroom found with this code." });
    }

    // For now we just validate and return the classroom.
    // You can extend this later to track members with displayName and user id.
    return res.status(200).json({
      success: true,
      classroom,
      displayName: displayName || null,
    });
  } catch (error) {
    console.error("POST /classrooms/join error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Catch-all route for debugging (must be last)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    message: "Make sure the server is running and the route is correct",
  });
});

async function init() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("MongoDB connected.");
    const db = client.db(DB_NAME);
    usersCollection = db.collection("users");
    coursesCollection = db.collection("courses");
    notesCollection = db.collection("notes");
    classroomsCollection = db.collection("classrooms");
    console.log("Collections initialized: users, courses, notes, classrooms");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Courses API: http://localhost:${PORT}/courses`);
      console.log(`Notes API: http://localhost:${PORT}/notes`);
      console.log(`Classrooms API: http://localhost:${PORT}/classrooms`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

init();
