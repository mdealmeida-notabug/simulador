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
     * Genera y descarga el PDF con toques artísticos.
     */
    async downloadPDF(logoThumbnail, breadImg, logoImg, previewArea, breadLabel, width, height, bronzeSize) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = 15;

        // --- DECORACIÓN ARTÍSTICA: HEADER ---
        doc.setFillColor(255, 102, 0); // Naranja NAB
        doc.rect(0, 0, pageWidth, 5, 'F'); // Barra superior

        // Pequeño ícono de "Sello/Utensilio" minimalista (vía código)
        doc.setDrawColor(255, 102, 0);
        doc.setLineWidth(0.5);
        // Dibujo de una espátula simple a la izquierda
        doc.line(margin, 12, margin + 5, 12); // Mango
        doc.rect(margin + 5, 10, 4, 4); // Hoja

        y = 22;
        const dateStr = new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Título principal
        doc.setFontSize(22);
        doc.setTextColor(255, 102, 0);
        doc.text("Reporte de Simulación", margin + 12, y);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("NAB SELLOS METÁLICOS", margin + 12, y + 5);
        
        y += 20;

        // --- DATOS TÉCNICOS ---
        doc.setDrawColor(200, 200, 200);
        doc.setLineDash([1, 1]); // Línea punteada "guía"
        doc.line(margin, y - 5, pageWidth - margin, y - 5);
        doc.setLineDash([]); // Reset

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(`Fecha: ${dateStr}`, margin, y);
        y += 7;
        doc.text(`Objeto: ${breadLabel}`, margin, y);
        y += 7;
        doc.text(`Medida del Logo: ${width} cm x ${height} cm`, margin, y);
        
        if (bronzeSize && !isNaN(bronzeSize) && breadLabel.toLowerCase().includes("hielo")) {
            y += 7;
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 102, 0);
            doc.text(`Medida del Bronce sugerida: ${bronzeSize} mm`, margin, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(50, 50, 50);
        }
        
        y += 15;

        // --- 1. LOGO ORIGINAL ---
        doc.setFontSize(14);
        doc.setTextColor(255, 102, 0);
        doc.text("1. Diseño procesado:", margin, y);
        y += 7;
        try {
            doc.addImage(logoThumbnail.src, 'PNG', margin, y, 35, 35);
        } catch (e) {
            doc.text("[Error cargando imagen]", margin, y + 10);
        }
        y += 50;

        // --- 2. SIMULACIÓN COMPUESTA ---
        const simLabel = breadLabel.toLowerCase().includes("hielo") ? "2. Simulación de logo sobre hielo:" : "2. Simulación en el Pan:";
        doc.setFontSize(14);
        doc.setTextColor(255, 102, 0);
        doc.text(simLabel, margin, y);
        y += 7;
        
        const compositeCanvas = this.generateCompositeCanvas(breadImg, logoImg, previewArea);
        const compositeData = compositeCanvas.toDataURL('image/png');
        
        const pdfWidth = (pageWidth - (margin * 2)) * 0.5;
        const pdfHeight = (compositeCanvas.height * pdfWidth) / compositeCanvas.width;
        const xOffset = (pageWidth - pdfWidth) / 2;
        
        // Sombra/Borde sutil para la imagen
        doc.setDrawColor(230, 230, 230);
        doc.setLineDash([]);
        doc.rect(xOffset - 1, y - 1, pdfWidth + 2, pdfHeight + 2);
        
        doc.addImage(compositeData, 'PNG', xOffset, y, pdfWidth, pdfHeight);
        
        y += pdfHeight + 25;

        // --- FOOTER ARTÍSTICO ---
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
        
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("NAB Sellos Metálicos - nabsellosmetalicos.ar", margin, pageHeight - 12);
        doc.text("Expertos en marcación industrial y gastronómica", margin, pageHeight - 8);
        
        // Versión del generador
        doc.setFontSize(8);
        doc.setTextColor(200, 200, 200);
        doc.text("Generador PDF v2.3", pageWidth - margin - 30, pageHeight - 12);

        // Guardar
        doc.save(`Simulacion_NAB_Sellos_${Date.now()}.pdf`);
    }
};
