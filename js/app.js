// Variables Globales
let productsData = {};
let historyData = {};
let productsList = [];
let currentPage = 1;
const itemsPerPage = 20;
let currentChart = null;
let currentSort = { column: null, asc: true };
let currentCategoryFilter = '';

// Elementos del DOM
const DOM = {
    totalProducts: document.getElementById('total-products'),
    avgPrice: document.getElementById('avg-price'),
    totalCategories: document.getElementById('total-categories'),
    rentablesContainer: document.getElementById('rentables-container'),
    productsTbody: document.getElementById('products-tbody'),
    searchInput: document.getElementById('search-input'),
    categoryFilter: document.getElementById('category-filter'),
    pagination: document.getElementById('pagination'),
    lastUpdate: document.getElementById('last-update'),
    modal: document.getElementById('chart-modal'),
    closeModalBtn: document.querySelector('.close-modal'),
    modalTitle: document.getElementById('modal-product-name'),
    chartCanvas: document.getElementById('priceChart')
};

// Inicialización
async function init() {
    try {
        // En un entorno real (GitHub Pages), estos archivos estarán en el servidor
        const [prodRes, histRes] = await Promise.all([
            fetch('data/products.json').catch(() => ({ ok: false })),
            fetch('data/history.json').catch(() => ({ ok: false }))
        ]);

        if (prodRes.ok && histRes.ok) {
            productsData = await prodRes.json();
            historyData = await histRes.json();
        } else {
            // Datos de prueba en caso de fallo (para demostración antes del primer scrape)
            mockData();
        }

        productsList = Object.values(productsData);
        
        updateDashboardStats();
        populateCategoryFilter();
        renderRentables();
        renderProductsTable();
        setupEventListeners();
        
        if (productsList.length > 0) {
            DOM.lastUpdate.textContent = productsList[0].last_updated || 'Hoy';
        }

    } catch (error) {
        console.error("Error inicializando la app:", error);
    }
}

// Actualizar Estadísticas
function updateDashboardStats() {
    DOM.totalProducts.textContent = productsList.length.toLocaleString();
    
    const categories = new Set(productsList.map(p => p.category));
    DOM.totalCategories.textContent = categories.size;

    const totalPrice = productsList.reduce((acc, p) => acc + (p.current_price || 0), 0);
    const avg = productsList.length ? (totalPrice / productsList.length).toFixed(2) : 0;
    DOM.avgPrice.textContent = `${avg} €`;
}

// Renderizar Productos Más Rentables (Top 10 más baratos por Kg/L por Categoría)
function renderRentables() {
    // Filtramos los que tienen precio bulk válido y no es igual a 0
    const validProducts = productsList.filter(p => p.bulk_price && p.bulk_price > 0);
    
    // Obtenemos todas las categorías únicas
    const categories = Array.from(new Set(validProducts.map(p => p.category))).sort();
    
    let html = '';
    
    categories.forEach(cat => {
        const catProducts = validProducts.filter(p => p.category === cat);
        // Ordenamos por precio unitario (bulk_price) ascendente
        const sorted = catProducts.sort((a, b) => a.bulk_price - b.bulk_price);
        const top10 = sorted.slice(0, 10);
        
        if(top10.length > 0) {
            html += `
                <div class="category-block">
                    <h3 style="margin-bottom: 16px; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); padding-bottom: 8px;">${cat}</h3>
                    <div class="category-rentables-row">
                        ${top10.map(p => `
                            <div class="product-card">
                                ${p.thumbnail ? `<img src="${p.thumbnail}" alt="${p.name}" style="height:120px; object-fit:contain; border-radius:8px;">` : `<div class="prod-img-placeholder"><i class="ri-image-line"></i></div>`}
                                <div>
                                    <h4 style="font-size: 0.95rem;">${p.name}</h4>
                                    <span style="font-size: 0.8rem; color: var(--text-secondary)">${p.unit_size} ${p.size_format}</span>
                                </div>
                                <div style="margin-top: auto;">
                                    <div class="price">${p.current_price.toFixed(2)} €</div>
                                    <div class="bulk">${p.bulk_price.toFixed(2)} € / Kg-L</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });

    DOM.rentablesContainer.innerHTML = html;
}

// Poblar filtro de categorías
function populateCategoryFilter() {
    const categories = new Set(productsList.map(p => p.category));
    const sortedCategories = Array.from(categories).sort();
    
    sortedCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        DOM.categoryFilter.appendChild(option);
    });
}

