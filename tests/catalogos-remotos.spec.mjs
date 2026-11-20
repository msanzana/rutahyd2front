import {test, expect} from '@playwright/test';

test('administración remota pide login y mantiene demo local independiente', async ({page})=>{
  await page.goto('/#administracion');
  await expect(page.locator('#adminRemoto')).toContainText('Administración MySQL');
  await expect(page.locator('#catalogAdmin')).toHaveCount(0);
  await page.locator('#toggleProductSubnav').click();
  await page.locator('[data-nav="catalogos.rubros"]').click();
  await expect(page.locator('#catalogAdmin')).toBeVisible();
  await page.locator('.nav-link[data-nav="administracion"]').click();
  await expect(page.locator('#adminRemoto input[type="password"]')).toBeVisible();
  await expect(page.locator('#adminRemoto')).not.toContainText('Guardar clasificación en MySQL');
});

test('sesión remota, catálogos CRUD y clasificación con API simulada', async ({page})=>{
  const requests=[];
  const catalogs={
    rubros:[{id:1,nombre:'Alimentos',activo:true,parentId:null}],
    departamentos:[{id:2,nombre:'Abarrotes',activo:true,parentId:1}],
    familias:[{id:3,nombre:'Conservas',activo:true,parentId:2}],
    lineas:[{id:4,nombre:'Verduras',activo:true,parentId:3}],
    marcas:[{id:5,nombre:'H&D',activo:true,parentId:null}],
    modelos:[{id:6,nombre:'Clásico',activo:true,parentId:5}],
    tipos_unidad:[{id:7,nombre:'Unidad',activo:true,parentId:null}],
    gramajes:[{id:8,nombre:'500.000',activo:true,parentId:null}],
    tipos_envasado:[{id:9,nombre:'Lata',activo:true,parentId:null}],
    condiciones_tributarias:[{id:10,nombre:'Exento',activo:true,parentId:null}]
  };
  await page.route('https://api.example.cl/api/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    requests.push({path,method:request.method(),authorization:request.headers().authorization||null});
    if(path==='/api/v1/sesion'){
      return route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({token:'a'.repeat(64),usuario:{nombre:'Administrador',rol:'administrador',permisos:['productos.gestionar']}})});
    }
    if(request.headers().authorization!=='Bearer '+'a'.repeat(64))
      return route.fulfill({status:401,body:'{}'});
    const match=path.match(/^\/api\/v1\/catalogos\/([a-z_]+)(?:\/(\d+))?$/);
    if(match){
      const [,key,id]=match,rows=catalogs[key];
      if(!rows)return route.fulfill({status:404,body:'{}'});
      if(request.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:rows})});
      if(request.method()==='POST'){
        const data=request.postDataJSON();
        const created={...data,id:11};rows.push(created);
        return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify(created)});
      }
      if(request.method()==='DELETE'){
        catalogs[key]=rows.filter(r=>String(r.id)!==id);
        return route.fulfill({status:204,body:''});
      }
      if(request.method()==='PUT'){
        const found=rows.find(r=>String(r.id)===id);
        if(!found)return route.fulfill({status:404,body:'{}'});
        Object.assign(found,request.postDataJSON());
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(found)});
      }
    }
    if(path==='/api/v1/productos/123/clasificacion'){
      const response=request.method()==='GET'
        ? {id:123,sku:'SKU-123',nombre:'Producto existente',clasificacion:{}}
        : {id:123};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    }
    return route.fulfill({status:404,body:'{}'});
  });
  await page.goto('/#administracion');
  await page.locator('#adminRemoto input[type="url"]').fill('https://api.example.cl');
  await page.locator('#adminRemoto input[type="email"]').fill('admin@example.cl');
  await page.locator('#adminRemoto input[type="password"]').fill('simulada-no-real');
  await page.locator('#adminRemoto button[type="submit"]').click();
  await expect(page.locator('#adminRemoto')).toContainText('Alimentos');
  await expect(page.locator('#adminRemoto')).toContainText('Guardar clasificación en MySQL');

  await page.locator('#adminRemoto').getByRole('button',{name:'Nuevo registro de Rubros'}).click();
  await page.locator('dialog[open] input').fill('Ferretería');
  await page.locator('dialog[open] button[type="submit"]').click();
  await expect(page.locator('#adminRemoto')).toContainText('Ferretería');

  const form=page.locator('#adminRemoto form').last();
  await form.locator('input[type="number"]').fill('123');
  await form.getByRole('button',{name:'Consultar producto en MySQL'}).click();
  await expect(form).toContainText('Producto existente');
  for(const key of ['rubroId','departamentoId','familiaId','lineaId','marcaId','modeloId',
                    'tipoUnidadId','gramajeId','tipoEnvasadoId','condicionTributariaId']){
    await form.locator('select[data-field="'+key+'"]').selectOption({index:1});
  }
  await form.locator('input[type="checkbox"]').check();
  await form.getByRole('button',{name:'Guardar clasificación en MySQL'}).click();
  await expect(page.locator('#remoteStatus')).toContainText('Clasificación guardada');
  expect(requests.some(x=>x.path==='/api/v1/productos/123/clasificacion'&&x.method==='PATCH')).toBeTruthy();
  expect(requests.filter(x=>x.path.includes('/catalogos/')).every(x=>x.authorization==='Bearer '+'a'.repeat(64))).toBeTruthy();
  await page.locator('#adminRemoto').getByRole('button',{name:'Cerrar sesión remota'}).click();
  await expect(page.locator('#adminRemoto input[type="password"]')).toBeVisible();
});
