
/* ==========================================
   ADR — ADMINISTRATIVE PANEL
   Supabase + Storage + Categories
========================================== */

const SUPABASE_URL = window.ADR_SUPABASE_URL;
const SUPABASE_KEY = window.ADR_SUPABASE_KEY;
const STORAGE_BUCKET = "product-images";

if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Configuração do Supabase não encontrada.");
}

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// ELEMENTOS
const form = document.getElementById("product-form");
const list = document.getElementById("admin-products");
const statusLine = document.getElementById("status");
const imageInput = document.getElementById("image");
const preview = document.getElementById("image-preview");

let productsCache = [];
let selectedImageFile = null;
let currentImageUrl = "";

// ==========================================
// CATEGORIAS
// ==========================================

const CATEGORY_STORAGE_KEY = "adrCategories";

const defaultCategories = [
    { value: "Casaco", label: "Casacos" },
    { value: "Sneakers", label: "Sneakers" },
    { value: "Acessórios", label: "Acessórios" },
    { value: "Tech", label: "Tech & Gadgets" },
    { value: "Lifestyle", label: "Lifestyle" }
];

function getCategories() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(CATEGORY_STORAGE_KEY) || "[]"
        );

        const categories = [...defaultCategories];

        if (Array.isArray(saved)) {
            saved.forEach(category => {
                if (
                    category &&
                    category.value &&
                    category.label &&
                    !categories.some(
                        item => item.value.toLowerCase() ===
                        category.value.toLowerCase()
                    )
                ) {
                    categories.push(category);
                }
            });
        }

        return categories;

    } catch (error) {
        console.error(error);
        return defaultCategories;
    }
}

function renderCategories(selectedValue = "") {
    const select = document.getElementById("category");
    const categories = getCategories();

    select.innerHTML = "";

    categories.forEach(category => {
        const option = document.createElement("option");

        option.value = category.value;
        option.textContent = category.label;

        select.appendChild(option);
    });

    if (
        selectedValue &&
        !categories.some(item => item.value === selectedValue)
    ) {
        const option = document.createElement("option");

        option.value = selectedValue;
        option.textContent = selectedValue;

        select.appendChild(option);
    }

    if (selectedValue) {
        select.value = selectedValue;
    }
}

// CRIAR CATEGORIA
document.getElementById("create-category")?.addEventListener(
    "click",
    () => {
        const enteredName = prompt(
            "Digite o nome da nova categoria:"
        );

        if (enteredName === null) return;

        const name = enteredName.trim().replace(/\s+/g, " ");

        if (!name) {
            showStatus("Digite um nome para a categoria.", true);
            return;
        }

        const categories = getCategories();

        const exists = categories.some(category =>
            category.label.toLowerCase() === name.toLowerCase()
        );

        if (exists) {
            showStatus("Essa categoria já existe.", true);
            return;
        }

        categories.push({
            value: name,
            label: name
        });

        try {
            const customCategories = categories.filter(category =>
                !defaultCategories.some(
                    item => item.value === category.value
                )
            );

            localStorage.setItem(
                CATEGORY_STORAGE_KEY,
                JSON.stringify(customCategories)
            );

            renderCategories(name);

            showStatus(
                `Categoria "${name}" criada com sucesso!`
            );

        } catch (error) {
            showStatus(
                "Não foi possível salvar a categoria.",
                true
            );
        }
    }
);

// ==========================================
// MENSAGENS
// ==========================================

