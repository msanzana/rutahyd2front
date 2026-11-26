/* V107: selector de sucursal integrado, con activación diferida hasta aislamiento completo. */
(()=>{
'use strict';
const api=()=>window.RutaHDApiCatalogos,acl=()=>window.RutaHDAccesos;
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const btn=(text,fn,cls='button ghost')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
// Mantener false en V107: ni un error de contexto ni una configuración SQL prematura
// deben bloquear el login o aparentar aislamiento de las operaciones aún no adaptadas.
const SELECTOR_ACTIVO=false;
let current=null,activeDialog=null,sequence=0;
function updateMenu(){
 const item=document.getElementById('menuBranchContext'),label=document.getElementById('menuBranchLabel');
 if(item){item.hidden=!acl()?.authenticated();item.textContent=SELECTOR_ACTIVO?'Cambiar de sucursal':'Sucursales autorizadas';}
 if(label){label.hidden=!acl()?.authenticated();label.textContent=current?current.codigo+' · '+current.nombre:'Contexto de sucursal en preparación';}
}
function chooser(initial,{required=false,onLogout=()=>{}}={}){
 if(activeDialog?.open)return Promise.resolve(false);
 const d=el('dialog',null,'hd-doc-modal hd-v67 hd-v70-dialog'),shell=el('div',null,'hd-doc-form'),head=el('div',null,'hd-doc-modal-head'),body=el('div',null,'hd-doc-modal-scroll'),foot=el('div',null,'hd-doc-modal-footer');
 d.setAttribute('aria-label',required?'Seleccionar sucursal':'Sucursales autorizadas');d.style.maxWidth='640px';
 const title=el('h2',required?'Seleccionar sucursal':'Sucursales autorizadas'),close=btn('×',()=>d.close(),'hd-doc-close');close.title='Cerrar';close.setAttribute('aria-label','Cerrar');close.hidden=required;
 head.append(title,close);shell.append(head,body,foot);d.append(shell);document.body.append(d);activeDialog=d;
 let state=initial,chosen=null,busy=false,completed=false;
 return new Promise(resolve=>{
  function render(){
   body.replaceChildren();foot.replaceChildren();chosen=null;
   const enabled=SELECTOR_ACTIVO&&state.aislamiento_completo&&state.contexto_obligatorio;
   body.append(el('p',enabled?'Selecciona la sucursal en la que deseas trabajar.':'Configuración en preparación. Estas son las sucursales a las que tienes acceso; todavía no se aplica un filtro operativo por sucursal.','hd-doc-status'));
   if(enabled&&!required)body.append(el('p','Al confirmar se volverá al inicio y se descartarán las vistas cargadas.','hd-doc-status'));
   const group=el('div',null,'hd-v70-docs');group.setAttribute('role','group');group.setAttribute('aria-label','Sucursales disponibles');
   for(const s of state.sucursales||[]){
    const label=el('label',null,'hd-doc-field');label.style.cssText='display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #cfc3dc;border-radius:10px;margin-bottom:8px';
    if(enabled){const radio=el('input');radio.type='radio';radio.name='sucursal-v107';radio.value=String(s.id);radio.style.width='auto';radio.onchange=()=>{chosen=s;save.disabled=false;};label.append(radio);}
    const text=el('div');text.append(el('strong',s.codigo+' · '+s.nombre),el('p',s.direccion||'Sin dirección'));label.append(text);group.append(label);
   }
   if(!(state.sucursales||[]).length)group.append(el('p','No tienes sucursales activas asignadas. Contacta a Administración.'));
   body.append(group);
   const status=el('p',null,'hd-doc-status');status.setAttribute('role','status');body.append(status);
   const save=btn(required?'Ingresar':'Cambiar sucursal',async()=>{
    if(!chosen||busy||!enabled)return;busy=true;save.disabled=true;close.disabled=true;cancel.disabled=true;
    try{const result=await api().selectBranchContext(chosen.id,state.version_contexto);current=result.sucursal_actual;completed=true;updateMenu();d.close();if(!required){document.getElementById('workspaceContent')?.replaceChildren();window.RutaHDProduccion?.navigate('inicio');}}
    catch(e){status.textContent=e?.userMessage||'No fue posible seleccionar la sucursal. Actualice la lista.';status.setAttribute('role','alert');}
    finally{busy=false;save.disabled=false;close.disabled=false;cancel.disabled=false;}
   },'button primary');save.disabled=true;
   const cancel=btn(required?'Cerrar sesión':'Cerrar',()=>{if(!busy){if(required)onLogout();d.close();}});
   foot.append(cancel);if(enabled)foot.append(save);
  }
  d.addEventListener('cancel',e=>{if(required||busy)e.preventDefault();});
  d.addEventListener('close',()=>{activeDialog=null;d.remove();resolve(completed||!required);},{once:true});
  render();d.showModal();
 });
}
async function beforeLogin(){
 if(!SELECTOR_ACTIVO)return true;
 const state=await api().branchContext();
 if(!state.aislamiento_completo||!state.contexto_obligatorio)throw Error('Contexto operativo no habilitado.');
 return chooser(state,{required:true});
}
async function openMenu(){
 if(!acl()?.authenticated())return;
 window.RutaHDMenuUsuario?.close();
 if(activeDialog?.open||document.querySelector('dialog[open]'))return;
 const ticket=++sequence;const item=document.getElementById('menuBranchContext');if(item)item.disabled=true;
 try{const state=await api().branchContext();if(ticket!==sequence||!acl()?.authenticated())return;await chooser(state);}
 catch(e){if(ticket===sequence&&acl()?.authenticated())window.RutaHDAvisos?.toast?.('warning','Sucursales','No se pudo consultar las sucursales autorizadas.');}
 finally{if(item)item.disabled=false;}
}
function mount(){
 const anchor=document.getElementById('menuProfile');if(!anchor||document.getElementById('menuBranchContext'))return;
 const label=el('small',null,'hd-doc-status');label.id='menuBranchLabel';label.hidden=true;label.style.cssText='padding:8px 12px;display:block';
 const item=btn('Sucursales autorizadas',()=>void openMenu());item.id='menuBranchContext';item.className=anchor.className;item.setAttribute('role','menuitem');item.hidden=true;anchor.before(label,item);updateMenu();
}
document.addEventListener('rutahd:permisos-actualizados',()=>{if(!acl()?.authenticated()){sequence++;current=null;if(activeDialog?.open)activeDialog.close();}updateMenu();});
document.addEventListener('rutahd:sesion-finalizada',()=>{sequence++;current=null;if(activeDialog?.open)activeDialog.close();updateMenu();});
mount();document.addEventListener('DOMContentLoaded',mount);
window.RutaHDContextoSucursalV107=Object.freeze({beforeLogin,openMenu,current:()=>current});
})();
