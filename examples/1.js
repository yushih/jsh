const jsh = require('../src');

jsh.run(
  `cat ${__filename}`,
  'grep -i stdout',

);
