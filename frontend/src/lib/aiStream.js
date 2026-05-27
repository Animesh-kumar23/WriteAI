import { API_BASE_URL, API_ENDPOINTS } from "../utils/api-endpoints";

export async function streamAIContent(payload, onChunk, signal) {
  const response = await fetch(
    `${API_BASE_URL}${API_ENDPOINTS.AI.STREAM}`,
    {
      method: "POST",
      credentials: "include", // send HttpOnly cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || "Streaming failed");
    error.status = response.status;
    throw error;
  }

  if (!response.body) {
    throw new Error("No response stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
}
