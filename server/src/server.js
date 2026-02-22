import "./loadEnv.js";
import app from "./app.js";
import config from "./config/config.js";

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  console.log(`Telegram auth: ${config.telegramBotToken ? "configured" : "NOT configured"}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});

// Handle SIGTERM for graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});
