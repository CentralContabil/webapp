import { z } from "zod";

export const API_PREFIX = "/api/v1" as const;

export const QUEUE_NAME = "nfe-convert" as const;

/** Fila BullMQ dedicada ao SPED (worker bridge + Python). */
export const SPED_QUEUE_NAME = "sped-convert" as const;

/** XLSX (com _LINHA) + SPED .txt → SPED .txt mesclado (webapp-03). */
export const SPED_MERGE_QUEUE_NAME = "sped-merge" as const;

/** Planilha SCI (CSV/Excel) → ProdutosSCI.xlsx (Python). */
export const SCI_CONSOLIDADO_QUEUE_NAME = "sci-consolidado" as const;

export const SciConsolidadoJobPayloadSchema = z.object({
  jobId: z.string(),
  inputPath: z.string(),
  outputPath: z.string(),
  sheetName: z.string().optional(),
});

export type SciConsolidadoJobPayload = z.infer<typeof SciConsolidadoJobPayloadSchema>;

export const SpedJobPayloadSchema = z.object({
  jobId: z.string(),
  inputPath: z.string(),
  outputPath: z.string(),
});

export type SpedJobPayload = z.infer<typeof SpedJobPayloadSchema>;

export const SpedMergeJobPayloadSchema = z.object({
  jobId: z.string(),
  spedPath: z.string(),
  xlsxPath: z.string(),
  outputPath: z.string(),
});

export type SpedMergeJobPayload = z.infer<typeof SpedMergeJobPayloadSchema>;

export const JobStatusSchema = z.enum([
  "queued",
  "running",
  "done",
  "failed",
  "not_found",
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobStatusResponseSchema = z.object({
  id: z.string(),
  status: JobStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
  downloadToken: z.string().optional(),
  fileName: z.string().optional(),
});

export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;

export const CreateJobResponseSchema = z.object({
  id: z.string(),
  status: z.literal("queued"),
});

export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>;
