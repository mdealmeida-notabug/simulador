/**
 * exporter.js
 * Generación de imágenes compuestas y exportación a PDF.
 */

const exporter = {
    /**
     * Crea un canvas con el pan y el logo superpuesto con el mismo efecto que en pantalla.
     */
    generateCompositeCanvas(breadImg, logoImg, previewArea) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Usamos las dimensiones naturales del pan para máxima calidad
        canvas.width = breadImg.naturalWidth;
        canvas.height = breadImg.naturalHeight;

        // 1. Dibujar el pan
        ctx.drawImage(breadImg, 0, 0, canvas.width, canvas.height);

        // 2. Calcular posición y tamaño del logo
        // El logo en el HTML tiene posición en % respecto al previewArea
        const rect = previewArea.getBoundingClientRect();
        const logoRect = logoImg.getBoundingClientRect();

        // Posición relativa en %
        const leftPct = parseFloat(logoImg.style.left) / 100;
        const topPct = parseFloat(logoImg.style.top) / 100;
        const widthPct = parseFloat(logoImg.style.width) / 100;

        // Convertir a píxeles del canvas (que es el tamaño natural del pan)
        const logoWidth = canvas.width * widthPct;
        const logoHeight = logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth);
        
        const logoX = (canvas.width * leftPct) - (logoWidth / 2);
        const logoY = (canvas.height * topPct) - (logoHeight / 2);

        // 3. Aplicar efecto multiply
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.90; // Igual que en CSS
        
        // 4. Dibujar logo con rotación si existe
        const rotationDegrees = typeof simulator !== 'undefined' ? simulator.currentRotation : 0;
        
        ctx.save();
        // Mover el origen al centro del logo
        ctx.translate(canvas.width * leftPct, canvas.height * topPct);
        // Rotar
        ctx.rotate((rotationDegrees * Math.PI) / 180);
        // Dibujar centrado en el nuevo origen
        ctx.drawImage(logoImg, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
        ctx.restore();

        // Resetear para futuros usos si fuera necesario
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        return canvas;
    },

    /**
     * Redimensiona una imagen (base64 o URL) para que no exceda un tamaño máximo,
     * devolviendo un base64 de un JPEG comprimido.
     */
    async resizeLogoForPDF(src, maxDimension = 500) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height *= maxDimension / width;
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width *= maxDimension / height;
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Calidad 0.6 para el thumbnail del diseño
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = () => resolve(src); // Si falla, devolvemos original
            img.src = src;
        });
    },

    /**
     * Dibuja una línea de miniaturas (punteada) usando una imagen.
     * align: 'left' recorre todo el ancho, 'right' coloca maxItems a la derecha.
     */
    async drawBreadLine(doc, src, y, size, spacing = 2, sideMargin = 20, maxItems = 99, align = 'left') {
        const pageWidth = doc.internal.pageSize.getWidth();
        const startX = sideMargin;
        const endX = pageWidth - sideMargin;
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const imgHeight = (img.height * size) / img.width;
                let currentX = startX;
                let count = 0;

                if (align === 'right') {
                    const totalWidth = (maxItems * size) + ((maxItems - 1) * spacing);
                    currentX = endX - totalWidth;
                }
                
                // Agregamos la imagen al PDF solo una vez para obtener un alias interno de jsPDF
                // y que no se repitan los datos binarios en cada addImage del bucle.
                const imgAlias = src; // jsPDF usa el src/data como clave de cache interna
                
                while (currentX + size <= endX + 0.1 && count < maxItems) {
                    // Usamos la referencia a la imagen cargada
                    doc.addImage(img, 'JPEG', currentX, y - imgHeight/2, size, imgHeight, imgAlias, 'FAST');
                    currentX += size + spacing;
                    count++;
                }
                resolve();
            };
            img.onerror = () => {
                console.warn("No se pudo cargar la imagen para la línea:", src);
                resolve();
            };
            img.src = src;
        });
    },

    /**
     * Genera y descarga el PDF con una estética de "punto de panes".
     */
    async downloadPDF(logoThumbnail, breadImg, logoImg, previewArea, breadLabel, width, height, bronzeSize) {
        const { jsPDF } = window.jspdf;
        // Habilitamos compresión interna de jsPDF
        const doc = new jsPDF({
            compress: true
        });
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = 15;

        // --- DECORACIÓN: LÍNEA PUNTEADA DE PANES EN EL ENCABEZADO ---
        await this.drawBreadLine(doc, 'hamburguesa.png', 10, 5, 2, 20);

        doc.setDrawColor(255, 102, 0);
        doc.setLineWidth(0.8);
        doc.line(margin, 18, pageWidth - margin, 18); // Línea naranja orgánica

        y = 28;
        const dateStr = new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Título estilizado
        doc.setFontSize(24);
        doc.setTextColor(255, 102, 0);
        doc.text("Tu Simulación NAB", margin, y);
        
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("CALIDAD ARTESANAL EN CADA SELLO", margin, y + 6);
        
        y += 22;

        // --- DATOS TÉCNICOS ---
        doc.setFontSize(11);
        doc.setTextColor(80, 80, 80);
        doc.text(`Fecha: ${dateStr}`, margin, y);
        y += 7;
        doc.text(`Objeto: ${breadLabel}`, margin, y);
        y += 7;
        doc.text(`Medida del Diseño: ${width} cm x ${height} cm`, margin, y);
        
        if (bronzeSize && !isNaN(bronzeSize) && breadLabel.toLowerCase().includes("hielo")) {
            y += 8;
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 102, 0);
            doc.text(`Medida del Bronce sugerida: ${bronzeSize} mm`, margin, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(80, 80, 80);
        }
        
        y += 15;

        // --- 1. DISEÑO ---
        doc.setFontSize(13);
        doc.setTextColor(255, 102, 0);
        doc.text("1. Diseño procesado para el sello:", margin, y);
        y += 8;
        try {
            // REDIMENSIÓN AGRESIVA: El logo original puede ser enorme (10MB+). 
            // Lo achicamos antes de meterlo al PDF para bajar el peso radicalmente.
            const resizedLogo = await this.resizeLogoForPDF(logoThumbnail.src, 500);
            doc.addImage(resizedLogo, 'JPEG', margin, y, 35, 35, undefined, 'FAST');
        } catch (e) {
            doc.text("[Imagen no disponible]", margin, y + 10);
        }
        y += 50;

        // --- 2. SIMULACIÓN ---
        const simLabel = breadLabel.toLowerCase().includes("hielo") ? "2. Simulación de logo sobre hielo:" : "2. Simulación sobre el pan:";
        doc.setFontSize(13);
        doc.setTextColor(255, 102, 0);
        doc.text(simLabel, margin, y);
        y += 8;
        
        const compositeCanvas = this.generateCompositeCanvas(breadImg, logoImg, previewArea);
        
        // Optimización: Si el canvas es gigante, lo reducimos antes de exportar
        let finalCanvas = compositeCanvas;
        const MAX_WIDTH = 1200;
        if (compositeCanvas.width > MAX_WIDTH) {
            const scale = MAX_WIDTH / compositeCanvas.width;
            const resizedCanvas = document.createElement('canvas');
            resizedCanvas.width = MAX_WIDTH;
            resizedCanvas.height = compositeCanvas.height * scale;
            const rCtx = resizedCanvas.getContext('2d');
            rCtx.drawImage(compositeCanvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
            finalCanvas = resizedCanvas;
        }

        // Usamos JPEG con calidad 0.70 para reducir drásticamente el peso
        const compositeData = finalCanvas.toDataURL('image/jpeg', 0.70);
        
        const pdfWidth = (pageWidth - (margin * 2)) * 0.5;
        const pdfHeight = (finalCanvas.height * pdfWidth) / finalCanvas.width;
        const xOffset = (pageWidth - pdfWidth) / 2;
        
        // Marco sutil para la simulación
        doc.setDrawColor(240, 240, 240);
        doc.rect(xOffset - 0.5, y - 0.5, pdfWidth + 1, pdfHeight + 1);
        doc.addImage(compositeData, 'JPEG', xOffset, y, pdfWidth, pdfHeight, undefined, 'FAST');
        
        y += pdfHeight + 25;

        // --- PIE DE PÁGINA CASUAL ---
        doc.setDrawColor(255, 102, 0);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);
        
        // Línea punteada de panes al pie (Solo 5 a la derecha para no tapar el texto)
        await this.drawBreadLine(doc, 'hamburguesa.png', pageHeight - 31, 4, 1.5, 20, 5, 'right');

        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("Hecho con pasión por NAB Sellos Metálicos", margin, pageHeight - 27);
        doc.text("nabsellosmetalicos.ar | +54 9 11 3565 4750", margin, pageHeight - 22);
        doc.text("instagram.com/nabsellosmetalicos", margin, pageHeight - 17);
        doc.text("facebook.com/nabsellosmetalicos", margin, pageHeight - 12);
        
        doc.setFontSize(8);
        doc.text("Generador PDF v2.5 (Photo Edition)", pageWidth - margin - 45, pageHeight - 12);

        // Guardar
        doc.save(`Simulacion_NAB_Sellos_${Date.now()}.pdf`);
    }
};
