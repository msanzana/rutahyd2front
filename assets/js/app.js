/* Ruta H&D2 — interfaz funcional de demostración.
 * Los cambios se almacenan SOLAMENTE en localStorage. No usa credenciales ni escribe en producción. */
(() => {
  'use strict';

  const KEY = 'rutahd2-demo-local-v1';
  const SECTION_NAMES = {
    inicio:'Inicio', administracion:'Administración', compras:'Compras', ventas:'Ventas',
    proveedores:'Proveedores', clientes:'Clientes', productos:'Productos',
    bodega:'Bodega', cuentas_corrientes:'Cuentas corrientes',
    perfiles:'Perfiles y permisos', usuarios:'Usuarios',
    // Rutas históricas internas: no son padres del menú oficial.
    pedidos:'Pedidos', inventario:'Inventario', informes:'Informes'
  };
  const REMOTE_OFFICIAL = new Set(['compras','ventas','proveedores','clientes','bodega','cuentas_corrientes']);
  const DEFAULT_DATA = () => ({ pedidos: [], clientes: [], productos: [], activity: [] });
  const db = loadData();
  const catalogos = window.RutaCatalogos;
  let view = 'inicio';
  let query = '';
  let editing = null;
  let pendingConfirm = null;
  let nextId = Date.now();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  };
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text);
    return el;
  };
  const add = (parent, ...children) => { children.forEach(c => parent.appendChild(c)); return parent; };
  const money = value => new Intl.NumberFormat('es-CL', {style: 'currency', currency: 'CLP', maximumFractionDigits: 0}).format(Number(value) || 0);
  const today = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  };
  const displayDate = value => {
    if (!value) return '—';
    const parts = String(value).split('-');
    return parts.length === 3 ? [parts[2],parts[1],parts[0]].join('/') : String(value);
  };
  const valueString = val => val === undefined || val === null ? '' : String(val);
  const safeText = (str) => valueString(str).toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const definitions = {
    clientes: {
      title:'Clientes', singular:'cliente', description:'Organiza los contactos comerciales de esta demostración.',
      icon:'users',
      fields:[
        {key:'nombre',label:'Nombre o razón social',type:'text',required:true,max:110,full:true},
        {key:'rut',label:'RUT',type:'text',required:true,max:18,placeholder:'12.345.678-9'},
        {key:'telefono',label:'Teléfono',type:'tel',max:32,placeholder:'+56 9 ...'},
        {key:'email',label:'Correo electrónico',type:'email',max:100,full:true},
        {key:'estado',label:'Estado',type:'select',options:['Activo','Inactivo'],required:true}
      ],
      columns:[['nombre','Nombre / Razón social'],['rut','RUT'],['telefono','Teléfono'],['email','Correo'],['estado','Estado']]
    },
    productos: {
      title:'Productos', singular:'producto', description:'Gestiona catálogo, precios y existencias locales.',
      icon:'box',
      fields:[
        {key:'codigo',label:'Código / SKU',type:'text',required:true,max:40},
        {key:'nombre',label:'Nombre del producto',type:'text',required:true,max:120},
        {key:'rubroId',label:'Rubro',type:'catalog',catalog:'rubros',required:true},
        {key:'departamentoId',label:'Departamento',type:'catalog',catalog:'departamentos',required:true},
        {key:'familiaId',label:'Familia',type:'catalog',catalog:'familias',required:true},
        {key:'lineaId',label:'Línea',type:'catalog',catalog:'lineas',required:true},
        {key:'marcaId',label:'Marca',type:'catalog',catalog:'marcas',required:true},
        {key:'modeloId',label:'Modelo',type:'catalog',catalog:'modelos',required:true},
        {key:'tipoUnidadId',label:'Tipo de unidad',type:'catalog',catalog:'tipos_unidad',required:true},
        {key:'gramajeId',label:'Gramos',type:'catalog',catalog:'gramajes',required:true},
        {key:'tipoEnvasadoId',label:'Tipo de envasado',type:'catalog',catalog:'tipos_envasado',required:true},
        {key:'condicionTributariaId',label:'Condición tributaria',type:'catalog',catalog:'condiciones_tributarias',required:true},
        {key:'precio',label:'Precio (CLP)',type:'number',required:true,min:0,step:'1'},
        {key:'stock',label:'Stock actual',type:'number',required:true,min:0,step:'1'},
        {key:'minimo',label:'Stock mínimo',type:'number',required:true,min:0,step:'1'},
        {key:'estado',label:'Estado',type:'select',options:['Activo','Inactivo'],required:true}
      ],
      columns:[['codigo','SKU'],['nombre','Producto'],['lineaId','Línea'],['marcaId','Marca'],['modeloId','Modelo'],['gramajeId','Gramos'],['condicionTributariaId','IVA'],['precio','Precio'],['stock','Stock'],['estado','Estado']]
    },
    pedidos: {
      title:'Pedidos', singular:'pedido', description:'Registra y da seguimiento a pedidos de demostración.',
      icon:'orders',
      fields:[
        {key:'numero',label:'Número de pedido',type:'text',required:true,max:35},
        {key:'cliente',label:'Cliente',type:'client',required:true},
        {key:'fecha',label:'Fecha',type:'date',required:true},
        {key:'total',label:'Monto total (CLP)',type:'number',required:true,min:0,step:'1'},
        {key:'estado',label:'Estado',type:'select',options:['Pendiente','En preparación','Entregado','Anulado'],required:true},
        {key:'observaciones',label:'Observaciones',type:'textarea',max:400,full:true}
      ],
      columns:[['numero','Pedido'],['cliente','Cliente'],['fecha','Fecha'],['total','Total'],['estado','Estado']]
    }
  };

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (parsed && typeof parsed === 'object') {
        return {
          pedidos:Array.isArray(parsed.pedidos) ? parsed.pedidos : [],
          clientes:Array.isArray(parsed.clientes) ? parsed.clientes : [],
          productos:Array.isArray(parsed.productos) ? parsed.productos : [],
          activity:Array.isArray(parsed.activity) ? parsed.activity : []
        };
      }
    } catch (_) {}
    return DEFAULT_DATA();
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (_) {
      toast('warning', 'Almacenamiento no disponible', 'Los cambios de esta sesión podrían perderse.');
      return false;
    }
  }

  function recordActivity(title, description, iconName) {
    db.activity.unshift({id:++nextId, title, description, icon:iconName, timestamp: new Date().toISOString()});
    db.activity.splice(15);
  }

  function toast(type, title, description, duration = 5500) {
    const types = {success:'check',error:'close',warning:'warning',info:'info'};
    const kind = types[type] ? type : 'info';
    const element = node('div','toast '+kind);
    const symbol = node('span','toast-icon');
    symbol.appendChild(icon(types[kind]));
    const content = node('div','toast-content');
    add(content, node('strong','',title), node('span','',description));
    const close = node('button','toast-close');
    close.type = 'button';
    close.setAttribute('aria-label','Cerrar aviso');
    close.appendChild(icon('close'));
    close.addEventListener('click',()=>element.remove());
    add(element,symbol,content,close);
    $('#toastRegion').prepend(element);
    setTimeout(()=>element.remove(),duration);
  }

  function statusClass(val) {
    const v = safeText(val);
    if (['activo','entregado','completado'].includes(v)) return 'success';
    if (['anulado','inactivo','sin stock'].includes(v)) return 'error';
    if (v.includes('bajo') || v.includes('pendiente') || v.includes('preparaci')) return 'warning';
    return 'info';
  }

  function showInfo(title, description) {
    $('#infoTitle').textContent = title;
    $('#infoDescription').textContent = description;
    $('#infoDialog').showModal();
  }

  const catalogKey = section => section?.startsWith('catalogos.') ? section.slice('catalogos.'.length) : null;
  const access = () => window.RutaHDAccesos;
  const allowedCatalogs = () => catalogos?.ORDER?.filter(key=>access()?.canViewCatalog(key)) || [];
  const canNavigate = section => {
    const key=catalogKey(section);
    if(key)return catalogos?.CONFIG[key] && access()?.canViewCatalog(key);
    if(section==='perfiles'||section==='usuarios')return Boolean(access()?.authenticated()&&access()?.isAdmin());
    if(section==='productos' && access()?.authenticated())
      return access().has('productos.gestionar');
    return Boolean(SECTION_NAMES[section]);
  };
  function updateProductMenu() {
    catalogos?.ORDER?.forEach(key=>{
      document.querySelectorAll('[data-catalog-key="'+key+'"],[data-admin-catalog="'+key+'"]').forEach(b=>{
        b.hidden=!access()?.canViewCatalog(key);
      });
    });
    const authorized=allowedCatalogs();
    const showParent=!access()?.authenticated() || access().has('productos.gestionar') || authorized.length>0;
    $('#productsNavGroup').hidden=!showParent;
    const adminVisible=Boolean(!access()?.authenticated()||access()?.isAdmin()||authorized.length>0);
    $('#navPerfiles').hidden=!access()?.authenticated()||!access()?.isAdmin();
    $('#navUsuarios').hidden=!access()?.authenticated()||!access()?.isAdmin();
    $('#toggleAdminSubnav').hidden=!adminVisible;
    if(!adminVisible)setAdminExpanded(false);
    const list=$('#productSubnav [data-nav="productos"]');
    if(list)list.hidden=Boolean(access()?.authenticated()&&!access().has('productos.gestionar'));
    if(!authorized.length && access()?.authenticated() && !access().has('productos.gestionar')) {
      $('#productSubnav').hidden=true;
      $('#toggleProductSubnav').setAttribute('aria-expanded','false');
    }
  }
  function setProductExpanded(expanded) {
    $('#productSubnav').hidden=!expanded;
    $('#toggleProductSubnav').setAttribute('aria-expanded',expanded?'true':'false');
    $('#toggleProductSubnav').setAttribute('aria-label',expanded?'Contraer submódulos de Productos':'Expandir submódulos de Productos');
  }
  function setAdminExpanded(expanded) {
    const expand=Boolean(expanded&&(!access()?.authenticated()||access()?.isAdmin()||allowedCatalogs().length>0));
    $('#adminSubnav').hidden=!expand;
    $('#toggleAdminSubnav').setAttribute('aria-expanded',expand?'true':'false');
    $('#toggleAdminSubnav').setAttribute('aria-label',expand?'Contraer submódulos de Administración':'Expandir submódulos de Administración');
  }
  function navigate(section, fromGroup='auto') {
    if(section==='productos' && !canNavigate(section) && allowedCatalogs().length) section='catalogos.'+allowedCatalogs()[0];
    const current = canNavigate(section) ? section : 'inicio';
    view = current;
    query = '';
    $('#globalSearch').value = '';
    $('#homeView').hidden = current !== 'inicio';
    $('#workspaceView').hidden = current === 'inicio';
    const key=catalogKey(current);
    $('#breadcrumbCurrent').textContent = key ? 'Productos / '+catalogos.CONFIG[key].title : SECTION_NAMES[current];
    updateProductMenu();
    // La clasificación pertenece a una sola rama visible, según desde dónde se abrió.
    // Nunca desplegar Productos y Administración simultáneamente por navegar.
    if(key && fromGroup==='administracion'){
      setProductExpanded(false);
      setAdminExpanded(true);
    } else if(key || current==='productos'){
      setAdminExpanded(false);
      setProductExpanded(true);
    } else if(current==='administracion'||current==='perfiles'||current==='usuarios'){
      setProductExpanded(false);
      setAdminExpanded(true);
    } else {
      setProductExpanded(false);
      setAdminExpanded(false);
    }
    $$('[data-admin-catalog]').forEach(button=>{
      const selected='catalogos.'+button.dataset.adminCatalog===current;
      button.classList.toggle('active',selected);
      if(selected)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    $$('[data-nav].nav-sublink').forEach(button=>{
      const selected=button.dataset.nav===current;
      button.classList.toggle('active',selected);
      if(selected)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    $$('[data-nav].nav-link').forEach(button => {
      const selected = button.dataset.nav === current || (button.dataset.nav==='productos' && Boolean(key)) || (button.dataset.nav==='administracion' && ['perfiles','usuarios'].includes(current));
      button.classList.toggle('active',selected);
      if (selected) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    $('#appShell').classList.remove('sidebar-open');
    if (current === 'inicio') renderHome(); else renderWorkspace();
    if (location.hash.substring(1) !== current) history.replaceState(null,'','#'+current);
    document.title = 'Ruta H&D2 · '+(key ? catalogos.CONFIG[key].title : SECTION_NAMES[current]);
    window.scrollTo({top:0,behavior:'instant'});
  }

  function compute() {
    return {
      pedidos:db.pedidos.length, clientes:db.clientes.length, productos:db.productos.length,
      stockBajo:db.productos.filter(p => p.estado !== 'Inactivo' && Number(p.stock) <= Number(p.minimo)).length,
      total:db.pedidos.reduce((sum,p)=>sum+(Number(p.total)||0),0)
    };
  }

  function renderChart(target) {
    const container = typeof target === 'string' ? $(target) : target;
    container.replaceChildren();
    const days = [];
    for (let i=6;i>=0;i--) {
      const date=new Date(); date.setHours(12,0,0,0); date.setDate(date.getDate()-i);
      const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
      const label=new Intl.DateTimeFormat('es-CL',{weekday:'short'}).format(date).replace('.','');
      days.push({key,label,count:db.pedidos.filter(p=>p.fecha===key).length});
    }
    const max=Math.max(1,...days.map(d=>d.count));
    days.forEach(day=>{
      const column=node('div','chart-column');
      const bar=node('div','chart-bar');
      bar.style.height = Math.max(3,day.count/max*147)+'px';
      bar.title=day.count+' pedidos · '+day.key;
      add(column,bar,node('span','chart-label',day.label));
      container.appendChild(column);
    });
    if (!days.some(d=>d.count>0)) container.appendChild(node('div','chart-empty','Aún no hay pedidos registrados durante este período.'));
  }

  function renderHome() {
    const stats=compute();
    $('#statOrders').textContent=stats.pedidos.toLocaleString('es-CL');
    $('#statClients').textContent=stats.clientes.toLocaleString('es-CL');
    $('#statProducts').textContent=stats.productos.toLocaleString('es-CL');
    $('#statLowStock').textContent=stats.stockBajo.toLocaleString('es-CL');
    renderChart('#homeChart');
    const list=$('#activityList');
    list.replaceChildren();
    if (!db.activity.length) {
      list.appendChild(node('div','empty-activity','Aún no hay actividad registrada. Crea un cliente o producto para comenzar.'));
      return;
    }
    db.activity.slice(0,4).forEach(activity=>{
      const item=node('div','activity-item');
      const symbol=node('span','activity-icon');
      symbol.appendChild(icon(activity.icon || 'info'));
      const body=node('div','activity-description');
      const when=new Date(activity.timestamp);
      add(body,node('strong','',activity.title),node('small','',activity.description+' · '+when.toLocaleString('es-CL')));
      add(item,symbol,body);
      list.appendChild(item);
    });
  }

  function renderWorkspace() {
    // La demo de Clientes se permite solo en entorno local de pruebas o tras elegir
    // expresamente explorar la demostración; nunca se fusiona con MySQL.
    const modoDemo=!access()?.authenticated() && (
      document.body.dataset.modo==='demostracion' ||
      ['localhost','127.0.0.1'].includes(window.location.hostname));
    if(REMOTE_OFFICIAL.has(view) && !(view==='clientes' && modoDemo)){
      const labels={compras:'Órdenes de compra',ventas:'Ventas',proveedores:'Proveedores',
        clientes:'Clientes',bodega:'Bodega',cuentas_corrientes:'Cuentas corrientes'};
      $('#workspaceEyebrow').textContent='MENÚ OFICIAL / OPERACIONES';
      $('#workspaceTitle').textContent=labels[view];
      $('#workspaceDescription').textContent='Consulta de datos desde Laravel/MySQL con permisos. No se mezclan registros locales.';
      $('#newButton').hidden=true;
      $('#exportButton').hidden=true;
      $('#workspaceContent').replaceChildren();
      window.RutaHDOficial?.mount($('#workspaceContent'),view);
      return;
    }
    const key=catalogKey(view);
    if(key && catalogos?.CONFIG[key]) {
      const cfg=catalogos.CONFIG[key];
      $('#workspaceEyebrow').textContent='PRODUCTOS / CLASIFICACIONES';
      $('#workspaceTitle').textContent=cfg.title;
      $('#workspaceDescription').textContent='Mantenimiento independiente de '+cfg.title.toLocaleLowerCase('es-CL')+'. Los datos de prueba son locales; para MySQL utiliza una sesión autorizada.';
      $('#newButton').hidden=true;
      $('#exportButton').hidden=true;
      $('#workspaceContent').replaceChildren();
      if(access()?.authenticated()) {
        // La sesión real nunca debe mezclar datos MySQL con la demo local.
        window.RutaHDRemoto?.mount($('#workspaceContent'),key);
      } else {
        catalogos.mount(()=>db.productos);
        $('#catalogAdmin')?.classList.add('catalog-menu-view');
        catalogos.selectCatalog(key);
        window.RutaHDRemoto?.mount($('#workspaceContent'),key);
      }
      return;
    }
    if(view==='productos' && access()?.authenticated()){
      $('#workspaceEyebrow').textContent='PRODUCTOS / BASE REAL';
      $('#workspaceTitle').textContent='Productos';
      $('#workspaceDescription').textContent='CRUD autenticado de productos y presentaciones; stock en Inventario.';
      $('#newButton').hidden=true;
      $('#exportButton').hidden=true;
      window.RutaHDProductosRemotos?.mount($('#workspaceContent'));
      return;
    }
    if(view==='usuarios'){
      $('#workspaceEyebrow').textContent='ADMINISTRACIÓN / USUARIOS';
      $('#workspaceTitle').textContent='Usuarios';
      $('#workspaceDescription').textContent='Altas, cambios, perfiles y bajas lógicas de usuarios reales.';
      $('#newButton').hidden=true;
      $('#exportButton').hidden=true;
      window.RutaHDUsuarios?.mount($('#workspaceContent'));
      return;
    }
    if(view==='perfiles'){
      $('#workspaceEyebrow').textContent='ADMINISTRACIÓN / ACCESOS';
      $('#workspaceTitle').textContent='Perfiles y permisos';
      $('#workspaceDescription').textContent='Controla qué submódulos de Productos puede ver o gestionar cada perfil.';
      $('#newButton').hidden=true;$('#exportButton').hidden=true;
      $('#workspaceContent').replaceChildren();
      window.RutaHDPerfiles?.mount($('#workspaceContent'));
      return;
    }
    const kinds = {
      inventario:{title:'Inventario',description:'Supervisa existencias y edita el stock de los productos de prueba.',eyebrow:'CONTROL DE EXISTENCIAS',singular:'producto'},
      informes:{title:'Informes',description:'Consulta indicadores y exporta reportes de tus registros locales.',eyebrow:'REPORTES OPERATIVOS'},
      administracion:{title:'Administración',description:'Maestros Rubro → Departamento → Familia → Línea, Marca → Modelo y atributos tributarios.',eyebrow:'CATÁLOGOS Y CONFIGURACIÓN'}
    };
    const cfg=definitions[view] || kinds[view];
    $('#workspaceEyebrow').textContent = cfg.eyebrow || 'GESTIÓN COMERCIAL';
    $('#workspaceTitle').textContent=cfg.title;
    $('#workspaceDescription').textContent=cfg.description;
    $('#newButton').hidden = ['informes','administracion'].includes(view);
    $('#exportButton').hidden = view === 'administracion';
    $('#newButtonText').textContent='Nuevo '+(cfg.singular || 'registro');
    if (view==='informes') renderReports();
    else if (view==='administracion') {
      $('#workspaceContent').replaceChildren();
      // Cuando hay sesión real se muestran exclusivamente datos de Laravel.
      if(!access()?.authenticated()) renderAdmin();
      window.RutaHDRemoto?.mount($('#workspaceContent'));
    }
    else renderTable(view === 'inventario' ? 'productos' : view);
  }

  function visibleRows(kind) {
    const rows=db[kind] || [];
    if (!query) return rows.slice();
    const find=safeText(query);
    return rows.filter(row=>Object.entries(row).some(([key,value])=>safeText(value).includes(find)||(catalogos?.LABELS[key]&&safeText(catalogos.productLabel(key,value)).includes(find))));
  }

  function formatCell(row,key) {
    if (key==='precio'||key==='total') return money(row[key]);
    if (key==='fecha') return displayDate(row[key]);
    if (catalogos?.LABELS[key]) return catalogos.productLabel(key,row[key]);
    return valueString(row[key]) || '—';
  }

  function renderTable(kind) {
    const cfg=definitions[kind];
    const records=visibleRows(kind);
    const wrap=$('#workspaceContent');
    wrap.replaceChildren();
    const panel=node('section','surface-panel table-panel');
    const heading=node('div','table-panel-top');
    const title=node('div');
    add(title,node('h2','',view==='inventario'?'Existencias de productos':'Listado de '+cfg.title.toLocaleLowerCase('es-CL')),node('p','',records.length+' registro(s)'+(query?' encontrados':'')+' · Almacenamiento local'));
    add(heading,title,node('span','pill neutral','Vista de demostración'));
    panel.appendChild(heading);
    if (records.length) {
      const tableBox=node('div','table-scroll'),table=node('table','data-table');
      const thead=node('thead'),headRow=node('tr');
      const columns=view==='inventario'?[['codigo','SKU'],['nombre','Producto'],['stock','Stock'],['minimo','Mínimo'],['estado','Estado']]:cfg.columns;
      columns.forEach(col=>headRow.appendChild(node('th','',col[1])));
      headRow.appendChild(node('th','','Acciones'));
      thead.appendChild(headRow);table.appendChild(thead);
      const tbody=node('tbody');
      records.forEach(row=>{
        const tr=node('tr');
        columns.forEach(col=>{
          const cell=node('td');
          if (col[0]==='estado') cell.appendChild(node('span','pill '+statusClass(row.estado),formatCell(row,col[0])));
          else if (col[0]==='stock' && Number(row.stock)<=Number(row.minimo)) cell.appendChild(node('span','pill warning',formatCell(row,col[0])));
          else cell.textContent=formatCell(row,col[0]);
          tr.appendChild(cell);
        });
        const actions=node('td','row-actions');
        [['view','eye','Ver'],['edit','edit','Editar'],['delete','trash','Eliminar']].forEach(([action,shape,label])=>{
          const b=node('button',action==='delete'?'delete':'');
          b.type='button';b.dataset.action=action;b.dataset.kind=kind;b.dataset.id=valueString(row.id);
          b.title=label;b.setAttribute('aria-label',label+' '+(row.nombre||row.numero||row.codigo));
          b.appendChild(icon(shape));actions.appendChild(b);
        });
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);tableBox.appendChild(table);panel.appendChild(tableBox);
    } else {
      const empty=node('div','table-empty');
      const symbol=node('span','empty-illustration');symbol.appendChild(icon(cfg.icon));
      add(empty,symbol,node('h3','',query?'No se encontraron coincidencias':'Todavía no hay registros'),
        node('p','',query?'Prueba con otra palabra en el buscador.':'Crea tu primer '+cfg.singular+' para comenzar a probar este módulo.'));
      if (!query) {
        const button=node('button','button primary');
        button.type='button';button.dataset.action='create';button.dataset.kind=kind;button.appendChild(icon('plus'));button.appendChild(document.createTextNode(' Nuevo '+cfg.singular));
        empty.appendChild(button);
      }
      panel.appendChild(empty);
    }
    panel.appendChild(node('div','table-footer','Se muestran '+records.length+' de '+db[kind].length+' registros en este navegador.'));
    wrap.appendChild(panel);
  }

  function renderReports() {
    const wrap=$('#workspaceContent');wrap.replaceChildren();
    const stats=compute();
    const grid=node('div','inform-grid');
    [['Pedidos registrados',stats.pedidos,'orders'],['Clientes',stats.clientes,'users'],['Monto de pedidos',money(stats.total),'chart']].forEach(([title,val,ico])=>{
      const card=node('article','inform-card'),symbol=node('span','module-icon');
      symbol.appendChild(icon(ico));
      add(card,symbol,node('span','overline',title),node('strong','',val),node('p','','Datos ingresados en esta demostración'));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    const panel=node('section','surface-panel');
    const heading=node('div','panel-heading'),title=node('div');
    add(title,node('span','overline','ÚLTIMOS SIETE DÍAS'),node('h3','','Pedidos registrados por día'));
    add(heading,title,node('span','pill neutral','Solo datos locales'));
    panel.appendChild(heading);
    const chart=node('div','chart-area');panel.appendChild(chart);wrap.appendChild(panel);renderChart(chart);
    const exports=node('div','surface-panel');
    exports.style.marginTop='16px';
    const titleWrap=node('div','panel-heading'),t=node('div');
    add(t,node('span','overline','DESCARGAS'),node('h3','','Exportar datos a CSV'));
    titleWrap.appendChild(t);exports.appendChild(titleWrap);
    const buttons=node('div','workspace-actions');
    ['pedidos','clientes','productos'].forEach(k=>{
      const b=node('button','button ghost');
      b.type='button';b.dataset.action='export';b.dataset.kind=k;
      b.appendChild(icon('download'));b.appendChild(document.createTextNode(' '+definitions[k].title));
      buttons.appendChild(b);
    });
    buttons.style.flexWrap='wrap';exports.appendChild(buttons);wrap.appendChild(exports);
  }

  function renderAdmin() {
    const wrap=$('#workspaceContent');wrap.replaceChildren();
    const grid=node('div','admin-grid');
    const cards=[
      {title:'Estado de la aplicación',body:'Esta es una demostración estática funcional. El backend Laravel está cargado en un área protegida de InfinityFree y su conexión de producción aún no está habilitada.',cta:'Ver información',action:'about',ico:'info'},
      {title:'Datos de este navegador',body:'Puedes crear, modificar y eliminar registros de prueba. No hay usuarios reales ni ventas inventadas; los datos solo existen localmente.',cta:'Borrar datos de prueba',action:'reset',ico:'trash'},
      {title:'Exportación de registros',body:'Descarga archivos CSV para revisar tus pruebas en Excel o LibreOffice. Los archivos se generan en tu navegador.',cta:'Ir a informes',action:'reports',ico:'download'},
      {title:'Centro de ayuda',body:'Usa la barra lateral para navegar. Control + K enfoca la búsqueda. Los cuadros de diálogo piden confirmación antes de eliminar.',cta:'Leer instrucciones',action:'help',ico:'info'}
    ];
    cards.forEach(card=>{
      const article=node('article','admin-card');
      const symbol=node('span','module-icon');symbol.appendChild(icon(card.ico));
      add(article,symbol,node('h2','',card.title),node('p','',card.body));
      const b=node('button','button ghost',card.cta);b.dataset.action=card.action;b.type='button';article.appendChild(b);grid.appendChild(article);
    });
    wrap.appendChild(grid);
  }

  function openForm(kind,id) {
    if (!definitions[kind]) return;
    if (kind==='productos' && id===null && !catalogos.canCreateProduct()) {
      toast('warning','Completa los catálogos','Debes configurar los diez catálogos desde los submódulos de Productos.');
      navigate('catalogos.rubros');return;
    }
    if (kind==='pedidos' && !db.clientes.length) {
      toast('warning','Primero agrega un cliente','Para crear un pedido es necesario seleccionar un cliente registrado.');
      navigate('clientes');return;
    }
    const record=id===null ? null : db[kind].find(x=>String(x.id)===String(id));
    if (id!==null && !record) {toast('error','No se encontró el registro','Actualiza la lista y vuelve a intentarlo.');return;}
    editing={kind,id:id===null?null:record.id};
    const cfg=definitions[kind];
    $('#formDialogTitle').textContent=(record?'Editar ':'Nuevo ')+cfg.singular;
    const form=$('#recordForm');
    const area=$('#formFields');area.replaceChildren();
    $('#formError').hidden=true;$('#formError').textContent='';
    cfg.fields.forEach(field=>{
      const row=node('div','field'+(field.full?' full':''));
      const label=node('label');
      label.htmlFor='field-'+field.key;
      label.textContent=field.label+' ';
      if(field.required) label.appendChild(node('span','required','*'));
      row.appendChild(label);
      let control;
      if (field.type==='select'||field.type==='client'||field.type==='catalog') {
        control=node('select');
        const options=field.type==='client'?db.clientes.filter(c=>c.estado!=='Inactivo').map(c=>c.nombre):(field.type==='catalog'?[]:field.options);
        if(field.type==='client') {
          const blank=node('option','', 'Selecciona un cliente');blank.value='';control.appendChild(blank);
        }
        options.forEach(option=>{
          const el=node('option','',option);el.value=option;control.appendChild(el);
        });
      } else if(field.type==='textarea') {
        control=node('textarea');control.rows=3;
      } else {
        control=node('input');control.type=field.type||'text';
        if(field.min!==undefined) control.min=String(field.min);
        if(field.step!==undefined) control.step=String(field.step);
      }
      if(field.max) control.maxLength=field.max;
      if(field.placeholder) control.placeholder=field.placeholder;
      control.id='field-'+field.key;control.name=field.key;control.required=!!field.required;
      if (record && field.type!=='catalog') control.value=valueString(record[field.key]);
      else if(field.key==='fecha') control.value=today();
      else if(field.key==='estado') control.value=(field.options||[])[0]||'';
      else if (field.type==='number') control.value='0';
      row.appendChild(control);area.appendChild(row);
    });
    if(kind==='productos') catalogos.attachProductForm(area,record);
    $('#formDialog').showModal();
    setTimeout(()=>area.querySelector('input,select,textarea')?.focus(),30);
  }

  function saveForm(e) {
    e.preventDefault();
    if (!editing) return;
    const {kind,id}=editing;
    const cfg=definitions[kind];
    const values={};
    const error=$('#formError');
    const controls=$$('[name]',$('#formFields'));
    for (const field of cfg.fields) {
      const input=$('#field-'+field.key);
      const raw=input.value.trim();
      input.setAttribute('aria-invalid','false');
      if(field.required && !raw) {
        input.setAttribute('aria-invalid','true');error.textContent='Completa el campo: '+field.label+'.';error.hidden=false;input.focus();return;
      }
      if (!input.checkValidity()) {
        input.setAttribute('aria-invalid','true');error.textContent='Revisa el campo: '+field.label+'.';error.hidden=false;input.focus();return;
      }
      if(field.type==='number') {
        const val=Number(raw);
        if(!Number.isFinite(val)||val<0||!Number.isInteger(val)) {
          input.setAttribute('aria-invalid','true');error.textContent='Ingresa un número entero válido en '+field.label+'.';error.hidden=false;input.focus();return;
        }
        values[field.key]=val;
      } else values[field.key]=raw;
      if(field.type==='catalog'&&raw&&!catalogos.catalog(field.catalog).some(r=>String(r.id)===raw&&r.activo!==false)){
        input.setAttribute('aria-invalid','true');error.textContent='Selecciona un '+field.label+' válido y activo.';error.hidden=false;input.focus();return;
      }
    }
    if(kind==='productos') {
      const pairs=[['departamentos','departamentoId','rubroId'],['familias','familiaId','departamentoId'],
                   ['lineas','lineaId','familiaId'],['modelos','modeloId','marcaId']];
      for (const [table,child,parent] of pairs) {
        const record=catalogos.catalog(table).find(x=>String(x.id)===values[child]);
        if (!record||String(record.parentId)!==values[parent]) {
          error.textContent='La clasificación seleccionada no es coherente: '+child+'.';
          error.hidden=false;return;
        }
      }
    }
    const unique = kind==='clientes'?'rut':kind==='productos'?'codigo':'numero';
    if(db[kind].some(row=>String(row.id)!==String(id) && safeText(row[unique])===safeText(values[unique]))) {
      error.textContent='Ya existe un registro con ese '+(unique==='numero'?'número':unique)+'.';error.hidden=false;
      $('#field-'+unique).focus();return;
    }
    const existing = id!==null ? db[kind].find(row=>String(row.id)===String(id)) : null;
    if(existing) Object.assign(existing,values);
    else db[kind].unshift({id:++nextId,...values});
    recordActivity(existing?'Registro actualizado':'Registro creado',values.nombre||values.numero||values.codigo,cfg.icon);
    persist();$('#formDialog').close();editing=null;
    toast('success',existing?'Cambios guardados':'Registro creado','La operación se guardó en este navegador.');
    refresh();
  }

  function askDelete(kind,id) {
    const rec=db[kind]?.find(x=>String(x.id)===String(id));
    if(!rec) return;
    pendingConfirm={type:'delete',kind,id};
    $('#confirmTitle').textContent='¿Eliminar este '+definitions[kind].singular+'?';
    $('#confirmDescription').textContent='Se eliminará "'+(rec.nombre||rec.numero||rec.codigo)+'" de los datos locales. Esta acción no se puede deshacer.';
    $('#confirmAccept').replaceChildren(icon('trash'),document.createTextNode(' Eliminar'));
    $('#confirmDialog').showModal();
  }

  function askReset() {
    pendingConfirm={type:'reset'};
    $('#confirmTitle').textContent='¿Borrar todos los datos de prueba?';
    $('#confirmDescription').textContent='Se eliminarán clientes, productos, pedidos y actividad del almacenamiento local de este navegador. No afecta a InfinityFree.';
    $('#confirmAccept').replaceChildren(icon('trash'),document.createTextNode(' Borrar datos'));
    $('#confirmDialog').showModal();
  }

  function acceptConfirm() {
    if(!pendingConfirm) return;
    if(pendingConfirm.type==='reset') {
      Object.assign(db,DEFAULT_DATA());
      catalogos?.reset();
      persist();toast('success','Demostración reiniciada','Todos los registros locales fueron eliminados.');
    } else {
      const {kind,id}=pendingConfirm;
      const before=db[kind].length;
      db[kind]=db[kind].filter(x=>String(x.id)!==String(id));
      if(kind==='clientes' && before!==db[kind].length) {
        const name=pendingConfirm.name;
        // Los pedidos conservan el nombre registrado originalmente; no se borran pedidos de forma implícita.
      }
      recordActivity('Registro eliminado',definitions[kind].singular,definitions[kind].icon);
      persist();toast('success','Registro eliminado','La eliminación se realizó en este navegador.');
    }
    pendingConfirm=null;
    $('#confirmDialog').close();refresh();
  }

  function viewRecord(kind,id) {
    const record=db[kind]?.find(x=>String(x.id)===String(id));
    if(!record) return;
    const lines=definitions[kind].fields.map(field=>field.label+': '+formatCell(record,field.key));
    showInfo('Detalle del '+definitions[kind].singular,lines.join('\n'));
  }

  function exportCSV(kind) {
    if(!definitions[kind]) return;
    const cfg=definitions[kind];
    if(!db[kind].length) {
      toast('warning','Sin datos para exportar','Primero crea al menos un registro de '+kind+'.');return;
    }
    const fields=cfg.fields.map(x=>x.key);
    const protectExcel = value => {
      let text=valueString(value);
      if (/^\s*[=+\-@\t\r]/.test(text)) text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    };
    const rows=[cfg.fields.map(field=>protectExcel(field.label)).join(';')];
    db[kind].forEach(rec=>rows.push(fields.map(k=>protectExcel(catalogos?.LABELS[k]?catalogos.productLabel(k,rec[k]):rec[k])).join(';')));
    const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const uri=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=uri;a.download='rutahd2-'+kind+'-'+today()+'.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(uri),1000);
    toast('success','Informe exportado','El archivo CSV se generó a partir de tus datos locales.');
  }

  function refresh() {
    renderHome();
    if(view!=='inicio') renderWorkspace();
  }

  window.RutaHDAvisos={toast};
  if(catalogos) catalogos.onChange=()=>{if(view==='administracion')catalogos.mount(()=>db.productos);};

  document.addEventListener('click',(e)=>{
    if(e.target.closest('#toggleProductSubnav')){
      e.preventDefault();
      const open=$('#productSubnav').hidden;
      setProductExpanded(open);
      if(open)setAdminExpanded(false);
      return;
    }
    if(e.target.closest('#toggleAdminSubnav')){
      e.preventDefault();
      const open=$('#adminSubnav').hidden;
      setAdminExpanded(open);
      if(open)setProductExpanded(false);
      return;
    }
    const adminCatalog=e.target.closest('[data-admin-catalog]');
    if(adminCatalog){
      e.preventDefault();
      navigate('catalogos.'+adminCatalog.dataset.adminCatalog,'administracion');
      return;
    }
    const nav=e.target.closest('[data-nav]');
    if(nav){
      e.preventDefault();
      const origin=nav.closest('#adminNavGroup')?'administracion':'productos';
      navigate(nav.dataset.nav,origin);
      return;
    }
    if(e.target.closest('[data-close-sidebar]')) {
      $('#appShell').classList.remove('sidebar-open');return;
    }
    const action=e.target.closest('[data-action]');
    if(!action)return;
    const {kind,id}=action.dataset;
    switch(action.dataset.action) {
      case 'login':window.RutaHDLogin?.show();break;
      case 'create':openForm(kind|| (view==='inventario'?'productos':view),null);break;
      case 'edit':openForm(kind,id);break;
      case 'delete':askDelete(kind,id);break;
      case 'view':viewRecord(kind,id);break;
      case 'export':exportCSV(kind);break;
      case 'reset':askReset();break;
      case 'reports':navigate('informes');break;
      case 'help':showInfo('Ayuda de Ruta H&D2','Desde la barra lateral puedes navegar entre módulos. Usa el botón Nuevo para agregar registros, los íconos de cada fila para ver, editar o eliminar y la sección Informes para exportar CSV. Atajo de búsqueda: Ctrl + K. Los datos no salen de tu navegador.');break;
      case 'about':showInfo('Conexión del sistema · Ruta H&D2','El frontend consulta el estado real de Laravel y está preparado para utilizar los recursos autenticados. Mientras la API esté bloqueada (HTTP 503), las vistas de datos reales permanecen indisponibles. Los registros locales de demostración nunca se sincronizan automáticamente con MariaDB.');break;
    }
  });

  $('#menuToggle').addEventListener('click',()=>$('#appShell').classList.toggle('sidebar-open'));
  $('#notificationButton').addEventListener('click',()=>showInfo('Entorno de demostración','No hay notificaciones de un servidor remoto. Los avisos de esta interfaz reflejan únicamente las acciones realizadas en este navegador.'));
  $('#newButton').addEventListener('click',()=>openForm(view==='inventario'?'productos':view,null));
  $('#exportButton').addEventListener('click',()=>exportCSV(view==='inventario'?'productos':view));
  $('#globalSearch').addEventListener('input', e => {
    const requested=e.target.value.trim();
    if(view==='inicio' && requested) {
      navigate('clientes');
      $('#globalSearch').value=requested;
    }
    query=requested;
    if(['pedidos','clientes','productos','inventario'].includes(view)) renderWorkspace();
  });
  $('#recordForm').addEventListener('submit',saveForm);
  $$('[data-close-form]').forEach(btn=>btn.addEventListener('click',()=>$('#formDialog').close()));
  $('#formDialog').addEventListener('close',()=>{editing=null});
  $('#confirmCancel').addEventListener('click',()=>{$('#confirmDialog').close();pendingConfirm=null;});
  $('#confirmAccept').addEventListener('click',acceptConfirm);
  $('#confirmDialog').addEventListener('close',()=>pendingConfirm=null);
  $('#infoClose').addEventListener('click',()=>$('#infoDialog').close());
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();}
    if(e.key==='Escape') $('#appShell').classList.remove('sidebar-open');
  });
  document.addEventListener('rutahd:permisos-actualizados',()=>{
    updateProductMenu();
    if((view==='administracion'||view==='perfiles'||view==='usuarios')&&access()?.isAdmin())setAdminExpanded(true);
    if(!canNavigate(view)){navigate('inicio');return;}
    if(view!=='inicio')renderWorkspace();
    const perfil=access()?.usuario();
    const role=$('.profile-label small');
    if(role)role.textContent=perfil?'Perfil: '+perfil.rol:'Vista de demostración';
  });
  window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'inicio'));
  updateProductMenu();
  navigate(location.hash.slice(1)||'inicio');
  toast('info','Bienvenido a Ruta H&D2','Estás usando un entorno de demostración local.',3500);
})();
