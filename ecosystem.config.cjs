module.exports = {
  apps: [
    {
      name: "fuckyouelon",
      cwd: "/FYE",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
