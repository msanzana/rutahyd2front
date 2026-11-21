/* Ruta H&D V2: ventana de acceso JWT y conexión real al gateway.
   Sin API disponible no se envían credenciales. El token vive solo en memoria. */
(() => {
  'use strict';
  const api=()=>window.RutaHDApiCatalogos;
  const access=()=>window.RutaHDAccesos;
  const dialog=document.getElementById('loginDialog');
  const open=document.getElementById('authButton');
  const form=document.getElementById('loginForm');
  const close=document.getElementById('loginClose');
  const retry=document.getElementById('loginRetry');
  const recover=document.getElementById('loginRecover');
  const demo=document.getElementById('loginDemo');
  const originalRecovery=/^#recuperar\?token=/.test(window.location.hash);
  const label=document.getElementById('apiStatus');
  const status=document.getElementById('loginServerStatus');
  const error=document.getElementById('loginError');
  const submit=document.getElementById('loginSubmit');
  const email=document.getElementById('loginEmail');
  const password=document.getElementById('loginPassword');
  let ready=false;
  let checking=false;
  let submitting=false;

  function setState(type,summary,description){
    ready=type==='ok';
    label.dataset.state=type;
    label.textContent=summary;
    status.dataset.state=type;
    status.textContent=description;
    submit.disabled=!ready || submitting;
  }
  async function verify(){
    if(checking)return;
    checking=true;
    setState('pending','Comprobando API…','Consultando el estado del servidor Laravel de Ruta H&D2.');
    try{
      api().configure(window.location.origin);
      const data=await api().status();
      if(data.disponible){
        setState('ok','API conectada','API Laravel disponible. Puedes ingresar con tu cuenta autorizada.');
      }else{
        setState('blocked','API no habilitada',
          'La API respondió HTTP '+data.http+' ('+data.estado+'). El inicio de sesión remoto está bloqueado hasta habilitar el servidor y crear el administrador.');
      }
    }catch(_){
      setState('blocked','API sin conexión',
        'No se pudo verificar el backend Laravel. No ingreses credenciales mientras la conexión esté indisponible.');
    }finally{checking=false;}
  }
  function updateButton(){
    const signed=Boolean(access()?.authenticated());
    open.textContent=signed?'Cerrar sesión':'Iniciar sesión';
    open.setAttribute('aria-haspopup',signed?'false':'dialog');
    open.setAttribute('aria-expanded',dialog.open?'true':'false');
  }
  function showLogin(){
    document.body.dataset.loginStart='true';
    error.hidden=true;
    error.textContent='';
    password.value='';
    if(!dialog.open)dialog.showModal();
    updateButton();
    verify();
    email.focus();
  }
  async function logout(){
    open.disabled=true;
    try{
      try{await api().logout();}
      catch(_){api().signOut();}
      access()?.clear();
      password.value='';
      await verify();
      showLogin();
    }finally{
      open.disabled=false;
      updateButton();
    }
  }
  open.addEventListener('click',()=>{
    if(access()?.authenticated())void logout();
    else showLogin();
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    document.body.dataset.loginStart='false';
    if(!access()?.authenticated() && document.body.dataset.modo!=='demostracion'){
      document.body.dataset.modo='demostracion';
    }
    password.value='';
    error.textContent='';
    error.hidden=true;
    updateButton();
  });
  retry.addEventListener('click',()=>void verify());
  demo.addEventListener('click',()=>{
    document.body.dataset.modo='demostracion';
    dialog.close();
    const footer=document.querySelector('.sidebar-footer small');
    if(footer)footer.textContent='Exploración demostrativa: los registros locales no son datos de MariaDB.';
  });
  recover.addEventListener('click',()=>{
    dialog.close();
    window.RutaHDRecuperacion?.mostrarSolicitud();
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(submitting)return;
    error.hidden=true;
    if(!form.reportValidity())return;
    if(!ready){
      error.textContent='La conexión no está habilitada. Comprueba el estado del servidor.';
      error.hidden=false;
      return;
    }
    submitting=true;
    submit.disabled=true;
    const secret=password.value;
    password.value='';
    try{
      api().configure(window.location.origin);
      const session=await api().login(email.value.trim(),secret);
      access()?.setSession(session);
      document.body.dataset.modo='servidor';
      dialog.close();
      updateButton();
    }catch(ex){
      api().signOut();
      error.textContent=ex?.status===401?'Correo o contraseña incorrectos.':
        'No se pudo autenticar con Laravel. Verifica el servidor e inténtalo nuevamente.';
      error.hidden=false;
    }finally{
      submitting=false;
      submit.disabled=!ready;
    }
  });
  document.addEventListener('rutahd:permisos-actualizados',updateButton);
  document.addEventListener('DOMContentLoaded',()=>{
    updateButton();
    void verify();
    const local=['localhost','127.0.0.1'].includes(window.location.hostname);
    const forced=new URLSearchParams(window.location.search).has('acceso');
    // En producción el primer elemento visible es la pantalla de acceso.
    // En tests locales puede probarse de manera explícita con ?acceso=1.
    if(!originalRecovery && (!local || forced) && !access()?.authenticated()){
      showLogin();
    }
  });
  window.RutaHDLogin=Object.freeze({show:showLogin,check:verify});
})();
