import { isIP } from "node:net";

const PRIVATE_CIDR = [
  { ip: "10.0.0.0", mask: 8 },
  { ip: "172.16.0.0", mask: 12 },
  { ip: "192.168.0.0", mask: 16 },
  { ip: "127.0.0.0", mask: 8 },
  { ip: "169.254.0.0", mask: 16 },
  { ip: "0.0.0.0", mask: 8 },
  { ip: "100.64.0.0", mask: 10 },
  { ip: "198.18.0.0", mask: 15 },
];

const IPV6_CIDR = [
  { ip: "::1", mask: 128 },
  { ip: "fc00::", mask: 7 },
  { ip: "fe80::", mask: 10 },
  { ip: "::ffff:0:0", mask: 96 },
  { ip: "::", mask: 128 },
];

function ip4ToInt(ip: string): number {
  const b = ip.split(".").map(Number);
  return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
}

function ip6ToBigInt(ip: string): bigint {
  const parts = ip.split("::");
  let left = parts[0].split(":").filter(Boolean);
  let right = parts[1] ? parts[1].split(":").filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  const all = [...left, ...Array(missing).fill("0"), ...right];
  return BigInt("0x" + all.map((s) => s.padStart(4, "0")).join(""));
}

function matchCidr4(ip: string, cidr: string, mask: number): boolean {
  const a = ip4ToInt(ip);
  const b = ip4ToInt(cidr);
  const m = mask === 0 ? 0 : (~((1 << (32 - mask)) - 1)) >>> 0;
  return (a & m) === (b & m);
}

function matchCidr6(ip: string, cidr: string, mask: number): boolean {
  const a = ip6ToBigInt(ip);
  const b = ip6ToBigInt(cidr);
  const m = BigInt(-1) << BigInt(128 - mask);
  return (a & m) === (b & m);
}

const PRIVATE_KEYWORDS = new Set([
  "localhost", "local", "broadcasthost",
]);

export function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (PRIVATE_KEYWORDS.has(lower) || PRIVATE_KEYWORDS.has(lower.replace(/\.$/, ""))) {
    return true;
  }

  const ipVer = isIP(lower);
  if (ipVer === 4) {
    return PRIVATE_CIDR.some((r) => matchCidr4(lower, r.ip, r.mask));
  }
  if (ipVer === 6) {
    return IPV6_CIDR.some((r) => matchCidr6(lower, r.ip, r.mask));
  }

  return false;
}
