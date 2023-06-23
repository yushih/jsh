const jsh = require('../src');

(async function main() {
  await jsh.run(
    'cat ./src/index.js',
    jsh.transform(async function (readline, writeline) {
      for (;;) {
        const l = await readline();
        if (l === undefined) {
          return;
        }
        writeline('>' + l);
      }
    }),
  );


  await new Promise(resolve => {setTimeout(resolve, 999999)});
  
})().catch(error => console.error(error));
