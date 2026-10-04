# File Organizer

File Organizer is a command-line application built with Node.js for analyzing, organizing, and cleaning files in a directory.

The application can recursively scan directories, find duplicate files using SHA-256 hashes, organize files into categories, and find or delete old files.

## Features

- Recursively scan directories and collect file statistics
- Group files by extension and age
- Find the three largest files and the oldest file
- Find duplicate files using SHA-256 hashes
- Calculate wasted disk space caused by duplicates
- Organize files into categories
- Handle filename conflicts without overwriting existing files
- Use streams for large files
- Find old files using dry run mode
- Delete old files with the `--confirm` flag
- Track operations using EventEmitter events

## Requirements

- Node.js 22 or later
- npm

## Installation

Clone the repository and open the project directory.

Install dependencies:

```bash
npm install
```

The project does not require additional external packages.

## Usage

The application supports four commands:

- `scan`
- `duplicates`
- `organize`
- `cleanup`

Commands can be executed using npm scripts.

### Scan

Recursively scans a directory and displays statistics about its files.

```bash
npm run scan -- ./path-to-directory
```

The report includes:

- total number of files
- total size
- files grouped by extension
- files modified within the last 7 and 30 days
- files older than 90 days
- three largest files
- oldest file

### Duplicates

Searches for files with identical content using SHA-256 hashes.

```bash
npm run duplicates -- ./path-to-directory
```

The command uses `fs.createReadStream()` to calculate hashes without loading entire files into memory.

The report displays duplicate groups, file paths, SHA-256 hashes, and the amount of wasted disk space.

### Organize

Copies files from a source directory to a target directory and organizes them by file type.

```bash
npm run organize -- ./source-directory --output ./target-directory
```

The `--output` argument specifies the target directory.

Files are organized into:

- Documents
- Images
- Archives
- Code
- Videos
- Other

Original files remain in the source directory.

Files smaller than 10 MB are copied using `fs.copyFile()`. Files of 10 MB or larger are copied using streams and `pipeline()`.

If a file with the same name already exists, a numeric suffix is added:

```text
file.pdf
file(1).pdf
file(2).pdf
```

### Cleanup

Finds files older than a specified number of days.

Dry run:

```bash
npm run cleanup -- ./path-to-directory --older-than 90
```

The `--older-than` argument specifies the minimum file age in days.

Without `--confirm`, the command only displays files that match the condition and does not delete them.

To delete the files:

```bash
npm run cleanup -- ./path-to-directory --older-than 90 --confirm
```

The `--confirm` flag enables actual file deletion.

## Project Structure

```text
file-organizer/
├── package.json
├── .gitignore
├── README.md
├── file-organizer.js
└── lib/
    ├── scanner.js
    ├── duplicates.js
    ├── organizer.js
    └── cleanup.js
```

### Files

- `file-organizer.js` — application entry point and command-line argument handling
- `lib/scanner.js` — directory scanning and statistics
- `lib/duplicates.js` — duplicate detection using SHA-256
- `lib/organizer.js` — file organization and copying
- `lib/cleanup.js` — old file detection and deletion

## EventEmitter

Each command is implemented as a class that extends `EventEmitter`.

Events are used to separate file-processing logic from console output and to track the progress of operations.

## Error Handling

File system operations use `try...catch` blocks to handle errors, including:

- `ENOENT` — directory or file does not exist
- `EACCES` — permission denied
- other unexpected file system errors