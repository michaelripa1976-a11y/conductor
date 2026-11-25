# Assembles public/index.html from the approved demo's styles and helpers plus app.src.js.
import re
import os
HERE=os.path.dirname(os.path.abspath(__file__))
demo=open(os.path.join(HERE,'ui','base.html')).read()
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
.orb img{width:44px;height:44px}
.orbw{position:absolute;left:50%;top:50%;margin:-29px 0 0 -29px;width:58px;height:58px;transition:transform .8s cubic-bezier(.3,1.35,.5,1)}
.orbw .orb{position:relative;left:auto;top:auto;display:grid}
.orbw .orb{background:none;box-shadow:none;border-radius:0;animation-duration:var(--d,1.2s);animation-timing-function:ease-in-out;animation-iteration-count:infinite;transform-origin:50% 100%}
.orbw .orb img{width:56px;height:56px;object-fit:contain;filter:drop-shadow(0 3px 0 rgba(36,27,77,.12))}
.orbw::after{content:"";position:absolute;left:50%;bottom:-7px;width:34px;height:7px;margin-left:-17px;border-radius:50%;background:rgba(36,27,77,.13);animation:gshadow var(--d,1.2s) ease-in-out infinite}
.orb.w0{animation-name:jack}.orb.w1{animation-name:squat}.orb.w2{animation-name:jog}.orb.w3{animation-name:stretch}.orb.w4{animation-name:rope}.orb.w5{animation-name:twist}
.orb.cheer{animation:cheer .55s ease-in-out infinite!important}
@keyframes jack{0%,100%{transform:none}20%{transform:translateY(2px) scale(1.08,.9)}55%{transform:translateY(-16px) scale(1.2,.94)}80%{transform:translateY(0) scale(.96,1.04)}}
@keyframes squat{0%,100%{transform:none}45%,60%{transform:scale(1.2,.68)}80%{transform:scale(.95,1.08)}}
@keyframes jog{0%,100%{transform:rotate(-12deg)}25%{transform:translateY(-8px) rotate(0)}50%{transform:rotate(12deg)}75%{transform:translateY(-8px) rotate(0)}}
@keyframes stretch{0%,100%{transform:none}25%{transform:rotate(-24deg) scaleY(1.06)}50%{transform:scaleY(1.12)}75%{transform:rotate(24deg) scaleY(1.06)}}
@keyframes rope{0%,100%{transform:scale(1.1,.88)}50%{transform:translateY(-20px) scale(.94,1.08)}}
@keyframes twist{0%,100%{transform:none}30%{transform:translateY(-12px) rotateY(180deg)}60%{transform:translateY(-12px) rotateY(360deg)}80%{transform:scale(1.1,.9) rotateY(360deg)}}
@keyframes cheer{0%,100%{transform:none}50%{transform:translateY(-10px) scale(1.06)}}
@keyframes gshadow{50%{transform:scale(.6);opacity:.5}}
.ai[aria-pressed="true"] img{animation:jack 1s ease-in-out infinite;transform-origin:50% 100%}.ai[aria-pressed="true"]:nth-child(3n) img{animation-name:squat;animation-delay:.2s}.ai[aria-pressed="true"]:nth-child(3n+1) img{animation-name:rope;animation-duration:.7s}
.sheet .big img{animation:stretch 2.2s ease-in-out infinite;transform-origin:50% 100%}
.choice button img{animation:jog .9s ease-in-out infinite;transform-origin:50% 100%}.choice button:nth-of-type(2) img{animation-delay:.3s}.choice button.win img{animation:cheer .55s ease-in-out infinite}
.btn[disabled]#go{opacity:1;background:var(--pri);box-shadow:0 6px 0 var(--priD)}.to img{width:80px;height:80px;object-fit:contain}
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
.cards{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding:2px 2px 6px}
.cards.flat{flex:none}.cards.scrollr{max-height:44vh}
.card{background:#fff;border-radius:18px;padding:10px 12px;box-shadow:0 3px 0 var(--line);text-align:left;display:flex;gap:10px;align-items:flex-start;flex:none}
.card.cut{opacity:.4;text-decoration:line-through}
.card>img,.card>.avl{width:34px;height:34px;object-fit:contain;flex:none;font-size:15px}
.card .b{flex:1;min-width:0;font-weight:700;font-size:14px;line-height:1.3}
.card .nm{display:flex;gap:6px;align-items:center;margin-top:5px;flex-wrap:wrap}.card .nm small{font-size:11px;font-weight:700;color:var(--mute);background:none!important;box-shadow:none!important;padding:0!important;margin:0!important;width:auto!important;display:inline!important}.card .nm .tag{display:inline-block!important;width:auto!important;margin:0!important}.card .nm{justify-content:flex-start}
.tag{border-radius:99px;padding:2px 9px;font-size:11px;font-weight:800;letter-spacing:.4px}
.tag.f{background:#D7F5E6;color:#0B5A36}.tag.o{background:#FFE9B0;color:#5A3D00}.tag.p{background:#D5F1F7;color:#06303A}.tag.w{background:#E0DCFF;color:#2A1FA0}.tag.x{background:var(--ink);color:#fff}
.ib{width:36px;height:36px;border-radius:12px;background:var(--bg);display:grid;place-items:center;flex:none;font-weight:800;font-size:16px}
.ib.w{width:auto;padding:0 9px;font-size:12px}.ib[aria-pressed=true]{background:var(--ink);color:#fff}
.playc{background:#fff;border-radius:22px;padding:14px;box-shadow:0 4px 0 var(--line);text-align:left;display:flex;flex-direction:column;gap:8px;flex:none;animation:rise .45s both;width:100%}
.playc.top{box-shadow:0 4px 0 var(--line),0 0 0 4px #FFC83D}.playc.rev{box-shadow:0 4px 0 var(--line),0 0 0 4px var(--pri)}
.playc h3{margin:0;font-family:"Baloo 2",Nunito,sans-serif;font-size:19px;line-height:1.15;text-align:left}
.playc .who{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:var(--mute)}
.playc .who img,.playc .who .avl{width:26px;height:26px;object-fit:contain;margin-right:-4px;font-size:12px}.playc .who span{margin-left:8px}
.playc .r{display:flex;gap:8px;width:100%}
.playc .r button{flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;height:44px;border-radius:14px;font-weight:800;font-size:14px;background:var(--bg)}
.playc .r button.go{background:var(--pri);color:#fff;flex:2 1 0}
.filt2{display:flex;gap:6px;overflow:auto;flex:none;padding-bottom:2px}.filt2 button{border-radius:99px;padding:7px 12px;font-weight:800;font-size:13px;background:#fff;box-shadow:0 3px 0 var(--line);white-space:nowrap;flex:none}.filt2 button[aria-pressed=true]{background:var(--ink);color:#fff;box-shadow:none}
.sw2{width:52px;height:30px;border-radius:99px;background:#CFC8E8;position:relative;flex:none}.sw2::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:left .2s}
.sw2[aria-checked=true]{background:var(--grn)}.sw2[aria-checked=true]::after{left:25px}
.nav{grid-template-columns:repeat(4,1fr)}.nav button{font-size:14px}

.vd{display:flex;flex-direction:column;gap:2px;border-radius:16px;padding:10px 12px;text-align:left;font-size:13px;font-weight:700;background:#fff;box-shadow:inset 0 0 0 3px var(--line)}
.vd b{font-size:15px}.vd.g{box-shadow:inset 0 0 0 3px #22C27A}.vd.y{box-shadow:inset 0 0 0 3px #FFC83D}.vd.r{box-shadow:inset 0 0 0 3px #D93025}
.dot2{width:12px;height:12px;border-radius:50%;flex:none;background:#22C27A}.dot2.y{background:#FFC83D}.dot2.r{background:#D93025}
.list div b{font-weight:800}
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
/* accounts */
.tg{border-radius:99px;padding:6px 10px;font-size:12px;font-weight:800;flex:none;background:#fff;color:var(--mute);box-shadow:inset 0 0 0 2px var(--line);white-space:nowrap}
.tg.personal{background:var(--per);color:#06303A;box-shadow:none}.tg.work{background:var(--pri);color:#fff;box-shadow:none}.tg.off{background:var(--ink);color:#fff;box-shadow:none}
.acct span{overflow-wrap:anywhere}
.choice .ico{width:84px;height:84px;border-radius:26px}
@media(min-width:900px){
  #app{width:min(96vw,1240px);height:min(94dvh,860px)}
  .scr:not(.desk){width:100%;max-width:640px;margin:0 auto;padding:28px 20px 30px;gap:18px}
  .scr:not(.desk) h1{font-size:36px}.scr:not(.desk) p{font-size:18px}
  .ais{grid-template-columns:repeat(4,1fr);gap:12px}.ai{font-size:16px}.ai img,.ai .avl{width:64px;height:64px}
  .say div{font-size:17px}
  .scr.desk{display:grid;grid-template-columns:clamp(270px,25vw,330px) minmax(0,1fr) clamp(300px,28vw,370px);gap:20px;padding:22px}
  .col{display:flex;flex-direction:column;gap:12px;min-height:0;min-width:0}
  #cT,#cH{background:rgba(255,255,255,.5);border-radius:24px;padding:14px}
  .sheet{align-items:center;justify-content:center}.sheet>div{width:460px;border-radius:32px}
  .toast{left:auto;right:28px;bottom:28px;width:360px}
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
