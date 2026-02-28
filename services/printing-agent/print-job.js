/**
 * Attempt to extract grams from the print payload.
 * Bambu firmware versions report this differently; we check known field names.
 */
export function extractGrams(print) {
  const candidates = ["filament_used_g", "mc_print_filament_g", "filament_g"];
  for (const field of candidates) {
    const val = print[field];
    if (typeof val === "number" && val > 0) return val;
    if (typeof val === "string" && parseFloat(val) > 0) return parseFloat(val);
  }
  return null;
}

/**
 * Build the print job document for MongoDB.
 */
export function buildJobDoc({ project, usageG, loggedAt, activeSpoolId }) {
  return {
    project,
    spoolId: parseInt(activeSpoolId, 10),
    usageG,
    loggedAt,
    processed: false,
  };
}

/**
 * Write the raw print job to MongoDB and enqueue for processing.
 */
export async function logJob({ project, usageG, loggedAt, activeSpoolId, printJobs, printJobQueue }) {
  const doc = buildJobDoc({ project, usageG, loggedAt, activeSpoolId });

  const result = await printJobs.insertOne(doc);

  await printJobQueue.add("completed", {
    printJobId: result.insertedId.toString(),
    project,
    spoolId: doc.spoolId,
    usageG,
  });

  return result.insertedId;
}
