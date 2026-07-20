import "dotenv/config";
import { rebuildSeasonDerivedAggregates } from "../src/services/season-aggregate-rebuilder.js";

const seasonId = process.argv
  .slice(2)
  .find((argument) => !argument.startsWith("-"));
if (!seasonId) {
  throw new Error(
    "Usage: tsx scripts/rebuild-season-derived-aggregates.ts <season-id>",
  );
}

const result = await rebuildSeasonDerivedAggregates(seasonId);
console.log(JSON.stringify({ seasonId, ...result }, null, 2));
