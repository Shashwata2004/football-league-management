import { env } from "./config/env.js";
import app from "./app.js";

app.listen(env.BACKEND_PORT, () => {
  console.log(`Backend listening on http://localhost:${env.BACKEND_PORT}`);
});
