
/* ==========================================
   ADR - ADMINISTRATIVE PANEL
   SUPABASE + STORAGE + AUTHENTICATION
========================================== */

const SUPABASE_URL = window.ADR_SUPABASE_URL;
const SUPABASE_KEY = window.ADR_SUPABASE_KEY;

if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Configuração do Supabase não encontrada.");
}

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const PRODUCTS_TABLE = "products";
const CATEGORIES_TABLE = "categories";
const STORAGE_BUCKET = "product-images";

const form = document.getElementById("product-form");
const list = document.getElementById("admin-products");
const statusLine = document.getElementById("status");
const imageInput = document.getElementById("image");
const preview = document.getElementById("image-preview");
const categorySelect = document.getElementById("category");

let selectedImageFile = null;
let currentImageUrl = "";
let currentUser = null;

const defaultCategories = [
    "Casaco",
    "Sneakers",
    "Acessórios",
    "Tech",
    "Lifestyle"
];

/* ==========================================
   STATUS
========================================== */

function showStatus(message, isError = false) {
    statusLine.textContent = message;
    statusLine.style.color = isError ? "#ff9b9b" : "#c6ff00";
}

function showLoginStatus(message, isError = false) {
    const element = document.getElementById("login-status");
    element.textContent = message;
    element.style.color = isError ? "#ff9b9b" : "#c6ff00";
}

/* ==========================================
   AUTHENTICATION
========================================== */

async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    updateAccess();
}

function updateAccess() {
    document.getElementById("login-panel").hidden = !!currentUser;
    document.getElementById("admin-content").hidden = !currentUser;
    document.getElementById("logout-button").hidden = !currentUser;

    if (currentUser) {
        initializePanel();
    }
}

document.getElementById("login-form").addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const button = event.submitter;
    button.disabled = true;

    showLoginStatus("Verificando acesso...");

    try {
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;

        showLoginStatus("Login realizado com sucesso!");
        updateAccess();

    } catch (error) {
        console.error(error);
        showLoginStatus("E-mail ou senha incorretos.", true);
    } finally {
        button.disabled = false;
    }
});

document.getElementById("logout-button").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();

    if (error) {
        showStatus("Não foi possível sair da conta.", true);
        return;
    }

    currentUser = null;
    resetForm();
    updateAccess();
});

db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAccess();
});

/* ==========================================
   CATEGORIES
========================================== */

async function getCategories() {
    const { data, error } = await db
        .from(CATEGORIES_TABLE)
        .select("id,name")
        .order("name");

    if (error) throw error;

    return data || [];
}

async function renderCategories(selectedValue = "") {
    categorySelect.innerHTML = "";

    const categories = await getCategories();

    // Mantém as categorias padrão disponíveis.
    const names = new Set(categories.map(item => item.name));

    for (const name of defaultCategories) {
        if (!names.has(name)) {
            const { error } = await db
                .from(CATEGORIES_TABLE)
                .insert({ name });

            if (error && error.code !== "23505") {
                throw error;
            }
        }
    }

    const updatedCategories = await getCategories();

    updatedCategories.forEach(category => {
        const option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });

    if (
        selectedValue &&
        !updatedCategories.some(item => item.name === selectedValue)
    ) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        categorySelect.appendChild(option);
    }

    if (selectedValue) {
        categorySelect.value = selectedValue;
    }
}

document.getElementById("create-category").addEventListener("click", async () => {
    const enteredName = window.prompt("Digite o nome da nova categoria:");

    if (enteredName === null) return;

    const name = enteredName.trim().replace(/\s+/g, " ");

    if (!name) {
        showStatus("Digite um nome para a categoria.", true);
        return;
    }

    try {
        const { error } = await db
            .from(CATEGORIES_TABLE)
            .insert({ name });

        if (error) {
            if (error.code === "23505") {
                showStatus("Essa categoria já existe.", true);
                return;
            }

            throw error;
        }

        await renderCategories(name);
        showStatus(`Categoria "${name}" criada com sucesso!`);

    } catch (error) {
        console.error(error);
        showStatus("Não foi possível criar a categoria.", true);
    }
});

/* ==========================================
   IMAGE UPLOAD
========================================== */

imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        imageInput.value = "";
        showStatus("Escolha uma imagem JPG, PNG ou WEBP.", true);
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        imageInput.value = "";
        showStatus("A imagem passou de 5 MB.", true);
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();

    reader.onload = () => {
        preview.src = reader.result;
        preview.style.display = "block";
        showStatus("Imagem selecionada. Salve o produto para enviar.");
    };

    reader.onerror = () => {
        showStatus("Não foi possível ler a imagem.", true);
    };

    reader.readAsDataURL(file);
});

async function uploadImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    const fileName = `${crypto.randomUUID()}.${extension}`;
    const filePath = `products/${fileName}`;

    const { error } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw error;

    const { data } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

/* ==========================================
   PRODUCTS
========================================== */

