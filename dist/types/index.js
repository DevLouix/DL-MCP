export function textContent(text) {
    return { type: "text", text };
}
export function errorContent(text) {
    return { isError: true, content: [textContent(text)] };
}
//# sourceMappingURL=index.js.map