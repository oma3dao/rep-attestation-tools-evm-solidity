/**
 * Shared helper to run a Hardhat task via CLI and optionally expect an error.
 * Used by generate-bas-object, generate-eas-object, and eas-encode-data task tests.
 */
import { execSync } from "child_process";

export function runHardhatTask(
  taskName: string,
  args: string,
  opts: { expectError?: boolean; cwd?: string } = {}
): string {
  const cmd = `npx hardhat ${taskName} ${args}`.trim();
  try {
    const execOpts: { encoding: "utf-8"; cwd?: string } = { encoding: "utf-8" };
    if (opts.cwd) execOpts.cwd = opts.cwd;
    const output = execSync(cmd, execOpts);
    if (opts.expectError) throw new Error("Expected error, but task succeeded");
    return output;
  } catch (err: any) {
    if (opts.expectError) return err.message || String(err);
    throw err;
  }
}
