/**
 * Differential harness: runs an identical battery of scenarios against either the
 * original TypeScript implementation or the migrated JavaScript one, and prints a
 * deterministic JSON transcript. Any behavioral divergence shows up as a diff.
 *
 * Usage: node cac_diff.mjs <path-to-src-dir>
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Resolve against the CALLER's cwd (not this file), and detect .ts vs .js by
// probing the filesystem rather than sniffing the path string.
const srcDir = path.resolve(process.cwd(), process.argv[2])
const ext = existsSync(path.join(srcDir, 'index.ts')) ? 'ts' : 'js'
const mod = (n) => pathToFileURL(path.join(srcDir, `${n}.${ext}`)).href

const { cac, CAC, Command } = await import(mod('index'))
const utils = await import(mod('utils'))
const { Option } = await import(mod('option'))
const { GlobalCommand } = await import(mod('command'))

const out = []
const rec = (name, fn) => {
  const logs = []
  const origInfo = console.info
  const origLog = console.log
  console.info = (...a) => logs.push(a.map(String).join(' '))
  console.log = (...a) => logs.push(a.map(String).join(' '))
  let result, error
  try {
    result = fn()
  } catch (e) {
    error = { name: e.name, message: e.message, isCACError: e.constructor.name }
  } finally {
    console.info = origInfo
    console.log = origLog
  }
  out.push({ name, result: ser(result), error, logs })
}

// Deterministic serializer: captures own-property shape, key order, undefined, types.
function ser(v, depth = 0) {
  if (depth > 8) return '<max-depth>'
  if (v === undefined) return { __undefined: true }
  if (v === null) return null
  const t = typeof v
  if (t === 'number' && !Number.isFinite(v)) return { __num: String(v) }
  if (t === 'string' || t === 'number' || t === 'boolean') return v
  if (t === 'function') return { __fn: v.name, __len: v.length }
  if (Array.isArray(v)) return v.map((x) => ser(x, depth + 1))
  if (v instanceof Error)
    return { __err: v.name, message: v.message, ctor: v.constructor.name }
  if (t === 'object') {
    const o = { __keys: Object.keys(v), __ctor: v.constructor?.name ?? null }
    for (const k of Object.keys(v)) o[k] = ser(v[k], depth + 1)
    return o
  }
  return String(v)
}

/* ---------------------- utils: pure function battery ---------------------- */
rec('utils.removeBrackets', () =>
  ['build <a>', 'x [b]', 'plain', '  sp  <c>', '<a> [b]', ''].map(
    utils.removeBrackets,
  ),
)
rec('utils.findAllBrackets', () =>
  [
    'build <entry> [...others]',
    'cook <...food>',
    '[...files]',
    'a <b> <c> [d]',
    'none',
  ].map(utils.findAllBrackets),
)
rec('utils.findLongest', () => [
  utils.findLongest(['a', 'bbb', 'cc']),
  utils.findLongest(['x']),
])
rec('utils.padRight', () => [
  utils.padRight('ab', 5),
  utils.padRight('abcdef', 3),
  utils.padRight('', 2),
])
rec('utils.camelcase', () =>
  ['foo-bar', 'a-b-c', 'no-change', 'A-b', 'x', 'foo-bar-baz'].map(
    utils.camelcase,
  ),
)
rec('utils.camelcaseOptionName', () =>
  ['foo-bar', 'env.API-KEY', 'a-b.c-d', 'x'].map(utils.camelcaseOptionName),
)
rec('utils.getFileName', () =>
  ['/a/b/c.js', 'C:\\x\\y.exe', 'plain', '', '/trailing/'].map(
    utils.getFileName,
  ),
)
rec('utils.setDotProp', () => {
  const a = {}
  utils.setDotProp(a, ['x', 'y'], 1)
  const b = {}
  utils.setDotProp(b, ['x', '0'], 'arr')
  const c = { x: { y: 'old' } }
  utils.setDotProp(c, ['x', 'y'], 'new')
  const d = {}
  utils.setDotProp(d, ['solo'], true)
  return [a, b, c, d]
})
rec('utils.setByType', () => {
  const o1 = { a: 'x' }
  utils.setByType(o1, { a: { shouldTransform: true } })
  const o2 = { a: ['1', '2'] }
  utils.setByType(o2, {
    a: { shouldTransform: true, transformFunction: Number },
  })
  const o3 = { a: 'keep' }
  utils.setByType(o3, { a: { shouldTransform: false } })
  return [o1, o2, o3]
})
rec('utils.CACError', () => {
  const e = new utils.CACError('boom')
  return {
    name: e.name,
    message: e.message,
    isError: e instanceof Error,
    ctor: e.constructor.name,
    hasStack: typeof e.stack === 'string',
  }
})

