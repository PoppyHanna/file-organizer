import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";

class Cleanup extends EventEmitter {
  async clean(directory, olderThan, confirm) {
    try {
      let affectedFiles = 0;
      let totalSize = 0;
      const filesToDelete = [];

      const entries = await fs.readdir(directory, { recursive: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          const fileAge = Date.now() - stats.mtime.getTime();
          const daysOld = fileAge / (1000 * 60 * 60 * 24);

          if (daysOld > olderThan) {
            affectedFiles += 1;
            totalSize += stats.size;

            const fileData = {
              path: fullPath,
              size: stats.size,
              daysOld: Math.floor(daysOld),
            };

            filesToDelete.push(fileData);
            this.emit("file-found", fileData);
          }
        }
      }

      let deletedFiles = 0;

      if (confirm) {
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          deletedFiles += 1;

          this.emit("file-deleted", {
            ...file,
            current: deletedFiles,
            total: filesToDelete.length,
          });
        }
      }

      this.emit("cleanup-complete", {
        affectedFiles,
        totalSize,
        confirm,
      });
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

export default Cleanup;
