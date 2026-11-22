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
 const create=btn('Crear usuario',()=>form(null),'button primary');
 create.classList.add('hd-list-create-action');
 bar.append(q,btn('Actualizar',()=>guard(load)),create);
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
  const tr=el('tr');
  [u.nombre,u.correo_electronico,u.perfil].forEach(v=>tr.append(el('td',String(v))));
  const stateCell=el('td',undefined,'catalog-status-cell');
  const protectedAccount=u.rol_codigo==='administrador';
  const toggle=window.RutaHDListUI?.statusSwitch(u.nombre,Boolean(u.activo),async active=>{
    await api().updateUser(u.id,{
      nombre:u.nombre,correo_electronico:u.correo_electronico,
      rol_id:Number(u.rol_id),ciudad_id:u.ciudad_id??null,activo:active
    });
    await load();
  },{disabled:protectedAccount});
  stateCell.append(toggle||el('span',u.activo?'Activo':'Inactivo'));
  tr.append(stateCell);
  const actions=el('td',undefined,'catalog-actions');
  if(protectedAccount)actions.append(el('span','Administrador protegido'));
  else actions.append(
    btn('Editar',()=>form(u),'catalog-small-button'),
    btn('Enviar recuperación',()=>guard(async()=>{
      await api().requestRecovery(u.correo_electronico);
      status('Si la cuenta está activa, recibirá un enlace por correo.');
    }),'catalog-small-button'));
  tr.append(actions);body.append(tr);
 });
 table.append(body);box.append(table);
}
function field(form,label,type,value=''){
 const wrap=el('label',undefined,'field'),text=el('span',label),input=el('input');
 input.type=type;input.value=value;input.required=true;
 wrap.append(text,input);form.append(wrap);return input;
}
async function form(user){
 if(!roles.length)return status('No se cargaron los perfiles.');
 const dlg=el('dialog',undefined,'modal catalog-dialog crud-dialog users-editor-dialog');
 const f=el('form',undefined,'crud-shell');f.noValidate=true;
 const heading=el('div',undefined,'crud-heading');
 const copy=el('div',undefined,'crud-heading-copy');
 copy.append(el('span','RUTA H&D · ADMINISTRACIÓN','crud-kicker'),
   el('h2',user?'Editar usuario':'Invitar usuario'),
   el('p',user?'Actualiza los datos y permisos de la cuenta.':'La persona recibirá un enlace seguro para definir su contraseña.','crud-intro'));
 const close=btn('×',()=>dlg.close(),'crud-close');close.setAttribute('aria-label','Cerrar ventana');
 heading.append(copy,close);f.append(heading);
 const grid=el('div',undefined,'crud-fields crud-form-grid');f.append(grid);
 const name=field(grid,'Nombre completo','text',user?.nombre||'');name.maxLength=160;
 const email=field(grid,'Correo electrónico','email',user?.correo_electronico||'');email.maxLength=190;
 const wrap=el('label',undefined,'field crud-field'),role=el('select');
 roles.forEach(r=>{const opt=el('option',r.nombre);opt.value=r.id;role.append(opt);});
 role.value=String(user?.rol_id||roles[0].id);wrap.append(el('span','Perfil operativo'),role);grid.append(wrap);
 const geoHost=el('div',undefined,'users-location-holder');
 const geo=await window.RutaHDUbicaciones?.mountSelector(geoHost,user?.ciudad_id??null);
 grid.append(geoHost);
 let active;
 if(user){
  const w=el('label',undefined,'field crud-field');active=el('select');
  [['1','Activo'],['0','Inactivo']].forEach(([value,text])=>{const o=el('option',text);o.value=value;active.append(o);});
  active.value=user.activo?'1':'0';w.append(el('span','Estado'),active);grid.append(w);
 }else grid.append(el('p','El sistema enviará un correo para configurar la contraseña.','crud-help'));
 const message=el('p','', 'form-error crud-message');message.setAttribute('role','alert');message.hidden=true;f.append(message);
 const footer=el('div',undefined,'modal-footer crud-footer');
 const save=el('button',user?'Guardar cambios':'Enviar invitación','button primary');save.type='submit';
 footer.append(btn('Cancelar',()=>dlg.close()),save);f.append(footer);
 f.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  if(name.value.trim().length<3||!email.validity.valid){
   message.textContent='Verifica nombre y correo electrónico.';message.hidden=false;return;
  }
  busy=true;save.disabled=true;message.hidden=true;
  try{
   const dto={nombre:name.value.trim(),correo_electronico:email.value.trim(),rol_id:Number(role.value)};
   if(geo)dto.ciudad_id=geo.value();
   if(user)await api().updateUser(user.id,{...dto,activo:active.value==='1'});
   else await api().createUser(dto);
   dlg.close();await load();status(user?'Usuario actualizado.':'Invitación enviada por correo.');
  }catch(e){message.textContent=err(e);message.hidden=false;}
  finally{busy=false;save.disabled=false;}
 });
 dlg.append(f);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove(),{once:true});
 dlg.showModal();name.focus();
}
function deactivate(u){
 const dlg=el('dialog',undefined,'modal catalog-dialog crud-dialog crud-confirm-dialog');
 const wrap=el('div',undefined,'crud-shell');
 const heading=el('div',undefined,'crud-heading');
 const copy=el('div',undefined,'crud-heading-copy');
 copy.append(el('span','RUTA H&D · SEGURIDAD','crud-kicker'),el('h2','Desactivar usuario'),
  el('p','Esta acción deshabilitará el acceso sin borrar su historial.','crud-intro'));
 const close=btn('×',()=>dlg.close(),'crud-close');close.setAttribute('aria-label','Cerrar ventana');
 heading.append(copy,close);
 const body=el('div',undefined,'crud-fields');
 body.append(el('p','Se revocarán las sesiones de '+u.nombre+'. Su información histórica se conservará.','crud-confirm-text'));
 const footer=el('div',undefined,'modal-footer crud-footer');
 footer.append(btn('Cancelar',()=>dlg.close()),btn('Confirmar desactivación',()=>guard(async()=>{
  await api().deleteUser(u.id);dlg.close();await load();status('Usuario desactivado.');
 }),'button danger'));
 wrap.append(heading,body,footer);dlg.append(wrap);document.body.append(dlg);
 dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();
}
window.RutaHDUsuarios=Object.freeze({mount});
})();