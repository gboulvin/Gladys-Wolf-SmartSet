# Wolf SmartSet

Supervise y controle su instalación de calefacción **Wolf** (calderas de
condensación de gas y gasóleo, bombas de calor, unidades de ventilación,
módulos solares...) desde Gladys, a través de la nube **Wolf SmartSet**.

## Antes de empezar

- Su instalación debe estar conectada a Wolf SmartSet mediante una pasarela
  Wolf (**ISM7**, **Link home**, **Link pro**...) y ser visible en el
  [portal Wolf SmartSet](https://www.wolf-smartset.com) o en la aplicación.
- Tenga a mano el usuario y la contraseña de esa cuenta. Wolf SmartSet solo
  acepta contraseñas de **30 caracteres como máximo**.
- La integración se comunica con la nube Wolf (es una integración **cloud**):
  Gladys necesita acceso a Internet, y los valores son tan recientes como los
  ofrece Wolf SmartSet.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Introduzca su **usuario** y su **contraseña** de Wolf SmartSet.
3. Elija el **idioma de los nombres de parámetros**: Wolf SmartSet traduce él
   mismo los nombres de sus parámetros (inglés, francés, alemán o español).
4. Deje el **modo experto** desactivado salvo que necesite todos los
   parámetros del regulador: desactivado, obtiene los parámetros que el portal
   Wolf muestra al usuario; activado, todos los parámetros de todos los menús
   (muchas más funciones).
5. El **intervalo de actualización** fija la frecuencia de lectura de los
   valores en la nube Wolf: cada 2 minutos por defecto, cada minuto como
   máximo. La nube Wolf es lenta y limita las peticiones, sea razonable.
6. Guarde y pulse **Probar la conexión**: el mensaje bajo el botón indica
   cuántas instalaciones se encontraron.
7. Abra la pestaña **Descubrimiento**: cada instalación Wolf aparece como un
   dispositivo, listo para añadirse.

## Qué obtiene

Cada instalación Wolf se convierte en un dispositivo de Gladys. Sus funciones
son los parámetros de la instalación, nombrados por Wolf SmartSet y asignados
según su unidad:

| Parámetro Wolf                                           | Función de Gladys          | Controlable                                |
| -------------------------------------------------------- | -------------------------- | ------------------------------------------ |
| Temperatura (°C), solo lectura                           | Sonda de temperatura       | no                                         |
| Temperatura (°C), modificable (ambiente, agua caliente…) | Consigna de termostato     | **sí**                                     |
| Presión (bar)                                            | Sensor de presión          | no                                         |
| Potencia (kW) / cantidad de calor (kWh)                  | Sensor de potencia/energía | no                                         |
| Horas de funcionamiento                                  | Duración                   | no                                         |
| Porcentaje (modulación, bomba…)                          | Valor en %                 | no                                         |
| Lista de opciones (modo, programa, estado)               | Lista de opciones          | **sí**, si es modificable en Wolf SmartSet |
| Otro (rpm, l/min, Hz, texto…)                            | Texto con su unidad        | no                                         |

La insignia del dispositivo muestra **cloud** mientras su pasarela alcanza
Wolf SmartSet, e **inaccesible** cuando la pasarela está desconectada.

Para conocer los parámetros modificables de una instalación y sus
identificadores, pulse **Listar los parámetros modificables** en la pestaña
Configuración.

## Escenas

**Disparadores**

- **Conexión de la pasarela Wolf modificada**: la pasarela de una instalación
  se ha conectado o desconectado. Filtre por instalación y estado; la escena
  recibe `{{triggerEvent.data.status}}` (`online` / `offline`).
- **Modo o estado Wolf modificado**: un parámetro con opciones (modo de
  funcionamiento, programa, estado del quemador…) tomó un nuevo valor. La
  escena recibe el nombre del parámetro, su identificador, el valor nuevo y
  el anterior. Un cambio hecho por el propio Gladys nunca lo dispara.

Los valores numéricos (temperaturas, presión…) son funciones del dispositivo:
utilice el disparador estándar «estado de un dispositivo» de Gladys para los
umbrales.

**Acciones**

- **Leer una instalación Wolf ahora**: lee todos los valores sin esperar el
  intervalo de actualización. Salidas: pasarela en línea, número de valores
  leídos.
- **Cambiar un parámetro Wolf**: escribe una consigna, un modo o cualquier
  parámetro modificable. El parámetro se indica por su nombre o su
  identificador; el valor de una lista de opciones es su etiqueta (p. ej.
  `Eco`) o su número. Salidas: el parámetro y el valor escrito.
- **Leer un parámetro Wolf**: pone un valor a disposición de las siguientes
  acciones de la escena (como texto, bruto y numérico).

## Widget del panel

El widget **Instalación Wolf** muestra las principales temperaturas y la
presión de una instalación (en directo), la conexión de la pasarela, la última
lectura y los modos actuales, con un botón **Actualizar**. Elija la
instalación en los ajustes del widget (la primera en su defecto).

## Solución de problemas

- **«Wolf SmartSet rechazó el usuario o la contraseña»**: compruébelos en el
  portal Wolf SmartSet; acorte la contraseña a 30 caracteres si es necesario.
- **Ningún dispositivo en Descubrimiento**: pulse **Probar la conexión**; la
  cuenta debe tener al menos una instalación.
- **Los valores ya no cambian, insignia «inaccesible»**: la pasarela Wolf
  perdió su conexión: compruebe su alimentación y su red.
- **Falta un parámetro**: active el **modo experto**.

Esta integración utiliza los mismos servicios web de Wolf SmartSet que el
portal Wolf; no son una API pública y pueden cambiar sin previo aviso.
