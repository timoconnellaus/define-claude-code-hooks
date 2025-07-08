import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';

interface MockedFs {
  readFile: MockedFunction<any>;
  writeFile: MockedFunction<any>;
  mkdir: MockedFunction<any>;
  access: MockedFunction<any>;
}

export function createMockFs(): MockedFs {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn()
  };
}

export function setupFsMocks(mockFs: MockedFs, initialFileContent: Record<string, string> = {}) {
  // Mock file storage
  const fileStorage = new Map<string, string>(Object.entries(initialFileContent));

  // Mock readFile
  mockFs.readFile.mockImplementation(async (path: string) => {
    const content = fileStorage.get(path);
    if (!content) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  });

  // Mock writeFile
  mockFs.writeFile.mockImplementation(async (path: string, content: string) => {
    fileStorage.set(path, content);
  });

  // Mock mkdir
  mockFs.mkdir.mockResolvedValue(undefined);

  // Mock access (file exists check)
  mockFs.access.mockImplementation(async (path: string) => {
    if (!fileStorage.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
  });

  return {
    getFileContent: (path: string) => {
      // Handle both relative and absolute paths
      const absolutePath = require('path').resolve(path);
      const relativePathContent = fileStorage.get(path);
      const absolutePathContent = fileStorage.get(absolutePath);
      return relativePathContent || absolutePathContent;
    },
    setFileContent: (path: string, content: string) => {
      // Store with absolute path to match what the hooks use
      const absolutePath = require('path').resolve(path);
      fileStorage.set(absolutePath, content);
    },
    deleteFile: (path: string) => {
      const absolutePath = require('path').resolve(path);
      fileStorage.delete(path);
      fileStorage.delete(absolutePath);
    },
    getAllFiles: () => new Map(fileStorage)
  };
}