function showStatus(message, isError = false) {
    statusLine.textContent = message;

    statusLine.style.color = isError
        ? "#ff9b9b"
        : "#c6ff00";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================

// O painel só aparece com uma sessão autenticada.
// O formulário de login é criado pelo próprio JS.

const adminPanels = document.querySelectorAll(".admin-panel");

const loginPanel = document.createElement("section");
loginPanel.className = "admin-panel";
loginPanel.hidden = true;

loginPanel.innerHTML = `
    <span class="eyebrow">ADMIN ACCESS</span>
    <h2>ADR <span>LOGIN.</span></h2>

    <form id="adr-login-form">
        <div class="admin-field">
            <label>E-MAIL</label>
            <input id="adr-email"
                type="email"
                autocomplete="username"
                required
                placeholder="E-mail administrativo">
        </div>

        <div class="admin-field">
            <label>SENHA</label>
            <input id="adr-password"
                type="password"
                autocomplete="current-password"
                required
                placeholder="Sua senha">
        </div>

        <button class="admin-primary" type="submit">
            ENTRAR ↗
        </button>

        <p id="adr-login-status" class="admin-status"></p>
    </form>
`;

const adminWrap = document.querySelector(".admin-wrap");
adminWrap.insertBefore(loginPanel, adminWrap.children[1]);

const loginForm = document.getElementById("adr-login-form");
const loginStatus = document.getElementById("adr-login-status");

function showLoginMessage(message, error = false) {
    loginStatus.textContent = message;
    loginStatus.style.color = error ? "#ff9b9b" : "#c6ff00";
}

function setAdminAccess(session) {
    const authenticated = Boolean(session);

    loginPanel.hidden = authenticated;

    adminPanels.forEach(panel => {
        panel.hidden = !authenticated;
    });

    let logoutButton = document.getElementById("adr-logout");

    if (authenticated && !logoutButton) {
        logoutButton = document.createElement("button");

        logoutButton.id = "adr-logout";
        logoutButton.type = "button";
        logoutButton.className = "admin-secondary";
        logoutButton.textContent = "SAIR";

        document.querySelector(".admin-top").appendChild(
            logoutButton
        );

        logoutButton.addEventListener("click", async () => {
            const { error } = await db.auth.signOut();

            if (error) {
                showStatus(error.message, true);
            }
        });
    }

    if (!authenticated && logoutButton) {
        logoutButton.remove();
    }

    if (authenticated) {
        renderCategories();

        loadAdminProducts().catch(error => {
            console.error(error);

            showStatus(
                "Erro ao carregar produtos: " + error.message,
                true
            );
        });
    }
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = loginForm.querySelector("button");

    button.disabled = true;
    button.textContent = "ENTRANDO...";

    const email = document.getElementById("adr-email").value.trim();
    const password = document.getElementById("adr-password").value;

    const { data, error } = await db.auth.signInWithPassword({
        email,
        password
    });

    button.disabled = false;
    button.textContent = "ENTRAR ↗";

    if (error) {
        showLoginMessage(
            "E-mail ou senha incorretos.",
            true
        );

        console.error(error);
        return;
    }

    showLoginMessage("");
    setAdminAccess(data.session);
});

// ==========================================
// CARREGAR PRODUTOS DO SUPABASE
// ==========================================

async function loadAdminProducts() {
    list.innerHTML = `
        <p class="admin-note">CARREGANDO PRODUTOS...</p>
    `;

    const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    productsCache = data || [];

    renderAdminProducts();
}

// ==========================================
// EXIBIR PRODUTOS
// ==========================================

function renderAdminProducts() {
    if (!productsCache.length) {
        list.innerHTML = `
            <p class="admin-note">
                Nenhum produto cadastrado.
            </p>
        `;

        return;
    }

    list.innerHTML = productsCache.map(product => `
        <article class="admin-product">

            <img
                src="${escapeHTML(product.image_url || "")}"
                alt="${escapeHTML(product.name)}"
            >

            <div class="admin-product-info">

                <strong>${escapeHTML(product.name)}</strong>

                <span>
                    R$ ${Number(product.price)
                        .toFixed(2)
                        .replace(".", ",")}
                    · ${escapeHTML(product.category)}
                </span>

                <span>
                    ${product.is_active === false
                        ? "INATIVO"
                        : "ATIVO"}
                </span>

                <button
                    class="admin-secondary edit-product"
                    data-id="${escapeHTML(product.id)}"
                    type="button">
                    EDITAR
                </button>

                <button
                    class="delete-button remove-product"
                    data-id="${escapeHTML(product.id)}"
                    type="button">
                    EXCLUIR
                </button>

            </div>
        </article>
    `).join("");

    list.querySelectorAll(".edit-product").forEach(button => {
        button.addEventListener("click", () => {
            editProduct(button.dataset.id);
        });
    });

    list.querySelectorAll(".remove-product").forEach(button => {
        button.addEventListener("click", () => {
            removeProduct(button.dataset.id);
        });
    });
}

// ==========================================
// IMAGENS — SUPABASE STORAGE
// ==========================================

imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        imageInput.value = "";
        selectedImageFile = null;

        showStatus("Formato de imagem inválido.", true);
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        imageInput.value = "";
        selectedImageFile = null;

        showStatus("Imagem maior que 5 MB.", true);
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();

    reader.onload = () => {
        preview.src = reader.result;
        preview.style.display = "block";

        showStatus("Imagem carregada. Salve o produto.");
    };

    reader.readAsDataURL(file);
});

