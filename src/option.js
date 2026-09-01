import { camelcaseOptionName, removeBrackets } from './utils.js'

export class Option {
  // NOTE: these bare field declarations are load-bearing. In the TypeScript
  // original they were typed declarations (`rawName: string`, `required?: boolean`,
  // ...). Type-stripping leaves the *declarations* behind, so every instance gets
  // these own properties (value `undefined`) in this exact order before the
  // constructor body runs. Removing them would change `Object.keys()` order,
  // `JSON.stringify()` output and `in` checks.
  rawName
  description

  /** Option name */
  name
  /** Option name and aliases */
  names
  isBoolean
  // `required` will be a boolean for options with brackets
  required
  config
  negated

  constructor(rawName, description, config) {
    this.rawName = rawName
    this.description = description
    this.config = Object.assign({}, config)

    // You may use cli.option('--env.* [value]', 'desc') to denote a dot-nested option
    rawName = rawName.replaceAll('.*', '')

    this.negated = false
    this.names = removeBrackets(rawName)
      .split(',')
      .map((v) => {
        let name = v.trim().replace(/^-{1,2}/, '')
        if (name.startsWith('no-')) {
          this.negated = true
          name = name.replace(/^no-/, '')
        }

        return camelcaseOptionName(name)
      })
      .sort((a, b) => a.length - b.length) // Sort names

    // Use the longest name (last one) as actual option name
    this.name = this.names.at(-1)

    if (this.negated && this.config.default == null) {
      this.config.default = true
    }

    if (rawName.includes('<')) {
      this.required = true
    } else if (rawName.includes('[')) {
      this.required = false
    } else {
      // No arg needed, it's boolean flag
      this.isBoolean = true
    }
  }
}
