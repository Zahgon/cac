import { Option } from './option.js'
import { runtimeInfo } from './runtime.js'
import {
  CACError,
  findAllBrackets,
  findLongest,
  padRight,
  removeBrackets,
} from './utils.js'

export class Command {
  // Preserved from the TypeScript declarations — see note in `option.js`.
  // Declaration order here determines own-property order on every instance.
  rawName
  description
  config
  cli

  options
  aliasNames
  /* Parsed command name */
  name
  args
  commandAction
  usageText
  versionNumber
  examples
  helpCallback
  globalCommand

  constructor(rawName, description, config = {}, cli) {
    this.rawName = rawName
    this.description = description
    this.config = config
    this.cli = cli

    this.options = []
    this.aliasNames = []
    this.name = removeBrackets(rawName)
    this.args = findAllBrackets(rawName)
    this.examples = []
  }

  usage(text) {
    this.usageText = text
    return this
  }

  allowUnknownOptions() {
    this.config.allowUnknownOptions = true
    return this
  }

  ignoreOptionDefaultValue() {
    this.config.ignoreOptionDefaultValue = true
    return this
  }

  version(version, customFlags = '-v, --version') {
    this.versionNumber = version
    this.option(customFlags, 'Display version number')
    return this
  }

  example(example) {
    this.examples.push(example)
    return this
  }

  /**
   * Add a option for this command
   * @param rawName Raw option name(s)
   * @param description Option description
   * @param config Option config
   */
  option(rawName, description, config) {
    const option = new Option(rawName, description, config)
    this.options.push(option)
    return this
  }

  alias(name) {
    this.aliasNames.push(name)
    return this
  }

  action(callback) {
    this.commandAction = callback
    return this
  }

  /**
   * Check if a command name is matched by this command
   * @param name Command name
   */
  isMatched(name) {
    return this.name === name || this.aliasNames.includes(name)
  }

  get isDefaultCommand() {
    return this.name === '' || this.aliasNames.includes('!')
  }

  get isGlobalCommand() {
    return this instanceof GlobalCommand
  }

  /**
   * Check if an option is registered in this command
   * @param name Option name
   */
  hasOption(name) {
    name = name.split('.', 1)[0]
    return this.options.find((option) => {
      return option.names.includes(name)
    })
  }

  outputHelp() {
    const { name, commands } = this.cli
    const {
      versionNumber,
      options: globalOptions,
      helpCallback,
    } = this.cli.globalCommand

    let sections = [
      {
        body: `${name}${versionNumber ? `/${versionNumber}` : ''}`,
      },
    ]

    sections.push({
      title: 'Usage',
      body: `  $ ${name} ${this.usageText || this.rawName}`,
    })

    const showCommands =
      (this.isGlobalCommand || this.isDefaultCommand) && commands.length > 0

    if (showCommands) {
      const longestCommandName = findLongest(
        commands.map((command) => command.rawName),
      )
      sections.push(
        {
          title: 'Commands',
          body: commands
            .map((command) => {
              return `  ${padRight(
                command.rawName,
                longestCommandName.length,
              )}  ${command.description}`
            })
            .join('\n'),
        },
        {
          title: `For more info, run any command with the \`--help\` flag`,
          body: commands
            .map(
              (command) =>
                `  $ ${name}${
                  command.name === '' ? '' : ` ${command.name}`
                } --help`,
            )
            .join('\n'),
        },
      )
    }

    let options = this.isGlobalCommand
      ? globalOptions
      : [...this.options, ...(globalOptions || [])]
    if (!this.isGlobalCommand && !this.isDefaultCommand) {
      options = options.filter((option) => option.name !== 'version')
    }
    if (options.length > 0) {
      const longestOptionName = findLongest(
        options.map((option) => option.rawName),
      )
      sections.push({
        title: 'Options',
        body: options
          .map((option) => {
            return `  ${padRight(option.rawName, longestOptionName.length)}  ${
              option.description
            } ${
              option.config.default === undefined
                ? ''
                : `(default: ${option.config.default})`
            }`
          })
          .join('\n'),
      })
    }

    if (this.examples.length > 0) {
      sections.push({
        title: 'Examples',
        body: this.examples
          .map((example) => {
            if (typeof example === 'function') {
              return example(name)
            }
            return example
          })
          .join('\n'),
      })
    }

    if (helpCallback) {
      sections = helpCallback(sections) || sections
    }

    console.info(
      sections
        .map((section) => {
          return section.title
            ? `${section.title}:\n${section.body}`
            : section.body
        })
        .join('\n\n'),
    )
  }

  outputVersion() {
    const { name } = this.cli
    const { versionNumber } = this.cli.globalCommand
    if (versionNumber) {
      console.info(`${name}/${versionNumber} ${runtimeInfo}`)
    }
  }

  checkRequiredArgs() {
    const minimalArgsCount = this.args.filter((arg) => arg.required).length

    if (this.cli.args.length < minimalArgsCount) {
      throw new CACError(
        `missing required args for command \`${this.rawName}\``,
      )
    }
  }

  /**
   * Check if the parsed options contain any unknown options
   *
   * Exit and output error when true
   */
  checkUnknownOptions() {
    const { options, globalCommand } = this.cli

    if (!this.config.allowUnknownOptions) {
      for (const name of Object.keys(options)) {
        if (
          name !== '--' &&
          !this.hasOption(name) &&
          !globalCommand.hasOption(name)
        ) {
          throw new CACError(
            `Unknown option \`${name.length > 1 ? `--${name}` : `-${name}`}\``,
          )
        }
      }
    }
  }

  /**
   * Check if the required string-type options exist
   */
  checkOptionValue() {
    const { options: parsedOptions, globalCommand } = this.cli
    const options = [...globalCommand.options, ...this.options]
    for (const option of options) {
      const value = parsedOptions[option.name.split('.', 1)[0]]
      // Check required option value
      if (option.required) {
        const hasNegated = options.some(
          (o) => o.negated && o.names.includes(option.name),
        )
        if (value === true || (value === false && !hasNegated)) {
          throw new CACError(`option \`${option.rawName}\` value is missing`)
        }
      }
    }
  }

  /**
   * Check if the number of args is more than expected
   */
  checkUnusedArgs() {
    const hasVariadicArg = this.args.some((arg) => arg.variadic)
    const maximumArgsCount = hasVariadicArg ? Infinity : this.args.length

    if (maximumArgsCount < this.cli.args.length) {
      const argsString = this.cli.args
        .slice(maximumArgsCount)
        .map((arg) => `\`${arg}\``)
        .join(', ')
      throw new CACError(`Unused args: ${argsString}`)
    }
  }
}

export class GlobalCommand extends Command {
  constructor(cli) {
    super('@@global@@', '', {}, cli)
  }
}
