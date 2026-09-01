import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Resolve against the CALLER's cwd, not this file's directory.
const p = pathToFileURL(path.resolve(process.cwd(), process.argv[2])).href
const { cac, CAC, Command } = await import(p)
const out = []
const ser = (v) =>
  JSON.stringify(v, (k, x) => (x === undefined ? '__undef' : x))
const S = [
  [(c) => c, ['node', 'bin']],
  [(c) => c, ['node', 'bin', 'a', 'b', '--', 'x', 'y']],
  [
    (c) =>
      c
        .option('--foo [f]', 'd')
        .option('--no-foo', 'd')
        .option('--bar [b]', 'd')
        .option('--no-bar', 'd'),
    ['node', 'bin', '--foo', 'foo', '--bar'],
  ],
  [
    (c) => c.option('--no-clear-screen', 'x').option('--no-a-b, --no-c-d', 'd'),
    ['node', 'bin'],
  ],
  [
    (c) => c.option('--env <e>', 'd'),
    ['node', 'bin', '--env.A', '1', '--env.B', '2'],
  ],
  [
    (c) => c.option('--ext <e>', 'd', { type: [] }),
    ['node', 'bin', '--ext.env.prod', 'production'],
  ],
  [
    (c) => c.option('--ext <e>', 'd', { type: [] }),
    ['node', 'bin', '--ext', 'a', '--ext', 'b'],
  ],
  [
    (c) => c.option('--n <n>', 'd', { type: [Number] }),
    ['node', 'bin', '--n', '42'],
  ],
  [
    (c) => c.option('--foo-bar', 'd').option('--aB', 'd'),
    ['node', 'bin', '--fooBar', '--a-b'],
  ],
  [(c) => c.option('--type [t]', 'd', { default: 'node' }), ['node', 'bin']],
  [(c) => c.option('-r, --recursive', 'd'), ['node', 'bin', '-r']],
  [(c) => c.option('--foo <f>', 'd'), ['node', 'bin', '--foo=bar']],
]
for (const [setup, argv] of S) {
  const cli = cac()
  setup(cli)
  try {
    const r = cli.parse(argv, { run: false })
    out.push(ser({ args: r.args, options: r.options, name: cli.name }))
  } catch (e) {
    out.push('ERR:' + e.name + ':' + e.message)
  }
}
// error paths
const errs = [
  () => {
    const c = cac()
    c.command('build [e]', 'B')
      .option('--foo-bar', 'd')
      .action(() => {})
    c.parse('node bin build app.js --xx'.split(' '))
  },
  () => {
    const c = cac()
    c.command('build [e]', 'B').action(() => {})
    c.parse('node bin build a foo bar'.split(' '))
  },
  () => {
    const c = cac()
    c.command('build <e>', 'B').action(() => {})
    c.parse('node bin build'.split(' '))
  },
]
for (const f of errs) {
  try {
    f()
    out.push('NOERR')
  } catch (e) {
    out.push('ERR:' + e.name + ':' + e.message)
  }
}
// structural
const cli = cac('x')
const cmd = cli.command('build <e>', 'B')
out.push(
  ser({
    cacKeys: Object.keys(cli),
    cmdKeys: Object.keys(cmd),
    proto: Object.getOwnPropertyNames(CAC.prototype).sort(),
    cproto: Object.getOwnPropertyNames(Command.prototype).sort(),
  }),
)
process.stdout.write(out.join('\n'))
