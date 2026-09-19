import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: npm run version:bump -- <x.y.z>");
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const versions = readJson("versions.json");

manifest.version = version;
packageJson.version = version;
packageLock.version = version;
packageLock.packages[""].version = version;
versions[version] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
writeJson("versions.json", versions);

console.log(`Updated release metadata to ${version}.`);
