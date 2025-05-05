import { env } from "cloudflare:workers";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const pipeline = env.PIPELINE;

    if (!pipeline) {
      throw new Error("Pipeline binding not found in Cloudflare environment.");
    }

    const data = body.data;

    if (!data) {
      throw new Error("Missing 'data' property in request body");
    }

    // Always send data wrapped in an array
    await pipeline.send([data]);

    return { success: true, message: "Data sent to pipeline." };
  } catch (error) {
    console.error("Error sending data to pipeline:", error);
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Pipeline error",
    });
  }
});