/* ------------------------- Option construction ---------------------------- */
rec('Option shapes', () =>
  [
    '--foo',
    '--foo <bar>',
    '--foo [bar]',
    '-f, --foo',
    '--no-foo',
    '--no-a-b, --no-c-d',
    '--env.* [value]',
    '--foo-bar <v>',
    '-r, --recursive',
  ].map((raw) => {
    const o = new Option(raw, 'desc')
    return {
      rawName: o.rawName,
      name: o.name,
      names: o.names,
      negated: o.negated,
      isBoolean: o.isBoolean,
      required: o.required,
      config: o.config,
      ownKeys: Object.keys(o),
    }
  }),
)
rec('Option with default/type config', () => {
  const a = new Option('--x [v]', 'd', { default: 5 })
  const b = new Option('--y <v>', 'd', { type: [String] })
  const c = new Option('--no-z', 'd', { default: false })
  return [a.config, b.config, c.config]
})
rec('utils.getMriOptions', () => {
  const opts = [
    new Option('--foo [f]', 'd'),
    new Option('--no-foo', 'd'),
    new Option('-b, --bar', 'd'),
    new Option('--baz <v>', 'd'),
    new Option('--no-solo', 'd'),
  ]
  return utils.getMriOptions(opts)
})

/* --------------------------- CAC parse battery ---------------------------- */
const scenarios = [
  ['bare', (c) => c, ['node', 'bin']],
  ['plain args', (c) => c, ['node', 'bin', 'a', 'b']],
  [
    'negated both',
    (c) =>
      c
        .option('--foo [foo]', 'Set foo')
        .option('--no-foo', 'Disable foo')
        .option('--bar [bar]', 'Set bar')
        .option('--no-bar', 'Disable bar'),
    ['node', 'bin', '--foo', 'foo', '--bar'],
  ],
  [
    'negated defaults',
    (c) =>
      c.option('--no-clear-screen', 'x').option('--no-a-b, --no-c-d', 'desc'),
    ['node', 'bin'],
  ],
  [
    'double dashes',
    (c) => c,
    ['node', 'bin', 'foo', 'bar', '--', 'npm', 'test'],
  ],
  ['double dashes empty', (c) => c, ['node', 'bin', '--']],
  [
    'dot nested',
    (c) => c.option('--env <env>', 'Set envs'),
    ['node', 'bin', '--env.API_SECRET', 'xxx', '--env.B', '2'],
  ],
  [
    'array no transform (nested)',
    (c) =>
      c
        .option('--externals <external>', 'd', { type: [] })
        .option('--scale [level]', 'd'),
    ['node', 'bin', '--externals.env.prod', 'production', '--scale'],
  ],
  [
    'array no transform (repeat)',
    (c) => c.option('--externals <e>', 'd', { type: [] }),
    ['node', 'bin', '--externals', 'foo', '--externals', 'bar'],
  ],
  [
    'array with transform',
    (c) => c.option('--config <c>', 'd', { type: [String] }),
    ['node', 'bin', '--config', 'config.js'],
  ],
  [
    'array transform Number',
    (c) => c.option('--n <n>', 'd', { type: [Number] }),
    ['node', 'bin', '--n', '42', '--n', '7'],
  ],
  [
    'camelcase flags',
    (c) => c.option('--foo-bar', 'd').option('--aB', 'd'),
    ['node', 'bin', '--fooBar', '--a-b'],
  ],
  [
    'default values',
    (c) => c.option('--type [t]', 'd', { default: 'node' }),
    ['node', 'bin'],
  ],
  [
    'default overridden',
    (c) => c.option('--type [t]', 'd', { default: 'node' }),
    ['node', 'bin', '--type', 'deno'],
  ],
  [
    'alias resolution',
    (c) => c.option('-r, --recursive', 'd'),
    ['node', 'bin', '-r'],
  ],
  [
    'name inferred from argv[1]',
    (c) => c,
    ['node', '/usr/local/bin/mytool', 'x'],
  ],
  ['numeric-ish args', (c) => c, ['node', 'bin', '007', '1.5', '-3']],
  [
    'equals syntax',
    (c) => c.option('--foo <f>', 'd'),
    ['node', 'bin', '--foo=bar'],
  ],
]

