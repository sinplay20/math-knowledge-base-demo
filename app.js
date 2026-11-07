'use strict';
const TYPES={statement:'陈述',definition:'定义',notation:'记号',axiom:'公理',assumption:'假设',theorem:'定理',proposition:'命题',lemma:'引理',corollary:'推论',conjecture:'猜想',example:'例子',remark:'注记',exercise:'练习',problem:'问题'};
const RELATIONS={depends_on:'依赖',implies:'蕴含',equivalent_to:'等价于',special_case_of:'特例',example_of:'例子',counterexample_to:'反例',related_to:'相关'};
const $=selector=>document.querySelector(selector);
let data,byId,entries,allEdges;
let state={view:'item',id:null,part:'body',query:'',type:'',explicitOnly:false};
let mathQueue=Promise.resolve(),toastTimer;

// Source strings are always text nodes; original LaTeX/JSON is never HTML.
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function button(text,action,className='link'){const n=el('button',className,text);n.type='button';n.addEventListener('click',action);return n;}
function title(item){return item.Original.indexing.identifier||(item.Original.content.type==='statement'?'无标识陈述':TYPES[item.Original.content.type]);}
function kind(item){return el('span',`kind ${item.Original.content.type}`,item.Original.content.type);}
function basis(value){return el('span',`basis ${value}`,value==='explicit'?'原文明确':'推断');}
function paragraphs(text){const n=el('div','original');for(const p of text.split(/\n\s*\n/))n.append(el('p','',p));return n;}
function currentEdges(){return allEdges.filter(e=>!state.explicitOnly||e.basis==='explicit');}
function locations(id,part){return entries.filter(e=>e.item_id===id&&(!part||e.part===part));}
function pageFor(id,part){return locations(id,part).map(e=>e.page||'未标页').join(', ');}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2200);}
function navigate(view,id=state.id,part='body'){
  const hash=new URLSearchParams({view,item:id,part}).toString();
  if(location.hash.slice(1)===hash)render();else location.hash=hash;
}
function readHash(){
  const p=new URLSearchParams(location.hash.slice(1));
  if(byId.has(p.get('item')))state.id=p.get('item');
  if(['item','reading','graph'].includes(p.get('view')))state.view=p.get('view');
  state.part=p.get('part')==='proof'?'proof':'body';render();
}

