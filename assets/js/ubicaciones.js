/* Ruta H&D V2 · V38 · Ubicaciones jerárquicas, solo ciudad_id en entidades.
 * El dato territorial se consulta en Laravel; no hay catálogos simulados.
 */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos;
 const acl=()=>window.RutaHDAccesos;
 const TYPES=['paises','regiones','provincias','comunas','ciudades'];
 const TITLES=['País','Región','Provincia','Comuna','Ciudad / localidad'];
 const make=(tag,content='',css='')=>{
   const node=document.createElement(tag);
   if(content!==null)node.textContent=String(content);
   if(css)node.className=css;
   return node;
 };
 const button=(title,action,style='button ghost')=>{
   const b=make('button',title,style);b.type='button';b.addEventListener('click',action);return b;
 };
 const err=e=>e?.userMessage||e?.message||
  ('Error del servidor HTTP '+(e?.status||'desconocido'));
 function labeled(name,input){
   const w=make('label',null,'field location-field');
   w.append(make('span',name),input);return w;
 }
 const selectable=(name)=>{
   const select=make('select');
   select.setAttribute('aria-label',name);
   select.append(new Option('Seleccionar '+name.toLowerCase()+'…',''));
   select.disabled=true;return select;
 };
 /**
  * Selectores cascada completos, 1→2→3→4→5.
  * Retorna solo ciudad_id como valor persistible.
  * Los IDs CUT nunca se derivan de nombres tecleados.
  */
 async function mountSelector(container,ciudadId=null,{required=false,limitTo=null}={}){
   const root=make('div',null,'location-chain');
   root.setAttribute('aria-label','Domicilio geográfico por jerarquía');
   const select=TYPES.map((_,i)=>selectable(TITLES[i]));
   select.forEach((node,i)=>{
     root.append(labeled(TITLES[i],node));
     node.required=required&&i===4;
   });
   const status=make('small','Consultando ubicaciones…','location-chain-help');
   status.setAttribute('role','status');root.append(status);
   container.append(root);
   const ids={paisId:0,regionId:0,provinciaId:0,comunaId:0,ciudadId:0};
   if(ciudadId){
     try{Object.assign(ids,await api().locationPath(ciudadId));}
     catch(e){status.textContent='No se pudo recuperar la ubicación anterior: '+err(e);}
   }
   const previousKey=['paisId','regionId','provinciaId','comunaId','ciudadId'];
   let ticket=0;
   async function loadAt(index,keepInitial=false){
     const current=++ticket;
     for(let j=index;j<select.length;j++){
       select[j].replaceChildren(new Option('Seleccionar '+TITLES[j].toLowerCase()+'…',''));
       select[j].disabled=true;
     }
     for(let j=index;j<select.length;j++){
       const parent=j?Number(select[j-1].value||0):null;
       if(j && !parent)break;
       status.textContent='Cargando '+TITLES[j].toLowerCase()+'…';
       const result=await api().locations(TYPES[j],{
         ...(parent?{padreId:parent}:{}),perPage:100
       });
       if(current!==ticket)return;
       const rows=(result.data||[]).filter(x=>x.activo);
       for(const item of rows)select[j].append(new Option(item.nombre,String(item.id)));
       select[j].disabled=false;
       const old=keepInitial?Number(ids[previousKey[j]]||0):0;
       if(old && rows.some(x=>Number(x.id)===old))select[j].value=String(old);
       else if(j===0&&rows.length===1)select[j].value=String(rows[0].id);
       // Después de editar una selección intermedia, dejar dependientes vacíos.
       if(!select[j].value)break;
     }
     if(current===ticket)status.textContent='La ciudad determina automáticamente comuna, provincia, región y país.';
   }
   for(let i=0;i<select.length;i++)select[i].addEventListener('change',()=>{
     void loadAt(i+1).catch(e=>{status.textContent=err(e);});
   });
   await loadAt(0,true).catch(e=>{status.textContent=err(e);});
   return {
     root, ready:true,
     value:()=>select[4].value?Number(select[4].value):null,
     selected:tipo=>{const i=TYPES.indexOf(tipo);return i>=0&&select[i].value?Number(select[i].value):null;},
     controls:select
   };
 }

 let sequence=0;
 async function editor(tipo,record,reload){
   const edit=Boolean(record);
   const dlg=make('dialog',null,'modal crud-dialog location-editor-dialog');
   dlg.setAttribute('aria-label',(edit?'Editar ':'Crear ')+tipo);
   const shell=make('form',null,'location-editor-shell');
   const title=make('div',null,'location-editor-heading');
   title.append(make('span','RUTA H&D · UBICACIONES','overline'),
     make('h2',(edit?'Editar ':'Nueva ')+TITLES[TYPES.indexOf(tipo)]),
     make('p','La estructura respeta país, región, provincia, comuna y ciudad.'));
   title.append(button('×',()=>dlg.close(),'crud-close'));
   shell.append(title);
   const grid=make('div',null,'location-editor-grid');
   window.RutaHDListUI?.recordCode(grid,record?.id??null);
   const name=make('input');name.required=true;name.maxLength=160;name.value=record?.nombre||'';
   grid.append(labeled('Nombre *',name));
   let code=null;
   if(tipo!=='ciudades'){
     code=make('input');code.required=true;code.maxLength=tipo==='paises'?2:tipo==='regiones'?2:tipo==='provincias'?3:5;
     code.value=record?.codigo||'';code.readOnly=edit;
     grid.append(labeled(tipo==='paises'?'Código ISO2':'Código CUT',code));
   }
   let parent=null,parentFinder=null;
   if(tipo!=='paises'){
     const parentType=TYPES[TYPES.indexOf(tipo)-1];
     parent=selectable('Ubicación superior');parent.required=true;
     const wrap=make('div',null,'location-parent-lookup');
     parentFinder=make('input');parentFinder.type='search';parentFinder.maxLength=120;
     parentFinder.placeholder='Buscar '+TITLES[TYPES.indexOf(tipo)-1].toLowerCase();
     const search=button('Buscar',async()=>{
       try{
         const result=await api().locations(parentType,{
           buscar:parentFinder.value,perPage:100
         });
         parent.replaceChildren(new Option('Seleccionar ubicación superior…',''));
         for(const item of result.data||[])parent.append(new Option(
           (item.codigo?item.codigo+' · ':'')+item.nombre,String(item.id)));
         parent.disabled=false;
       }catch(e){notice.textContent=err(e);}
     });
     wrap.append(labeled('Buscar '+parentType,parentFinder),search,
       labeled('Ubicación superior *',parent));
     if(edit){
       parentFinder.value=String(record.parentId);
       parent.replaceChildren(new Option('Identificador '+record.parentId,String(record.parentId)));
       parent.value=String(record.parentId);
       parent.disabled=true;
       parentFinder.disabled=true;search.disabled=true;
     }else void search.click();
     grid.append(wrap);
   }
   let localType=null;
   if(tipo==='ciudades'){
     localType=make('select');
     for(const item of ['CIUDAD','PUEBLO','ALDEA','CASERIO',
       'CAPITAL_PROVINCIAL','CIUDAD_REFERENCIADA','REFERENCIA_COMUNAL']){
       localType.append(new Option(item.replaceAll('_',' '),item));
     }
     localType.value=record?.tipoLocalidad||'CIUDAD';
     grid.append(labeled('Clasificación de localidad',localType));
   }
   const active=make('input');active.type='checkbox';active.checked=record?.activo!==false;
   const activeLabel=make('label',null,'location-active-switch');
   activeLabel.append(active,make('span','Registro activo'));
   grid.append(activeLabel);shell.append(grid);
   const notice=make('p','','location-editor-status');notice.setAttribute('role','status');shell.append(notice);
   const actions=make('div',null,'location-editor-actions');
   const save=make('button','Guardar','button primary');save.type='submit';
   actions.append(button('Cancelar',()=>dlg.close()),save);shell.append(actions);
   shell.addEventListener('submit',async event=>{
     event.preventDefault();
     if(!shell.reportValidity())return;
     const body={nombre:name.value.trim(),activo:active.checked};
     if(code)body.codigo=code.value.trim().toUpperCase();
     if(parent)body.parentId=Number(parent.value);
     if(localType)body.tipoLocalidad=localType.value;
     save.disabled=true;notice.textContent='Guardando ubicación…';
     try{
       if(edit)await api().updateLocation(tipo,record.id,body);
       else await api().createLocation(tipo,body);
       dlg.close();await reload();
     }catch(e){notice.textContent=err(e);notice.classList.add('is-error');}
     finally{save.disabled=false;}
   });
   dlg.append(shell);document.body.append(dlg);
   dlg.addEventListener('close',()=>dlg.remove(),{once:true});
   dlg.showModal();name.focus();
 }

 function mount(host,tipo){
   if(!TYPES.includes(tipo))throw Error('Ubicación inexistente');
   const key=++sequence;
   const root=make('section',null,'surface-panel location-module');
   const heading=make('div',null,'panel-heading');
   heading.append(make('h2',TITLES[TYPES.indexOf(tipo)]+' · Ubicaciones'),
     make('p','Catálogo territorial gestionado por Administración; no modifica domicilios existentes.'));
   const info=make('p','Consultando catálogo…','catalog-footnote');
   info.setAttribute('role','status');
   const bar=make('form',null,'workspace-actions location-toolbar');
   const search=make('input');search.type='search';search.placeholder='Buscar por nombre';
   search.maxLength=120;
   const submit=make('button','Buscar','button ghost');submit.type='submit';
   const create=button('Nuevo registro',()=>editor(tipo,null,load),'button primary hd-list-create-action');
   bar.append(search,submit,create);
   const list=make('div',null,'catalog-table-scroll');
   const pager=make('nav',null,'list-pagination');
   pager.setAttribute('aria-label','Páginas de '+tipo);
   root.append(heading,info,bar,list,pager);host.replaceChildren(root);
   if(!acl()?.authenticated()||!acl()?.isAdmin()){
     info.textContent='Solo un administrador autenticado puede mantener el catálogo.';
     bar.remove();return;
   }
   let page=1,busy=false,query='';
   async function load(){
     if(busy)return;busy=true;
     info.textContent='Consultando '+tipo+'…';
     try{
       const res=await api().locations(tipo,{
         page,perPage:25,buscar:query,incluirInactivos:true
       });
       if(sequence!==key||!root.isConnected)return;
       list.replaceChildren();
       const table=make('table',null,'catalog-table location-table');
       const tr=make('tr');
       ['Código','Nombre','Ubicación superior','Estado','Acciones'].forEach(x=>tr.append(make('th',x)));
       const thead=make('thead');thead.append(tr);table.append(thead);
       const tbody=make('tbody');
       for(const row of res.data||[]){
         const item=make('tr');
         for(const value of [row.codigo||'—',row.nombre,row.parentId??'Raíz']){
           item.append(make('td',String(value)));
         }
         const state=make('td',null,'catalog-status-cell');
         const toggle=window.RutaHDListUI?.statusSwitch(row.nombre,row.activo,async desired=>{
           if(desired)await api().updateLocation(tipo,row.id,{
             nombre:row.nombre,activo:true,
             ...(row.codigo?{codigo:row.codigo}:{}),
             ...(row.parentId?{parentId:row.parentId}:{}),
             ...(row.tipoLocalidad?{tipoLocalidad:row.tipoLocalidad}:{})
           });
           else await api().deactivateLocation(tipo,row.id);
           await load();
         });
         state.append(toggle||make('span',row.activo?'Activo':'Inactivo'));
         const actions=make('td',null,'location-row-actions');
         actions.append(button('Editar',()=>editor(tipo,row,load)));
         item.append(state,actions);tbody.append(item);
       }
       table.append(tbody);list.append(table);
       info.textContent=(res.total||0)+' registros encontrados · '+TITLES[TYPES.indexOf(tipo)];
       window.RutaHDListUI?.renderPager(pager,{
         page,pages:Number(res.last_page||1),total:Number(res.total||0),
         label:'ubicaciones',onPage:n=>{page=n;void load();}
       });
       pager.hidden=Number(res.last_page||1)<=1;
     }catch(e){info.textContent=err(e);}
     finally{busy=false;}
   }
   bar.addEventListener('submit',ev=>{ev.preventDefault();query=search.value.trim();page=1;void load();});
   void load();
 }
 window.RutaHDUbicaciones=Object.freeze({mount,mountSelector,TYPES,TITLES});
})();
