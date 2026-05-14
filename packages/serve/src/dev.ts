import { serve } from "./index.ts";

const path = process.env.ABTREE_SERVE_PATH ?? "../../.abtree/executions";
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

await serve({ path, port });
