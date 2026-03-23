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
     * Dibuja un pequeño pan artesanal minimalista usando primitivas de jsPDF.
     */
    drawArtisanBread(doc, x, y, size, rotation = 0) {
        doc.setDrawColor(255, 102, 0); // Naranja NAB
        doc.setLineWidth(0.3);
        
        // Cuerpo: Elipse simplificada con líneas
        const w = size;
        const h = size * 0.6;
        
        // Dibujamos un óvalo
        doc.ellipse(x, y, w, h, 'S');
        
        // Cortes del pan (3 líneas curvas)
        doc.line(x - w*0.4, y - h*0.2, x - w*0.1, y + h*0.4);
        doc.line(x - w*0.1, y - h*0.4, x + w*0.2, y + h*0.2);
        doc.line(x + w*0.2, y - h*0.2, x + w*0.5, y + h*0.4);
    },

    /**
     * Genera y descarga el PDF con toques artísticos orgánicos.
     */
    async downloadPDF(logoThumbnail, breadImg, logoImg, previewArea, breadLabel, width, height, bronzeSize) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = 15;

        // --- DECORACIÓN: "PANCITOS DESORDENADOS" EN EL ENCABEZADO ---
        this.drawArtisanBread(doc, 15, 10, 6);
        this.drawArtisanBread(doc, 25, 8, 4);
        this.drawArtisanBread(doc, pageWidth - 20, 12, 5);
        this.drawArtisanBread(doc, pageWidth - 35, 9, 4);

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
            doc.addImage(logoThumbnail.src, 'PNG', margin, y, 35, 35);
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
        const compositeData = compositeCanvas.toDataURL('image/png');
        
        const pdfWidth = (pageWidth - (margin * 2)) * 0.5;
        const pdfHeight = (compositeCanvas.height * pdfWidth) / compositeCanvas.width;
        const xOffset = (pageWidth - pdfWidth) / 2;
        
        // Marco sutil para la simulación
        doc.setDrawColor(240, 240, 240);
        doc.rect(xOffset - 0.5, y - 0.5, pdfWidth + 1, pdfHeight + 1);
        doc.addImage(compositeData, 'PNG', xOffset, y, pdfWidth, pdfHeight);
        
        y += pdfHeight + 25;

        // --- PIE DE PÁGINA CASUAL ---
        doc.setDrawColor(255, 102, 0);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
        
        // Pequeño pan al pie
        this.drawArtisanBread(doc, pageWidth - margin - 10, pageHeight - 15, 4);

        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("Hecho con pasión por NAB Sellos Metálicos", margin, pageHeight - 15);
        doc.text("nabsellosmetalicos.ar | Expertos en gastronomía", margin, pageHeight - 10);
        
        doc.setFontSize(8);
        doc.text("Generador PDF v2.4 (Artisan Edition)", pageWidth - margin - 45, pageHeight - 8);

        // Guardar
        doc.save(`Simulacion_NAB_Sellos_${Date.now()}.pdf`);
    }
};
