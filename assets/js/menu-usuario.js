/* Ruta H&D V2 · menú único del usuario.
 * Persistencia de tema exclusivamente visual, aislada por ID de cuenta en este navegador.
 * Nunca almacena JWT, contraseñas o registros comerciales.
 */
(()=>{
 'use strict';
 const get=id=>document.getElementById(id);
 const acl=()=>window.RutaHDAccesos;
 const anchor=get('userMenuAnchor'),trigger=get('userMenuTrigger'),popup=get('userMenuPopup');
 const themeSwitch=get('menuDarkMode'),userName=get('menuUserName'),userRole=get('menuUserRole');
 if(!anchor||!trigger||!popup)return;
 let currentUserId=null,open=false;
 const storageKey=id=>'rutahyd2.apariencia.usuario.'+id;
 const setDark=(dark)=>{
  document.documentElement.dataset.theme=dark?'oscuro':'claro';
  document.documentElement.style.colorScheme=dark?'dark':'light';
  if(themeSwitch)themeSwitch.checked=dark;
 };
 const close=()=>{
  open=false;popup.hidden=true;trigger.setAttribute('aria-expanded','false');
 };
 const toggle=()=>{
  if(anchor.hidden)return;
  open=!open;popup.hidden=!open;trigger.setAttribute('aria-expanded',String(open));
  if(open)popup.querySelector('button:not([hidden]),input:not([hidden])')?.focus();
 };
 const sync=()=>{
  const user=acl()?.usuario();currentUserId=user?.id||null;
  anchor.hidden=!user;
  if(!user){close();setDark(false);return;}
  userName.textContent=user.nombre||'Usuario';
  userRole.textContent=acl().isAdmin()?'Administrador':(user.rol||'Perfil de usuario');
  get('menuPermissions').hidden=!acl().isAdmin();
  let dark=false;
  if(currentUserId){
   try{dark=localStorage.getItem(storageKey(currentUserId))==='oscuro';}catch{}
  }
  if(['claro','oscuro'].includes(user.tema_interfaz)){
   dark=user.tema_interfaz==='oscuro';
   if(currentUserId){try{localStorage.setItem(storageKey(currentUserId),user.tema_interfaz);}catch{}}
  }
  setDark(dark);close();
 };
 trigger.addEventListener('click',event=>{event.preventDefault();toggle();});
 document.addEventListener('pointerdown',event=>{
  if(open&&!anchor.contains(event.target))close();
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&open){event.preventDefault();close();trigger.focus();}
 });
 themeSwitch?.addEventListener('change',()=>{
  const dark=themeSwitch.checked;
  setDark(dark);
  if(currentUserId){
   try{localStorage.setItem(storageKey(currentUserId),dark?'oscuro':'claro');}
   catch{window.RutaHDAvisos?.toast?.('warning','Preferencia no guardada','El navegador no permitió guardar el tema.');}
  }
  // El servidor actualizado sincroniza la preferencia entre dispositivos.
  // Sin DDL23 se mantiene exclusivamente por cuenta en este navegador.
  if(['claro','oscuro'].includes(acl()?.usuario()?.tema_interfaz)){
   void window.RutaHDApiCatalogos?.saveTheme(dark?'oscuro':'claro').catch(()=>{
    window.RutaHDAvisos?.toast?.('warning','Tema local','No se pudo sincronizar la preferencia con el servidor.');
   });
  }
 });
 get('menuSignOut')?.addEventListener('click',()=>{close();void window.RutaHDLogin?.logout();});
 get('menuPermissions')?.addEventListener('click',()=>{
  close();window.RutaHDProduccion?.navigate('perfiles');
 });
 get('menuProfile')?.addEventListener('click',async()=>{
  close();
  const d=document.createElement('dialog');d.className='modal catalog-dialog crud-dialog profile-detail-dialog';
  const shell=document.createElement('div');shell.className='crud-shell';
  const header=document.createElement('div');header.className='crud-heading';
  const copy=document.createElement('div');copy.className='crud-heading-copy';
  const kicker=document.createElement('span');kicker.className='crud-kicker';kicker.textContent='RUTA H&D · MI CUENTA';
  const title=document.createElement('h2');title.textContent='Mi perfil';
  const subtitle=document.createElement('p');subtitle.className='crud-intro';
  subtitle.textContent='Datos de tu perfil y preferencias.';
  copy.append(kicker,title,subtitle);
  const closeButton=document.createElement('button');closeButton.className='crud-close';
  closeButton.type='button';closeButton.textContent='×';closeButton.setAttribute('aria-label','Cerrar perfil');
  closeButton.addEventListener('click',()=>d.close());header.append(copy,closeButton);
  const body=document.createElement('dl');body.className='crud-fields user-profile-details';
  const show=(label,value)=>{
   const dt=document.createElement('dt');dt.textContent=label;
   const dd=document.createElement('dd');dd.textContent=value||'—';body.append(dt,dd);
  };
  const session=acl()?.usuario()||{};
  show('Nombre',session.nombre);show('Perfil',session.rol);
  const foot=document.createElement('div');foot.className='crud-footer';
  const done=document.createElement('button');done.className='button primary';done.type='button';done.textContent='Cerrar';
  done.addEventListener('click',()=>d.close());foot.append(done);
  shell.append(header,body,foot);d.append(shell);document.body.append(d);
  d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();
  try{
   const info=await window.RutaHDApiCatalogos?.profile();
   if(d.open&&info&&acl()?.authenticated()&&acl()?.usuario()?.id===currentUserId){
    show('Correo electrónico',info.correo_electronico);
   }
  }catch{
   if(d.open)show('Correo electrónico','No disponible');
  }
 });
 document.addEventListener('rutahd:permisos-actualizados',sync);
 document.addEventListener('rutahd:sesion-iniciada',sync);
 document.addEventListener('rutahd:sesion-finalizada',sync);
 document.addEventListener('DOMContentLoaded',sync);
 window.RutaHDMenuUsuario=Object.freeze({close,sync});
})();