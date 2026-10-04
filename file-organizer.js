import Scanner from "./lib/scanner.js";
import DuplicateFinder from "./lib/duplicates.js";
import Organizer from "./lib/organizer.js";
import Cleanup from "./lib/cleanup.js";

const command = process.argv[2];
const directory = process.argv[3];
const args = process.argv.slice(4);

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

function drawProgressBar(current, total, width = 20) {
  if (total === 0) {
    return `${"░".repeat(width)} 0/0`;
  }

  const percentage = current / total;
  const filled = Math.round(percentage * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);

  return `${bar} ${current}/${total}`;
}

if (command === "scan") {
  const scanner = new Scanner();

  scanner.on("scan-start", (data) => {
    console.log(`Scanning: ${data.directory}`);
  });

  scanner.on("progress", ({ current, total }) => {
    process.stdout.write(`\r${drawProgressBar(current, total)}`);
  });

  scanner.on("scan-complete", (statistics) => {
    console.log();

    console.log("Total files:", statistics.totalFiles);
    console.log("Total size:", formatSize(statistics.totalSize));

    console.log("\nBy File Type:");

    for (const [extension, data] of statistics.byType) {
      console.log(
        `  ${extension}: ${data.count} files, ${formatSize(data.totalSize)}`,
      );
    }

    console.log("\nFile Age:");
    console.log(`  Last 7 days: ${statistics.age.last7Days} files`);
    console.log(`  Last 30 days: ${statistics.age.last30Days} files`);
    console.log(
      `  Older than 90 days: ${statistics.age.olderThan90Days} files`,
    );

    console.log("\nTop 3 Largest Files:");

    statistics.largestFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.path} - ${formatSize(file.size)}`);
    });

    if (statistics.oldestFile) {
      console.log("\nOldest File:");
      console.log(`  ${statistics.oldestFile.path}`);
      console.log(
        `  Modified: ${statistics.oldestFile.modified.toLocaleString()}`,
      );
    }
  });

  await scanner.scan(directory);
}

if (command === "duplicates") {
  const duplicateFinder = new DuplicateFinder();

  duplicateFinder.on("file-processed", ({ current, total }) => {
    process.stdout.write(
      `\rCalculating hashes... ${drawProgressBar(current, total)}`,
    );
  });

  duplicateFinder.on("duplicates-found", (result) => {
    console.log();

    console.log(`\nFound ${result.groups.length} duplicate groups:\n`);

    result.groups.forEach((group, index) => {
      console.log(`Group ${index + 1}:`);
      console.log(`  SHA-256: ${group.hash}`);

      group.files.forEach((file) => {
        console.log(`  ${file.path} (${formatSize(file.size)})`);
      });

      console.log(`  Wasted space: ${formatSize(group.wastedSpace)}\n`);
    });

    console.log(`Total wasted space: ${formatSize(result.wastedSpace)}`);
  });

  await duplicateFinder.find(directory);
}

if (command === "organize") {
  const organizer = new Organizer();

  const outputIndex = args.indexOf("--output");

  if (outputIndex === -1 || !args[outputIndex + 1]) {
    console.error("Error: Please specify --output directory.");
    process.exit(1);
  }

  const outputDirectory = args[outputIndex + 1];

  organizer.on("copy-complete", ({ current, total }) => {
    process.stdout.write(
      `\rCopying files... ${drawProgressBar(current, total)}`,
    );
  });

  organizer.on("copy-error", (data) => {
    console.error(`Failed to copy ${data.source}: ${data.error}`);
  });

  organizer.on("organize-complete", (data) => {
    console.log();
    console.log("\nOrganization complete!");

    console.log("\nSummary:");

    for (const [category, count] of Object.entries(data.categoryCounts)) {
      console.log(`  ${category}: ${count} files`);
    }

    console.log(`\nTotal copied: ${data.copiedFiles} files`);
    console.log(`Total size: ${formatSize(data.totalSize)}`);
  });

  await organizer.organize(directory, outputDirectory);
}

if (command === "cleanup") {
  const cleanup = new Cleanup();

  const olderThanIndex = args.indexOf("--older-than");

  if (olderThanIndex === -1 || !args[olderThanIndex + 1]) {
    console.error("Error: Please specify --older-than N.");
    process.exit(1);
  }

  const olderThan = Number(args[olderThanIndex + 1]);

  if (Number.isNaN(olderThan) || olderThan < 0) {
    console.error("Error: --older-than must be a positive number.");
    process.exit(1);
  }

  const confirm = args.includes("--confirm");

  cleanup.on("file-found", (file) => {
    if (!confirm) {
      console.log(
        `[DRY RUN] ${file.path} - ${formatSize(file.size)} - ${file.daysOld} days old`,
      );
    } else {
      console.log(
        `[FOUND] ${file.path} - ${formatSize(file.size)} - ${file.daysOld} days old`,
      );
    }
  });

  cleanup.on("file-deleted", ({ current, total }) => {
    process.stdout.write(`\rDeleting... ${drawProgressBar(current, total)}`);
  });

  cleanup.on("cleanup-complete", (data) => {
    if (data.confirm) {
      console.log();
    }

    console.log("\nCleanup complete!");
    console.log(
      `${data.confirm ? "Deleted" : "Found"} files: ${data.affectedFiles}`,
    );
    console.log(`Total size: ${formatSize(data.totalSize)}`);
  });

  await cleanup.clean(directory, olderThan, confirm);
}
