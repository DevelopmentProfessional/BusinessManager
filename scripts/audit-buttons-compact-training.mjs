import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "frontend", "src");
const REPORT_DIR = path.join(ROOT, "reports");
const REPORT_PATH = path.join(REPORT_DIR, "button-compact-training-audit.json");

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

const EXEMPT_CLASS_TOKENS = ["btn-unstyled", "btn-close", "btn-tab", "app-compact-exempt"];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    out.push(full);
  }
  return out;
}

function getLineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function extractClassValue(openTag) {
  const classNameMatch = openTag.match(/className\s*=\s*"([^"]*)"/);
  if (classNameMatch) return classNameMatch[1];
  const classMatch = openTag.match(/class\s*=\s*"([^"]*)"/);
  if (classMatch) return classMatch[1];
  return "";
}

function hasExemptClass(classValue) {
  return EXEMPT_CLASS_TOKENS.some((token) => classValue.includes(token));
}

function hasIconLikeMarkup(block) {
  if (/<svg\b/i.test(block)) return { hasIcon: true, coveredByCompactRule: true, evidence: "svg" };
  if (/<img\b/i.test(block)) return { hasIcon: true, coveredByCompactRule: true, evidence: "img" };
  if (/<[A-Za-z0-9_.]+Icon\b/.test(block)) return { hasIcon: true, coveredByCompactRule: true, evidence: "IconComponent" };
  if (/<i\b[^>]*\bbi\b/.test(block)) return { hasIcon: true, coveredByCompactRule: true, evidence: "bootstrapIcon" };
  if (/\bapp-icon\b/.test(block)) return { hasIcon: true, coveredByCompactRule: true, evidence: "app-icon" };

  // Heuristic: looks icon-ish but not guaranteed covered by compact selectors.
  if (/\b(className|class)\s*=\s*["'`][^"'`]*icon[^"'`]*["'`]/.test(block)) {
    return { hasIcon: true, coveredByCompactRule: false, evidence: "generic-icon-class" };
  }

  return { hasIcon: false, coveredByCompactRule: false, evidence: "none" };
}

function hasTextLikeContent(block) {
  // Remove JSX comments, expressions, and tags, then check for words.
  const stripped = block
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /[A-Za-z]{2,}/.test(stripped);
}

function hasTrainingGuard(block) {
  return /isTrainingMode\s*\?/.test(block) || /isTrainingMode\s*&&/.test(block);
}

function collectFindings(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const findings = [];
  const buttonRegex = /<button\b[\s\S]*?<\/button>/g;

  for (const match of source.matchAll(buttonRegex)) {
    const block = match[0];
    const startIndex = match.index ?? 0;
    const line = getLineNumber(source, startIndex);
    const openTag = block.split(">", 1)[0] + ">";
    const classValue = extractClassValue(openTag);

    const iconProfile = hasIconLikeMarkup(block);
    const textLike = hasTextLikeContent(block);
    const trainingGuard = hasTrainingGuard(block);
    const exemptClass = hasExemptClass(classValue);

    const issueCodes = [];

    // Compact/training compliance gap: button appears icon+text, but icon source is not in covered selectors.
    if (iconProfile.hasIcon && textLike && !iconProfile.coveredByCompactRule && !trainingGuard && !exemptClass) {
      issueCodes.push("icon_text_button_outside_compact_coverage");
    }

    if (issueCodes.length === 0) continue;

    findings.push({
      file: path.relative(ROOT, filePath).replace(/\\/g, "/"),
      line,
      classValue,
      iconEvidence: iconProfile.evidence,
      issueCodes,
      snippet: block.replace(/\s+/g, " ").slice(0, 220),
    });
  }

  return findings;
}

function main() {
  if (!fs.existsSync(TARGET)) {
    console.error("Target folder not found:", TARGET);
    process.exit(1);
  }

  const files = walk(TARGET);
  const allFindings = files.flatMap(collectFindings);

  const summaryByIssue = {};
  const summaryByFile = {};

  for (const finding of allFindings) {
    summaryByFile[finding.file] = (summaryByFile[finding.file] ?? 0) + 1;
    for (const code of finding.issueCodes) {
      summaryByIssue[code] = (summaryByIssue[code] ?? 0) + 1;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scannedRoot: path.relative(ROOT, TARGET).replace(/\\/g, "/"),
    totalSourceFilesScanned: files.length,
    totalFindings: allFindings.length,
    summaryByIssue,
    summaryByFile: Object.entries(summaryByFile)
      .sort((a, b) => b[1] - a[1])
      .map(([file, count]) => ({ file, count })),
    findings: allFindings,
  };

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`Scanned ${files.length} files.`);
  console.log(`Findings: ${allFindings.length}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH).replace(/\\/g, "/")}`);

  // Use --strict to fail CI when findings are present.
  const strictMode = process.argv.includes("--strict");
  if (strictMode && allFindings.length > 0) {
    process.exitCode = 2;
  }
}

main();
