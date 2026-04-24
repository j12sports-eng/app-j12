module.exports = {
  apps: [
    {
      name: "j12-api",
      cwd: __dirname,
      script: "server/index.mjs",
      interpreter: "node",
      node_args: "--env-file=.env.api.production",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      merge_logs: true,
      time: true,
      out_file: "logs/j12-api.out.log",
      error_file: "logs/j12-api.error.log",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
