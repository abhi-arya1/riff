export function twiml(socketUrl: string) {
  const url = escapeXml(socketUrl);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Connect><Stream url="${url}" /></Connect></Response>`;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char] || char);
}
