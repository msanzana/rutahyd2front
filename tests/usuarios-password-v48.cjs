/* V48 · Formularios de alta/invitación con API simulada; no llama producción. */
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({locale:'es-CL',viewport:{width:1024,height:800}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="fixture"></main>');
  await page.evaluate(()=>{
    window.__payloads=[];
    window.__users=[];
    window.RutaHDAccesos={authenticated:()=>true,isAdmin:()=>true};
    window.RutaHDApiCatalogos={
      usersAll:async()=>({usuarios:window.__users,
        roles:[{id:2,codigo:'bodega',nombre:'Bodega'}]}),
      createUser:async data=>{
        window.__payloads.push({...data});
        window.__users.push({id:window.__payloads.length,nombre:data.nombre,
          correo_electronico:data.correo_electronico,perfil:'Bodega',
          rol_codigo:'bodega',rol_id:2,activo:true,ciudad_id:null});
        return {creado:true};
      },
      updateUser:async()=>({actualizado:true})
    };
  });
  await page.addScriptTag({path:path.join(__dirname,'../assets/js/usuarios.js')});
  await page.evaluate(()=>window.RutaHDUsuarios.mount(document.querySelector('#fixture')));
  await page.getByRole('button',{name:'Crear usuario'}).click();
  const modal=page.locator('dialog.users-editor-dialog[open]');
  await modal.waitFor();
  assert.equal(await modal.locator('input[type=password]').count(),2);
  assert.match(await modal.innerText(),/Contraseña inicial/);
  assert.match(await modal.innerText(),/Confirmar contraseña/);
  const inputs=modal.locator('input[type=password]');
  await inputs.nth(0).fill('Corta');
  await inputs.nth(1).fill('Corta');
  await modal.locator('input[type=text]').first().fill('Operador de prueba');
  await modal.locator('input[type=email]').fill('operador@example.invalid');
  await modal.getByRole('button',{name:'Crear usuario'}).click();
  assert.match(await modal.locator('.crud-message').innerText(),/entre 12 y 128/);
  assert.equal(await page.evaluate(()=>window.__payloads.length),0);

  await inputs.nth(0).fill('ClaveTemporalDePrueba2026!');
  await inputs.nth(1).fill('NoCoincidePrueba2026!');
  await modal.getByRole('button',{name:'Crear usuario'}).click();
  assert.match(await modal.locator('.crud-message').innerText(),/no coinciden/);
  assert.equal(await page.evaluate(()=>window.__payloads.length),0);

  await inputs.nth(1).fill('ClaveTemporalDePrueba2026!');
  await modal.getByRole('button',{name:'Crear usuario'}).click();
  await page.waitForFunction(()=>window.__payloads.length===1);
  const manual=await page.evaluate(()=>window.__payloads[0]);
  assert.equal(manual.contrasena,'ClaveTemporalDePrueba2026!');
  assert.equal(manual.contrasena_confirmation,manual.contrasena);
  assert.equal(manual.rol_id,2);
  await page.waitForFunction(()=>document.querySelectorAll('dialog.users-editor-dialog[open]').length===0);
  assert.match(await page.locator('#usersStatus').innerText(),/contraseña inicial/);

  await page.getByRole('button',{name:'Crear usuario'}).click();
  const invitation=page.locator('dialog.users-editor-dialog[open]');
  await invitation.waitFor();
  await invitation.locator('input[type=text]').first().fill('Invitado de prueba');
  await invitation.locator('input[type=email]').fill('invitado@example.invalid');
  assert.equal(await invitation.getByRole('button',{name:'Enviar invitación'}).count(),1);
  await invitation.getByRole('button',{name:'Enviar invitación'}).click();
  await page.waitForFunction(()=>window.__payloads.length===2);
  const invite=await page.evaluate(()=>window.__payloads[1]);
  assert.equal(Object.hasOwn(invite,'contrasena'),false);
  assert.equal(Object.hasOwn(invite,'contrasena_confirmation'),false);
  await page.waitForFunction(()=>document.querySelectorAll('dialog.users-editor-dialog[open]').length===0);
  assert.match(await page.locator('#usersStatus').innerText(),/Invitación enviada/);

  await page.getByRole('button',{name:'Editar'}).first().click();
  await page.locator('dialog.users-editor-dialog[open]').waitFor();
  assert.equal(await page.locator('dialog.users-editor-dialog[open] input[type=password]').count(),0,
    'Edición corriente no permite restablecer contraseña sin flujo separado');
  assert.deepEqual(errors,[]);
  console.log('V48_FRONT_OK contraseña/confirmación, creación manual, invitación SMTP y edición protegida');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
