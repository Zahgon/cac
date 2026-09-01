import { cac } from '../src/index.js'
const cli = cac()

cli
  .command('', 'Do something')
  .alias('something')
  .action(() => {
    console.info('Did something!')
  })

cli.parse()
