/**
 * app.js
 * Inicialización y manejo de eventos.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Referencias al DOM
    const logoInput = document.getElementById('logoInput');
    const logoSelect = document.getElementById('logoSelect');
    const logoThumbnail = document.getElementById('logoThumbnail');
    const btnInvert = document.getElementById('btnInvert');
    const previewArea = document.getElementById('previewArea');
    const breadImg = document.getElementById('breadImg');
    const logoImg = document.getElementById('logoImg');
    const logoPlaceholder = document.getElementById('logoPlaceholder');

    // Controles
    const logoControls = document.getElementById('logoControls');
    const btnLogoPlus = document.getElementById('btnLogoPlus');
    const btnLogoMinus = document.getElementById('btnLogoMinus');
    const btnRotateLeft = document.getElementById('btnRotateLeft');
    const btnRotateRight = document.getElementById('btnRotateRight');

    const breadControls = document.getElementById('breadControls');
    const btnBreadPlus = document.getElementById('btnBreadPlus');
    const btnBreadMinus = document.getElementById('btnBreadMinus');

    const breadRadios = document.querySelectorAll('input[name="breadType"]');
    const breadMeasureText = document.getElementById('breadMeasureText');
    const logoMeasureText = document.getElementById('logoMeasureText');
    const logoCmValue = document.getElementById('logoCmValue');
    const logoCmHeightValue = document.getElementById('logoCmHeightValue');
    const whatsappBtn = document.getElementById('whatsappBtn');

    const breadData = BREAD_CONFIG;

    // --- 0. CARGAR LOGOS PREDEFINIDOS ---
    if (typeof fetchLogosAndPopulate === 'function') {
        fetchLogosAndPopulate(logoSelect);
    }

    // --- 1. CARGAR PAN ---
    function updateBreadDisplay() {
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        const breadInfo = breadData[selectedBread];

        breadImg.src = breadInfo.src;
        breadMeasureText.innerHTML =
            `Medida del objeto seleccionado: <strong>${breadInfo.widthCm} cm de ancho</strong>` +
            (breadInfo.heightCm ? ` &times; <strong>${breadInfo.heightCm} cm de alto</strong>` : '');

        logoImg.style.display = 'none';
        logoControls.style.display = 'none';
        logoMeasureText.style.display = 'none';

        logoPlaceholder.style.display = 'block';

        // Reset bread scale
        simulator.breadScale = 1;
        simulator.updateVisuals(logoImg, breadImg);
        simulator.updateIceCircle(breadData);

        // Solo simular si el thumbnail tiene una imagen válida
        const currentLogo = logoThumbnail.getAttribute('src');
        if (currentLogo && currentLogo !== "") {
            logoPlaceholder.style.display = 'none';
            btnInvert.style.display = 'inline-block';
            simulator.simulateLogo(currentLogo, logoImg, logoControls, logoMeasureText, breadData, logoCmValue, logoCmHeightValue, () => {
                updateWhatsAppLink();
                simulator.updateIceCircle(breadData);
            });
        }
    }

    // --- 2. ACTUALIZAR LINK WHATSAPP ---
    function updateWhatsAppLink() {
        const selectedBreadLabel = document.querySelector('input[name="breadType"]:checked').parentElement.textContent.trim();
        const width = logoCmValue.innerText;
        const height = logoCmHeightValue.innerText;

        const message = `Hola NAB Sellos! Estuve probando el simulador y me interesa un sello. Estos son mis datos:
- Objeto a sellar: ${selectedBreadLabel}
- Medida del logo: ${width} cm de ancho x ${height} cm de alto.`;

        const encodedMessage = encodeURIComponent(message);
        whatsappBtn.href = `https://wa.me/5491135654750?text=${encodedMessage}`;
    }

    // --- 3. EVENTOS ---
    updateBreadDisplay();

    breadRadios.forEach(radio => {
        radio.addEventListener('change', updateBreadDisplay);
    });

    // --- TAB SWITCHING ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Toggle active buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle active contents
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
        });
    });

    // Evento para procesar logo al subirlo
    logoInput.addEventListener('change', () => {
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        const currentBreadData = breadData[selectedBread];

        if (logoInput.files && logoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const logoData = e.target.result;
                logoThumbnail.src = logoData;
                logoThumbnail.style.display = 'block';
                btnInvert.style.display = 'inline-block';
                logoPlaceholder.style.display = 'none';
                simulator.simulateLogo(logoData, logoImg, logoControls, logoMeasureText, breadData, logoCmValue, logoCmHeightValue, () => {
                    updateWhatsAppLink();
                    simulator.updateIceCircle(breadData);
                });

                // Desmarcar selecciones en el grid
                document.querySelectorAll('.logo-item').forEach(el => el.classList.remove('selected'));
            };
            reader.readAsDataURL(logoInput.files[0]);
        }
    });

    // Escuchar selección de logos genéricos (desde logoFetcher.js)
    document.addEventListener('logoSelected', (e) => {
        const logoData = e.detail.data;
        const selectedBread = document.querySelector('input[name="breadType"]:checked').value;
        const currentBreadData = breadData[selectedBread];

        if (logoData) {
            // Limpiar input de archivo
            logoInput.value = "";

            logoThumbnail.src = logoData;
            logoThumbnail.style.display = 'none'; // ocultar miniatura para logos genéricos
            btnInvert.style.display = 'inline-block';
            logoPlaceholder.style.display = 'none';

            simulator.simulateLogo(logoData, logoImg, logoControls, logoMeasureText, breadData, logoCmValue, logoCmHeightValue, () => {
                updateWhatsAppLink();
                simulator.updateIceCircle(breadData);
            });
        }
    });

    // --- ACCIÓN INVERTIR ---
    btnInvert.addEventListener('click', () => {
        const currentSrc = logoThumbnail.src;
        if (!currentSrc) return;

        invertImage(currentSrc, (invertedData) => {
            logoThumbnail.src = invertedData;
            // Limpiar input de archivo para que no haya conflicto (técnicamente el thumb ahora es distinto al archivo)
            logoInput.value = "";

            simulator.simulateLogo(invertedData, logoImg, logoControls, logoMeasureText, breadData, logoCmValue, logoCmHeightValue, () => {
                updateWhatsAppLink();
                simulator.updateIceCircle(breadData);
            });
        });
    });

    // --- LOGICA DE REPETICIÓN (CLICK MANTENIDO) ---
    let repeatTimer;

    function startRepeat(action) {
        stopRepeat();
        action();
        repeatTimer = setTimeout(() => {
            repeatTimer = setInterval(action, 100);
        }, 500);
    }

    function stopRepeat() {
        clearInterval(repeatTimer);
        clearTimeout(repeatTimer);
    }

    // Zoom Logo
    btnLogoPlus.addEventListener('mousedown', () => startRepeat(() => {
        simulator.applyZoom(1, logoImg, logoCmValue, logoCmHeightValue, breadData);
        simulator.updateIceCircle(breadData);
        updateWhatsAppLink();
    }));

    btnLogoMinus.addEventListener('mousedown', () => startRepeat(() => {
        simulator.applyZoom(-1, logoImg, logoCmValue, logoCmHeightValue, breadData);
        simulator.updateIceCircle(breadData);
        updateWhatsAppLink();
    }));

    // Rotación Logo
    btnRotateRight.addEventListener('mousedown', () => startRepeat(() => {
        simulator.applyRotation(15, logoImg);
        simulator.updateIceCircle(breadData);
    }));

    btnRotateLeft.addEventListener('mousedown', () => startRepeat(() => {
        simulator.applyRotation(-15, logoImg);
        simulator.updateIceCircle(breadData);
    }));

    // Zoom Pan
    btnBreadPlus.addEventListener('mousedown', () => startRepeat(() => {
        simulator.applyBreadScale(0.05, breadImg, breadMeasureText, logoCmValue, logoCmHeightValue, breadData);
        simulator.updateIceCircle(breadData);
    }));

    btnBreadMinus.addEventListener('mousedown', () => startRepeat(() => {
        simulator.applyBreadScale(-0.05, breadImg, breadMeasureText, logoCmValue, logoCmHeightValue, breadData);
        simulator.updateIceCircle(breadData);
    }));

    // Eventos globales para frenar la repetición
    window.addEventListener('mouseup', stopRepeat);
    window.addEventListener('mouseleave', stopRepeat);

    // Soporte para pantallas táctiles (opcional pero recomendado)
    [btnLogoPlus, btnLogoMinus, btnRotateLeft, btnRotateRight, btnBreadPlus, btnBreadMinus].forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const id = btn.id;
            if (id === 'btnLogoPlus') startRepeat(() => { simulator.applyZoom(1, logoImg, logoCmValue, logoCmHeightValue, breadData); simulator.updateIceCircle(breadData); updateWhatsAppLink(); });
            if (id === 'btnLogoMinus') startRepeat(() => { simulator.applyZoom(-1, logoImg, logoCmValue, logoCmHeightValue, breadData); simulator.updateIceCircle(breadData); updateWhatsAppLink(); });
            if (id === 'btnRotateRight') startRepeat(() => { simulator.applyRotation(15, logoImg); simulator.updateIceCircle(breadData); });
            if (id === 'btnRotateLeft') startRepeat(() => { simulator.applyRotation(-15, logoImg); simulator.updateIceCircle(breadData); });
            if (id === 'btnBreadPlus') startRepeat(() => { simulator.applyBreadScale(0.05, breadImg, breadMeasureText, logoCmValue, logoCmHeightValue, breadData); simulator.updateIceCircle(breadData); });
            if (id === 'btnBreadMinus') startRepeat(() => { simulator.applyBreadScale(-0.05, breadImg, breadMeasureText, logoCmValue, logoCmHeightValue, breadData); simulator.updateIceCircle(breadData); });
        });
        btn.addEventListener('touchend', stopRepeat);
    });

    // --- 4. EXPORTAR PDF ---
    const btnDownloadPDF = document.getElementById('btnDownloadPDF');
    btnDownloadPDF.addEventListener('click', () => {
        const selectedBreadLabel = document.querySelector('input[name="breadType"]:checked').parentElement.textContent.trim();
        const width = logoCmValue.innerText;
        const height = logoCmHeightValue.innerText;
        const bronzeSize = document.getElementById('iceCmValue').innerText;

        exporter.downloadPDF(logoThumbnail, breadImg, logoImg, previewArea, selectedBreadLabel, width, height, bronzeSize);
    });


    // --- 5. DRAG & DROP ---
    let isDragging = false;
    logoImg.ondragstart = () => false;

    function startDrag(e) {
        isDragging = true;
        logoImg.classList.add('dragging');
    }

    function doDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const rect = previewArea.getBoundingClientRect();
        let clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        let clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        let xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        let yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

        logoImg.style.left = xPct + '%';
        logoImg.style.top = yPct + '%';
    }

    function stopDrag() {
        isDragging = false;
        logoImg.classList.remove('dragging');
    }

    logoImg.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    logoImg.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', doDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
});
