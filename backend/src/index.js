const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "TempMail API is running",
    timestamp: new Date().toISOString(),
  });
});
// ── 404 Handler ─────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});
// ── Error Handler ───────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
  });
});
// ── Запуск сервера ───────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
