import {test,expect} from '@playwright/test';

const catalogos={
  rubros:[{id:1,nombre:'Alimentos',activo:true,parentId:null}],
  departamentos:[{id:2,nombre:'Abarrotes',activo:true,parentId:1}],
  familias:[{id:3,nombre:'Conservas',activo:true,parentId:2}],
  lineas:[{id:4,nombre:'Vegetales',activo:true,parentId:3}],
  marcas:[{id:5,nombre:'H&D',activo:true,parentId:null}],
  modelos:[{id:6,nombre:'Tradicional',activo:true,parentId:5}],
  tipos_unidad:[{id:7,nombre:'Unidad',activo:true,parentId:null}],
  gramajes:[{id:8,nombre:'500.000',activo:true,parentId:null}],
  tipos_envasado:[{id:9,nombre:'Lata',activo:true,parentId:null}],
  condiciones_tributarias:[{id:10,nombre:'Exento',activo:true,parentId:null}]
};

test('menú oficial y CRUD real de productos con todas las clasificaciones',async({page})=>{
  let product=null,creates=0,updates=0,deletes=0;
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    const respond=(obj,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
    if(path==='/api/v1/sesion')return respond({
      token:'cabecera.cuerpo.firma',token_type:'Bearer',
      usuario:{nombre:'Admin CI',rol:'administrador',permisos:['productos.gestionar']}
    });
    if(req.headers().authorization!=='Bearer cabecera.cuerpo.firma')return respond({},401);
    if(path.startsWith('/api/v1/catalogos/')){
      const key=path.split('/')[4];
      return respond({items:catalogos[key]||[]});
    }
    if(path==='/api/v1/productos'&&req.method()==='GET'){
      const rows=product?[product]:[];
      return respond({data:rows,total:rows.length,last_page:1,current_page:1});
    }
    if(path==='/api/v1/productos'&&req.method()==='POST'){
      const p=req.postDataJSON();creates++;
      product={...p,id:101,sku:p.sku,nombre:p.nombre,descripcion:p.descripcion,
        clasificacion:p.clasificacion,activo:true,
        presentacion:{...p.presentacion,id:111,tasaIva:'0.00'}};
      return respond(product,201);
    }
    if(path==='/api/v1/productos/101'&&req.method()==='GET')
      return respond({...product,stock:'0',totalPresentaciones:1});
    if(path==='/api/v1/productos/101'&&req.method()==='PUT'){
      const p=req.postDataJSON();updates++;
      product={...product,...p,presentacion:{...p.presentacion,id:111,tasaIva:'0.00'}};
      return respond(product);
    }
    if(path==='/api/v1/productos/101'&&req.method()==='DELETE'){
      deletes++;product.activo=false;
      return respond({id:101,activo:false,eliminacion:'logica'});
    }
    return respond({},404);
  });

  await page.goto('/#administracion');
  const top=await page.locator('.sidebar .nav > [data-nav],.sidebar .nav > .nav-group').evaluateAll(
    xs=>xs.map(x=>x.dataset.nav||x.querySelector('[data-nav]')?.dataset.nav)
  );
  expect(top).toEqual(['inicio','pedidos','clientes','productos','inventario','informes','administracion']);
  await page.locator('#toggleAdminSubnav').click();
  await expect(page.locator('[data-admin-catalog="rubros"]')).toBeVisible();
  await page.locator('[data-admin-catalog="marcas"]').click();
  await expect(page.locator('#workspaceTitle')).toContainText('Marcas');

  await page.locator('.nav-link[data-nav="administracion"]').click();
  await page.locator('#adminRemoto input[type=email]').fill('admin@example.invalid');
  await page.locator('#adminRemoto input[type=password]').fill('simulado-no-real');
  await page.locator('#adminRemoto button[type=submit]').first().click();
  await expect(page.locator('#adminRemoto')).toContainText('Catálogos cargados');

  await page.locator('.nav-link[data-nav="productos"]').click();
  await expect(page.locator('#productosReales')).toBeVisible();
  await page.getByRole('button',{name:'Nuevo producto real'}).click();
  const modal=page.locator('dialog[open]');
  await expect(modal.locator('select')).toHaveCount(10);
  await modal.locator('input[type=text]').first().fill('SKU-FULLSTACK-TEST');
  await modal.locator('input[type=text]').nth(1).fill('Producto de integración');
  for(const [key,rows] of Object.entries(catalogos)){
    const index=Object.keys(catalogos).indexOf(key);
    await modal.locator('select').nth(index).selectOption(String(rows[0].id));
  }
  await modal.locator('input[type=number]').last().fill('1250');
  await modal.getByRole('button',{name:'Guardar en MySQL'}).click();
  await expect(page.locator('#productosRealesListado')).toContainText('SKU-FULLSTACK-TEST');
  expect(creates).toBe(1);

  await page.locator('#productosRealesListado').getByRole('button',{name:'Editar'}).click();
  await page.locator('dialog[open] input[type=text]').nth(1).fill('Producto modificado');
  await page.locator('dialog[open]').getByRole('button',{name:'Guardar en MySQL'}).click();
  await expect(page.locator('#productosRealesListado')).toContainText('Producto modificado');
  expect(updates).toBe(1);

  await page.locator('#productosRealesListado').getByRole('button',{name:'Desactivar'}).click();
  await page.locator('dialog[open]').getByRole('button',{name:'Confirmar desactivación'}).click();
  await expect(page.locator('#productosRealesListado')).toContainText('Inactivo');
  expect(deletes).toBe(1);
  const local=await page.evaluate(()=>localStorage.getItem('rutahd2-demo-local-v1'));
  expect(local===null||JSON.parse(local).productos.length===0).toBeTruthy();
});