for (const [label, setup, argv] of scenarios) {
  rec(`parse:${label}`, () => {
    const cli = cac()
    setup(cli)
    const parsed = cli.parse(argv, { run: false })
    return {
      args: parsed.args,
      options: parsed.options,
      name: cli.name,
      rawArgs: cli.rawArgs,
      matchedCommandName: cli.matchedCommandName,
    }
  })
}

/* ------------------------- command / error paths -------------------------- */
rec('error: unknown option', () => {
  const cli = cac()
  cli
    .command('build [entry]', 'Build')
    .option('--foo-bar', 'd')
    .option('--aB', 'd')
    .action(() => {})
  cli.parse(`node bin build app.js --fooBar --a-b --xx`.split(' '))
})
rec('error: unused args', () => {
  const cli = cac()
  cli.command('build [entry]', 'Build').action(() => {})
  cli.parse(`node bin build app.js foo bar`.split(' '))
})
rec('error: missing required args', () => {
  const cli = cac()
  cli.command('build <entry>', 'Build').action(() => {})
  cli.parse(`node bin build`.split(' '))
})
rec('error: option value missing', () => {
  const cli = cac()
  cli.option('--config <config>', 'config file')
  cli.parse(`node bin --config`.split(' '), { run: false })
  cli.globalCommand.checkOptionValue()
})
rec('negated option validation passes', () => {
  const cli = cac()
  cli.option('--config <config>', 'config file')
  cli.option('--no-config', 'no config file')
  const { options } = cli.parse(`node bin --no-config`.split(' '))
  cli.globalCommand.checkOptionValue()
  return options.config
})
rec('allowUnknownOptions', () => {
  const cli = cac()
  cli
    .command('build', 'B')
    .allowUnknownOptions()
    .action(() => 'ran')
  return cli.parse(`node bin build --whatever`.split(' ')).options
})
rec('ignoreOptionDefaultValue', () => {
  const cli = cac()
  cli
    .command('build', 'B', { ignoreOptionDefaultValue: true })
    .option('--type [t]', 'd', { default: 'node' })
  return cli.parse(`node bin build`.split(' ')).options
})
rec('variadic action args', () => {
  const seen = []
  const cli = cac()
  cli
    .command('build <entry> [...others]', 'B')
    .option('--foo', 'd')
    .action((...a) => seen.push(ser(a)))
  cli.parse(`node bin --foo build a b c d`.split(' '))
  return seen
})
rec('default command via empty name', () => {
  const seen = []
  const cli = cac()
  cli
    .command('', 'Do')
    .alias('something')
    .action(() => seen.push('did'))
  cli.parse(['node', 'bin'])
  return seen
})
rec('default command inverted alias !', () => {
  const seen = []
  const cli = cac()
  cli
    .command('something', 'Do')
    .alias('!')
    .action(() => seen.push('did'))
  cli.parse(['node', 'bin'])
  return seen
})
rec('command matching + aliases', () => {
  const cli = cac()
  const cmd = cli.command('rm <dir>', 'Remove').alias('remove')
  return {
    isMatchedName: cmd.isMatched('rm'),
    isMatchedAlias: cmd.isMatched('remove'),
    isMatchedNo: cmd.isMatched('nope'),
    isDefaultCommand: cmd.isDefaultCommand,
    isGlobalCommand: cmd.isGlobalCommand,
    globalIsGlobal: cli.globalCommand.isGlobalCommand,
    name: cmd.name,
    args: cmd.args,
    hasOptionMissing: cmd.hasOption('zzz'),
  }
})

