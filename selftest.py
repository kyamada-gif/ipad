#!/usr/bin/env python3
"""生成器の答えを、Python の ipaddress で作り直して照合する。

gen.js と同じ計算を書き直したものではなく、標準ライブラリに計算させて突き合わせる。
同じ実装で検算しても、同じ間違いをするだけで意味がないため。

    node selftest.js 300 > /tmp/q.jsonl && python3 selftest.py /tmp/q.jsonl
"""
import ipaddress
import json
import re
import sys
from collections import Counter

fails: list[str] = []
counts: Counter = Counter()


def g(q, key):
    for it in q["given"]:
        if it["k"] == key:
            return it["v"]
    return None


def expect(q, want):
    if str(q["answer"]) != str(want):
        fails.append(f'{q["station"]}  期待={want!r}  生成器={q["answer"]!r}  given={q["given"]}')


def verify(q):
    s = q["station"]
    counts[s] += 1

    if q["input"] not in ("pow", "sum", "sub", "split", "pick", "stack", "mask", "final", "table"):
        fails.append(f'{s}  知らない盤: {q["input"]}')
    if len(q.get("steps", [])) < 2:
        fails.append(f"{s}  手順が足りない")

    if s == "S0":                                   # 2の◯乗
        n, v = q["board"]["n"], q["board"]["v"]
        if v != 2 ** n:
            fails.append(f"S0  盤の中で食い違う: 2^{n} != {v}")
        expect(q, str(2 ** n) if q["goal"] == "toValue" else str(n))

    elif s == "S1":                                 # 2進数 → 10進数
        expect(q, int(g(q, "2進数"), 2))

    elif s == "S2":                                 # 10進数 → 2進数
        v = int(g(q, "10進数"))
        expect(q, format(v, "08b"))
        if q.get("target") != v:
            fails.append(f"S2  盤の target が問題と違う: {q.get('target')} / {v}")

    elif s == "S3":                                 # 先頭と末尾
        net = ipaddress.ip_network(f'{g(q,"IPアドレス")}/{g(q,"サブネットマスク")}', strict=False)
        expect(q, f"{net.network_address} / {net.broadcast_address}")

    elif s == "S4":                                 # 使えるアドレスの範囲
        net = ipaddress.ip_network(g(q, "IPアドレス"), strict=False)
        expect(q, f"{net.network_address + 1} 〜 {net.broadcast_address - 1}")

    elif s == "S5":                                 # 台数 → マスク
        need = int(re.sub(r"[^0-9]", "", g(q, "必要なホスト数")))
        ln = 32
        while ipaddress.ip_network(f"0.0.0.0/{ln}").num_addresses - 2 < need and ln > 0:
            ln -= 1
        expect(q, f"/{ln}（{ipaddress.ip_network(f'0.0.0.0/{ln}').netmask}）")

    elif s == "S6":                                 # 個数 → マスク
        # いまの試験の数え方（サブネットゼロも使える）＝ 2のn乗。教材の「+2」は使わない
        base = int(re.search(r"/(\d+)", g(q, "使うアドレス")).group(1))
        want = int(re.sub(r"[^0-9]", "", g(q, "必要なサブネット数")))
        b = 0
        while 2 ** b < want:
            b += 1
        ln = min(30, base + b)
        expect(q, f"/{ln}（{ipaddress.ip_network(f'0.0.0.0/{ln}').netmask}）")

    elif s == "S9":                                 # ワイルドカードマスク
        ln = q["board"]["len"]
        m = ipaddress.ip_network(f"0.0.0.0/{ln}").netmask
        if g(q, "サブネットマスク") != str(m):
            fails.append(f"S9  材料と盤が食い違う: {q['given']} / {q['board']}")
        expect(q, ".".join(str(255 - int(x)) for x in str(m).split(".")))

    elif q["input"] == "table":                     # 桁の重み表をうめる
        expect(q, "128 64 32 16 8 4 2 1")
    elif s == "SF":                                 # 仕上げ（本番の形）
        k = q["goal"]
        if k == "mask":
            ip, ln = g(q, "IPアドレス").split("/")
            expect(q, str(ipaddress.ip_network(f"{ip}/{ln}", strict=False).netmask))
        elif k == "binmask":
            expect(q, "/" + str(sum(o.count("1") for o in g(q, "サブネットマスク（2進数）").split("."))))
        elif k in ("net", "bc", "gw"):
            n = ipaddress.ip_network(g(q, "IPアドレス"), strict=False)
            expect(q, str(n.network_address) if k == "net"
                   else str(n.broadcast_address) if k == "bc"
                   else str(n.network_address + 1))
        elif k == "same":
            a = ipaddress.ip_interface(g(q, "1台目")).ip
            b = ipaddress.ip_interface(g(q, "2台目")).ip
            L = next(n for n in range(32, -1, -1)
                     if ipaddress.ip_network(f"{a}/{n}", strict=False).network_address
                     == ipaddress.ip_network(f"{b}/{n}", strict=False).network_address)
            expect(q, str(ipaddress.ip_network(f"{a}/{L}", strict=False).netmask))
        elif k == "sum":
            ns = [ipaddress.ip_network(x["v"]) for x in q["given"]]
            expect(q, str(next(n for n in ipaddress.collapse_addresses(ns))))
        elif k == "hosts":
            ln = int(g(q, "サブネットマスク").split("/")[1].rstrip("）"))
            expect(q, f"{2 ** (32 - ln) - 2}台")
    elif s == "S8":                                 # プレフィックス長 ↔ サブネットマスク
        ln = q["board"]["len"]
        net = ipaddress.ip_network(f"0.0.0.0/{ln}")
        if q["goal"] == "toMask":
            if g(q, "プレフィックス長") != f"/{ln}":
                fails.append(f"S8  材料と盤が食い違う: {q['given']} / {q['board']}")
            expect(q, str(net.netmask))
        else:
            if g(q, "サブネットマスク") != str(net.netmask):
                fails.append(f"S8  材料と盤が食い違う: {q['given']} / {q['board']}")
            expect(q, f"/{ln}")

    elif s == "S7":                                 # まとめる（集約）
        nets = [ipaddress.ip_network(it["v"]) for it in q["given"]]
        merged = list(ipaddress.collapse_addresses(nets))
        if len(merged) != 1:
            fails.append(f"S7  1本にまとまらない材料: {q['given']} → {merged}")
        else:
            expect(q, str(merged[0]))
        # 盤に出す並びが、材料と食い違っていないか
        oc = q["board"]["oc"]
        if [n_.split("/")[0].split(".")[oc] for n_ in q["board"]["nets"]] != \
           [it["v"].split("/")[0].split(".")[oc] for it in q["given"]]:
            fails.append(f"S7  盤の並びが材料と違う: {q['board']}")

    else:
        fails.append(f"{s}  検算の仕方が未実装")


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                verify(json.loads(line))
    total = sum(counts.values())
    print(f"検算した問題  {total} 問（{len(counts)} ステージ × {total // max(len(counts),1)} 問）")
    if fails:
        print(f"\n食い違い {len(fails)} 件（先頭20件）:")
        for line in fails[:20]:
            print("  " + line)
        sys.exit(1)
    print("すべて一致。")


if __name__ == "__main__":
    main()
