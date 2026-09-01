import { cac } from '../src/index.js'
const cli = cac()

cli.option('--type [type]', 'Choose a project type')

const parsed = cli.parse()

console.info(JSON.stringify(parsed, null, 2))
