/* CRUD de Usuarios reales - acceso exclusivo del administrador JWT */
(() => {
'use strict';
const api=()=>window.RutaHDApiCatalogos,access=()=>window.RutaHDAccesos;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const btn=(text,handler,cls='button ghost')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',handler);return b;};
let root,users=[],roles=[],filter='',busy=false;
const status=(m)=>{const p=root?.querySelector('#usersStatus');if(p)p.textContent=m;};
const err=e=>({401:'Sesión expirada',403:'Acceso denegado',409:'Registro duplicado',422:'Datos inválidos',503:'SMTP o API no disponible'})[e?.status]||'Error de conexión con el servidor';
async function guard(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(err(e));}finally{busy=false;}}
async function load(){
 const res=await api().usersAll();
 if(!Array.isArray(res.usuarios)||!Array.isArray(res.roles))throw Error('Formato inválido');
 users=res.usuarios;roles=res.roles;draw();status('Datos reales actualizados desde Laravel/MySQL.');
}
function mount(parent){
 parent.replaceChildren();
 root=el('section',undefined,'surface-panel perfiles-panel');root.id='usersCrud';
 root.append(el('h2','Gestión de usuarios'),el('p','Crear, editar, activar y desactivar usuarios operativos. Las cuentas administradoras están protegidas.','catalog-footnote'));
 const p=el('p','','catalog-footnote');p.id='usersStatus';root.append(p);parent.append(root);
 if(!access()?.authenticated()||!access()?.isAdmin()){status('Solo un administrador autenticado puede acceder.');return;}
 const bar=el('div',undefined,'workspace-actions');
 const q=el('input');q.type='search';q.placeholder='Buscar usuario o correo';q.setAttribute('aria-label','Buscar usuario');
 q.addEventListener('input',()=>{filter=q.value.toLocaleLowerCase('es-CL');draw();});
 bar.append(q,btn('Crear usuario',()=>form(null),'button primary'),btn('Actualizar',()=>guard(load)));
 root.append(bar);
 const box=el('div',undefined,'catalog-table-scroll');box.id='usersList';root.append(box);
 guard(load);
}
function draw(){
 const box=root?.querySelector('#usersList');if(!box)return;box.replaceChildren();
 const table=el('table',undefined,'catalog-table'),head=el('tr');
 ['Nombre','Correo','Perfil','Estado','Acciones'].forEach(x=>head.append(el('th',x)));
 const thead=el('thead');thead.append(head);table.append(thead);
 const body=el('tbody');
 users.filter(u=>(u.nombre+' '+u.correo_electronico+' '+u.perfil).toLocaleLowerCase('es-CL').includes(filter)).forEach(u=>{
  const tr=el('tr');[u.nombre,u.correo_electronico,u.perfil,u.activo?'Activo':'Inactivo'].forEach(v=>tr.append(el('td',String(v))));
  const actions=el('td',undefined,'catalog-actions');
  if(u.rol_codigo==='administrador'){actions.append(el('span','Administrador protegido'));}
  else {
   actions.append(btn('Editar',()=>form(u),'catalog-small-button'),
    btn('Enviar recuperación',()=>guard(async()=>{await api().requestRecovery(u.correo_electronico);status('Si la cuenta está activa, recibirá un enlace por correo.');}),'catalog-small-button'));
   if(u.activo)actions.append(btn('Desactivar',()=>deactivate(u),'catalog-small-button danger-text'));
  }
  tr.append(actions);body.append(tr);
 });
 table.append(body);box.append(table);
}
function field(form,label,type,value=''){
 const wrap=el('label',undefined,'field'),text=el('span',label),input=el('input');
 input.type=type;input.value=value;input.required=true;
 wrap.append(text,input);form.append(wrap);return input;
}
function form(user){
 if(!roles.length)return status('No se cargaron los perfiles.');
 const dlg=el('dialog',undefined,'modal catalog-dialog'),f=el('form',undefined,'form-grid');
 f.noValidate=true;f.append(el('h2',user?'Editar usuario':'Invitar usuario'));
 const name=field(f,'Nombre','text',user?.nombre||'');name.maxLength=160;
 const email=field(f,'Correo','email',user?.correo_electronico||'');email.maxLength=190;
 const wrap=el('label',undefined,'field'),role=el('select');
 roles.forEach(r=>{const opt=el('option',r.nombre);opt.value=r.id;role.append(opt);});
 role.value=String(user?.rol_id||roles[0].id);wrap.append(el('span','Perfil operativo'),role);f.append(wrap);
 let active;
 if(user){
  const w=el('label',undefined,'field');active=el('select');
  [['1','Activo'],['0','Inactivo']].forEach(([value,text])=>{const o=el('option',text);o.value=value;active.append(o);});
  active.value=user.activo?'1':'0';w.append(el('span','Estado'),active);f.append(w);
 }else f.append(el('p','Recibirá un correo para definir su contraseña.','catalog-footnote'));
 const message=el('p','', 'form-error');f.append(message);
 const footer=el('div',undefined,'modal-footer');
 const save=el('button',user?'Guardar':'Enviar invitación','button primary');save.type='submit';
 footer.append(btn('Cancelar',()=>dlg.close()),save);f.append(footer);
 f.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  if(name.value.trim().length<3||!email.validity.valid){message.textContent='Verifica nombre y correo.';return;}
  busy=true;save.disabled=true;
  try{
   const dto={nombre:name.value.trim(),correo_electronico:email.value.trim(),rol_id:Number(role.value)};
   if(user)await api().updateUser(user.id,{...dto,activo:active.value==='1'});
   else await api().createUser(dto);
   dlg.close();await load();status(user?'Usuario actualizado.':'Invitación enviada por correo.');
  }catch(e){message.textContent=err(e);}
  finally{busy=false;save.disabled=false;}
 });
 dlg.append(f);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();
}
function deactivate(u){
 const dlg=el('dialog',undefined,'modal catalog-dialog');
 dlg.append(el('h2','Desactivar usuario'),el('p','Se revocarán las sesiones de '+u.nombre+'. El historial quedará preservado.'));
 const footer=el('div',undefined,'modal-footer');
 footer.append(btn('Cancelar',()=>dlg.close()),btn('Confirmar desactivación',()=>guard(async()=>{
  await api().deleteUser(u.id);dlg.close();await load();status('Usuario desactivado.');
 }),'button danger'));
 dlg.append(footer);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();
}
window.RutaHDUsuarios=Object.freeze({mount});
})();