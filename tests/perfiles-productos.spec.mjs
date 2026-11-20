import {test,expect} from '@playwright/test';

const CATALOGS=[
  'rubros','departamentos','familias','lineas','marcas','modelos',
  'tipos_unidad','gramajes','tipos_envasado','condiciones_tributarias'
];
function permisos(rubro) { return ['productos.catalogos.'+rubro+'.ver']; }
async function stubApi(page,role,permissions,callbacks={}) {
  await page.route('https://api.example.cl/api/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    const respond=(value,status=200)=>route.fulfill({
      status, contentType:'application/json',body:JSON.stringify(value)
    });
    if(path==='/api/v1/sesion')return respond({
      token:'a'.repeat(64),
      usuario:{id:2,nombre:'Usuario de prueba',rol:role,permisos:permissions}
    });
    if(req.headers().authorization!=='Bearer '+'a'.repeat(64))
      return respond({error:'Token inválido'},401);
    if(path==='/api/v1/perfiles/usuarios'){
      return respond({usuarios:[
        {id:1,nombre:'Administrador',correo_electronico:'admin@example.cl',perfil:'Administrador',rol_id:1,activo:1},
        {id:22,nombre:'Vendedor de prueba',correo_electronico:'vendedor@example.cl',perfil:'Vendedor',rol_id:2,activo:1}
      ]});
    }
    if(path==='/api/v1/perfiles/usuarios/22/rol'&&req.method()==='PUT'){
      callbacks.assignment=req.postDataJSON();return respond({actualizado:true,usuario_id:22});
    }
    if(path==='/api/v1/perfiles/catalogos'){
      const values={};
      CATALOGS.forEach(k=>values[k]={ver:false,gestionar:false});
      values.rubros={ver:true,gestionar:false};
      return respond({catalogos:Object.fromEntries(CATALOGS.map(k=>[k,k])),
        roles:[{id:1,nombre:'Administrador',codigo:'administrador',editable:false,
                 modulos:Object.fromEntries(CATALOGS.map(k=>[k,{ver:true,gestionar:true}]))},
               {id:2,nombre:'Vendedor',codigo:'vendedor',editable:true,modulos:values}]});
    }
    if(path==='/api/v1/perfiles/2/catalogos'&&req.method()==='PUT'){
      callbacks.saved=req.postDataJSON();
      return respond({guardado:true,rol_id:2});
    }
    const catalog=path.match(/^\/api\/v1\/catalogos\/([a-z_]+)$/);
    if(catalog && req.method()==='GET') return respond({items:[]});
    return respond({error:'No existe'},404);
  });
}
async function login(page) {
  await page.goto('/#administracion');
  await page.locator('#adminRemoto input[type="url"]').fill('https://api.example.cl');
  await page.locator('#adminRemoto input[type="email"]').fill('prueba@example.cl');
  await page.locator('#adminRemoto input[type="password"]').fill('sin-credenciales-reales');
  await page.locator('#adminRemoto button[type="submit"]').click();
}

test('Productos anida diez subítems y navega sin duplicarlos en Administración',async({page})=>{
  await page.goto('/');
  const all=page.locator('[data-catalog-key]');
  await expect(all).toHaveCount(10);
  await page.locator('#toggleProductSubnav').click();
  await expect(page.locator('#productSubnav')).toBeVisible();
  await page.locator('[data-nav="catalogos.marcas"]').click();
  await expect(page.locator('#workspaceTitle')).toHaveText('Marcas');
  await expect(page.locator('#catalogAdmin')).toBeVisible();
  await expect(page.locator('#catalogAdmin .catalog-sidebar')).not.toBeVisible();
  await page.locator('[data-nav="administracion"]').click();
  await expect(page.locator('#catalogAdmin')).toHaveCount(0);
});

test('perfil con Rubros solo lectura oculta módulos y bloquea CRUD aunque se use URL',async({page})=>{
  await stubApi(page,'vendedor',permisos('rubros'));
  await login(page);
  await expect(page.locator('#adminRemoto')).toContainText('Catálogos cargados');
  await expect(page.locator('[data-catalog-key="rubros"]')).toBeVisible();
  await expect(page.locator('[data-catalog-key="marcas"]')).toBeHidden();
  await expect(page.locator('#navPerfiles')).toBeHidden();
  await page.locator('[data-nav="catalogos.rubros"]').click();
  await expect(page.locator('#workspaceTitle')).toHaveText('Rubros');
  await expect(page.locator('#catalogAdmin [data-catalog-action="new"]')).toBeDisabled();
  await expect(page.locator('#adminRemoto').getByRole('button',{name:'Nuevo registro de Rubros'})).toBeDisabled();
  await page.evaluate(()=>{location.hash='#catalogos.marcas';});
  await expect(page.locator('#breadcrumbCurrent')).toHaveText('Inicio');
  await expect(page.locator('#workspaceView')).toBeHidden();
});

test('administrador gestiona permiso Ver y Gestionar de cada rol',async({page})=>{
  const state={};
  await stubApi(page,'administrador',['productos.gestionar','usuarios.gestionar'],state);
  await login(page);
  await expect(page.locator('#navPerfiles')).toBeVisible();
  await page.locator('#navPerfiles').click();
  await expect(page.locator('#rolesCatalogos')).toBeVisible();
  await page.locator('#selectorPerfil').selectOption('2');
  const row=page.locator('[data-modulo="marcas"]');
  await row.getByRole('checkbox',{name:'Ver Marcas'}).check();
  await row.getByRole('checkbox',{name:'Gestionar Marcas'}).check();
  await expect(row.getByRole('checkbox',{name:'Ver Marcas'})).toBeChecked();
  await page.locator('#rolesForm button[type="submit"]').click();
  await expect.poll(()=>state.saved?.modulos?.marcas?.gestionar).toBe(true);
  expect(state.saved.modulos.marcas.ver).toBe(true);
  await expect(page.locator('#usersProfiles')).toContainText('Vendedor de prueba');
  const user=page.locator('#usersProfiles tbody tr').filter({hasText:'Vendedor de prueba'});
  await user.locator('select').selectOption('2');
  await user.getByRole('button',{name:'Asignar'}).click();
  await expect.poll(()=>state.assignment?.rol_id).toBe(2);
});
