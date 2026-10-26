"""把 content/ 里的 Markdown 生成静态网页，放进 docs/（GitHub Pages 从这里发布）。

运行：uv run python build.py（本机预览：uv run python build.py --local 目录，链接改成直接指向 index.html，双击就能打开）
- 每篇开头是 --- 包起来的几行「键: 值」：title、date、summary、kind（home / research / note / review / tool / about / list）、figure（列表里配的图）。
- 单独一行的 {{chart:文件名|图题|说明}} 换成 charts/ 里对应的 SVG，带图题；{{svg:文件名}} 只插 SVG；{{raw:文件名}} 插 charts/ 里的 HTML 片段。
- {{list:note}}、{{list:review}} 换成对应栏目的文章列表，按日期从新到旧，每行配上那篇的主图。
- 标题字（得意黑，SIL OFL）按全站标题实际用到的字裁成子集，改名 JZ Display，放在 assets/fonts/。
地址都是「栏目/文件名/」，比如 content/notes/2026-10-19-gdp.md → docs/notes/2026-10-19-gdp/index.html。
"""
from __future__ import annotations

import html
import pathlib
import re
import shutil
import sys
import subprocess

import markdown

ROOT = pathlib.Path(__file__).parent
CONTENT, OUT, CHARTS = ROOT / "content", ROOT / "docs", ROOT / "charts"
FONT_SRC = ROOT.parent / "fonts-src" / "SmileySans-Oblique.ttf"
FONT_OUT = ROOT / "assets" / "fonts" / "jz-display.woff2"
SITE = "金正 · 宏观利率研究"
NAV = [("研究", "research/macro-vs-expectations/"), ("点评", "notes/"), ("复盘", "reviews/"), ("工具", "tools/bond-analytics/"), ("关于", "about/")]
KIND_NAME = {"note": "点评", "review": "复盘", "research": "研究", "tool": "工具"}


def parse(path: pathlib.Path) -> dict:
    text = path.read_text(encoding="utf-8")
    meta, body = {}, text
    if text.startswith("---\n"):
        head, body = text[4:].split("\n---\n", 1)
        for line in head.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
    rel = path.relative_to(CONTENT).with_suffix("")
    url = "" if rel.name == "index" and rel.parent == pathlib.Path(".") else (str(rel.parent / "" if rel.name == "index" else rel) + "/")
    if not url and meta.get("kind") == "home":
        url = "macro/"
    return {**meta, "body": body, "url": url.replace("./", ""), "src": path}


def svg(name: str) -> str:
    """有 -narrow 版本的图，宽屏和手机各放一张，用 CSS 切换。"""
    wide = (CHARTS / f"{name.strip()}.svg").read_text(encoding="utf-8")
    narrow = CHARTS / f"{name.strip()}-narrow.svg"
    if not narrow.exists():
        return wide
    return f'<div class="v-wide">{wide}</div><div class="v-narrow">{narrow.read_text(encoding="utf-8")}</div>'


def chart(m: re.Match) -> str:
    name, *rest = html.unescape(m.group(1)).split("|", 2)
    cap, note = (rest + ["", ""])[:2]
    note_html = f'<span class="fig-note">{html.escape(note.strip())}</span>' if note.strip() else ""
    return f'<figure class="chart">{svg(name)}<figcaption><b>{html.escape(cap.strip())}</b>{note_html}</figcaption></figure>'


def listing(pages: list[dict], kind: str, depth: int) -> str:
    items = sorted([p for p in pages if p.get("kind") == kind], key=lambda p: p.get("date", ""), reverse=True)
    if not items:
        return "<p>暂时还没有。</p>"
    rel = "../" * depth
    rows = []
    for p in items:
        href = f'{rel}{p["url"]}'
        fig = f'<a class="fig" href="{href}" tabindex="-1" aria-hidden="true">{svg(p["figure"])}</a>' if p.get("figure") else ""
        rows.append(f'<li><span class="date">{p.get("date", "")}</span><div><a class="t" href="{href}">{html.escape(p["title"])}</a>'
                    f'<p>{html.escape(p.get("summary", ""))}</p></div>{fig}</li>')
    return '<ul class="rows">' + "".join(rows) + "</ul>"