function renderList(){
  const list=$('#item-list');list.replaceChildren();const q=state.query.toLocaleLowerCase();
  const items=entries.filter(e=>e.part==='body').map(e=>byId.get(e.item_id)).filter(item=>{
    const o=item.Original;return(!state.type||o.content.type===state.type)&&(!q||[item.id,o.indexing.identifier,o.content.body,o.content.proof].join('\n').toLocaleLowerCase().includes(q));
  });
  $('#result-count').textContent=`${items.length} / ${data.items.length}`;
  for(const item of items){
    const n=button('',()=>navigate('item',item.id),`item-button${item.id===state.id?' selected':''}`);
    n.setAttribute('aria-current',String(item.id===state.id));
    const top=el('div','item-top');top.append(kind(item),el('span','item-title',item.Original.indexing.identifier||TYPES[item.Original.content.type]));
    n.append(top,el('p','snippet',item.Original.content.body),el('div','item-page',`第 ${pageFor(item.id)} 页 · ${item.id.slice(0,8)}`));list.append(n);
  }
  if(!items.length)list.append(el('p','empty','没有匹配条目。试试其他关键词或类型。'));
}
function relationCard(edge,id){
  const card=el('div','relation-card'),out=edge.source===id,other=byId.get(out?edge.target:edge.source),top=el('div','relation-top');
  top.append(basis(edge.basis),el('span','relation-type',`${out?'出边':'入边'} · ${RELATIONS[edge.type]||edge.type}`));
  card.append(top,button(`${out?'→':'←'} ${title(other)}`,()=>navigate('item',other.id),'link relation-target'));
  if(edge.explanation)card.append(el('p','relation-explanation',edge.explanation));return card;
}
function inspector(item){
  const side=el('aside','inspector');side.setAttribute('aria-label','来源与关系');
  const info=el('section','card info-card');info.append(el('h3','','条目档案'));
  const dl=el('dl','metadata');
  const add=(label,value)=>{const group=el('div');group.append(el('dt','',label),el('dd','',value));dl.append(group);};
  const group=el('div');group.append(el('dt','','稳定 UUID'));const dd=el('dd','uuid-row');
  const copy=button('复制',async()=>{try{await navigator.clipboard.writeText(item.id);toast('UUID 已复制');}catch{toast('当前环境不支持复制，请从原始 JSON 选取 UUID。');}},'copy-button');
  copy.setAttribute('aria-label','复制完整 UUID');dd.append(el('code','',item.id),copy);group.append(dd);dl.append(group);
  add('物理分片',`knowledge/items/${item.id.slice(0,2)}.jsonl`);add('来源文献','Even integers · 虚构演示');
  add('原文位置',locations(item.id).map(e=>`${e.part==='proof'?'证明':'正文'} / 第 ${e.page||'未标'} 页`).join('；'));info.append(dl);
  const details=el('details','source-json');details.append(el('summary','','查看原始 JSON'),el('pre','',JSON.stringify(item,null,2)));info.append(details);
  const relations=el('section','card info-card'),edges=currentEdges().filter(e=>e.source===item.id||e.target===item.id);
  relations.append(el('h3','',`条目关系 / ${edges.length}`));
  if(edges.length)edges.forEach(e=>relations.append(relationCard(e,item.id)));else relations.append(el('p','note','当前筛选下没有已记录的关系。'));
  relations.append(el('p','note','关系连接完整条目。相邻段落不自动构成数学依赖；推断关系始终单独标记。'));
  side.append(info,relations);return side;
}
function itemView(){
  const item=byId.get(state.id),o=item.Original,layout=el('div','detail-layout'),column=el('div'),card=el('article','card item-card');
  const head=el('header','card-header'),meta=el('div','card-meta');meta.append(kind(item),el('span','','ORIGINAL · 原文条目'));
  head.append(meta,el('h3','',title(item)),el('div','section-path',(o.indexing.location.section||[]).join(' / ')));
  const body=el('section','body-content'),label=el('div','section-label');
  label.append(el('span','','正文 / BODY'),button(`第 ${pageFor(item.id,'body')} 页 ↗`,()=>navigate('reading',item.id,'body'),'page-link'));
  body.append(label,paragraphs(o.content.body));card.append(head,body);
  if(o.content.proof){
    const proof=el('section','proof-area'),label=el('div','section-label');
    label.append(el('span','','证明 / PROOF'),button(`第 ${pageFor(item.id,'proof')} 页 ↗`,()=>navigate('reading',item.id,'proof'),'page-link'));
    proof.append(label,paragraphs(o.content.proof),el('div','qed','□'));card.append(proof);
  }
  column.append(card);
  if(o.content.proof){
    const trace=el('section','card timeline-card');trace.append(el('h3','mini-title','异页出现，同一个数学条目'));const timeline=el('div','timeline');
    for(const part of ['body','proof']){
      if(part==='proof')timeline.append(el('span','connector'));const n=button('',()=>navigate('reading',item.id,part),'');
      n.append(el('strong','',`${part==='body'?'定理陈述':'原文证明'} · p.${pageFor(item.id,part)}`),el('small','',part==='body'?'正文先出现':'证明附于相同 UUID'));timeline.append(n);
    }
    trace.append(timeline,el('p','timeline-note','阅读顺序表分别记录 body 与 proof；条目本身保存完整陈述及证明。点击位置可回到原文顺序。'));column.append(trace);
  }
  layout.append(column,inspector(item));return layout;
}
function readingView(){
  const wrapper=el('section'),intro=el('div','reading-top');intro.append(el('strong','','Chapter 1. Integers / 1.1 Even integers'),el('span','',`${entries.length} 个阅读位置`));
  wrapper.append(intro,el('div','reading-note','按文献顺序阅读。第 2 页的定理陈述与第 5 页的证明属于同一个条目，中间的陈述保留在原来的位置。页码仅用于演示，没有真实 PDF。'));
  const list=el('div','reading-list');entries.forEach((entry,index)=>{
    const item=byId.get(entry.item_id),selected=entry.item_id===state.id&&entry.part===state.part,row=el('div','reading-row');row.id=`position-${index}`;
    const marker=el('div','page-marker','PAGE');marker.append(el('b','',entry.page||'—'));
    const article=el('article',`card reading-card${selected?' selected-part':''}`);if(selected)article.setAttribute('data-selected-part','true');
    const head=el('div','reading-card-head');head.append(button(`${title(item)}${entry.part==='proof'?' · 证明':''}`,()=>navigate('item',item.id)),el('span','',`${String(index+1).padStart(2,'0')} / ${entry.part}`));
    article.append(head,paragraphs(item.Original.content[entry.part]),el('div','part-id',`${item.id} · ${entry.part}`));row.append(marker,article);list.append(row);
  });wrapper.append(list);return wrapper;
}
function svgNode(tag,attrs){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;}
function graphView(){
  const wrapper=el('div'),card=el('section','card graph-card'),head=el('div','graph-heading');head.append(el('h3','','数学联系，而非阅读先后'));
  const legend=el('div','legend');for(const[key,label]of[['explicit','原文明确'],['inferred','推断']]){const n=el('span');n.append(el('i',key),document.createTextNode(label));legend.append(n);}head.append(legend);card.append(head);
  const stage=el('div','graph-stage');stage.setAttribute('aria-label','条目关系图，箭头从关系记录所在条目指向目标条目');
  const svg=svgNode('svg',{viewBox:'0 0 800 350',preserveAspectRatio:'none','aria-hidden':'true'}),defs=svgNode('defs',{});
  for(const[name,color]of[['explicit','#588569'],['inferred','#bb965c']]){const m=svgNode('marker',{id:`arrow-${name}`,markerWidth:'9',markerHeight:'9',refX:'8',refY:'4',orient:'auto',markerUnits:'strokeWidth'});m.append(svgNode('path',{d:'M0,0 L8,4 L0,8 Z',fill:color}));defs.append(m);}svg.append(defs);
  const bodies=entries.filter(e=>e.part==='body'),positions=new Map(bodies.map((e,i)=>[e.item_id,[[20,22],[20,75],[50,46],[80,75]][i]||[50,50]]));
  for(const edge of currentEdges()){
    const s=positions.get(edge.source),t=positions.get(edge.target),x1=s[0]*8,y1=s[1]*3.5,x2=t[0]*8,y2=t[1]*3.5,dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
    const line=svgNode('line',{x1:x1+dx/len*80,y1:y1+dy/len*46,x2:x2-dx/len*83,y2:y2-dy/len*47,stroke:edge.basis==='explicit'?'#588569':'#bb965c','stroke-width':'1.6','marker-end':`url(#arrow-${edge.basis})`});
    if(edge.basis==='inferred')line.setAttribute('stroke-dasharray','5 5');const text=svgNode('text',{x:(x1+x2)/2,y:(y1+y2)/2-10,'text-anchor':'middle'});text.textContent=edge.type;svg.append(line,text);
  }
  stage.append(svg);for(const entry of bodies){const item=byId.get(entry.item_id),pos=positions.get(item.id),n=button('',()=>navigate('item',item.id),`graph-node${item.id===state.id?' active':''}`);n.style.left=`${pos[0]}%`;n.style.top=`${pos[1]}%`;n.append(kind(item),el('strong','',item.Original.indexing.identifier||'无标识陈述'),el('small','',item.id));stage.append(n);}
  card.append(stage,el('p','graph-footer','点击节点查看条目。箭头由关系记录所在条目指向目标；无连线表示未记录关系。等价关系的箭头仅表示记录方向。'));
  const table=el('section','relation-table');table.append(el('h3','',`关系记录 / ${currentEdges().length}`));
  for(const edge of currentEdges()){const row=el('div','edge-row');row.append(basis(edge.basis),button(title(byId.get(edge.source)),()=>navigate('item',edge.source)),el('span','arrow','→'),el('span','relation-type',edge.type),button(title(byId.get(edge.target)),()=>navigate('item',edge.target)),el('p','relation-explanation',edge.explanation||''));table.append(row);}
  card.append(table);wrapper.append(card);return wrapper;
}
function render(){
  if(window.MathJax?.typesetClear)window.MathJax.typesetClear([$('#content')]);renderList();
  for(const tab of document.querySelectorAll('[data-view]'))tab.setAttribute('aria-pressed',String(tab.dataset.view===state.view));
  $('#content').replaceChildren(state.view==='item'?itemView():state.view==='reading'?readingView():graphView());typeset();
  if(state.view==='reading')requestAnimationFrame(()=>{$('[data-selected-part]')?.scrollIntoView({block:'nearest'});});
}
function typeset(){
  if(!window.MathJax?.typesetPromise)return;
  mathQueue=mathQueue.then(()=>window.MathJax.startup.promise).then(()=>window.MathJax.typesetPromise([$('#content')])).catch(()=>{$('#math-status').textContent='公式显示原始 LaTeX';});
}
function loadMath(){
  window.MathJax={tex:{inlineMath:[['$','$'],['\\(','\\)']],displayMath:[['$$','$$'],['\\[','\\]']]},svg:{fontCache:'global'},startup:{typeset:false}};
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';script.async=true;
  const fallback=setTimeout(()=>{$('#math-status').textContent='公式未载入时保留原始 LaTeX';},10000);
  script.onload=()=>{clearTimeout(fallback);window.MathJax.startup.promise.then(()=>{$('#math-status').textContent='LaTeX · MathJax';typeset();}).catch(()=>{$('#math-status').textContent='公式显示原始 LaTeX';});};
  script.onerror=()=>{clearTimeout(fallback);$('#math-status').textContent='公式显示原始 LaTeX（排版服务不可用）';};document.head.append(script);
}
async function init(){
  try{
    const response=await fetch('./demo-data.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);data=await response.json();
    if(data.format!=='math-knowledge-base-public-demo-v1'||data.synthetic!==true||data.sources.some(s=>s.synthetic!==true))throw new Error('数据不是公开合成演示格式');
    byId=new Map(data.items.map(i=>[i.id,i]));entries=data.orders.flatMap(o=>o.entries);allEdges=data.items.flatMap(i=>i.Original.relations.map(r=>({source:i.id,...r})));
    state.id=data.items.find(i=>i.Original.content.type==='theorem')?.id||data.items[0].id;
    for(const[n,label]of[[data.stats.items,'数学条目'],[entries.length,'阅读位置'],[allEdges.length,'条目关系']]){const stat=el('div','stat');stat.append(el('strong','',String(n).padStart(2,'0')),el('span','',label));$('#stats').append(stat);}
    for(const type of new Set(data.items.map(i=>i.Original.content.type))){const option=el('option','',`${TYPES[type]||type} / ${type}`);option.value=type;$('#type-filter').append(option);}
    $('#search').addEventListener('input',e=>{state.query=e.target.value;renderList();});$('#type-filter').addEventListener('change',e=>{state.type=e.target.value;renderList();});
    $('#explicit-only').addEventListener('change',e=>{state.explicitOnly=e.target.checked;render();});
    for(const tab of document.querySelectorAll('[data-view]'))tab.addEventListener('click',()=>navigate(tab.dataset.view));
    window.addEventListener('hashchange',readHash);readHash();loadMath();
  }catch(error){$('#content').replaceChildren();$('#load-error').hidden=false;$('#load-error').textContent=`示例数据未能载入（${error.message}）。请通过 HTTP/HTTPS 打开网页，或稍后重试。`;$('#math-status').textContent='';}
}
init();
