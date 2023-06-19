run('cat ./file1')
 .pipe('grep \n')
 .toStr()

run('cmd')
  .stdout(run('grep'))
  .stderr(appendTo('err.log'))


run('cmd')
  .stdout(tee(
    appendTo('log'),
    run('grep'),
  ))



capture(
  'cat ./file1',
  'grep \d',
  capture
)

run(
  'cmd',
  {
    stderr: []
    stdout: []
  }
)

run(
  'cmd',
  'filter',
  mergeStderr(),
  tee('/tmp/log'),
  output(),
)

run(
 'cmd',
 'filter',
 split(
   [],
   [],
   []
 )

)
