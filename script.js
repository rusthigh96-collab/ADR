const db = window.supabase.createClient(
    window.ADR_SUPABASE_URL,
    window.ADR_SUPABASE_KEY
);

const productGrid = document.getElementById("product-grid");
const searchInput = document.getElementById("search");

let allProducts = [];

// CARREGAR PRODUTOS DO SUPABASE
async function loadProducts() {
    productGrid.innerHTML = "<p>Carregando produtos...</p>";

    const { data, error } = await db
        .from("products")
        .select("id, name, description, category, price, tag, image_url, affiliate_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error) {
        productGrid.innerHTML = "<p>Não foi possível carregar os produtos.</p>";
        console.error(error);
        return;
    }

    allProducts = data || [];
    renderProducts(allProducts);
}

// EXIBIR PRODUTOS
function renderProducts(products) {
    productGrid.innerHTML = "";

    if (!products.length) {
        productGrid.innerHTML = "<p>Nenhum produto encontrado.</p>";
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";

        const image = document.createElement("img");
        image.src = product.image_url || "";
        image.alt = product.name;
        image.loading = "lazy";

        const info = document.createElement("div");
        info.className = "product-info";

        const name = document.createElement("h3");
        name.textContent = product.name;

        const tag = document.createElement("span");
        tag.className = "product-tag";
        tag.textContent = product.tag || "";

        const price = document.createElement("p");
        price.className = "product-price";
        price.textContent = Number(product.price).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        const button = document.createElement("a");
        button.className = "product-button";
        button.href = product.affiliate_url;
        button.target = "_blank";
        button.rel = "noopener noreferrer";
        button.textContent = "Ver na Shopee";

        info.appendChild(name);

        if (product.tag) {
            info.appendChild(tag);
        }

        info.appendChild(price);
        info.appendChild(button);

        card.appendChild(image);
        card.appendChild(info);

        productGrid.appendChild(card);
    });
}

// PESQUISA
if (searchInput) {
    searchInput.addEventListener("input", () => {
        const search = searchInput.value.toLowerCase();

        const filtered = allProducts.filter(product =>
            product.name.toLowerCase().includes(search) ||
            (product.category || "").toLowerCase().includes(search) ||
            (product.tag || "").toLowerCase().includes(search)
        );

        renderProducts(filtered);
    });
}

// FILTRO DE CATEGORIAS
document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;

        if (category === "all") {
            renderProducts(allProducts);
        } else {
            renderProducts(
                allProducts.filter(product => product.category === category)
            );
        }
    });
});

// INICIAR
loadProducts();