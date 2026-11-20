import {test,expect} from '@playwright/test';

/**
 * Prueba REAL de navegador -> API Laravel HTTP -> MySQL 8 EFÍMERO GitHub.
 * Únicamente datos de CI; nunca apuntar a InfinityFree.
 */
test.skip(!process.env.RUN_REAL_MYSQL_E2E, 'Solo se ejecuta dentro de CI de integración MySQL efímera');
const endpoint='http://127.0.0.1:8000';
const base=process.env.CI_REAL_API_URL||endpoint;
if (process.env.CI_REAL_API_URL && !/^http:\/\/127\.0\.0\.1:8000\/?$/.test(base)) {
  throw new Error('No se permite ejecutar esta prueba contra un servidor remoto');
}
async function session(page,email,password){
  await page.goto('/#administracion');
  const panel=page.locator('#adminRemoto');
  await panel.locator('input[type="url"]').fill(base);
  await panel.locator('input[type="email"]').fill(email);
  await panel.locator('input[type="password"]').fill(password);
  await panel.getByRole('button',{name:'Conectar a API'}).click();
  await expect(panel).toContainText('Catálogos cargados desde la API autenticada');
}

test('navegador real conecta frontend, Laravel, MySQL y respeta los padres del menú',async({page})=>{
  await session(page,'integracion@ejemplo.invalid','ClaveCI!soloParaPruebas-2026');

  // Los siete padres V2 deben conservar su posición relativa.
  const padres=await page.locator('.sidebar .nav > [data-nav],.sidebar .nav > .nav-group')
    .evaluateAll(items=>items.map(item=>item.dataset.nav || item.querySelector('[data-nav]')?.dataset.nav));
  expect(padres.filter(Boolean).slice(0,7)).toEqual([
    'inicio','pedidos','clientes','productos','inventario','informes','administracion'
  ]);

  await page.locator('#toggleProductSubnav').click();
  await page.locator('#productSubnav [data-nav="catalogos.rubros"]').click();
  const panel=page.locator('#adminRemoto');
  await expect(panel).toContainText('Alimentos');

  // CRUD REAL con borrado de un registro únicamente temporal.
  await panel.getByRole('button',{name:'Nuevo registro de Rubros'}).click();
  await page.locator('dialog[open] input').fill('E2E-SOLO-CI-BORRAR');
  await page.locator('dialog[open] button[type="submit"]').click();
  await expect(panel).toContainText('E2E-SOLO-CI-BORRAR');

  const rows=panel.locator('tbody tr');
  const row=rows.filter({hasText:'E2E-SOLO-CI-BORRAR'});
  await row.getByRole('button',{name:'Eliminar'}).click();
  await page.locator('dialog[open] button[type="submit"]').click();
  await expect(row).toHaveCount(0);

  // Matriz REAL de permisos para perfil Vendedor (sin manipular Administrador).
  await page.locator('#navPerfiles').click();
  const profile=page.locator('#rolesCatalogos');
  await expect(profile).toBeVisible();
  await profile.locator('#selectorPerfil').selectOption({index:2});
  const rubro=profile.locator('[data-modulo="rubros"]');
  await rubro.getByRole('checkbox',{name:'Ver Rubros'}).check();
  await rubro.getByRole('checkbox',{name:'Gestionar Rubros'}).uncheck();
  await profile.getByRole('button',{name:'Guardar permisos del perfil'}).click();
  await expect(profile.locator('#rolesStatus')).toContainText('Permisos cargados');

  // Cierre y nuevo login real del usuario del rol vendedor.
  await page.locator('.nav-link[data-nav="administracion"]').click();
  await page.locator('#adminRemoto').getByRole('button',{name:'Cerrar sesión remota'}).click();
  await session(page,'lector@ejemplo.invalid','NoUsarEnProduccion-2026');
  await page.locator('#toggleProductSubnav').click();
  await expect(page.locator('[data-catalog-key="rubros"]')).toBeVisible();
  await expect(page.locator('[data-catalog-key="marcas"]')).toBeHidden();
  await expect(page.locator('#navPerfiles')).toBeHidden();
  await page.locator('[data-nav="catalogos.rubros"]').click();
  await expect(page.locator('#adminRemoto').getByRole('button',{name:'Nuevo registro de Rubros'})).toBeDisabled();

  // El servidor (no solo el menú) rechaza mutaciones sin permiso.
  const status=await page.evaluate(async()=>{
    try{
      await window.RutaHDApiCatalogos.create('rubros',{nombre:'INTRUSO-CI',activo:true,parentId:null});
      return 'NO_BLOCK';
    }catch(e){return e.status;}
  });
  expect(status).toBe(403);
  await expect(page.locator('.sidebar .nav-link[data-nav="pedidos"]')).toBeVisible();
  await expect(page.locator('.sidebar .nav-link[data-nav="inventario"]')).toBeVisible();
});
