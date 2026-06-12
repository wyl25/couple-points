import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const inputDir = path.resolve(process.argv[2] || "cloudbase-export");
const outputFile = path.resolve(process.argv[3] || "edgeone-migration.json");
const files = await readdir(inputDir);
const collections = {};

for (const file of files.filter((name) => name.toLowerCase().endsWith(".json"))) {
  const collectionName = path.basename(file, path.extname(file));
  const raw = await readFile(path.join(inputDir, file), "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
  collections[collectionName] = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.records ?? parsed;
}

await writeFile(outputFile, JSON.stringify({ collections }, null, 2));
console.log(`Created ${outputFile} with ${Object.keys(collections).length} collections.`);
