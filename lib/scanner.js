import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";

class Scanner extends EventEmitter {
  async scan(directory) {
    try {
      this.emit("scan-start", { directory });

      const entries = await fs.readdir(directory, { recursive: true });

      const statistics = {
        totalFiles: 0,
        totalSize: 0,
        byType: new Map(),
        age: {
          last7Days: 0,
          last30Days: 0,
          olderThan90Days: 0,
        },
        largestFiles: [],
        oldestFile: null,
      };

      for (const entry of entries) {
        const fullPath = path.join(directory, entry);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          const fileData = {
            path: fullPath,
            size: stats.size,
            modified: stats.mtime,
            extension: path.extname(entry).toLowerCase(),
          };

          if (
            !statistics.oldestFile ||
            fileData.modified < statistics.oldestFile.modified
          ) {
            statistics.oldestFile = fileData;
          }

          statistics.largestFiles.push(fileData);

          statistics.totalFiles += 1;
          statistics.totalSize += stats.size;

          this.emit("progress", statistics.totalFiles);

          const extension = fileData.extension || "(other)";

          if (!statistics.byType.has(extension)) {
            statistics.byType.set(extension, {
              count: 0,
              totalSize: 0,
            });
          }

          const typeStats = statistics.byType.get(extension);

          typeStats.count += 1;
          typeStats.totalSize += stats.size;

          const fileAge = Date.now() - stats.mtime.getTime();
          const daysOld = fileAge / (1000 * 60 * 60 * 24);

          if (daysOld <= 7) {
            statistics.age.last7Days += 1;
          }

          if (daysOld <= 30) {
            statistics.age.last30Days += 1;
          }

          if (daysOld > 90) {
            statistics.age.olderThan90Days += 1;
          }

          this.emit("file-found", fileData);
        }
      }

      statistics.largestFiles.sort((a, b) => b.size - a.size);
      statistics.largestFiles = statistics.largestFiles.slice(0, 3);

      this.emit("scan-complete", statistics);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.error(`Error: Directory "${directory}" does not exist.`);
      } else if (error.code === "EACCES") {
        console.error(`Error: Permission denied for "${directory}".`);
      } else {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }
}

export default Scanner;
