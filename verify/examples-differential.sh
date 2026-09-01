#!/bin/bash
# Differential harness for the `examples/` directory.
#
# Spawns every example under both trees with an identical argv matrix and compares
# stdout+stderr and exit code. File extensions and the containing path are
# normalised away, since those necessarily differ between the two trees.
#
# Usage: examples-differential.sh <original-examples-dir> <migrated-examples-dir>
#   e.g. examples-differential.sh ../cac/examples ./examples

set -u
TS="${1:?usage: examples-differential.sh <original-examples-dir> <migrated-examples-dir>}"
JS="${2:?usage: examples-differential.sh <original-examples-dir> <migrated-examples-dir>}"

CASES=(
  "basic-usage|foo bar --type ok command"
  "basic-usage|"
  "basic-usage|--type"
  "variadic-arguments|--foo build a b c d"
  "variadic-arguments|build x"
  "variadic-arguments|--help"
  "ignore-default-value|build"
  "ignore-default-value|"
  "help|--help"
  "help|lint --help"
  "help|--version"
  "help|lint a b"
  "help|"
  "default-command|"
  "default-command|something"
  "default-command-inverted|"
  "default-command-inverted|something"
  "command-examples|build --help"
  "command-examples|build"
  "command-options|rm mydir -r"
  "command-options|--help"
  "command-options|rm"
  "dot-nested-options|build --env.API_SECRET xxx --foo-bar v"
  "dot-nested-options|--help"
  "negated-option|"
  "negated-option|--no-clear-screen"
  "sub-command|--help"
  "sub-command|bar 1 2 3 4"
  "sub-command|cook rice beans"
  "sub-command|deploy ./dist --token t"
  "sub-command|a b c"
  "sub-command|--version"
)

pass=0
fail=0
for c in "${CASES[@]}"; do
  name="${c%%|*}"
  args="${c#*|}"

  ao=$(node "$TS/$name.ts" $args 2>&1)
  ax=$?
  bo=$(node "$JS/$name.js" $args 2>&1)
  bx=$?

  # Normalise the two things that MUST differ: the containing path and the
  # source extension (both appear in uncaught-error stack traces).
  an=$(printf '%s' "$ao" | sed "s|$TS/||g; s|\.ts|.EXT|g")
  bn=$(printf '%s' "$bo" | sed "s|$JS/||g; s|\.js|.EXT|g")

  if [ "$an" = "$bn" ] && [ "$ax" = "$bx" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "DIVERGE: $name [$args] (exit $ax vs $bx)"
    diff <(printf '%s' "$an") <(printf '%s' "$bn") | head -12
  fi
done

echo "================================================"
echo "example differential: $pass identical, $fail divergent"
[ "$fail" -eq 0 ] || echo "NOTE: stack-trace line numbers legitimately differ; compare error name/message/exit code."
