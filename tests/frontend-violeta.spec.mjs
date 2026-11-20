import { test, expect } from '@playwright/test';

async function addCatalog(page,key,name,parent=false){
  await page.locator('.catalog-tab[data-catalog="'+key+'"]').click();
  await page.locator('[data-catalog-action="new"][data-catalog="'+key+'"]').click();
  await page.locator('#catalogName').fill(name);
  if(parent)await page.locator('#catalogParent').selectOption({index:1});
  await page.locator('#catalogForm [type="submit"]').click();
  await expect(page.locator('#catalogFormDialog')).not.toBeVisible();
  await expect(page.locator('.catalog-table')).toContainText(name);
}

async function setupTaxonomy(page){
  await page.locator('.nav-link[data-nav="administracion"]').click();
  await addCatalog(page,'rubros','Alimentos');
  await addCatalog(page,'departamentos','Abarrotes',true);
  await addCatalog(page,'familias','Conservas',true);
  await addCatalog(page,'lineas','Vegetales',true);
  await addCatalog(page,'marcas','H&D');
  await addCatalog(page,'modelos','Clásico',true);
  await addCatalog(page,'tipos_unidad','Unidad');
  await addCatalog(page,'gramajes','500');
  await addCatalog(page,'tipos_envasado','Lata');
}

async function chooseProductCatalogs(page){
  for(const key of ['rubroId','departamentoId','familiaId','lineaId','marcaId','modeloId','tipoUnidadId','gramajeId','tipoEnvasadoId']) {
    await page.locator('#field-'+key).selectOption({index:1});
  }
  await page.locator('#field-condicionTributariaId').selectOption({label:'Exento'});
}

test('carga interfaz violeta, identidad H&D y sin cifras inventadas', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Ruta H&D2/);
  await expect(page.getByRole('heading',{name:'Tu operación, en un solo lugar.'})).toBeVisible();
  await expect(page.locator('.brand-logo')).toHaveJSProperty('complete',true);
  expect(await page.locator('.brand-logo').evaluate(el=>el.naturalWidth)).toBeGreaterThan(50);
  expect(await page.locator('#statOrders').textContent()).toBe('0');
  expect(await page.locator('#statClients').textContent()).toBe('0');
  expect(await page.locator('#statProducts').textContent()).toBe('0');
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--v700').trim())).toBe('#6d28d9');
});

test('crea, edita y elimina cliente con confirmación', async ({page}) => {
  await page.goto('/');
  await page.locator('[data-nav="clientes"].nav-link').click();
  await expect(page.getByRole('heading',{name:'Clientes',exact:true})).toBeVisible();
  await page.locator('#newButton').click();
  await expect(page.getByRole('heading',{name:'Nuevo cliente'})).toBeVisible();
  await page.locator('#field-nombre').fill('Cliente de prueba');
  await page.locator('#field-rut').fill('11.111.111-1');
  await page.locator('#field-telefono').fill('+56912345678');
  await page.locator('#field-email').fill('prueba@example.cl');
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('.data-table')).toContainText('Cliente de prueba');
  await expect(page.locator('.toast.success').first()).toBeVisible();
  await page.reload();
  await page.locator('[data-nav="clientes"].nav-link').click();
  await expect(page.locator('.data-table')).toContainText('Cliente de prueba');
  await page.getByRole('button',{name:/Editar Cliente de prueba/}).click();
  await page.locator('#field-nombre').fill('Cliente actualizado');
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('.data-table')).toContainText('Cliente actualizado');
  await page.getByRole('button',{name:/Eliminar Cliente actualizado/}).click();
  await expect(page.getByRole('heading',{name:'¿Eliminar este cliente?'})).toBeVisible();
  await page.locator('#confirmCancel').click();
  await expect(page.locator('.data-table')).toContainText('Cliente actualizado');
  await page.getByRole('button',{name:/Eliminar Cliente actualizado/}).click();
  await page.locator('#confirmAccept').click();
  await expect(page.getByText('Todavía no hay registros')).toBeVisible();
});

test('configura catálogos jerárquicos y clasifica producto con impuestos', async ({page}) => {
  await page.goto('/#productos');
  await page.locator('#newButton').click();
  await expect(page.getByRole('heading',{name:'Administración',exact:true})).toBeVisible();
  await expect(page.locator('.toast.warning').first()).toContainText('Completa los catálogos');
  await setupTaxonomy(page);
  await page.locator('.nav-link[data-nav="productos"]').click();
  await page.locator('#newButton').click();
  await expect(page.locator('#field-departamentoId')).toBeDisabled();
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('#formError')).toContainText('Completa el campo');
  await page.locator('#field-codigo').fill('A-100');
  await page.locator('#field-nombre').fill('Producto de prueba');
  await chooseProductCatalogs(page);
  await page.locator('#field-precio').fill('950');
  await page.locator('#field-stock').fill('2');
  await page.locator('#field-minimo').fill('5');
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('.data-table')).toContainText('Producto de prueba');
  await expect(page.locator('.data-table')).toContainText('Vegetales');
  await expect(page.locator('.data-table')).toContainText('Exento');
  await page.reload();
  await expect(page.locator('.data-table')).toContainText('Producto de prueba');
  await page.getByRole('button',{name:/Editar Producto de prueba/}).click();
  await expect(page.locator('#field-rubroId')).toHaveValue(/cat-/);
  await expect(page.locator('#field-modeloId')).toHaveValue(/cat-/);
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('#formDialog')).not.toBeVisible();

  await page.locator('#newButton').click();
  await page.locator('#field-codigo').fill('A-100');
  await page.locator('#field-nombre').fill('Duplicado');
  await chooseProductCatalogs(page);
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('#formError')).toContainText('Ya existe');
});

