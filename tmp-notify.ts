import { notifyFailedPaymentMembers } from "./src/lib/admin/recovery-notify.server";
console.log(JSON.stringify(await notifyFailedPaymentMembers(), null, 2));
