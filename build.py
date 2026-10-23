"""把 content/ 里的 Markdown 生成静态网页，放进 docs/（GitHub Pages 从这里发布）。

运行：uv run python build.py（本机预览：uv run python build.py --local 目录，链接改成直接指向 index.html，双击就能打开）
- 每篇开头是 --- 包起来的几行「键: 值」：title、date、summary、kind（home / research / note / review / tool / about）。
- 单独一行的 {{chart:文件名|图题|说明}} 换成 charts/ 里对应的 SVG。
- {{list:note}}、{{list:review}} 换成对应栏目的文章列表，按日期从新到旧。
- 地址都是「栏目/文件名/」，比如 content/notes/2026-10-19-gdp.md → docs/notes/2026-10-19-gdp/index.html。
"""
from __future__ import annotations

import html
import pathlib
import re
import shutil
import sys

import markdown

ROOT = pathlib.Path(__file__).parent
CONTENT, OUT, CHARTS = ROOT / "content", ROOT / "docs", ROOT / "charts"
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
    return {**meta, "body": body, "url": url.replace("./", ""), "src": path}


def chart(m: re.Match) -> str:
    name, *rest = html.unescape(m.group(1)).split("|", 2)
    cap, note = (rest + ["", ""])[:2]
    svg = (CHARTS / f"{name.strip()}.svg").read_text(encoding="utf-8")
    note_html = f'<span class="fig-note">{html.escape(note.strip())}</span>' if note.strip() else ""
    return f'<figure class="chart">{svg}<figcaption><b>{html.escape(cap.strip())}</b>{note_html}</figcaption></figure>'


def listing(pages: list[dict], kind: str, depth: int) -> str:
    items = sorted([p for p in pages if p.get("kind") == kind], key=lambda p: p.get("date", ""), reverse=True)
    rel = "../" * depth
    rows = [f'<li><a href="{rel}{p["url"]}"><span class="date">{p.get("date", "")}</span><span class="t">{html.escape(p["title"])}</span></a>'
            f'<p>{html.escape(p.get("summary", ""))}</p></li>' for p in items]
    return '<ul class="post-list">' + "".join(rows) + "</ul>" if rows else "<p>暂时还没有。</p>"


def render(page: dict, pages: list[dict], template: str) -> str:
    depth = page["url"].count("/")
    rel = "../" * depth
    md = markdown.Markdown(extensions=["tables", "attr_list", "toc", "sane_lists", "footnotes", "md_in_html"])
    body = md.convert(page["body"])
    body = re.sub(r"<p>\{\{chart:(.+?)\}\}</p>", chart, body)
    body = re.sub(r"<p>\{\{list:(\w+)\}\}</p>", lambda m: listing(pages, m.group(1), depth), body)
    body = body.replace('href="/', f'href="{rel}').replace("<table>", '<div class="table"><table>').replace("</table>", "</table></div>")
    nav = "".join(f'<a href="{rel}{u}"{" class=on" if page["url"].startswith(u.split("/")[0]) and page["url"] else ""}>{n}</a>' for n, u in NAV)
    kind = page.get("kind", "")
    meta_line = ""
    if kind in KIND_NAME and page.get("date"):
        meta_line = f'<p class="meta">{KIND_NAME[kind]} · {page["date"]}{" · " + html.escape(page["updated"]) if page.get("updated") else ""}</p>'
    title = SITE if kind == "home" else f'{page["title"]} · {SITE}'
    head_title = "" if kind == "home" else f'<h1>{html.escape(page["title"])}</h1>{meta_line}'
    return (template.replace("{{title}}", html.escape(title)).replace("{{description}}", html.escape(page.get("summary", "")))
            .replace("{{root}}", rel).replace("{{nav}}", nav).replace("{{site}}", SITE)
            .replace("{{kind}}", kind or "page").replace("{{header}}", head_title).replace("{{content}}", body))


def local_links(page: str) -> str:
    """本机预览用：「目录/」形式的站内链接补上 index.html。"""
    page = re.sub(r'href="((?:\.\./)*(?:[\w.-]+/)*)"', lambda m: f'href="{m.group(1)}index.html"', page)
    return page


def main() -> None:
    local = "--local" in sys.argv
    out = pathlib.Path(sys.argv[sys.argv.index("--local") + 1]) if local else OUT
    template = (ROOT / "templates" / "page.html").read_text(encoding="utf-8")
    pages = [parse(p) for p in sorted(CONTENT.rglob("*.md"))]
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copytree(ROOT / "assets", out / "assets")
    for p in pages:
        dest = out / p["url"] / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        html_page = render(p, pages, template)
        dest.write_text(local_links(html_page) if local else html_page, encoding="utf-8")
    if not local:
        (out / ".nojekyll").write_text("", encoding="utf-8")
    print(f"生成了 {len(pages)} 页 → {out}")


if __name__ == "__main__":
    main()
