# Demostración desde el teléfono

Panel público: https://qr-generator-three-opal.vercel.app

La clave privada del panel está en `C:\Users\Usuario\Desktop\QR\.demo-access.txt`.
Los visitantes que escanean un QR no necesitan esa clave.

## Demostrar que el destino cambia sin cambiar el QR
1. Abre `QR-demostracion.png` en el PC y escanéalo con el teléfono, o imprime la imagen.
2. Abre la página de destino B. El QR contiene permanentemente:
   https://qr-generator-three-opal.vercel.app/r/demo-dinamico
3. Abre el panel público, introduce la clave y localiza «Demostración QR dinámico».
4. Pulsa «Cambiar OneDrive» y pega:
   https://qr-generator-three-opal.vercel.app/demo/destino-a.html
5. Guarda y vuelve a escanear la misma imagen: abrirá «Destino A».
6. Puedes volver al destino B:
   https://qr-generator-three-opal.vercel.app/demo/destino-b.html

No se modifica ni se reimprime el QR al cambiar el destino. La página A/B es solo una demostración ficticia; para instalaciones reales utiliza la carpeta OneDrive/SharePoint que corresponda.

## Tu QR aa-1k1r
Imagen: QR-aa-1k1r.png.
URL: https://qr-generator-three-opal.vercel.app/r/aa-1k1r

Redirige al destino SharePoint existente. Microsoft puede pedir la cuenta autorizada para acceder a la carpeta: esos permisos son independientes del QR.

La demo está alojada en Vercel y no requiere la misma Wi-Fi ni que el PC permanezca encendido. Los QR antiguos que contienen localhost deben regenerarse una vez con la dirección pública. Para las impresiones definitivas conviene usar un dominio estable bajo tu control.

## Comprobaciones realizadas
- API de gestión sin clave: HTTP 401.
- Mismo /r/demo-dinamico: HTTP 302 hacia A y después HTTP 302 hacia B.
- Páginas A y B: HTTP 200.
- /r/aa-1k1r: HTTP 302 a su destino SharePoint existente.
