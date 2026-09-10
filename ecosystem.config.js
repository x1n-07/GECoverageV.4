module.exports = {
  apps: [
    {
      name: "geka-coverage",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};