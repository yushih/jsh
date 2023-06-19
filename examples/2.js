(async function main() {
  const out = await run (
    'echo x 1>&2',
    mergeStderr(),
//    capture(),
//    output(),
  );
  
  console.log('output', out);
})().then(error => console.error);
