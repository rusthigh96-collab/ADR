const db = window.supabase.createClient(
    window.ADR_SUPABASE_URL,
    window.ADR_SUPABASE_KEY
);

const loginForm = document.getElementById("login-form");
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("admin-dashboard");
const loginStatus = document.getElementById("login-status");
const productForm = document.getElementById("product-form");
const statusMessage = document.getElementById("status");
const productsContainer = document.getElementById("admin-products");

let currentImageUrl = "";

// LOGIN
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    loginStatus.textContent = "Entrando...";

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const { data, error } = await db.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        loginStatus.textContent = "Erro: " + error.message;
        return;
    }

    await checkAdmin(data.user);
});

// VERIFICAR ADMINISTRADOR
async function checkAdmin(user) {
    const { data: profile, error } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (error || !profile || profile.role !== "admin") {
        await db.auth.signOut();
        loginStatus.textContent = "Acesso permitido somente para administradores.";
        return;
    }

    loginPanel.hidden = true;
    dashboard.hidden = false;

    document.getElementById("admin-user").textContent = user.email;

    await loadProducts();
}

// SAIR
document.getElementById("logout-button").addEventListener("click", async () => {
    await db.auth.signOut();
    location.reload();
});

// CARREGAR PRODUTOS
async function loadProducts() {
    productsContainer.innerHTML = "Carregando produtos...";

    const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        productsContainer.textContent = "Erro ao carregar: " + error.message;
        return;
    }

    productsContainer.innerHTML = "";

    if (!data.length) {
        productsContainer.textContent = "Nenhum produto cadastrado.";
        return;
    }

    data.forEach(product => {
        const item = document.createElement("div");
        item.className = "admin-product";

        item.innerHTML = `
            <img src="${escapeHTML(product.image_url || "")}"
                 alt="${escapeHTML(product.name)}"
                 style="width:80px;height:80px;object-fit:cover;">

            <div>
                <h3>${escapeHTML(product.name)}</h3>
                <p>R$ ${Number(product.price).toFixed(2)}</p>
                <p>${escapeHTML(product.category || "")}</p>

                <button type="button" class="edit-button">Editar</button>
                <button type="button" class="delete-button">Excluir</button>
            </div>
        `;

        item.querySelector(".edit-button").addEventListener("click", () => {
            editProduct(product);
        });

        item.querySelector(".delete-button").addEventListener("click", () => {
            deleteProduct(product.id);
        });

        productsContainer.appendChild(item);
    });
}

// EVITAR INSERÇÃO DE HTML INDESEJADO
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// CADASTRAR OU EDITAR
productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const saveButton = document.getElementById("save-button");
    saveButton.disabled = true;
    statusMessage.textContent = "Salvando produto...";

    try {
        const id = document.getElementById("product-id").value;
        const imageFile = document.getElementById("image").files[0];

        let imageUrl = currentImageUrl;

        if (imageFile) {
            if (imageFile.size > 5 * 1024 * 1024) {
                throw new Error("A imagem deve ter no máximo 5 MB.");
            }

            if (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
                throw new Error("Use uma imagem JPG, PNG ou WEBP.");
            }

            const extension = imageFile.name.split(".").pop().toLowerCase();
            const fileName = `${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } = await db.storage
                .from("product-images")
                .upload(fileName, imageFile, {
                    upsert: false,
                    contentType: imageFile.type
                });

            if (uploadError) throw uploadError;

            const { data: publicData } = db.storage
                .from("product-images")
                .getPublicUrl(fileName);

            imageUrl = publicData.publicUrl;
        }

        if (!imageUrl) {
            throw new Error("Selecione uma imagem para o produto.");
        }

        const affiliateLink = document.getElementById("affiliate").value.trim();

        if (!/^https:\/\/(www\.)?(shopee\.com\.br|s\.shopee\.com\.br)\//i.test(affiliateLink)) {
            throw new Error("Informe um link válido da Shopee.");
        }

        const product = {
            name: document.getElementById("name").value.trim(),
            category: document.getElementById("category").value,
            price: Number(document.getElementById("price").value),
            tag: document.getElementById("tag").value.trim(),
            affiliate_url: affiliateLink,
            image_url: imageUrl,
            is_active: true
        };

        let result;

        if (id) {
            result = await db
                .from("products")
                .update(product)
                .eq("id", id);
        } else {
            result = await db
                .from("products")
                .insert([product]);
        }

        if (result.error) throw result.error;

        statusMessage.textContent = "Produto salvo com sucesso!";
        productForm.reset();
        currentImageUrl = "";
        document.getElementById("product-id").value = "";
        document.getElementById("image-preview").innerHTML = "";
        document.getElementById("cancel-edit").hidden = true;
        document.getElementById("form-title").textContent = "Adicionar produto";

        await loadProducts();

    } catch (error) {
        statusMessage.textContent = "Erro: " + error.message;
    } finally {
        saveButton.disabled = false;
    }
});

// EDITAR
function editProduct(product) {
    document.getElementById("product-id").value = product.id;
    document.getElementById("name").value = product.name;
    document.getElementById("category").value = product.category;
    document.getElementById("price").value = product.price;
    document.getElementById("tag").value = product.tag || "";
    document.getElementById("affiliate").value = product.affiliate_url;

    currentImageUrl = product.image_url || "";

    document.getElementById("image-preview").innerHTML = currentImageUrl
        ? `<img src="${escapeHTML(currentImageUrl)}" style="width:120px;height:120px;object-fit:cover;">`
        : "";

    document.getElementById("form-title").textContent = "Editar produto";
    document.getElementById("cancel-edit").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// CANCELAR EDIÇÃO
document.getElementById("cancel-edit").addEventListener("click", () => {
    productForm.reset();
    currentImageUrl = "";
    document.getElementById("product-id").value = "";
    document.getElementById("image-preview").innerHTML = "";
    document.getElementById("form-title").textContent = "Adicionar produto";
    document.getElementById("cancel-edit").hidden = true;
    statusMessage.textContent = "";
});

// EXCLUIR
async function deleteProduct(id) {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    const { error } = await db
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
        statusMessage.textContent = "Erro ao excluir: " + error.message;
        return;
    }

    statusMessage.textContent = "Produto excluído!";
    await loadProducts();
}

// VERIFICAR SESSÃO EXISTENTE
async function checkSession() {
    const { data } = await db.auth.getSession();

    if (data.session) {
        await checkAdmin(data.session.user);
    }
}

checkSession();