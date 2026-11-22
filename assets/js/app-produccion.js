/* Ruta H&D V2 — APLICACIÓN EXCLUSIVA DE PRODUCCIÓN.
   No se usan registros del navegador ni datos de prueba.
   Los permisos y los datos provienen exclusivamente de Laravel con JWT Bearer. */
(() => {
  'use strict';
  const $=(selector,scope=document)=>scope.querySelector(selector);
  const $$=(selector,scope=document)=>[...scope.querySelectorAll(selector)];
  const api=()=>window.RutaHDApiCatalogos;
  const acl=()=>window.RutaHDAccesos;
  const SERVICES=Object.freeze({
    administracion:'Administración',compras:'Compras',ventas:'Ventas',
    proveedores:'Proveedores',clientes:'Clientes',productos:'Productos',
    bodega:'Bodega',cuentas_corrientes:'Cuentas corrientes',
    usuarios:'Usuarios',perfiles:'Perfiles y permisos',inicio:'Inicio'
  });
  const CATALOGS=new Set(['rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','gramajes','tipos_envasado','condiciones_tributarias']);
  const NAMES={rubros:'Rubros',departamentos:'Departamentos',familias:'Familias',
    lineas:'Líneas',marcas:'Marcas',modelos:'Modelos',tipos_unidad:'Tipos de unidad',
    gramajes:'Gramajes',tipos_envasado:'Tipos de envasado',
    condiciones_tributarias:'Condiciones tributarias'};
  let current='inicio',online=false;
  const logged=()=>Boolean(acl()?.authenticated());
  const recoveringNow=()=>Boolean(window.RutaHDRecuperacion?.isActive());

  function node(tag,text,cls){
    const element=document.createElement(tag);
    if(cls)element.className=cls;
    if(text!==undefined)element.textContent=String(text);
    return element;
  }
  function message(parent,title,text){
    const section=node('section',undefined,'surface-panel production-empty');
    section.append(node('h2',title),node('p',text));
    parent.replaceChildren(section);
  }
  function menuAccess(){
    const user=acl()?.usuario();
    $('#navUsuarios').hidden=!logged()||!acl().isAdmin();
    $('#navPerfiles').hidden=!logged()||!acl().isAdmin();
    $('#toggleAdminSubnav').hidden=!logged();
    $$('#productSubnav [data-catalog-key]').forEach(btn=>{
      btn.hidden=!logged()||!acl().canViewCatalog(btn.dataset.catalogKey);
    });
    $$('#adminSubnav [data-admin-catalog]').forEach(btn=>{
      btn.hidden=!logged()||!acl().canViewCatalog(btn.dataset.adminCatalog);
    });
    $('#toggleProductSubnav').hidden=!logged();
    const text=$('.profile-label small');
    if(text)text.textContent=user ? (acl().isAdmin()?'Administrador':user.rol) : 'Sin sesión';
    const full=$('.profile-label b');
    if(full)full.textContent=user?.nombre||'Ruta H&D';
    const avatar=$('.profile .avatar');
    if(avatar)avatar.textContent=user?.nombre?.slice(0,2).toUpperCase()||'HD';
  }
  function collapse(){
    $('#productSubnav').hidden=true;
    $('#adminSubnav').hidden=true;
    $('#toggleProductSubnav').setAttribute('aria-expanded','false');
    $('#toggleAdminSubnav').setAttribute('aria-expanded','false');
  }
  function expand(which){
    const prod=which==='productos';
    $('#productSubnav').hidden=!prod;
    $('#adminSubnav').hidden=prod;
    $('#toggleProductSubnav').setAttribute('aria-expanded',prod?'true':'false');
    $('#toggleAdminSubnav').setAttribute('aria-expanded',prod?'false':'true');
  }
  function allowed(section){
    if(!logged() || !online)return false;
    if(section==='usuarios'||section==='perfiles')return acl().isAdmin();
    if(section.startsWith('catalogos.')){
      const key=section.split('.')[1];
      return CATALOGS.has(key)&&acl().canViewCatalog(key);
    }
    return Object.prototype.hasOwnProperty.call(SERVICES,section);
  }
  function titleFor(section){return section.startsWith('catalogos.')?
    NAMES[section.split('.')[1]]||'Clasificación':SERVICES[section]||'Inicio';}
  function navigate(section,from=null){
    if(!allowed(section)){
      if(!logged())window.RutaHDLogin?.show();
      return;
    }
    current=section;
    const isHome=section==='inicio';
    $('#homeView').hidden=!isHome;
    $('#workspaceView').hidden=isHome;
    $('#breadcrumbCurrent').textContent=titleFor(section);
    $$('.nav-link').forEach(button=>{
      const active=button.dataset.nav===section || (section.startsWith('catalogos.')&&
        button.dataset.nav===(from==='administracion'?'administracion':'productos')) ||
        ((section==='usuarios'||section==='perfiles')&&button.dataset.nav==='administracion');
      button.classList.toggle('active',active);
      if(active)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    $$('.nav-sublink').forEach(button=>{
      const key=button.dataset.adminCatalog?
        'catalogos.'+button.dataset.adminCatalog:button.dataset.nav;
      button.classList.toggle('active',key===section);
    });
    if(section.startsWith('catalogos.'))expand(from==='administracion'?'administracion':'productos');
    else if(['administracion','usuarios','perfiles'].includes(section))expand('administracion');
    else if(section==='productos')expand('productos');
    else collapse();
    if(!isHome)renderWorkspace(section);
    const safe='#'+section;
    if(location.hash!==safe)history.replaceState(null,'',safe);
    document.title='Ruta H&D V2 · '+titleFor(section);
    $('#appShell').classList.remove('sidebar-open');
  }
  function renderWorkspace(section){
    const content=$('#workspaceContent');
    content.replaceChildren();
    $('#workspaceEyebrow').textContent='RUTA H&D / SISTEMA PRODUCTIVO';
    $('#workspaceTitle').textContent=titleFor(section);
    $('#workspaceDescription').textContent='Información del servidor Laravel y MariaDB. Acceso controlado por perfil.';
    $('#newButton').hidden=true;$('#exportButton').hidden=true;
    if(section==='usuarios'){
      $('#workspaceDescription').textContent='Cuentas, roles, permisos y bajas lógicas de usuarios.';
      window.RutaHDUsuarios?.mount(content);
    }else if(section==='perfiles'){
      window.RutaHDPerfiles?.mount(content);
    }else if(section==='productos'){
      window.RutaHDProductosRemotos?.mount(content);
    }else if(section==='administracion'){
      $('#workspaceDescription').textContent='Administración de clasificaciones, accesos y productos reales.';
      window.RutaHDRemoto?.mount(content);
    }else if(section.startsWith('catalogos.')){
      window.RutaHDRemoto?.mount(content,section.split('.')[1]);
    }else if(['compras','ventas','proveedores','clientes','bodega','cuentas_corrientes'].includes(section)){
      window.RutaHDOficial?.mount(content,section);
    }else message(content,'Módulo sin implementar','Esta opción no tiene un contrato de API publicado.');
  }
  async function ready(){
    try{
      api().configure(location.origin);
      const state=await api().status();
      online=Boolean(state.disponible);
    }catch{online=false;}
    return online;
  }
  function loggedIn(){
    menuAccess();
    const requested=location.hash.slice(1)||'inicio';
    navigate(allowed(requested)?requested:'inicio');
    $('.environment-notice').hidden=true;
  }
  function loggedOut(){
    menuAccess();
    collapse();
    $('#homeView').hidden=false;
    $('#workspaceView').hidden=true;
    $('#workspaceContent').replaceChildren();
    $('#breadcrumbCurrent').textContent='Acceso';
    if(!recoveringNow())window.RutaHDLogin?.show();
  }
  document.addEventListener('rutahd:permisos-actualizados',()=>{
    if(logged())loggedIn();
    else loggedOut();
  });
  document.addEventListener('rutahd:api-estado',event=>{
    // Disponibilidad del servidor y validez del JWT son cosas diferentes.
    // Un sondeo "Conectando..." o una caída temporal de red NO debe cerrar sesión.
    // Solo un 401 confirmado para el JWT activo o el logout revocan la sesión.
    online=Boolean(event.detail?.disponible);
  });
  document.addEventListener('click',event=>{
    const exp=event.target.closest('#toggleProductSubnav,#toggleAdminSubnav');
    if(exp){
      event.preventDefault();
      if(!logged())return;
      const product=exp.id==='toggleProductSubnav';
      const id=product?'#productSubnav':'#adminSubnav';
      if(!$(id).hidden)collapse();
      else expand(product?'productos':'administracion');
      return;
    }
    const catalog=event.target.closest('[data-admin-catalog]');
    if(catalog){
      event.preventDefault();navigate('catalogos.'+catalog.dataset.adminCatalog,'administracion');return;
    }
    const link=event.target.closest('[data-nav]');
    if(link){
      event.preventDefault();
      const key=link.dataset.nav;
      const from=link.closest('#adminNavGroup')?'administracion':null;
      navigate(key,from);return;
    }
    if(event.target.closest('#menuToggle')){
      $('#appShell').classList.toggle('sidebar-open');return;
    }
    if(event.target.closest('[data-close-sidebar]')){
      $('#appShell').classList.remove('sidebar-open');return;
    }
    if(event.target.closest('#notificationButton,[data-action="about"]')){
      const content=$('#infoDescription');
      if(content)content.textContent='Esta instalación usa exclusivamente Laravel y MariaDB mediante HTTPS y JWT. El servidor autoriza cada operación.';
      $('#infoDialog').showModal();return;
    }
  });
  window.addEventListener('hashchange',()=>{
    const key=location.hash.slice(1)||'inicio';
    if(allowed(key))navigate(key);
    else if(!logged()&&!recoveringNow())window.RutaHDLogin?.show();
  });
  document.addEventListener('DOMContentLoaded',async()=>{
    menuAccess();
    collapse();
    $('.environment-notice').hidden=true;
    const search=$('#globalSearch');
    if(search)search.placeholder='Buscar en el módulo activo…';
    $('#homeView').hidden=true;
    $('#workspaceView').hidden=true;
    await ready();
    if(logged())loggedIn();else loggedOut();
  });
  window.RutaHDProduccion=Object.freeze({navigate,ready,loggedIn,loggedOut});
})();