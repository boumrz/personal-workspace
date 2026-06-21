import { spawn } from "node:child_process";
import os from "node:os";

function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      candidates.push(entry.address);
    }
  }

  return (
    candidates.find((address) => address.startsWith("192.168.")) ??
    candidates.find((address) => address.startsWith("10.")) ??
    candidates.find((address) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) ??
    candidates[0]
  );
}

const lanIp = process.env.LOCAL_API_HOST || getLanIp();

if (!lanIp) {
  console.error("Could not detect LAN IP. Set LOCAL_API_HOST manually and retry.");
  process.exit(1);
}

const apiUrl = `http://${lanIp}:3001/api`;
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["expo", "start", "--dev-client", "--lan", "--clear"];
const isDryRun = process.argv.includes("--dry-run");

console.log(`Starting Expo with local API: ${apiUrl}`);
console.log(`Using packager host: ${lanIp}`);

if (isDryRun) {
  process.exit(0);
}

const child = spawn(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    EXPO_PUBLIC_API_URL: apiUrl,
    REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
