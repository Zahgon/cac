import { cac } from '../src/index.js'
const cli = cac()

cli
  .command('something', 'Do something')
  .alias('!')
  .action(() => {
    console.info('Did something!')
  })

cli.parse()
