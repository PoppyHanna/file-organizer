import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const categories = {
  Documents: [".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".pptx"],
  Images: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"],
  Archives: [".zip", ".rar", ".tar", ".gz", ".7z"],
  Code: [".js", ".py", ".java", ".cpp", ".html", ".css", ".json"],
  Videos: [".mp4", ".avi", ".mkv", ".mov", ".webm"],
  Other: [],
};

class Organizer extends EventEmitter {
  getCategory(fileName) {
    const extension = path.extname(fileName).toLowerCase();

    for (const [category, extensions] of Object.entries(categories)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }

    return "Other";
  }

  async getUniquePath(destinationPath) {
    try {
      await fs.access(destinationPath);
    } catch {
      return destinationPath;
    }

    const directory = path.dirname(destinationPath);
    const extension = path.extname(destinationPath);
    const fileName = path.basename(destinationPath, extension);

    let counter = 1;
    let newPath;

    do {
      newPath = path.join(directory, `${fileName}(${counter})${extension}`);

      counter += 1;
    } while (
      await fs
        .access(newPath)
        .then(() => true)
        .catch(() => false)
    );

    return newPath;
  }

  async organize(directory, outputDirectory) {
    try {
      const entries = await fs.readdir(directory, { recursive: true });

      let copiedFiles = 0;
      let totalSize = 0;
      const categoryCounts = {
        Documents: 0,
        Images: 0,
        Archives: 0,
        Code: 0,
        Videos: 0,
        Other: 0,
      };

      const categoryNames = [
        "Documents",
        "Images",
        "Archives",
        "Code",
        "Videos",
        "Other",
      ];

      for (const category of categoryNames) {
        const categoryPath = path.join(outputDirectory, category);

        await fs.mkdir(categoryPath, { recursive: true });
      }

      for (const entry of entries) {
        const fullPath = path.join(directory, entry);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          const category = this.getCategory(entry);

          const destinationFolder = path.join(outputDirectory, category);
          const fileName = path.basename(entry);
          const destinationPath = path.join(destinationFolder, fileName);
          const uniqueDestinationPath =
            await this.getUniquePath(destinationPath);

          const tenMB = 10 * 1024 * 1024;

          this.emit("copy-start", {
            source: fullPath,
            destination: uniqueDestinationPath,
          });

          try {
            if (stats.size < tenMB) {
              await fs.copyFile(fullPath, uniqueDestinationPath);
            } else {
              await pipeline(
                createReadStream(fullPath),
                createWriteStream(uniqueDestinationPath),
              );
            }

            copiedFiles += 1;
            totalSize += stats.size;
            categoryCounts[category] += 1;

            this.emit("copy-complete", {
              source: fullPath,
              destination: uniqueDestinationPath,
              category,
              size: stats.size,
            });
          } catch (error) {
            this.emit("copy-error", {
              source: fullPath,
              error: error.message,
            });
          }
        }
      }
      this.emit("organize-complete", {
        copiedFiles,
        totalSize,
        categoryCounts,
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

export default Organizer;
