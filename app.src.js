/* Coach AI client. Assembled into public/index.html by build.py (styles and the shared helpers come from there). */
const AIS={chatgpt:{n:'ChatGPT'},claude:{n:'Claude'},grok:{n:'Grok'},gemini:{n:'Gemini'},muse:{n:'Muse'},perplexity:{n:'Perplexity'},devin:{n:'Devin'},victor:{n:'Victor AI'},copilot:{n:'Copilot'},hermes:{n:'Hermes'},openclaw:{n:'OpenClaw'},other:{n:'Other'}};
const ORDER=Object.keys(AIS), CONN={grok:1,claude:1,chatgpt:1};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const N=id=>id==='other'&&S.otherName?esc(S.otherName):AIS[id]?AIS[id].n:'Someone';
const av=id=>id==='other'||!AIS[id]?`<span class="avl" role="img" aria-label="${N(id)}">${N(id).slice(0,1)}</span>`:`<img src="logos/${id}.png" alt="${N(id)}">`;
const SP={personal:{n:'Personal',icon:'home',cls:'per',m:[['email','Email','mail','#FF6B9A'],['calendar','Calendar','calendar','#FFA62B'],['messages','Messages','chat','#9B5DE5'],['files','Files','doc','#3A86FF'],['payments','Payments','money','#22C27A'],['social','Social','people','#F2545B'],['shopping','Shopping','cart','#5B4BFF'],['home','Home','home','#22B8CF']]},
 work:{n:'Work',icon:'case',cls:'wrk',m:[['email','Email','mail','#FF6B9A'],['calendar','Calendar','calendar','#FFA62B'],['chat','Chat','chat','#9B5DE5'],['files','Files','doc','#3A86FF'],['accounting','Accounting','money','#22C27A'],['social','Social','people','#F2545B'],['code','Code','code','#5B4BFF'],['clients','Clients','case','#22B8CF']]}};
const SHARED=['personal:files','work:files','work:code'];
const TASK={email:'Clear out my promo emails and list what needs a reply.',calendar:'Find me a free hour this week and hold it.',messages:'Summarize my unread messages.',chat:'Summarize what I missed in chat today.',payments:'List my bills due this week.',accounting:'List the invoices still unpaid.',social:'Draft one post for me to approve.',shopping:'Track my open orders.',home:'Check the thermostat schedule.',clients:'List the clients I owe a reply.'};
const S={authed:false,name:'',email:'',team:null,otherName:null,scope:'both',sel:[],keys:{},codes:{},joined:{},skipped:{},benched:{},reach:{},seen:{},pick:{},mode:{personal:'on',work:'on'},quiet:false,onboarded:false,play:0,
  log:[],tasks:[],needs:[],skew:0,i:0,steps:[],space:'personal',tab:'pad',fa:null,q:'',wait:false,spot:null,arrived:false,fresh:[],known:null};
const $=(q,e=document)=>e.querySelector(q), $$=(q,e=document)=>[...e.querySelectorAll(q)];
const DESK=matchMedia('(min-width:900px)');
const now=()=>Date.now()-S.skew;
const ago=ts=>{const m=Math.max(0,Math.round((now()-ts)/6e4));return m<2?'just now':m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} d ago`};
const day=ts=>{const t=new Date();t.setHours(0,0,0,0);return ts>=t.getTime()?'Today':ts>=t.getTime()-864e5?'Yesterday':new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
const hm=m=>`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
const copy=t=>{try{navigator.clipboard.writeText(t)}catch(e){}};

/* ---------- rules, mirrored from the server ---------- */
const spaces=()=>S.scope==='personal'||S.scope==='work'?[S.scope]:['personal','work'];
const sid=(s,k)=>s+':'+k, shared=src=>SHARED.includes(src);
const srcs=()=>spaces().flatMap(s=>SP[s].m.map(m=>sid(s,m[0])));
const meta=src=>{const [s,k]=String(src).split(':'),m=SP[s]&&SP[s].m.find(x=>x[0]===k);return m?{s,k,n:m[1],icon:m[2],c:m[3],full:SP[s].n+' '+m[1]}:{s:null,k:null,n:'General',icon:'check',c:'#5F5A80',full:'General'}};
const live=()=>ORDER.filter(id=>S.sel.includes(id)&&S.joined[id]&&!S.benched[id]);
const can=src=>live().filter(id=>(S.reach[id]||[]).includes(src));
const owners=src=>{const r=can(src);if(shared(src))return r;const p=S.pick[src];return p&&live().includes(p)?[p]:r.length===1?r:[]};
const conflicts=()=>srcs().filter(src=>!shared(src)&&!owners(src).length&&can(src).length>1);
const empties=()=>srcs().filter(src=>!shared(src)&&!can(src).length&&!owners(src).length);