// Renderizar Tabla de Explorador
function renderProductsTable() {
    const searchTerm = DOM.searchInput.value.toLowerCase();
    
    // Filtrado
    let filtered = productsList.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchTerm) || p.category.toLowerCase().includes(searchTerm);
        const matchCategory = currentCategoryFilter === '' || p.category === currentCategoryFilter;
        return matchSearch && matchCategory;
    });

    // Ordenación
    if (currentSort.column) {
        filtered.sort((a, b) => {
            let valA, valB;
            switch(currentSort.column) {
                case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
                case 'category': valA = a.category.toLowerCase(); valB = b.category.toLowerCase(); break;
                case 'price': valA = a.current_price || 0; valB = b.current_price || 0; break;
                case 'bulk': valA = a.bulk_price || 0; valB = b.bulk_price || 0; break;
            }
            if (valA < valB) return currentSort.asc ? -1 : 1;
            if (valA > valB) return currentSort.asc ? 1 : -1;
            return 0;
        });
    }

    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    DOM.productsTbody.innerHTML = paginated.map(p => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    ${p.thumbnail ? `<img src="${p.thumbnail}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">` : ''}
                    <span style="font-weight:500;">${p.name}</span>
                </div>
            </td>
            <td><span style="background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${p.category}</span></td>
            <td>${p.unit_size} ${p.size_format}</td>
            <td style="font-weight:600; color:var(--accent-primary)">${p.current_price.toFixed(2)} €</td>
            <td style="color:var(--text-secondary)">${p.bulk_price ? p.bulk_price.toFixed(2) : '-'} €</td>
            <td>
                <button class="btn-chart" onclick="openChart('${p.id}')">
                    <i class="ri-line-chart-line"></i> Gráfica
                </button>
            </td>
        </tr>
    `).join('');

    renderPagination(filtered.length);
}

// Renderizar Paginación
function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let html = '';
    
    // Solo mostramos un máximo de 5 botones
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (currentPage > 1) {
        html += `<button class="page-btn" onclick="changePage(${currentPage - 1})"><i class="ri-arrow-left-s-line"></i></button>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="changePage(${currentPage + 1})"><i class="ri-arrow-right-s-line"></i></button>`;
    }

    DOM.pagination.innerHTML = html;
}

// Cambiar Página
window.changePage = function(page) {
    currentPage = page;
    renderProductsTable();
}

// Abrir Modal de Gráfica
window.openChart = function(productId) {
    const product = productsData[productId];
    const history = historyData[productId] || [];

    if (!product) return;

    DOM.modalTitle.textContent = `Evolución de Precio: ${product.name}`;
    DOM.modal.classList.add('show');

    if (currentChart) {
        currentChart.destroy();
    }

    const labels = history.map(h => h.date);
    const dataPoints = history.map(h => h.price);

    const ctx = DOM.chartCanvas.getContext('2d');
    
    // Configuración para el modo Light
    Chart.defaults.color = '#475569';
    Chart.defaults.font.family = 'Inter';

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Precio (€)',
                data: dataPoints,
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#059669',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.4 // Curvas suaves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#10b981',
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toFixed(2) + ' €';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Cerrar Modal
DOM.closeModalBtn.addEventListener('click', () => {
    DOM.modal.classList.remove('show');
});

// Cerrar clickeando fuera
window.addEventListener('click', (e) => {
    if (e.target === DOM.modal) {
        DOM.modal.classList.remove('show');
    }
});

// Event Listeners Adicionales
function setupEventListeners() {
    DOM.searchInput.addEventListener('input', (e) => {
        currentPage = 1;
        renderProductsTable();
    });
    
    DOM.categoryFilter.addEventListener('change', (e) => {
        currentCategoryFilter = e.target.value;
        currentPage = 1;
        renderProductsTable();
    });

    // Ordenación
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSort.column === column) {
                currentSort.asc = !currentSort.asc; // Invertir orden
            } else {
                currentSort.column = column;
                currentSort.asc = true; // Por defecto ascendente
            }
            renderProductsTable();
        });
    });

    // Navegación Sidebar suave
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', function(e) {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Datos falsos por si no existe el JSON todavía
function mockData() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const past = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];

    productsData = {
        "1": { id: "1", name: "Leche Semidesnatada Hacendado", category: "Lácteos", size_format: "1 L", current_price: 0.89, bulk_price: 0.89, last_updated: today },
        "2": { id: "2", name: "Agua Mineral Natural", category: "Bebidas", size_format: "1.5 L", current_price: 0.22, bulk_price: 0.15, last_updated: today },
        "3": { id: "3", name: "Aceite de Oliva Virgen Extra", category: "Aceites", size_format: "1 L", current_price: 8.95, bulk_price: 8.95, last_updated: today },
        "4": { id: "4", name: "Arroz Redondo", category: "Despensa", size_format: "1 Kg", current_price: 1.30, bulk_price: 1.30, last_updated: today }
    };

    historyData = {
        "1": [ { date: past, price: 0.85 }, { date: yesterday, price: 0.89 }, { date: today, price: 0.89 } ],
        "2": [ { date: past, price: 0.20 }, { date: yesterday, price: 0.22 }, { date: today, price: 0.22 } ],
        "3": [ { date: past, price: 7.50 }, { date: yesterday, price: 8.95 }, { date: today, price: 8.95 } ],
        "4": [ { date: past, price: 1.25 }, { date: yesterday, price: 1.30 }, { date: today, price: 1.30 } ]
    };
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', init);
