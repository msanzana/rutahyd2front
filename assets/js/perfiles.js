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
    tipos_unidad:{title:'Tipos de unidad'},gramajes:{title:'Gramajes'},
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
    root.appendChild(el('h2','','Perfiles y permisos de Productos'));
    root.appendChild(el('p','catalog-footnote',
      'Cada usuario hereda los accesos de su perfil (rol). Ver permite abrir el módulo; Gestionar habilita crear, editar y eliminar. Los permisos se validan también en Laravel.'));
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
  function renderMatrix(){
    if(!root)return;
    $('#rolesForm',root)?.remove();
    const form=el('form','profiles-form');form.id='rolesForm';
    if(!roles.length){form.appendChild(el('p','catalog-footnote','No hay perfiles configurados.'));root.appendChild(form);return;}
    const selectorRow=el('label','field');
    selectorRow.appendChild(el('span','','Perfil de usuario'));
    const selector=el('select');selector.id='selectorPerfil';
    roles.forEach(role=>{
      const opt=el('option','',role.nombre+' ('+role.codigo+')');
      opt.value=role.id;selector.appendChild(opt);
    });
    selector.value=String(selectedId);
    selector.addEventListener('change',()=>{selectedId=Number(selector.value);renderMatrix();});
    selectorRow.appendChild(selector);form.appendChild(selectorRow);
    const role=roles.find(r=>String(r.id)===String(selectedId));
    if(!role){root.appendChild(form);return;}
    const container=el('div','permissions-table-scroll'),table=el('table','permissions-table');
    const head=el('thead'),headers=el('tr');
    ['Submódulo de Productos','Ver / mostrar','Gestionar CRUD'].forEach(h=>headers.appendChild(el('th','',h)));
    head.appendChild(headers);table.appendChild(head);
    const body=el('tbody'),changes={};
    Object.entries(catalogos).forEach(([key,config])=>{
      const current=role.modulos?.[key]||{ver:false,gestionar:false};
      changes[key]={ver:Boolean(current.ver),gestionar:Boolean(current.gestionar)};
      const row=el('tr');row.dataset.modulo=key;
      row.appendChild(el('td','',config.title));
      const viewCell=el('td'),editCell=el('td');
      const ver=el('input'),manage=el('input');
      ver.type='checkbox';manage.type='checkbox';
      ver.dataset.permission='ver';manage.dataset.permission='gestionar';
      ver.setAttribute('aria-label','Ver '+config.title);
      manage.setAttribute('aria-label','Gestionar '+config.title);
      ver.checked=changes[key].ver;manage.checked=changes[key].gestionar;
      ver.disabled=!role.editable;manage.disabled=!role.editable;
      ver.addEventListener('change',()=>{
        changes[key].ver=ver.checked;
        if(!ver.checked){manage.checked=false;changes[key].gestionar=false;}
      });
      manage.addEventListener('change',()=>{
        changes[key].gestionar=manage.checked;
        if(manage.checked){ver.checked=true;changes[key].ver=true;}
      });
      viewCell.appendChild(ver);editCell.appendChild(manage);
      row.appendChild(viewCell);row.appendChild(editCell);body.appendChild(row);
    });
    table.appendChild(body);container.appendChild(table);form.appendChild(container);
    const footer=el('div','profile-permission-footer');
    if(role.editable){
      const save=el('button','button primary','Guardar permisos del perfil');
      save.type='submit';footer.appendChild(save);
    }else{
      footer.appendChild(el('p','catalog-footnote',
        'El perfil administrador posee acceso total reservado y no puede ser restringido desde esta matriz.'));
    }
    form.appendChild(footer);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!role.editable||busy)return;
      busy=true;
      try{
        await api().saveRoleCatalogPermissions(role.id,changes);
        status('Permisos guardados en el perfil '+role.nombre+'.');
        await load();
      }catch(e){
        status('No fue posible guardar el perfil (HTTP '+(e.status||'conexión')+').',true);
      }finally{busy=false;}
    });
    root.appendChild(form);
  }
  window.RutaHDPerfiles=Object.freeze({mount});
})();
