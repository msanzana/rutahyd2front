import {test,expect} from '@playwright/test';

const send=(route,payload,status=200)=>route.fulfill({
 status,contentType:'application/json',body:JSON.stringify(payload)
});
const rubros=Array.from({length:56},(_,i)=>({
 id:i+1,nombre:'Rubro '+String(i+1).padStart(3,'0'),activo:true,parentId:null
}));
const listas=Array.from({length:53},(_,i)=>({
 id:i+1,codigo:'L'+String(i+1).padStart(3,'0'),
 nombre:i===0?'LISTA BASE':'Tarifa '+String(i+1).padStart(3,'0'),
 activo:true,es_base:i===0
}));
const users=Array.from({length:52},(_,i)=>({
 id:i+1,nombre:'Persona '+String(i+1).padStart(3,'0'),
 correo_electronico:'persona'+(i+1)+'@example.invalid',
 perfil:'Vendedor',rol_id:2,rol_codigo:'vendedor',activo:true
}));
async function setup(page){
 const priceCalls=[];
 await page.route('**/api/v1/**',route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(path==='/api/v1/estado')return send(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  if(path==='/api/v1/sesion')return send(route,{
   token:'header.payload.signature',token_type:'Bearer',
   usuario:{id:1,nombre:'Administrador de prueba',rol:'administrador',
    permisos:['productos.gestionar','compras.gestionar','usuarios.gestionar']}
  });
  if(path.startsWith('/api/v1/catalogos/')){
   const key=path.split('/').at(-1);
   return send(route,{items:key==='rubros'?rubros:[]});
  }
  if(path==='/api/v1/listas-precios'){
   const per=Number(url.searchParams.get('por_pagina')||100);
   const pageNo=Number(url.searchParams.get('page')||1);
   const buscar=(url.searchParams.get('buscar')||'').toLowerCase();
   const filtered=listas.filter(x=>(x.codigo+' '+x.nombre).toLowerCase().includes(buscar));
   priceCalls.push({per,page:pageNo,buscar});
   return send(route,{data:filtered.slice((pageNo-1)*per,pageNo*per),
    total:filtered.length,last_page:Math.max(1,Math.ceil(filtered.length/per)),
    current_page:pageNo,per_page:per});
  }
  if(path==='/api/v1/usuarios')return send(route,{usuarios:users,
   roles:[{id:2,nombre:'Vendedor',codigo:'vendedor'}]});
  if(path==='/api/v1/recursos/clientes')return send(route,{data:[],last_page:1,total:0});
  if(path==='/api/v1/productos')return send(route,{data:[],total:0,last_page:1});
  if(path.startsWith('/api/v1/recursos/'))return send(route,{data:[],total:0,last_page:1});
  return send(route,{},404);
 });
 await page.goto('/#inicio');
 await page.locator('#loginEmail').fill('test@example.invalid');
 await page.locator('#loginPassword').fill('CONTRASENA-FICTICIA');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
 return priceCalls;
}
test('catálogos locales muestran máximo 25 filas y la búsqueda alcanza otras páginas',async({page})=>{
 await setup(page);
 await page.locator('#toggleProductSubnav').click();
 await page.locator('#productSubnav [data-nav="catalogos.rubros"]').click();
 const root=page.locator('#adminRemoto');
 const rows=root.locator('.catalog-table tbody tr:visible');
 await expect(rows).toHaveCount(25);
 await expect(rows.first()).toContainText('Rubro 001');
 await expect(root.locator('.list-pagination-info')).toContainText('Página 1 de 3');
 await root.locator('.list-pagination').getByRole('button',{name:'Siguiente'}).click();
 await expect(rows).toHaveCount(25);
 await expect(rows.first()).toContainText('Rubro 026');
 await root.locator('.list-pagination').getByRole('button',{name:'Siguiente'}).click();
 await expect(rows).toHaveCount(6);
 await expect(rows.last()).toContainText('Rubro 056');
 const search=root.locator('.normalized-toolbar input[type="search"]').first();
 await search.fill('Rubro 054');
 await expect(rows).toHaveCount(1);
 await expect(rows.first()).toContainText('Rubro 054');
});
test('mantenedor de listas solicita 25 registros reales por página en Laravel',async({page})=>{
 const calls=await setup(page);
 await page.locator('#toggleProductSubnav').click();
 await page.locator('#productSubnav [data-nav="listas_precios"]').click();
 const root=page.locator('#priceListsModule'),rows=root.locator('.catalog-table tbody tr:visible');
 await expect(rows).toHaveCount(25);
 await expect(root.locator('.list-pagination-info')).toContainText('Página 1 de 3');
 await root.locator('.list-pagination').getByRole('button',{name:'Siguiente'}).click();
 await expect(rows).toHaveCount(25);
 await expect(rows.first()).toContainText('Tarifa 026');
 await root.locator('.list-pagination').getByRole('button',{name:'Siguiente'}).click();
 await expect(rows).toHaveCount(3);
 await expect(rows.last()).toContainText('Tarifa 053');
 expect(calls.filter(c=>c.per===25).map(c=>c.page)).toEqual([1,2,3]);
});
test('usuarios conserva todas las cuentas con paginación local de 25',async({page})=>{
 await setup(page);
 await page.locator('#toggleAdminSubnav').click();
 await page.locator('#navUsuarios').click();
 const root=page.locator('#usersCrud'),rows=root.locator('.catalog-table tbody tr:visible');
 await expect(rows).toHaveCount(25);
 await expect(root.locator('.list-pagination-info')).toContainText('Página 1 de 3');
 await root.locator('.list-pagination').getByRole('button',{name:'Siguiente'}).click();
 await expect(rows.first()).toContainText('Persona 026');
 await root.locator('.list-pagination').getByRole('button',{name:'Siguiente'}).click();
 await expect(rows).toHaveCount(2);
 await expect(rows.last()).toContainText('Persona 052');
});