async function uploadProductImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    const path =
        `products/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw error;

    const { data } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    return data.publicUrl;
}

// ==========================================
// EDITAR PRODUTO
// ==========================================

function resetForm() {
    form.reset();

    document.getElementById("product-id").value = "";

    selectedImageFile = null;
    currentImageUrl = "";

    preview.src = "";
    preview.style.display = "none";

    document.getElementById("form-title").innerHTML =
        'ADD NEW <span>PRODUCT.</span>';

    document.getElementById("save-button").textContent =
        "SAVE PRODUCT ↗";

    document.getElementById("cancel-edit").hidden = true;

    renderCategories();
}

async function editProduct(id) {
    const product = productsCache.find(
        item => String(item.id) === String(id)
    );

    if (!product) return;

    document.getElementById("product-id").value = product.id;
    document.getElementById("name").value = product.name || "";

    renderCategories(product.category);

    document.getElementById("category").value =
        product.category || "";

    document.getElementById("price").value = product.price;
    document.getElementById("tag").value = product.tag || "";

    document.getElementById("affiliate").value =
        product.affiliate_link || "";

    currentImageUrl = product.image_url || "";
    selectedImageFile = null;

    if (currentImageUrl) {
        preview.src = currentImageUrl;
        preview.style.display = "block";
    } else {
        preview.style.display = "none";
    }

    document.getElementById("form-title").innerHTML =
        'EDIT <span>PRODUCT.</span>';

    document.getElementById("save-button").textContent =
        "UPDATE PRODUCT ↗";

    document.getElementById("cancel-edit").hidden = false;

    showStatus("Editando produto.");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ==========================================
// EXCLUIR PRODUTO
// ==========================================

async function removeProduct(id) {
    if (!confirm("Deseja realmente excluir este produto?")) {
        return;
    }

    const { error } = await db
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
        showStatus(error.message, true);
        return;
    }

    productsCache = productsCache.filter(
        product => String(product.id) !== String(id)
    );

    renderAdminProducts();

    showStatus("Produto excluído com sucesso.");
}

// ==========================================
// SALVAR / ATUALIZAR PRODUTO
// ==========================================

form.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("product-id").value;

    const name = document.getElementById("name").value.trim();

    const price = Number(
        document.getElementById("price").value
    );

    const affiliateLink = document
        .getElementById("affiliate")
        .value.trim();

    if (!/^https:\/\/(s\.shopee\.com\.br|shopee\.com\.br|www\.shopee\.com\.br)\//i.test(affiliateLink)) {
        showStatus("Link da Shopee inválido.", true);
        return;
    }

    if (!id && !selectedImageFile) {
        showStatus("Selecione uma foto.", true);
        return;
    }

    const saveButton = document.getElementById("save-button");

    saveButton.disabled = true;
    saveButton.textContent = "SALVANDO...";

    try {
        let imageUrl = currentImageUrl;

        if (selectedImageFile) {
            imageUrl = await uploadProductImage(selectedImageFile);
        }

        if (!imageUrl) {
            throw new Error("Imagem não encontrada.");
        }

        const productData = {
            name,
            category: document.getElementById("category").value,
            price,
            tag: document.getElementById("tag").value.trim() || "ADR SELECT",
            affiliate_link: affiliateLink,
            image_url: imageUrl
        };

        let result;

        if (id) {
            result = await db
                .from("products")
                .update(productData)
                .eq("id", id);
        } else {
            productData.is_active = true;

            result = await db
                .from("products")
                .insert(productData);
        }

        if (result.error) throw result.error;

        resetForm();

        await loadAdminProducts();

        showStatus(
            "Produto salvo no banco de dados com sucesso!"
        );

    } catch (error) {
        console.error(error);

        showStatus(
            "Erro ao salvar: " + error.message,
            true
        );

    } finally {
        saveButton.disabled = false;

        saveButton.textContent =
            document.getElementById("product-id").value
                ? "UPDATE PRODUCT ↗"
                : "SAVE PRODUCT ↗";
    }
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.getElementById("cancel-edit")
    .addEventListener("click", resetForm);

renderCategories();

db.auth.onAuthStateChange((_event, session) => {
    setAdminAccess(session);
});

(async function initializeAdmin() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        console.error(error);
        showLoginMessage(
            "Erro ao verificar a sessão.",
            true
        );
        return;
    }

    setAdminAccess(data.session);
})();
