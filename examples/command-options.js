import { cac } from '../src/index.js'
const cli = cac()

cli
  .command('rm <dir>', 'Remove a dir')
  .option('-r, --recursive', 'Remove recursively')
  .action((dir, options) => {
    console.info(`remove ${dir}${options.recursive ? ' recursively' : ''}`)
  })

cli.help()

cli.parse()
