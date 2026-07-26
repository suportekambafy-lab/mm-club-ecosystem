/** Shared queue types (client-safe). */
export type JobPayload = Record<string, unknown> & {
  eventType?: string;
  aggregateId?: string | null;
};

export type JobRow = {
  id: string;
  consumer: string;
  job_type: string;
  payload: JobPayload;
  attempts: number;
  max_attempts: number;
};