/* ---------- server sync ---------- */
async function api(path,body){const r=await fetch('/api/'+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw Object.assign(new Error(j.error||'Something went wrong. Try again.'),{status:r.status});return j}
const OWN=['scope','sel','skipped','benched','pick','mode','team','otherName','quiet','onboarded','play'];
const ownJSON=()=>JSON.stringify(OWN.map(k=>S[k]));
let sent='';
function hydrate(st,all){
  S.authed=true;S.name=st.name;S.email=st.email;
  if(all){for(const k of OWN)S[k]=st[k];S.pick=st.pick||{};sent=ownJSON()}
  for(const k of ['keys','codes','joined','reach','seen','needs','tasks'])S[k]=st[k];
  for(const id of Object.keys(st.joined))delete S.skipped[id];
  S.skew=Date.now()-st.now;S.log=st.log.slice().reverse();
  if(S.known)for(const w of S.log.filter(w=>!S.known.has(w.k)).reverse())S.fresh.push(w);
  S.known=new Set(S.log.map(w=>w.k));
}
async function saveNow(){if(!S.authed)return;const j=ownJSON();if(j===sent)return;sent=j;const b={};OWN.forEach(k=>b[k]=S[k]);try{hydrate(await api('save',b),false)}catch(e){sent=''}}
setInterval(saveNow,1200);
async function pull(){if(!S.authed)return;try{hydrate(await api('state'),false)}catch(e){if(e.status===401)location.reload()}}

/* ---------- small UI pieces ---------- */
const say=t=>`<div class="say">${coach(46)}<div>${t}</div></div>`;
function sheet(html,onClose){$$('.sheet').forEach(x=>x.remove());$('#app').insertAdjacentHTML('beforeend',`<div class="sheet" role="dialog" aria-modal="true"><div>${html}</div></div>`);const sh=$('.sheet');sh.close=()=>{sh.remove();onClose&&onClose()};sh.onclick=e=>{if(e.target===sh)sh.close()};return sh}
function toast(t){$$('.toast').forEach(x=>x.remove());$('#app').insertAdjacentHTML('beforeend',`<div class="toast" role="status">${t}</div>`);const e=$('.toast');setTimeout(()=>e.remove(),2600)}
const mcpUrl=id=>location.origin+'/mcp/'+S.keys[id];
const srcList=()=>srcs().join(', ');
function playbookText(id){const B=location.origin+'/a/'+S.keys[id],c=S.codes[id];return `COACH AI PLAYBOOK for ${AIS[id].n} (${S.name}'s AI team)
${id==='grok'?`Save the RULES below with UpdateSkill as a user-library skill named coach-playbook, so every Grok bot on this account shares it. Leave every link, key and code out of the shared skill: keep those only in your own private memory. Then message each of my other bots to load coach-playbook before any task, and tell me which bots you reached.`:`Save this permanently as a skill, custom instruction or memory, so it applies in EVERY chat from now on, not only this one. Tell me where you saved it. If you cannot save it permanently, say so plainly.`}

USE IT every time I ask you to do, make, send, change, schedule or draft something. Skip it for plain questions.

SOURCES. A source is a place you can act, named board:source. The list: ${srcList()}.

EVERY TASK, in this order:
1. Read the team state.
2. You may READ anything. Only ACT on a source that is yours, or on a shared source.
3. Claim the task before you start, naming its source. If you are one of several bots, name yourself in the bot field. If the answer is BLOCKED or HOLD, stop and tell me.
4. Do the work. A claim is never approval to send or delete anything.
5. Report it done. Then end your reply with "Coach: reported".
If a board is PAUSED or OFF, do not act on it. Tell me instead.
Jobs that repeat on a schedule: report one summary a day, not every run.

HOW TO REACH COACH AI (use the first that works):
A. The Coach AI connector tools, if installed. Connector URL: ${mcpUrl(id)}
B. Open these links (private, never share them):
- state: ${B}/state
- claim: ${B}/claim?source=BOARD:SOURCE&task=REAL+SHORT+TITLE&bot=YOUR+BOT+NAME
- done: ${B}/done?source=BOARD:SOURCE&task=REAL+SHORT+TITLE&link=URL&minutes=N
- check in: ${B}/checkin?reach=LIST
C. If you can do neither, end your reply with one line for me to paste:
COACH-CLAIM code=${c}; source=...; task=...
COACH-DONE code=${c}; source=...; task=...; link=...; minutes=...

IF YOU HAVE A VAULT OR SECRET STORE, use it instead of the links. Do this yourself, without asking me:
- Save this key as a secret named COACH_KEY: ${S.keys[id]}
- Send it as the header "Authorization: Bearer <key>" to ${location.origin}/api/agent/state, /claim, /done and /checkin (same fields as the links, GET or POST).
- Test it once with ${location.origin}/api/agent/whoami.

RIGHT NOW, do all of this yourself in one go, with no questions back to me:
1. Save this playbook.
2. Store the key in your vault if you have one, and run the test.
3. Check in. reach = every source from the list above that you can really ACT on (send, change, create), not just read. Be honest: I decide positions from this.
4. Reply with one line: where you saved it, how you reach Coach AI, and what the check-in answered.
No links, tools or vault? Reply with only: COACH-CHECKIN code=${c}; reach=...`}
const setupText=id=>CONN[id]?mcpUrl(id):playbookText(id);
const ADD={grok:'Open grok.com/connectors, choose New Connector, then Custom, and paste the link.',claude:'In Claude, open Settings, then Connectors, add a custom connector and paste the link.',chatgpt:'In ChatGPT settings, turn on Developer mode under Apps and Connectors, create a connector and paste the link.'};
function help(id){const n=N(id),rows=CONN[id]?[ADD[id],`Start a new chat and say: "Check in to Coach AI with every source you can act on"`,id==='grok'?'That one connection covers all your Grok bots.':`${n} then follows Coach AI in every chat.`]:[`Paste the playbook into ${n} and send`,`${n} saves it, checks in, and answers with one line`,`If it answers with a COACH-CHECKIN line, paste that line here`];
  const sh=sheet(`<div class="big">${av(id)}</div><h1>${CONN[id]?`Add Coach AI to ${n}`:`Give ${n} its playbook`}</h1><div class="list">${rows.map((t,k)=>`<div><b class="num">${k+1}</b>${t}</div>`).join('')}</div><div class="rowb"><span>Key only, for apps with a vault<small>${S.keys[id]?S.keys[id].slice(0,6)+'••••••••':'not made yet'}</small></span><button class="chipb" id="cky">Copy key</button></div><button class="btn">Got it</button><button class="lnk" id="alt">${CONN[id]?'No connectors on your plan? Copy the playbook':'Copy connector link'}</button><button class="lnk" id="nky">Key leaked or not working? Make a new one</button>`);
  $('.btn',sh).onclick=()=>sh.close();
  $('#cky',sh).onclick=()=>{copy(S.keys[id]||'');toast('Key copied. Save only this in the vault.')};
  $('#alt',sh).onclick=()=>{copy(CONN[id]?playbookText(id):mcpUrl(id));toast(CONN[id]?'Playbook copied.':'Connector link copied.')};
  $('#nky',sh).onclick=()=>{const c=sheet(`<div class="big">${av(id)}</div><h1>Make a new key for ${n}?</h1><p>The old key, links and connector stop working at once. You will need to set ${n} up again.</p><button class="btn" id="y">Make a new key</button><button class="btn alt" id="x">Keep the old one</button>`);$('#x',c).onclick=()=>c.close();$('#y',c).onclick=async()=>{c.close();try{hydrate(await api('rekey',{id}),false);toast('New key made. Set '+n+' up again.')}catch(e){toast(esc(e.message))}}}}
function pasteSheet(id,after){const sh=sheet(`<div class="big">${coach(84)}</div><h1>Paste the AI's reply.</h1><p>The whole reply is fine. Coach finds the line that starts with COACH-.</p><textarea id="pt" rows="4" aria-label="The AI's reply" placeholder="COACH-DONE code=…; source=…; task=…"></textarea><p id="pe" class="err" role="alert"></p><button class="btn">Hand it to Coach</button>`);
  $('.btn',sh).onclick=async()=>{try{const r=await api('paste',{text:$('#pt',sh).value,id});hydrate(r.state,false);const bad=r.results.find(x=>!x.ok);if(bad){$('#pe',sh).textContent=bad.msg;return}sh.close();toast(esc(r.results[0].msg));after&&after()}catch(e){$('#pe',sh).textContent=e.message}}}

/* ---------- onboarding: one step at a time ---------- */
const STG={scope:[1,'YOUR BOARD'],signup:[2,'SIGN UP'],pick:[3,'YOUR PLAYERS'],book:[4,'PLAYBOOKS'],results:[5,'RESULTS'],conflict:[5,'RESULTS']};
function build(){S.steps=[{t:'hello'},{t:'scope'},{t:'signup'},{t:'pick'}];S.sel.forEach(id=>S.steps.push({t:'book',id}));S.steps.push({t:'results'});conflicts().forEach(src=>S.steps.push({t:'conflict',src}));S.steps.push({t:'pad'})}
let iv=0;
function go(n){clearInterval(iv);S.i=Math.max(0,Math.min(n,S.steps.length-1));render()}
const next=()=>go(S.i+1);
function shell(body,st){const pct=Math.round((S.i+1)/S.steps.length*100),g=STG[S.steps[S.i].t],m=st&&st.src&&meta(st.src),min=S.authed?3:0;
  return `<div class="top"><button class="back" id="bk" aria-label="Back" ${S.i>min?'':'disabled'}>${ic('back',20,'#221C44')}</button><div class="bar" role="img" aria-label="Setup progress ${pct} percent"><i style="width:${pct}%"></i></div></div>${g?`<div class="stg">STEP ${g[0]} OF 5 · ${g[1]}</div>`:''}${m&&S.scope==='both'?`<div class="chip ${SP[m.s].cls}">${ic(SP[m.s].icon,16,m.s==='work'?'#fff':'#06303A')}${SP[m.s].n.toUpperCase()}</div>`:''}${body}`}
const V={
 hello(el){const F=['chatgpt','claude','grok','muse'];el.innerHTML=shell(`<div class="hero">${F.map((id,k)=>`<span class="orb" style="left:${[6,74,10,70][k]}%;top:${[14,10,66,70][k]}%;--mx:${[14,-12,10,-14][k]}px;--my:${[10,14,-12,-10][k]}px;animation-delay:${k*.5}s">${av(id)}</span>`).join('')}<span class="bob">${coach(190)}</span></div><div class="txt"><h1>Meet Coach.</h1><p>Coach AI trains your AIs to play as one team, so no two ever do the same job.</p></div><button class="btn" id="go">Let's go</button><button class="lnk" id="li">I already have a team</button>`);
  $('#go').onclick=next;$('#li').onclick=loginSheet},
 scope(el){const O=[['personal','home','#22B8CF','Personal','Your own email, calendar, messages and accounts.'],['work','case','#5B4BFF','Work','Work email, calendar, chat, files and code.'],['both','people','#22C27A','Both','Two separate boards, set up together.']];
  el.innerHTML=shell(`${say('What should my team help you with?')}<div class="fill stag" role="radiogroup" aria-label="Board">${O.map(([k,i,c,t,d])=>`<button class="opt" role="radio" aria-checked="${S.scope===k}" data-k="${k}"><span class="ic" style="background:${c}">${ic(i,30)}</span><span style="flex:1;min-width:0"><b>${t}</b><small>${d}</small></span><span class="mk">${S.scope===k?ic('check',15,'#fff',3):''}</span></button>`).join('')}</div><p class="note">The positions on each board are set. You only pick the board.</p><button class="btn" id="go">Next</button>`);
  $$('.opt',el).forEach(b=>b.onclick=()=>{S.scope=b.dataset.k;S.space=spaces()[0];render(true)});$('#go').onclick=next},
 signup(el){el.innerHTML=shell(`${say('Sign up so I can keep your team between visits.')}<form class="fill stag" id="f" novalidate><label class="field">Your first name<input id="nm" autocomplete="given-name" maxlength="18" required></label><label class="field">Email<input id="em" type="email" autocomplete="email" required></label><label class="field">Password<input id="pw" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label><p id="er" class="err" role="alert"></p></form><button class="btn" id="go">Create my team</button>`);
  const sub=async()=>{const b=$('#go');b.disabled=true;b.textContent='Creating your team…';try{const sc=S.scope;hydrate(await api('signup',{name:$('#nm').value,email:$('#em').value,password:$('#pw').value}),true);S.scope=sc;S.space=spaces()[0];await saveNow();next()}catch(e){$('#er').textContent=e.message;b.disabled=false;b.textContent='Create my team'}};
  $('#go').onclick=sub;$('#f').onsubmit=e=>{e.preventDefault();sub()}},
 pick(el){const ok=()=>S.sel.length>=2;
  el.innerHTML=shell(`${say('Which AIs do you use? Pick your players.')}<div class="ais ${S.sel.length?'':'stag'}">${ORDER.map(id=>`<button class="ai" data-id="${id}" aria-pressed="${S.sel.includes(id)}">${av(id)}<span>${N(id)}</span><i>${ic('check',13,'#fff',3)}</i></button>`).join('')}</div><button class="btn" id="go" ${ok()?'':'disabled'}>${ok()?`Train ${S.sel.length} AIs`:'Pick at least two'}</button>`);
  $$('.ai',el).forEach(b=>b.onclick=()=>{const id=b.dataset.id;S.sel=S.sel.includes(id)?S.sel.filter(x=>x!==id):ORDER.filter(x=>x===id||S.sel.includes(x));render(true)});
  $('#go').onclick=async()=>{if(!ok())return;const b=$('#go');b.disabled=true;b.textContent='Making their keys…';await saveNow();if(S.sel.every(id=>S.keys[id])){build();S.i=S.steps.findIndex(x=>x.t==='pick');next()}else{b.disabled=false;b.textContent='Try again'}}},
 book(el,st){const id=st.id,n=N(id),k=S.sel.indexOf(id),last=k===S.sel.length-1;let stage=S.joined[id]?3:1;
  const report=()=>spaces().map(s=>{const L=SP[s].m.filter(m=>(S.reach[id]||[]).includes(sid(s,m[0])));return `<div><small>${SP[s].n.toUpperCase()}</small><span class="chips">${L.length?L.map(m=>`<span style="--c:${m[3]}">${m[1]}</span>`).join(''):'<b class="none">Nothing here</b>'}</span></div>`}).join('');
  const draw=()=>{el.innerHTML=shell(`<div class="steps">${['Copy',CONN[id]?'Add':'Paste','Report'].map((t,q)=>`<span class="${stage===q+1?'on':''} ${stage>q+1||(stage===3&&q===2)?'ok':''}"><b>${stage>q+1||(stage===3&&q===2)?ic('check',12,'#06301C',3.5):q+1}</b>${t}</span>`).join('')}</div>
    <div class="hero"><div class="pass"><span id="co">${coach(120)}</span><span class="to ${stage===2?'listen':''}">${av(id)}</span><b class="book"></b></div>${stage===2?'<div class="dots"><i></i><i></i><i></i></div>':''}${stage===3?`<div class="rep stag">${report()}</div>`:''}</div>
    <div class="txt"><h1>${stage===1?`${n}, here is your playbook.`:stage===2?(CONN[id]?`Now add it in ${n}.`:`Now paste it into ${n}.`):`${n} reported back.`}</h1><p>${stage===1?`AI ${k+1} of ${S.sel.length}. One tap copies ${CONN[id]?'its connector link':'it'}.`:stage===2?(CONN[id]?`Then tell ${n}: "Check in to Coach AI".`:`Coach is listening for ${n}…`):((S.reach[id]||[]).length?'This is what it says it can act on.':'It joined, but named no source yet.')}</p></div>
    <button class="btn" id="go" ${stage===2?'disabled':''}>${stage===1?(CONN[id]?'Copy connector link':'Copy playbook'):stage===2?`Listening for ${n}…`:last?'See the results':`Next: ${N(S.sel[k+1])}`}</button>
    ${stage===2?`<div class="lnks"><button class="lnk" id="hp">${CONN[id]?'Where do I add it?':'What do I do?'}</button><button class="lnk" id="ps">It replied with a line? Paste it</button><button class="lnk" id="sk">Skip ${n} for now</button></div>`:''}`,st);
   wireBack();
   $('#go').onclick=()=>{if(stage===3)return next();if(stage!==1)return;copy(setupText(id));whistle();$('#co').classList.add('toot');const bk=$('.book',el);bk.style.setProperty('--dx','120px');bk.style.setProperty('--dy','0px');bk.classList.add('fly');setTimeout(()=>{stage=2;draw();clearInterval(iv);iv=setInterval(check,2000)},750)};
   if(stage===2){$('#hp').onclick=()=>help(id);$('#ps').onclick=()=>pasteSheet(id,check);$('#sk').onclick=()=>{clearInterval(iv);S.skipped[id]=true;next()}}};
  const check=async()=>{if(S.steps[S.i]!==st)return clearInterval(iv);await pull();if(S.joined[id]&&stage!==3&&!$('.sheet')){clearInterval(iv);stage=3;ding(988);draw();if(last)confetti(24)}};
  draw()},
 results(el){const C=conflicts(),all=srcs(),set=all.filter(src=>owners(src).length).length,nobody=!live().length;
  el.innerHTML=shell(`${say(nobody?'No AI has reported yet. You can connect them from the Team tab.':C.length?`The results are in. I set ${set} positions. ${C.length} need${C.length>1?'':'s'} your call.`:`The results are in. ${set} positions are set.`)}<div class="fill">${spaces().map((s,si)=>`<div class="brd"><h2>${ic(SP[s].icon,16,'#221C44')}${SP[s].n.toUpperCase()}</h2><div class="strip">${SP[s].m.map((m,k)=>{const src=sid(s,m[0]),o=owners(src),sh=shared(src),q=C.includes(src);return `<span style="--c:${m[3]};--d:${(k*.07+si*.6).toFixed(2)}s" class="${q?'q':''}" role="img" aria-label="${m[1]}: ${sh?'shared':o.length?N(o[0]):q?'needs your call':'no AI yet'}">${ic(m[2],26)}${sh?`<em class="n">${o.length}</em>`:o.length?av(o[0]):q?'<em>?</em>':'<em class="n">0</em>'}</span>`}).join('')}</div></div>`).join('')}</div><p class="note">A face means that AI acts there. A number means shared. Yellow needs you.</p><button class="btn" id="go">${C.length?`Settle ${C.length} conflict${C.length>1?'s':''}`:'To the Launch Pad'}</button>`);
  ding(784);$('#go').onclick=()=>{build();S.i=S.steps.findIndex(x=>x.t==='results');next()}},
 conflict(el,st){const m=meta(st.src),e=can(st.src),all=S.steps.filter(x=>x.t==='conflict'),at=all.indexOf(st)+1;
  el.innerHTML=shell(`<div class="hero"><span class="bigsrc" style="--c:${m.c}">${ic(m.icon,52)}</span><div class="txt"><h1>Who oversees ${m.full}?</h1><p>${e.length} AIs can act on it. Pick one. The others can still read.</p></div></div><div class="choice n${Math.min(e.length,3)}">${e.length===2?'<span class="vs" aria-hidden="true">VS</span>':''}${e.map(id=>`<button data-id="${id}" class="${S.pick[st.src]===id?'win':''}">${av(id)}${N(id)}</button>`).join('')}</div><p class="note">Conflict ${at} of ${all.length}. You can change this later on the Launch Pad.</p>`,st);
  $$('.choice button',el).forEach(b=>b.onclick=()=>{S.pick[st.src]=b.dataset.id;saveNow();ding(1175);$$('.choice button',el).forEach(x=>{x.classList.toggle('win',x===b);x.classList.toggle('lose',x!==b)});setTimeout(next,700)})},
 pad(el){if(!S.onboarded){S.onboarded=true;saveNow()}
  if(DESK.matches){el.classList.add('desk');el.innerHTML='<section class="col" id="cT"></section><section class="col" id="cP"></section><section class="col" id="cH"></section>';teamView($('#cT'));padView($('#cP'));doneView($('#cH'))}
  else{el.classList.remove('desk');({pad:padView,team:teamView,done:doneView})[S.tab](el)}
  if(!S.arrived){S.arrived=true;if(S.play<4&&!S.quiet){whistle();confetti()}}
  clearInterval(iv);iv=setInterval(tick,3500)}
};
function wireBack(){const b=$('#bk');if(b)b.onclick=()=>go(S.i-1)}
function render(still){const st=S.steps[S.i],el=$('#scr'),m=st.src&&meta(st.src),s=st.t==='pad'?S.space:m?m.s:null;
  $('#app').classList.toggle('work',s==='work');$('#app').classList.toggle('wide',st.t==='pad');el.className='scr';if(!still){void el.offsetWidth;el.classList.add('enter')}
  V[st.t](el,st);wireBack()}
function loginSheet(){const sh=sheet(`<div class="big">${coach(84)}</div><h1>Welcome back.</h1><label class="field">Email<input id="le" type="email" autocomplete="email"></label><label class="field">Password<input id="lp" type="password" autocomplete="current-password"></label><p id="lr" class="err" role="alert"></p><button class="btn">Log in</button>`);
  $('.btn',sh).onclick=async()=>{try{hydrate(await api('login',{email:$('#le',sh).value,password:$('#lp',sh).value}),true);sh.close();enter()}catch(e){$('#lr',sh).textContent=e.message}}}
// Where does a signed-in person land? The Launch Pad if set up, else the first unfinished step.
function enter(){S.space=spaces()[0];build();const f=t=>S.steps.findIndex(t);
  if(S.onboarded)return go(S.steps.length-1);
  if(S.sel.length<2)return go(f(x=>x.t==='pick'));
  const b=f(x=>x.t==='book'&&!S.joined[x.id]&&!S.skipped[x.id]);go(b>=0?b:f(x=>x.t==='results'))}

/* ---------- Launch Pad ---------- */
const navHTML=()=>DESK.matches?'':`<div class="nav">${[['pad','Pad'],['team','Team'],['done',S.log.length+' Done']].map(([k,t])=>`<button data-t="${k}" ${S.tab===k?'aria-current="page"':''}>${t}</button>`).join('')}</div>`;
function wireNav(el){$$('.nav button',el).forEach(b=>b.onclick=()=>{S.tab=b.dataset.t;render(true)})}
const ownHTML=src=>{const o=owners(src),e=can(src);if(shared(src))return e.length?e.slice(0,3).map(av).join(''):'<span>No AI</span>';return o.length?av(o[0]):e.length>1?'<span class="y">Pick</span>':'<span>No AI</span>'};
function padView(el){const both=S.scope==='both',s=S.space,P=SP[s],md=S.mode[s]||'on';
  el.innerHTML=`<div class="padh">${coach(42)}<h1><small>COACH AI</small>${esc(S.team||'Team '+S.name)}</h1></div>
   ${both?`<div class="seg" role="group" aria-label="Board">${['personal','work'].map(k=>`<button data-s="${k}" aria-pressed="${s===k}">${ic(SP[k].icon,18,'currentColor')}${SP[k].n}<small>${S.log.filter(w=>meta(w.src).s===k).length} done</small></button>`).join('')}</div>`:`<div class="chip ${P.cls}" style="align-self:flex-start">${ic(P.icon,16,s==='work'?'#fff':'#06303A')}${P.n.toUpperCase()} BOARD</div>`}
   <div class="sw" role="group" aria-label="${P.n} board switch">${[['on','ON'],['pause','PAUSE'],['off','OFF']].map(([m,t])=>`<button data-m="${m}" aria-pressed="${md===m}">${t}</button>`).join('')}</div>
   ${playCard()}
   <div class="grid ${md==='on'?'':'dim'}">${P.m.map(m=>{const src=sid(s,m[0]);return `<button class="m ${S.spot===src?'spot':''}" style="--c:${m[3]}" data-src="${src}" aria-label="${m[1]}">${ic(m[2],30)}${m[1]}${shared(src)?'<small>SHARED</small>':''}<span class="own">${ownHTML(src)}</span></button>`}).join('')}</div>${navHTML()}`;
  $$('.seg button',el).forEach(b=>b.onclick=()=>{S.space=b.dataset.s;render()});
  $$('.sw button',el).forEach(b=>b.onclick=()=>{S.mode={...S.mode,[s]:b.dataset.m};saveNow();ding(b.dataset.m==='on'?880:440);render(true)});
  $$('.m',el).forEach(b=>b.onclick=()=>srcSheet(b.dataset.src));
  wirePlay(el);wireNav(el)}
const quietAI=()=>live().find(id=>now()-(S.seen[id]||S.joined[id])>864e5);
function playCard(){const p=S.play,pips=k=>`<i class="${k<p?'d':k===p?'c':''}"></i>`;
  if(S.needs.length)return `<div class="play warn" id="play">${coach(46)}<span class="tx"><small>COACH NEEDS YOU</small><b>${S.needs.length} call${S.needs.length>1?'s':''} to make.</b></span><button class="do" id="do" data-a="need">Decide</button></div>`;
  if(p>=4){const qa=quietAI();if(qa)return `<div class="play" id="play">${coach(46)}<span class="tx"><small>TODAY'S PLAY</small><b>${N(qa)} has gone quiet. Send it a nudge.</b></span><button class="do" id="do" data-a="nudge" data-id="${qa}">Copy</button></div>`;
    return `<button class="brief" id="brief">${coach(40)}<span><small>COACH'S BRIEFING</small><b>Hear today's rundown</b></span><span class="pl"><svg width="14" height="14" viewBox="0 0 24 24" fill="#221C44" aria-hidden="true"><path d="M7 4l14 8-14 8z"/></svg></span></button>`}
  const j=firstJob(),e=empties()[0];
  const T=[!live().length?['No AI has checked in yet. Connect one.','Team']:j?(S.wait?[`Paste it into ${N(j.id)}. I'm watching for its report.`,'Skip']:[`First play: give ${N(j.id)} a job.`,'Show me']):['No AI has a position yet.','Skip'],['Next: hear my rundown.','Play'],e?[`${meta(e).full} has no AI yet. Take a look.`,'Show me']:['Every position is covered.','Nice'],["You're set. I'll whistle when something needs you.",'Got it']][p];
  return `<div class="play" id="play">${coach(46)}<span class="tx"><small>NEXT PLAY ${[0,1,2,3].map(pips).join('')}</small><b>${T[0]}</b></span><button class="do" id="do" data-a="play">${T[1]}</button></div>`}
const firstJob=()=>{for(const src of srcs())if(!shared(src)&&owners(src).length&&TASK[meta(src).k])return {src,id:owners(src)[0]};return null};
function adv(){S.play++;S.wait=false;saveNow();render(true);const c=$('#play');if(c)c.classList.add('flash')}
function briefing(after){const wk=now()-7*864e5,L=spaces().map(s=>{const n=S.log.filter(w=>meta(w.src).s===s&&w.at>=wk).length,md=S.mode[s];return `${SP[s].n}: ${md==='on'?`${n} done this week`:md==='pause'?'paused':'off'}.`});
  const C=conflicts().length,E=empties().length,min=S.log.filter(w=>w.at>=wk).reduce((n,w)=>n+(w.min||0),0),open=S.tasks.length;
  const sh=sheet(`<div class="big">${coach(84)}</div><h1>Here's the rundown.</h1><div class="list stag">${L.map(t=>`<div>${t}</div>`).join('')}<div>${open} job${open===1?'':'s'} in progress. ${hm(min)} back this week.</div><div>${C?`${C} position${C>1?'s':''} need your call.`:E?`${E} position${E>1?'s have':' has'} no AI yet.`:'Every position is covered.'}</div></div><button class="btn">Thanks, Coach</button>`,after);$('.btn',sh).onclick=()=>sh.close()}
function wirePlay(el){const b=$('#brief',el);if(b)b.onclick=()=>briefing();const d=$('#do',el);if(!d)return;
  d.onclick=()=>{const a=d.dataset.a;
   if(a==='need')return needSheet();
   if(a==='nudge'){const id=d.dataset.id;copy(`Check in to Coach AI: read the team state and tell me what you are working on.`);toast(`Copied. Paste it into ${N(id)}.`);return}
   const p=S.play,j=firstJob(),e=empties()[0];
   if(p===0){if(!live().length){S.tab='team';if(DESK.matches)return toast('Connect an AI from the Team column.');return render(true)}
    if(!j||S.wait)return adv();const m=meta(j.src);
    const sh=sheet(`<div class="big"><span class="ico" style="--c:${m.c}">${ic(m.icon,34)}</span>${av(j.id)}</div><h1>Try this with ${N(j.id)}.</h1><div class="list"><div>${TASK[m.k]}</div></div><p>It claims the job, does it, and reports back here.</p><button class="btn">Copy the task</button>`);
    $('.btn',sh).onclick=()=>{copy(TASK[m.k]);sh.close();S.wait=true;S.space=m.s;render(true)};return}
   if(p===1)return briefing(adv);
   if(p===2){if(!e)return adv();S.space=meta(e).s;S.spot=e;render(true);return}
   if(p===3){confetti(20);return adv()}}}
function srcSheet(src){const m=meta(src),sh0=shared(src),wk=now()-7*864e5;
  const draw=()=>{const o=owners(src),e=can(src),W=S.log.filter(w=>w.src===src),w7=W.filter(w=>w.at>=wk),open=S.tasks.filter(x=>x.src===src),g=group(W).slice(0,12),md=S.mode[m.s];
   const head=md!=='on'?`${SP[m.s].n} is ${md==='pause'?'paused':'off'}. Nobody acts.`:sh0?(e.length?`Shared. ${e.map(N).join(', ')} can work here when you ask.`:'Shared. No AI can reach it yet.'):o.length?`${N(o[0])} acts on ${m.full}.`:e.length>1?`${e.length} AIs can reach it. Pick one.`:`No AI can reach ${m.full} yet.`;
   const sh=sheet(`<div class="big"><span class="ico" style="--c:${m.c}">${ic(m.icon,34)}</span>${(sh0?e:o).slice(0,3).map(av).join('')}</div><h1>${m.full}</h1><p>${head}</p>
    <div class="mvs"><div><b>${w7.length}</b>done this week</div><div><b>${hm(w7.reduce((n,w)=>n+(w.min||0),0))}</b>time back</div><div><b>${open.length}</b>open now</div></div>
    <div class="rows scrollr">${open.map(x=>`<div class="row"><span class="a">${av(x.id)}</span><span class="t"><b>${esc(x.title)}</b><small>In progress · ${N(x.id)}${x.by?' · '+esc(x.by):''} · ${ago(x.at)}</small></span><button class="chipb" data-clr="${x.k}">Clear</button></div>`).join('')}${g.map(winRow).join('')}${open.length||g.length?'':'<p class="note">Nothing here yet. Work lands when an AI reports it.</p>'}</div>
    ${sh0?'':`<div class="pick" role="group" aria-label="Who acts here">${live().map(id=>`<button data-id="${id}" aria-pressed="${o[0]===id}" aria-label="${N(id)}">${av(id)}</button>`).join('')}</div>`}
    <button class="btn" id="sdn">Done</button>`,()=>{if(S.spot===src){S.spot=null;if(S.play===2)S.play=3;saveNow()}render(true)});
   $('#sdn',sh).onclick=()=>sh.close();
   $$('.pick button',sh).forEach(b=>b.onclick=()=>{S.pick={...S.pick,[src]:b.dataset.id};saveNow();ding(1175);draw()});
   $$('[data-clr]',sh).forEach(b=>b.onclick=async()=>{try{hydrate(await api('task',{k:b.dataset.clr}),false);toast('Claim cleared.')}catch(x){toast(esc(x.message))}draw()});
   $$('.row[data-k]',sh).forEach(r=>r.onclick=()=>winSheet(g[+r.dataset.k]))};
  draw()}
function needSheet(){const n=S.needs[0];if(!n)return;const m=meta(n.src),A=N(n.a);let h,p,B;
  if(n.t==='pick'){h=`Who acts on ${m.full}?`;p=`${A} wanted to start "${esc(n.title||'a task')}". Pick the AI that acts here.`;B=can(n.src).map(id=>[id,N(id)])}
  else if(n.t==='wrong'){h=`${A} reached into ${m.full}.`;p=`That is ${N(n.o)}'s position. The task was "${esc(n.title)}".`;B=[[n.o,`Keep ${N(n.o)}`],[n.a,`Hand it to ${A}`]]}
  else if(n.t==='overlap'){h=`Two AIs on the same job.`;p=`${A} and ${N(n.b)} both picked up "${esc(n.title)}" on ${m.full}.`;B=[[n.a,`${A} keeps it`],[n.b,`${N(n.b)} keeps it`],['both','Let both work']]}
  else{h=`${A} has gone quiet on a job.`;p=`"${esc(n.title)}" was claimed ${ago(n.at)} with no report.`;B=[['nudge','Ask for an update'],['drop','Drop it']]}
  const sh=sheet(`<div class="big">${coach(70)}${av(n.a)}</div><h1>${h}</h1><p>${p}</p>${B.map(([v,t],k)=>`<button class="btn ${k?'alt':''}" data-v="${v}">${t}</button>`).join('')}<p class="note">${S.needs.length>1?`${S.needs.length-1} more after this.`:'That is the last one.'}</p>`);
  $$('.btn',sh).forEach(b=>b.onclick=async()=>{try{const st=await api('need',{k:n.k,v:b.dataset.v});if(n.t==='pick'||n.t==='wrong')S.pick={...S.pick,[n.src]:b.dataset.v};hydrate(st,false);sent=ownJSON()}catch(e){toast(esc(e.message))}sh.close();render(true);if(S.needs.length)needSheet()})}

/* ---------- Done ---------- */
const nrm=s=>String(s).toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
function group(list){const out=[],ix={};for(const w of list){const k=w.id+'|'+w.src+'|'+nrm(w.text);if(ix[k]){ix[k].n++;ix[k].min+=w.min||0;ix[k].first=Math.min(ix[k].first,w.at)}else out.push(ix[k]={...w,min:w.min||0,n:1,first:w.at})}return out}
const winRow=(w,k)=>`<button class="row" data-k="${k}"><span class="a">${av(w.id)}</span><span class="t"><b>${esc(w.text)}${w.n>1?`<span class="xn">&times;${w.n}</span>`:''}</b><small>${N(w.id)}${w.by?' · '+esc(w.by):''} · ${meta(w.src).full} · ${w.n>1?'last ':''}${day(w.at)}</small></span><span class="okc">${ic('check',14,'#06301C',3)}</span></button>`;
function winSheet(w){const m=meta(w.src),L=w.link&&/^https?:\/\//i.test(w.link)?w.link:'',a=N(w.id);
  const sh=sheet(`<div class="big">${av(w.id)}<span class="ico" style="--c:${m.c}">${ic(m.icon,34)}</span></div><h1>${esc(w.text)}</h1><p>${a} · ${m.full} · ${day(w.at)}${w.n>1?` · reported ${w.n} times`:''}${w.min?` · ${w.min} min saved`:''}</p>${L?`<a class="btn" href="${esc(L)}" target="_blank" rel="noopener noreferrer">Open the result</a>`:''}<button class="btn ${L?'alt':''}" id="ask">Ask ${a} what it did</button>`);
  $('#ask',sh).onclick=()=>{copy(`You reported this to Coach AI on ${new Date(w.at).toLocaleString()}: "${w.text}" under ${m.full}. Show me what you did and anything I should know.`);sh.close();toast(`Question copied. Paste it into ${a}.`)}}
function doneView(el){const team=S.sel;
  el.innerHTML=`<div class="padh"><h1>Done</h1><button class="chipb" id="qz" aria-pressed="${S.quiet}">Celebrations: ${S.quiet?'Quiet':'Big'}</button></div>
   <input class="search" id="q" type="search" placeholder="Search what got done" aria-label="Search finished items" value="${esc(S.q)}">
   <div class="filt"><div>${team.map(id=>`<button data-id="${id}" class="${S.fa===id?'on':''}" aria-pressed="${S.fa===id}" aria-label="Only ${N(id)}">${av(id)}</button>`).join('')}</div><span id="hc"></span></div>
   <div class="rows" id="hl" aria-live="polite"></div>
   <div class="two"><button class="btn sm" id="pr">Paste a report</button><button class="btn sm alt" id="exp">Export</button></div>${navHTML()}`;
  let g=[];const draw=()=>{const q=S.q.toLowerCase(),m=S.log.filter(w=>(!S.fa||w.id===S.fa)&&(!q||[w.text,N(w.id),meta(w.src).full,w.by||''].join(' ').toLowerCase().includes(q)));g=group(m);
    $('#hc',el).textContent=`${m.length} item${m.length===1?'':'s'}`;$('#hl',el).innerHTML=g.length?g.map(winRow).join(''):`<p class="note" style="margin-top:24px">${S.log.length?'Nothing matches.':'Nothing yet. Finished items land here when your AIs report them.'}</p>`;
    $$('#hl .row',el).forEach(r=>r.onclick=()=>winSheet(g[+r.dataset.k]))};
  draw();
  $('#q',el).oninput=e=>{S.q=e.target.value.trim();draw()};
  $$('.filt button',el).forEach(b=>b.onclick=()=>{S.fa=S.fa===b.dataset.id?null:b.dataset.id;$$('.filt button',el).forEach(x=>{const on=S.fa===x.dataset.id;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});draw()});
  $('#qz',el).onclick=e=>{S.quiet=!S.quiet;saveNow();e.currentTarget.textContent=`Celebrations: ${S.quiet?'Quiet':'Big'}`;e.currentTarget.setAttribute('aria-pressed',S.quiet)};
  $('#pr',el).onclick=()=>pasteSheet(null,()=>render(true));
  $('#exp',el).onclick=()=>{const data=JSON.stringify({exported:new Date().toISOString(),owner:S.name,boards:spaces(),positions:Object.fromEntries(srcs().map(src=>[src,owners(src).map(N)])),log:S.log.map(w=>({item:w.text,by:N(w.id),bot:w.by||null,source:w.src,when:new Date(w.at).toISOString(),link:w.link||null,minutes:w.min}))},null,1);
    try{const u=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='coach-ai-export.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('Export downloaded.')}catch(e){copy(data);toast('Export copied.')}};
  wireNav(el)}

/* ---------- Team ---------- */
const status=id=>S.benched[id]?'On the bench':S.joined[id]?`Last heard from ${ago(S.seen[id]||S.joined[id])}`:'Not connected yet';
function teamView(el){
  el.innerHTML=`<div class="padh"><h1>Team</h1><button class="chipb" id="acct">Account</button></div>
   <div class="rows" id="tl">${S.sel.map(id=>`<button class="row ${S.joined[id]&&!S.benched[id]?'':'off'}" data-id="${id}"><span class="a">${av(id)}<i class="dot ${S.benched[id]?'':S.joined[id]?(quietAI()===id?'q':'g'):''}"></i></span><span class="t"><b>${N(id)}</b><small>${status(id)}</small></span><span class="cnt">${S.log.filter(w=>w.id===id).length}</span></button>`).join('')}</div>
   <button class="btn sm alt" id="add">+ Add an AI</button>${navHTML()}`;
  $$('#tl .row',el).forEach(r=>r.onclick=()=>aiSheet(r.dataset.id));
  $('#add',el).onclick=()=>{const rest=ORDER.filter(id=>!S.sel.includes(id));if(!rest.length)return toast('Every AI is already on the team.');
    const sh=sheet(`<h1>Add a player</h1><div class="ais small">${rest.map(id=>`<button class="ai" data-id="${id}">${av(id)}<span>${N(id)}</span></button>`).join('')}</div>`);
    $$('.ai',sh).forEach(b=>b.onclick=async()=>{const id=b.dataset.id;S.sel=ORDER.filter(x=>x===id||S.sel.includes(x));sh.close();await saveNow();render(true);connectSheet(id)})};
  $('#acct',el).onclick=acctSheet;wireNav(el)}
function connectSheet(id){const n=N(id);let t=0;
  const sh=sheet(`<div class="big">${coach(70)}<span class="to listen">${av(id)}</span></div><h1>Connect ${n}</h1><p>${CONN[id]?`${ADD[id]} Then tell ${n}: "Check in to Coach AI".`:`Copy its playbook, paste it into ${n}, and send.`}</p><button class="btn" id="cp">${CONN[id]?'Copy connector link':'Copy playbook'}</button><button class="lnk" id="hp">More help and its key</button><button class="lnk" id="ps">It replied with a line? Paste it</button>`,()=>clearInterval(t));
  const check=async()=>{await pull();if(S.joined[id]){clearInterval(t);if($('.sheet')===sh)sh.close();ding(988);toast(`${n} joined the team.`);render(true);if(conflicts().length)toast(`${n} joined. A position needs your call.`)}};
  $('#cp',sh).onclick=e=>{copy(setupText(id));whistle();e.currentTarget.textContent=`Listening for ${n}…`;clearInterval(t);t=setInterval(check,2000)};
  $('#hp',sh).onclick=()=>{clearInterval(t);help(id)};$('#ps',sh).onclick=()=>{clearInterval(t);pasteSheet(id,check)}}
function aiSheet(id){const n=N(id),r=(S.reach[id]||[]).map(src=>meta(src)).filter(m=>m.s);
  const sh=sheet(`<div class="big">${av(id)}</div><h1>${n}</h1><p>${status(id)}</p>${r.length?`<div class="chips c">${r.map(m=>`<span style="--c:${m.c}">${m.full}</span>`).join('')}</div>`:''}
   ${S.joined[id]?`<button class="btn" data-a="brief">Brief ${n}</button><button class="btn alt" data-a="setup">Set it up again</button>`:`<button class="btn" data-a="connect">Connect ${n}</button>`}
   <div class="two"><button class="btn sm alt" data-a="bench">${S.benched[id]?'Put back in':'Bench'}</button><button class="btn sm alt" data-a="rm">Remove</button></div>`);
  $$('[data-a]',sh).forEach(b=>b.onclick=async()=>{const a=b.dataset.a;sh.close();
    if(a==='brief'){try{const x=await api('update?id='+id);copy(x.text);toast(`Team state copied. Paste it into ${n}.`)}catch(e){toast(esc(e.message))}}
    if(a==='setup'){copy(setupText(id));toast(CONN[id]?'Connector link copied.':'Playbook copied.');help(id)}
    if(a==='connect')connectSheet(id);
    if(a==='bench'){S.benched={...S.benched,[id]:!S.benched[id]};if(!S.benched[id])delete S.benched[id];saveNow();render(true)}
    if(a==='rm'){const c=sheet(`<div class="big">${av(id)}</div><h1>Remove ${n}?</h1><p>Its key stops working and it leaves every position. Its finished work stays in Done.</p><button class="btn" id="y">Remove ${n}</button><button class="btn alt" id="x">Keep it</button>`);$('#x',c).onclick=()=>c.close();$('#y',c).onclick=async()=>{c.close();S.sel=S.sel.filter(x=>x!==id);await saveNow();render(true)}}})}
function acctSheet(){const sh=sheet(`<div class="big">${coach(70)}</div><h1>${esc(S.name)}</h1><p>${esc(S.email)}</p><button class="btn alt" id="lo">Log out</button><button class="lnk danger" id="del">Delete my account</button>`);
  $('#lo',sh).onclick=async()=>{await saveNow();try{await api('logout',{})}catch(e){}location.reload()};
  $('#del',sh).onclick=()=>{const c=sheet(`<div class="big">${coach(70)}</div><h1>Delete everything?</h1><p>Your team, every AI key, all positions and the whole Done log are deleted for good. This cannot be undone.</p><label class="field">Type your password to confirm<input id="dp" type="password" autocomplete="current-password"></label><p id="de" class="err" role="alert"></p><button class="btn red" id="y">Delete my account</button><button class="btn alt" id="x">Keep my team</button>`);
    $('#x',c).onclick=()=>c.close();$('#y',c).onclick=async()=>{try{await api('delete',{password:$('#dp',c).value});location.reload()}catch(e){$('#de',c).textContent=e.message}}}}

/* ---------- live updates ---------- */
async function tick(){await pull();const st=S.steps[S.i];if(!st||st.t!=='pad')return;
  if(S.fresh.length){const w=S.fresh.shift();S.fresh=S.fresh.slice(-3);if(S.play===0&&S.wait){S.play=1;S.wait=false;saveNow()}if(!S.quiet){confetti(30);ding(1320)}toast(`${N(w.id)} finished: ${esc(w.text)}`)}
  if(!$('.sheet')&&document.activeElement!==$('#q'))render(true)}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const s=$('.sheet');if(s)s.close()}});
DESK.addEventListener('change',()=>render(true));
(async()=>{build();try{hydrate(await api('state'),true);enter()}catch(e){render()}})();
