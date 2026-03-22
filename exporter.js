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
     * Genera y descarga el PDF.
     */
    async downloadPDF(logoThumbnail, breadImg, logoImg, previewArea, breadLabel, width, height, bronzeSize) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const margin = 20;
        let y = 20;

        const dateStr = new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Título
        doc.setFontSize(22);
        doc.setTextColor(255, 102, 0); // Naranja NAB
        doc.text("Reporte de Simulación - NAB Sellos", margin, y);
        y += 15;

        // Datos técnicos
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(`Fecha: ${dateStr}`, margin, y);
        y += 7;
        doc.text(`Objeto: ${breadLabel}`, margin, y);
        y += 7;
        doc.text(`Medida del Logo: ${width} cm de ancho x ${height} cm de alto`, margin, y);
        
        if (bronzeSize && !isNaN(bronzeSize) && breadLabel.toLowerCase().includes("hielo")) {
            y += 7;
            doc.setFont("helvetica", "bold");
            doc.text(`Medida del Bronce sugerida: ${bronzeSize} mm`, margin, y);
            doc.setFont("helvetica", "normal");
        }
        
        y += 15;

        // 1. Logo Original
        doc.setFontSize(14);
        doc.text("1. Logo Original:", margin, y);
        y += 5;
        try {
            // El thumbnail es el base64 del logo procesado (ya viene con el color de sello)
            doc.addImage(logoThumbnail.src, 'PNG', margin, y, 40, 40);
        } catch (e) {
            doc.text("[Error cargando imagen original]", margin, y + 10);
        }
        y += 55;

        // 2. Simulación Compuesta
        doc.text("2. Simulación en el Pan:", margin, y);
        y += 5;
        
        const compositeCanvas = this.generateCompositeCanvas(breadImg, logoImg, previewArea);
        const compositeData = compositeCanvas.toDataURL('image/jpeg', 0.8);
        
        // El usuario requiere que la simulación ocupe el 50% del ancho de la página para estética
        const maxWidth = doc.internal.pageSize.getWidth() - (margin * 2);
        const pdfWidth = maxWidth * 0.5;
        const pdfHeight = (compositeCanvas.height * pdfWidth) / compositeCanvas.width;
        
        // Centrar horizontalmente
        const xOffset = (doc.internal.pageSize.getWidth() - pdfWidth) / 2;
        doc.addImage(compositeData, 'JPEG', xOffset, y, pdfWidth, pdfHeight);
        
        y += pdfHeight + 20;

        // Footer del PDF
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Generado por NAB Sellos Metálicos - nabsellosmetalicos.ar", margin, doc.internal.pageSize.getHeight() - 10);

        // Guardar
        doc.save(`Simulacion_NAB_Sellos_${Date.now()}.pdf`);
    }
};
