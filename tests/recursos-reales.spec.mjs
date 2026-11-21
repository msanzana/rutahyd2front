import {test,expect} from '@playwright/test';

test('consulta paginada del backend Laravel no toca datos demo',async ({page})=>{
  const seen=[];
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    seen.push({path:p,method:req.method(),jwt:req.headers().authorization||null});
    const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(p==='/api/v1/sesion')
      return send({token:'cabecera.cuerpo.firma',token_type:'Bearer',usuario:{nombre:'Admin',rol:'administrador',permisos:['productos.gestionar','clientes.gestionar']}});
    if(req.headers().authorization!=='Bearer cabecera.cuerpo.firma')return send({},401);
    if(p.startsWith('/api/v1/catalogos/'))return send({items:[]});
    if(p==='/api/v1/recursos/clientes')return send({
      data:[{id:2,nombre:'Empresa de prueba remota',activo:1}],
      total:1,current_page:1,last_page:1,per_page:25
    });
    return send({},404);
  });
  await page.goto('/#administracion');
  await page.locator('#adminRemoto input[type=email]').fill('admin@example.cl');
  await page.locator('#adminRemoto input[type=password]').fill('prueba-sin-credencial');
  await page.locator('#adminRemoto form').first().locator('button[type=submit]').click();
  await expect(page.locator('#adminRemoto')).toContainText('Consultas reales del servidor');
  await page.locator('#adminRemoto').getByRole('button',{name:'Consultar MySQL'}).click();
  await expect(page.locator('#adminRemoto')).toContainText('Empresa de prueba remota');
  expect(seen.some(x=>x.path==='/api/v1/recursos/clientes'&&x.jwt==='Bearer cabecera.cuerpo.firma')).toBe(true);
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('rutahd2-demo-local-v1')||'{}'));
  expect(data.clientes||[]).toEqual([]);
});
