/* Módulos oficiales respaldados por Laravel: solo lectura hasta cerrar los CRUD.
   Sin JWT NUNCA se muestran filas locales como si procedieran de MariaDB. */
(() => {
  'use strict';
  const CONFIG=Object.freeze({
    compras:{resource:'ordenes_compra',title:'Órdenes de compra',fields:[['id','ID'],['numero','Número'],['fecha','Fecha'],['estado','Estado'],['total','Total']]},
    ventas:{resource:'ventas',title:'Ventas',fields:[['id','ID'],['numero','Número'],['fecha','Fecha'],['estado','Estado'],['total','Total']]},
    proveedores:{resource:'proveedores',title:'Proveedores',fields:[['id','ID'],['rut','RUT'],['razon_social','Razón social'],['nombre','Nombre'],['activo','Activo']]},
    clientes:{resource:'clientes',title:'Clientes',fields:[['id','ID'],['rut','RUT'],['razon_social','Razón social'],['nombre','Nombre'],['activo','Activo']]},
    bodega:{resource:'bodegas',title:'Bodegas',fields:[['id','ID'],['codigo','Código'],['nombre','Nombre'],['ubicacion','Ubicación'],['activo','Activo']]},
    cuentas_corrientes:{resource:null,title:'Cuentas corrientes',fields:[]}
  });
  const create=(tag,text,cls)=>{
    const e=document.createElement(tag);
    if(text!==undefined)e.textContent=String(text);
    if(cls)e.className=cls;
    return e;
  };
  const action=(title,callback)=>{
    const button=create('button',title,'button primary');
    button.type='button';button.addEventListener('click',callback);return button;
  };
  let currentId=0;
  function mount(parent,key){
    if(!parent)return;
    const cfg=CONFIG[key];
    parent.replaceChildren();
    if(!cfg){parent.appendChild(create('p','Módulo inexistente.','catalog-footnote'));return;}
    const root=create('section',undefined,'surface-panel official-module');
    const header=create('div',undefined,'panel-heading');
    const title=create('h2',cfg.title);
    const badge=create('span','Conexión Laravel/MySQL','official-source');
    header.append(title,badge);
    const notice=create('p',undefined,'catalog-footnote');
    notice.setAttribute('role','status');
    root.append(header,notice);parent.append(root);
    const id=++currentId;
    const access=window.RutaHDAccesos;
    if(!access?.authenticated()){
      notice.textContent='Este módulo requiere autenticación. No se mostrarán registros locales como si fueran información de la empresa.';
      root.appendChild(action('Abrir inicio de sesión',()=>window.RutaHDLogin?.show()));
      return;
    }
    if(!cfg.resource){
      notice.textContent='El backend todavía no dispone de un endpoint validado para Cuentas corrientes. No se muestran saldos inventados.';
      return;
    }
    const bar=create('div',undefined,'workspace-actions');
    const content=create('div',undefined,'catalog-table-scroll');
    root.append(bar,content);
    let page=1,loading=false;
    async function load(){
      if(loading)return;
      loading=true;bar.replaceChildren();content.replaceChildren();
      notice.textContent='Consultando registros reales…';
      try{
        const response=await window.RutaHDApiCatalogos.resources(cfg.resource,page);
        if(id!==currentId)return;
        if(!response||!Array.isArray(response.data))throw Error('La API no devolvió una lista válida');
        const rows=response.data;
        if(!rows.length){
          notice.textContent='No existen registros en esta página de la base de datos.';
        }else{
          const columns=cfg.fields.filter(([field])=>rows.some(row=>Object.prototype.hasOwnProperty.call(row,field)));
          if(!columns.length){notice.textContent='La API devolvió registros, pero no hay columnas públicas configuradas.';return;}
          const table=create('table',undefined,'catalog-table official-table');
          const thead=create('thead'),tr=create('tr');
          columns.forEach(([,label])=>tr.appendChild(create('th',label)));
          thead.appendChild(tr);table.appendChild(thead);
          const body=create('tbody');
          rows.forEach(row=>{
            const tr=create('tr');
            columns.forEach(([field])=>{
              const value=row[field];
              const text=value===null||value===undefined?'—':typeof value==='boolean'?(value?'Sí':'No'):String(value);
              tr.appendChild(create('td',text));
            });
            body.appendChild(tr);
          });
          table.appendChild(body);content.appendChild(table);
          notice.textContent='Registros obtenidos del servidor · Página '+page+'.';
        }
        const next=Number(response.last_page||1)>page;
        const prev=page>1;
        if(prev)bar.appendChild(action('Anterior',()=>{page--;void load()}));
        if(next)bar.appendChild(action('Siguiente',()=>{page++;void load()}));
        bar.appendChild(action('Actualizar',()=>void load()));
      }catch(e){
        if(id!==currentId)return;
        if(e?.status===401){window.RutaHDApiCatalogos.signOut();window.RutaHDAccesos?.clear();}
        notice.textContent=e?.status===403?'El perfil no tiene permisos para consultar este módulo.':
          e?.status===401?'La sesión venció. Inicia sesión de nuevo.':
          'No se pudo consultar la API Laravel (HTTP '+(e?.status||'sin respuesta')+').';
        bar.appendChild(action('Reintentar',()=>void load()));
      }finally{loading=false;}
    }
    void load();
  }
  window.RutaHDOficial=Object.freeze({mount});
})();