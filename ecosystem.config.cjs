module.exports = {
  apps: [
    {
      name: "beast",
      script: "cmd",
      args: "/c npm run dev",
      cwd: "L:\\ai_builder\\ai_builderv2",
      env: { NODE_ENV: "development", PORT: "5000" },
    },
    {
      name: "builder-standalone",
      script: "cmd",
      args: "/c npm run dev",
      cwd: "L:\\ai_builder\\ai_builderv2\\apps\\builder-standalone",
      env: { NODE_ENV: "development" },
    },
    {
      name: "chat-standalone",
      script: "cmd",
      args: "/c npm run dev",
      cwd: "L:\\ai_builder\\ai_builderv2\\apps\\chat-standalone",
      env: { NODE_ENV: "development" },
    },
    {
      name: "war-room",
      script: "cmd",
      args: "/c npm run dev",
      cwd: "L:\\ai_builder\\ai_builderv2\\apps\\war-room",
      env: { NODE_ENV: "development" },
    },
    {
      name: "diagnostics-standalone",
      script: "cmd",
      args: "/c npm run dev",
      cwd: "L:\\ai_builder\\ai_builderv2\\apps\\diagnostics-standalone",
      env: { NODE_ENV: "development" },
    },
    {
      name: "apps-standalone",
      script: "cmd",
      args: "/c npm run dev",
      cwd: "L:\\ai_builder\\ai_builderv2\\apps\\apps-standalone",
      env: { NODE_ENV: "development" },
    },
    {
      name: "guardian-standalone",
      script: "cmd",
      args: "/c npm run dev",
      cwd: "L:\\ai_builder\\ai_builderv2\\apps\\guardian-standalone",
      env: { NODE_ENV: "development" },
    },
  ],
};
