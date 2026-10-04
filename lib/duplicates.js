import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

import { EventEmitter } from "events";

class DuplicateFinder extends EventEmitter {
  calculateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => {
        hash.update(chunk);
      });

      stream.on("end", () => {
        resolve(hash.digest("hex"));
      });

      stream.on("error", (error) => {
        reject(error);
      });
    });
  }

  async find(directory) {
    try {
      const entries = await fsp.readdir(directory, { recursive: true });
      const hashGroups = new Map();

      let totalFiles = 0;

      for (const entry of entries) {
        const fullPath = path.join(directory, entry);
        const stats = await fsp.stat(fullPath);

        if (stats.isFile()) {
          totalFiles += 1;
        }
      }

      let processedFiles = 0;

      for (const entry of entries) {
        const fullPath = path.join(directory, entry);
        const stats = await fsp.stat(fullPath);

        if (stats.isFile()) {
          const hash = await this.calculateHash(fullPath);

          processedFiles += 1;

          this.emit("file-processed", {
            path: fullPath,
            size: stats.size,
            current: processedFiles,
            total: totalFiles,
          });

          if (!hashGroups.has(hash)) {
            hashGroups.set(hash, []);
          }

          hashGroups.get(hash).push({
            path: fullPath,
            size: stats.size,
          });
        }
      }

      const duplicateGroups = [];

      let wastedSpace = 0;

      for (const [hash, files] of hashGroups) {
        if (files.length > 1) {
          const fileSize = files[0].size;
          const groupWastedSpace = fileSize * (files.length - 1);

          wastedSpace += groupWastedSpace;

          duplicateGroups.push({
            hash,
            files,
            wastedSpace: groupWastedSpace,
          });
        }
      }

      this.emit("duplicates-found", {
        groups: duplicateGroups,
        wastedSpace,
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

export default DuplicateFinder;
