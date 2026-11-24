(()=>{
'use strict';
const columns={
facturas:{id:'Código',folio:'Folio',proveedor:'Proveedor',documento:'Documento',fecha_documento:'Fecha',total:'Total',signo_contable:'Signo',estado:'Estado'},
recepciones:{id:'Código',estado:'Estado'},
consolidaciones:{id:'Código',estado:'Estado'},
stock:{id:'Código',sku:'SKU',producto:'Producto',bodega:'Bodega',disponible:'Disponible',transito:'Tránsito',cantidad_fisica:'Físico'},
kardex:{id:'Código',sku:'SKU',producto:'Producto',bodega:'Bodega',fecha_movimiento:'Fecha',operacion_codigo:'Operación',cantidad_documento:'Cantidad',fisico_anterior:'Anterior',fisico_actual:'Actual',costo_unitario_neto:'Costo neto'},
libro:{id:'Código',periodo_tributario:'Período',folio:'Folio',rut_emisor:'RUT',razon_social_emisor:'Proveedor',monto_neto:'Neto',monto_exento:'Exento',monto_iva_recuperable:'IVA recuperable',monto_total:'Total',signo_contable:'Signo',estado_rcv:'Conciliación'}
};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
function mount(root,key){
 const fields=columns[key];if(!fields)return;
 const panel=el('section',null,'surface-panel'), search=el('input'), form=el('form'), status=el('p'), top=el('div',null,'hd-doc-pager'), bottom=el('div',null,'hd-doc-pager');
 search.type='search';search.placeholder='Buscar registros';search.maxLength=120;search.setAttribute('aria-label','Buscar registros');
 const submit=el('button','Buscar','button primary');submit.type='submit';form.append(search,submit);
 const scroll=el('div',null,'table-scroll'), table=el('table',null,'hd-table hd-doc-table'), head=el('thead'), tr=el('tr'), body=el('tbody');
 Object.values(fields).forEach(name=>tr.append(el('th',name)));head.append(tr);table.append(head,body);scroll.append(table);
 status.setAttribute('role','status');panel.append(form,status,top,scroll,bottom);root.replaceChildren(panel);
 let page=1,seq=0;
 function pager(target,last,total){
  target.replaceChildren();target.hidden=last<=1;if(last<=1)return;
  target.append(el('span',total+' registros'));
  for(const p of [...new Set([1,page-1,page,page+1,last])].filter(p=>p>=1&&p<=last).sort((a,b)=>a-b)){
   const b=el('button',String(p),'button ghost');b.type='button';b.disabled=p===page;
   if(p===page)b.classList.add('is-current');b.addEventListener('click',()=>{page=p;void load(true);});target.append(b);
  }
 }
 async function load(up=false){
  const request=++seq;status.textContent='Cargando…';body.replaceChildren();top.replaceChildren();bottom.replaceChildren();
  try{
   const data=await window.RutaHDApiCatalogos.purchaseConsultation(key,page,search.value.trim());
   if(request!==seq||!panel.isConnected)return;
   for(const item of data.data||[]){const row=el('tr');Object.keys(fields).forEach(k=>row.append(el('td',item[k]??'—')));body.append(row);}
   if(!body.children.length){const row=el('tr'),cell=el('td','No se encontraron registros.');cell.colSpan=Object.keys(fields).length;row.append(cell);body.append(row);}
   const last=Math.max(1,Number(data.last_page||1));pager(top,last,data.total);pager(bottom,last,data.total);status.textContent=data.total+' registros';
   if(up)window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){if(request===seq&&panel.isConnected)status.textContent=e.userMessage||'No fue posible consultar los registros.';}
 }
 form.addEventListener('submit',e=>{e.preventDefault();page=1;void load(true);});void load();
}
window.RutaHDComprasConsultas=Object.freeze({mount});
})();