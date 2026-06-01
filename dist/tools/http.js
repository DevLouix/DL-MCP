import { textContent, errorContent } from "../types/index.js";
export async function handleHttpRequest(url, method, headers, body, maxHttpResponseSize) {
    try {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes("localhost") || lowerUrl.includes("127.0.0.1") || lowerUrl.includes("192.168.")) {
            throw new Error("Access Denied: Requesting internal/private network resources is restricted.");
        }
        const requestHeaders = headers || {};
        const response = await fetch(url, {
            method: method,
            headers: requestHeaders,
            body: method !== "GET" ? body : undefined,
        });
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
    }
    catch (err) {
        return errorContent(`HTTP request failed: ${err.message}`);
    }
}
