import { triggerRecoveryNow } from "../src/lib/billing/recovery/engine.server";
import { drainQueue } from "../src/lib/queue/worker.server";
await triggerRecoveryNow("97ea2732-fa30-4d0f-a663-90b4080b76b5", "admin_manual");
console.log("queued");
console.log(JSON.stringify(await drainQueue(10)));
