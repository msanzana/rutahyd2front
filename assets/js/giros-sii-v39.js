/* Ruta H&D V39 · Buscador de giros/actividades SII, 674 códigos verificados.
 * Ventana accesible con búsqueda/paginación servida por Laravel; sólo lectura.
 */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos;
 const el=(tag,text=null,css='')=>{
   const e=document.createElement(tag);if(text!==null)e.textContent=String(text);
   if(css)e.className=css;return e;
 };
 const btn=(text,fn,css='button ghost')=>{
   const b=el('button',text,css);b.type='button';b.addEventListener('click',fn);return b;
 };
 function open({title='Seleccionar giro SII',buscar=''}={}){
   return new Promise(resolve=>{
     const dialog=el('dialog',null,'modal hd-giro-dialog');
     dialog.setAttribute('aria-label',title);
     const shell=el('div',null,'hd-lookup-shell');
     const heading=el('div',null,'hd-lookup-head');
     const copy=el('div');
     copy.append(el('h2',title),el('p','Catálogo nacional de actividades económicas (SII). Selecciona código y descripción.'));
     const close=btn('×',()=>dialog.close(),'crud-close');
     close.setAttribute('aria-label','Cerrar catálogo de giros');
     heading.append(copy,close);shell.append(heading);
     const form=el('form',null,'hd-lookup-filterbar');
     const search=el('input');search.type='search';search.maxLength=120;
     search.placeholder='Buscar por código o actividad económica';
     search.setAttribute('aria-label','Buscar código o actividad económica SII');
     search.value=buscar;
     const submit=el('button','Buscar giros','button primary');submit.type='submit';
     form.append(search,submit);shell.append(form);
     const status=el('p','Cargando actividades económicas oficiales…','hd-lookup-status');
     status.setAttribute('role','status');
     const above=el('nav',null,'list-pagination');
     const list=el('div',null,'hd-lookup-table-scroll');
     const below=el('nav',null,'list-pagination');
     const footer=el('div',null,'hd-lookup-footer');
     footer.append(el('small','Código de seis dígitos; contiene ceros iniciales cuando corresponda.'),
       btn('Cancelar',()=>dialog.close()));
     shell.append(status,above,list,below,footer);dialog.append(shell);
     document.body.append(dialog);
     let page=1,request=0,settled=false,loading=false;
     function done(value){
       if(settled)return;settled=true;resolve(value);dialog.close();
     }
     function pager(nav,last,total){
       nav.replaceChildren();
       const prev=btn('‹ Anterior',()=>{page--;void load();list.scrollTop=0;dialog.scrollTop=0;});
       prev.disabled=page<=1;
       const next=btn('Siguiente ›',()=>{page++;void load();list.scrollTop=0;dialog.scrollTop=0;});
       next.disabled=page>=last;
       nav.append(prev,el('span','Página '+page+' de '+last+' · '+total+' giros'),next);
       nav.hidden=last<=1;
     }
     async function load(){
       if(loading){request++;return;}
       const seq=++request;loading=true;status.textContent='Consultando giros SII…';
       try{
         const response=await api().girosSii({buscar:search.value.trim(),page,perPage:25});
         if(seq!==request||!dialog.open)return;
         const table=el('table',null,'hd-lookup-table');
         const header=el('tr');
         ['Acción','Código SII','Descripción / giro','Afecto IVA','Categoría']
           .forEach(v=>header.append(el('th',v)));
         const th=el('thead');th.append(header);table.append(th);
         const tbody=el('tbody');
         for(const g of response.data||[]){
           const tr=el('tr');
           const td=el('td');
           const choose=window.RutaHDListUI?.action('Seleccionar giro '+g.codigo,
             ()=>done(g),{kind:'seleccionar'})||
             btn('Seleccionar',()=>done(g));
           td.append(choose);
           tr.append(td,el('td',g.codigo),el('td',g.descripcion),
             el('td',g.afecta_iva||'—'),el('td',g.categoria_tributaria||'—'));
           tbody.append(tr);
         }
         table.append(tbody);list.replaceChildren(table);
         if(!(response.data||[]).length)list.append(el('p','No se encontraron giros.','hd-lookup-status'));
         const pages=Math.max(1,Number(response.last_page||1));
         pager(above,pages,Number(response.total||0));
         pager(below,pages,Number(response.total||0));
         status.textContent=Number(response.total||0)+' giros encontrados.';
       }catch(e){
         if(seq===request){status.textContent=e?.userMessage||e?.message||'No fue posible consultar el SII local.';status.classList.add('is-error');}
       }finally{loading=false;if(request>seq&&dialog.open)void load();}
     }
     form.addEventListener('submit',ev=>{ev.preventDefault();page=1;void load();});
     dialog.addEventListener('close',()=>{dialog.remove();if(!settled){settled=true;resolve(null);}}, {once:true});
     dialog.showModal();search.focus();void load();
   });
 }
 window.RutaHDGirosSii=Object.freeze({open});
})();
