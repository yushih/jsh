const child_process = require('child_process');
const stream = require('stream');
const readline = require('readline');

/* 
type runtime:
{
  stdout:
  stderr:
  exitPromise:
}

type runnable function:
function (stdin, captureCallback) {
  return runtime;
}

type runnable:
{
  run: runnable function
}
*/

function cmdToRunnable(cmd) {
  if (typeof cmd === 'string') {
    function runCmdStr(stdin) {
      /*
      stdin.on('data', function (data) {
        console.log('>>>%s input', cmd, data.toString());
      });
      */
      const child = child_process.spawn(
        cmd,
        {
          shell: true,
          // not working:
          //stdio: [stdin, 'pipe', 'pipe']
        }
      );
      stdin.pipe(child.stdin);
      return {
        stdout: child.stdout,
        stderr: child.stderr,
        exitPromise: new Promise((resolve, reject) => {
          child.on('exit', function (_code, _signal) {
            stdin.destroy();
            resolve();
          });
        }),
      };
    } // runCmdStr
    return {
      run: runCmdStr,
    };
  } else if (typeof cmd === 'function') {
    return { run: cmd };
  } else {
    throw new Error('unrecognized cmd');
  }
}


//  func: runtime => runtime
function manipulateRuntime(cmd, func) {
  const runnable = cmdToRunnable(cmd);
  return function (stdin) {
    const runtime = runnable.run(stdin);
    return func(runtime);
  };
}

function handleStderr(cmd, func) {
  return manipulateRuntime(cmd, function (runtime) {
    func(stdErr);
    return runtime;
  });
}

function includeStderr(cmd) {
  return manipulateRuntime(cmd, function (runtime) {
    //not working: runtime.stderr.pipe(runtime.stdout);
    const merged = new stream.PassThrough();
    runtime.stderr.on('data', data => merged.write(data));
    runtime.stdout.on('data', data => merged.write(data));
    return {
      ...runtime,
      stdout: merged,
      stderr: null,
    };
  });
}

function capture() {
  return function (stdin, captureCallback) {
    stdin.on('data', captureCallback);
    return {
      stdout: null, //? or stdin
      stderr: null,
      exitPromise: new Promise(resolve => stdin.on('end', resolve)),
    };
  };
}

// todo: handle input exhaust before all cmds run
function seq(...cmds) {
  const runnables = cmds.map(cmdToRunnable);
  const stdout = new stream.PassThrough();
  const stderr = new stream.PassThrough();

  return function (stdin, captureCallback) {
    return {
      stdout,
      stderr,
      exitPromise: (async function () {
        for (let i = 0; i < runnables.length; i++) {
          const runtime = runnables[i].run(stdin, captureCallback);
          const end = (i === runnables.length - 1);
          runtime.stdout.pipe(stdout, { end });
          if (runtime.stderr) {
            runtime.stderr.pipe(stderr, { end });
          }
          await runtime.exitPromise;
        }
      })(),
    };
  }
}

function transform(func) {
  const stdout = new stream.PassThrough;
  function writeLine(l) {
    stdout.write(l);
    stdout.write('\n');
  };

  return function (stdin) {
    stdin.pause();
    let ended = false;
    stdin.once('end', () => { ended = true; });
    const cachedLines = [];
    let tail;
    let resolveCallback;
    stdin.on('data', function (buf) {
      const str = buf.toString('utf8');
      const lines = str.split('\n');
      const last = lines.pop();
      if (tail) {
        tail = tail + last;
      } else {
        tail = last;
      }
      cachedLines.push(...lines);
      if (cachedLines.length) {
        stdin.pause();
        if (resolveCallback) {
          const resolve = resolveCallback;
          resolveCallback = undefined;
          resolve(cachedLines.shift());
        }
      }
    });

    function readLine() {
      if (cachedLines.length) {
        return cachedLines.shift();
      } else if (tail && ended) {
        const ret = tail;
        tail = undefined;
        return tail;
      } else if (ended) {
        return undefined;
      } else {
        stdin.resume();
        return new Promise(resolve => {
          resolveCallback = resolve;
        });
      }
    };
    return {
      stdout,
      stderr: null,
      exitPromise: func(readLine, writeLine).then(() => { stdout.close(); }),
    };
  };
}

// todo: ?make this return runnable function
async function run(...cmds) {
  const runnables = cmds.map(cmdToRunnable);

  let pipe = process.stdin;
  const exitPromises = [];
  let captures;
  function captureCallback(data) {
    if (captures) {
      captures.push(data);
    } else {
      captures = [data];
    }
  }

  for (const runnable of runnables) {
    const runtime = runnable.run(pipe, captureCallback);
    pipe = runtime.stdout;
    if (runtime.stderr) {
      runtime.stderr.pipe(process.stdout);
    }
    exitPromises.push(runtime.exitPromise);
  }
  if (pipe) {
    pipe.pipe(process.stdout);
  }
  await Promise.all(exitPromises);
  if (captures) {
    return captures.map(buffer => buffer.toString('utf8')).join('');
  } else {
    return undefined;
  }
}

module.exports = {
  run,
  handleStderr,
  includeStderr,
  capture,
  seq,
  transform,
};

