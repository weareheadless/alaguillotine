const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  const env = {};
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch { /* file not found */ }
  return env;
}

const dotEnv = loadEnv(path.join(__dirname, ".env.local"));

module.exports = {
  apps: [
    {
      name: "chop-watcher",
      cwd: "/FYE",
      script: "scripts/watcher.cjs",
      env: { NODE_ENV: "production", ...dotEnv },
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
      env: { NODE_ENV: "production", ...dotEnv },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      cron_restart: "*/5 * * * *",
      autorestart: false,
      max_memory_restart: "256M",
    },
  ],
};
