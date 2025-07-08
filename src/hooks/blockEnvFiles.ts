import { defineHook } from '../index';
import { PreToolUseInput } from '../types';

/**
 * Blocks reading or writing of .env files and variants (e.g., .env.local, .env.production)
 * while allowing example env files (e.g., .env.example, .env.sample)
 * 
 * @example
 * ```typescript
 * import { defineHooks, blockEnvFiles } from 'define-claude-code-hooks';
 * 
 * export default defineHooks({
 *   PreToolUse: [
 *     blockEnvFiles,
 *     // other hooks...
 *   ]
 * });
 * ```
 */
export const blockEnvFiles = defineHook('PreToolUse', {
  matcher: 'Read|Write|Edit|MultiEdit',
  handler: async (input: PreToolUseInput) => {
    const toolName = input.tool_name;
    let filePath: string | undefined;

    // Extract file path based on tool
    if (toolName === 'Read' || toolName === 'Write') {
      filePath = input.tool_input.file_path;
    } else if (toolName === 'Edit' || toolName === 'MultiEdit') {
      filePath = input.tool_input.file_path;
    }

    if (!filePath) {
      return; // No file path to check
    }

    // Normalize the file path for consistent checking
    const normalizedPath = filePath.toLowerCase();
    
    // Check if this is an example env file (allowed)
    const isExampleFile = /\.env\.(example|sample|template|dist)$/i.test(filePath) ||
                         /\.env\..*\.(example|sample|template|dist)$/i.test(filePath);
    
    if (isExampleFile) {
      return; // Allow example env files
    }

    // Check if this is a .env file or variant (blocked)
    const isEnvFile = /\.env$/i.test(filePath) || // .env
                      /\.env\.[^.]+$/i.test(filePath); // .env.local, .env.production, etc.
    
    if (isEnvFile) {
      return {
        decision: 'block' as const,
        reason: `Access to .env files is not allowed. File: ${filePath}. If you need to show an example, use .env.example or .env.sample instead.`
      };
    }
  }
});