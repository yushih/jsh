const child_process = require('child_process');
const stream = require('stream');

function tee(path) {
  return {
    type: tee,
    path
  };
}

function capture() {
  return { type: capture };
}

function output() {
  return {
    type: output,
  };
}

function split(pipelines) {
  return {
    type: split,
    pipelines,
  };
}

function mergeStderr() {
  return function (stdout, stderr) {
    const merged = new stream.PassThrough();
    // todo handle ending & close
    stdout.on('data', data => merged.push(data));
    stderr.on('data', data => merged.push(data));
    return { stdout: merged, stderr: null };
  };
}

function isStdErrOut(arg) {
  return Array.isArray(arg.stderr) && Array.isArray(arg.stdout);
}

function checkArgs(args) {
  let terminated = false;

  for (const arg of args) {
    const throwError = (err) => {
      throw new Error(`${err}: ${JSON.stringify(arg)}`);
    }

    if (typeof arg === 'string') {
      if (terminated) {
        throwError('stream already terminated');
      }
    } else if (arg.type === split) {
      terminated = true;
      arg.pipelines.forEach(checkArgs);
    } else if (arg.type === capture) {
      terminated = true;
    } else if (arg.type === output) {
      terminated = true;
    } else if (isStdErrOut(arg)) {
      terminated = true;
    } else if (typeof(arg) === 'function') {
    } else {
      throwError('unrecognized cmd');
    }
  }
}

function _run(
  args,
  upstreamStdout, upstreamStderr,
  exitPromises,
  captureCallback,
) {
  let stdout = upstreamStdout;
  let stderr = upstreamStderr;

  for (const arg of args) {
    if (typeof arg === 'string') {
      const child = child_process.spawn(
        arg,
        {
          shell: true,
          // todo: is this an optimization if `stdout` has a fd ?
          // stdio: [stdout, 'pipe', 'pipe']
        }
      );
      stdout.pipe(child.stdin);
      stdout = child.stdout;
      stderr = child.stderr;
      exitPromises.push(new Promise(resolve => {
        child.on('exit', function (_code, _signal) {
          resolve();
        });
      }));
    } else if (arg.type === split) {
      for (const pipeline of arg.pipelines) {
        const subStdout = new stream.PassThrough();
        const subStderr = new stream.PassThrough();
        _run(pipeline, subStdout, subStderr, exitPromises, captureCallback);
        stdout.on('data', data => subStdout.write(data));
        stderr.on('data', data => subStderr.write(data));
      }
    } else if (arg.type === capture) {
      stdout.on('data', captureCallback);
    } else if (arg.type === output) {
      stdout.pipe(process.stdout);
    } else if (isStdErrOut(arg)) {
      _run(arg.stderr, stderr, null, exitPromises, captureCallback);
      _run(arg.stderr, stdout, null, exitPromises, captureCallback);
    } else if (typeof arg === 'function') {
      const ret = arg(stdout, stderr);
      //todo: sanitize
      stdout = ret.stdout;
      stderr = ret.stderr;
    } else {
      throwError('unrecognized cmd');
    }
  }

}

async function run(...args) {
  checkArgs(args);
  const exitPromises = [];
  let captured;
  const capture = _run(
    args,
    process.stdin,
    null,
    exitPromises,
    function captureCallback(data) {
      if (!captured) {
        captured = [data];
      } else {
        captured.push(data);
      }
    },
  );
  await Promise.all(exitPromises);
  if (captured) {
    return captured.map(buffer => buffer.toString('utf8')).join('');
  } else {
    return undefined;
  }
}

module.exports = { run, output };