/* ------------------------------ help / version ---------------------------- */
rec('help: global', () => {
  const cli = cac('mytool')
  cli.option('--type [type]', 'Choose a project type', { default: 'node' })
  cli.option('--name <name>', 'Provide your name')
  cli.command('lint [...files]', 'Lint files').action(() => {})
  cli.command('[...files]', 'Run files').action(() => {})
  cli.help()
  cli.version('0.0.0')
  cli.parse(['node', 'mytool', '--help'])
})
rec('help: sub command', () => {
  const cli = cac('mytool')
  cli.option('--type [type]', 'Choose a project type', { default: 'node' })
  cli.command('lint [...files]', 'Lint files').action(() => {})
  cli.help()
  cli.version('0.0.0')
  cli.parse(['node', 'mytool', 'lint', '--help'])
})
rec('help: with examples + callback', () => {
  const cli = cac('mytool')
  cli
    .command('build', 'Build project')
    .example('cli build foo.js')
    .example((name) => `${name} build foo.js`)
    .option('--type [type]', 'Choose a project type')
  cli.help((sections) => {
    sections.push({ title: 'Extra', body: '  hello' })
  })
  cli.parse(['node', 'mytool', 'build', '--help'])
})
rec('help: usage override', () => {
  const cli = cac('mytool')
  cli.usage('custom usage text')
  cli.help()
  cli.parse(['node', 'mytool', '--help'])
})
rec('version output shape', () => {
  const cli = cac('mytool')
  cli.version('1.2.3')
  cli.parse(['node', 'mytool', '--version'])
})

/* --------------------------- structural identity -------------------------- */
rec('class shapes', () => {
  const cli = cac('x')
  const cmd = cli.command('build <e>', 'B')
  return {
    cacOwnKeys: Object.keys(cli),
    cacProtoMethods: Object.getOwnPropertyNames(CAC.prototype).sort(),
    commandProtoMethods: Object.getOwnPropertyNames(Command.prototype).sort(),
    optionProtoMethods: Object.getOwnPropertyNames(Option.prototype).sort(),
    globalProtoMethods: Object.getOwnPropertyNames(
      GlobalCommand.prototype,
    ).sort(),
    cmdOwnKeys: Object.keys(cmd),
    globalOwnKeys: Object.keys(cli.globalCommand),
    cacIsEventTarget: cli instanceof EventTarget,
    globalIsCommand: cli.globalCommand instanceof Command,
    cacName: CAC.name,
    cacLength: CAC.length,
    commandLength: Command.length,
    optionLength: Option.length,
  }
})
rec('events dispatched', () => {
  const seen = []
  const cli = cac('x')
  cli.command('build', 'B').action(() => {})
  cli.addEventListener('command:build', () => seen.push('command:build'))
  cli.parse(['node', 'x', 'build'])
  const cli2 = cac('y')
  cli2.addEventListener('command:*', (e) => seen.push(`command:*:${e.detail}`))
  cli2.parse(['node', 'y', 'unknown-thing'])
  const cli3 = cac('z')
  cli3.command('', 'D').action(() => {})
  cli3.addEventListener('command:!', () => seen.push('command:!'))
  cli3.parse(['node', 'z'])
  return seen
})
rec('unsetMatchedCommand + setParsedInfo present', () => {
  const cli = cac('x')
  return {
    hasSetParsedInfo: typeof cli.setParsedInfo,
    hasMri: typeof cli.mri,
    hasUnset: typeof cli.unsetMatchedCommand,
  }
})
rec('parse with run:true returns action value path', () => {
  const cli = cac('x')
  let called = 0
  cli.command('build', 'B').action(() => {
    called++
    return 'rv'
  })
  cli.parse(['node', 'x', 'build'])
  return { called, rv: cli.runMatchedCommand() }
})

process.stdout.write(JSON.stringify(out, null, 2))
