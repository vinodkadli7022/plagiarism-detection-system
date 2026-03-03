import { app } from "./src/app";
import { env } from "./src/config/env";
import { runMigrations } from "./src/config/migrate";

async function startServer() {
  await runMigrations();
  app.listen(env.port, () => {
    console.log(`Backend running at http://localhost:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
