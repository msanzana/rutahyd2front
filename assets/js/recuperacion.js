/* Recuperación real de Ruta H&D V2: ventana corporativa aislada del login.
 * Los tokens de un solo uso permanecen en memoria, no en la URL visible. */
(() => {
  'use strict';
  // InfinityFree conserva ?query durante su desafío ?i=1, pero elimina #fragment.
  // Admitir ambos formatos (correos nuevos por query y correos antiguos por hash).
  const query=new URLSearchParams(location.search).get('recuperar');
  const incoming=/^#recuperar\?token=([a-f0-9]{64})$/i.exec(location.hash);
  const valid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
  let pending=valid(query)?query.toLowerCase():incoming?.[1]?.toLowerCase()||null;
  let active=Boolean(pending), dialog=null, completed=false;
  // El secreto no debe quedar en historial, Referer, capturas o barra URL.
  // Guardarlo solo en memoria antes de eliminarlo de la dirección.
  if(pending)history.replaceState(null,'',location.pathname+'#recuperacion');
  const api=()=>window.RutaHDApiCatalogos;
  const node=(tag,cls,text)=>{
    const element=document.createElement(tag);
    if(cls)element.className=cls;
    if(text!==undefined)element.textContent=text;
    return element;
  };
  const status=(note,text,isError=false)=>{
    note.textContent=text;
    note.classList.toggle('recovery-error',isError);
    note.setAttribute('role',isError?'alert':'status');
  };
  const input=(form,labelText,type,minLength=0)=>{
    const label=node('label','field'),name=node('span',null,labelText),field=node('input');
    field.type=type;field.required=true;field.minLength=minLength;
    field.autocomplete=type==='email'?'email':'new-password';
    field.id='recovery-'+(type==='email'?'email':form.querySelector('#recovery-password')?'confirmation':'password');
    if(type==='email')field.maxLength=190;
    label.append(name,field);form.append(label);
    return field;
  };
  function finish(){
    if(dialog?.open)dialog.close();
    else done();
  }
  function done(){
    dialog?.remove();dialog=null;
    active=false;pending=null;
    if(location.hash==='#recuperacion'||/^#recuperar(?:\?|$)/i.test(location.hash))history.replaceState(null,'',location.pathname+'#inicio');
    document.body.classList.remove('is-recovering');
    document.dispatchEvent(new Event('rutahd:recuperacion-finalizada'));
  }
  function show(mode='solicitar',token=null){
    if(dialog?.open)return;
    active=true;completed=false;
    document.body.classList.add('is-recovering');
    const reset=mode==='restablecer';
    const dlg=node('dialog','modal recovery-dialog');
    dialog=dlg;
    dlg.setAttribute('aria-label',reset?'Crear nueva contraseña':'Recuperar cuenta');
    const layout=node('div','recovery-layout');
    const brand=node('aside','recovery-brand');
    brand.append(node('span','recovery-eyebrow','RUTA H&D V2 · ACCESO SEGURO'));
    const logo=node('img','recovery-logo');
    logo.src='hd-branding/logo-hd-site.png';logo.alt='Logotipo oficial H&D';
    brand.append(logo,node('h2',null,'Protegemos tu acceso.'),node('p',null,
      'Tu información comercial permanece en el servidor. Esta solicitud se procesa de forma cifrada mediante Laravel.'));
    const form=node('form','recovery-form');form.noValidate=true;
    form.append(node('div','recovery-step',reset?'PASO 2 DE 2 · NUEVA CONTRASEÑA':'PASO 1 DE 2 · VERIFICACIÓN POR CORREO'));
    form.append(node('span','recovery-eyebrow','SEGURIDAD DE LA CUENTA'),
      node('h2',null,reset?'Crear nueva contraseña':'Recuperar cuenta'),
      node('p','recovery-description',reset?
      'Escribe y confirma una nueva contraseña para recuperar el acceso a Ruta H&D V2.':
      'Indica el correo asociado a tu usuario. Te enviaremos un enlace privado para recuperar el acceso.'));
    const email=reset?null:input(form,'Correo electrónico','email');
    const password=reset?input(form,'Nueva contraseña','password',12):null;
    const confirmation=reset?input(form,'Confirmar contraseña','password',12):null;
    if(reset){
      for(const field of [password,confirmation]){
        field.parentElement.classList.add('recovery-password-field');
        const showPassword=node('button','recovery-password-toggle','Mostrar');
        showPassword.type='button';
        showPassword.setAttribute('aria-label','Mostrar u ocultar contraseña');
        showPassword.addEventListener('click',()=>{
          const visible=field.type==='text';field.type=visible?'password':'text';
          showPassword.textContent=visible?'Mostrar':'Ocultar';
        });
        field.insertAdjacentElement('afterend',showPassword);
      }
      form.append(node('p','recovery-hint','Usa al menos 12 caracteres. Tu contraseña se enviará de forma segura al servidor y no se guardará en este navegador.'));
    }
    const note=node('p','recovery-message','');
    note.id='recoveryStatus';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
    form.append(note);
    const actions=node('div','recovery-actions');
    const cancel=node('button','button ghost','Volver al inicio de sesión');
    cancel.type='button';cancel.addEventListener('click',finish);
    const send=node('button','button primary',reset?'Guardar nueva contraseña':'Enviar enlace');
    send.type='submit';send.id='recoverySubmit';
    actions.append(cancel,send);form.append(actions);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(completed)return;
      if(!form.reportValidity())return;
      if(reset&&(password.value!==confirmation.value)){
        status(note,'Las contraseñas no coinciden.',true);return;
      }
      send.disabled=true;status(note,'Comprobando el servidor…');
      try {
        api().configure(location.origin);
        if(!reset){
          await api().requestRecovery(email.value.trim());
          email.value='';
          status(note,'Si la cuenta está activa, recibirás un enlace para restablecer tu contraseña.');
        }else{
          await api().resetPassword(token,password.value,confirmation.value);
          password.value='';confirmation.value='';pending=null;completed=true;
          if(location.hash==='#recuperacion'||/^#recuperar(?:\?|$)/i.test(location.hash))history.replaceState(null,'',location.pathname+'#inicio');
          status(note,'Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
          send.hidden=true;
          cancel.textContent='Continuar al inicio de sesión';
        }
      }catch(error){
        const code=error?.status;
        status(note,code===422?
          'El enlace no es válido, ha expirado o la contraseña no cumple los requisitos. Solicita uno nuevo.':
          code===429?'Se han realizado demasiadas solicitudes. Inténtalo más tarde.':
          code===503?'El servicio de recuperación no está disponible. Inténtalo nuevamente.':
          'No fue posible completar la solicitud. Comprueba tu conexión y vuelve a intentarlo.',true);
      }finally{send.disabled=completed;}
    });
    layout.append(brand,form);dlg.append(layout);document.body.append(dlg);
    dlg.addEventListener('cancel',event=>event.preventDefault());
    dlg.addEventListener('close',done,{once:true});
    dlg.showModal();

    (email||password)?.focus();
  }
  const isActive=()=>active;
  window.RutaHDRecuperacion=Object.freeze({mostrarSolicitud:()=>show('solicitar'),
    isActive});
  document.addEventListener('DOMContentLoaded',()=>{
    if(pending)show('restablecer',pending);
  });
})();