/**
 * simulator.js
 * Lógica core de la simulación y cálculos de medidas.
 */

const simulator = {
    currentScale: 50,
    currentAspectRatio: 1,
    currentRotation: 0,
    breadScale: 1,

    updateLogoMeasurementDisplay(logoCmValue, logoCmHeightValue, breadData) {
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        const baseBreadWidth = breadData[selectedBread].widthCm;
        
        const currentCmWidth = (this.currentScale / 100) * baseBreadWidth;
        const currentCmHeight = currentCmWidth * this.currentAspectRatio;
        
        logoCmValue.innerText = currentCmWidth.toFixed(1);
        logoCmHeightValue.innerText = currentCmHeight.toFixed(1);
    },

    updateBreadMeasurementDisplay(breadMeasureText, breadData) {
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        const breadInfo = breadData[selectedBread];
        const currentBreadWidth  = breadInfo.widthCm  * this.breadScale;
        const currentBreadHeight = breadInfo.heightCm * this.breadScale;
        
        breadMeasureText.innerHTML =
            `Medida del objeto seleccionado: <strong>${currentBreadWidth.toFixed(1)} cm de ancho</strong>` +
            (breadInfo.heightCm ? ` &times; <strong>${currentBreadHeight.toFixed(1)} cm de alto</strong>` : '');
    },

    updateVisuals(logoImg, breadImg) {
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        
        let visualBreadScale = this.breadScale;
        let visualLogoScale = this.currentScale;

        // Regla general: si el pan crece más que el recuadro (escala > 1)
        // dejamos el pan fijo y achicamos el logo proporcionalmente.
        if (this.breadScale > 1) {
            visualBreadScale = 1;
            visualLogoScale = this.currentScale / this.breadScale;
        }

        breadImg.style.transform = `scale(${visualBreadScale})`;
        logoImg.style.width = visualLogoScale + '%';
        logoImg.style.transform = `translate(-50%, -50%) rotate(${this.currentRotation}deg)`;
    },

    simulateLogo(logoSrc, logoImg, logoControls, logoMeasureText, breadData, logoCmValue, logoCmHeightValue, onComplete) {
        if (!logoSrc) return;

        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        const isIce = selectedBread === 'hielo';

        processImageToAlphaAndCrop(logoSrc, isIce, (croppedImageBase64, aspectRatio) => {
            this.currentAspectRatio = aspectRatio;
            this.currentRotation = 0; // Reset rotation
            logoImg.src = croppedImageBase64;
            
            logoImg.style.left = '50%';
            logoImg.style.top = '50%';
            logoImg.style.display = 'block'; 
            
            logoControls.style.display = 'flex'; 
            logoMeasureText.style.display = 'block'; 
            
            // Tamaño inicial
            let initialLogoCm;
            
            if (isIce) {
                // 34mm (3.4cm) garantiza que caerá en el bronce de 35mm
                if (this.currentAspectRatio >= 1) { // alto mayor al ancho
                    initialLogoCm = 3.4 / this.currentAspectRatio;
                } else {
                    initialLogoCm = 3.4;
                }
            } else {
                const breadInfo = breadData[selectedBread];
                const breadWidth = breadInfo.widthCm;
                const realBreadWidth = breadWidth * this.breadScale;
                initialLogoCm = Math.max(realBreadWidth - 3, 2);

                if (breadInfo.heightCm && this.currentAspectRatio > 0) {
                    const realBreadHeight = breadInfo.heightCm * this.breadScale;
                    const logoHeightAtInitial = initialLogoCm * this.currentAspectRatio;
                    if (logoHeightAtInitial > realBreadHeight) {
                        initialLogoCm = realBreadHeight / this.currentAspectRatio;
                    }
                }
            }

            const breadWidth = breadData[selectedBread].widthCm;
            this.currentScale = (initialLogoCm / breadWidth) * 100;
            
            this.updateVisuals(logoImg, document.getElementById('breadImg'));
            this.updateLogoMeasurementDisplay(logoCmValue, logoCmHeightValue, breadData);

            if (onComplete) onComplete();
        });
    },

    applyZoom(steps, logoImg, logoCmValue, logoCmHeightValue, breadData) {
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        const breadInfo = breadData[selectedBread];
        const breadWidthCm = breadInfo.widthCm;

        // 1mm = 0.1cm. Calculamos qué porcentaje del ancho base representa 0.1cm.
        const deltaScale = (0.1 / breadWidthCm) * 100 * steps;
        const newScale = this.currentScale + deltaScale;

        if (newScale < 2 || newScale > 200) return;

        // Medidas que tendría el logo con este nuevo zoom
        const newLogoCmWidth   = (newScale / 100) * breadWidthCm;
        const newLogoCmHeight  = newLogoCmWidth * this.currentAspectRatio;

        // Límites de tamaño (6cm para hielo, ancho/alto real para otros)
        if (selectedBread === 'hielo') {
            if (newLogoCmWidth > 6 || newLogoCmHeight > 6) return;
        } else if (breadInfo.heightCm) {
            const realBreadHeight  = breadInfo.heightCm * this.breadScale;
            if (newLogoCmHeight > realBreadHeight) return; 
        }

        this.currentScale = newScale;
        this.updateVisuals(logoImg, document.getElementById('breadImg'));
        this.updateLogoMeasurementDisplay(logoCmValue, logoCmHeightValue, breadData);
    },

    applyRotation(delta, logoImg) {
        this.currentRotation += delta;
        this.updateVisuals(logoImg, document.getElementById('breadImg'));
    },

    applyBreadScale(delta, breadImg, breadMeasureText, logoCmValue, logoCmHeightValue, breadData) {
        const newScale = this.breadScale + delta;
        if (newScale >= 0.5 && newScale <= 2) {
            this.breadScale = newScale;
            
            // Actualizar visuales y medidas
            this.updateVisuals(document.getElementById('logoImg'), breadImg);
            this.updateBreadMeasurementDisplay(breadMeasureText, breadData);
            this.updateLogoMeasurementDisplay(logoCmValue, logoCmHeightValue, breadData);
        }
    },

    updateIceCircle(breadData) {
        const iceGuideContainer = document.getElementById('iceGuideContainer');
        const iceCircle = document.getElementById('iceCircle');
        const iceCircleLabel = document.getElementById('iceCircleLabel');
        const iceMeasureText = document.getElementById('iceMeasureText');
        const iceCmValue = document.getElementById('iceCmValue');
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;

        if (selectedBread !== 'hielo') {
            iceGuideContainer.style.display = 'none';
            iceMeasureText.style.display = 'none';
            return;
        }

        iceGuideContainer.style.display = 'flex';
        iceMeasureText.style.display = 'block';

        // Obtener medidas actuales del logo en cm
        const breadInfo = breadData[selectedBread];
        const baseBreadWidth = breadInfo.widthCm;
        const currentCmWidth = (this.currentScale / 100) * baseBreadWidth;
        const currentCmHeight = currentCmWidth * this.currentAspectRatio;

        // Calcular la dimensión mayor en mm (ancho o alto, según pida el usuario)
        const maxDimensionMm = Math.max(currentCmWidth, currentCmHeight) * 10;

        // Determinar medida del círculo (22, 35, 56)
        // Agregamos +1 para que salte cuando esté a 1mm de superar la medida (en la dimensión mayor)
        const measures = [22, 35, 56];
        let targetDiameter = measures.find(d => d >= (maxDimensionMm + 1));
        
        // Si no entra en ninguno, mostramos el máximo de 56 sugerido (o nada)
        if (!targetDiameter) targetDiameter = 56;

        // Calcular tamaño en píxeles relativo al preview (380px es el ancho del contenedor)
        // El pan de hielo tiene 5cm de ancho base.
        const previewWidth = 380;
        const cmToPx = previewWidth / baseBreadWidth; // pixels por cada cm real
        
        // El círculo debe escalar según el breadScale para mantenerse relativo al objeto
        // Pero recordamos que si breadScale > 1, visualmente el pan se queda en scale(1) 
        // y el logo se achica (ver updateVisuals).
        let visualScale = this.breadScale;
        if (this.breadScale > 1) visualScale = 1;

        const circlePx = (targetDiameter / 10) * cmToPx * visualScale;

        iceCircle.style.width = `${circlePx}px`;
        iceCircle.style.height = `${circlePx}px`;
        
        // El texto ahora va al cuadro de info
        iceCircleLabel.innerText = ''; 
        iceCmValue.innerText = targetDiameter;
    }
};
