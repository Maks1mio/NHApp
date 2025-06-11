// ====================== TAGS PARSER NHENTAI ======================
import * as fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";

type TagEntry = {
  id: string | number;
  type: string;
  name: string;
  count: number;
  url: string;
};

const BASE_URLS = [
  { key: "tag", url: "https://nhentai.net/tags/" },
  { key: "artist", url: "https://nhentai.net/artists/" },
  { key: "character", url: "https://nhentai.net/characters/" },
  { key: "parody", url: "https://nhentai.net/parodies/" },
  { key: "group", url: "https://nhentai.net/groups/" },
];

function parseCount(str: string): number {
  str = str.replace(/[(),]/g, "").trim().toUpperCase();
  if (str.endsWith("K")) {
    return Math.round(parseFloat(str.replace("K", "")) * 1000);
  }
  if (str.endsWith("M")) {
    return Math.round(parseFloat(str.replace("M", "")) * 1000000);
  }
  return Number(str) || 0;
}

async function parseSection(section: {
  key: string;
  url: string;
}): Promise<TagEntry[]> {
  const out: TagEntry[] = [];
  let page = 1;
  while (true) {
    const pageUrl = section.url + (page > 1 ? `?page=${page}` : "");
    let data: string;
    try {
      const resp = await axios.get(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      data = resp.data;
    } catch (err: any) {
      if (err.response && err.response.status === 404) break;
      throw err;
    }
    const $ = cheerio.load(data);

    const tags = $(".tag-container a.tag, .index-container a.tag, a.tag");
    if (tags.length === 0) break;

    tags.each((_, el) => {
      const $el = $(el);
      const name = $el.find(".name").text().trim();
      const count = parseCount($el.find(".count").text());
      const href = $el.attr("href") || "";
      const classList = ($el.attr("class") || "").split(/\s+/);
      const tagIdClass = classList.find((cls) => /^tag-\d+$/.test(cls));
      const id = tagIdClass ? tagIdClass.replace("tag-", "") : href || name;

      out.push({
        id,
        type: section.key,
        name,
        count,
        url: "https://nhentai.net" + href,
      });
    });

    const hasNext = $(".pagination .next:not(.disabled)").length > 0;
    if (!hasNext) break;
    page++;
    if (page > 1000) break;
  }
  return out;
}

async function retryParseSection(
  section: { key: string; url: string },
  maxRetries = 5,
  retryDelay = 5000
): Promise<TagEntry[]> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await parseSection(section);
    } catch (err: any) {
      attempt++;
      console.error(
        `Error parsing ${section.key} (attempt ${attempt}/${maxRetries}):`,
        err?.message || err
      );
      if (attempt >= maxRetries) {
        console.error(`  Reached attempt limit for ${section.key}. Skipping.`);
        return [];
      }
      await new Promise((res) => setTimeout(res, retryDelay));
    }
  }
  return [];
}

async function runNhentaiTagsParser() {
  const output: Record<string, TagEntry[]> = {};
  for (const section of BASE_URLS) {
    try {
      console.log(`Parsing ${section.key}...`);
      output[section.key] = await retryParseSection(section);
      console.log(`  Found: ${output[section.key].length}`);
    } catch (err: any) {
      console.error(`Fatal error parsing ${section.key}:`, err?.message || err);
      output[section.key] = [];
    }
  }
  const result = {
    updated: new Date().toISOString(),
    ...output,
  };
  fs.writeFileSync(
    "nhentai-tags.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );
  console.log(`Done! File: nhentai-tags.json, date: ${result.updated}`);
}

// ==== UNCOMMENT TO RUN ====
// runNhentaiTagsParser()
//   .then(() => process.exit(0))
//   .catch((err) => {
//     console.error(err);
//     process.exit(1);
//   });
// =================== END OF TAGS PARSER ===================
