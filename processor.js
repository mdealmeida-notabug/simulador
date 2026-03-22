/**
 * processor.js
 * Algoritmos para limpieza de fondo y recorte automático.
 */

function processImageToAlphaAndCrop(imageSrc, isIce, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.error("Error de seguridad al procesar imagen local:", e);
            alert("Error: El navegador bloqueó el procesamiento de la imagen por seguridad local.\n\nPor favor, asegurate de abrir el archivo usando un servidor local (ej: Live Server de VS Code) para que la simulación automática funcione.");
            return;
        }
        const data = imageData.data;

        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];
        const bgA = data[3]; 

        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        
        const threshold = 180; 
        
        // Colores según producto
        const toastR = isIce ? 0   : 90;
        const toastG = isIce ? 0   : 45;
        const toastB = isIce ? 0   : 15;
        const toastA = isIce ? 51  : 255; // 20% de 255 es aprox 51

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

            // Calculamos luminosidad (0-255)
            // L = 0.299R + 0.587G + 0.114B
            let luminosity = 0.299 * r + 0.587 * g + 0.114 * b;

            // Procesamiento BINARIO: Sello o Transparencia (Sin matices)
            // Si es suficientemente oscuro -> Color tostado sólido
            if (luminosity < threshold && a > 10) {
                data[i] = toastR;
                data[i + 1] = toastG;
                data[i + 2] = toastB;
                data[i + 3] = toastA; 

                const x = (i / 4) % canvas.width;
                const y = Math.floor((i / 4) / canvas.width);
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            } else {
                // Si es claro o ya era transparente -> Transparente total
                data[i + 3] = 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);

        if (minX > maxX || minY > maxY) {
            callback(canvas.toDataURL('image/png'), 1); 
            return; 
        }
        
        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;
        const aspectRatio = cropHeight / cropWidth;

        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;

        cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        callback(cropCanvas.toDataURL('image/png'), aspectRatio);
    };
    img.src = imageSrc;
}

/**
 * Invierte los colores (negativo) de una imagen preservando su canal alfa.
 */
function invertImage(imageSrc, callback) {
    if (!imageSrc) return;
    
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.error("Error al invertir imagen:", e);
            return;
        }
        
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i]     = 255 - data[i];     // R
            data[i + 1] = 255 - data[i + 1]; // G
            data[i + 2] = 255 - data[i + 2]; // B
            // data[i+3] (Alpha) se mantiene igual
        }
        
        ctx.putImageData(imageData, 0, 0);
        callback(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
}
