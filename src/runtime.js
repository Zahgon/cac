// NOTE: `runtimeProcessArgs` / `runtimeInfo` are intentionally mutable exports —
// they are assigned once during runtime detection below. Upstream silenced
// eslint-plugin-import's `no-mutable-exports` here; that plugin is not part of
// this project's flat config, so the directive was removed rather than left dangling.
export let runtimeProcessArgs
export let runtimeInfo

if (typeof process !== 'undefined') {
  let runtimeName
  if (typeof Deno !== 'undefined' && typeof Deno.version?.deno === 'string') {
    runtimeName = 'deno'
  } else if (typeof Bun !== 'undefined' && typeof Bun.version === 'string') {
    runtimeName = 'bun'
  } else {
    runtimeName = 'node'
  }
  runtimeInfo = `${process.platform}-${process.arch} ${runtimeName}-${process.version}`
  runtimeProcessArgs = process.argv
} else if (typeof navigator === 'undefined') {
  runtimeInfo = `unknown`
} else {
  runtimeInfo = `${navigator.platform} ${navigator.userAgent}`
}