test('CRUD de rubros y protección ante catálogos referenciados', async ({page}) => {
  await page.goto('/#administracion');
  await addCatalog(page,'rubros','Ferretería');
  await page.locator('.catalog-small-button[data-catalog-action="edit"]').click();
  await page.locator('#catalogName').fill('Ferretería general');
  await page.locator('#catalogForm [type="submit"]').click();
  await expect(page.locator('.catalog-table')).toContainText('Ferretería general');
  await page.locator('.catalog-small-button[data-catalog-action="delete"]').click();
  await expect(page.locator('#catalogDeleteDialog')).toBeVisible();
  await page.locator('#catalogDeleteCancel').click();
  await expect(page.locator('.catalog-table')).toContainText('Ferretería general');
  await page.locator('.catalog-small-button[data-catalog-action="delete"]').click();
  await page.locator('#catalogDeleteAccept').click();
  await expect(page.locator('.catalog-empty')).toBeVisible();

  await setupTaxonomy(page);
  await page.locator('.catalog-tab[data-catalog="rubros"]').click();
  await page.locator('.catalog-small-button[data-catalog-action="delete"]').click();
  await expect(page.locator('.toast.warning').first()).toContainText('Registro en uso');
  await expect(page.locator('.catalog-table')).toContainText('Alimentos');
});

test('dependencias de familia y modelo filtradas por su padre', async ({page}) => {
  await page.goto('/#administracion');
  await addCatalog(page,'rubros','Primer rubro');
  await addCatalog(page,'rubros','Segundo rubro');
  await addCatalog(page,'departamentos','Depto primero',true);
  await page.locator('.catalog-tab[data-catalog="departamentos"]').click();
  await page.locator('[data-catalog-action="new"][data-catalog="departamentos"]').click();
  await page.locator('#catalogName').fill('Depto segundo');
  await page.locator('#catalogParent').selectOption({index:2});
  await page.locator('#catalogForm [type="submit"]').click();
  await page.locator('.catalog-tab[data-catalog="marcas"]').click();
  await addCatalog(page,'marcas','Marca Uno');
  await addCatalog(page,'marcas','Marca Dos');
  await addCatalog(page,'modelos','Modelo Uno',true);
  await page.locator('.catalog-tab[data-catalog="rubros"]').click();
  await expect(page.locator('.catalog-table')).toContainText('Primer rubro');
  await page.reload();
  await page.locator('.nav-link[data-nav="administracion"]').click();
  await page.locator('.catalog-tab[data-catalog="departamentos"]').click();
  await expect(page.locator('.catalog-table')).toContainText('Depto primero');
  await expect(page.locator('.catalog-table')).toContainText('Depto segundo');
});

test('genera informes y CSV a partir de datos reales del navegador', async ({page}) => {
  await page.goto('/#clientes');
  await page.locator('#newButton').click();
  await page.locator('#field-nombre').fill('Distribuidora Ejemplo');
  await page.locator('#field-rut').fill('12.345.678-9');
  await page.locator('#recordForm [type="submit"]').click();
  await page.locator('[data-nav="informes"].nav-link').click();
  await expect(page.getByRole('heading',{name:'Informes'})).toBeVisible();
  const downloadEvent=page.waitForEvent('download');
  await page.locator('[data-action="export"][data-kind="clientes"]').click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^rutahd2-clientes-.*\.csv$/);
  await expect(page.locator('.toast.success').first()).toBeVisible();
});

test('muestra detalles, avisos e información de uso', async ({page}) => {
  await page.goto('/');
  await page.locator('#notificationButton').click();
  await expect(page.locator('#infoDialog')).toBeVisible();
  await page.locator('#infoClose').click();
  await page.locator('[data-action="about"]').click();
  await expect(page.locator('#infoDescription')).toContainText('no está activado');
});

test('es adaptable a pantallas móviles, sin desplazamiento horizontal', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#menuToggle')).toBeVisible();
  await page.locator('#menuToggle').click();
  await page.locator('.sidebar [data-nav="pedidos"]').click();
  await expect(page.getByRole('heading',{name:'Pedidos',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
  await page.screenshot({path:'artifacts/rutahd2-panel-movil.png',fullPage:true});
});

test('captura dashboard profesional en escritorio', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await expect(page.locator('.module-card')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
  await page.screenshot({path:'artifacts/rutahd2-panel-escritorio.png',fullPage:true});
});
