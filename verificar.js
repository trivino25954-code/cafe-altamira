#!/usr/bin/env node
/*
 * Verificador · HTML semántico y accesibilidad · Café Altamira
 * Uso: node verificar.js      (desde la carpeta cafe-altamira)
 * Revisa index.html y css/estilos.css. No necesita instalar nada.
 * Total: 40 pts (ejemplos 4 · globales 4 · G1 8 · G2 8 · G3 8 · G4 8).
 * El reto (eventos.html) NO lo revisa este script: ver RETO.md.
 */
const fs = require('fs');
const path = require('path');

const C = { v: '\x1b[32m', r: '\x1b[31m', a: '\x1b[33m', g: '\x1b[90m', n: '\x1b[1m', x: '\x1b[0m' };
const leer = (f) => { try { return fs.readFileSync(path.join(__dirname, f), 'utf8'); } catch { return ''; } };

const htmlCrudo = leer('index.html');
const html = htmlCrudo.replace(/<!--[\s\S]*?-->/g, ''); // sin comentarios
const css = leer('css/estilos.css').replace(/\/\*[\s\S]*?\*\//g, '');

let puntos = 0;
let maximo = 0;
const partes = {};
function check(parte, desc, valor, ok, pista) {
  maximo += valor;
  partes[parte] = partes[parte] || { p: 0, m: 0 };
  partes[parte].m += valor;
  if (ok) { puntos += valor; partes[parte].p += valor; }
  const marca = ok ? `${C.v}✔${C.x}` : `${C.r}✘${C.x}`;
  console.log(`  ${marca} ${desc} ${C.g}(${ok ? '+' + valor : '0/' + valor})${C.x}${!ok && pista ? `\n      ${C.a}→ ${pista}${C.x}` : ''}`);
}
const titulo = (t) => console.log(`\n${C.n}${t}${C.x}`);

// ---------- utilidades de HTML (sin dependencias) ----------
const attr = (tag, nombre) => {
  const m = tag.match(new RegExp(`\\s${nombre}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
};
const tieneAttr = (tag, nombre) => new RegExp(`\\s${nombre}(\\s|=|>|/)`, 'i').test(tag);
const etiquetas = (src, nombre) => [...src.matchAll(new RegExp(`<${nombre}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
function bloque(src, nombre, filtro) {
  // devuelve el contenido del primer <nombre ...> que cumpla el filtro (soporta anidación simple)
  const re = new RegExp(`<${nombre}\\b[^>]*>`, 'gi');
  let m;
  while ((m = re.exec(src))) {
    if (filtro && !filtro(m[0])) continue;
    let nivel = 1;
    const re2 = new RegExp(`<\\/?${nombre}\\b[^>]*>`, 'gi');
    re2.lastIndex = m.index + m[0].length;
    let n;
    while ((n = re2.exec(src))) {
      nivel += n[0][1] === '/' ? -1 : 1;
      if (nivel === 0) return { apertura: m[0], interior: src.slice(m.index + m[0].length, n.index) };
    }
  }
  return null;
}
const texto = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const body = (bloque(html, 'body') || { interior: '' }).interior;

// ---------- utilidades de CSS ----------
const reglas = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), dec: m[2] }));
const variables = {};
reglas.filter((r) => r.sel === ':root').forEach((r) => [...r.dec.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].forEach((m) => { variables[m[1]] = m[2].trim(); }));
const resolver = (v) => { const m = v && v.match(/var\((--[\w-]+)\)/); return m ? resolver(variables[m[1]]) : v; };
function luminancia(hex) {
  let h = (hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)]; if (x === null || y === null) return 0; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ================================================================
titulo('Ejemplos resueltos (no los dañes)');
const header = bloque(body, 'header');
check('Ejemplos', 'E1 · <header> con <nav aria-label> y enlaces en <ul>', 2,
  !!header && /<nav\b[^>]*aria-label=/i.test(header.interior) && /<ul\b[\s\S]*<a\b/i.test(header.interior));
