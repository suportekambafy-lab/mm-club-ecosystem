/**
 * Consumer: notifications.
 * In-app notifications are currently scoped to community activity, so billing
 * events surface through the billing timeline instead. Kept as a registered
 * consumer so future in-app billing alerts need no engine changes.
 */
import type { JobPayload } from "../types";

export async function notificationsConsumer(job: JobPayload): Promise<void> {
  void job;
}
