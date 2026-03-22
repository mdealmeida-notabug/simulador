/**
 * logoFetcher.js
 * Intenta detectar logos dinámicamente o usa la lista pre-generada.
 */

/**
 * Convierte un Blob (imagen) a una cadena Base64 (Data URL).
 * Esto es clave para evitar errores de seguridad local al usar el Canvas.
 */
function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Renderiza los logos en la grilla.
 * @param {Array} logos - Lista de objetos { name, data } (donde data es Base64)
 */
function renderLogoGrid(logos) {
    const logoGrid = document.getElementById('logoGrid');
    if (!logoGrid) return;

    logoGrid.innerHTML = '';

    if (logos.length === 0) {
        logoGrid.innerHTML = '<p style="grid-column: span 3; color: #888; text-align: center; padding: 20px;">No se encontraron logos genéricos.</p>';
        return;
    }

    logos.forEach(logo => {
        const item = document.createElement('div');
        item.className = 'logo-item';
        item.title = logo.name;
        
        const img = document.createElement('img');
        img.src = logo.data;
        img.alt = logo.name;
        
        item.appendChild(img);
        
        item.addEventListener('click', () => {
            document.querySelectorAll('.logo-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            
            const event = new CustomEvent('logoSelected', { 
                detail: { 
                    data: logo.data,
                    name: logo.name 
                } 
            });
            document.dispatchEvent(event);
        });

        logoGrid.appendChild(item);
    });
}

/**
 * Intenta detectar logos dinámicamente consultando la carpeta 'logos/'.
 * Esto requiere un servidor local que permita indexar directorios (ej: Live Server).
 */
async function refreshLogos() {
    console.log('Intentando actualizar lista de logos dinámicamente...');
    
    try {
        const response = await fetch('logos/');
        if (!response.ok) throw new Error('No se pudo acceder al directorio logos/');

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Buscar enlaces a imágenes
        const links = Array.from(doc.querySelectorAll('a'))
            .map(a => a.getAttribute('href'))
            .filter(href => href && (href.toLowerCase().endsWith('.png') || href.toLowerCase().endsWith('.jpg') || href.toLowerCase().endsWith('.jpeg')))
            .map(href => href.startsWith('logos/') ? href : 'logos/' + href);

        if (links.length === 0) throw new Error('No se encontraron imágenes en el listado del directorio.');

        console.log(`Detectados ${links.length} logos. Procesándolos...`);
        
        const dynamicLogos = [];
        for (const url of links) {
            try {
                const imgRes = await fetch(url);
                const blob = await imgRes.blob();
                const b64 = await blobToDataURL(blob);
                const name = decodeURIComponent(url.split('/').pop());
                dynamicLogos.push({ name: name, data: b64 });
            } catch (err) {
                console.warn(`Error al procesar ${url}:`, err);
            }
        }

        if (dynamicLogos.length > 0) {
            renderLogoGrid(dynamicLogos);
            console.log('Lista de logos actualizada dinámicamente.');
            return;
        }
        
    } catch (error) {
        console.warn('La detección dinámica falló (es normal si no se usa Live Server). Usando respaldo:', error);
    }

    // Fallback: Usar la lista pre-generada si existe
    if (typeof LOGOS_LIST !== 'undefined' && Array.isArray(LOGOS_LIST)) {
        renderLogoGrid(LOGOS_LIST);
        console.log('Se cargó la lista de logos desde el respaldo (LOGOS_LIST).');
    } else {
        renderLogoGrid([]);
    }
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', refreshLogos);
