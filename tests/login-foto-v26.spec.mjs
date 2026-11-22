import {test,expect} from '@playwright/test';

/** Imagen realista del reparto, original y embebida; no usa credenciales reales. */
for (const width of [1440,820,390]) {
  test('login fotográfico corporativo y accesible '+width,async({page})=>{
    await page.setViewportSize({width,height:850});
    await page.route('**/api/v1/estado',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'disponible'})
    }));
    await page.goto('/#inicio');
    const dialog=page.locator('#loginDialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading',{name:'Iniciar sesión'})).toBeVisible();
    await expect(dialog.locator('.login-identity img')).toBeVisible();
    await expect(dialog.locator('#loginEmail')).toBeVisible();
    await expect(dialog.locator('#loginPassword')).toBeVisible();
    const visual=await page.evaluate(async()=>{
      const form=document.querySelector('#loginDialog .login-form');
      const style=getComputedStyle(form,'::before');
      const match=style.backgroundImage.match(/data:image\\/webp;base64,([A-Za-z0-9+/=]+)/);
      if(!match) return {missing:true,background:style.backgroundImage.slice(0,80)};
      const img=new Image();
      img.src='data:image/webp;base64,'+match[1];
      try {await img.decode();} catch(e){return {decodeError:String(e),encoded:match[1].length};}
      const rect=form.getBoundingClientRect();
      return {
        encoded:match[1].length,
        naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,
        visible:style.display!=='none',
        left:rect.left,right:rect.right,
        overflow:form.scrollWidth>form.clientWidth+2,
        columns:getComputedStyle(form).gridTemplateColumns.split(' ').length
      };
    });
    expect(visual.missing,JSON.stringify(visual)).toBeFalsy();
    expect(visual.decodeError,JSON.stringify(visual)).toBeUndefined();
    expect(visual.encoded).toBe(8980);
    expect(visual.naturalWidth).toBe(280);
    expect(visual.naturalHeight).toBe(373);
    expect(visual.visible).toBe(true);
    expect(visual.left).toBeGreaterThanOrEqual(0);
    expect(visual.right).toBeLessThanOrEqual(width+1);
    expect(visual.overflow).toBe(false);
    expect(visual.columns).toBe(width<=760?1:2);
  });
}
