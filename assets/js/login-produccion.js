/* Acceso productivo Ruta H&D V2: sin cuentas demo, sin almacenamiento de JWT en disco.
   No se remiten contraseñas cuando la API devuelve 503 o una respuesta no válida. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const api=()=>window.RutaHDApiCatalogos;
  const acl=()=>window.RutaHDAccesos;
  const dialog=$('loginDialog'), form=$('loginForm'),loginButton=$('authButton');
  const error=$('loginError'),pass=$('loginPassword'),mail=$('loginEmail');
  const submit=$('loginSubmit'),state=$('loginServerStatus'),pill=$('apiStatus');
  const retry=$('loginRetry'),recover=$('loginRecover');
  let online=false,busy=false,checking=false,recovering=false;
  const signed=()=>Boolean(acl()?.authenticated());
  const recoveringNow=()=>Boolean(window.RutaHDRecuperacion?.isActive());
  function report(type,title,description){
    online=type==='ok';
    state.dataset.state=type;state.textContent=description;
    pill.dataset.state=type;pill.textContent=title;
    submit.disabled=!online||busy;
    document.dispatchEvent(new CustomEvent('rutahd:api-estado',{detail:{disponible:online}}));
  }
  async function check(){
    if(checking)return online;
    checking=true;
    report('checking','Conectando…','Verificando la disponibilidad de Laravel.');
    try {
      api().configure(location.origin);
      const health=await api().status();
      if(health.disponible)report('ok','Servidor conectado',
        'Servidor Laravel disponible. Ingresa con tu usuario autorizado.');
      else report('blocked','Servidor no habilitado',
        'El servidor informó HTTP '+health.http+' ('+health.estado+'). El administrador debe habilitar la API para iniciar sesión.');
    } catch {
      report('blocked','Sin conexión al servidor',
        'No se pudo confirmar la conexión HTTPS con Laravel. No se enviarán credenciales.');
    } finally {checking=false;}
    return online;
  }
  function show(){
    if(signed()||recoveringNow())return;
    error.hidden=true;error.textContent='';pass.value='';
    document.body.dataset.loginStart='true';
    document.body.classList.remove('is-authenticated');
    if(!dialog.open)dialog.showModal();
    void check();
    mail.focus();
  }
  function loggedIn(){
    document.body.dataset.loginStart='false';
    document.body.classList.add('is-authenticated');
    if(dialog.open)dialog.close();
    loginButton.textContent='Cerrar sesión';
    loginButton.setAttribute('aria-haspopup','false');
    const name=acl()?.usuario()?.nombre||'';
    const header=document.querySelector('.profile-label b');
    if(header)header.textContent=name;
  }
  async function signout(){
    loginButton.disabled=true;
    try{await api().logout();}
    catch{api().signOut();}
    finally{
      acl()?.clear();
      document.body.classList.remove('is-authenticated');
      loginButton.disabled=false;loginButton.textContent='Iniciar sesión';
      show();
    }
  }
  dialog.addEventListener('cancel',event=>event.preventDefault());
  $('loginClose')?.remove();
  $('loginDemo')?.remove();
  document.querySelector('.login-demo-note')?.remove();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!form.reportValidity())return;
    if(!online){error.textContent='El servidor no está habilitado. No se enviaron tus credenciales.';error.hidden=false;return;}
    busy=true;submit.disabled=true;error.hidden=true;
    const secret=pass.value;
    pass.value='';
    try{
      api().configure(location.origin);
      const user=await api().login(mail.value.trim(),secret);
      acl().setSession(user);
      loggedIn();
    }catch(e){
      api().signOut();
      error.hidden=false;
      error.textContent=e?.status===422||e?.status===401?'Correo o contraseña incorrectos.':
        e?.status===429?'Demasiados intentos de acceso. Inténtalo más tarde.':
        e?.status===503?'Laravel todavía no está preparado para autenticar usuarios.':
        'No fue posible autenticarte. Comprueba el estado del servidor.';
    }finally{busy=false;submit.disabled=!online;}
  });
  retry.addEventListener('click',()=>void check());
  loginButton.addEventListener('click',()=>{
    if(signed())void signout();else show();
  });
  recover.addEventListener('click',()=>{
    recovering=true;
    if(dialog.open)dialog.close();
    document.body.dataset.loginStart='false';
    window.RutaHDRecuperacion?.mostrarSolicitud();
  });
  document.addEventListener('rutahd:recuperacion-finalizada',()=>{
    recovering=false;
    if(!signed())show();
  });
  document.addEventListener('rutahd:permisos-actualizados',()=>{
    if(signed())loggedIn();
    else {
      loginButton.textContent='Iniciar sesión';
      if(!recovering&&!recoveringNow())show();
    }
  });
  document.addEventListener('DOMContentLoaded',()=>{
    api().configure(location.origin);
    if(recoveringNow()){
      recovering=true;
      void check();
    }else show();
  });
  window.RutaHDLogin=Object.freeze({show,check,logout:signout});
})();