def render(page: dict, pages: list[dict], template: str) -> str:
    depth = page["url"].count("/")
    rel = "../" * depth
    md = markdown.Markdown(extensions=["tables", "attr_list", "toc", "sane_lists", "footnotes", "md_in_html"])
    body = md.convert(page["body"])
    body = re.sub(r"<p>\{\{chart:(.+?)\}\}</p>", chart, body)
    body = re.sub(r"(?:<p>)?\{\{list:(\w+)\}\}(?:</p>)?", lambda m: listing(pages, m.group(1), depth), body)
    body = re.sub(r"(?:<p>)?\{\{raw:([\w-]+)\}\}(?:</p>)?", lambda m: (CHARTS / f"{m.group(1)}.html").read_text(encoding="utf-8"), body)
    body = re.sub(r"\{\{svg:([\w-]+)\}\}", lambda m: svg(m.group(1)), body)
    if page.get("kind") == "home":
        body = re.sub(r'href="((?![a-zA-Z][\w+.-]*:|/|#|\.\.?/)[^"]+)"',
                      lambda m: f'href="{rel}{m.group(1)}"', body)
    body = body.replace('href="/', f'href="{rel}').replace("<table>", '<div class="table"><table>').replace("</table>", "</table></div>")
    nav = "".join(f'<a href="{rel}{u}"{" class=on" if page["url"] and page["url"].split("/")[0] == u.split("/")[0] else ""}>{n}</a>' for n, u in NAV)
    kind = page.get("kind", "")
    if kind != "home":
        meta = ""
        if kind in KIND_NAME and page.get("date"):
            meta = f'<p class="meta">{KIND_NAME[kind]} · {page["date"]}{" · " + html.escape(page["updated"]) if page.get("updated") else ""}</p>'
        body = (f'<article class="article"><header><h1>{html.escape(page["title"])}</h1>{meta or "<p class=meta></p>"}'
                f'<div class="ruler" aria-hidden="true"></div></header>{body}</article>')
    title = SITE if kind == "home" else f'{page["title"]} · {SITE}'
    return (template.replace("{{title}}", html.escape(title)).replace("{{description}}", html.escape(page.get("summary", "")))
            .replace("{{root}}", rel).replace("{{nav}}", nav).replace("{{kind}}", kind or "page").replace("{{body}}", body))


def local_links(page: str) -> str:
    """本机预览用：「目录/」形式的站内链接补上 index.html。"""
    return re.sub(r'href="((?:\.\./)*(?:[\w.-]+/)*)"', lambda m: f'href="{m.group(1)}index.html"', page)


def display_text(pages_html: list[str]) -> str:
    """全站用标题字的文字：各级标题、站名、首页大标题、文章行标题。"""
    text = set("金正宏观利率研究0123456789%+−-·，。：；、？！「」（）()abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ")
    for h in pages_html:
        for m in re.finditer(r'<(h1|h2|h3)[^>]*>(.*?)</\1>|class="t"[^>]*>(.*?)</a>|class="brand-name">(.*?)<', h, re.S):
            text.update(re.sub(r"<[^>]+>", "", next(g for g in m.groups()[1:] if g is not None)))
    return "".join(sorted(text))


def subset_font(chars: str) -> None:
    if not FONT_SRC.exists():
        print("没有找到原始字体，沿用已有的子集")
        return
    from fontTools import subset
    from fontTools.ttLib import TTFont
    font = TTFont(FONT_SRC)
    sub = subset.Subsetter(subset.Options(layout_features=["*"], name_IDs=["*"], notdef_outline=True))
    sub.populate(text=chars)
    sub.subset(font)
    for rec in font["name"].names:                     # OFL 的保留字体名：改过的字体不能再叫 Smiley / 得意黑
        if rec.nameID in (1, 3, 4, 6, 16, 17):
            rec.string = {1: "JZ Display", 3: "JZ Display Subset", 4: "JZ Display", 6: "JZDisplay", 16: "JZ Display", 17: "Regular"}[rec.nameID]
    font.flavor = "woff2"
    FONT_OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(FONT_OUT)
    print(f"标题字子集 {len(chars)} 个字符，{FONT_OUT.stat().st_size // 1024} KB")


def main() -> None:
    local = "--local" in sys.argv
    out = pathlib.Path(sys.argv[sys.argv.index("--local") + 1]) if local else OUT
    template = (ROOT / "templates" / "page.html").read_text(encoding="utf-8")
    pages = [parse(p) for p in sorted(CONTENT.rglob("*.md"))]
    rendered = [(p, render(p, pages, template)) for p in pages]
    if not local:
        subset_font(display_text([h for _, h in rendered]))
    portfolio = ROOT / "portfolio"
    if not (portfolio / "node_modules").exists():
        subprocess.run(["npm", "ci"], cwd=portfolio, check=True)
    subprocess.run(["npm", "run", "build"], cwd=portfolio, check=True)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copytree(ROOT / "assets", out / "assets")
    for p, h in rendered:
        dest = out / p["url"] / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(local_links(h) if local else h, encoding="utf-8")
    shutil.copytree(portfolio / "dist", out, dirs_exist_ok=True)
    if not local:
        (out / ".nojekyll").write_text("", encoding="utf-8")
    print(f"生成了 {len(pages)} 页 → {out}")


if __name__ == "__main__":
    main()
