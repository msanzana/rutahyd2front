import {test,expect} from '@playwright/test';

test('menú principal preservado y catálogos agrupados con Usuarios',async({page})=>{
  await page.goto('/#inicio');
  const padres=await page.locator('.sidebar .nav > .nav-link, .sidebar .nav > .nav-group')
    .evaluateAll(elements=>elements.map(x=>x.dataset.nav||x.querySelector('.nav-link')?.dataset.nav));
  expect(padres).toEqual(['administracion','compras','ventas','proveedores','clientes','productos','bodega','cuentas_corrientes']);
  await expect(page.locator('#productSubnav [data-catalog-key]')).toHaveCount(10);
  await expect(page.locator('#adminSubnav [data-admin-catalog]')).toHaveCount(10);
  await expect(page.locator('#navUsuarios')).toHaveCount(1);
  await page.locator('#toggleAdminSubnav').click();
  await expect(page.locator('#adminSubnav')).toBeVisible();
  await expect(page.locator('#productSubnav')).toBeHidden();
});

test('solicitud de recuperación sin exponer correo en URL',async({page})=>{
  let posted=null;
  await page.route('**/api/v1/recuperacion/solicitar',async route=>{
    posted=route.request().postDataJSON();
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({mensaje:'Si la cuenta existe recibirás instrucciones'})});
  });
  await page.goto('/#administracion');
  await page.getByRole('button',{name:'¿Olvidaste tu contraseña?'}).click();
  const dialog=page.getByRole('dialog').filter({hasText:'Recuperar cuenta'});
  await dialog.locator('input[type="email"]').fill('ci@example.invalid');
  await dialog.getByRole('button',{name:'Enviar enlace'}).click();
  await expect.poll(()=>posted?.correo_electronico).toBe('ci@example.invalid');
  await expect(dialog).toContainText('recibirás un enlace');
  expect(page.url()).not.toContain('ci@example.invalid');
});
