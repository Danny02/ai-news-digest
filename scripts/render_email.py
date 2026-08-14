#!/usr/bin/env python3
"""Render the monochrome signal/noise email from a markdown digest.

Usage: python3 scripts/render_email.py drafts/digest-2026-08-03.md > out.html
"""
import pathlib
import re
import sys

# One contrast carries the whole design: grey is noise, white is signal.
# Themes are told apart by their label and the hairline above them, never by
# colour, so nothing depends on a client rendering an accent correctly.
INK = "#ffffff"
BODY = "#b8b8b8"
MUTED = "#7a7a7a"
RULE = "#1e1e1e"
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

ROOT = pathlib.Path(__file__).resolve().parent.parent


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(text: str) -> str:
    text = esc(text)
    # Pull links out to placeholders FIRST so the bold/italic/underscore passes
    # cannot mangle the href or the author handle (a "_" inside a URL or name
    # would otherwise be eaten by the italic regex).
    links = {}
    def stash(m):
        k = f"\u0000{len(links)}\u0000"
        links[k] = f'<a href="{m.group(2)}" style="color:{INK}; text-decoration:underline; text-underline-offset:2px;">{m.group(1)}</a>'
        return k
    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", stash, text)
    text = re.sub(
        r"\*\*(.+?)\*\*",
        rf'<strong style="font-weight:700; color:{INK};">\1</strong>',
        text,
    )
    text = re.sub(
        r"`(.+?)`",
        rf'<span style="font-family:{MONO}; font-size:0.92em; color:{INK};">\1</span>',
        text,
    )
    text = re.sub(r"_(.+?)_", rf'<em style="font-style:italic; color:{BODY};">\1</em>', text)
    # restore links
    for k, v in links.items():
        text = text.replace(k, v)
    return text

def build_body(sections: list) -> str:
    parts = []
    for section in sections:
        # Every item is led by the same 2px white bar used as the "passed the
        # filter" mark on the web page. A background-coloured cell is the only
        # rule shape Outlook renders reliably at this width.
        items_html = "\n".join(
            "                    <tr>\n"
            "                      <td style=\"padding:8px 0;\">\n"
            "                        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">\n"
            "                          <tr>\n"
            f'                            <td width="2" style="width:2px; background-color:{INK}; font-size:0; line-height:0;">&nbsp;</td>\n'
            "                            <td width=\"16\" style=\"width:16px; font-size:0; line-height:0;\">&nbsp;</td>\n"
            "                            <td>\n"
            f'                              <div style="font-size:15px; line-height:23px; color:{BODY};">'
            + inline(item)
            + "</div>\n"
            "                            </td>\n"
            "                          </tr>\n"
            "                        </table>\n"
            "                      </td>\n"
            "                    </tr>"
            for item in section["items"]
        )

        chip = (
            f'<span style="font-family:{MONO}; color:{MUTED}; font-size:11px; '
            f'letter-spacing:0.18em; text-transform:uppercase;">'
            f'{esc(section["label"].upper())}</span>'
        )

        title = (
            f'<div style="font-size:19px; line-height:26px; font-weight:800; '
            f'letter-spacing:-0.025em; color:{INK};">'
            + esc(section["title"])
            + "</div>"
        )

        parts.append(
            '          <tr><td style="padding:0 6px;">\n'
            f'            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {RULE};">\n'
            '              <tr><td style="padding:26px 0 30px 0;">\n'
            '                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n'
            '                  <tr><td style="padding:0 0 9px 0;">' + chip + "</td></tr>\n"
            '                  <tr><td style="padding:0 0 14px 0;">' + title + "</td></tr>\n"
            '                  <tr><td style="padding:0;">\n'
            '                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n'
            + items_html
            + "\n"
            + "                    </table>\n"
            + "                  </td></tr>\n"
            + "                </table>\n"
            + "              </td></tr>\n"
            + "            </table>\n"
            + "          </td></tr>"
        )
    return "\n".join(parts)


def parse(md: str) -> list:
    sections, current = [], None
    KEYMAP = {
        "qwen": "qwen", "opus": "opus", "harness": "harness", "context": "context",
        "tools": "tools", "gpt": "gpt", "agentic": "agentic",
    }
    CHIPMAP = {
        "qwen": "Models", "opus": "Models", "harness": "Orchestration",
        "context": "Context", "tools": "Tools", "gpt": "Models", "agentic": "Agents",
    }
    for raw in md.splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            if current:
                sections.append(current)
            title = line[3:].strip()
            lower = title.lower()
            current = {"title": title, "items": [], "key": "context", "label": "Digest"}
            for key, theme_key in KEYMAP.items():
                if key in lower:
                    current["key"] = theme_key
                    break
            for key, chip in CHIPMAP.items():
                if key in lower:
                    current["label"] = chip
                    break
        elif line.startswith("- ") and current:
            current["items"].append(line[2:].strip())
        elif current and current["items"] and line.strip() and not line.startswith("#"):
            # Soft-wrapped continuation line — join onto the previous bullet so
            # wrapped sentences are not truncated mid-phrase.
            current["items"][-1] += " " + line.strip()
    # Collapse newlines inside a bullet to spaces (each item renders as one line).
    for s in sections:
        s["items"] = [re.sub(r"\s+", " ", i) for i in s["items"]]
    if current:
        sections.append(current)
    return sections


def main() -> int:
    src = pathlib.Path(sys.argv[1])
    date = src.stem.replace("digest-", "").replace("-", "/")
    sections = parse(src.read_text())
    tpl = (ROOT / "templates" / "email.html").read_text()
    html = tpl.replace("{{ DATE }}", esc(date)).replace("{{ BODY }}", build_body(sections))
    sys.stdout.write(html)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
