# Maakt index.html (losse webpagina voor GitHub Pages of een eigen webadres) uit app.html.
from pathlib import Path
d = Path(__file__).parent
app = (d / "app.html").read_text()
head = """<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Roof360">
<link rel="apple-touch-icon" href="icoon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%}</style>
"""
title_end = app.index("</style>") + len("</style>")
(d / "index.html").write_text(head + app[:title_end] + "\n</head>\n<body>\n" + app[title_end:] + "\n</body>\n</html>\n")
print("index.html gemaakt")
