const jsh = require('../src');

(async function main() {
  const out = await jsh.run(
    jsh.seq(
      jsh.includeStderr('echo "something to stderr" 1>&2'),
      'echo "not captured stderr" 1>&2',
      'echo "something to stdout"',
    ),
    'grep stderr',
    jsh.capture(),
  );
  
  console.log('captured "%s"', out);
})().catch(error => console.error(error));