const historia = bloque(body, 'section', (t) => attr(t, 'id') === 'historia');
check('Ejemplos', 'E2 · <section aria-labelledby> con <figure> y <figcaption>', 2,
  !!historia && tieneAttr(historia.apertura, 'aria-labelledby') && /<figure[\s\S]*<figcaption/i.test(historia.interior));

// ================================================================
titulo('Revisiones globales');
check('Globales', 'La página declara lang="es"', 1, /<html[^>]*\slang=["']es/i.test(html));
check('Globales', 'Tiene un <title> con texto', 1, /<title>\s*\S[\s\S]*?<\/title>/i.test(html));
const imgs = etiquetas(body, 'img');
const sinAlt = imgs.filter((t) => !tieneAttr(t, 'alt'));
check('Globales', `Todas las imágenes tienen atributo alt (${imgs.length - sinAlt.length}/${imgs.length})`, 1, sinAlt.length === 0,
  sinAlt.length ? `sin alt: ${sinAlt.map((t) => attr(t, 'src')).join(', ')}` : '');
const niveles = [...body.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
const saltos = [];
niveles.forEach((n, i) => { if (i === 0 ? n !== 1 : n > niveles[i - 1] + 1) saltos.push(`${i === 0 ? 'inicio' : 'h' + niveles[i - 1]} → h${n}`); });
check('Globales', `Encabezados en orden sin saltar niveles (${niveles.map((n) => 'h' + n).join(' ') || 'ninguno'})`, 1,
  niveles.length > 0 && saltos.length === 0, saltos.length ? `saltos: ${saltos.join(', ')}` : 'la página debe empezar con un h1');

// ================================================================
titulo('G1 · Estructura principal y teclado');
const primerFoco = body.match(/<(a|button|input|select|textarea)\b[^>]*>/i);
check('G1', 'El primer elemento enfocable es <a class="saltar" href="#contenido">', 2,
  !!primerFoco && /^<a\b/i.test(primerFoco[0]) && attr(primerFoco[0], 'href') === '#contenido' && /saltar/.test(attr(primerFoco[0], 'class') || ''),
  'ponlo justo después de <body>');
const main = bloque(body, 'main');
check('G1', '<main id="contenido"> reemplaza al div.contenido', 2,
  !!main && attr(main.apertura, 'id') === 'contenido' && !/class=["']contenido["']/.test(body));
const h1s = etiquetas(body, 'h1');
const hero = bloque(body, 'div', (t) => /hero/.test(attr(t, 'class') || '')) || bloque(body, 'section', (t) => /hero/.test(attr(t, 'class') || ''));
check('G1', `Un único <h1> y está en la portada (hay ${h1s.length})`, 2, h1s.length === 1 && !!hero && /<h1\b/i.test(hero.interior));
const ocultaFoco = reglas.some((r) => /:focus(?!-visible)/.test(r.sel) && !/\.saltar/.test(r.sel) && /outline\s*:\s*(none|0)\s*(;|$)/i.test(r.dec));
const focoVisible = reglas.some((r) => /:focus-visible/.test(r.sel) && /outline\s*:\s*\d/i.test(r.dec));
check('G1', 'El foco se ve: sin outline: none y con una regla :focus-visible', 2, !ocultaFoco && focoVisible,
  ocultaFoco ? 'aún existe una regla :focus con outline: none' : 'agrega :focus-visible { outline: 3px solid ...; }');

// ================================================================
titulo('G2 · Catálogo');
const cafes = bloque(body, 'section', (t) => attr(t, 'id') === 'cafes');
check('G2', '<section id="cafes"> con un <h2>', 2, !!cafes && /<h2\b/i.test(cafes.interior));
const zona = cafes ? cafes.interior : '';
const articulos = [...zona.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]);
check('G2', `3 o más <article>, cada uno con su <h3> (hay ${articulos.length})`, 2,
  articulos.length >= 3 && articulos.every((a) => /<h3\b/i.test(a)) && !/class=["']nombre["']/.test(body));
const imgsCat = etiquetas(zona, 'img');
const altMalos = imgsCat.filter((t) => { const a = attr(t, 'alt') || ''; return a.trim().length < 10 || /\.(svg|png|jpe?g|webp)$/i.test(a) || /^(imagen|foto|img)/i.test(a.trim()); });
check('G2', 'Cada imagen del catálogo tiene un alt descriptivo', 2, imgsCat.length >= 3 && altMalos.length === 0,
  'describe lo que se ve: "Bolsa de café Altamira Clásico de 500 gramos"');
const precio = reglas.filter((r) => r.sel.split(',').map((s) => s.trim()).includes('.precio')).map((r) => (r.dec.match(/(^|;)\s*color\s*:\s*([^;]+)/) || [])[2]).filter(Boolean).pop();
const ratio = contraste(resolver(precio), '#ffffff');
check('G2', `Contraste del precio ≥ 4.5:1 (actual ${ratio ? ratio.toFixed(2) : '?'}:1)`, 2, ratio >= 4.5,
  'usa un color en hexadecimal o una variable de :root');

// ================================================================
titulo('G3 · Formulario de suscripción');
const sus = bloque(body, 'section', (t) => attr(t, 'id') === 'suscripcion');
const form = sus ? bloque(sus.interior, 'form') : null;
check('G3', '<section id="suscripcion"> con <h2> y un <form>', 2, !!sus && /<h2\b/i.test(sus.interior) && !!form);
const fz = form ? form.interior : '';
const correo = etiquetas(fz, 'input').find((t) => (attr(t, 'type') || '').toLowerCase() === 'email');
const idCorreo = correo ? attr(correo, 'id') : null;
check('G3', 'El correo tiene <label for> asociado a su id', 2,
  !!idCorreo && new RegExp(`<label\\b[^>]*for=["']${idCorreo}["']`, 'i').test(fz),
  'el for del label y el id del input deben ser iguales');
check('G3', 'El campo es type="email" y required', 2, !!correo && tieneAttr(correo, 'required'));
const boton = etiquetas(fz, 'button').find((t) => (attr(t, 'type') || 'submit') === 'submit');
check('G3', 'Envía con <button type="submit"> (sin div con onclick)', 2, !!boton && !/<div[^>]*onclick/i.test(body));

// ================================================================
titulo('G4 · Pie de página');
const footer = bloque(body, 'footer');
check('G4', '<footer> reemplaza al div.pie', 2, !!footer && !/<div[^>]*class=["']pie["']/i.test(body));
const fz2 = footer ? footer.interior : '';
check('G4', 'Dirección y teléfono dentro de <address>', 2, /<address\b[\s\S]*?(carrera|calle)[\s\S]*?<\/address>/i.test(fz2));
const tabla = bloque(fz2, 'table');
check('G4', 'Horario en <table> con <caption>', 2, !!tabla && /<caption\b[^>]*>\s*\S/i.test(tabla.interior));
const ths = tabla ? etiquetas(tabla.interior, 'th').filter((t) => /^(col|row)$/.test(attr(t, 'scope') || '')) : [];
check('G4', `Encabezados de la tabla con <th scope> (hay ${ths.length})`, 2, ths.length >= 2);

// ================================================================
console.log(`\n${C.n}Resumen${C.x}`);
Object.entries(partes).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${String(v.p).padStart(2)} / ${v.m}`));
console.log(`\n${C.n}Puntaje: ${puntos} / ${maximo}${C.x}`);
console.log(puntos === maximo
  ? `${C.v}¡Todo en verde! Sigue con el reto (RETO.md) y pasa Lighthouse.${C.x}\n`
  : `${C.g}Corrige los ✘ en orden: G1 → G2 → G3 → G4.${C.x}\n`);
