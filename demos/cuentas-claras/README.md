# Cuentas Claras

App para Android de **gastos compartidos sin cuentas**. Anotás quién pagó qué en un viaje, una casa o una salida, y te dice quién le paga a quién, con la menor cantidad de transferencias posible.

**[▶ Probarla](https://bygastin.github.io/Bygastin/demos/cuentas-claras/)** · En Android, desde Chrome: menú ⋮ → *Instalar app*.

## Cómo funciona

- **Sin registrarse:** el grupo entero viaja dentro de un link (comprimido en el `#`, que nunca llega a ningún servidor). Se comparte por WhatsApp o con un QR.
- **Sin pisarse:** si dos personas anotan gastos en celus distintos, al abrir el link del otro se combinan. Cada gasto tiene su propio id y, si se editó en los dos lados, gana la versión más nueva. Los borrados se marcan, no se eliminan, para que no "revivan" al combinar.
- **Sin perder centavos:** los montos se guardan en centavos enteros, y el resto de un reparto desigual se asigna de a un centavo.
- **Saldos:** el que más debe le paga al que más le deben, hasta que todos quedan a mano.
- **Sin internet:** un service worker guarda la app en el celu.
- **Segura:** todo lo que llega por un link se valida antes de usarse, y la pantalla se arma con nodos del DOM, sin `innerHTML`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `logic.js` | La lógica pura: saldos, reparto, combinar copias, validar y armar el link |
| `app.js` | La pantalla |
| `style.css` | Estilos con modo claro y oscuro |
| `sw.js`, `manifest.webmanifest` | Para instalarla y usarla sin internet |
| `vendor/qrcode.js` | Generador de QR de Kazuhiko Arase (licencia MIT) |

## Pruebas

```
node --test demos/cuentas-claras/test/*.test.js
```
