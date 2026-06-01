import { networkInterfaces, hostname } from "node:os";

export interface ServerUrl {
  label: string;
  url: string;
}

export function getServerUrls(port: number, proto: string): ServerUrl[] {
  const urls: ServerUrl[] = [];

  urls.push({ label: "Local", url: `${proto}://localhost:${port}/sse` });

  const host = hostname();
  if (host && host !== "localhost") {
    urls.push({ label: "Hostname", url: `${proto}://${host}:${port}/sse` });
  }

  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const addrs = nets[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        urls.push({ label: name, url: `${proto}://${addr.address}:${port}/sse` });
      }
    }
  }

  return urls;
}
