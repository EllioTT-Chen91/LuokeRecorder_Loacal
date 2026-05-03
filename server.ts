import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- Auth Routes ---
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
        [username, hashedPassword],
      );
      const user = result.rows[0];
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
      );
      res.json({ user, token });
    } catch (err: any) {
      if (err.code === "23505") {
        return res.status(400).json({ error: "Username already exists" });
      }
      res.status(500).json({ error: "External server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE username = $1",
        [username],
      );
      const user = result.rows[0];
      if (!user) return res.status(400).json({ error: "User not found" });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword)
        return res.status(400).json({ error: "Invalid password" });

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
      );
      res.json({ user: { id: user.id, username: user.username }, token });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Hunts Routes ---
  app.get("/api/hunts", authenticateToken, async (req: any, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM roco_hunt_records WHERE user_id = $1 ORDER BY last_modified DESC",
        [req.user.id],
      );
      // Map back to frontend expected structure
      const hunts = result.rows.map((row) => ({
        ...row.captures,
        id: row.record_id,
      }));
      res.json(hunts);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/hunts", authenticateToken, async (req: any, res) => {
    const hunt = req.body;
    try {
      await pool.query(
        "INSERT INTO roco_hunt_records (user_id, record_id, target, captures) VALUES ($1, $2, $3, $4)",
        [req.user.id, hunt.id, hunt.petName, hunt],
      );
      res.sendStatus(201);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/hunts/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const hunt = req.body;
    try {
      await pool.query(
        "UPDATE roco_hunt_records SET captures = $1, target = $2, last_modified = NOW() WHERE user_id = $3 AND record_id = $4",
        [hunt, hunt.petName, req.user.id, id],
      );
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/hunts/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      await pool.query(
        "DELETE FROM roco_hunt_records WHERE user_id = $1 AND record_id = $2",
        [req.user.id, id],
      );
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
