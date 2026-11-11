from pathlib import Path
root=Path(__file__).resolve().parent.parent
base=root/"src"
clip=(root/'node_modules/polygon-clipping/dist/polygon-clipping.umd.min.js').read_text().split('//# sourceMappingURL')[0]
licenses=[]
for path in [root/'node_modules/polygon-clipping/LICENSE.md',root/'node_modules/robust-predicates/LICENSE']:
 licenses.append(path.read_text())
splay=(root/'node_modules/splaytree/Readme.md').read_text()
if '## License' in splay:licenses.append(splay.split('## License',1)[1])
html=(base/'shell.html').read_text().replace('__DEFAULT_LAYOUT__',(base/'default-layout.json').read_text().replace('<','\\u003c')).replace('__GEOMETRY__',(base/'geometry.json').read_text()).replace('__CLIPPING__',clip).replace('__APP__',(base/'app.js').read_text())
html+='\n<!-- Bundled library notices:\n'+ '\n\n'.join(licenses).replace('--','—')+'\n-->\n'
(root/'index.html').write_text(html)
print('Built standalone HTML:',len(html.encode()),'bytes')
