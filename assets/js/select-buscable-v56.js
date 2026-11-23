/* Ruta H&D V56 · Selector universal con búsqueda incremental.
 * Mejora progresiva: el SELECT nativo sigue siendo la fuente de verdad.
 * Soporta formularios dinámicos, optgroup, select[multiple], required,
 * fieldset disabled, teclado, MutationObserver y diálogos <dialog>.
 */
(()=>{
  'use strict';
  const registry=new WeakMap();
  const enhanced=new Set();
  const nativeValue=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  const nativeIndex=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'selectedIndex');
  const LIMIT=120;
  let active=null,serial=0,queued=false;
  const pending=new Set();
  const normalize=value=>String(value??'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  const element=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const getLabel=select=>{
    const aria=select.getAttribute('aria-label');
    const own=select.closest('label');
    const label=select.labels?.[0];
    return (aria||own?.querySelector('span')?.textContent||
      label?.textContent||select.name||'Seleccionar opción').trim().slice(0,100);
  };
  const disabled=select=>select.disabled||
    Boolean(select.closest('fieldset:disabled'))||
    Boolean(select.closest('[inert]'));
  const chosen=select=>{
    const names=[...select.selectedOptions].filter(o=>o.value!=='').map(o=>o.textContent.trim());
    if(select.multiple)return names.length?names.slice(0,2).join(', ')+
      (names.length>2?' +'+(names.length-2):''):'';
    return select.selectedOptions[0]?.value===''?'':names[0]||'';
  };
  const placeholder=select=>{
    const zero=[...select.options].find(o=>o.value==='');
    return zero?.textContent.trim()||'Escribe para buscar o seleccionar…';
  };
  function scheduleSync(select){
    if(!registry.has(select))return;
    pending.add(select);
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{
      queued=false;
      for(const node of pending){
        const state=registry.get(node);
        if(state)sync(state);
      }
      pending.clear();
    });
  }
  function sync(state){
    const {select,input,box}=state;
    if(!select.isConnected){
      if(active===state)close();
      enhanced.delete(select);
      return;
    }
    const isDisabled=disabled(select);
    input.disabled=isDisabled;
    input.required=false; // La validación sigue en el select original.
    input.setAttribute('aria-required',select.required?'true':'false');
    input.setAttribute('aria-multiselectable',select.multiple?'true':'false');
    box.classList.toggle('is-disabled',isDisabled);
    if(active!==state)input.value=chosen(select);
    input.placeholder=placeholder(select);
    input.setAttribute('aria-label',getLabel(select)+' · buscar escribiendo');
    if(active===state){
      if(isDisabled)close();
      else {draw(state);position(state);}
    }
  }
  function position(state){
    if(active!==state||!state.panel)return;
    const rect=state.input.getBoundingClientRect(),pad=9;
    const viewW=document.documentElement.clientWidth,viewH=window.innerHeight;
    const left=Math.max(pad,Math.min(rect.left,viewW-pad-200));
    const width=Math.max(190,Math.min(rect.width,viewW-left-pad));
    const roomBelow=viewH-rect.bottom-pad,roomAbove=rect.top-pad;
    const above=roomBelow<175&&roomAbove>roomBelow;
    const height=Math.min(280,Math.max(110,(above?roomAbove:roomBelow)-6));
    Object.assign(state.panel.style,{
      left:left+'px',width:width+'px',maxHeight:height+'px',
      top:above?'auto':Math.max(pad,rect.bottom+4)+'px',
      bottom:above?Math.max(pad,viewH-rect.top+4)+'px':'auto'
    });
  }
  function draw(state){
    if(active!==state||!state.panel)return;
    const {select,panel,input}=state;
    const query=normalize(input.value);
    const matches=[];
    for(const option of select.options){
      if(option.hidden)continue;
      const text=option.textContent.trim();
      const group=option.parentElement?.tagName==='OPTGROUP'?
        option.parentElement.label:'';
      if(query&&!normalize(text+' '+group).includes(query))continue;
      matches.push({option,text,group,blocked:option.disabled||
        Boolean(option.closest('optgroup[disabled]'))});
    }
    state.options=matches.slice(0,LIMIT);
    state.focusIndex=Math.min(state.focusIndex,state.options.length-1);
    panel.replaceChildren();
    panel.setAttribute('aria-multiselectable',select.multiple?'true':'false');
    state.options.forEach(({option,text,group,blocked},index)=>{
      const line=element('div','hd-choice-option');
      line.id=state.id+'-opt-'+index;
      line.setAttribute('role','option');
      line.setAttribute('aria-selected',option.selected?'true':'false');
      line.setAttribute('aria-disabled',blocked?'true':'false');
      line.dataset.index=String(index);
      if(state.focusIndex===index)line.classList.add('is-active');
      if(option.selected)line.classList.add('is-selected');
      line.append(element('span','hd-choice-label',text||'—'));
      if(group)line.append(element('small','hd-choice-group',group));
      if(option.selected)line.append(element('span','hd-choice-tick','✓'));
      panel.append(line);
    });
    if(!state.options.length){
      panel.append(element('p','hd-choice-empty','No se encontraron opciones.'));
    }else if(matches.length>LIMIT){
      panel.append(element('p','hd-choice-limit',
        'Se muestran '+LIMIT+' de '+matches.length+' coincidencias. Escribe para precisar.'));
    }
    input.setAttribute('aria-activedescendant',
      state.options[state.focusIndex]?state.id+'-opt-'+state.focusIndex:'');
  }
  function close({restore=true}={}){
    if(!active)return;
    const state=active;active=null;
    state.input.setAttribute('aria-expanded','false');
    state.input.removeAttribute('aria-activedescendant');
    state.box.classList.remove('is-open');
    if(restore&&state.select.isConnected)state.input.value=chosen(state.select);
    if(state.panel){
      try{
        if(state.panel.matches(':popover-open'))state.panel.hidePopover();
      }catch(_ignored){}
      state.panel.remove();state.panel=null;
    }
    state.options=[];
  }
  function pick(state,index){
    if(active!==state)return;
    const match=state.options[index];
    if(!match||match.blocked)return;
    const option=match.option,select=state.select;
    if(select.multiple){
      option.selected=!option.selected;
    }else{
      select.selectedIndex=option.index;
    }
    select.dispatchEvent(new Event('input',{bubbles:true}));
    select.dispatchEvent(new Event('change',{bubbles:true}));
    state.input.removeAttribute('aria-invalid');
    if(select.multiple){
      state.input.value='';
      state.focusIndex=index;
      draw(state);
    }else{
      close();state.input.focus();
    }
  }
  function open(state){
    if(disabled(state.select))return;
    if(active===state){position(state);return;}
    close();
    active=state;state.focusIndex=-1;
    state.options=[];
    const panel=element('div','hd-choice-popover');
    panel.id=state.id+'-list';
    panel.setAttribute('role','listbox');
    panel.setAttribute('popover','manual');
    const parent=state.select.closest('dialog[open]')||document.body;
    parent.append(panel);
    state.panel=panel;
    try{panel.showPopover?.();}catch(_ignored){}
    state.input.setAttribute('aria-expanded','true');
    state.box.classList.add('is-open');
    position(state);draw(state);
    panel.addEventListener('pointerdown',event=>{
      const item=event.target.closest('[data-index]');
      if(!item)return;
      event.preventDefault();
      pick(state,Number(item.dataset.index));
    });
  }
  function move(state,delta){
    if(active!==state)open(state);
    if(active!==state)return;
    const count=state.options.length;
    if(!count)return;
    for(let n=0;n<count;n++){
      const next=((state.focusIndex+delta+n*delta)%count+count)%count;
      if(!state.options[next].blocked){
        state.focusIndex=next;
        draw(state);
        state.panel.querySelector('[data-index="'+next+'"]')?.
          scrollIntoView({block:'nearest'});
        return;
      }
    }
  }
  function enhance(select){
    if(!(select instanceof HTMLSelectElement)||registry.has(select)||
      select.hasAttribute('data-hd-choice-native')||select.closest('[data-hd-choice-native]'))return;
    if(!select.parentNode||!select.isConnected)return;
    const box=element('span','hd-choice');
    box.dataset.hdChoice='v56';
    select.parentNode.insertBefore(box,select);
    box.append(select);
    select.classList.add('hd-choice-native');
    const input=element('input','hd-choice-search');
    input.type='search';input.autocomplete='off';input.spellcheck=false;
    input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-haspopup','listbox');
    input.setAttribute('aria-expanded','false');
    input.tabIndex=select.tabIndex>=0?select.tabIndex:0;
    const state={select,box,input,panel:null,id:'hd-choice-'+(++serial),
      options:[],focusIndex:-1};
    input.setAttribute('aria-controls',state.id+'-list');
    const arrow=element('span','hd-choice-chevron','⌄');
    arrow.setAttribute('aria-hidden','true');
    box.append(input,arrow);
    registry.set(select,state);enhanced.add(select);
    select.tabIndex=-1;
    select.addEventListener('change',()=>scheduleSync(select));
    select.addEventListener('input',()=>scheduleSync(select));
    select.addEventListener('invalid',event=>{
      event.preventDefault();
      input.setAttribute('aria-invalid','true');
      input.focus();
    });
    input.addEventListener('focus',()=>{if(!disabled(select))input.select();});
    input.addEventListener('click',()=>{
      if(active!==state)input.value='';
      open(state);
    });
    input.addEventListener('input',()=>{
      if(active!==state)open(state);
      state.focusIndex=-1;draw(state);position(state);
    });
    input.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();move(state,event.key==='ArrowDown'?1:-1);
      }else if(event.key==='Enter'){
        if(active!==state)open(state);
        event.preventDefault();
        const i=state.focusIndex>=0?state.focusIndex:
          state.options.findIndex(x=>!x.blocked);
        pick(state,i);
      }else if(event.key==='Escape'){
        if(active===state){event.preventDefault();event.stopPropagation();close();}
      }else if(event.key==='Tab'){close();}
      else if(event.key==='Home'&&active===state&&state.options.length){
        event.preventDefault();state.focusIndex=0;draw(state);
      }else if(event.key==='End'&&active===state&&state.options.length){
        event.preventDefault();state.focusIndex=state.options.length-1;draw(state);
      }
    });
    // Propagación fiel de modificaciones programáticas sin cambiar los contratos.
    for(const [prop,desc] of [['value',nativeValue],['selectedIndex',nativeIndex]]){
      try{
        if(Object.prototype.hasOwnProperty.call(select,prop))continue;
        Object.defineProperty(select,prop,{
          configurable:true,enumerable:true,
          get(){return desc.get.call(this);},
          set(value){desc.set.call(this,value);scheduleSync(this);}
        });
      }catch(_ignored){}
    }
    sync(state);
  }
  function scan(root){
    if(root instanceof HTMLSelectElement)enhance(root);
    if(root?.querySelectorAll)root.querySelectorAll('select').forEach(enhance);
  }
  function mutations(records){
    const changed=new Set();
    for(const m of records){
      if(m.type==='childList'){
        m.addedNodes.forEach(scan);
        const owner=m.target.closest?.('select');
        if(owner)changed.add(owner);
      }else if(m.type==='attributes'){
        const node=m.target;
        const owner=node.closest?.('select');
        if(owner)changed.add(owner);
        if(node instanceof HTMLFieldSetElement||
          node instanceof HTMLDialogElement){
          node.querySelectorAll('select').forEach(s=>changed.add(s));
        }
        if(node instanceof HTMLSelectElement)changed.add(node);
      }
    }
    for(const select of changed)scheduleSync(select);
    if(active&&!active.select.isConnected)close({restore:false});
  }
  function initialize(){
    scan(document.body);
    new MutationObserver(mutations).observe(document.body,{
      subtree:true,childList:true,attributes:true,
      attributeFilter:['disabled','required','selected','multiple','label','value','inert','hidden']
    });
    document.addEventListener('pointerdown',event=>{
      if(active&&!active.box.contains(event.target)&&
        !active.panel?.contains(event.target))close();
    },true);
    document.addEventListener('reset',event=>{
      event.target.querySelectorAll?.('select').forEach(s=>setTimeout(()=>scheduleSync(s),0));
    },true);
    document.addEventListener('scroll',()=>{if(active)position(active);},true);
    window.addEventListener('resize',()=>{if(active)position(active);},{passive:true});
    window.RutaHDSelectBuscable=Object.freeze({
      enhance,refresh:root=>scan(root||document.body),
      sync:select=>scheduleSync(select),close
    });
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
