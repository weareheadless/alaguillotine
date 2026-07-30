const fs = require("fs");
const path = require("path");

// Load .env.local into an object for PM2
function loadEnv(filePath) {
  const env = {};
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  } catch { /* file not found */ }
  return env;
}

const dotEnv = loadEnv(path.join(__dirname, ".env.local"));

module.exports = {
  apps: [
    {
      name: "fuckyouelon",
      cwd: "/FYE",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      env: {
        NODE_ENV: "production",
        ...dotEnv,
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
    },
    {
      name: "chop-watcher",
      cwd: "/FYE",
      script: "scripts/watcher.cjs",
      env: {
        NODE_ENV: "production",
        ...dotEnv,
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "256M",
      restart_delay: 5_000,
      max_restarts: 10,
    },
    {
      name: "chop-oracle",
      cwd: "/FYE",
      script: "scripts/oracle.cjs",
      env: {
        NODE_ENV: "production",
        ...dotEnv,
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      cron_restart: "*/5 * * * *",
      autorestart: false,
      max_memory_restart: "256M",
    },
  ],
};
