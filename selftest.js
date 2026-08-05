#!/usr/bin/env node
/*
 * 生成器が吐いた問題を JSONL に落とすだけ。答え合わせは selftest.py（Python の ipaddress）が行う。
 * わざと別の言語・別の実装で照合する。同じロジックで検算しても意味がないため。
 *
 *   node selftest.js 300 > /tmp/q.jsonl && python3 selftest.py /tmp/q.jsonl
 */
const { STATIONS, makeQuestion } = require("./gen.js");
const n = Number(process.argv[2] || 300);
for (const s of STATIONS) {
  for (let i = 0; i < n; i++) process.stdout.write(JSON.stringify(makeQuestion(s.id, i / (n - 1))) + "\n");
}
