import { vi } from 'vitest';

export async function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parseJsonFile(content: string): any[] {
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export function createLargeLogArray(size: number, template: Record<string, any> = {}): any[] {
  return Array.from({ length: size }, (_, i) => ({
    timestamp: new Date(Date.now() - (size - i) * 1000).toISOString(),
    ...template,
    index: i
  }));
}

export function expectJsonFileToContain(fileContent: string | undefined, expectedEntry: Record<string, any>): void {
  expect(fileContent).toBeDefined();
  const entries = parseJsonFile(fileContent!);
  expect(entries).toContainEqual(expect.objectContaining(expectedEntry));
}

export function expectJsonFileLength(fileContent: string | undefined, expectedLength: number): void {
  expect(fileContent).toBeDefined();
  const entries = parseJsonFile(fileContent!);
  expect(entries).toHaveLength(expectedLength);
}

export function mockDate(date: Date | string): () => void {
  const realDate = Date;
  const mockedDate = new Date(date);
  
  global.Date = vi.fn(() => mockedDate) as any;
  global.Date.now = vi.fn(() => mockedDate.getTime());
  global.Date.parse = realDate.parse;
  global.Date.UTC = realDate.UTC;
  
  return () => {
    global.Date = realDate;
  };
}