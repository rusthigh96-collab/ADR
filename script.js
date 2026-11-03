
const db = window.supabase.createClient(
    window.ADR_SUPABASE_URL,
    window.ADR_SUPABASE_KEY
);

const productGrid = document.getElementById("product-grid");
const searchInput = document.getElementById("search");

let allProducts = [];
let selectedCategory = "all";

// CARREGAR PRODUTOS
async function loadProducts() {
    productGrid.innerHTML = '<p class="empty-message">CARREGANDO PRODUTOS...</p>';

    try {
        const { data, error } = await db
            .from("products")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        allProducts = data || [];
        renderProducts();

    } catch (error) {
        console.error("Erro ao carregar produtos:", error);

        productGrid.innerHTML =
            '<p class="empty-message">NÃO FOI POSSÍVEL CARREGAR OS PRODUTOS.</p>';
    }
}

// EXIBIR PRODUTOS
function renderProducts() {
    productGrid.innerHTML = "";

    let products = allProducts;

    if (selectedCategory !== "all") {
        products = products.filter(
            product => product.category === selectedCategory
        );
    }

    if (searchInput) {
        const search = searchInput.value.toLowerCase();

        products = products.filter(product =>
            (product.name || "").toLowerCase().includes(search) ||
            (product.category || "").toLowerCase().includes(search) ||
            (product.tag || "").toLowerCase().includes(search)
        );
    }

    if (!products.length) {
        productGrid.innerHTML =
            '<p class="empty-message">NENHUM PRODUTO ENCONTRADO.</p>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.style.cursor = "pointer";

        // ABRIR DETALHES
        const openProduct = () => {
            window.location.href =
                `produto.html?id=${encodeURIComponent(product.id)}`;
        };

        // IMAGEM
        const imageContainer = document.createElement("div");
        imageContainer.className = "product-image";

        const image = document.createElement("img");
        image.src = product.image_url || "";
        image.alt = product.name || "Produto ADR";
        image.loading = "lazy";

        image.onerror = () => {
            image.alt = "Imagem indisponível";
        };

        imageContainer.appendChild(image);

        // ETIQUETA
        if (product.tag) {
            const tag = document.createElement("span");
            tag.className = "product-tag";
            tag.textContent = product.tag;
            imageContainer.appendChild(tag);
        }

        // INFORMAÇÕES
        const info = document.createElement("div");
        info.className = "product-info";

        const category = document.createElement("span");
        category.className = "product-category";
        category.textContent = product.category || "";

        const name = document.createElement("h3");
        name.textContent = product.name || "Produto ADR";

        const price = document.createElement("p");
        price.className = "product-price";

        price.textContent = Number(product.price).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        // BOTÃO VER DETALHES
        const button = document.createElement("button");
        button.className = "buy-button";
        button.type = "button";
        button.textContent = "VER DETALHES →";
        button.style.width = "100%";
        button.style.border = "none";
        button.style.cursor = "pointer";

        button.addEventListener("click", openProduct);
        imageContainer.addEventListener("click", openProduct);
        name.addEventListener("click", openProduct);

        info.appendChild(category);
        info.appendChild(name);
        info.appendChild(price);
        info.appendChild(button);

        card.appendChild(imageContainer);
        card.appendChild(info);

        productGrid.appendChild(card);
    });
}

// PESQUISA
if (searchInput) {
    searchInput.addEventListener("input", renderProducts);
}

// CATEGORIAS
document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
        selectedCategory = button.dataset.category;

        document.querySelectorAll("[data-category]").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        renderProducts();
    });
});

// INICIAR
loadProducts();
