import type { ToolResult } from "../types/index.js";
import { textContent, errorContent } from "../types/index.js";
import { isPrivateHost } from "../security/network.js";

export async function handleHttpRequest(
  url: string,
  method: string,
  headers: Record<string, string> | undefined,
  body: string | undefined,
  maxHttpResponseSize: number,
): Promise<ToolResult> {
  try {
    const parsedUrl = new URL(url);

    if (isPrivateHost(parsedUrl.hostname)) {
      throw new Error("Access Denied: Requesting internal/private network resources is restricted.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const requestHeaders = headers || {};

    const response = await fetch(url, {
      method: method as any,
      headers: requestHeaders,
      body: method !== "GET" ? body : undefined,
      signal: controller.signal,
      redirect: "error",
    });

    clearTimeout(timeout);

    let responseText = await response.text();

    if (responseText.length > maxHttpResponseSize) {
      responseText = responseText.slice(0, maxHttpResponseSize)
        + `\n\n[Response truncated because it exceeded ${(maxHttpResponseSize / 1024 / 1024)}MB limit]`;
    }

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText,
    };

    return {
      content: [textContent(JSON.stringify(result, null, 2))],
    };
  } catch (err: any) {
    return errorContent(`HTTP request failed: ${err.message}`);
  }
}
