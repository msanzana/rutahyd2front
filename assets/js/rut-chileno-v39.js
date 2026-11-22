/* Ruta H&D V39 · RUT Chileno MOD 11, misma normalización del backend Laravel.
 * Sólo valida formato y dígito verificador, NO consulta situación tributaria SII.
 */
(()=>{
  'use strict';
  function normalizar(input){
    const value=String(input??'').toUpperCase().replace(/[.\s-]/g,'').trim();
    const parts=value.match(/^([0-9]{7,8})([0-9K])$/);
    if(!parts)return null;
    const digits=parts[1],check=parts[2];
    let sum=0,factor=2;
    for(let i=digits.length-1;i>=0;i--){
      sum+=Number(digits[i])*factor;
      factor=factor===7?2:factor+1;
    }
    const rest=11-sum%11;
    const dv=rest===11?'0':rest===10?'K':String(rest);
    return check===dv?digits+'-'+dv:null;
  }
  function bind(control,{obligatorio=false}={}){
    if(!control||control.dataset.rutReady==='true')return control;
    control.dataset.rutReady='true';
    control.setAttribute('inputmode','text');
    control.autocomplete='off';
    control.placeholder='12.345.678-5';
    control.setAttribute('aria-description','RUT con dígito verificador válido');
    const info=document.createElement('small');
    info.className='hd-rut-validation';info.setAttribute('aria-live','polite');
    control.parentElement?.append(info);
    function validate(commit=false){
      const raw=control.value.trim();
      if(!raw){
        control.setCustomValidity(obligatorio?'Ingresa un RUT.':'');
        info.textContent=obligatorio?'Ingresa un RUT.':'';
        info.classList.toggle('is-error',Boolean(obligatorio));
        control.classList.remove('is-invalid');
        return !obligatorio;
      }
      const valid=normalizar(raw);
      if(!valid){
        control.setCustomValidity('El RUT no tiene un dígito verificador válido.');
        info.textContent='RUT inválido: revisa el dígito verificador.';
        info.classList.add('is-error');
        control.classList.add('is-invalid');
        return false;
      }
      if(commit)control.value=valid;
      control.setCustomValidity('');
      info.classList.remove('is-error');control.classList.remove('is-invalid');
      info.textContent='RUT válido';
      return true;
    }
    control.addEventListener('input',()=>validate(false));
    control.addEventListener('blur',()=>validate(true));
    control.addEventListener('change',()=>validate(true));
    control._rutValidate=validate;
    return control;
  }
  function validateIn(root){
    const fields=[...root.querySelectorAll('[data-rut-ready="true"]')];
    const invalid=fields.find(field=>!field._rutValidate?.(true));
    if(invalid){invalid.focus();invalid.reportValidity();return false;}
    return true;
  }
  window.RutaHDRut=Object.freeze({normalizar,validar:input=>Boolean(normalizar(input)),bind,validateIn});
})();
