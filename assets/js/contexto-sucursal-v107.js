/* V107: selector de sucursal integrado, con activación diferida hasta aislamiento completo. */
(()=>{
'use strict';
const api=()=>window.RutaHDApiCatalogos,acl=()=>window.RutaHDAccesos;
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const btn=(text,fn,cls='button ghost')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
// Confirmación exclusiva de sucursal única, sin simular aislamiento operativo.
// Solo el servidor puede habilitar la confirmación de sucursal única.
const selectorDisponible=s=>s?.seleccion_habilitada===true&&s?.modo_sucursal_unica===true;
let current=null,activeDialog=null,sequence=0;
function updateMenu(){
 const item=document.getElementById('menuBranchContext'),label=document.getElementById('menuBranchLabel'),header=document.getElementById('hdBranchCurrent');
 if(header){header.hidden=!(acl()?.authenticated()&&current);header.querySelector('strong').textContent=current?.nombre||'';header.title=current?current.codigo+' · '+current.nombre:'';}
 if(item){item.hidden=!acl()?.authenticated();item.textContent=current?'Sucursal actual':'Sucursales autorizadas';}
 if(label){label.hidden=!acl()?.authenticated();label.textContent=current?current.codigo+' · '+current.nombre:'Contexto de sucursal en preparación';}
}
function chooser(initial,{required=false,onLogout=()=>{}}={}){
 if(activeDialog?.open)return Promise.resolve(false);
 const d=el('dialog',null,'hd-branch-dialog'),shell=el('div',null,'hd-branch-shell'),head=el('div',null,'hd-branch-head'),body=el('div',null,'hd-branch-body'),foot=el('div',null,'hd-branch-footer');
 d.setAttribute('aria-label',required?'Seleccionar sucursal':'Sucursales autorizadas');
 const title=el('h2',required?'Seleccionar sucursal':'Sucursales autorizadas'),close=btn('×',()=>d.close(),'hd-branch-close');close.title='Cerrar';close.setAttribute('aria-label','Cerrar');close.hidden=required;
 const heading=el('div',null,'hd-branch-heading');heading.append(el('span','RUTA H&D · ACCESO','hd-branch-eyebrow'),title);head.append(heading,close);shell.append(head,body,foot);d.append(shell);document.body.append(d);activeDialog=d;
 let state=initial,chosen=null,busy=false,completed=false;
 return new Promise(resolve=>{
  function render(){
   body.replaceChildren();foot.replaceChildren();chosen=null;
   const enabled=required&&selectorDisponible(state);
   body.append(el('p',enabled?'Selecciona la sucursal para ingresar al sistema.':'Configuración en preparación. Estas son las sucursales a las que tienes acceso; todavía no se aplica un filtro operativo por sucursal.','hd-branch-description'));

   const group=el('div',null,'hd-branch-options');group.setAttribute('role',enabled?'radiogroup':'group');group.setAttribute('aria-label','Sucursales disponibles');
   for(const s of state.sucursales||[]){
    const label=el(enabled?'label':'div',null,'hd-branch-card');
    if(enabled){const radio=el('input',null,'hd-branch-radio');radio.type='radio';radio.name='sucursal-v107';radio.value=String(s.id);radio.setAttribute('aria-label',s.nombre+' · '+s.codigo);radio.onchange=()=>{if(!busy){chosen=s;save.disabled=false;}};label.append(radio);}
    const symbol=el('span',null,'hd-branch-symbol');symbol.setAttribute('aria-hidden','true');
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
    const path=document.createElementNS(ns,'path');path.setAttribute('d','M3 9l2-5h14l2 5M4 13v7h16v-7M3 9v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9H3M9 20v-5h6v5');svg.append(path);symbol.append(svg);label.append(symbol);
    const info=el('div',null,'hd-branch-info');info.append(el('strong',s.nombre,'hd-branch-name'),el('span',s.codigo+(s.ciudad?' · '+s.ciudad:''),'hd-branch-code'),el('span',s.direccion?'Dirección: '+s.direccion:'Sin dirección','hd-branch-address'));label.append(info);
    const mark=el('span',enabled?'✓':'Activa',enabled?'hd-branch-check':'hd-branch-active');mark.setAttribute('aria-hidden','true');label.append(mark);group.append(label);
   }
   if(!(state.sucursales||[]).length)group.append(el('p','No tienes sucursales activas asignadas. Contacta a Administración.'));
   body.append(group);
   const status=el('p',null,'hd-branch-description hd-branch-status');status.setAttribute('role','status');body.append(status);
   const save=btn(required?'Ingresar':'Cambiar sucursal',async()=>{
    if(!chosen||busy||!enabled)return;busy=true;save.disabled=true;close.disabled=true;cancel.disabled=true;group.querySelectorAll('input').forEach(i=>i.disabled=true);
    try{const result=await api().selectBranchContext(chosen.id,state.version_contexto);current=result.sucursal_actual;completed=true;updateMenu();d.close();if(!required){document.getElementById('workspaceContent')?.replaceChildren();window.RutaHDProduccion?.navigate('inicio');}}
    catch(e){status.textContent=e?.userMessage||'No fue posible seleccionar la sucursal. Actualice la lista.';status.setAttribute('role','alert');}
    finally{busy=false;save.disabled=false;close.disabled=false;cancel.disabled=false;group.querySelectorAll('input').forEach(i=>i.disabled=false);}
   },'hd-branch-enter');save.disabled=true;
   const cancel=btn(required?'Cerrar sesión':'Cerrar',()=>{if(!busy){if(required)onLogout();d.close();}},'hd-branch-cancel');
   foot.append(cancel);if(enabled)foot.append(save);
  }
  d.addEventListener('cancel',e=>{if(required||busy)e.preventDefault();});
  d.addEventListener('close',()=>{activeDialog=null;d.remove();resolve(completed||!required);},{once:true});
  render();d.showModal();
 });
}
async function beforeLogin(){
 current=null;
 // Finaliza la carga de autenticación antes de abrir otro diálogo en top-layer.
 window.RutaHDCarga?.reset();
 let state;
 try{state=await api().branchContext();}finally{window.RutaHDCarga?.reset();}
 if(!selectorDisponible(state))return true;
 return chooser(state,{required:true});
}
async function openMenu(){
 if(!acl()?.authenticated())return;
 window.RutaHDMenuUsuario?.close();
 if(activeDialog?.open||document.querySelector('dialog[open]'))return;
 const ticket=++sequence;const item=document.getElementById('menuBranchContext');if(item)item.disabled=true;
 try{const state=await api().branchContext();if(ticket!==sequence||!acl()?.authenticated())return;current=state.sucursal_actual||null;updateMenu();await chooser(state);}
 catch(e){if(ticket===sequence&&acl()?.authenticated())window.RutaHDAvisos?.toast?.('warning','Sucursales','No se pudo consultar las sucursales autorizadas.');}
 finally{if(item)item.disabled=false;}
}
function mount(){
 const anchor=document.getElementById('menuProfile');if(!anchor||document.getElementById('menuBranchContext'))return;
 const top=document.getElementById('userMenuAnchor');if(top&&!document.getElementById('hdBranchCurrent')){const badge=el('div',null,'hd-branch-current');badge.id='hdBranchCurrent';badge.hidden=true;badge.setAttribute('aria-label','Sucursal actual');badge.append(el('span','Sucursal','hd-branch-current-label'),el('strong',''));top.before(badge);}
 const label=el('small',null,'hd-branch-description');label.id='menuBranchLabel';label.hidden=true;label.style.cssText='padding:8px 12px';
 const item=btn('Sucursales autorizadas',()=>void openMenu());item.id='menuBranchContext';item.className=anchor.className;item.setAttribute('role','menuitem');item.hidden=true;anchor.before(label,item);updateMenu();
}
document.addEventListener('rutahd:permisos-actualizados',()=>{if(!acl()?.authenticated()){sequence++;current=null;if(activeDialog?.open)activeDialog.close();}updateMenu();});
document.addEventListener('rutahd:sesion-finalizada',()=>{sequence++;current=null;if(activeDialog?.open)activeDialog.close();updateMenu();});
mount();document.addEventListener('DOMContentLoaded',mount);
window.RutaHDContextoSucursalV107=Object.freeze({beforeLogin,openMenu,current:()=>current});
})();
