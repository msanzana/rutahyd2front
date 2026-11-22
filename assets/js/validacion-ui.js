/* Ruta H&D V2 · Validación accesible y corporativa de formularios
 * Mantiene las reglas HTML5 de campos, pero sustituye los bocadillos nativos
 * con un aviso en el propio diálogo y marcas de error por campo.
 */
(()=>{
 'use strict';
 const labels={
  valueMissing:'Este campo es obligatorio.',
  typeMismatch:'Ingresa un valor con el formato correcto.',
  patternMismatch:'El formato ingresado no es válido.',
  tooShort:'El contenido es demasiado corto.',
  tooLong:'Se superó la longitud permitida.',
  rangeUnderflow:'El valor es menor que el mínimo permitido.',
  rangeOverflow:'El valor supera el máximo permitido.',
  stepMismatch:'Utiliza un valor compatible con el incremento permitido.',
  badInput:'Revisa el valor ingresado.'
 };
 const formState=new WeakMap();
 let bubbleSequence=0;
 const tracked=new WeakSet();
 const owner=input=>input.closest('form')||input.closest('dialog');
 const fieldName=input=>{
  const label=input.labels?.[0]?.querySelector('span')?.textContent?.trim()
   ||input.closest('label')?.querySelector('span')?.textContent?.trim()
   ||(input.id?document.querySelector('label[for="'+CSS.escape(input.id)+'"]')?.textContent?.trim():'')
   ||input.getAttribute('aria-label')||input.name||'Campo obligatorio';
  return label.replace(/\s*\*\s*$/,'').trim();
 };
 const errorFor=input=>{
  const v=input.validity;
  if(v?.customError&&input.validationMessage)return input.validationMessage;
  const key=Object.keys(labels).find(k=>v?.[k]);
  return labels[key]||'Revisa el contenido de este campo.';
 };
 function ensureSummary(form){
  let summary=form.querySelector(':scope > .hd-validation-summary');
  if(summary)return summary;
  summary=document.createElement('div');
  summary.className='hd-validation-summary';
  summary.setAttribute('role','alert');
  summary.setAttribute('aria-live','assertive');
  summary.setAttribute('tabindex','-1');
  summary.hidden=true;
  const heading=document.createElement('strong');heading.className='hd-validation-title';
  heading.textContent='Revisa los datos del formulario';
  const body=document.createElement('p');body.className='hd-validation-detail';
  summary.append(heading,body);
  const footer=form.querySelector('.crud-footer,.modal-footer,.product-editor-actions,.official-editor-actions,.supplier-dialog-actions');
  if(footer&&footer.parentElement===form)form.insertBefore(summary,footer);
  else form.prepend(summary);
  return summary;
 }
 function ensureFieldBubble(input,message){
  const container=input.closest('.field,.crud-field,.supplier-field,.official-editor-field')
   ||input.parentElement;
  if(!container)return;
  let bubble=[...container.children].find(node=>node.classList?.contains('hd-validation-bubble'));
  if(!bubble){
   bubble=document.createElement('span');
   bubble.className='hd-validation-bubble';
   bubble.id='hd-validation-bubble-'+(++bubbleSequence);
   bubble.setAttribute('role','alert');
   bubble.setAttribute('aria-live','polite');
   container.append(bubble);
  }
  bubble.textContent=message;
  bubble.hidden=false;
  const ids=new Set((input.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));
  ids.add(bubble.id);
  input.setAttribute('aria-describedby',[...ids].join(' '));
 }
 function clearFieldBubble(input){
  const container=input.closest('.field,.crud-field,.supplier-field,.official-editor-field')
   ||input.parentElement;
  const bubble=[...((container?.children)||[])].find(node=>node.classList?.contains('hd-validation-bubble'));
  if(!bubble)return;
  bubble.hidden=true;
  bubble.textContent='';
  const described=(input.getAttribute('aria-describedby')||'').split(/\s+/)
   .filter(id=>id&&id!==bubble.id);
  if(described.length)input.setAttribute('aria-describedby',described.join(' '));
  else input.removeAttribute('aria-describedby');
 }
 function show(input){
  const form=owner(input);if(!form)return;
  const summary=ensureSummary(form);
  const message=fieldName(input)+': '+errorFor(input);
  const detail=summary.querySelector('.hd-validation-detail');
  if(detail.textContent!==message)detail.textContent=message;
  summary.hidden=false;
  input.classList.add('hd-field-invalid');
  input.setAttribute('aria-invalid','true');
  ensureFieldBubble(input,errorFor(input));
  input.closest('.field,.crud-field,.supplier-field')?.classList.add('hd-field-error');
  const state=formState.get(form)||{first:null};
  if(!state.first||!state.first.isConnected||state.first.validity?.valid)state.first=input;
  formState.set(form,state);
  if(!tracked.has(input)){
   tracked.add(input);
   const clear=()=>{
    // Al modificar un campo con error personalizado, hay que levantar primero
    // setCustomValidity; si no, validity.valid sigue falso y el aviso nunca desaparece.
    if(input.validity?.customError)input.setCustomValidity('');
    if(!input.validity?.valid)return;
    input.classList.remove('hd-field-invalid');
    input.removeAttribute('aria-invalid');
    clearFieldBubble(input);
    input.closest('.field,.crud-field,.supplier-field')?.classList.remove('hd-field-error');
    if(!form.querySelector('.hd-field-invalid')){
      summary.hidden=true;formState.delete(form);
    }
   };
   input.addEventListener('input',clear);
   input.addEventListener('change',clear);
  }
  // El navegador no muestra su tooltip; mantenemos validación nativa real.
  queueMicrotask(()=>{
   if(!form.isConnected)return;
   const first=formState.get(form)?.first;
   if(first===input){
    const dialog=first.closest('dialog');
    if(dialog?.open)first.scrollIntoView({block:'nearest',behavior:'instant'});
    first.focus({preventScroll:true});
   }
  });
 }
 document.addEventListener('invalid',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement||input instanceof HTMLSelectElement||input instanceof HTMLTextAreaElement))return;
  // Incluso login y recuperación: suprimir tooltip nativo, respetar validación HTML5.
  event.preventDefault();
  show(input);
 },true);
 // Exponer un punto controlado para errores adicionales del backend, sin HTML no confiable.
 window.RutaHDValidacion=Object.freeze({
  mostrar:(control,mensaje)=>{
   if(!control)return;
   control.setCustomValidity(mensaje||'Valor inválido');
   control.reportValidity();
   const clear=()=>{control.setCustomValidity('');control.removeEventListener('input',clear);};
   control.addEventListener('input',clear,{once:true});
  }
 });
})();