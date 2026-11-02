
// ADR — catálogo de afiliados
const DB_NAME = "adrStoreDB";
const STORE_NAME = "products";

const defaultProducts = [
    { id: "default-1", name: "Nike Tech Fleece 2025", category: "Casaco", price: 263.61, image: "assets/NikeTechPreta25.jpg", tag: "Casaco Tech", affiliateLink: "https://s.shopee.com.br/9V2huXndk8" },
    { id: "default-2", name: "Nike Tech Fleece Nocta 2024", category: "Casaco", price: 263.61, image: "assets/NikeTechNocta.jpg", tag: "Casaco Tech", affiliateLink: "https://s.shopee.com.br/AAIOiCO1lc" },
    { id: "default-3", name: "Nike Tech Fleece 2024", category: "Casaco", price: 263.61, image: "assets/NikeTechcinza24.jpg", tag: "Casaco Tech", affiliateLink: "https://s.shopee.com.br/8pn17sBuv6" },
    { id: "default-4", name: "Nike Tech Fleece SYNA 2024", category: "Casaco", price: 263.61, image: "assets/NiketechSyna.jpg", tag: "Casaco Tech", affiliateLink: "https://s.shopee.com.br/5fpzM4alby" },
    { id: "default-5", name: "Balaclava Nike Pro", category: "Acessórios", price: 71.65, image: "assets/BalaclavaNike.jpg", tag: "Acessorios", affiliateLink: "https://s.shopee.com.br/3B8eNZzFnH" },
    { id: "default-6", name: "Bone GUCCI Beisebol 25", category: "Acessórios", price: 155.01, image: "assets/BoneGucci25.jpg", tag: "Bone", affiliateLink: "https://s.shopee.com.br/4LKbllbvsd" },
    { id: "default-7", name: "Casaco Trapstar Variados", category: "Casaco", price: 280.96, image: "assets/CasacoTrapstar.jpg", tag: "Casaco", affiliateLink: "https://s.shopee.com.br/4fxSAXKSKW" },
    { id: "default-8", name: "Casaco SYNA WORLD Variados", category: "Casaco", price: 220.51, image: "assets/CasacoSyna.jpg", tag: "Casaco", affiliateLink: "https://s.shopee.com.br/AKbouyk7YN" }
];

function openADRDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllProducts() {
    const db = await openADRDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
        request.onsuccess = () => {
            db.close();
            resolve(request.result);
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

async function saveProduct(product) {
    const db = await openADRDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(product);
        request.onsuccess = () => {
            db.close();
            resolve();
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

async function async function seedDefaults() {
    const existing = await getAllProducts();

    if (!existing.length) {
        for (const product of defaultProducts) {
            await saveProduct(product);
        }
        return getAllProducts();
    }

    // Atualiza as imagens dos produtos padrão
    for (const defaultProduct of defaultProducts) {
        const savedProduct = existing.find(
            product => product.id === defaultProduct.id
        );

        if (savedProduct) {
            await saveProduct({
                ...savedProduct,
                image: defaultProduct.image
            });
        }
    }

    return getAllProducts();
}

const grid = document.getElementById("product-grid");
const search = document.getElementById("search");
const categoryButtons = document.querySelectorAll(".category-card");
let products = [];
let selectedCategory = "all";

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function renderProducts() {
    if (!grid) return;

    const searchValue = (search?.value || "").toLowerCase().trim();

    const filtered = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchValue);
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    if (!filtered.length) {
        grid.innerHTML = '<p class="empty-message">NO PRODUCTS FOUND.</p>';
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const name = escapeHTML(product.name);
        const category = escapeHTML(product.category);
        const tag = escapeHTML(product.tag || "ADR SELECT");
        const price = Number(product.price).toFixed(2).replace(".", ",");
        const hasLink = /^https:\/\/(s\.shopee\.com\.br|shopee\.com\.br|www\.shopee\.com\.br)\//i.test(product.affiliateLink || "");
        const image = product.image || "";

        return `
            <article class="product-card">
                <div class="product-image">
                    <img src="${escapeHTML(image)}" alt="${name}" loading="lazy" onerror="this.style.opacity='.15';this.alt='Imagem indisponível';">
                    <span class="product-tag">${tag}</span>
                </div>
                <div class="product-info">
                    <span class="product-category">${category}</span>
                    <h3>${name}</h3>
                    <div class="product-price">R$ ${price}</div>
                    ${hasLink
                        ? `<a class="buy-button" href="${escapeHTML(product.affiliateLink)}" target="_blank" rel="sponsored noopener noreferrer">BUY ON SHOPEE ↗</a>`
                        : `<span class="buy-button" aria-disabled="true">LINK COMING SOON</span>`}
                </div>
            </article>`;
    }).join("");
}

async function startCatalog() {
    try {
        products = await seedDefaults();
        renderProducts();
    } catch (error) {
        console.error(error);
        if (grid) {
            grid.innerHTML = '<p class="empty-message">Não foi possível carregar o catálogo neste navegador.</p>';
        }
    }
}

search?.addEventListener("input", renderProducts);

categoryButtons.forEach(button => button.addEventListener("click", () => {
    categoryButtons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    selectedCategory = button.dataset.category;
    renderProducts();
}));

startCatalog();
