/* V106: configuración administrativa previa a la activación multisucursal. */
(()=>{
'use strict';
const api=()=>window.RutaHDApiCatalogos,acl=()=>window.RutaHDAccesos,can=p=>acl()?.isAdmin()||acl()?.has(p);
const el=(t,txt,c)=>{const n=document.createElement(t);if(txt!==undefined&&txt!==null)n.textContent=txt;if(c)n.className=c;return n;};
const btn=(t,fn,c='button ghost')=>{const b=el('button',t,c);b.type='button';b.onclick=fn;return b;};
const field=(t,n)=>{const l=el('label',t,'hd-doc-field');n.setAttribute('aria-label',t);l.append(n);return l;};
const input=(t='text')=>{const n=el('input');n.type=t;return n;};
const opt=(v,t)=>{const n=el('option',t);n.value=v;return n;};
const error=(status,e)=>{status.textContent=e?.message||'No se pudo completar la operación.';status.setAttribute('role','alert');};
const num=x=>String(x??'0').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace('.',',');
const uuid=()=>crypto.randomUUID();
function table(heads){
 const wrap=el('div',null,'hd-doc-table-scroll'),t=el('table',null,'hd-doc-table'),h=el('thead'),r=el('tr'),b=el('tbody');
 for(const title of heads){const th=el('th',title);th.scope='col';r.append(th);}h.append(r);t.append(h,b);wrap.append(t);return {wrap,b};
}
function row(body,values,action=null){const r=el('tr');for(const v of values)r.append(el('td',v??'—'));if(action){const c=el('td');c.append(action);r.append(c);}body.append(r);}
function empty(body,n,text){const r=el('tr'),d=el('td',text);d.colSpan=n;r.append(d);body.append(r);}
function modal(title){
 const d=el('dialog',null,'hd-doc-modal hd-v67 hd-v70-dialog'),shell=el('div',null,'hd-doc-form'),head=el('div',null,'hd-doc-modal-head'),content=el('div',null,'hd-doc-modal-scroll'),foot=el('div',null,'hd-doc-modal-footer'),close=btn('×',()=>d.close(),'hd-doc-close');
 close.setAttribute('aria-label','Cerrar');close.title='Cerrar';close.style.cssText='display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;min-height:36px;flex:0 0 36px;border-radius:11px;font-size:24px;line-height:1;padding:0;margin-left:auto';head.append(el('h2',title),close);shell.append(head,content,foot);d.append(shell);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return {d,content,foot,close};
}
function paged(host,heads,fetcher,render,{newAction=null}={}){
 const section=el('section',null,'hd-documents hd-v67 surface-panel'),form=el('form',null,'hd-doc-filter hd-search-form'),toolbar=el('div',null,'hd-search-toolbar'),q=input('search'),search=el('button','Buscar','button primary'),status=el('p',null,'hd-doc-status'),top=el('nav'),bottom=el('nav'),t=table(heads);
 q.placeholder='Búsqueda general';search.type='submit';toolbar.append(field('Buscar',q),search);
 if(newAction){const b=btn('+ Nueva sucursal',newAction,'button primary hd-v70-new');b.dataset.action='nuevo-documento';b.style.marginInlineStart='auto';toolbar.append(b);}form.append(toolbar);
 section.append(form,status,top,t.wrap,bottom);host.replaceChildren(section);
 let page=1,seq=0,term='';
 async function load(n=page){
  const ticket=++seq;page=n;status.textContent='Cargando…';
  try{const result=await fetcher(page,term);if(ticket!==seq||!section.isConnected)return;t.b.replaceChildren();
   for(const item of result.data||[])render(t.b,item,load,result);
   if(!(result.data||[]).length)empty(t.b,heads.length,'Sin registros para esta búsqueda.');
   status.textContent='';const options={page:result.current_page||page,pages:result.last_page||1,total:result.total||0,autoTop:false,onPage:p=>{void load(p);section.scrollIntoView({block:'start'});}};
   window.RutaHDListUI.renderPager(top,options);window.RutaHDListUI.renderPager(bottom,options);
  }catch(e){if(ticket===seq)error(status,e);}
 }
 form.onsubmit=e=>{e.preventDefault();term=q.value.trim();void load(1);};
 void load();return load;
}
function busyDialog(m,flag){m.close.disabled=flag;for(const b of m.foot.querySelectorAll('button'))b.disabled=flag;m.d.dataset.busy=flag?'1':'0';}
function mount(root){
 if(!acl()?.isAdmin()){root.replaceChildren(el('p','Acceso exclusivo de Administración.'));return;}
 const panel=el('section',null,'hd-documents'),info=el('p','Configure las sucursales, sus bodegas y los accesos. El contexto operativo obligatorio aún no está activado.','hd-doc-status'),host=el('div');panel.append(info,host);root.replaceChildren(panel);
 let refresh=()=>{};
 refresh=paged(host,['ID','Código','Sucursal','Ciudad','Bodegas','Usuarios asignados','Estado','Acciones'],(p,q)=>api().branches(p,q),(body,s,reload)=>{
  const actions=el('div',null,'list-actions');
  actions.append(window.RutaHDListUI.action('Editar '+s.nombre,()=>editor(s,reload),{kind:'editar'}),window.RutaHDListUI.action('Bodegas y accesos de '+s.nombre,()=>assignments(s,reload),{kind:'ver'}));
  const tr=el('tr');for(const x of [s.id,s.codigo,s.nombre,s.ciudad||'Sin ubicación',s.bodegas_count,s.usuarios_count])tr.append(el('td',x));
  const state=el('td');state.append(window.RutaHDListUI.statusSwitch(s.nombre,!!Number(s.activo),async wanted=>{await api().branchStatus(s.id,wanted);void reload();}));tr.append(state);
  const action=el('td');action.append(actions);tr.append(action);body.append(tr);
 },{newAction:()=>editor(null,refresh)});
}
function editor(s,reload){
 const m=modal(s?'Editar sucursal':'Nueva sucursal'),code=input(),record=input(),name=input(),loc=el('div'),status=el('p',null,'hd-doc-status');
 record.disabled=true;record.value=s?String(s.id):'Automático';code.value=s?.codigo||'';code.maxLength=30;code.disabled=!!s;name.value=s?.nombre||'';name.maxLength=130;
 let changed=false,selector=null,loading=false;
 const section=el('section',null,'hd-v70-docs');section.append(el('h3','Datos generales'),field('ID',record),field('Código de sucursal',code),field('Nombre',name));
 const geo=el('section',null,'supplier-location-section');geo.append(el('h3','Ubicación geográfica'),el('p',s?.ciudad||'Sin ubicación asignada'));
 const change=btn(s?'Cambiar ubicación':'Asignar ubicación',async()=>{
   if(loading||selector)return;loading=true;change.disabled=true;save.disabled=true;
   try{selector=await window.RutaHDUbicaciones.mountSelector(loc,s?.ciudad_id||null);changed=true;clear.disabled=false;}catch(e){error(status,e);change.disabled=false;}finally{loading=false;save.disabled=false;}
 });
 const clear=btn('Dejar sin ubicación',()=>{loc.replaceChildren();selector=null;changed=true;change.disabled=false;clear.disabled=true;geoState.textContent='Sin ubicación';});clear.disabled=!s?.ciudad_id;
 const geoState=el('p');geo.append(change,clear,geoState,loc);m.content.append(section,geo,status);
 const save=btn('Guardar',async()=>{
  if(!name.value.trim()||(!s&&!/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(code.value.trim().toUpperCase()))){error(status,{message:'Ingrese nombre y un código válido.'});return;}
  if(loading)return;
  let city=changed?(selector?.value()??null):(s?.ciudad_id??null);
  if(selector&&!city){error(status,{message:'Seleccione una ciudad o utilice Dejar sin ubicación.'});return;}
  const payload={nombre:name.value.trim(),ciudad_id:city};if(!s)payload.codigo=code.value.trim().toUpperCase();
  busyDialog(m,true);try{if(s)await api().updateBranch(s.id,payload);else await api().createBranch(payload);m.d.close();void reload();}catch(e){error(status,e);}finally{busyDialog(m,false);}
 },'button primary');
 m.d.addEventListener('cancel',e=>{if(m.d.dataset.busy==='1')e.preventDefault();});
 m.foot.append(btn('Cerrar',()=>m.d.close()),save);
}
function assignments(s,reload){
 const m=modal('Configuración · '+s.nombre),tabs=el('div',null,'hd-search-toolbar'),host=el('div'),notice=el('p',null,'hd-doc-status');m.content.append(el('h3','Asignaciones de sucursal'),tabs,notice,host);
 m.foot.append(btn('Cerrar',()=>m.d.close()));m.d.addEventListener('cancel',e=>{if(m.d.dataset.busy==='1')e.preventDefault();});
 const warehouses=()=>paged(host,['Código','Bodega','Sucursal','Estado','Acciones'],(p,q)=>api().branchWarehouses(s.id,p,q),(body,b,refresh)=>{
   const own=Number(b.sucursal_id)===Number(s.id),eligible=!b.sucursal_id&&Number(b.activo)&&Number(s.activo);
   const action=eligible?window.RutaHDListUI.action('Asignar '+b.nombre,()=>assign(b,refresh),{kind:'editar'}):el('span',own?'Asignada':'—');
   row(body,[b.codigo,b.nombre,b.sucursal||'Sin asignar',Number(b.activo)?'Activa':'Inactiva'],action);
 });
 function assign(b,refresh){
   const c=modal('Asignar bodega'),status=el('p',null,'hd-doc-status');
   c.content.append(el('p','Asignar '+b.nombre+' a '+s.nombre+'. Esta asociación inicial no mueve existencias ni atribuye documentos históricos. La reasignación posterior queda bloqueada.'),status);
   c.d.addEventListener('cancel',e=>{if(c.d.dataset.busy==='1')e.preventDefault();});
   c.foot.append(btn('Volver',()=>c.d.close()),btn('Confirmar',async()=>{busyDialog(c,true);try{await api().assignBranchWarehouse(s.id,b.id);c.d.close();void refresh();void reload();}catch(e){error(status,e);}finally{busyDialog(c,false);}},'button primary'));
 }
 const users=()=>paged(host,['Usuario','Perfil','Estado','Acceso'],(p,q)=>api().branchUsers(s.id,p,q),(body,u,refresh)=>{
   const tr=el('tr');for(const x of [u.nombre,u.perfil,Number(u.activo)?'Activo':'Inactivo'])tr.append(el('td',x));const td=el('td');
   if(u.rol==='administrador')td.append(el('span','Global por perfil'));else td.append(window.RutaHDListUI.statusSwitch(u.nombre,!!Number(u.asignado),async wanted=>{await api().branchAccess(s.id,u.id,wanted);void refresh();void reload();},{disabled:!Number(u.asignado)&&(!Number(u.activo)||!Number(s.activo))}));
   tr.append(td);body.append(tr);
 });
 tabs.append(btn('Bodegas',warehouses),btn('Accesos de usuarios',users));warehouses();
}
window.RutaHDSucursalesV106=Object.freeze({mount});
})();
