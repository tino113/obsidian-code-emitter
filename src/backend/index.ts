import languages from './languages';
import type { Stdio } from './store';

export { createStdio } from './store';
export type { Stdio } from './store';

export type Backend = {
    loading?: boolean;
    (code: string, output: Stdio, opts?: { repl?: boolean }): Promise<void>
}


export default {
  ...languages,
};