async function allProducts() {
    const { data, error } = await db
        .from(PRODUCTS_TABLE)
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
}

async function getProduct(id) {
    const { data, error } = await db
        .from(PRODUCTS_TABLE)
        .select("*")
        .eq("id", id)
        .single();

    if (error) throw error;

    return data;
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

async function renderAdminProducts() {
    list.innerHTML = '<p class="admin-note">Carregando produtos...</p>';

    const products = await allProducts();

    if (!products.length) {
        list.innerHTML = '<p class="admin-note">Nenhum produto cadastrado.</p>';
        return;
    }

    list.innerHTML = products.map(product => `
        <article class="admin-product">
            <img src="${escapeHTML(product.image_url || "")}" alt="">

            <div class="admin-product-info">
                <strong>${escapeHTML(product.name)}</strong>

                <span>
                    R$ ${Number(product.price).toFixed(2).replace(".", ",")}
                    · ${escapeHTML(product.category)}
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
        button.addEventListener("click", () => editProduct(button.dataset.id));
    });

    list.querySelectorAll(".remove-product").forEach(button => {
        button.addEventListener("click", () => removeProduct(button.dataset.id));
    });
}

/* ==========================================
   EDIT PRODUCT
========================================== */

async function editProduct(id) {
    try {
        const product = await getProduct(id);

        document.getElementById("product-id").value = product.id;
        document.getElementById("name").value = product.name;
        document.getElementById("price").value = product.price;
        document.getElementById("tag").value = product.tag || "";
        document.getElementById("affiliate").value = product.affiliate_url || "";

        await renderCategories(product.category);

        currentImageUrl = product.image_url || "";
        selectedImageFile = null;
        imageInput.value = "";

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

        showStatus("Editando produto. A imagem atual será mantida se não escolher outra.");

        window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {
        console.error(error);
        showStatus("Não foi possível abrir esse produto.", true);
    }
}

/* ==========================================
   DELETE PRODUCT
========================================== */

async function removeProduct(id) {
    const confirmed = window.confirm(
        "Tem certeza que deseja excluir este produto do catálogo?"
    );

    if (!confirmed) return;

    try {
        const { error } = await db
            .from(PRODUCTS_TABLE)
            .delete()
            .eq("id", id);

        if (error) throw error;

        await renderAdminProducts();
        showStatus("Produto excluído do catálogo.");

    } catch (error) {
        console.error(error);
        showStatus("Não foi possível excluir o produto.", true);
    }
}

/* ==========================================
   SAVE PRODUCT
========================================== */

form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = document.getElementById("save-button");
    button.disabled = true;

    try {
        const id = document.getElementById("product-id").value;

        const name = document.getElementById("name").value.trim();
        const price = Number(document.getElementById("price").value);
        const affiliateLink = document.getElementById("affiliate").value.trim();

        if (!/^https:\/\/(?:s\.shopee\.com\.br|shopee\.com\.br|www\.shopee\.com\.br)\//i.test(affiliateLink)) {
            throw new Error("Cole um link HTTPS válido da Shopee.");
        }

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("Informe um preço válido.");
        }

        let imageUrl = currentImageUrl;

        if (selectedImageFile) {
            showStatus("Enviando imagem para o Supabase...");

            imageUrl = await uploadImage(selectedImageFile);
        }

        if (!imageUrl) {
            throw new Error("Selecione uma foto para o produto.");
        }

        const product = {
            name,
            category: categorySelect.value,
            price,
            tag: document.getElementById("tag").value.trim() || "ADR SELECT",
            affiliate_url: affiliateLink,
            image_url: imageUrl,
            is_active: true
        };

        let result;

        if (id) {
            result = await db
                .from(PRODUCTS_TABLE)
                .update(product)
                .eq("id", id);
        } else {
            result = await db
                .from(PRODUCTS_TABLE)
                .insert(product);
        }

        if (result.error) throw result.error;

        resetForm();

        await renderAdminProducts();

        showStatus("Produto salvo no Supabase com sucesso!");

    } catch (error) {
        console.error(error);
        showStatus(error.message || "Erro ao salvar produto.", true);

    } finally {
        button.disabled = false;
    }
});

/* ==========================================
   RESET FORM
========================================== */

async function resetForm() {
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

    imageInput.value = "";

    await renderCategories();
}

document.getElementById("cancel-edit").addEventListener("click", async () => {
    await resetForm();
    showStatus("Edição cancelada.");
});

/* ==========================================
   INITIALIZATION
========================================== */

let panelInitialized = false;

async function initializePanel() {
    if (panelInitialized || !currentUser) return;

    panelInitialized = true;

    try {
        await renderCategories();
        await renderAdminProducts();

    } catch (error) {
        console.error(error);
        showStatus(
            "Erro ao carregar o painel. Confira as permissões do Supabase.",
            true
        );

        panelInitialized = false;
    }
}

checkSession().catch(error => {
    console.error(error);
    showLoginStatus("Não foi possível conectar ao Supabase.", true);
});
