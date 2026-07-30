import app from "./app";

import { env } from "./common/config/env";

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 WorkPulse API is running on http://localhost:${PORT}`);
});