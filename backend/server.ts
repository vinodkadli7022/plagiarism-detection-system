import { app } from "./src/app";
import { env } from "./src/config/env";

app.listen(env.port, () => {
  console.log(`Backend running at http://localhost:${env.port}`);
});
