/* Matriz de módulos de Productos por perfil (rol).
 * Solamente una sesión autenticada como administrador puede editarla.
 */
(() => {
  'use strict';
  const access = () => window.RutaHDAccesos;
  const api = () => window.RutaHDApiCatalogos;
  const $ = (selector,root=document)=>root.querySelector(selector);
  const el = (tag,cls,text) => {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const catalogos=window.RutaCatalogos?.CONFIG||{
    rubros:{title:'Rubros'},departamentos:{title:'Departamentos'},
    familias:{title:'Familias'},lineas:{title:'Líneas'},
    marcas:{title:'Marcas'},modelos:{title:'Modelos'},
    tipos_unidad:{title:'Tipos de unidad'},tipos_codigos_barras:{title:'Tipos de códigos de barras'},
    tipos_envasado:{title:'Tipos de envasado'},
    condiciones_tributarias:{title:'Condiciones tributarias'}
  };
  let root=null,roles=[],selectedId=null,busy=false,assignBusy=false;
  function status(message,error=false) {
    const target=root&&$('#rolesStatus',root);
    if(target){target.textContent=message;target.setAttribute('role',error?'alert':'status');}
  }
  function unauthorized() {
    root.appendChild(el('p','catalog-footnote',
      'Para gestionar perfiles inicia una sesión de administrador desde Administración. Los datos de prueba locales no conceden permisos de servidor.'));
  }
  async function load(){
    if(!access().authenticated()||!access().isAdmin()){unauthorized();return;}
    status('Consultando perfiles y autorizaciones…');
    try{
      const response=await api().roleCatalogPermissions();
      roles=response.roles||[];
      if(!roles.some(r=>String(r.id)===String(selectedId))) selectedId=roles.find(r=>r.editable)?.id||roles[0]?.id;
      renderMatrix();
      await renderUsers();
      status('Permisos cargados desde el servidor. Los cambios se aplican inmediatamente en las próximas solicitudes.');
    }catch(e){status('No fue posible consultar permisos (HTTP '+(e.status||'conexión')+').',true);}
  }
  function mount(parent){
    if(!parent)return;
    const surface=el('section','surface-panel perfiles-panel');surface.id='rolesCatalogos';
    root=surface;parent.appendChild(root);
    root.appendChild(el('h2','','Perfiles y permisos por módulo'));
    root.appendChild(el('p','catalog-footnote',
      'Cada perfil controla los accesos disponibles. Expande los módulos para revisar sus subítems; los permisos editables se validan en Laravel.'));
    const message=el('p','catalog-footnote');message.id='rolesStatus';
    root.appendChild(message);
    load();
  }
  async function renderUsers(){
    if(!root || !access().authenticated() || !access().isAdmin())return;
    $('#usersProfiles',root)?.remove();
    const panel=el('section','profiles-users');panel.id='usersProfiles';
    panel.appendChild(el('h3','','Usuarios y sus perfiles'));
    panel.appendChild(el('p','catalog-footnote',
      'Cada usuario hereda los permisos del perfil asignado. Por seguridad, esta pantalla no permite cambiar cuentas administradoras ni elevar usuarios al rol administrador.'));
    root.appendChild(panel);
    try{
      const result=await api().usersForProfiles();
      const users=result.usuarios||[];
      if(!users.length){
        panel.appendChild(el('p','catalog-footnote','No hay usuarios para asignar.'));return;
      }
      const grid=el('div','permissions-table-scroll');
      const table=el('table','permissions-table');
      const head=el('thead'),row=el('tr');
      ['Usuario','Perfil actual','Cambiar perfil'].forEach(label=>row.appendChild(el('th','',label)));
      head.appendChild(row);table.appendChild(head);
      const body=el('tbody');
      users.forEach(user=>{
        const tr=el('tr');
        tr.appendChild(el('td','',user.nombre+' ('+user.correo_electronico+')'));
        tr.appendChild(el('td','',user.perfil));
        const cell=el('td'),group=el('div','profile-user-assignment');
        const choice=el('select');choice.setAttribute('aria-label','Perfil de '+user.nombre);
        roles.forEach(role=>{
          const option=el('option','',role.nombre);
          option.value=role.id;choice.appendChild(option);
        });
        choice.value=String(user.rol_id);
        const current=roles.find(r=>Number(r.id)===Number(user.rol_id));
        if(current?.codigo==='administrador'){
          choice.disabled=true;group.appendChild(choice);
          group.appendChild(el('small','', 'Administrador protegido'));
        }else{
          const save=el('button','button ghost','Asignar');
          save.type='button';
          save.addEventListener('click',async()=>{
            if(assignBusy)return;
            assignBusy=true;
            try{
              await api().assignUserRole(user.id,choice.value);
              status('Nuevo perfil asignado a '+user.nombre+'.');
              await renderUsers();
            }catch(e){status('No se pudo asignar el perfil (HTTP '+(e.status||'conexión')+').',true);}
            finally{assignBusy=false;}
          });
          group.appendChild(choice);group.appendChild(save);
        }
        cell.appendChild(group);tr.appendChild(cell);body.appendChild(tr);
      });
      table.appendChild(body);grid.appendChild(table);panel.appendChild(grid);
    }catch(e){
      panel.appendChild(el('p','catalog-footnote',
        'No se pudieron consultar los usuarios (HTTP '+(e.status||'conexión')+').'));
    }
  }
  const TREE=[
    {title:'Administración',children:[
      ['tipos_unidad','Tipos de unidad'],['tipos_envasado','Tipos de envasado'],
      ['condiciones_tributarias','Condición tributaria'],
      ['tipos_codigos_barras','Tipos de códigos de barras'],
      [null,'Usuarios'],[null,'Perfiles y permisos']
    ]},
    {title:'Compras',children:[]},
    {title:'Ventas',children:[]},
    {title:'Proveedores',children:[[null,'Listado de proveedores'],[null,'Proveedores productos']]},
    {title:'Clientes',children:[]},
    {title:'Productos',children:[[null,'Listado de productos'],
      ['rubros','Rubros'],['departamentos','Departamentos'],['familias','Familias'],
      ['lineas','Líneas'],['marcas','Marcas'],['modelos','Modelos']]},
    {title:'Bodega',children:[]},
    {title:'Cuentas corrientes',children:[]}
  ];
  function renderMatrix(){
    if(!root)return;
    $('#rolesForm',root)?.remove();
    const form=el('form','profiles-form');form.id='rolesForm';
    if(!roles.length){
      form.appendChild(el('p','catalog-footnote','No hay perfiles configurados.'));
      root.appendChild(form);return;
    }
    const selectorRow=el('label','field');
    selectorRow.appendChild(el('span','','Perfil de usuario'));
    const selector=el('select');selector.id='selectorPerfil';
    roles.forEach(role=>{
      const option=el('option','',role.nombre+' ('+role.codigo+')');
      option.value=role.id;selector.appendChild(option);
    });
    selector.value=String(selectedId);
    selector.addEventListener('change',()=>{selectedId=Number(selector.value);renderMatrix();});
    selectorRow.appendChild(selector);form.appendChild(selectorRow);
    const role=roles.find(r=>String(r.id)===String(selectedId));
    if(!role){root.appendChild(form);return;}
    const intro=el('p','catalog-footnote',
      'Árbol de permisos por módulo. Los catálogos permiten configurar Ver y Gestionar. '+
      'Las demás opciones se muestran como permisos generales heredados: '+
      'no se habilitan controles sin soporte de autorización independiente en Laravel.');
    form.appendChild(intro);
    const tree=el('div','permission-tree');tree.id='permissionTree';
    const heading=el('div','permission-tree-head');
    heading.append(el('span','','Módulo / Submódulo'),el('span','','Ver'),el('span','','Gestionar'));
    tree.appendChild(heading);
    const changes={};
    for(const [key] of Object.entries(catalogos)){
      const current=role.modulos?.[key]||{ver:false,gestionar:false};
      changes[key]={ver:Boolean(current.ver),gestionar:Boolean(current.gestionar)};
    }
    const editable=Boolean(role.editable);
    for(const group of TREE){
      const details=el('details','permission-tree-group');
      details.open=group.title==='Productos'||group.title==='Administración';
      const summary=el('summary','permission-tree-summary');
      summary.append(el('span','',group.title));
      const configurable=group.children.filter(([key])=>key&&Object.prototype.hasOwnProperty.call(changes,key)).length;
      summary.append(el('small','',configurable?
        configurable+' permisos independientes':'Permiso general'));
      details.appendChild(summary);
      if(group.children.length){
        const children=el('div','permission-tree-children');
        for(const [key,label] of group.children){
          const row=el('div','permission-tree-row');
          row.dataset.modulo=key||label.toLocaleLowerCase('es-CL').replace(/ /g,'_');
          row.append(el('span','',label));
          if(key&&changes[key]){
            const check=(action)=>{
              const wrapper=el('label');
              const c=el('input');c.type='checkbox';c.dataset.permission=action;
              c.setAttribute('aria-label',(action==='ver'?'Ver ':'Gestionar ')+label);
              c.checked=changes[key][action];c.disabled=!editable;
              c.addEventListener('change',()=>{
                changes[key][action]=c.checked;
                const view=row.querySelector('input[data-permission="ver"]');
                const manage=row.querySelector('input[data-permission="gestionar"]');
                if(action==='ver'&&!c.checked){changes[key].gestionar=false;if(manage)manage.checked=false;}
                if(action==='gestionar'&&c.checked){changes[key].ver=true;if(view)view.checked=true;}
              });
              wrapper.append(c);return wrapper;
            };
            row.append(check('ver'),check('gestionar'));
          }else{
            const marker=el('small','permission-tree-readonly',
              'Permiso general administrado por Laravel');
            row.append(marker);
          }
          children.appendChild(row);
        }
        details.appendChild(children);
      }
      tree.appendChild(details);
    }
    form.appendChild(tree);
    const footer=el('div','profile-permission-footer');
    if(editable){
      const save=el('button','button primary','Guardar permisos del perfil');
      save.type='submit';footer.appendChild(save);
    }else footer.appendChild(el('p','catalog-footnote',
      'La administración tiene acceso reservado y su perfil no puede modificarse aquí.'));
    form.appendChild(footer);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!editable||busy)return;
      busy=true;
      try{
        await api().saveRoleCatalogPermissions(role.id,changes);
        status('Permisos de submódulos guardados en el perfil '+role.nombre+'.');
        await load();
      }catch(error){
        status('No fue posible guardar el perfil (HTTP '+(error.status||'conexión')+').',true);
      }finally{busy=false;}
    });
    root.appendChild(form);
  }
  window.RutaHDPerfiles=Object.freeze({mount});
})();
