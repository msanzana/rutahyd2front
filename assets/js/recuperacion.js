/* Recuperación de cuenta: tokens solo en memoria y fragmento URL. */
(() => {
'use strict';
const match=/^#recuperar\?token=([a-f0-9]{64})$/.exec(location.hash);
const pending=match?.[1]||null;
const api=()=>window.RutaHDApiCatalogos;
function show(mode='solicitar',token=null){
 const dlg=document.createElement('dialog');dlg.className='modal catalog-dialog';
 const form=document.createElement('form');form.noValidate=true;form.className='form-grid';
 const title=document.createElement('h2');title.textContent=mode==='solicitar'?'Recuperar cuenta':'Cambiar contraseña';form.append(title);
 const field=(labelText,type,minLength=0)=>{
  const label=document.createElement('label');label.className='field';
  const name=document.createElement('span');name.textContent=labelText;
  const input=document.createElement('input');input.type=type;input.required=true;input.minLength=minLength;
  label.append(name,input);form.append(label);return input;
 };
 const email=mode==='solicitar'?field('Correo electrónico','email'):null;
 const password=mode==='restablecer'?field('Nueva contraseña (mínimo 12 caracteres)','password',12):null;
 const confirmation=mode==='restablecer'?field('Confirmar contraseña','password',12):null;
 const note=document.createElement('p');note.className='catalog-footnote';note.setAttribute('role','status');form.append(note);
 const footer=document.createElement('div');footer.className='modal-footer';
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';cancel.className='button ghost';
 cancel.addEventListener('click',()=>dlg.close());
 const send=document.createElement('button');send.type='submit';send.className='button primary';
 send.textContent=mode==='solicitar'?'Enviar enlace':'Guardar contraseña';
 footer.append(cancel,send);form.append(footer);
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(mode==='solicitar'&&!email.validity.valid){note.textContent='Ingresa un correo válido.';return;}
  if(mode==='restablecer'&&(password.value.length<12||password.value!==confirmation.value)){
   note.textContent='Las contraseñas deben coincidir y tener al menos 12 caracteres.';return;
  }
  send.disabled=true;
  try{
   api().configure(location.origin);
   if(mode==='solicitar'){
    await api().requestRecovery(email.value.trim());email.value='';
    note.textContent='Si la cuenta existe y está activa, recibirás un enlace por correo.';
   }else{
    await api().resetPassword(token,password.value,confirmation.value);
    password.value='';confirmation.value='';
    note.textContent='Contraseña cambiada. Ahora puedes iniciar sesión.';
   }
  }catch(error){
   note.textContent=error?.status===503?'El servicio de recuperación no está configurado.':
    'No fue posible procesar la solicitud. Revisa los datos o solicita otro enlace.';
  }finally{send.disabled=false;}
 });
 dlg.append(form);document.body.append(dlg);
 dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();
}
window.RutaHDRecuperacion=Object.freeze({mostrarSolicitud:()=>show('solicitar')});
document.addEventListener('DOMContentLoaded',()=>{if(pending)show('restablecer',pending);});
})();