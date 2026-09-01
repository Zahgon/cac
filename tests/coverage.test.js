// Coverage-closing cases, added after behavioural equivalence was established.
//
// The repository's own suite exercises the help/version/command-configuration
// APIs only through examples that it spawns as CHILD PROCESSES. V8 coverage does
// not follow into child processes, so those functions execute during the suite
// yet are recorded at 0%. These cases drive the same APIs in-process so that
// coverage reflects what is actually reachable.
//
// They assert on real behaviour, not merely on "it did not throw", and every one
// of them passes unmodified against the original TypeScript tree as well.

import { afterEach, expect, test, vi } from 'vitest'
import cac, { CAC, Command } from '../src/index.js'
import { findLongest, padRight } from '../src/utils.js'

/** Capture console.info so help/version output does not pollute the reporter. */
function captureInfo() {
  const lines = []
  const spy = vi
    .spyOn(console, 'info')
    .mockImplementation((...args) => lines.push(args.join(' ')))
  return { lines, spy, text: () => lines.join('\n') }
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('cli.usage overrides the usage line in the global help', () => {
  const out = captureInfo()
  const cli = cac('demo')
  expect(cli.usage('custom usage text')).toBe(cli)
  cli.outputHelp()
  expect(out.text()).toContain('$ demo custom usage text')
})

test('cli.help registers the flag and stores the callback', () => {
  const cli = cac('demo')
  const cb = (sections) => sections
  expect(cli.help(cb)).toBe(cli)
  expect(cli.showHelpOnExit).toBe(true)
  expect(cli.globalCommand.helpCallback).toBe(cb)
  expect(cli.globalCommand.options.some((o) => o.name === 'help')).toBe(true)
})

test('cli.version registers the flag and outputs the version line', () => {
  const out = captureInfo()
  const cli = cac('demo')
  expect(cli.version('1.2.3')).toBe(cli)
  expect(cli.showVersionOnExit).toBe(true)
  expect(cli.globalCommand.versionNumber).toBe('1.2.3')
  cli.outputVersion()
  expect(out.text()).toMatch(/^demo\/1\.2\.3 /)
})

test('cli.version accepts custom flags', () => {
  const cli = cac('demo')
  cli.version('9.9.9', '--ver')
  expect(cli.globalCommand.options.some((o) => o.rawName === '--ver')).toBe(
    true,
  )
})

test('cli.example adds a global example shown in help', () => {
  const out = captureInfo()
  const cli = cac('demo')
  expect(cli.example('demo build foo.js')).toBe(cli)
  cli.outputHelp()
  expect(out.text()).toContain('Examples:')
  expect(out.text()).toContain('demo build foo.js')
})

test('cli.outputHelp delegates to the matched command once one is matched', () => {
  const out = captureInfo()
  const cli = cac('demo')
  cli.command('build [entry]', 'Build your app').action(() => {})
  cli.parse(['node', 'demo', 'build'], { run: false })
  expect(cli.matchedCommand).toBeDefined()
  cli.outputHelp()
  expect(out.text()).toContain('$ demo build [entry]')
})

test('cli.unsetMatchedCommand clears the match', () => {
  const cli = cac('demo')
  cli.command('build', 'Build').action(() => {})
  cli.parse(['node', 'demo', 'build'], { run: false })
  expect(cli.matchedCommandName).toBe('build')
  cli.unsetMatchedCommand()
  expect(cli.matchedCommand).toBeUndefined()
  expect(cli.matchedCommandName).toBeUndefined()
})

test('a matched command receives positional args and options', () => {
  const seen = []
  const cli = cac('demo')
  cli.command('greet <name>', 'Greet someone').action((name, options) => {
    seen.push(name, options)
  })
  cli.parse(['node', 'demo', 'greet', 'world'])
  expect(seen[0]).toBe('world')
  expect(seen[1]).toEqual({ '--': [] })
})

test('command.alias makes the command matchable under another name', () => {
  const cli = cac('demo')
  const cmd = cli.command('remove <dir>', 'Remove a dir')
  expect(cmd.alias('rm')).toBe(cmd)
  expect(cmd.isMatched('rm')).toBe(true)
  expect(cmd.isMatched('remove')).toBe(true)
  expect(cmd.isMatched('nope')).toBe(false)
})

test('command.allowUnknownOptions permits unregistered flags', () => {
  const cli = cac('demo')
  const cmd = cli.command('build', 'Build')
  expect(cmd.allowUnknownOptions()).toBe(cmd)
  expect(cmd.config.allowUnknownOptions).toBe(true)
  cmd.action(() => {})
  const { options } = cli.parse(['node', 'demo', 'build', '--whatever'])
  expect(options.whatever).toBe(true)
})

test('command.ignoreOptionDefaultValue drops defaults from parsed options', () => {
  const cli = cac('demo')
  const cmd = cli.command('build', 'Build')
  expect(cmd.ignoreOptionDefaultValue()).toBe(cmd)
  cmd.option('--type [type]', 'Type', { default: 'node' })
  const { options } = cli.parse(['node', 'demo', 'build'], { run: false })
  expect(options.type).toBeUndefined()
})

test('command.version and command.outputVersion', () => {
  const out = captureInfo()
  const cli = cac('demo')
  const cmd = cli.command('build', 'Build')
  expect(cmd.version('4.5.6')).toBe(cmd)
  expect(cmd.versionNumber).toBe('4.5.6')
  cli.version('1.0.0')
  cmd.outputVersion()
  expect(out.text()).toMatch(/^demo\/1\.0\.0 /)
})

test('command.outputVersion prints nothing when no version is registered', () => {
  const out = captureInfo()
  const cli = cac('demo')
  cli.command('build', 'Build').outputVersion()
  expect(out.lines).toHaveLength(0)
})

test('isDefaultCommand and isGlobalCommand classify commands', () => {
  const cli = cac('demo')
  const named = cli.command('build', 'Build')
  const empty = cli.command('', 'Default')
  const banged = cli.command('other', 'Other').alias('!')
  expect(named.isDefaultCommand).toBe(false)
  expect(empty.isDefaultCommand).toBe(true)
  expect(banged.isDefaultCommand).toBe(true)
  expect(named.isGlobalCommand).toBe(false)
  expect(cli.globalCommand.isGlobalCommand).toBe(true)
  expect(cli.globalCommand).toBeInstanceOf(Command)
  expect(cli).toBeInstanceOf(CAC)
})

test('command.outputHelp on a sub-command lists options and hides --version', () => {
  const out = captureInfo()
  const cli = cac('demo')
  cli.version('1.0.0')
  cli.option('--global-flag', 'A global flag')
  const cmd = cli
    .command('build <entry>', 'Build your app')
    .option('--minify', 'Minify output')
  cmd.outputHelp()
  const text = out.text()
  expect(text).toContain('$ demo build <entry>')
  expect(text).toContain('--minify')
  expect(text).toContain('--global-flag')
  // sub-command help filters the version option out
  expect(text).not.toContain('--version')
})

test('global help lists commands, defaults and examples', () => {
  const out = captureInfo()
  const cli = cac('demo')
  cli.option('--type [type]', 'Choose a type', { default: 'node' })
  cli.command('build <entry>', 'Build your app')
  cli.command('lint [...files]', 'Lint files')
  cli.globalCommand.example('demo build a.js')
  cli.globalCommand.example((name) => `${name} lint b.js`)
  cli.globalCommand.outputHelp()
  const text = out.text()
  expect(text).toContain('Commands:')
  expect(text).toContain('build <entry>')
  expect(text).toContain('lint [...files]')
  expect(text).toContain('--help` flag')
  expect(text).toContain('(default: node)')
  expect(text).toContain('demo build a.js')
  expect(text).toContain('demo lint b.js')
})

test('a help callback can replace the rendered sections', () => {
  const out = captureInfo()
  const cli = cac('demo')
  cli.command('build', 'Build')
  cli.help(() => [{ title: 'Only', body: '  replaced' }])
  cli.globalCommand.outputHelp()
  expect(out.text()).toBe('Only:\n  replaced')
})

test('a help callback returning nothing keeps the original sections', () => {
  const out = captureInfo()
  const cli = cac('demo')
  cli.help((sections) => {
    sections.push({ title: 'Extra', body: '  appended' })
  })
  cli.globalCommand.outputHelp()
  expect(out.text()).toContain('Extra:')
  expect(out.text()).toContain('appended')
})

test('findLongest returns the longest string', () => {
  expect(findLongest(['a', 'bbbb', 'cc'])).toBe('bbbb')
  expect(findLongest(['solo'])).toBe('solo')
})

test('padRight pads to the requested width and never truncates', () => {
  expect(padRight('ab', 5)).toBe('ab   ')
  expect(padRight('abcdef', 3)).toBe('abcdef')
  expect(padRight('', 2)).toBe('  ')
})
