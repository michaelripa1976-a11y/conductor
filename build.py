# Assembles public/index.html from the approved demo's styles and helpers plus app.src.js.
import re
demo=open('/home/claude/pw/index.html').read()
css=re.search(r'<style>(.*?)</style>',demo,re.S).group(1)
helpers='\n'.join(l for l in demo.split('\n') if l.startswith(('const IC=','const ic=','const coach=','const RM=','function confetti','function ding','function whistle')))
extra=r'''
/* ---------- production additions ---------- */
.demo{display:none}
.sheet>div{max-height:94%;overflow:auto}
.note{text-align:center;font-size:14px;flex:none}
.err{color:#B3261E;font-size:14px;min-height:18px;text-align:center}
.toast{position:absolute;left:16px;right:16px;bottom:84px;z-index:9;background:var(--ink);color:#fff;border-radius:18px;padding:12px 16px;font-weight:800;font-size:15px;text-align:center;animation:rise .35s both;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.lnks{display:flex;flex-direction:column;align-items:center;flex:none;margin-top:-8px}
.lnk{min-height:40px}.lnk.danger{color:#B3261E}
.avl{display:grid;place-items:center;border-radius:50%;background:var(--ink);color:#fff;font-weight:800;flex:none;width:44px;height:44px;font-size:20px}
.orb img{width:44px;height:44px}.to img{width:80px;height:80px;object-fit:contain}
.ais{grid-template-columns:repeat(3,1fr);gap:9px}
.ai{border-radius:20px;font-size:14px;gap:2px;padding:4px}.ai img{width:52px;height:52px}.ai .avl{width:52px;height:52px}
.ai i{top:6px;right:6px;width:22px;height:22px}
.ais.small{max-height:52vh}.ais.small .ai{min-height:92px}
.none{font-size:14px;color:var(--mute)}
.choice.n3{grid-template-columns:repeat(3,1fr)}.choice.n3 img{width:60px;height:60px}.choice.n3 button{font-size:15px;padding:12px 4px}
.choice .avl{width:72px;height:72px;font-size:30px}
.strip .avl{position:absolute;right:-5px;bottom:-5px;width:26px;height:26px;font-size:12px;border:2px solid #fff}
.own .avl{width:30px;height:30px;font-size:13px;margin-left:-8px;border:2px solid #fff}
.own span.y{background:#FFC83D}
.padh h1{font-size:22px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.padh h1 small{display:block;font-family:Nunito,sans-serif;font-size:12px;letter-spacing:1px;color:var(--mute)}
.chipb{background:#fff;border-radius:99px;padding:8px 12px;font-weight:800;font-size:12px;box-shadow:0 3px 0 var(--line);white-space:nowrap;flex:none}
.ico{width:64px;height:64px;border-radius:20px;background:var(--c);display:grid;place-items:center;flex:none}
.sheet .big .avl{width:60px;height:60px;font-size:26px}
.sheet .big .to{width:72px;height:72px;border-radius:50%;background:#fff;display:grid;place-items:center}.sheet .big .to img{width:56px;height:56px}
.sheet .field{text-align:left}
textarea{width:100%;border-radius:16px;border:3px solid var(--line);background:#fff;padding:12px 14px;font:inherit;font-size:15px;font-weight:700;color:var(--ink);resize:none}
textarea:focus{outline:none;border-color:var(--pri)}
.list .num{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--pri);color:#fff;font-size:13px;margin-right:8px}
.rowb{display:flex;align-items:center;gap:10px;background:#fff;border-radius:16px;padding:10px 12px;box-shadow:0 3px 0 var(--line);text-align:left;font-weight:800;font-size:14px}
.rowb span{flex:1;min-width:0}.rowb small{display:block;font-size:12px;color:var(--mute)}
.rows{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding-bottom:4px}
.rows.scrollr{flex:none;max-height:210px}
.row{display:flex;align-items:center;gap:10px;background:#fff;border-radius:18px;padding:8px 12px;box-shadow:0 3px 0 var(--line);min-height:58px;text-align:left;width:100%;flex:none;opacity:1}
.row.off{opacity:.6}
.row .a{position:relative;flex:none;display:grid}.row .a img{width:40px;height:40px;object-fit:contain}.row .a .avl{width:40px;height:40px;font-size:18px}
.row .t{flex:1;min-width:0}.row .t b{display:block;font-size:15px;line-height:1.2}.row .t small{display:block;font-size:12px;font-weight:700;color:var(--mute);margin-top:2px}
.dot{position:absolute;right:-2px;bottom:-2px;width:13px;height:13px;border-radius:50%;border:2px solid #fff;background:#B9B4D6}.dot.g{background:var(--grn)}.dot.q{background:#FFC83D}
.cnt{font-family:"Baloo 2",Nunito,sans-serif;font-weight:800;font-size:20px;color:var(--mute)}
.okc{width:26px;height:26px;border-radius:50%;background:var(--grn);display:grid;place-items:center;flex:none}
.xn{background:var(--ink);color:#fff;border-radius:99px;padding:1px 8px;font-size:12px;margin-left:6px;white-space:nowrap}
.mvs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mvs div{background:#fff;border-radius:16px;padding:8px 4px;font-size:11px;font-weight:800;box-shadow:0 3px 0 var(--line)}
.mvs b{display:block;font-family:"Baloo 2",Nunito,sans-serif;font-size:21px;line-height:1.1}
.chips.c{justify-content:center}
.search{height:48px;border-radius:16px;border:3px solid var(--line);background:#fff;padding:0 14px;font:inherit;font-size:16px;font-weight:700;color:var(--ink);flex:none;width:100%}
.search:focus{outline:none;border-color:var(--pri)}
.filt{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;font-weight:800;font-size:13px;color:var(--mute)}
.filt div{display:flex;gap:2px;overflow:auto}.filt button{border:3px solid transparent;border-radius:50%;padding:2px;flex:none;display:grid}.filt button.on{border-color:var(--pri)}
.filt img{width:32px;height:32px;object-fit:contain}.filt .avl{width:32px;height:32px;font-size:14px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:none}
.btn.sm{height:50px;font-size:16px;border-radius:18px}
.btn.red{background:#D93025;box-shadow:0 6px 0 #9C1F17}
a.btn{display:grid;place-items:center;text-decoration:none}
.play.warn{background:#FFC83D;color:#221C44}.play.warn small{color:#5A3D00}.play.warn .do{background:var(--ink);color:#fff}
.pick{max-width:100%}.pick .avl{width:48px;height:48px}
@media(min-width:980px){
  #app.wide{width:min(96vw,1240px);height:min(94dvh,860px)}
  .scr.desk{display:grid;grid-template-columns:320px minmax(0,1fr) 360px;gap:20px;padding:22px}
  .col{display:flex;flex-direction:column;gap:12px;min-height:0;min-width:0}
  #cT,#cH{background:rgba(255,255,255,.5);border-radius:24px;padding:14px}
  .wide .sheet{align-items:center;justify-content:center}.wide .sheet>div{width:440px;border-radius:32px}
  .wide .toast{left:auto;right:28px;bottom:28px;width:360px}
}
'''
css=css.replace('@media(prefers-reduced-motion:reduce)',extra+'@media(prefers-reduced-motion:reduce)',1) if css.count('@media(prefers-reduced-motion:reduce)')==1 else css.rsplit('@media(prefers-reduced-motion:reduce)',1)[0]+extra+'@media(prefers-reduced-motion:reduce)'+css.rsplit('@media(prefers-reduced-motion:reduce)',1)[1]
icon="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cpath d='M20 80c0-27 17-46 40-46s40 19 40 46c0 20-15 30-40 30S20 100 20 80z' fill='%235B4BFF'/%3E%3Cpath d='M29 47c2-19 15-30 31-30s29 11 31 30z' fill='%23FFC83D'/%3E%3Cpath d='M27 44h66c9 0 18 3 23 9 1 2 0 3-2 3H27z' fill='%23F2A900'/%3E%3Ccircle cx='47' cy='68' r='8' fill='%23fff'/%3E%3Ccircle cx='73' cy='68' r='8' fill='%23fff'/%3E%3Ccircle cx='49' cy='69' r='3.5' fill='%23221C44'/%3E%3Ccircle cx='75' cy='69' r='3.5' fill='%23221C44'/%3E%3C/svg%3E"
html=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coach AI</title>
<meta name="robots" content="noindex">
<link rel="icon" href="{icon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>
<div id="app"><div class="scr" id="scr"></div></div>
<script>
{helpers}
{open('app.src.js').read()}
</script>
</body>
</html>
'''
open('public/index.html','w').write(html)
js=re.search(r'<script>(.*)</script>',html,re.S).group(1); open('/tmp/app.js','w').write(js)
print(len(html))
