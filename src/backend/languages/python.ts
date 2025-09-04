import urlImport from '../../lib/url_import';
import type { Backend, Stdio } from '../';
import type { loadPyodide } from 'pyodide/pyodide';
import type { PyodideInterface } from 'pyodide';

if (typeof process !== 'undefined' && typeof process.browser === 'undefined') {
  process.browser = true;
}

const default_cdn = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

const setMplTarget = (target?: HTMLElement) => {
  if (target) {
    document['pyodideMplTarget'] = target;
  } else {
    delete document['pyodideMplTarget'];
  }
}

let cache: { cdn: string, backend: Backend } | null = null;

export default (function(props?: { cdn: string }) {
  const cdn = props?.cdn ?? default_cdn;

  if (cache?.cdn === cdn) {
    return cache.backend;
  }

  let engine: PyodideInterface | null = null;
  let stdio: Stdio | null = null;
  let load: (() => Promise<void>) | null = null;
  const backend: Backend = async (code, output, opts) => {
    if (!engine) {
      await load();
    }
    stdio = output;
    try {
      setMplTarget(output.viewEl);
      if (opts?.repl) {
        const g = globalThis as { console_input?: (promptText?: string) => string };
        g.console_input = (promptText?: string) => {
          if (promptText) {
            output.stdout(promptText);
          }
          const result =
            typeof window !== 'undefined' && typeof window.prompt === 'function'
              ? window.prompt(promptText ?? '') ?? ''
              : '';
          output.stdout(result);
          return result;
        };
        await engine.runPythonAsync(`
import builtins, js
__orig_input = builtins.input
builtins.input = js.console_input
`);
        try {
          await engine.runPythonAsync(code);
        } finally {
          await engine.runPythonAsync(`
import builtins
builtins.input = __orig_input
del __orig_input
`);
          delete g.console_input;
        }
      } else {
        await engine.runPythonAsync(code);
      }
    } catch (e) {
      output.stderr(e);
    } finally {
      setMplTarget(undefined);
    }
  };
  backend.loading = true;
  load = async () => {
    const loader = await urlImport<typeof loadPyodide>(
      `${cdn}pyodide.js`,
      () => ( window.loadPyodide )
    );
    engine = await loader({
      indexURL: cdn,
      stdout: (s) => stdio?.stdout(s),
      stderr:(s) => stdio?.stderr(s)
    });
    await engine.loadPackage('micropip');
    console.log('python loaded.');
    backend.loading = false;
  };

  cache = {
    cdn,
    backend
  };
  
  return backend;
})();