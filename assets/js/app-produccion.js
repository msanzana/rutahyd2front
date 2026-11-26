/* Ruta H&D V2 — APLICACIÓN EXCLUSIVA DE PRODUCCIÓN.
   No se usan registros del navegador ni datos de prueba.
   Los permisos y los datos provienen exclusivamente de Laravel con JWT Bearer. */
(() => {
  'use strict';
  const $=(selector,scope=document)=>scope.querySelector(selector);
  const $$=(selector,scope=document)=>[...scope.querySelectorAll(selector)];
  const api=()=>window.RutaHDApiCatalogos;
  const acl=()=>window.RutaHDAccesos;
  const CONSULTAS={"compras_facturas":"Facturas de compra","compras_recepciones":"Recepciones","compras_consolidaciones":"Consolidaciones","compras_libro":"Libro de compras","bodega_stock":"Stock","bodega_kardex":"Kardex"};
  const SERVICES=Object.freeze({ ...CONSULTAS,
    administracion:'Administración',administracion_documentos:'Documentos',administracion_inventario:'Catálogos de inventario',administracion_sucursales:'Sucursales',bodega_ajuste_rapido:'Ajuste rápido',bodega_ajustes_generales:'Ajustes generales',compras:'Compras',compras_ordenes:'Órdenes de Compra',ventas:'Ventas',
    proveedores:'Proveedores',proveedores_productos:'Proveedores productos',clientes:'Clientes',
    clientes_listado:'Listado de clientes',productos:'Productos',listas_precios:'Listas de precios',
    bodega:'Bodega',cuentas_corrientes:'Cuentas corrientes',
    usuarios:'Usuarios',perfiles:'Perfiles y permisos',inicio:'Inicio'
  });
  const ADMIN_CATALOGS=new Set(['tipos_unidad','tipos_envasado','condiciones_tributarias','tipos_codigos_barras']);
  const LOCATION_CATALOGS=new Set(['paises','regiones','provincias','comunas','ciudades']);
  const CATALOGS=new Set(['rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','tipos_envasado','condiciones_tributarias','tipos_codigos_barras']);
  const NAMES={rubros:'Rubros',departamentos:'Departamentos',familias:'Familias',
    lineas:'Líneas',marcas:'Marcas',modelos:'Modelos',tipos_unidad:'Tipos de unidad',
    tipos_codigos_barras:'Tipos de códigos de barras',tipos_envasado:'Tipos de envasado',
    condiciones_tributarias:'Condiciones tributarias',
    paises:'Países',regiones:'Regiones',provincias:'Provincias',
    comunas:'Comunas',ciudades:'Ciudades'};
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
    const geoToggle=$('#toggleUbicacionesSubnav');
    if(geoToggle)geoToggle.hidden=!logged()||!acl().isAdmin();
    $$('#ubicacionesSubnav [data-nav]').forEach(btn=>btn.hidden=!logged()||!acl().isAdmin());
    if(!logged()||!acl().isAdmin()){
      const inner=$('#ubicacionesSubnav');if(inner)inner.hidden=true;
      if(geoToggle)geoToggle.setAttribute('aria-expanded','false');
    }
    $('#toggleProviderSubnav').hidden=!logged();
    const purchaseToggle=$('#togglePurchaseSubnav');
    if(purchaseToggle)purchaseToggle.hidden=!logged()||!acl().has('compras.gestionar');
    const purchaseList=$('#purchaseSubnav [data-nav="compras_ordenes"]');
    if(purchaseList)purchaseList.hidden=!logged()||!acl().has('compras.gestionar');
    for(const key of Object.keys(CONSULTAS)){
      const b=$('.sidebar [data-nav="'+key+'"]');if(b)b.hidden=!allowed(key);
    }
    for(const key of ['bodega_ajuste_rapido','bodega_ajustes_generales','administracion_inventario','administracion_sucursales']){const b=$('.sidebar [data-nav="'+key+'"]');if(b)b.hidden=!allowed(key);}
    $('#toggleBodegaSubnav').hidden=!logged()||!(acl().has('inventario.gestionar')||allowed('bodega_ajuste_rapido'));
    const clientsToggle=$('#toggleClientSubnav');
    if(clientsToggle)clientsToggle.hidden=!logged();
    const clientsList=$('#clientSubnav [data-nav="clientes_listado"]');
    if(clientsList)clientsList.hidden=!logged();
    const providerProducts=$('#providerSubnav [data-nav="proveedores_productos"]');
    if(providerProducts)providerProducts.hidden=!logged()||!acl().canSeeSubmodule('proveedores_productos');
    const providerList=$('#providerSubnav [data-nav="proveedores"]');
    if(providerList)providerList.hidden=!logged()||!acl().canSeeSubmodule('proveedores_listado');
    const productList=$('#productSubnav [data-nav="productos"]');
    if(productList)productList.hidden=!logged()||!acl().canSeeSubmodule('productos_listado');
    const priceList=$('#productSubnav [data-nav="listas_precios"]');
    if(priceList)priceList.hidden=!logged()||!acl().canSeeSubmodule('productos_listado');
    $$('#productSubnav [data-catalog-key]').forEach(btn=>{
      btn.hidden=!logged()||!acl().canViewCatalog(btn.dataset.catalogKey);
    });
    const documentos=$('#adminSubnav [data-nav="administracion_documentos"]');
    if(documentos)documentos.hidden=!logged()||!(acl().isAdmin()||acl().has('administracion.documentos.ver'));
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
    if(menuFind())menuFind().hidden=!logged();
    if(menuInput()?.value)searchMenu();
  }
  // Índice de navegación oficial tomado del DOM, nunca de rutas inventadas.
  // allowed() aplica permisos JWT y canViewCatalog a cada coincidencia.
  const menuFind=()=>$('#menuFinder'),menuInput=()=>$('#menuQuickSearch'),
    menuResults=()=>$('#menuQuickResults');
  const normalizeMenu=value=>String(value||'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').trim();
  function clearMenuSearch(){
    const field=menuInput(),results=menuResults();
    if(field){field.value='';field.setAttribute('aria-expanded','false');}
    if(results){results.hidden=true;results.replaceChildren();}
  }
  function menuEntries(){
    return $$('.sidebar .nav [data-nav],.sidebar .nav [data-admin-catalog]')
      .filter(element=>!element.hidden)
      .map(element=>{
        const key=element.dataset.adminCatalog
          ?'catalogos.'+element.dataset.adminCatalog:element.dataset.nav;
        const group=element.closest('.nav-group');
        const parent=element.closest('#ubicacionesSubnav')?
          'Administración · Ubicaciones':
          group?.querySelector('.nav-parent .nav-link span')?.textContent?.trim()||'Menú principal';
        return {key,text:element.querySelector('span')?.textContent?.trim()
          ||element.textContent.trim(),parent,
          from:group?.id==='adminNavGroup'?'administracion':
            group?.id==='productsNavGroup'?'productos':
            group?.id==='providersNavGroup'?'proveedores':null,
          sub:element.classList.contains('nav-sublink')};
      }).filter(entry=>entry.text&&allowed(entry.key));
  }
  function searchMenu(){
    const input=menuInput(),results=menuResults();
    if(!input||!results)return;
    results.replaceChildren();
    const q=normalizeMenu(input.value);
    if(!q||!logged()){results.hidden=true;input.setAttribute('aria-expanded','false');return;}
    const terms=q.split(/\s+/).filter(Boolean);
    const matched=menuEntries().filter(entry=>{
      const searchable=normalizeMenu(entry.text+' '+(entry.sub?entry.parent:''));
      return terms.every(term=>searchable.includes(term));
    }).slice(0,12);
    if(!matched.length){
      results.append(node('p','No hay opciones disponibles con ese nombre.','hd-menu-empty'));
    }
    matched.forEach(entry=>{
      const b=node('button',undefined,'hd-menu-result');
      b.type='button';
      b.append(node('span',entry.text,'hd-menu-result-title'));
      b.append(node('small',entry.sub?entry.parent:'Menú principal','hd-menu-result-parent'));
      b.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        clearMenuSearch();
         if(entry.sub)navigate(entry.key,entry.from);
         else navigateMain(entry.key,entry.from);
      });
      results.append(b);
    });
    results.hidden=false;
    input.setAttribute('aria-expanded','true');
  }
  function setupMenuSearch(){
    const input=menuInput();if(!input||input.dataset.ready)return;
    input.dataset.ready='true';
    input.addEventListener('input',searchMenu);
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){clearMenuSearch();input.blur();}
      if(event.key==='Enter'){
        const first=menuResults()?.querySelector('.hd-menu-result');
        if(first){event.preventDefault();first.click();}
      }
      if(event.key==='ArrowDown'){
        const first=menuResults()?.querySelector('.hd-menu-result');
        if(first){event.preventDefault();first.focus();}
      }
    });
    menuResults()?.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();input.focus();clearMenuSearch();}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        const controls=$$('.hd-menu-result',menuResults()),current=controls.indexOf(document.activeElement);
        const next=event.key==='ArrowDown'?Math.min(controls.length-1,current+1):Math.max(0,current-1);
        if(controls[next]){event.preventDefault();controls[next].focus();}
      }
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='/'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&
        !event.target.closest('input,textarea,select,[contenteditable="true"]')&&logged()){
        event.preventDefault();input.focus();
      }
    });
    document.addEventListener('pointerdown',event=>{
      if(!event.target.closest('#menuFinder')&&!menuResults()?.hidden)clearMenuSearch();
    });
  }
  function collapse(){
    $('#productSubnav').hidden=true;
    $('#bodegaSubnav').hidden=true;$('#toggleBodegaSubnav').setAttribute('aria-expanded','false');
    $('#adminSubnav').hidden=true;
    $('#providerSubnav').hidden=true;
    const purchase=$('#purchaseSubnav'),purchaseToggle=$('#togglePurchaseSubnav');
    if(purchase)purchase.hidden=true;
    if(purchaseToggle)purchaseToggle.setAttribute('aria-expanded','false');
    const clients=$('#clientSubnav'),clientsToggle=$('#toggleClientSubnav');
    if(clients)clients.hidden=true;
    if(clientsToggle)clientsToggle.setAttribute('aria-expanded','false');
    const geo=$('#ubicacionesSubnav'),geoToggle=$('#toggleUbicacionesSubnav');
    if(geo)geo.hidden=true;
    if(geoToggle)geoToggle.setAttribute('aria-expanded','false');
    $('#toggleProviderSubnav').setAttribute('aria-expanded','false');
    $('#toggleProductSubnav').setAttribute('aria-expanded','false');
    $('#toggleAdminSubnav').setAttribute('aria-expanded','false');
  }
  function expand(which){
    for(const [key,container,toggle] of [
      ['productos','#productSubnav','#toggleProductSubnav'],
      ['bodega','#bodegaSubnav','#toggleBodegaSubnav'],
      ['administracion','#adminSubnav','#toggleAdminSubnav'],
      ['proveedores','#providerSubnav','#toggleProviderSubnav'],
      ['compras','#purchaseSubnav','#togglePurchaseSubnav'],
      ['clientes','#clientSubnav','#toggleClientSubnav']
    ]){
      const expanded=which===key;
      $(container).hidden=!expanded;
      $(toggle).setAttribute('aria-expanded',String(expanded));
    }
  }
  function allowed(section){
    // Una comprobación transitoria del estado no debe congelar menús de una sesión JWT válida.
    if(!logged())return false;
    if(section==='usuarios'||section==='perfiles')return acl().isAdmin();
    if(section==='administracion_documentos')return acl().isAdmin()||acl().has('administracion.documentos.ver');
    if(section==='administracion_inventario')return acl().isAdmin()||acl().has('inventario.catalogos.ver');
    if(section==='administracion_sucursales')return acl().isAdmin();
    if(['bodega_ajuste_rapido','bodega_ajustes_generales'].includes(section))return acl().isAdmin()||acl().has('inventario.operaciones.ver');
    if(section.startsWith('ubicaciones.'))
      return LOCATION_CATALOGS.has(section.split('.')[1])&&acl().isAdmin();
    if(section==='proveedores_productos')return acl().canSeeSubmodule('proveedores_productos');
    if(section==='compras_ordenes'||section.startsWith('compras_')&&CONSULTAS[section])return acl().has('compras.gestionar');
    if(section.startsWith('bodega_')&&CONSULTAS[section])return acl().has('inventario.gestionar');
    if(section==='proveedores')return acl().canSeeSubmodule('proveedores_listado');
    if(section==='clientes_listado')return acl().isAdmin()||acl().has('clientes.gestionar');
    if(section==='productos'||section==='listas_precios')return acl().canSeeSubmodule('productos_listado');
    if(section.startsWith('catalogos.')){
      const key=section.split('.')[1];
      return CATALOGS.has(key)&&acl().canViewCatalog(key);
    }
    return Object.prototype.hasOwnProperty.call(SERVICES,section);
  }
  // El menú principal abre la PRIMERA subopción permitida y visible del
  // catálogo oficial, sin asumir que todos los perfiles comparten permisos.
  const mainSubmenus=Object.freeze({
    administracion:'#adminSubnav',compras:'#purchaseSubnav',
    proveedores:'#providerSubnav',clientes:'#clientSubnav',
    productos:'#productSubnav',bodega:'#bodegaSubnav'
  });
  function firstMainSubitem(section){
    const container=mainSubmenus[section]&&$(mainSubmenus[section]);
    if(!container)return null;
    for(const entry of $$('.nav-sublink',container)){
      if(entry.hidden||entry.closest('#ubicacionesSubnav'))continue;
      const key=entry.dataset.adminCatalog
        ?'catalogos.'+entry.dataset.adminCatalog:entry.dataset.nav;
      if(key&&allowed(key))return key;
    }
    return null;
  }
  function navigateMain(section,from=null){
    navigate(firstMainSubitem(section)||section,from);
  }
  function titleFor(section){
    if(section.startsWith('ubicaciones.'))return NAMES[section.split('.')[1]]||'Ubicaciones';
    return section.startsWith('catalogos.')?
      NAMES[section.split('.')[1]]||'Clasificación':SERVICES[section]||'Inicio';
  }
  function navigate(section,from=null){
    if(!allowed(section)){
      if(!logged())window.RutaHDLogin?.show();
      return;
    }
    current=section;
    const categoryKey=section.startsWith('catalogos.')?section.split('.')[1]:null;
    const categoryOrigin=section.startsWith('ubicaciones.')?'administracion':
      categoryKey?(ADMIN_CATALOGS.has(categoryKey)?'administracion':'productos'):from;
    const isHome=section==='inicio';
    $('#homeView').hidden=!isHome;
    $('#workspaceView').hidden=isHome;
    $('#breadcrumbCurrent').textContent=titleFor(section);
    $$('.nav-link').forEach(button=>{
      const active=button.dataset.nav===section || (section.startsWith('catalogos.')&&
        button.dataset.nav===categoryOrigin) ||
        (section.startsWith('ubicaciones.')&&button.dataset.nav==='administracion') ||
        ((section==='usuarios'||section==='perfiles'||section==='administracion_documentos'||section==='administracion_inventario'||section==='administracion_sucursales')&&button.dataset.nav==='administracion') ||
        (section==='proveedores_productos'&&button.dataset.nav==='proveedores') ||
        (section.startsWith('compras_')&&button.dataset.nav==='compras') || (section.startsWith('bodega_')&&button.dataset.nav==='bodega') ||
        (section==='clientes_listado'&&button.dataset.nav==='clientes') ||
        (section==='listas_precios'&&button.dataset.nav==='productos');
      button.classList.toggle('active',active);
      if(active)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    $$('.nav-sublink').forEach(button=>{
      const key=button.dataset.adminCatalog?
        'catalogos.'+button.dataset.adminCatalog:button.dataset.nav;
      button.classList.toggle('active',key===section);
    });
    if(section.startsWith('ubicaciones.')){
      expand('administracion');
      $('#ubicacionesSubnav').hidden=false;
      $('#toggleUbicacionesSubnav').setAttribute('aria-expanded','true');
    }else if(section.startsWith('catalogos.'))expand(categoryOrigin);
    else if(['administracion','administracion_documentos','administracion_inventario','administracion_sucursales','usuarios','perfiles'].includes(section))expand('administracion');
    else if(section==='productos'||section==='listas_precios')expand('productos');
    else if(section==='proveedores'||section==='proveedores_productos')expand('proveedores');
    else if(section.startsWith('compras_'))expand('compras');
    else if(section.startsWith('bodega_'))expand('bodega');
    else if(section==='clientes'||section==='clientes_listado')expand('clientes');
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
    $('#workspaceEyebrow').textContent='RUTA H&D / GESTIÓN COMERCIAL';
    $('#workspaceTitle').textContent=titleFor(section);
    $('#workspaceDescription').textContent='Gestiona los registros y operaciones disponibles para tu perfil.';
    $('#newButton').hidden=true;$('#exportButton').hidden=true;
    if(CONSULTAS[section]){
      $('#workspaceDescription').textContent='Consulta de registros comerciales e inventario.';
      window.RutaHDComprasConsultas.mount(content,section.split('_')[1]);
    }else if(section==='administracion_sucursales'){
      $('#workspaceDescription').textContent='Configuración de sucursales, bodegas y accesos autorizados.';
      window.RutaHDSucursalesV106.mount(content);
    }else if(section==='administracion_inventario'){
      $('#workspaceDescription').textContent='Grupos, motivos y códigos oficiales de inventario.';
      window.RutaHDInventarioV104.catalogs(content);
    }else if(section==='bodega_ajustes_generales'){
      window.RutaHDInventarioV104.generalAdjustments(content);
    }else if(section==='bodega_ajuste_rapido'){
      $('#workspaceDescription').textContent='Regularizaciones autorizadas de entregas registradas.';
      window.RutaHDInventarioV104.adjustments(content);
    }else if(section==='administracion_documentos'){
      $('#workspaceDescription').textContent='Catálogo de documentos DTE e internos, permisos, códigos SII y vigencia.';
      window.RutaHDTiposDocumentos?.mount(content);
    }else if(section==='usuarios'){
      $('#workspaceDescription').textContent='Cuentas, roles, permisos y bajas lógicas de usuarios.';
      window.RutaHDUsuarios?.mount(content);
    }else if(section==='perfiles'){
      window.RutaHDPerfiles?.mount(content);
    }else if(section==='productos'){
      window.RutaHDProductosRemotos?.mount(content);
    }else if(section==='listas_precios'){
      window.RutaHDListasPrecios?.mount(content);
    }else if(section==='administracion'){
      $('#workspaceDescription').textContent='Administración de clasificaciones, accesos y productos reales.';
      window.RutaHDRemoto?.mount(content);
    }else if(section.startsWith('catalogos.')){
      window.RutaHDRemoto?.mount(content,section.split('.')[1]);
    }else if(section.startsWith('ubicaciones.')){
      $('#workspaceDescription').textContent='Catálogos oficiales de territorio: país, región, provincia, comuna y ciudad.';
      window.RutaHDUbicaciones?.mount(content,section.split('.')[1]);
    }else if(section==='compras_ordenes'){
      window.RutaHDOrdenesCompra?.mount(content);
    }else if(section==='proveedores_productos'){
      window.RutaHDProveedoresProductos?.mount(content);
    }else if(section==='ventas'){
      window.RutaHDVentasPrecios?.mount(content);
    }else if(['compras','proveedores','clientes','clientes_listado','bodega','cuentas_corrientes'].includes(section)){
      window.RutaHDOficial?.mount(content,section==='clientes_listado'?'clientes':section);
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
    clearMenuSearch();
    const requested=location.hash.slice(1)||'inicio';
    navigate(allowed(requested)?requested:'inicio');
    // La restauración de ruta no debe expandir submenús tras autenticarse.
    collapse();
    $('#appShell').classList.remove('sidebar-open');
    $('.environment-notice').hidden=true;
  }
  function loggedOut(){
    menuAccess();
    clearMenuSearch();
    collapse();
    $('#appShell').classList.remove('sidebar-open');
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
    // Popup de información: el frontend productivo no carga app.js (demo).
    // La acción de cierre debe atenderse aquí, sin alterar JWT ni navegación.
    if(event.target.closest('#infoClose')){
      event.preventDefault();
      const dialog=$('#infoDialog');
      if(dialog?.open)dialog.close();
      return;
    }
    const geoExpand=event.target.closest('#toggleUbicacionesSubnav');
    if(geoExpand){
      event.preventDefault();
      if(!logged()||!acl().isAdmin())return;
      const target=$('#ubicacionesSubnav');
      target.hidden=!target.hidden;
      geoExpand.setAttribute('aria-expanded',String(!target.hidden));
      return;
    }
    const exp=event.target.closest('#toggleProductSubnav,#toggleAdminSubnav,#toggleProviderSubnav,#toggleClientSubnav,#togglePurchaseSubnav,#toggleBodegaSubnav');
    if(exp){
      event.preventDefault();
      if(!logged())return;
      const type=exp.id==='toggleBodegaSubnav'?'bodega':exp.id==='togglePurchaseSubnav'?'compras':
        exp.id==='toggleProductSubnav'?'productos':
        exp.id==='toggleAdminSubnav'?'administracion':
        exp.id==='toggleClientSubnav'?'clientes':'proveedores';
      const id=type==='bodega'?'#bodegaSubnav':type==='compras'?'#purchaseSubnav':
        type==='productos'?'#productSubnav':
        type==='administracion'?'#adminSubnav':
        type==='clientes'?'#clientSubnav':'#providerSubnav';
      if(!$(id).hidden)collapse();
      else expand(type);
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
      const from=link.closest('#adminNavGroup')?'administracion':
        link.closest('#productsNavGroup')?'productos':
        link.closest('#clientsNavGroup')?'clientes':
        link.closest('#purchasesNavGroup')?'compras':null;
      if(link.matches('.sidebar .nav-parent > .nav-link,.module-card'))
        navigateMain(key,from);
      else navigate(key,from);
      return;
    }
    if(event.target.closest('#menuToggle')){
      // En móvil restaurar buscador al reabrir el menú después de navegar.
      // Nunca exhibirlo fuera de una sesión autenticada.
      if(menuFind())menuFind().hidden=!logged();
      $('#appShell').classList.toggle('sidebar-open');return;
    }
    if(event.target.closest('[data-close-sidebar]')){
      $('#appShell').classList.remove('sidebar-open');return;
    }
    if(event.target.closest('#notificationButton,[data-action="about"]')){
      const content=$('#infoDescription');
      if(content)content.textContent='Tus datos y operaciones están protegidos según los permisos de tu perfil.';
      $('#infoDialog').showModal();return;
    }
  });
  window.addEventListener('hashchange',()=>{
    const key=location.hash.slice(1)||'inicio';
    if(allowed(key))navigate(key);
    else if(!logged()&&!recoveringNow())window.RutaHDLogin?.show();
  });
  document.addEventListener('DOMContentLoaded',async()=>{
    setupMenuSearch();
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