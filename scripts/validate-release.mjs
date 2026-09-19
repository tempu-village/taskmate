import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const SEMVER = /^\d+\.\d+\.\d+$/;
const REQUIRED_FILES = [
  "README.md",
  "LICENSE",
  "main.js",
  "manifest.json",
  "styles.css",
  "versions.json",
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const root = argumentValue("--root") ?? ".";

for (const path of REQUIRED_FILES) {
  const absolutePath = join(root, path);
  if (!existsSync(absolutePath)) {
    fail(`${path} is required for a release.`);
  } else if (statSync(absolutePath).size === 0) {
    fail(`${path} must not be empty.`);
  }
}

if (process.exitCode) process.exit();

const manifest = readJson(join(root, "manifest.json"));
const packageJson = readJson(join(root, "package.json"));
const packageLock = readJson(join(root, "package-lock.json"));
const versions = readJson(join(root, "versions.json"));
const tag = argumentValue("--tag");

if (!SEMVER.test(manifest.version)) {
  fail(`manifest.json version must use x.y.z SemVer: ${manifest.version}`);
}

for (const [source, version] of [
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json packages['']", packageLock.packages?.[""]?.version],
]) {
  if (version !== manifest.version) {
    fail(`${source} version ${version} does not match manifest.json ${manifest.version}.`);
  }
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  fail(
    `versions.json must map ${manifest.version} to minAppVersion ${manifest.minAppVersion}.`,
  );
}

if (tag !== undefined && tag !== manifest.version) {
  fail(`release tag ${tag} must exactly match manifest.json ${manifest.version}.`);
}

if (!/^[a-z0-9-]+$/.test(manifest.id) || manifest.id.includes("obsidian")) {
  fail(`manifest id is not Community directory compatible: ${manifest.id}`);
}

if (typeof manifest.description !== "string" || manifest.description.length > 250) {
  fail("manifest description must be a string no longer than 250 characters.");
}

if (!manifest.description.endsWith(".")) {
  fail("manifest description must end with a period.");
}

if (typeof manifest.isDesktopOnly !== "boolean") {
  fail("manifest isDesktopOnly must be a boolean.");
}

if (!process.exitCode) {
  console.log(`OK release metadata and assets for ${manifest.version}`);
}
