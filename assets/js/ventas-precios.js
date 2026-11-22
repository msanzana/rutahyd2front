/* Ruta H&D V2 · Venta con precio efectivo exclusivo del cliente.
   Toda cotización y confirmación se valida nuevamente en Laravel. */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos;
 const el=(tag,text,cls)=>{
  const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;
 };
 const control=(label,type='text')=>{
  const wrap=el('label',undefined,'field');
  const span=el('span',label);const input=el(type==='select'?'select':'input');
  if(type!=='select')input.type=type;
  wrap.append(span,input);return {wrap,input};
 };
 const option=(select,id,name)=>{const o=el('option',name);o.value=String(id);select.append(o);};
 const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(Number(value)||0);
 let sequence=0;
 function mount(parent){
  const current=++sequence;
  window.RutaHDOficial?.mount(parent,'ventas');
  const root=el('section',undefined,'surface-panel sale-price-module');
  root.id='salePriceModule';
  const header=el('div',undefined,'panel-heading');
  header.append(el('h2','Nueva venta por lista de precios'),el('span','Tarifa asignada en Clientes','official-source'));
  const hint=el('p','Selecciona un cliente y un producto. La lista especial reemplaza la Lista Base. Nunca se sustituye por el precio general si falta un producto en la lista especial.','catalog-footnote');
  const form=el('form',undefined,'sale-price-form');
  const grid=el('div',undefined,'sale-price-fields');
  const client=control('Cliente','select'),product=control('Producto','select'),qty=control('Cantidad','number');
  const typeDte=control('Tipo de documento','select'),document=control('Documento receptor'),name=control('Nombre receptor');
  const address=control('Dirección del receptor (factura)'),date=control('Fecha emisión','date');
  client.input.required=true;product.input.required=true;
  // Cantidad se valida al agregar una línea, no al finalizar la venta.
  qty.input.required=false;qty.input.min='0.001';qty.input.step='0.001';
  document.input.required=true;name.input.required=true;date.input.required=true;
  date.input.value=new Date().toISOString().slice(0,10);
  option(client.input,'','Selecciona un cliente');option(product.input,'','Selecciona un producto');
  option(typeDte.input,'39','Boleta (39)');option(typeDte.input,'33','Factura (33)');
  grid.append(client.wrap,product.wrap,qty.wrap,typeDte.wrap,document.wrap,name.wrap,address.wrap,date.wrap);
  const priceInfo=el('p','Selecciona cliente y producto para consultar el precio.','sale-effective-price');
  priceInfo.setAttribute('role','status');
  const addLine=el('button','Agregar producto a la venta','button ghost');addLine.type='button';addLine.disabled=true;
  const cartArea=el('div',undefined,'sale-lines-list');
  const note=el('p','', 'form-error');note.hidden=true;note.setAttribute('role','alert');
  const actions=el('div',undefined,'sale-price-actions');
  const save=el('button','Registrar venta','button primary');save.type='submit';save.disabled=true;
  const canSell=window.RutaHDAccesos?.isAdmin?.() ||
    window.RutaHDAccesos?.has?.('ventas.gestionar');
  if(!canSell){
    save.hidden=true;
    hint.textContent+=' Tu perfil solo puede consultar precios; no registrar ventas.';
  }
  actions.append(addLine,save);
  form.append(grid,priceInfo,cartArea,note,actions);root.append(header,hint,form);
  parent.prepend(root);
  let loadedClients=[],loadedProducts=[],selection=null,items=[],busy=false,version=0;
  async function init(){
   try{
    const [c,p]=await Promise.all([api().resources('clientes',1,'',100),api().products(1,'',{activo:'1'})]);
    if(current!==sequence||!root.isConnected)return;
    loadedClients=c.data||[];loadedProducts=p.data||[];
    loadedClients.filter(x=>x.activo).forEach(x=>option(client.input,x.id,
      x.nombre+(x.codigo?' · '+x.codigo:'')));
    loadedProducts.filter(x=>x.activo).forEach(x=>option(product.input,x.id,
      x.nombre+(x.sku?' · '+x.sku:'')));
    if(!loadedClients.length||!loadedProducts.length){
      priceInfo.textContent='Registra clientes y productos activos antes de crear una venta.';
    }
   }catch(e){priceInfo.textContent='No se pudieron cargar clientes o productos de Laravel.';}
  }
  function redrawCart(){
   cartArea.replaceChildren();
   if(!items.length){cartArea.append(el('p','Todavía no hay productos en esta venta.','catalog-footnote'));}
   else{
    const table=el('table',undefined,'catalog-table sale-cart-table');
    const h=el('tr');['Producto','Lista aplicada','Cantidad','Precio neto','Subtotal','Acciones']
      .forEach(x=>h.append(el('th',x)));
    const th=el('thead');th.append(h);table.append(th);
    const tb=el('tbody');
    items.forEach((it,i)=>{
      const tr=el('tr');
      tr.append(el('td',it.nombre),el('td',it.lista),el('td',it.cantidad),
        el('td',money(it.precio)),el('td',money(it.precio*it.cantidad)));
      const td=el('td');
      const rm=el('button','Quitar','button ghost');rm.type='button';
      rm.addEventListener('click',()=>{items.splice(i,1);redrawCart();});
      td.append(rm);tr.append(td);tb.append(tr);
    });
    table.append(tb);cartArea.append(table);
    const net=items.reduce((n,it)=>n+it.precio*it.cantidad,0);
    cartArea.append(el('p','Total neto estimado: '+money(net)+'. IVA según condición tributaria; Laravel recalculará el total.','sale-cart-total'));
   }
   save.disabled=!canSell||!items.length||busy;
  }
  async function showPrice(){
   const ticket=++version;selection=null;addLine.disabled=true;
   const clienteId=Number(client.input.value),productoId=Number(product.input.value);
   if(!clienteId||!productoId){
    priceInfo.textContent='Selecciona cliente y producto para consultar el precio.';return;
   }
   priceInfo.textContent='Consultando tarifa vigente…';
   try{
    const data=await api().customerSalePrice(clienteId,productoId);
    if(ticket!==version||current!==sequence)return;
    selection=data;
    priceInfo.textContent='Lista aplicada: '+data.lista_precio_nombre+
      ' · Precio neto de venta: '+money(data.precio_venta)+'.';
    addLine.disabled=false;
   }catch(e){
    if(ticket!==version)return;
    priceInfo.textContent='El producto no tiene precio activo en la lista asignada al cliente. Revisa su tarifa en Productos.';
   }
  }
  client.input.addEventListener('change',()=>{
   const selected=loadedClients.find(x=>String(x.id)===client.input.value);
   document.input.value=selected?.rut||'';
   name.input.value=selected?.nombre||'';
   address.input.value=selected?.direccion||'';
   // No mezclar productos cotizados con la tarifa de otro cliente.
   items=[];redrawCart();void showPrice();
  });
  product.input.addEventListener('change',()=>void showPrice());
  typeDte.input.addEventListener('change',()=>{
   address.input.required=typeDte.input.value==='33';
  });
  addLine.addEventListener('click',()=>{
   if(!selection||selection.cliente_id!==Number(client.input.value)||selection.producto_id!==Number(product.input.value))return;
   const count=Number(qty.input.value),price=Number(selection.precio_venta);
   if(!Number.isFinite(count)||count<=0||!Number.isFinite(price)||price<0)return;
   const p=loadedProducts.find(x=>Number(x.id)===selection.producto_id);
   items.push({id:selection.producto_id,nombre:p?.nombre||'Producto',cantidad:count,
     precio:price,lista:selection.lista_precio_nombre,
     exento:Number(p?.presentacion?.tasaIva??19)===0});
   redrawCart();qty.input.value='';
  });
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!items.length||!form.reportValidity())return;
   busy=true;save.disabled=true;note.hidden=true;
   const payload={
    cliente_id:Number(client.input.value),
    tipo_dte:Number(typeDte.input.value),
    fecha_emision:date.input.value,
    documento_receptor:document.input.value.trim(),
    nombre_receptor:name.input.value.trim(),
    direccion_receptor:address.input.value.trim()||null,
    detalles:items.map(it=>({
      producto_id:it.id,cantidad:it.cantidad,
      precio_unitario:it.precio,exento_impuestos:it.exento
    }))
   };
   try{
    const sale=await api().createSale(payload);
    items=[];redrawCart();
    note.hidden=false;note.classList.remove('is-error');
    note.textContent='Venta registrada correctamente: '+sale.numero_venta+
      '. El DTE no se ha enviado automáticamente al SII.';
    await showPrice();
   }catch(e){
    note.hidden=false;note.classList.add('is-error');
    note.textContent='No fue posible registrar la venta. Verifica que cada precio siga vigente y que los datos tributarios estén completos.';
   }finally{busy=false;save.disabled=!items.length;}
  });
  redrawCart();void init();
 }
 window.RutaHDVentasPrecios=Object.freeze({mount});
})();