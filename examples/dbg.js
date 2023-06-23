const child_process = require('child_process');

const child = child_process.spawn(
  'echo hello',
  {
    shell: true,
    stdio: [process.stdin, 'pipe', 'pipe']
  }
);
//process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);

child.on('exit', function () {
  console.log('exit');

  // process.stdin.destroy();
  //not working:
  child.stdout.unpipe(process.stdout);
  process.stdin.unpipe(child.stdin);

});
